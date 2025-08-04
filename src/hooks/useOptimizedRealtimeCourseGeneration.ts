import { useState, useEffect, useCallback, useRef } from 'react';
import { createClient } from '@/lib/supabase/client';
import { RealtimeChannel } from '@supabase/supabase-js';

interface CourseGenerationJobUpdate {
  id: string;
  status: 'pending' | 'processing' | 'completed' | 'failed' | 'cancelled';
  progress_percentage?: number;
  current_task?: string;
  error_message?: string;
  created_at: string;
  updated_at: string;
  user_id: string;
  job_data: any;
  is_cleared?: boolean;
}

interface CourseGenerationTaskUpdate {
  id: string;
  job_id: string;
  task_type: string;
  status: 'pending' | 'running' | 'completed' | 'failed';
  task_order: number;
  task_data: any;
  result_data?: any;
  error_message?: string;
  started_at?: string;
  completed_at?: string;
  created_at: string;
  updated_at: string;
}

interface RealtimeCourseGenerationState {
  job: CourseGenerationJobUpdate | null;
  tasks: CourseGenerationTaskUpdate[];
  isLoading: boolean;
  error: string | null;
  progress: number;
  currentTask: string | null;
}

/**
 * Optimized hook for monitoring a single course generation job using Supabase Realtime
 * Follows Supabase best practices for realtime subscriptions
 */
export function useOptimizedRealtimeCourseGeneration(jobId: string | null) {
  const [state, setState] = useState<RealtimeCourseGenerationState>({
    job: null,
    tasks: [],
    isLoading: true,
    error: null,
    progress: 0,
    currentTask: null
  });

  const supabase = createClient();
  const channelRef = useRef<RealtimeChannel | null>(null);
  const isSubscribedRef = useRef(false);

  // Initial data fetch with better error handling
  const fetchInitialData = useCallback(async () => {
    if (!jobId) {
      console.log('useOptimizedRealtimeCourseGeneration: No jobId provided, skipping fetch');
      setState(prev => ({ ...prev, isLoading: false }));
      return;
    }

    // Don't fetch if we're not authenticated yet
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      console.log('useOptimizedRealtimeCourseGeneration: User not authenticated yet, skipping fetch');
      setState(prev => ({ ...prev, isLoading: false }));
      return;
    }

    try {
      setState(prev => ({ ...prev, isLoading: true, error: null }));

      console.log('useOptimizedRealtimeCourseGeneration: Fetching data for jobId:', jobId);

      // Check authentication first
      const { data: { user }, error: authError } = await supabase.auth.getUser();
      if (authError) {
        console.error('useOptimizedRealtimeCourseGeneration: Auth error:', authError);
        throw new Error(`Authentication failed: ${authError.message}`);
      }
      if (!user) {
        throw new Error('User not authenticated');
      }

      // Fetch job and tasks in parallel for better performance
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
        console.error('useOptimizedRealtimeCourseGeneration: Job fetch error:', {
          error: jobResult.error,
          jobId,
          userId: user.id,
          errorCode: jobResult.error.code,
          errorMessage: jobResult.error.message,
          errorDetails: jobResult.error.details
        });
        throw new Error(`Failed to fetch job: ${jobResult.error.message || 'Unknown error'}`);
      }

      if (tasksResult.error) {
        console.error('useOptimizedRealtimeCourseGeneration: Tasks fetch error:', {
          error: tasksResult.error,
          jobId,
          userId: user.id,
          errorCode: tasksResult.error.code,
          errorMessage: tasksResult.error.message,
          errorDetails: tasksResult.error.details
        });
        throw new Error(`Failed to fetch tasks: ${tasksResult.error.message || 'Unknown error'}`);
      }

      // Verify user has access to this job
      if (jobResult.data?.user_id !== user.id) {
        throw new Error('Access denied: You do not have permission to view this job');
      }

      const jobData = jobResult.data;
      const tasksData = tasksResult.data || [];

      const completedTasks = tasksData.filter(task => task.status === 'completed').length;
      const totalTasks = tasksData.length;
      const progress = totalTasks > 0 ? Math.round((completedTasks / totalTasks) * 100) : 0;

      console.log('useOptimizedRealtimeCourseGeneration: Successfully fetched data:', {
        jobStatus: jobData?.status,
        tasksCount: totalTasks,
        completedTasks,
        progress
      });

      setState({
        job: jobData,
        tasks: tasksData,
        isLoading: false,
        error: null,
        progress,
        currentTask: jobData?.current_task || null
      });

    } catch (error: any) {
      // Enhanced error logging for Supabase errors
      const errorInfo = {
        error,
        errorType: typeof error,
        errorConstructor: error?.constructor?.name,
        errorMessage: error?.message || 'Unknown error',
        errorCode: error?.code,
        errorDetails: error?.details,
        errorHint: error?.hint,
        supabaseError: JSON.stringify(error, null, 2),
        jobId,
        supabaseClientExists: !!supabase,
        timestamp: new Date().toISOString()
      };
      
      console.error('useOptimizedRealtimeCourseGeneration: Failed to fetch initial data:', errorInfo);
      
      // Try to extract meaningful error message
      let userMessage = 'Failed to load data';
      if (error?.message) {
        userMessage = error.message;
      } else if (error?.details) {
        userMessage = error.details;
      } else if (typeof error === 'string') {
        userMessage = error;
      }
      
      setState(prev => ({
        ...prev,
        isLoading: false,
        error: userMessage
      }));
    }
  }, [jobId, supabase]);

  // Optimized realtime subscription setup with retry logic
  useEffect(() => {
    if (!jobId) return;

    console.log('useOptimizedRealtimeCourseGeneration: Setting up realtime subscription for jobId:', jobId);

    // Fetch initial data
    fetchInitialData();

    let retryCount = 0;
    const maxRetries = 3;
    let retryTimeout: NodeJS.Timeout;

    const setupSubscription = () => {
      // Clean up existing subscription
      if (channelRef.current) {
        supabase.removeChannel(channelRef.current);
        channelRef.current = null;
        isSubscribedRef.current = false;
      }

      // Create optimized channel following Supabase best practices
      const channel = supabase
        .channel(`course-generation-${jobId}-${Date.now()}`, {
          config: {
            broadcast: { self: false },
            presence: { key: jobId },
            private: false // Make sure it's not private
          }
        })
        // Subscribe to job updates
        .on(
          'postgres_changes',
          {
            event: '*',
            schema: 'public',
            table: 'course_generation_jobs',
            filter: `id=eq.${jobId}`
          },
          (payload) => {
            console.log('useOptimizedRealtimeCourseGeneration: Job update received:', payload);
            
            const updatedJob = payload.new as CourseGenerationJobUpdate;
            if (updatedJob) {
              setState(prev => ({
                ...prev,
                job: updatedJob,
                currentTask: updatedJob.current_task || prev.currentTask,
                error: null // Clear error on successful update
              }));
            }
          }
        )
        // Subscribe to task updates
        .on(
          'postgres_changes',
          {
            event: '*',
            schema: 'public',
            table: 'course_generation_tasks',
            filter: `job_id=eq.${jobId}`
          },
          (payload) => {
            console.log('useOptimizedRealtimeCourseGeneration: Task update received:', payload);
            
            setState(prev => {
              let updatedTasks = [...prev.tasks];
              
              if (payload.eventType === 'INSERT') {
                const newTask = payload.new as CourseGenerationTaskUpdate;
                const insertIndex = updatedTasks.findIndex(t => t.task_order > newTask.task_order);
                if (insertIndex === -1) {
                  updatedTasks.push(newTask);
                } else {
                  updatedTasks.splice(insertIndex, 0, newTask);
                }
              } else if (payload.eventType === 'UPDATE') {
                const updatedTask = payload.new as CourseGenerationTaskUpdate;
                updatedTasks = updatedTasks.map(task => 
                  task.id === updatedTask.id ? updatedTask : task
                );
              } else if (payload.eventType === 'DELETE') {
                const deletedTask = payload.old as CourseGenerationTaskUpdate;
                updatedTasks = updatedTasks.filter(task => task.id !== deletedTask.id);
              }
              
              const completedTasks = updatedTasks.filter(task => task.status === 'completed').length;
              const totalTasks = updatedTasks.length;
              const progress = totalTasks > 0 ? Math.round((completedTasks / totalTasks) * 100) : 0;
              
              return {
                ...prev,
                tasks: updatedTasks,
                progress,
                error: null // Clear error on successful update
              };
            });
          }
        )
        .subscribe((status) => {
          console.log('useOptimizedRealtimeCourseGeneration: Subscription status:', status, 'for jobId:', jobId);
          
          if (status === 'SUBSCRIBED') {
            console.log('useOptimizedRealtimeCourseGeneration: Successfully subscribed for jobId:', jobId);
            isSubscribedRef.current = true;
            retryCount = 0; // Reset retry count on success
            setState(prev => ({ ...prev, error: null }));
          } else if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT') {
            console.error(`useOptimizedRealtimeCourseGeneration: ${status} for jobId:`, jobId);
            isSubscribedRef.current = false;
            
            if (retryCount < maxRetries) {
              retryCount++;
              console.log(`useOptimizedRealtimeCourseGeneration: Retrying subscription (${retryCount}/${maxRetries}) for jobId:`, jobId);
              setState(prev => ({ ...prev, error: `Connection ${status.toLowerCase()}, retrying... (${retryCount}/${maxRetries})` }));
              
              // Retry after a delay
              retryTimeout = setTimeout(() => {
                setupSubscription();
              }, Math.min(1000 * Math.pow(2, retryCount - 1), 10000)); // Exponential backoff, max 10s
            } else {
              console.error(`useOptimizedRealtimeCourseGeneration: Max retries reached for jobId:`, jobId);
              setState(prev => ({ ...prev, error: 'Connection failed after multiple attempts. Please refresh the page.' }));
            }
          }
        });

      channelRef.current = channel;
    };

    // Initial setup
    setupSubscription();

    // Cleanup function
    return () => {
      console.log('useOptimizedRealtimeCourseGeneration: Cleaning up subscription for jobId:', jobId);
      
      if (retryTimeout) {
        clearTimeout(retryTimeout);
      }
      
      if (channelRef.current) {
        supabase.removeChannel(channelRef.current);
        channelRef.current = null;
      }
      
      isSubscribedRef.current = false;
    };
  }, [jobId, supabase, fetchInitialData]);

  // Manual refresh function
  const refreshData = useCallback(() => {
    fetchInitialData();
  }, [fetchInitialData]);

  return {
    ...state,
    refreshData
  };
}

/**
 * Optimized hook for monitoring multiple jobs (dashboard view)
 * Uses a single channel for better performance
 */
export function useOptimizedRealtimeUserJobs(userId: string | null) {
  const [jobs, setJobs] = useState<CourseGenerationJobUpdate[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const supabase = createClient();
  const channelRef = useRef<RealtimeChannel | null>(null);
  const isSubscribedRef = useRef(false);

  const fetchInitialJobs = useCallback(async () => {
    if (!userId) {
      console.log('useOptimizedRealtimeUserJobs: No userId provided, skipping fetch');
      setIsLoading(false);
      return;
    }

    // Don't fetch if we're not authenticated yet
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      console.log('useOptimizedRealtimeUserJobs: User not authenticated yet, skipping fetch');
      setIsLoading(false);
      return;
    }

    try {
      setIsLoading(true);
      setError(null);

      console.log('useOptimizedRealtimeUserJobs: Fetching jobs for userId:', userId);

      // Check authentication first
      const { data: { user }, error: authError } = await supabase.auth.getUser();
      if (authError) {
        console.error('useOptimizedRealtimeUserJobs: Auth error:', authError);
        throw new Error(`Authentication failed: ${authError.message}`);
      }
      if (!user) {
        throw new Error('User not authenticated');
      }
      if (user.id !== userId) {
        throw new Error('Access denied: User ID mismatch');
      }

      const { data, error: fetchError } = await supabase
        .from('course_generation_jobs')
        .select('*')
        .eq('user_id', userId)
        .eq('is_cleared', false)
        .order('created_at', { ascending: false });

      if (fetchError) {
        console.error('useOptimizedRealtimeUserJobs: Supabase error:', {
          error: fetchError,
          userId,
          authenticatedUserId: user.id,
          errorCode: fetchError.code,
          errorMessage: fetchError.message,
          errorDetails: fetchError.details
        });
        throw new Error(`Failed to fetch jobs: ${fetchError.message || 'Unknown error'}`);
      }

      console.log('useOptimizedRealtimeUserJobs: Successfully fetched', data?.length || 0, 'jobs');
      setJobs(data || []);
    } catch (err: any) {
      // Enhanced error logging for Supabase errors
      const errorInfo = {
        error: err,
        errorType: typeof err,
        errorConstructor: err?.constructor?.name,
        errorMessage: err?.message || 'Unknown error',
        errorCode: err?.code,
        errorDetails: err?.details,
        errorHint: err?.hint,
        supabaseError: JSON.stringify(err, null, 2),
        userId,
        supabaseClientExists: !!supabase,
        timestamp: new Date().toISOString()
      };
      
      console.error('useOptimizedRealtimeUserJobs: Failed to fetch user jobs:', errorInfo);
      
      // Try to extract meaningful error message
      let userMessage = 'Failed to load jobs';
      if (err?.message) {
        userMessage = err.message;
      } else if (err?.details) {
        userMessage = err.details;
      } else if (typeof err === 'string') {
        userMessage = err;
      }
      
      setError(userMessage);
    } finally {
      setIsLoading(false);
    }
  }, [userId, supabase]);

  useEffect(() => {
    if (!userId) return;

    console.log('useOptimizedRealtimeUserJobs: Setting up realtime subscription for userId:', userId);

    // Fetch initial data
    fetchInitialJobs();

    let retryCount = 0;
    const maxRetries = 3;
    let retryTimeout: NodeJS.Timeout;

    const setupSubscription = () => {
      // Clean up existing subscription
      if (channelRef.current) {
        supabase.removeChannel(channelRef.current);
        channelRef.current = null;
        isSubscribedRef.current = false;
      }

      // Create optimized channel for user jobs
      const channel = supabase
        .channel(`user-jobs-${userId}-${Date.now()}`, {
          config: {
            broadcast: { self: false },
            presence: { key: userId },
            private: false
          }
        })
        .on(
          'postgres_changes',
          {
            event: '*',
            schema: 'public',
            table: 'course_generation_jobs',
            filter: `user_id=eq.${userId}`
          },
          (payload) => {
            console.log('useOptimizedRealtimeUserJobs: Job update received:', payload);
            
            const updatedJob = payload.new as CourseGenerationJobUpdate;
            
            setJobs(prev => {
              if (payload.eventType === 'INSERT') {
                if (updatedJob?.is_cleared) return prev;
                return [updatedJob, ...prev];
              } else if (payload.eventType === 'UPDATE') {
                if (updatedJob?.is_cleared) {
                  return prev.filter(job => job.id !== updatedJob.id);
                }
                return prev.map(job => job.id === updatedJob.id ? updatedJob : job);
              } else if (payload.eventType === 'DELETE') {
                const deletedJob = payload.old as CourseGenerationJobUpdate;
                return prev.filter(job => job.id !== deletedJob.id);
              }
              return prev;
            });
            
            // Clear error on successful update
            setError(null);
          }
        )
        .subscribe((status) => {
          console.log('useOptimizedRealtimeUserJobs: Subscription status:', status, 'for userId:', userId);
          
          if (status === 'SUBSCRIBED') {
            console.log('useOptimizedRealtimeUserJobs: Successfully subscribed for userId:', userId);
            isSubscribedRef.current = true;
            retryCount = 0;
            setError(null);
          } else if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT') {
            console.error(`useOptimizedRealtimeUserJobs: ${status} for userId:`, userId);
            isSubscribedRef.current = false;
            
            if (retryCount < maxRetries) {
              retryCount++;
              console.log(`useOptimizedRealtimeUserJobs: Retrying subscription (${retryCount}/${maxRetries}) for userId:`, userId);
              setError(`Connection ${status.toLowerCase()}, retrying... (${retryCount}/${maxRetries})`);
              
              retryTimeout = setTimeout(() => {
                setupSubscription();
              }, Math.min(1000 * Math.pow(2, retryCount - 1), 10000));
            } else {
              console.error(`useOptimizedRealtimeUserJobs: Max retries reached for userId:`, userId);
              setError('Connection failed after multiple attempts. Please refresh the page.');
            }
          }
        });

      channelRef.current = channel;
    };

    // Initial setup
    setupSubscription();

    return () => {
      console.log('useOptimizedRealtimeUserJobs: Cleaning up subscription for userId:', userId);
      
      if (retryTimeout) {
        clearTimeout(retryTimeout);
      }
      
      if (channelRef.current) {
        supabase.removeChannel(channelRef.current);
        channelRef.current = null;
      }
      
      isSubscribedRef.current = false;
    };
  }, [userId, supabase, fetchInitialJobs]);

  const refreshJobs = useCallback(() => {
    fetchInitialJobs();
  }, [fetchInitialJobs]);

  return {
    jobs,
    isLoading,
    error,
    refreshJobs
  };
}