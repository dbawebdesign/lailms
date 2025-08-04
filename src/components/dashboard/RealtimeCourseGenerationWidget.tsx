'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { createClient } from '@/lib/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '@/components/ui/accordion';
import { 
  Clock, 
  CheckCircle, 
  AlertCircle, 
  RefreshCw,
  X,
  ExternalLink,
  AlertTriangle,
  RotateCcw,
  Trash2,
  BookOpen
} from 'lucide-react';
import { cn } from '@/lib/utils';
import Link from 'next/link';
import { toast } from 'sonner';
import JSConfetti from 'js-confetti';
import { useRealtimeJobHealth } from '@/hooks/useRealtimeJobHealth';

interface CourseGenerationJob {
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

interface RealtimeCourseGenerationWidgetProps {
  userId: string;
  initialJobs: CourseGenerationJob[];
  className?: string;
}

interface EnhancedJobCardProps {
  job: CourseGenerationJob;
  onClear: (jobId: string) => void;
}

/**
 * Enhanced job card with health monitoring and recovery actions
 */
function EnhancedJobCard({ job, onClear }: EnhancedJobCardProps) {
  const [showHealthDetails, setShowHealthDetails] = useState(false);
  const [confettiRef, setConfettiRef] = useState<JSConfetti | null>(null);

  // Use health monitoring for resilience
  const {
    health,
    isLoading: isHealthLoading,
    needsAttention,
    attemptRecovery,
    isRecovering,
    error: healthError
  } = useRealtimeJobHealth({
    jobId: job.id,
    enabled: job.status === 'processing' || job.status === 'failed',
    onHealthChange: (newHealth) => {
      // Show health details if there are issues
      if (['stalled', 'stuck', 'failed', 'abandoned'].includes(newHealth.status)) {
        setShowHealthDetails(true);
      }
    }
  });

  // Handle confetti for completion
  useEffect(() => {
    if (job.status === 'completed' && !confettiRef) {
      const jsConfetti = new JSConfetti();
      jsConfetti.addConfetti({
        emojis: ['🎓', '📚', '✨', '🎉'],
        emojiSize: 50,
        confettiNumber: 30,
      });
      setConfettiRef(jsConfetti);
    }
  }, [job.status, confettiRef]);

  const handleRecovery = async (action: 'resume' | 'restart' | 'delete') => {
    try {
      await attemptRecovery(action);
      toast.success('Recovery initiated', {
        description: `${action} operation started successfully`
      });
      setShowHealthDetails(false);
    } catch (error) {
      toast.error('Recovery failed', {
        description: error instanceof Error ? error.message : 'Unknown error occurred'
      });
    }
  };

  const handleRestart = async () => {
    try {
      const response = await fetch(`/api/knowledge-base/jobs/${job.id}/restart`, { 
        method: 'POST',
        headers: { 'Content-Type': 'application/json' }
      });
      
      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || 'Failed to restart job');
      }
      
      toast.success('Job restarted successfully');
    } catch (error) {
      toast.error('Failed to restart job', {
        description: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  };

  const handleDelete = async () => {
    try {
      const response = await fetch(`/api/knowledge-base/jobs/${job.id}`, { 
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' }
      });
      
      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || 'Failed to delete job');
      }
      
      toast.success('Job deleted successfully');
    } catch (error) {
      toast.error('Failed to delete job', {
        description: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  };

  // Get health status badge
  const getHealthBadge = () => {
    if (!health || job.status !== 'processing') return null;
    
    switch (health.status) {
      case 'healthy':
        return <Badge variant="default" className="bg-green-100 text-green-800 text-xs">Healthy</Badge>;
      case 'stalled':
        return <Badge variant="secondary" className="text-xs">Stalled</Badge>;
      case 'stuck':
      case 'failed':
        return <Badge variant="destructive" className="text-xs">Needs Attention</Badge>;
      default:
        return null;
    }
  };

  // Get recommended recovery action
  const getRecommendedAction = () => {
    if (!health || !needsAttention) return null;
    
    if (health.status === 'stalled') return 'resume';
    if (health.status === 'stuck') return 'restart';
    if (health.status === 'failed') return 'delete_and_retry';
    return 'restart';
  };

  const recommendedAction = getRecommendedAction();

  // Get recovery actions
  const getRecoveryActions = () => {
    if (!needsAttention || job.status !== 'processing') return null;

    return (
      <div className="flex items-center gap-2 mt-2">
        {recommendedAction === 'resume' && (
          <Button
            size="sm"
            variant="outline"
            onClick={() => handleRecovery('resume')}
            disabled={isRecovering}
            className="text-xs h-7"
          >
            <RefreshCw className="w-3 h-3 mr-1" />
            Resume
          </Button>
        )}
        
        {(recommendedAction === 'restart' || recommendedAction === 'delete_and_retry') && (
          <Button
            size="sm"
            variant="outline"
            onClick={() => handleRecovery('restart')}
            disabled={isRecovering}
            className="text-xs h-7"
          >
            <RotateCcw className="w-3 h-3 mr-1" />
            Try Recovery
          </Button>
        )}

        {recommendedAction === 'delete_and_retry' && (
          <Button
            size="sm"
            variant="outline"
            onClick={() => handleRecovery('delete')}
            disabled={isRecovering}
            className="text-xs h-7"
          >
            <Trash2 className="w-3 h-3 mr-1" />
            Delete & Retry
          </Button>
        )}

        <Button
          size="sm"
          variant="ghost"
          onClick={() => setShowHealthDetails(!showHealthDetails)}
          className="text-xs h-7"
        >
          {showHealthDetails ? 'Hide Details' : 'Show Details'}
        </Button>
      </div>
    );
  };

  // Helper function to get status badge
  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'completed':
        return <Badge variant="default" className="bg-green-100 text-green-800"><CheckCircle className="w-3 h-3 mr-1" />Completed</Badge>;
      case 'processing':
        return <Badge variant="default" className="bg-blue-100 text-blue-800"><Clock className="w-3 h-3 mr-1" />Processing</Badge>;
      case 'failed':
        return <Badge variant="destructive"><AlertCircle className="w-3 h-3 mr-1" />Failed</Badge>;
      case 'cancelled':
        return <Badge variant="secondary"><X className="w-3 h-3 mr-1" />Cancelled</Badge>;
      default:
        return <Badge variant="outline"><Clock className="w-3 h-3 mr-1" />Pending</Badge>;
    }
  };

  // Helper function to format time
  const formatTimeAgo = (dateString: string) => {
    const date = new Date(dateString);
    const now = new Date();
    const diffInMinutes = Math.floor((now.getTime() - date.getTime()) / (1000 * 60));
    
    if (diffInMinutes < 1) return 'Just now';
    if (diffInMinutes < 60) return `${diffInMinutes}m ago`;
    
    const diffInHours = Math.floor(diffInMinutes / 60);
    if (diffInHours < 24) return `${diffInHours}h ago`;
    
    const diffInDays = Math.floor(diffInHours / 24);
    return `${diffInDays}d ago`;
  };

  return (
    <div className="relative border rounded-lg p-4">
      {/* Clear button */}
      <button
        onClick={(e) => { e.stopPropagation(); onClear(job.id); }}
        className="absolute top-2 right-2 z-10 h-6 w-6 rounded-md hover:bg-gray-100 dark:hover:bg-gray-800 flex items-center justify-center transition-colors"
        aria-label="Clear job"
      >
        <X className="h-3 w-3" />
      </button>

      <div className="pr-8">
        <div className="flex items-center justify-between mb-2">
          <div className="flex items-center gap-2">
            <h3 className="font-semibold truncate">
              {(job.job_data as any)?.title || 'Course Generation'}
            </h3>
            <div className="flex items-center gap-1">
              {getStatusBadge(job.status)}
              {getHealthBadge()}
            </div>
          </div>
          <span className="text-xs text-muted-foreground">
            {formatTimeAgo(job.updated_at)}
          </span>
        </div>

        {/* Progress bar */}
        {job.status === 'processing' && (
          <div className="mb-3">
            <div className="flex justify-between text-sm mb-1">
              <span>Progress</span>
              <span>{health?.progressPercentage || job.progress_percentage || 0}%</span>
            </div>
            <Progress value={health?.progressPercentage || job.progress_percentage || 0} className="w-full" />
          </div>
        )}

        {/* Current task */}
        {job.current_task && job.status === 'processing' && (
          <p className="text-sm text-muted-foreground mb-2">
            Current: {job.current_task}
          </p>
        )}

        {/* Health message for processing jobs */}
        {job.status === 'processing' && health?.message && (
          <p className="text-sm text-muted-foreground mb-2">
            {health.message}
          </p>
        )}

        {/* Error message */}
        {job.error_message && (
          <Alert className="mt-2">
            <AlertCircle className="h-4 w-4" />
            <AlertDescription>{job.error_message}</AlertDescription>
          </Alert>
        )}

        {/* Recovery Actions */}
        {getRecoveryActions()}

        {/* Health Details */}
        {showHealthDetails && health && (
          <Alert className="mt-3">
            <h4 className="font-semibold text-sm mb-2">Health Details</h4>
            <div className="space-y-1 text-xs">
              <div><span className="font-medium">Status:</span> {health.status}</div>
              <div><span className="font-medium">Progress:</span> {health.progressPercentage}%</div>
              {health.details && (
                <div>
                  <span className="font-medium text-xs">Error Details:</span>
                  <p className="text-xs text-gray-600 mt-1">{health.details}</p>
                </div>
              )}
              {health.lastUpdated && (
                <div><span className="font-medium">Last Updated:</span> {new Date(health.lastUpdated).toLocaleString()}</div>
              )}
            </div>
          </Alert>
        )}

        {/* Error Display */}
        {healthError && (
          <Alert className="mt-2">
            <AlertTriangle className="h-4 w-4" />
            <AlertDescription>Health Check Error: {healthError}</AlertDescription>
          </Alert>
        )}

        {/* Standard Actions */}
        <div className="flex items-center gap-2 mt-3">
          {job.status === 'completed' && (
            <Button asChild size="sm" variant="outline">
              <Link href={`/teach/courses/${job.id}`}>
                <ExternalLink className="w-4 h-4 mr-1" />
                View Course
              </Link>
            </Button>
          )}
          
          {job.status === 'failed' && (
            <div className="flex gap-2">
              <Button size="sm" variant="outline" onClick={handleRestart}>
                <RotateCcw className="w-4 h-4 mr-1" />
                Retry
              </Button>
              <Button size="sm" variant="outline" onClick={handleDelete}>
                <Trash2 className="w-4 h-4 mr-1" />
                Delete
              </Button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

/**
 * Client component that handles realtime subscriptions for course generation jobs
 * Following Supabase best practices from their Next.js tutorial
 */
export default function RealtimeCourseGenerationWidget({ 
  userId, 
  initialJobs, 
  className 
}: RealtimeCourseGenerationWidgetProps) {
  // Initialize state with server-provided data
  const [jobs, setJobs] = useState<CourseGenerationJob[]>(initialJobs);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  
  const supabase = createClient();

  // Set up realtime subscription with retry logic following Supabase tutorial pattern
  useEffect(() => {
    console.log('RealtimeCourseGenerationWidget: Setting up realtime subscription for userId:', userId);

    let retryCount = 0;
    const maxRetries = 3;
    let retryTimeout: NodeJS.Timeout;
    let currentChannel: any = null;

    const setupSubscription = () => {
      // Clean up existing subscription
      if (currentChannel) {
        supabase.removeChannel(currentChannel);
        currentChannel = null;
      }

      // Create channel with unique name to avoid conflicts
      const channel = supabase
        .channel(`course-generation-jobs-${userId}-${Date.now()}`, {
          config: {
            broadcast: { self: false },
            presence: { key: userId },
            private: false
          }
        })
        .on(
          'postgres_changes',
          {
            event: '*', // Listen to all events (INSERT, UPDATE, DELETE)
            schema: 'public',
            table: 'course_generation_jobs',
            filter: `user_id=eq.${userId}`
          },
          (payload) => {
            console.log('RealtimeCourseGenerationWidget: Job update received:', payload);
            
            const updatedJob = payload.new as CourseGenerationJob;
            
            setJobs(prev => {
              if (payload.eventType === 'INSERT') {
                // Don't add cleared jobs
                if (updatedJob?.is_cleared) return prev;
                return [updatedJob, ...prev];
              } else if (payload.eventType === 'UPDATE') {
                if (updatedJob?.is_cleared) {
                  // Remove cleared jobs from UI
                  return prev.filter(job => job.id !== updatedJob.id);
                }
                // Update existing job
                return prev.map(job => job.id === updatedJob.id ? updatedJob : job);
              } else if (payload.eventType === 'DELETE') {
                const deletedJob = payload.old as CourseGenerationJob;
                return prev.filter(job => job.id !== deletedJob.id);
              }
              return prev;
            });
            
            // Clear any connection errors on successful update
            setError(null);
          }
        )
        .subscribe((status) => {
          console.log('RealtimeCourseGenerationWidget: Subscription status:', status, 'for userId:', userId);
          
          if (status === 'SUBSCRIBED') {
            console.log('RealtimeCourseGenerationWidget: Successfully subscribed for userId:', userId);
            retryCount = 0; // Reset retry count on success
            setError(null);
          } else if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT') {
            console.error(`RealtimeCourseGenerationWidget: ${status} for userId:`, userId);
            
            if (retryCount < maxRetries) {
              retryCount++;
              console.log(`RealtimeCourseGenerationWidget: Retrying subscription (${retryCount}/${maxRetries}) for userId:`, userId);
              setError(`Connection ${status.toLowerCase()}, retrying... (${retryCount}/${maxRetries})`);
              
              // Retry after exponential backoff delay
              retryTimeout = setTimeout(() => {
                setupSubscription();
              }, Math.min(1000 * Math.pow(2, retryCount - 1), 10000)); // Exponential backoff, max 10s
            } else {
              console.error(`RealtimeCourseGenerationWidget: Max retries reached for userId:`, userId);
              setError('Connection failed after multiple attempts. Please refresh the page.');
            }
          }
        });

      currentChannel = channel;
    };

    // Initial setup
    setupSubscription();

    // Cleanup subscription on unmount
    return () => {
      console.log('RealtimeCourseGenerationWidget: Cleaning up subscription for userId:', userId);
      
      if (retryTimeout) {
        clearTimeout(retryTimeout);
      }
      
      if (currentChannel) {
        supabase.removeChannel(currentChannel);
        currentChannel = null;
      }
    };
  }, [userId, supabase]);

  // Manual refresh function
  const refreshJobs = useCallback(async () => {
    setIsLoading(true);
    try {
      const { data, error: fetchError } = await supabase
        .from('course_generation_jobs')
        .select('*')
        .eq('user_id', userId)
        .eq('is_cleared', false)
        .order('created_at', { ascending: false });

      if (fetchError) throw fetchError;
      
      setJobs(data || []);
      setError(null);
    } catch (err) {
      console.error('Failed to refresh jobs:', err);
      setError(err instanceof Error ? err.message : 'Failed to refresh jobs');
    } finally {
      setIsLoading(false);
    }
  }, [userId, supabase]);

  // Clear job function
  const clearJob = useCallback(async (jobId: string) => {
    try {
      const response = await fetch(`/api/knowledge-base/jobs/${jobId}/clear`, { 
        method: 'POST',
        headers: { 'Content-Type': 'application/json' }
      });
      
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to clear job');
      }
      
      toast.success('Job cleared from dashboard');
    } catch (err) {
      console.error('Failed to clear job:', err);
      toast.error(err instanceof Error ? err.message : 'Failed to clear job');
    }
  }, []);

  // Helper function to get status badge
  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'completed':
        return <Badge variant="default" className="bg-green-100 text-green-800"><CheckCircle className="w-3 h-3 mr-1" />Completed</Badge>;
      case 'processing':
        return <Badge variant="default" className="bg-blue-100 text-blue-800"><Clock className="w-3 h-3 mr-1" />Processing</Badge>;
      case 'failed':
        return <Badge variant="destructive"><AlertCircle className="w-3 h-3 mr-1" />Failed</Badge>;
      case 'cancelled':
        return <Badge variant="secondary"><X className="w-3 h-3 mr-1" />Cancelled</Badge>;
      default:
        return <Badge variant="outline"><Clock className="w-3 h-3 mr-1" />Pending</Badge>;
    }
  };

  // Helper function to format time
  const formatTimeAgo = (dateString: string) => {
    const date = new Date(dateString);
    const now = new Date();
    const diffInMinutes = Math.floor((now.getTime() - date.getTime()) / (1000 * 60));
    
    if (diffInMinutes < 1) return 'Just now';
    if (diffInMinutes < 60) return `${diffInMinutes}m ago`;
    
    const diffInHours = Math.floor(diffInMinutes / 60);
    if (diffInHours < 24) return `${diffInHours}h ago`;
    
    const diffInDays = Math.floor(diffInHours / 24);
    return `${diffInDays}d ago`;
  };

  if (jobs.length === 0 && !error) {
    return (
      <Card className={cn("w-full", className)}>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <BookOpen className="w-5 h-5" />
            Course Generation Progress
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-center py-8 text-muted-foreground">
            <BookOpen className="w-12 h-12 mx-auto mb-4 opacity-50" />
            <p>No course generation jobs found.</p>
            <p className="text-sm">Create a new course to see progress here.</p>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className={cn("w-full", className)}>
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle className="flex items-center gap-2">
            <BookOpen className="w-5 h-5" />
            Course Generation Progress
            {jobs.length > 0 && (
              <Badge variant="secondary" className="ml-2">
                {jobs.length}
              </Badge>
            )}
          </CardTitle>
          <Button 
            variant="ghost" 
            size="sm" 
            onClick={refreshJobs} 
            disabled={isLoading}
            className="h-8 w-8 p-0"
          >
            <RefreshCw className={cn("h-4 w-4", isLoading && "animate-spin")} />
          </Button>
        </div>
        <p className="text-sm text-muted-foreground">
          Your courses are being generated. Track progress and resolve issues here.
        </p>
      </CardHeader>
      <CardContent>
        {error && (
          <Alert className="mb-4">
            <AlertTriangle className="h-4 w-4" />
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        )}
        
        <div className="space-y-4">
          {jobs.map((job) => (
            <EnhancedJobCard 
              key={job.id} 
              job={job} 
              onClear={clearJob}
            />
          ))}
        </div>
      </CardContent>
    </Card>
  );
}