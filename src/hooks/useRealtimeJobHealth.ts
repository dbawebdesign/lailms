import { useState, useEffect, useCallback } from 'react';
import { createClient } from '@/lib/supabase/client';
import { JobHealthStatus, RecoveryResult } from '@/lib/services/course-generation-resilience-monitor';

interface UseRealtimeJobHealthOptions {
  jobId: string;
  enabled?: boolean;
  onHealthChange?: (health: JobHealthStatus) => void;
  onRecoveryComplete?: (result: RecoveryResult) => void;
}

interface RealtimeJobHealthState {
  health: JobHealthStatus | null;
  isLoading: boolean;
  error: string | null;
  isRecovering: boolean;
  lastRecoveryResult: RecoveryResult | null;
}

export function useRealtimeJobHealth({
  jobId,
  enabled = true,
  onHealthChange,
  onRecoveryComplete
}: UseRealtimeJobHealthOptions) {
  const [state, setState] = useState<RealtimeJobHealthState>({
    health: null,
    isLoading: false,
    error: null,
    isRecovering: false,
    lastRecoveryResult: null
  });

  const supabase = createClient();

  // Recovery function
  const attemptRecovery = useCallback(async (): Promise<RecoveryResult> => {
    if (!jobId) {
      throw new Error('No job ID provided');
    }

    setState(prev => ({ ...prev, isRecovering: true, error: null }));

    try {
      const response = await fetch(`/api/knowledge-base/jobs/${jobId}/health`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ action: 'recover' })
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to attempt recovery');
      }

      const data = await response.json();
      const recoveryResult = data.recovery as RecoveryResult;

      setState(prev => ({ 
        ...prev, 
        isRecovering: false,
        lastRecoveryResult: recoveryResult,
        error: recoveryResult.success ? null : recoveryResult.error || 'Recovery failed'
      }));

      onRecoveryComplete?.(recoveryResult);

      return recoveryResult;

    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      setState(prev => ({ 
        ...prev, 
        isRecovering: false, 
        error: errorMessage,
        lastRecoveryResult: {
          success: false,
          action: 'error',
          message: errorMessage,
          error: errorMessage
        }
      }));
      throw error;
    }
  }, [jobId, onRecoveryComplete]);

  // Set up realtime subscription for job updates - no initial API call
  useEffect(() => {
    if (!enabled || !jobId) return;

    // Create a basic healthy status for jobs that are processing
    const basicHealth: JobHealthStatus = {
      jobId,
      status: 'healthy',
      lastActivity: new Date(),
      timeSinceActivity: 0,
      totalTasks: 0,
      completedTasks: 0,
      failedTasks: 0,
      runningTasks: 0,
      pendingTasks: 0,
      progressPercentage: 0,
      userMessage: 'Generation in progress...',
      canAutoRecover: false,
      recommendedAction: 'wait',
      recoveryAttempts: 0,
      maxRecoveryAttempts: 3
    };

    setState(prev => ({ 
      ...prev, 
      health: basicHealth,
      isLoading: false,
      error: null 
    }));

    // Subscribe to job updates
    const channel = supabase
      .channel(`job-health-${jobId}`)
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'course_generation_jobs',
          filter: `id=eq.${jobId}`
        },
        (payload) => {
          const updatedJob = payload.new as any;
          
          // Update health based on job status
          let healthStatus: JobHealthStatus['status'] = 'healthy';
          let userMessage = 'Generation in progress...';
          let canAutoRecover = false;
          let recommendedAction: JobHealthStatus['recommendedAction'] = 'wait';

          if (updatedJob.status === 'completed') {
            healthStatus = 'healthy';
            userMessage = 'Generation completed successfully!';
            recommendedAction = 'wait';
          } else if (updatedJob.status === 'failed') {
            healthStatus = 'failed';
            userMessage = 'Generation failed. You can try restarting.';
            canAutoRecover = true;
            recommendedAction = 'restart';
          } else if (updatedJob.status === 'processing') {
            healthStatus = 'healthy';
            userMessage = 'Generation in progress...';
            recommendedAction = 'wait';
          }

          const updatedHealth: JobHealthStatus = {
            jobId,
            status: healthStatus,
            lastActivity: new Date(updatedJob.updated_at || Date.now()),
            timeSinceActivity: 0,
            totalTasks: updatedJob.tasks_total || 0,
            completedTasks: updatedJob.tasks_completed || 0,
            failedTasks: 0,
            runningTasks: 0,
            pendingTasks: (updatedJob.tasks_total || 0) - (updatedJob.tasks_completed || 0),
            progressPercentage: Math.round((updatedJob.progress || 0) * 100),
            userMessage,
            canAutoRecover,
            recommendedAction,
            recoveryAttempts: 0,
            maxRecoveryAttempts: 3
          };

          setState(prev => ({ 
            ...prev, 
            health: updatedHealth,
            error: null 
          }));

          onHealthChange?.(updatedHealth);
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [jobId, enabled, onHealthChange, supabase]);

  return {
    // State
    health: state.health,
    isLoading: state.isLoading,
    error: state.error,
    isRecovering: state.isRecovering,
    lastRecoveryResult: state.lastRecoveryResult,
    
    // Actions
    checkHealth: () => {}, // No-op since we use realtime
    attemptRecovery,
    
    // Computed properties
    needsAttention: state.health && ['stalled', 'stuck', 'failed', 'abandoned'].includes(state.health.status),
    canRecover: state.health?.canAutoRecover || false,
    isHealthy: state.health?.status === 'healthy',
    progressPercentage: state.health?.progressPercentage || 0,
    userMessage: state.health?.userMessage || 'Checking status...',
    recommendedAction: state.health?.recommendedAction || 'wait'
  };
}