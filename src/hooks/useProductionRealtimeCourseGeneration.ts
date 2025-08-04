/**
 * Production-Ready Supabase Realtime Hook for Course Generation
 * 
 * This hook implements all best practices from research:
 * - Proper connection management and cleanup
 * - Error handling and recovery
 * - Rate limiting compliance
 * - Memory leak prevention
 * - Background tab resilience
 */

import { useState, useEffect, useCallback, useRef } from 'react';
import { createClient } from '@/lib/supabase/client';
import { getRealtimeConnectionManager, ConnectionState } from '@/lib/realtime/RealtimeConnectionManager';
import type { RealtimePostgresChangesPayload } from '@supabase/supabase-js';

// Types for course generation data
export interface CourseGenerationJob {
  id: string;
  user_id: string;
  status: 'pending' | 'processing' | 'completed' | 'failed' | 'cancelled';
  progress_percentage: number;
  current_task?: string;
  error_message?: string;
  is_cleared: boolean;
  created_at: string;
  updated_at: string;
  job_data?: any;
}

export interface CourseGenerationTask {
  id: string;
  job_id: string;
  task_name: string;
  status: 'pending' | 'running' | 'completed' | 'failed';
  task_order: number;
  created_at: string;
  updated_at: string;
}

interface UseProductionRealtimeCourseGenerationState {
  job: CourseGenerationJob | null;
  tasks: CourseGenerationTask[];
  progress: number;
  currentTask: string | null;
  isLoading: boolean;
  error: string | null;
  connectionState: ConnectionState;
  retryCount: number;
}

interface UseProductionRealtimeCourseGenerationOptions {
  jobId: string;
  enabled?: boolean;
  fetchInitialData?: boolean;
  onJobUpdate?: (job: CourseGenerationJob) => void;
  onTaskUpdate?: (task: CourseGenerationTask) => void;
  onError?: (error: string) => void;
}

export function useProductionRealtimeCourseGeneration({
  jobId,
  enabled = true,
  fetchInitialData = true,
  onJobUpdate,
  onTaskUpdate,
  onError
}: UseProductionRealtimeCourseGenerationOptions) {
  
  const [state, setState] = useState<UseProductionRealtimeCourseGenerationState>({
    job: null,
    tasks: [],
    progress: 0,
    currentTask: null,
    isLoading: fetchInitialData,
    error: null,
    connectionState: ConnectionState.DISCONNECTED,
    retryCount: 0
  });

  // Stable references
  const supabase = useRef(createClient()).current;
  const connectionManager = useRef(getRealtimeConnectionManager(supabase)).current;
  const jobSubscriptionId = `course-job-${jobId}`;
  const tasksSubscriptionId = `course-tasks-${jobId}`;
  
  // Track if component is mounted to prevent state updates after unmount
  const isMountedRef = useRef(true);

  /**
   * Fetch initial data with comprehensive error handling
   */
  const fetchInitialData = useCallback(async () => {
    if (!jobId || !fetchInitialData) return;

    try {
      // Check authentication first
      const { data: { user }, error: authError } = await supabase.auth.getUser();
      if (authError || !user) {
        throw new Error('User not authenticated');
      }

      setState(prev => ({ ...prev, isLoading: true, error: null }));

      // Fetch job and tasks in parallel
      const [jobResult, tasksResult] = await Promise.all([
        supabase
          .from('course_generation_jobs')
          .select('*')
          .eq('id', jobId)
          .single(),
        supabase
          .from('course_generation_tasks')
          .select('*')
          .eq('job_id', jobId)
          .order('task_order', { ascending: true })
      ]);

      if (jobResult.error) {
        throw new Error(`Failed to fetch job: ${jobResult.error.message}`);
      }

      if (tasksResult.error) {
        throw new Error(`Failed to fetch tasks: ${tasksResult.error.message}`);
      }

      // Verify user has access to this job
      if (jobResult.data?.user_id !== user.id) {
        throw new Error('Access denied: You do not have permission to view this job');
      }

      if (!isMountedRef.current) return;

      const job = jobResult.data as CourseGenerationJob;
      const tasks = tasksResult.data as CourseGenerationTask[];
      
      const completedTasks = tasks.filter(task => task.status === 'completed').length;
      const progress = tasks.length > 0 ? Math.round((completedTasks / tasks.length) * 100) : 0;

      setState(prev => ({
        ...prev,
        job,
        tasks,
        progress,
        currentTask: job.current_task || null,
        isLoading: false,
        error: null
      }));

    } catch (error: any) {
      console.error('useProductionRealtimeCourseGeneration: Initial fetch error:', error);
      
      if (!isMountedRef.current) return;
      
      setState(prev => ({
        ...prev,
        isLoading: false,
        error: error.message || 'Failed to fetch initial data'
      }));

      onError?.(error.message || 'Failed to fetch initial data');
    }
  }, [jobId, fetchInitialData, supabase, onError]);

  /**
   * Handle job updates from realtime
   */
  const handleJobUpdate = useCallback((payload: RealtimePostgresChangesPayload<CourseGenerationJob>) => {
    if (!isMountedRef.current) return;

    console.log('🔄 Job update received:', payload);
    
    const updatedJob = payload.new as CourseGenerationJob;
    if (!updatedJob) return;

    setState(prev => ({
      ...prev,
      job: updatedJob,
      currentTask: updatedJob.current_task || prev.currentTask,
      error: null // Clear error on successful update
    }));

    onJobUpdate?.(updatedJob);
  }, [onJobUpdate]);

  /**
   * Handle task updates from realtime
   */
  const handleTaskUpdate = useCallback((payload: RealtimePostgresChangesPayload<CourseGenerationTask>) => {
    if (!isMountedRef.current) return;

    console.log('📋 Task update received:', payload);

    setState(prev => {
      let updatedTasks = [...prev.tasks];
      
      if (payload.eventType === 'INSERT') {
        const newTask = payload.new as CourseGenerationTask;
        // Insert in correct order
        const insertIndex = updatedTasks.findIndex(t => t.task_order > newTask.task_order);
        if (insertIndex === -1) {
          updatedTasks.push(newTask);
        } else {
          updatedTasks.splice(insertIndex, 0, newTask);
        }
        onTaskUpdate?.(newTask);
      } else if (payload.eventType === 'UPDATE') {
        const updatedTask = payload.new as CourseGenerationTask;
        updatedTasks = updatedTasks.map(task => 
          task.id === updatedTask.id ? updatedTask : task
        );
        onTaskUpdate?.(updatedTask);
      } else if (payload.eventType === 'DELETE') {
        const deletedTask = payload.old as CourseGenerationTask;
        updatedTasks = updatedTasks.filter(task => task.id !== deletedTask.id);
      }
      
      // Recalculate progress
      const completedTasks = updatedTasks.filter(task => task.status === 'completed').length;
      const progress = updatedTasks.length > 0 ? Math.round((completedTasks / updatedTasks.length) * 100) : 0;
      
      return {
        ...prev,
        tasks: updatedTasks,
        progress,
        error: null // Clear error on successful update
      };
    });
  }, [onTaskUpdate]);

  /**
   * Handle connection state changes
   */
  const handleConnectionStateChange = useCallback(() => {
    const jobState = connectionManager.getSubscriptionStatus(jobSubscriptionId);
    const tasksState = connectionManager.getSubscriptionStatus(tasksSubscriptionId);
    
    // Use the "worst" state between the two subscriptions
    let overallState = ConnectionState.DISCONNECTED;
    if (jobState === ConnectionState.ERROR || tasksState === ConnectionState.ERROR) {
      overallState = ConnectionState.ERROR;
    } else if (jobState === ConnectionState.CONNECTED && tasksState === ConnectionState.CONNECTED) {
      overallState = ConnectionState.CONNECTED;
    } else if (jobState === ConnectionState.CONNECTING || tasksState === ConnectionState.CONNECTING) {
      overallState = ConnectionState.CONNECTING;
    } else if (jobState === ConnectionState.RECONNECTING || tasksState === ConnectionState.RECONNECTING) {
      overallState = ConnectionState.RECONNECTING;
    }

    if (!isMountedRef.current) return;

    setState(prev => ({ ...prev, connectionState: overallState }));
  }, [connectionManager, jobSubscriptionId, tasksSubscriptionId]);

  /**
   * Setup realtime subscriptions
   */
  const setupSubscriptions = useCallback(async () => {
    if (!enabled || !jobId) return;

    try {
      // Subscribe to job updates
      await connectionManager.subscribe(
        jobSubscriptionId,
        {
          table: 'course_generation_jobs',
          event: '*',
          filter: `id=eq.${jobId}`,
          enableBackgroundResilience: true
        },
        handleJobUpdate
      );

      // Subscribe to task updates
      await connectionManager.subscribe(
        tasksSubscriptionId,
        {
          table: 'course_generation_tasks',
          event: '*',
          filter: `job_id=eq.${jobId}`,
          enableBackgroundResilience: true
        },
        handleTaskUpdate
      );

      console.log(`✅ Realtime subscriptions setup for job ${jobId}`);
      
      // Update connection state
      handleConnectionStateChange();

    } catch (error: any) {
      console.error('Failed to setup subscriptions:', error);
      
      if (!isMountedRef.current) return;
      
      setState(prev => ({
        ...prev,
        error: error.message || 'Failed to setup realtime subscriptions',
        connectionState: ConnectionState.ERROR,
        retryCount: prev.retryCount + 1
      }));

      onError?.(error.message || 'Failed to setup realtime subscriptions');
    }
  }, [enabled, jobId, connectionManager, jobSubscriptionId, tasksSubscriptionId, handleJobUpdate, handleTaskUpdate, handleConnectionStateChange, onError]);

  /**
   * Cleanup subscriptions
   */
  const cleanupSubscriptions = useCallback(async () => {
    try {
      await Promise.all([
        connectionManager.unsubscribe(jobSubscriptionId),
        connectionManager.unsubscribe(tasksSubscriptionId)
      ]);
      console.log(`🧹 Cleaned up subscriptions for job ${jobId}`);
    } catch (error) {
      console.error('Error cleaning up subscriptions:', error);
    }
  }, [connectionManager, jobSubscriptionId, tasksSubscriptionId, jobId]);

  /**
   * Retry connection
   */
  const retryConnection = useCallback(async () => {
    setState(prev => ({ ...prev, error: null, retryCount: prev.retryCount + 1 }));
    await cleanupSubscriptions();
    await setupSubscriptions();
  }, [cleanupSubscriptions, setupSubscriptions]);

  /**
   * Main effect - setup subscriptions and fetch initial data
   */
  useEffect(() => {
    if (!jobId || !enabled) return;

    const initializeConnection = async () => {
      // Fetch initial data first
      await fetchInitialData();
      
      // Then setup realtime subscriptions
      await setupSubscriptions();
    };

    initializeConnection();

    // Cleanup on unmount or jobId change
    return () => {
      cleanupSubscriptions();
    };
  }, [jobId, enabled, fetchInitialData, setupSubscriptions, cleanupSubscriptions]);

  /**
   * Cleanup on unmount
   */
  useEffect(() => {
    return () => {
      isMountedRef.current = false;
    };
  }, []);

  /**
   * Periodically check connection health
   */
  useEffect(() => {
    if (!enabled) return;

    const healthCheckInterval = setInterval(() => {
      handleConnectionStateChange();
    }, 10000); // Check every 10 seconds

    return () => clearInterval(healthCheckInterval);
  }, [enabled, handleConnectionStateChange]);

  return {
    // Data
    job: state.job,
    tasks: state.tasks,
    progress: state.progress,
    currentTask: state.currentTask,
    
    // State
    isLoading: state.isLoading,
    error: state.error,
    connectionState: state.connectionState,
    retryCount: state.retryCount,
    
    // Actions
    retryConnection,
    refetchData: fetchInitialData,
    
    // Utilities
    isConnected: state.connectionState === ConnectionState.CONNECTED,
    isConnecting: state.connectionState === ConnectionState.CONNECTING,
    isReconnecting: state.connectionState === ConnectionState.RECONNECTING,
    hasError: state.connectionState === ConnectionState.ERROR || !!state.error,
    
    // Connection manager for advanced usage
    connectionManager
  };
}