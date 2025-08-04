import { useState, useEffect, useCallback, useRef } from 'react';
import { JobHealthStatus, RecoveryResult } from '@/lib/services/course-generation-resilience-monitor';

interface UseGenerationHealthOptions {
  jobId: string;
  enabled?: boolean;
  pollInterval?: number; // in milliseconds, default 30 seconds
  onHealthChange?: (health: JobHealthStatus) => void;
  onRecoveryComplete?: (result: RecoveryResult) => void;
}

interface GenerationHealthState {
  health: JobHealthStatus | null;
  isLoading: boolean;
  error: string | null;
  isRecovering: boolean;
  lastRecoveryResult: RecoveryResult | null;
}

export function useCourseGenerationHealth({
  jobId,
  enabled = true,
  pollInterval = 30000, // 30 seconds
  onHealthChange,
  onRecoveryComplete
}: UseGenerationHealthOptions) {
  const [state, setState] = useState<GenerationHealthState>({
    health: null,
    isLoading: false,
    error: null,
    isRecovering: false,
    lastRecoveryResult: null
  });

  const pollIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const lastHealthStatusRef = useRef<string | null>(null);

  const checkHealth = useCallback(async () => {
    if (!enabled || !jobId) return;

    setState(prev => ({ ...prev, isLoading: true, error: null }));

    try {
      const response = await fetch(`/api/knowledge-base/jobs/${jobId}/health`);
      
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to check job health');
      }

      const data = await response.json();
      const newHealth = data.health as JobHealthStatus;

      setState(prev => ({ 
        ...prev, 
        health: newHealth, 
        isLoading: false,
        error: null 
      }));

      // Notify if health status changed
      if (lastHealthStatusRef.current !== newHealth.status) {
        lastHealthStatusRef.current = newHealth.status;
        onHealthChange?.(newHealth);
      }

    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      setState(prev => ({ 
        ...prev, 
        isLoading: false, 
        error: errorMessage 
      }));
      console.error('Failed to check job health:', error);
    }
  }, [jobId, enabled, onHealthChange]);

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

      // Check health again after recovery attempt
      if (recoveryResult.success) {
        setTimeout(checkHealth, 2000); // Check again in 2 seconds
      }

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
  }, [jobId, onRecoveryComplete, checkHealth]);

  const startPolling = useCallback(() => {
    if (pollIntervalRef.current) {
      clearInterval(pollIntervalRef.current);
    }

    // Initial check
    checkHealth();

    // Set up polling
    pollIntervalRef.current = setInterval(checkHealth, pollInterval);
  }, [checkHealth, pollInterval]);

  const stopPolling = useCallback(() => {
    if (pollIntervalRef.current) {
      clearInterval(pollIntervalRef.current);
      pollIntervalRef.current = null;
    }
  }, []);

  // Start/stop polling based on enabled state and job completion
  useEffect(() => {
    if (enabled && jobId) {
      // Don't poll if job is completed or failed permanently
      const shouldPoll = !state.health || 
        (state.health.status !== 'healthy' && state.health.recommendedAction !== 'delete_and_retry');
      
      if (shouldPoll) {
        startPolling();
      } else {
        stopPolling();
      }
    } else {
      stopPolling();
    }

    return () => stopPolling();
  }, [enabled, jobId, startPolling, stopPolling, state.health]);

  // Cleanup on unmount
  useEffect(() => {
    return () => stopPolling();
  }, [stopPolling]);

  return {
    // State
    health: state.health,
    isLoading: state.isLoading,
    error: state.error,
    isRecovering: state.isRecovering,
    lastRecoveryResult: state.lastRecoveryResult,
    
    // Actions
    checkHealth,
    attemptRecovery,
    startPolling,
    stopPolling,
    
    // Computed properties
    needsAttention: state.health && ['stalled', 'stuck', 'failed', 'abandoned'].includes(state.health.status),
    canRecover: state.health?.canAutoRecover || false,
    isHealthy: state.health?.status === 'healthy',
    progressPercentage: state.health?.progressPercentage || 0,
    userMessage: state.health?.userMessage || 'Checking status...',
    recommendedAction: state.health?.recommendedAction || 'wait'
  };
}