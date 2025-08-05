/**
 * Production-Ready Supabase Realtime Hook for User Jobs
 * 
 * This hook manages multiple user course generation jobs with:
 * - Efficient connection management
 * - Proper error handling and recovery
 * - Memory leak prevention
 * - Background tab resilience
 */

import { useState, useEffect, useCallback, useRef } from 'react';
import { createClient } from '@/lib/supabase/client';
import { getRealtimeConnectionManager, ConnectionState } from '@/lib/realtime/RealtimeConnectionManager';
import type { RealtimePostgresChangesPayload } from '@supabase/supabase-js';

// CourseGenerationJob type matching actual database schema
export interface CourseGenerationJob {
  id: string;
  base_class_id?: string;
  organisation_id: string;
  job_type: string;
  user_id: string;
  status: 'pending' | 'processing' | 'completed' | 'failed' | 'cancelled';
  progress_percentage: number;
  job_data?: any;
  result_data?: any;
  error_message?: string;
  started_at?: string;
  completed_at?: string;
  is_cleared: boolean;
  confetti_shown?: boolean;
  generation_config?: any;
  performance_metrics?: any;
  retry_configuration?: any;
  user_actions?: any;
  estimated_completion_time?: string;
  actual_completion_time?: string;
  total_tasks?: number;
  completed_tasks?: number;
  failed_tasks?: number;
  skipped_tasks?: number;
  created_at: string;
  updated_at: string;
}

interface UseProductionRealtimeUserJobsState {
  jobs: CourseGenerationJob[];
  isLoading: boolean;
  error: string | null;
  connectionState: ConnectionState;
  retryCount: number;
}

interface UseProductionRealtimeUserJobsOptions {
  userId: string;
  enabled?: boolean;
  includeCleared?: boolean;
  initialJobs?: CourseGenerationJob[];
  onJobUpdate?: (job: CourseGenerationJob, eventType: 'INSERT' | 'UPDATE' | 'DELETE') => void;
  onError?: (error: string) => void;
}

export function useProductionRealtimeUserJobs({
  userId,
  enabled = true,
  includeCleared = false,
  initialJobs = [],
  onJobUpdate,
  onError
}: UseProductionRealtimeUserJobsOptions) {
  
  const [state, setState] = useState<UseProductionRealtimeUserJobsState>({
    jobs: initialJobs,
    isLoading: false, // Never show loading initially - we either have data or will fetch quickly
    error: null,
    connectionState: ConnectionState.DISCONNECTED,
    retryCount: 0
  });

  // Stable references
  const supabase = useRef(createClient()).current;
  const connectionManager = useRef(getRealtimeConnectionManager(supabase)).current;
  const subscriptionId = `user-jobs-${userId}`;
  
  // Track if component is mounted
  const isMountedRef = useRef(true);

  /**
   * Fetch initial jobs data
   */
  const fetchInitialJobs = useCallback(async (forceRefresh = false) => {
    if (!userId) {
      setState(prev => ({ ...prev, isLoading: false }));
      return;
    }

    // If we have initial jobs and this isn't a forced refresh, skip the fetch but ensure auth is ready
    if (!forceRefresh && initialJobs.length > 0) {
      console.log('useProductionRealtimeUserJobs: Using server-provided data, verifying auth');
      
      try {
        // Quick auth check to ensure realtime will work
        const { data: { user } } = await supabase.auth.getUser();
        if (user && user.id === userId) {
          setState(prev => ({ ...prev, isLoading: false, error: null }));
          return;
        }
      } catch (error) {
        console.log('useProductionRealtimeUserJobs: Auth check failed, falling back to full fetch');
        // Fall through to full fetch if auth check fails
      }
    }

    try {
      // Add a small delay to ensure auth is ready after navigation (only if no initial data)
      if (initialJobs.length === 0) {
        await new Promise(resolve => setTimeout(resolve, 100));
      }

      // Check authentication with retry logic for initial page load
      let authAttempts = 0;
      let user = null;
      
      while (authAttempts < 3 && !user) {
        const { data: { user: authUser }, error: authError } = await supabase.auth.getUser();
        
        if (authError) {
          console.log(`useProductionRealtimeUserJobs: Auth error on attempt ${authAttempts + 1}:`, authError);
          authAttempts++;
          if (authAttempts < 3) {
            await new Promise(resolve => setTimeout(resolve, 500)); // Wait 500ms before retry
            continue;
          }
          throw new Error('Authentication failed after retries');
        }
        
        if (!authUser) {
          console.log(`useProductionRealtimeUserJobs: No user on attempt ${authAttempts + 1}`);
          authAttempts++;
          if (authAttempts < 3) {
            await new Promise(resolve => setTimeout(resolve, 500)); // Wait 500ms before retry
            continue;
          }
          throw new Error('User not authenticated');
        }
        
        user = authUser;
      }

      // Verify user ID matches
      if (!user || user.id !== userId) {
        throw new Error('Access denied: User ID mismatch');
      }

      setState(prev => ({ ...prev, isLoading: true, error: null }));

      // Build query
      let query = supabase
        .from('course_generation_jobs')
        .select('*')
        .eq('user_id', userId)
        .order('created_at', { ascending: false });

      // Filter out cleared jobs unless explicitly requested
      if (!includeCleared) {
        query = query.eq('is_cleared', false);
      }

      const { data: jobs, error } = await query;

      if (error) {
        throw new Error(`Failed to fetch jobs: ${error.message}`);
      }

      if (!isMountedRef.current) return;

      setState(prev => ({
        ...prev,
        jobs: jobs as CourseGenerationJob[] || [],
        isLoading: false,
        error: null
      }));

    } catch (error: any) {
      console.error('useProductionRealtimeUserJobs: Initial fetch error:', error);
      
      if (!isMountedRef.current) return;
      
      setState(prev => ({
        ...prev,
        isLoading: false,
        error: error.message || 'Failed to fetch jobs'
      }));

      onError?.(error.message || 'Failed to fetch jobs');
    }
  }, [userId, includeCleared, initialJobs, supabase, onError]);

  /**
   * Handle job updates from realtime
   */
  const handleJobUpdate = useCallback((payload: RealtimePostgresChangesPayload<CourseGenerationJob>) => {
    if (!isMountedRef.current) return;

    console.log('👥 User jobs update received:', payload);

    setState(prev => {
      let updatedJobs = [...prev.jobs];
      
      if (payload.eventType === 'INSERT') {
        const newJob = payload.new as CourseGenerationJob;
        
        // Only add if it matches our criteria
        if (newJob.user_id === userId && (includeCleared || !newJob.is_cleared)) {
          // Insert in chronological order (newest first)
          const insertIndex = updatedJobs.findIndex(job => 
            new Date(job.created_at) < new Date(newJob.created_at)
          );
          
          if (insertIndex === -1) {
            updatedJobs.push(newJob);
          } else {
            updatedJobs.splice(insertIndex, 0, newJob);
          }
        }
        
        onJobUpdate?.(newJob, 'INSERT');
        
      } else if (payload.eventType === 'UPDATE') {
        const updatedJob = payload.new as CourseGenerationJob;
        
        // Check if job should be removed due to filtering
        if (!includeCleared && updatedJob.is_cleared) {
          updatedJobs = updatedJobs.filter(job => job.id !== updatedJob.id);
        } else if (updatedJob.user_id === userId) {
          // Update existing job
          const jobIndex = updatedJobs.findIndex(job => job.id === updatedJob.id);
          if (jobIndex !== -1) {
            updatedJobs[jobIndex] = updatedJob;
          } else if (includeCleared || !updatedJob.is_cleared) {
            // Job wasn't in our list but should be now
            updatedJobs.unshift(updatedJob);
          }
        }
        
        onJobUpdate?.(updatedJob, 'UPDATE');
        
      } else if (payload.eventType === 'DELETE') {
        const deletedJob = payload.old as CourseGenerationJob;
        updatedJobs = updatedJobs.filter(job => job.id !== deletedJob.id);
        onJobUpdate?.(deletedJob, 'DELETE');
      }
      
      return {
        ...prev,
        jobs: updatedJobs,
        error: null // Clear error on successful update
      };
    });
  }, [userId, includeCleared, onJobUpdate]);

  /**
   * Handle connection state changes
   */
  const handleConnectionStateChange = useCallback(() => {
    const connectionState = connectionManager.getSubscriptionStatus(subscriptionId) || ConnectionState.DISCONNECTED;
    
    if (!isMountedRef.current) return;

    setState(prev => ({ ...prev, connectionState }));
  }, [connectionManager, subscriptionId]);

  /**
   * Setup realtime subscription
   */
  const setupSubscription = useCallback(async () => {
    if (!enabled || !userId) return;

    try {
      await connectionManager.subscribe(
        subscriptionId,
        {
          table: 'course_generation_jobs',
          event: '*',
          filter: `user_id=eq.${userId}`,
          enableBackgroundResilience: true
        },
        handleJobUpdate
      );

      console.log(`✅ User jobs subscription setup for user ${userId}`);
      
      // Update connection state
      handleConnectionStateChange();

    } catch (error: any) {
      console.error('Failed to setup user jobs subscription:', error);
      
      if (!isMountedRef.current) return;
      
      setState(prev => ({
        ...prev,
        error: error.message || 'Failed to setup realtime subscription',
        connectionState: ConnectionState.ERROR,
        retryCount: prev.retryCount + 1
      }));

      onError?.(error.message || 'Failed to setup realtime subscription');
    }
  }, [enabled, userId, connectionManager, subscriptionId, handleJobUpdate, handleConnectionStateChange, onError]);

  /**
   * Cleanup subscription
   */
  const cleanupSubscription = useCallback(async () => {
    try {
      await connectionManager.unsubscribe(subscriptionId);
      console.log(`🧹 Cleaned up user jobs subscription for user ${userId}`);
    } catch (error) {
      console.error('Error cleaning up user jobs subscription:', error);
    }
  }, [connectionManager, subscriptionId, userId]);

  /**
   * Retry connection
   */
  const retryConnection = useCallback(async () => {
    setState(prev => ({ ...prev, error: null, retryCount: prev.retryCount + 1 }));
    await cleanupSubscription();
    await setupSubscription();
  }, [cleanupSubscription, setupSubscription]);

  /**
   * Refresh jobs data
   */
  const refreshJobs = useCallback(async () => {
    await fetchInitialJobs(true); // Force refresh when manually triggered
  }, [fetchInitialJobs]);

  /**
   * Clear a job (mark as is_cleared = true)
   */
  const clearJob = useCallback(async (jobId: string) => {
    try {
      const { error } = await supabase
        .from('course_generation_jobs')
        .update({ is_cleared: true })
        .eq('id', jobId)
        .eq('user_id', userId); // Ensure user owns the job

      if (error) {
        throw new Error(`Failed to clear job: ${error.message}`);
      }

      // Job will be removed via realtime update if includeCleared is false
      console.log(`✅ Job ${jobId} marked as cleared`);

    } catch (error: any) {
      console.error('Error clearing job:', error);
      onError?.(error.message || 'Failed to clear job');
      throw error;
    }
  }, [supabase, userId, onError]);

  /**
   * Main effect - setup subscription and fetch initial data
   */
  useEffect(() => {
    if (!userId || !enabled) return;

    const initializeConnection = async () => {
      // Fetch initial data first
      await fetchInitialJobs();
      
      // Then setup realtime subscription
      await setupSubscription();
    };

    initializeConnection();

    // Cleanup on unmount or userId change
    return () => {
      cleanupSubscription();
    };
  }, [userId, enabled]); // Removed callback dependencies to prevent cycling

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
  }, [enabled]); // Removed callback dependency to prevent cycling

  return {
    // Data
    jobs: state.jobs,
    
    // State
    isLoading: state.isLoading,
    error: state.error,
    connectionState: state.connectionState,
    retryCount: state.retryCount,
    
    // Actions
    retryConnection,
    refreshJobs,
    clearJob,
    
    // Utilities
    isConnected: state.connectionState === ConnectionState.CONNECTED,
    isConnecting: state.connectionState === ConnectionState.CONNECTING,
    isReconnecting: state.connectionState === ConnectionState.RECONNECTING,
    hasError: state.connectionState === ConnectionState.ERROR || !!state.error,
    
    // Derived data
    activeJobs: state.jobs.filter(job => job.status === 'processing' || job.status === 'pending'),
    completedJobs: state.jobs.filter(job => job.status === 'completed'),
    failedJobs: state.jobs.filter(job => job.status === 'failed'),
    
    // Connection manager for advanced usage
    connectionManager
  };
}