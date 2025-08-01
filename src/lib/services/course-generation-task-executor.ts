import { createSupabaseServerClient } from '@/lib/supabase/server';
import { 
  CourseGenerationTask,
  CourseGenerationTaskUpdate,
  CourseGenerationTaskStatus,
  CourseGenerationTaskType,
  CourseGenerationJob,
  CourseGenerationAnalyticsInsert
} from '@/types/course-generation';
import { CourseGenerationErrorHandler, ClassifiedError } from './course-generation-error-handler';
import { RealtimeChannel } from '@supabase/supabase-js';

// Circuit breaker states
enum CircuitBreakerState {
  CLOSED = 'closed',
  OPEN = 'open',
  HALF_OPEN = 'half_open'
}

// Circuit breaker configuration
interface CircuitBreakerConfig {
  failureThreshold: number;
  resetTimeout: number;
  monitoringWindow: number;
  halfOpenRequests: number;
}

// Circuit breaker for each task type
class CircuitBreaker {
  private state: CircuitBreakerState = CircuitBreakerState.CLOSED;
  private failures: number = 0;
  private lastFailureTime: number = 0;
  private successCount: number = 0;
  private halfOpenAttempts: number = 0;

  constructor(private config: CircuitBreakerConfig) {}

  async execute<T>(fn: () => Promise<T>): Promise<T> {
    if (this.state === CircuitBreakerState.OPEN) {
      if (Date.now() - this.lastFailureTime >= this.config.resetTimeout) {
        this.state = CircuitBreakerState.HALF_OPEN;
        this.halfOpenAttempts = 0;
      } else {
        throw new Error('Circuit breaker is OPEN');
      }
    }

    if (this.state === CircuitBreakerState.HALF_OPEN && 
        this.halfOpenAttempts >= this.config.halfOpenRequests) {
      this.state = CircuitBreakerState.OPEN;
      throw new Error('Circuit breaker is OPEN (half-open limit reached)');
    }

    try {
      const result = await fn();
      this.onSuccess();
      return result;
    } catch (error) {
      this.onFailure();
      throw error;
    }
  }

  private onSuccess() {
    if (this.state === CircuitBreakerState.HALF_OPEN) {
      this.successCount++;
      if (this.successCount >= this.config.halfOpenRequests) {
        this.state = CircuitBreakerState.CLOSED;
        this.failures = 0;
        this.successCount = 0;
      }
    } else {
      this.failures = Math.max(0, this.failures - 1);
    }
  }

  private onFailure() {
    this.failures++;
    this.lastFailureTime = Date.now();
    
    if (this.state === CircuitBreakerState.HALF_OPEN) {
      this.state = CircuitBreakerState.OPEN;
      this.halfOpenAttempts++;
    } else if (this.failures >= this.config.failureThreshold) {
      this.state = CircuitBreakerState.OPEN;
    }
  }

  getState(): CircuitBreakerState {
    return this.state;
  }

  getMetrics() {
    return {
      state: this.state,
      failures: this.failures,
      lastFailureTime: this.lastFailureTime,
      successCount: this.successCount
    };
  }
}

// Task executor with resilience features
export class CourseGenerationTaskExecutor {
  private supabase = createSupabaseServerClient();
  private errorHandler = new CourseGenerationErrorHandler();
  private circuitBreakers: Map<CourseGenerationTaskType, CircuitBreaker> = new Map();
  private realtimeChannel: RealtimeChannel | null = null;
  private performanceMetrics = {
    apiCalls: 0,
    tokensConsumed: 0,
    executionTimes: [] as number[],
    cacheHits: 0,
    cacheMisses: 0
  };

  constructor() {
    // Initialize circuit breakers for each task type
    const defaultConfig: CircuitBreakerConfig = {
      failureThreshold: 3,
      resetTimeout: 60000, // 1 minute
      monitoringWindow: 300000, // 5 minutes
      halfOpenRequests: 2
    };

    const taskTypes: CourseGenerationTaskType[] = [
      'lesson_section',
      'lesson_assessment',
      'lesson_mind_map',
      'lesson_brainbytes',
      'path_quiz',
      'class_exam',
      'knowledge_analysis',
      'outline_generation',
      'content_validation'
    ];

    taskTypes.forEach(type => {
      this.circuitBreakers.set(type, new CircuitBreaker(defaultConfig));
    });
  }

  /**
   * Execute a task with resilience features
   */
  async executeTask(
    task: CourseGenerationTask,
    job: CourseGenerationJob,
    executionFn: (task: CourseGenerationTask) => Promise<any>
  ): Promise<void> {
    const startTime = Date.now();
    const circuitBreaker = this.circuitBreakers.get(task.task_type);

    if (!circuitBreaker) {
      throw new Error(`No circuit breaker for task type: ${task.task_type}`);
    }

    try {
      // Update task status to running
      await this.updateTaskStatus(task.id, 'running', {
        started_at: new Date().toISOString()
      });

      // Execute with circuit breaker
      const result = await circuitBreaker.execute(async () => {
        // Add timeout wrapper
        const timeoutPromise = new Promise((_, reject) => {
          setTimeout(() => reject(new Error('Task execution timeout')), 
            task.estimated_duration_seconds ? task.estimated_duration_seconds * 1000 * 1.5 : 300000
          );
        });

        const executionPromise = executionFn(task);
        
        return Promise.race([executionPromise, timeoutPromise]);
      });

      // Update task as completed
      const executionTime = Date.now() - startTime;
      await this.updateTaskStatus(task.id, 'completed', {
        completed_at: new Date().toISOString(),
        actual_duration_seconds: Math.round(executionTime / 1000),
        output_data: result,
        result_metadata: {
          executionTime,
          circuitBreakerState: circuitBreaker.getState()
        }
      });

      // Track performance
      this.performanceMetrics.executionTimes.push(executionTime);

    } catch (error) {
      await this.handleTaskError(task, job, error, circuitBreaker);
    }
  }

  /**
   * Handle task errors with classification and retry logic
   */
  private async handleTaskError(
    task: CourseGenerationTask,
    job: CourseGenerationJob,
    error: any,
    circuitBreaker: CircuitBreaker
  ): Promise<void> {
    // Classify the error
    const classifiedError = this.errorHandler.classifyError(error, {
      taskType: task.task_type,
      taskId: task.id,
      jobId: job.id,
      circuitBreakerState: circuitBreaker.getState()
    });

    // Log error to database
    await this.errorHandler.logError(
      job.id,
      task.id,
      error,
      { classified: classifiedError }
    );

    // Check if should retry
    const shouldRetry = await this.errorHandler.shouldRetryTask(task, classifiedError);
    
    if (shouldRetry) {
      const retryCount = (task.current_retry_count || 0) + 1;
      const retryDelay = this.errorHandler.calculateRetryDelay(
        retryCount,
        classifiedError.retryStrategy
      );

      // Schedule retry
      await this.updateTaskStatus(task.id, 'retrying', {
        current_retry_count: retryCount,
        last_retry_at: new Date().toISOString(),
        error_message: classifiedError.userMessage,
        error_category: classifiedError.category,
        error_severity: classifiedError.severity,
        is_recoverable: true,
        recovery_suggestions: classifiedError.suggestedActions
      });

      // Wait before retry
      if (retryDelay > 0) {
        await new Promise(resolve => setTimeout(resolve, retryDelay));
      }

      // Re-queue task
      await this.updateTaskStatus(task.id, 'queued');

    } else {
      // Mark as failed
      await this.updateTaskStatus(task.id, 'failed', {
        completed_at: new Date().toISOString(),
        error_message: classifiedError.userMessage,
        error_category: classifiedError.category,
        error_severity: classifiedError.severity,
        is_recoverable: false,
        recovery_suggestions: classifiedError.suggestedActions,
        error_details: classifiedError.technicalDetails
      });
    }
  }

  /**
   * Update task status with real-time broadcasting
   */
  private async updateTaskStatus(
    taskId: string,
    status: CourseGenerationTaskStatus,
    additionalData?: Partial<CourseGenerationTaskUpdate>
  ): Promise<void> {
    const update: CourseGenerationTaskUpdate = {
      status,
      updated_at: new Date().toISOString(),
      ...additionalData
    };

    const { error } = await this.supabase
      .from('course_generation_tasks')
      .update(update)
      .eq('id', taskId);

    if (error) {
      console.error('Failed to update task status:', error);
      throw error;
    }

    // Broadcast real-time update
    if (this.realtimeChannel) {
      this.realtimeChannel.send({
        type: 'broadcast',
        event: 'task_update',
        payload: { taskId, status, ...additionalData }
      });
    }
  }

  /**
   * Execute tasks with dependency resolution and parallel processing
   */
  async executeTasks(
    jobId: string,
    maxParallel: number = 3
  ): Promise<void> {
    const { data: job } = await this.supabase
      .from('course_generation_jobs')
      .select('*')
      .eq('id', jobId)
      .single();

    if (!job) {
      throw new Error('Job not found');
    }

    // Subscribe to real-time updates
    this.setupRealtimeChannel(jobId);

    // Get all tasks
    const { data: tasks } = await this.supabase
      .from('course_generation_tasks')
      .select('*')
      .eq('job_id', jobId)
      .order('execution_priority', { ascending: false });

    if (!tasks || tasks.length === 0) {
      return;
    }

    // Process tasks with dependency resolution
    const taskMap = new Map(tasks.map(t => [t.id, t]));
    const inProgress = new Set<string>();
    const completed = new Set<string>();

    while (completed.size < tasks.length) {
      // Check if job is paused or cancelled
      const { data: currentJob } = await this.supabase
        .from('course_generation_jobs')
        .select('status')
        .eq('id', jobId)
        .single();

      if (currentJob?.status === 'paused' || currentJob?.status === 'cancelled') {
        break;
      }

      // Find tasks ready to execute
      const readyTasks = tasks.filter(task => {
        if (completed.has(task.id) || inProgress.has(task.id)) {
          return false;
        }

        // Check dependencies
        if (task.dependencies && task.dependencies.length > 0) {
          return task.dependencies.every(depId => completed.has(depId));
        }

        return true;
      });

      // Execute ready tasks in parallel (up to maxParallel)
      const tasksToExecute = readyTasks.slice(0, maxParallel - inProgress.size);
      
      if (tasksToExecute.length === 0 && inProgress.size === 0) {
        // No tasks can be executed - possible circular dependency
        console.error('No tasks can be executed - check for circular dependencies');
        break;
      }

      // Start parallel execution
      const executions = tasksToExecute.map(async task => {
        inProgress.add(task.id);

        try {
          // Import the specific task handler dynamically
          const handler = await this.getTaskHandler(task.task_type);
          await this.executeTask(task, job, handler);
          completed.add(task.id);
        } catch (error) {
          console.error(`Task ${task.id} failed:`, error);
        } finally {
          inProgress.delete(task.id);
        }
      });

      // Wait for at least one task to complete before continuing
      if (executions.length > 0) {
        await Promise.race(executions);
      }

      // Update job progress
      const progress = Math.round((completed.size / tasks.length) * 100);
      await this.updateJobProgress(jobId, progress, {
        completed_tasks: completed.size,
        failed_tasks: tasks.filter(t => t.status === 'failed').length,
        skipped_tasks: tasks.filter(t => t.status === 'skipped').length
      });
    }

    // Finalize job
    await this.finalizeJob(jobId);
  }

  /**
   * Get task handler based on task type
   */
  private async getTaskHandler(
    taskType: CourseGenerationTaskType
  ): Promise<(task: CourseGenerationTask) => Promise<any>> {
    // This would dynamically import the appropriate handler
    // For now, return a placeholder
    return async (task: CourseGenerationTask) => {
      // Simulate task execution
      await new Promise(resolve => setTimeout(resolve, 1000));
      
      // Track API call
      this.performanceMetrics.apiCalls++;
      
      return {
        success: true,
        data: `Result for ${task.task_type}`
      };
    };
  }

  /**
   * Setup real-time channel for broadcasting updates
   */
  private setupRealtimeChannel(jobId: string): void {
    this.realtimeChannel = this.supabase
      .channel(`course-generation-${jobId}`)
      .subscribe();
  }

  /**
   * Update job progress
   */
  private async updateJobProgress(
    jobId: string,
    progressPercentage: number,
    additionalData?: any
  ): Promise<void> {
    await this.supabase
      .from('course_generation_jobs')
      .update({
        progress_percentage: progressPercentage,
        updated_at: new Date().toISOString(),
        ...additionalData
      })
      .eq('id', jobId);

    // Broadcast progress update
    if (this.realtimeChannel) {
      this.realtimeChannel.send({
        type: 'broadcast',
        event: 'job_progress',
        payload: { jobId, progress: progressPercentage }
      });
    }
  }

  /**
   * Finalize job and record analytics
   */
  private async finalizeJob(jobId: string): Promise<void> {
    const { data: tasks } = await this.supabase
      .from('course_generation_tasks')
      .select('*')
      .eq('job_id', jobId);

    const completedTasks = tasks?.filter(t => t.status === 'completed') || [];
    const failedTasks = tasks?.filter(t => t.status === 'failed') || [];
    
    const totalExecutionTime = tasks?.reduce(
      (sum, t) => sum + (t.actual_duration_seconds || 0), 0
    ) || 0;

    // Calculate analytics
    const analytics: CourseGenerationAnalyticsInsert = {
      job_id: jobId,
      total_generation_time_seconds: totalExecutionTime,
      api_calls_made: this.performanceMetrics.apiCalls,
      tokens_consumed: this.performanceMetrics.tokensConsumed,
      average_task_time_seconds: 
        this.performanceMetrics.executionTimes.length > 0
          ? this.performanceMetrics.executionTimes.reduce((a, b) => a + b, 0) / 
            this.performanceMetrics.executionTimes.length / 1000
          : 0,
      success_rate: tasks?.length 
        ? (completedTasks.length / tasks.length) * 100
        : 0,
      cache_hit_rate: this.performanceMetrics.cacheHits > 0
        ? (this.performanceMetrics.cacheHits / 
          (this.performanceMetrics.cacheHits + this.performanceMetrics.cacheMisses)) * 100
        : 0
    };

    // Insert analytics
    await this.supabase
      .from('course_generation_analytics')
      .insert(analytics);

    // Update job status
    const finalStatus = failedTasks.length === 0 ? 'completed' : 'completed_with_errors';
    
    await this.supabase
      .from('course_generation_jobs')
      .update({
        status: finalStatus,
        completed_at: new Date().toISOString(),
        actual_completion_time: new Date().toISOString(),
        progress_percentage: 100,
        completed_tasks: completedTasks.length,
        failed_tasks: failedTasks.length,
        performance_metrics: this.performanceMetrics
      })
      .eq('id', jobId);

    // Clean up
    if (this.realtimeChannel) {
      await this.supabase.removeChannel(this.realtimeChannel);
    }
  }

  /**
   * Get circuit breaker metrics for monitoring
   */
  getCircuitBreakerMetrics(): Record<string, any> {
    const metrics: Record<string, any> = {};
    
    this.circuitBreakers.forEach((breaker, type) => {
      metrics[type] = breaker.getMetrics();
    });

    return metrics;
  }
} 