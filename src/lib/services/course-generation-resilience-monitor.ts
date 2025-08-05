import { createSupabaseServiceClient } from '@/lib/supabase/server';
import { CourseGenerationOrchestratorV2 } from './course-generation-orchestrator-v2';

export interface JobHealthStatus {
  jobId: string;
  status: 'healthy' | 'stalled' | 'stuck' | 'failed' | 'abandoned';
  lastActivity: Date;
  timeSinceActivity: number;
  totalTasks: number;
  completedTasks: number;
  failedTasks: number;
  runningTasks: number;
  pendingTasks: number;
  progressPercentage: number;
  errorDetails?: string;
  recommendedAction: 'wait' | 'resume' | 'restart' | 'manual_intervention' | 'delete_and_retry';
  userMessage: string;
  canAutoRecover: boolean;
  recoveryAttempts: number;
  maxRecoveryAttempts: number;
}

export interface RecoveryResult {
  success: boolean;
  action: string;
  message: string;
  newStatus?: string;
  error?: string;
}

export class CourseGenerationResilienceMonitor {
  private supabase = createSupabaseServiceClient();
  
  // Thresholds for different alert levels
  private readonly STALL_THRESHOLD_MINUTES = 5;  // No progress for 5 minutes
  private readonly STUCK_THRESHOLD_MINUTES = 10; // No progress for 10 minutes
  private readonly ABANDON_THRESHOLD_MINUTES = 30; // No progress for 30 minutes
  private readonly MAX_RECOVERY_ATTEMPTS = 3;
  private readonly TASK_TIMEOUT_MINUTES = 5; // Individual task timeout

  /**
   * Check the health status of a course generation job
   */
  async checkJobHealth(jobId: string): Promise<JobHealthStatus> {
    try {
      // Get job details
      const { data: job, error: jobError } = await this.supabase
        .from('course_generation_jobs')
        .select('*')
        .eq('id', jobId)
        .single();

      if (jobError || !job) {
        return this.createFailedStatus(jobId, 'Job not found', 'delete_and_retry');
      }

      // Get task statistics
      const { data: taskStats, error: tasksError } = await this.supabase
        .from('course_generation_tasks')
        .select('status')
        .eq('job_id', jobId);

      if (tasksError || !taskStats) {
        return this.createFailedStatus(jobId, 'Cannot access job tasks', 'manual_intervention');
      }

      const taskCounts = this.calculateTaskCounts(taskStats.filter(task => task.status !== null) as Array<{status: string}>);
      const lastActivity = new Date(job.updated_at || job.created_at || Date.now());
      const timeSinceActivity = Date.now() - lastActivity.getTime();
      const timeSinceActivityMinutes = timeSinceActivity / (1000 * 60);

      // Get recovery attempt count
      const recoveryAttempts = this.getRecoveryAttempts(job);

      // Check for stale running tasks
      const { data: staleRunningTasks } = await this.supabase
        .from('course_generation_tasks')
        .select('id, started_at')
        .eq('job_id', jobId)
        .eq('status', 'running')
        .lt('started_at', new Date(Date.now() - this.TASK_TIMEOUT_MINUTES * 60 * 1000).toISOString());

      const hasStaleRunningTasks = Boolean(staleRunningTasks && staleRunningTasks.length > 0);

      // Determine job health status
      const healthStatus = this.determineHealthStatus(
        job,
        taskCounts,
        timeSinceActivityMinutes,
        hasStaleRunningTasks,
        recoveryAttempts
      );

      return {
        jobId,
        status: healthStatus.status,
        lastActivity,
        timeSinceActivity,
        totalTasks: taskCounts.total,
        completedTasks: taskCounts.completed,
        failedTasks: taskCounts.failed,
        runningTasks: taskCounts.running,
        pendingTasks: taskCounts.pending,
        progressPercentage: this.calculateProgress(taskCounts),
        errorDetails: job.error_message || healthStatus.errorDetails,
        recommendedAction: healthStatus.recommendedAction,
        userMessage: healthStatus.userMessage,
        canAutoRecover: healthStatus.canAutoRecover,
        recoveryAttempts,
        maxRecoveryAttempts: this.MAX_RECOVERY_ATTEMPTS
      };

    } catch (error) {
      console.error('Error checking job health:', error);
      return this.createFailedStatus(
        jobId, 
        `Health check failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
        'manual_intervention'
      );
    }
  }

  /**
   * Attempt to automatically recover a stuck or stalled job
   */
  async attemptRecovery(jobId: string): Promise<RecoveryResult> {
    try {
      const healthStatus = await this.checkJobHealth(jobId);
      
      if (healthStatus.recoveryAttempts >= this.MAX_RECOVERY_ATTEMPTS) {
        return {
          success: false,
          action: 'max_attempts_reached',
          message: 'Maximum recovery attempts reached. Manual intervention required.',
          error: 'Too many recovery attempts'
        };
      }

      // Increment recovery attempt counter
      await this.incrementRecoveryAttempts(jobId);

      switch (healthStatus.recommendedAction) {
        case 'resume':
          return await this.attemptResume(jobId);
        
        case 'restart':
          return await this.attemptRestart(jobId);
        
        case 'manual_intervention':
          return {
            success: false,
            action: 'manual_intervention_required',
            message: 'Automatic recovery not possible. Please check logs and try manual recovery.',
            error: healthStatus.errorDetails
          };
        
        case 'delete_and_retry':
          return {
            success: false,
            action: 'delete_and_retry',
            message: 'Job is in an unrecoverable state. Please delete the base class and start over.',
            error: healthStatus.errorDetails
          };
        
        default:
          return {
            success: false,
            action: 'unknown_state',
            message: 'Job is in an unknown state. Please contact support.',
            error: 'Unknown recovery action'
          };
      }

    } catch (error) {
      console.error('Recovery attempt failed:', error);
      return {
        success: false,
        action: 'recovery_error',
        message: 'Recovery attempt failed due to system error.',
        error: error instanceof Error ? error.message : 'Unknown error'
      };
    }
  }

  /**
   * Attempt to resume a stalled job
   */
  private async attemptResume(jobId: string): Promise<RecoveryResult> {
    try {
      console.log(`🔄 Attempting to resume job ${jobId}`);

      // Reset stale running tasks
      const { error: resetError } = await this.supabase
        .from('course_generation_tasks')
        .update({
          status: 'pending',
          started_at: null,
          updated_at: new Date().toISOString(),
          error_message: 'Reset by recovery system'
        })
        .eq('job_id', jobId)
        .eq('status', 'running')
        .lt('started_at', new Date(Date.now() - this.TASK_TIMEOUT_MINUTES * 60 * 1000).toISOString());

      if (resetError) {
        throw new Error(`Failed to reset stale tasks: ${resetError.message}`);
      }

      // Update job status
      await this.supabase
        .from('course_generation_jobs')
        .update({
          updated_at: new Date().toISOString(),
          error_message: 'Resumed by recovery system'
        })
        .eq('id', jobId);

      // Try to restart the execution engine
      const { data: job } = await this.supabase
        .from('course_generation_jobs')
        .select('job_data')
        .eq('id', jobId)
        .single();

      if (job?.job_data) {
        // Start the orchestrator in the background
        setTimeout(async () => {
          try {
            const orchestrator = new CourseGenerationOrchestratorV2();
            const minimalOutline = {
              title: (job.job_data as any)?.title || 'Course',
              description: (job.job_data as any)?.description || '',
              paths: [],
              totalLessons: 0,
              estimatedDurationWeeks: (job.job_data as any)?.estimatedDurationWeeks || 4
            };
            
            await (orchestrator as any).runExecutionEngine(jobId, minimalOutline, job.job_data);
            await (orchestrator as any).finalizeGeneration(jobId);
            
            console.log(`✅ Job ${jobId} successfully resumed`);
          } catch (error) {
            console.error(`❌ Failed to resume job ${jobId}:`, error);
            
            // Mark job as failed if resume fails
            await this.supabase
              .from('course_generation_jobs')
              .update({
                status: 'failed',
                error_message: `Resume failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
                updated_at: new Date().toISOString()
              })
              .eq('id', jobId);
          }
        }, 1000);
      }

      return {
        success: true,
        action: 'resumed',
        message: 'Job resume initiated. The generation process should continue shortly.',
        newStatus: 'processing'
      };

    } catch (error) {
      console.error('Resume attempt failed:', error);
      return {
        success: false,
        action: 'resume_failed',
        message: 'Failed to resume job. You may need to restart from the beginning.',
        error: error instanceof Error ? error.message : 'Unknown error'
      };
    }
  }

  /**
   * Attempt to restart a job from the beginning
   */
  private async attemptRestart(jobId: string): Promise<RecoveryResult> {
    try {
      console.log(`🔄 Attempting to restart job ${jobId} from beginning`);

      // Mark job as failed first
      await this.supabase
        .from('course_generation_jobs')
        .update({
          status: 'failed',
          error_message: 'Restarted by recovery system',
          updated_at: new Date().toISOString()
        })
        .eq('id', jobId);

      // Delete all existing tasks for a clean restart
      await this.supabase
        .from('course_generation_tasks')
        .delete()
        .eq('job_id', jobId);

      return {
        success: true,
        action: 'marked_for_restart',
        message: 'Job has been marked for restart. Please initiate a new generation process.',
        newStatus: 'failed'
      };

    } catch (error) {
      console.error('Restart attempt failed:', error);
      return {
        success: false,
        action: 'restart_failed',
        message: 'Failed to restart job. Please delete the base class and try again.',
        error: error instanceof Error ? error.message : 'Unknown error'
      };
    }
  }

  /**
   * Calculate task counts from task statistics
   */
  private calculateTaskCounts(taskStats: Array<{status: string}>) {
    const counts = {
      total: taskStats.length,
      completed: 0,
      failed: 0,
      running: 0,
      pending: 0,
      skipped: 0
    };

    taskStats.forEach(task => {
      switch (task.status) {
        case 'completed':
          counts.completed++;
          break;
        case 'failed':
          counts.failed++;
          break;
        case 'running':
          counts.running++;
          break;
        case 'pending':
          counts.pending++;
          break;
        case 'skipped':
          counts.skipped++;
          break;
      }
    });

    return counts;
  }

  /**
   * Calculate progress percentage
   */
  private calculateProgress(taskCounts: ReturnType<typeof this.calculateTaskCounts>): number {
    if (taskCounts.total === 0) return 0;
    return Math.round(((taskCounts.completed + taskCounts.skipped) / taskCounts.total) * 100);
  }

  /**
   * Determine the health status of a job
   */
  private determineHealthStatus(
    job: any,
    taskCounts: ReturnType<typeof this.calculateTaskCounts>,
    timeSinceActivityMinutes: number,
    hasStaleRunningTasks: boolean,
    recoveryAttempts: number
  ) {
    // Job is completed
    if (job.status === 'completed') {
      return {
        status: 'healthy' as const,
        recommendedAction: 'wait' as const,
        userMessage: 'Generation completed successfully!',
        canAutoRecover: false
      };
    }

    // Job is explicitly failed
    if (job.status === 'failed') {
      return {
        status: 'failed' as const,
        recommendedAction: 'restart' as const,
        userMessage: 'Generation failed. You can try restarting the process.',
        canAutoRecover: true,
        errorDetails: job.error_message
      };
    }

    // Job has been abandoned (no activity for 30+ minutes)
    if (timeSinceActivityMinutes > this.ABANDON_THRESHOLD_MINUTES) {
      return {
        status: 'abandoned' as const,
        recommendedAction: recoveryAttempts >= this.MAX_RECOVERY_ATTEMPTS ? 'delete_and_retry' as const : 'restart' as const,
        userMessage: 'Generation has been inactive for too long. Please restart or delete and try again.',
        canAutoRecover: recoveryAttempts < this.MAX_RECOVERY_ATTEMPTS,
        errorDetails: 'Job abandoned due to inactivity'
      };
    }

    // Job is stuck (no progress for 10+ minutes or has stale running tasks)
    if (timeSinceActivityMinutes > this.STUCK_THRESHOLD_MINUTES || hasStaleRunningTasks) {
      return {
        status: 'stuck' as const,
        recommendedAction: recoveryAttempts >= this.MAX_RECOVERY_ATTEMPTS ? 'manual_intervention' as const : 'resume' as const,
        userMessage: 'Generation appears to be stuck. We can try to resume it automatically.',
        canAutoRecover: recoveryAttempts < this.MAX_RECOVERY_ATTEMPTS,
        errorDetails: hasStaleRunningTasks ? 'Tasks stuck in running state' : 'No progress detected'
      };
    }

    // Job is stalled (no progress for 5+ minutes)
    if (timeSinceActivityMinutes > this.STALL_THRESHOLD_MINUTES) {
      return {
        status: 'stalled' as const,
        recommendedAction: 'resume' as const,
        userMessage: 'Generation is taking longer than expected. We can try to resume it.',
        canAutoRecover: true,
        errorDetails: 'Generation stalled'
      };
    }

    // Job appears healthy
    return {
      status: 'healthy' as const,
      recommendedAction: 'wait' as const,
      userMessage: 'Generation is in progress...',
      canAutoRecover: false
    };
  }

  /**
   * Get the number of recovery attempts from job metadata
   */
  private getRecoveryAttempts(job: any): number {
    const userActions = job.user_actions || [];
    return userActions.filter((action: any) => 
      action.action === 'recovery_attempt' || action.action === 'resume_job'
    ).length;
  }

  /**
   * Increment the recovery attempt counter
   */
  private async incrementRecoveryAttempts(jobId: string): Promise<void> {
    const { data: job } = await this.supabase
      .from('course_generation_jobs')
      .select('user_actions')
      .eq('id', jobId)
      .single();

    const userActions = Array.isArray(job?.user_actions) ? job.user_actions : [];
    userActions.push({
      action: 'recovery_attempt',
      timestamp: new Date().toISOString(),
      details: 'Automatic recovery attempt initiated'
    });

    await this.supabase
      .from('course_generation_jobs')
      .update({ user_actions: userActions })
      .eq('id', jobId);
  }

  /**
   * Create a failed status response
   */
  private createFailedStatus(
    jobId: string, 
    errorDetails: string, 
    recommendedAction: JobHealthStatus['recommendedAction']
  ): JobHealthStatus {
    return {
      jobId,
      status: 'failed',
      lastActivity: new Date(),
      timeSinceActivity: 0,
      totalTasks: 0,
      completedTasks: 0,
      failedTasks: 0,
      runningTasks: 0,
      pendingTasks: 0,
      progressPercentage: 0,
      errorDetails,
      recommendedAction,
      userMessage: this.getMessageForAction(recommendedAction),
      canAutoRecover: recommendedAction !== 'delete_and_retry' && recommendedAction !== 'manual_intervention',
      recoveryAttempts: 0,
      maxRecoveryAttempts: this.MAX_RECOVERY_ATTEMPTS
    };
  }

  /**
   * Get user message for recommended action
   */
  private getMessageForAction(action: JobHealthStatus['recommendedAction']): string {
    switch (action) {
      case 'wait':
        return 'Generation is in progress. Please wait...';
      case 'resume':
        return 'Generation can be resumed. Click to continue.';
      case 'restart':
        return 'Generation needs to be restarted. Click to restart.';
      case 'manual_intervention':
        return 'Generation requires manual intervention. Please contact support.';
      case 'delete_and_retry':
        return 'Generation failed permanently. Please delete the base class and try again.';
      default:
        return 'Unknown status. Please contact support.';
    }
  }
}

// Export singleton instance
export const resilienceMonitor = new CourseGenerationResilienceMonitor();