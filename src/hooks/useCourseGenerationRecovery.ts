import { useState, useCallback } from 'react';
import { 
  CreateUserActionRequest,
  CreateUserActionResponse,
  UserActionType,
  CourseGenerationTask,
  CourseGenerationJob
} from '@/types/course-generation';

interface RecoveryState {
  isLoading: boolean;
  error: string | null;
  lastAction: UserActionType | null;
  actionHistory: CreateUserActionResponse[];
}

interface RecoveryOptions {
  onSuccess?: (response: CreateUserActionResponse) => void;
  onError?: (error: string) => void;
  showNotifications?: boolean;
}

export function useCourseGenerationRecovery(
  jobId: string,
  options: RecoveryOptions = {}
) {
  const [state, setState] = useState<RecoveryState>({
    isLoading: false,
    error: null,
    lastAction: null,
    actionHistory: []
  });

  const executeAction = useCallback(async (
    actionType: UserActionType,
    taskIds?: string[],
    actionContext?: any
  ): Promise<CreateUserActionResponse | null> => {
    setState(prev => ({ ...prev, isLoading: true, error: null }));

    try {
      const request: CreateUserActionRequest = {
        jobId,
        actionType,
        taskIds,
        actionContext
      };

      const response = await fetch('/api/course-generation/v2/user-action', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(request)
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Action failed');
      }

      const result: CreateUserActionResponse = await response.json();

      setState(prev => ({
        ...prev,
        isLoading: false,
        lastAction: actionType,
        actionHistory: [result, ...prev.actionHistory.slice(0, 9)] // Keep last 10 actions
      }));

      if (options.onSuccess) {
        options.onSuccess(result);
      }

      if (options.showNotifications) {
        showActionNotification(actionType, true);
      }

      return result;

    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      
      setState(prev => ({
        ...prev,
        isLoading: false,
        error: errorMessage
      }));

      if (options.onError) {
        options.onError(errorMessage);
      }

      if (options.showNotifications) {
        showActionNotification(actionType, false, errorMessage);
      }

      return null;
    }
  }, [jobId, options]);

  // Specific action methods
  const retryTask = useCallback(async (taskId: string): Promise<boolean> => {
    const result = await executeAction('retry_task', [taskId]);
    return result?.success || false;
  }, [executeAction]);

  const retryTasks = useCallback(async (taskIds: string[]): Promise<boolean> => {
    const result = await executeAction('retry_task', taskIds);
    return result?.success || false;
  }, [executeAction]);

  const skipTask = useCallback(async (taskId: string): Promise<boolean> => {
    const result = await executeAction('skip_task', [taskId]);
    return result?.success || false;
  }, [executeAction]);

  const skipTasks = useCallback(async (taskIds: string[]): Promise<boolean> => {
    const result = await executeAction('skip_task', taskIds);
    return result?.success || false;
  }, [executeAction]);

  const pauseJob = useCallback(async (): Promise<boolean> => {
    const result = await executeAction('pause_job');
    return result?.success || false;
  }, [executeAction]);

  const resumeJob = useCallback(async (): Promise<boolean> => {
    const result = await executeAction('resume_job');
    return result?.success || false;
  }, [executeAction]);

  const cancelJob = useCallback(async (): Promise<boolean> => {
    const result = await executeAction('cancel_job');
    return result?.success || false;
  }, [executeAction]);

  const exportReport = useCallback(async (format: 'json' | 'csv' | 'pdf' = 'json'): Promise<boolean> => {
    const result = await executeAction('export_report', undefined, { format });
    return result?.success || false;
  }, [executeAction]);

  // Batch operations
  const retryAllFailed = useCallback(async (tasks: CourseGenerationTask[]): Promise<boolean> => {
    const failedTaskIds = tasks
      .filter(task => task.status === 'failed' && task.is_recoverable)
      .map(task => task.id);
    
    if (failedTaskIds.length === 0) {
      return true; // No failed tasks to retry
    }

    return await retryTasks(failedTaskIds);
  }, [retryTasks]);

  const skipAllFailed = useCallback(async (tasks: CourseGenerationTask[]): Promise<boolean> => {
    const failedTaskIds = tasks
      .filter(task => task.status === 'failed')
      .map(task => task.id);
    
    if (failedTaskIds.length === 0) {
      return true; // No failed tasks to skip
    }

    return await skipTasks(failedTaskIds);
  }, [skipTasks]);

  // Smart recovery based on error patterns
  const smartRecover = useCallback(async (tasks: CourseGenerationTask[]): Promise<{
    retriedTasks: string[];
    skippedTasks: string[];
    success: boolean;
  }> => {
    const failedTasks = tasks.filter(task => task.status === 'failed');
    const retriedTasks: string[] = [];
    const skippedTasks: string[] = [];

    for (const task of failedTasks) {
      if (task.is_recoverable && (task.current_retry_count || 0) < (task.max_retry_count || 3)) {
        // Retry recoverable tasks that haven't exceeded retry limit
        const success = await retryTask(task.id);
        if (success) {
          retriedTasks.push(task.id);
        }
      } else if (task.error_severity !== 'critical') {
        // Skip non-critical failed tasks
        const success = await skipTask(task.id);
        if (success) {
          skippedTasks.push(task.id);
        }
      }
    }

    return {
      retriedTasks,
      skippedTasks,
      success: retriedTasks.length > 0 || skippedTasks.length > 0
    };
  }, [retryTask, skipTask]);

  // Clear error state
  const clearError = useCallback(() => {
    setState(prev => ({ ...prev, error: null }));
  }, []);

  // Get recovery suggestions based on current state
  const getRecoverySuggestions = useCallback((
    job: CourseGenerationJob,
    tasks: CourseGenerationTask[]
  ): Array<{
    action: UserActionType;
    label: string;
    description: string;
    taskIds?: string[];
    priority: 'high' | 'medium' | 'low';
    estimatedImpact: string;
  }> => {
    const suggestions = [];
    const failedTasks = tasks.filter(t => t.status === 'failed');
    const recoverableTasks = failedTasks.filter(t => t.is_recoverable);
    const nonCriticalFailed = failedTasks.filter(t => t.error_severity !== 'critical');

    if (job.status === 'processing' && failedTasks.length > 0) {
      suggestions.push({
        action: 'pause_job' as UserActionType,
        label: 'Pause Generation',
        description: 'Pause to review and fix issues before continuing',
        priority: 'high' as const,
        estimatedImpact: 'Prevents further failures'
      });
    }

    if (recoverableTasks.length > 0) {
      suggestions.push({
        action: 'retry_task' as UserActionType,
        label: `Retry ${recoverableTasks.length} Failed Tasks`,
        description: 'Automatically retry tasks that can be recovered',
        taskIds: recoverableTasks.map(t => t.id),
        priority: 'high' as const,
        estimatedImpact: `Could recover ${recoverableTasks.length} tasks`
      });
    }

    if (nonCriticalFailed.length > 0) {
      suggestions.push({
        action: 'skip_task' as UserActionType,
        label: `Skip ${nonCriticalFailed.length} Non-Critical Tasks`,
        description: 'Skip failed tasks that are not essential for course completion',
        taskIds: nonCriticalFailed.map(t => t.id),
        priority: 'medium' as const,
        estimatedImpact: `Continue with ${tasks.length - nonCriticalFailed.length} tasks`
      });
    }

    if (job.status === 'paused') {
      suggestions.push({
        action: 'resume_job' as UserActionType,
        label: 'Resume Generation',
        description: 'Continue with the course generation process',
        priority: 'high' as const,
        estimatedImpact: 'Resume progress'
      });
    }

    if (failedTasks.length > tasks.length * 0.5) {
      suggestions.push({
        action: 'cancel_job' as UserActionType,
        label: 'Cancel and Restart',
        description: 'Too many failures - consider starting over with different settings',
        priority: 'low' as const,
        estimatedImpact: 'Start fresh'
      });
    }

    return suggestions.sort((a, b) => {
      const priorityOrder = { high: 3, medium: 2, low: 1 };
      return priorityOrder[b.priority] - priorityOrder[a.priority];
    });
  }, []);

  return {
    // State
    isLoading: state.isLoading,
    error: state.error,
    lastAction: state.lastAction,
    actionHistory: state.actionHistory,

    // Individual actions
    retryTask,
    retryTasks,
    skipTask,
    skipTasks,
    pauseJob,
    resumeJob,
    cancelJob,
    exportReport,

    // Batch operations
    retryAllFailed,
    skipAllFailed,
    smartRecover,

    // Utilities
    clearError,
    getRecoverySuggestions,

    // Raw action executor for custom actions
    executeAction
  };
}

// Helper function for notifications
function showActionNotification(
  actionType: UserActionType,
  success: boolean,
  error?: string
) {
  const actionLabels: Record<UserActionType, string> = {
    retry_task: 'Retry Task',
    skip_task: 'Skip Task',
    pause_job: 'Pause Job',
    resume_job: 'Resume Job',
    cancel_job: 'Cancel Job',
    export_report: 'Export Report',
    view_details: 'View Details'
  };

  const label = actionLabels[actionType] || actionType;

  if (success) {
    // Would integrate with your notification system
    console.log(`✅ ${label} completed successfully`);
  } else {
    console.error(`❌ ${label} failed: ${error}`);
  }
} 