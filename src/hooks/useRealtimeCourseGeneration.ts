import { useState, useEffect, useCallback } from 'react';
import { realtimeService, CourseGenerationJobUpdate, CourseGenerationTaskUpdate } from '@/lib/services/realtime-subscriptions';
import { createClient } from '@/lib/supabase/client';

export interface CourseGenerationState {
  job: CourseGenerationJobUpdate | null;
  tasks: CourseGenerationTaskUpdate[];
  isLoading: boolean;
  error: string | null;
  progress: number;
  currentTask: string | null;
}

/**
 * Hook for real-time course generation monitoring
 * Replaces polling patterns with Supabase Realtime subscriptions
 */
export function useRealtimeCourseGeneration(jobId: string | null) {
  const [state, setState] = useState<CourseGenerationState>({
    job: null,
    tasks: [],
    isLoading: true,
    error: null,
    progress: 0,
    currentTask: null
  });

  const supabase = createClient();

  // Initial data fetch
  const fetchInitialData = useCallback(async () => {
    if (!jobId) {
      console.log('fetchInitialData: No jobId provided, skipping fetch');
      setState(prev => ({ ...prev, isLoading: false }));
      return;
    }

    try {
      setState(prev => ({ ...prev, isLoading: true, error: null }));

      console.log('fetchInitialData: Fetching data for jobId:', jobId);

      // Fetch job details
      const { data: jobData, error: jobError } = await supabase
        .from('course_generation_jobs')
        .select('*')
        .eq('id', jobId)
        .single();

      if (jobError) {
        console.error('fetchInitialData: Job fetch error:', jobError);
        throw jobError;
      }

      // Fetch tasks
      const { data: tasksData, error: tasksError } = await supabase
        .from('course_generation_tasks')
        .select('*')
        .eq('job_id', jobId)
        .order('task_order', { ascending: true });

      if (tasksError) {
        console.error('fetchInitialData: Tasks fetch error:', tasksError);
        throw tasksError;
      }

      const completedTasks = tasksData?.filter(task => task.status === 'completed').length || 0;
      const totalTasks = tasksData?.length || 0;
      const progress = totalTasks > 0 ? Math.round((completedTasks / totalTasks) * 100) : 0;

      console.log('fetchInitialData: Successfully fetched data:', {
        jobStatus: jobData?.status,
        tasksCount: totalTasks,
        completedTasks,
        progress
      });

      setState({
        job: jobData,
        tasks: tasksData || [],
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
      
      console.error('fetchInitialData: Failed to fetch initial course generation data:', errorInfo);
      
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

  // Set up realtime subscriptions
  useEffect(() => {
    if (!jobId) return;

    const unsubscribeFromJob = realtimeService.subscribeToJobUpdates(jobId, (payload) => {
      const updatedJob = payload.new as CourseGenerationJobUpdate;
      
      setState(prev => ({
        ...prev,
        job: updatedJob,
        currentTask: updatedJob.current_task || prev.currentTask,
        progress: updatedJob.progress || prev.progress
      }));
    });

    const unsubscribeFromTasks = realtimeService.subscribeToTaskUpdates(jobId, (payload) => {
      const updatedTask = payload.new as CourseGenerationTaskUpdate;
      
      setState(prev => {
        const updatedTasks = prev.tasks.map(task => 
          task.id === updatedTask.id ? updatedTask : task
        );

        // If this is a new task, add it
        if (!prev.tasks.find(task => task.id === updatedTask.id)) {
          updatedTasks.push(updatedTask);
          updatedTasks.sort((a, b) => (a as any).task_order - (b as any).task_order);
        }

        // Recalculate progress
        const completedTasks = updatedTasks.filter(task => task.status === 'completed').length;
        const totalTasks = updatedTasks.length;
        const progress = totalTasks > 0 ? Math.round((completedTasks / totalTasks) * 100) : 0;

        return {
          ...prev,
          tasks: updatedTasks,
          progress
        };
      });
    });

    // Fetch initial data
    fetchInitialData();

    // Cleanup subscriptions
    return () => {
      unsubscribeFromJob();
      unsubscribeFromTasks();
    };
  }, [jobId, fetchInitialData]);

  const refreshData = useCallback(() => {
    fetchInitialData();
  }, [fetchInitialData]);

  return {
    ...state,
    refreshData
  };
}

/**
 * Hook for monitoring multiple jobs (dashboard view)
 */
export function useRealtimeUserJobs(userId: string | null) {
  const [jobs, setJobs] = useState<CourseGenerationJobUpdate[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const supabase = createClient();

  const fetchInitialJobs = useCallback(async () => {
    if (!userId) {
      console.log('fetchInitialJobs: No userId provided, skipping fetch');
      setIsLoading(false);
      return;
    }

    try {
      setIsLoading(true);
      setError(null);

      console.log('fetchInitialJobs: Fetching jobs for userId:', userId);

      const { data, error: fetchError } = await supabase
        .from('course_generation_jobs')
        .select('*')
        .eq('user_id', userId)
        .eq('is_cleared', false)
        .order('created_at', { ascending: false });

      if (fetchError) {
        console.error('fetchInitialJobs: Supabase error:', fetchError);
        throw fetchError;
      }

      console.log('fetchInitialJobs: Successfully fetched', data?.length || 0, 'jobs');
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
      
      console.error('fetchInitialJobs: Failed to fetch user jobs:', errorInfo);
      
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

    const unsubscribe = realtimeService.subscribeToUserJobs(userId, (payload) => {
      const updatedJob = payload.new as any; // Use any to access is_cleared
      
      setJobs(prev => {
        if (payload.eventType === 'INSERT') {
          // Only add if not cleared
          if (updatedJob.is_cleared) return prev;
          return [updatedJob, ...prev];
        } else if (payload.eventType === 'UPDATE') {
          // If job was cleared, remove it from the list
          if (updatedJob.is_cleared) {
            return prev.filter(job => job.id !== updatedJob.id);
          }
          // Otherwise update it
          return prev.map(job => job.id === updatedJob.id ? updatedJob : job);
        } else if (payload.eventType === 'DELETE') {
          return prev.filter(job => job.id !== payload.old.id);
        }
        return prev;
      });
    });

    fetchInitialJobs();

    return unsubscribe;
  }, [userId, fetchInitialJobs]);

  return {
    jobs,
    isLoading,
    error,
    refreshJobs: fetchInitialJobs
  };
}