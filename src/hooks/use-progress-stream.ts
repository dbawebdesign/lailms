import { useState, useEffect, useRef, useCallback } from 'react';

export interface ProgressUpdate {
  jobId: string;
  timestamp: string;
  overallProgress: number;
  currentPhase: string;
  phaseDescription: string;
  detailedMessage: string;
  estimatedTimeRemaining: string;
  liveMessage?: {
    message: string;
    level: 'info' | 'warn' | 'error';
    timestamp: string;
  };
}

export interface UseProgressStreamReturn {
  progress: ProgressUpdate | null;
  isConnected: boolean;
  error: string | null;
  connectionType: 'polling';
  reconnect: () => void;
}

export function useProgressStream(jobId: string): UseProgressStreamReturn {
  const [progress, setProgress] = useState<ProgressUpdate | null>(null);
  const [isConnected, setIsConnected] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const intervalRef = useRef<NodeJS.Timeout | null>(null);
  const mountedRef = useRef(true);

  const fetchProgress = useCallback(async () => {
    if (!jobId || jobId === '' || !mountedRef.current) return;

    try {
      console.log(`🔄 Polling progress for job ${jobId}`);
      const response = await fetch(`/api/knowledge-base/generation-status/${jobId}`);
      
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      const data = await response.json();
      
      if (!mountedRef.current) return;

      // Extract progress information from the API response
      const resultData = data.result_data || {};
      const jobData = data.job || {};
      const tasks = jobData.tasks || [];
      
      // Calculate task-based progress information
      const completedCount = tasks.filter((t: any) => t.status === 'completed').length;
      const failedCount = tasks.filter((t: any) => t.status === 'failed').length;  
      const runningCount = tasks.filter((t: any) => t.status === 'running').length;
      const totalCount = tasks.length;
      const finishedCount = completedCount + failedCount;
      const progressPercentage = totalCount > 0 ? Math.round((finishedCount / totalCount) * 100) : 0;
      
      // Generate intelligent detailed message based on task progress
      let detailedMessage = resultData.detailed_message;
      if (!detailedMessage || detailedMessage === 'Initializing...') {
        if (totalCount > 0) {
          if (runningCount > 0) {
            const runningTask = tasks.find((t: any) => t.status === 'running');
            if (runningTask) {
              detailedMessage = `Generating ${runningTask.type?.replace(/_/g, ' ')} (${finishedCount}/${totalCount} completed)`;
            } else {
              detailedMessage = `Processing tasks (${finishedCount}/${totalCount} completed)`;
            }
          } else if (finishedCount === 0) {
            detailedMessage = `Starting course generation (${totalCount} tasks queued)`;
          } else {
            detailedMessage = `Processing course content (${finishedCount}/${totalCount} completed)`;
          }
        } else {
          detailedMessage = 'Setting up course generation...';
        }
      }
      
      const progressUpdate: ProgressUpdate = {
        jobId,
        timestamp: new Date().toISOString(),
        overallProgress: data.progress_percentage || progressPercentage,
        currentPhase: resultData.current_phase || 'processing',
        phaseDescription: resultData.phase_description || 'Generating course content',
        detailedMessage,
        estimatedTimeRemaining: resultData.estimated_time_remaining || 'Calculating...',
        liveMessage: resultData.live_message
      };

      setProgress(progressUpdate);
      setIsConnected(true);
      setError(null);

      console.log(`📊 Progress updated: ${progressUpdate.overallProgress}% - ${progressUpdate.liveMessage?.message || progressUpdate.detailedMessage}`);
      console.log(`🔍 Debug - Live message:`, progressUpdate.liveMessage);
      console.log(`🔍 Debug - Result data:`, resultData);

      // Stop polling if job is completed or failed
      if (data.status === 'completed' || data.status === 'failed') {
        console.log(`🏁 Job ${jobId} finished with status: ${data.status}`);
        if (intervalRef.current) {
          clearInterval(intervalRef.current);
          intervalRef.current = null;
        }
      }

    } catch (err) {
      console.error(`❌ Error fetching progress for job ${jobId}:`, err);
      if (mountedRef.current) {
        setError(err instanceof Error ? err.message : 'Unknown error');
        setIsConnected(false);
      }
    }
  }, [jobId]);

  const startPolling = useCallback(() => {
    if (intervalRef.current) {
      clearInterval(intervalRef.current);
    }

    console.log(`🔄 Starting polling for job ${jobId}`);
    setIsConnected(true);
    setError(null);

    // Initial fetch
    fetchProgress();

    // Set up polling interval (every 5 seconds for reasonable updates)
    intervalRef.current = setInterval(fetchProgress, 5000);
  }, [fetchProgress, jobId]);

  const reconnect = useCallback(() => {
    console.log(`🔄 Reconnecting polling for job ${jobId}`);
    startPolling();
  }, [startPolling, jobId]);

  useEffect(() => {
    if (!jobId || jobId === '') return;

    mountedRef.current = true;
    startPolling();

    return () => {
      mountedRef.current = false;
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
        intervalRef.current = null;
      }
    };
  }, [jobId, startPolling]);

  return {
    progress,
    isConnected,
    error,
    connectionType: 'polling',
    reconnect
  };
} 