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
      
      const progressUpdate: ProgressUpdate = {
        jobId,
        timestamp: new Date().toISOString(),
        overallProgress: data.progress_percentage || 0,
        currentPhase: resultData.current_phase || 'unknown',
        phaseDescription: resultData.phase_description || 'Processing...',
        detailedMessage: resultData.detailed_message || 'Initializing...',
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

    // Set up polling interval (every 1 second for responsive updates)
    intervalRef.current = setInterval(fetchProgress, 1000);
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