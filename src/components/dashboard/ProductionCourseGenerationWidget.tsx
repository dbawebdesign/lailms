/**
 * Production-Ready Course Generation Widget
 * 
 * This component implements all production best practices:
 * - Efficient realtime subscriptions
 * - Proper error handling and recovery
 * - Memory leak prevention
 * - User-friendly progress display
 * - Health monitoring and recovery actions
 */

'use client';

import React, { useCallback, useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '@/components/ui/accordion';
import { 
  BookOpen, 
  RefreshCw, 
  Clock, 
  CheckCircle, 
  XCircle, 
  AlertTriangle,
  X,
  Play,
  Pause,
  RotateCcw
} from 'lucide-react';

import { useProductionRealtimeUserJobs, CourseGenerationJob } from '@/hooks/useProductionRealtimeUserJobs';
import { ConnectionState } from '@/lib/realtime/RealtimeConnectionManager';

interface ProductionCourseGenerationWidgetProps {
  userId: string;
  className?: string;
  initialJobs?: CourseGenerationJob[];
}

interface JobCardProps {
  job: CourseGenerationJob;
  onClearJob: (jobId: string) => Promise<void>;
  onRecoveryAction: (jobId: string, action: 'resume' | 'restart' | 'delete') => Promise<void>;
}

/**
 * Individual job card with health monitoring and recovery options
 */
function JobCard({ job, onClearJob, onRecoveryAction }: JobCardProps) {
  // Determine if job needs attention based on status and timing
  const needsAttention = useMemo(() => {
    if (job.status === 'failed') return true;
    if (job.status === 'processing') {
      const lastUpdate = new Date(job.updated_at);
      const now = new Date();
      const minutesSinceUpdate = (now.getTime() - lastUpdate.getTime()) / (1000 * 60);
      return minutesSinceUpdate > 5; // No update for 5+ minutes
    }
    return false;
  }, [job.status, job.updated_at]);

  // Get status display info
  const statusInfo = useMemo(() => {
    switch (job.status) {
      case 'pending':
        return { icon: Clock, color: 'text-yellow-600', bg: 'bg-yellow-100', label: 'Pending' };
      case 'processing':
        return { icon: Play, color: 'text-blue-600', bg: 'bg-blue-100', label: 'Processing' };
      case 'completed':
        return { icon: CheckCircle, color: 'text-green-600', bg: 'bg-green-100', label: 'Completed' };
      case 'failed':
        return { icon: XCircle, color: 'text-red-600', bg: 'bg-red-100', label: 'Failed' };
      case 'cancelled':
        return { icon: Pause, color: 'text-gray-600', bg: 'bg-gray-100', label: 'Cancelled' };
      default:
        return { icon: AlertTriangle, color: 'text-gray-600', bg: 'bg-gray-100', label: 'Unknown' };
    }
  }, [job.status]);

  // Get recommended recovery action
  const getRecommendedAction = useCallback(() => {
    if (job.status === 'failed') return 'restart';
    if (needsAttention && job.status === 'processing') return 'resume';
    return null;
  }, [job.status, needsAttention]);

  const handleRecoveryAction = useCallback(async (action: 'resume' | 'restart' | 'delete') => {
    try {
      await onRecoveryAction(job.id, action);
    } catch (error) {
      console.error(`Failed to ${action} job:`, error);
    }
  }, [job.id, onRecoveryAction]);

  const handleClearJob = useCallback(async () => {
    try {
      await onClearJob(job.id);
    } catch (error) {
      console.error('Failed to clear job:', error);
    }
  }, [job.id, onClearJob]);

  const StatusIcon = statusInfo.icon;
  const recommendedAction = getRecommendedAction();

  return (
    <div className="border rounded-lg p-4 space-y-3">
      {/* Job title - always show if available */}
      <h4 className="font-medium text-sm text-gray-900 dark:text-gray-100 truncate">
        {job.job_data?.title || 'Course Generation Job'}
      </h4>
      
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <StatusIcon className={`h-4 w-4 ${statusInfo.color}`} />
          <Badge variant="secondary" className={`${statusInfo.bg} ${statusInfo.color}`}>
            {statusInfo.label}
          </Badge>
          {needsAttention && (
            <Badge variant="destructive" className="text-xs">
              Needs Attention
            </Badge>
          )}
        </div>
        
        {job.status === 'completed' && (
          <button
            onClick={handleClearJob}
            className="text-gray-400 hover:text-gray-600 transition-colors"
            title="Clear this job"
          >
            <X className="h-4 w-4" />
          </button>
        )}
      </div>

      {/* Progress bar for active jobs */}
      {(job.status === 'processing' || job.status === 'pending') && (
        <div className="space-y-1">
          <div className="flex justify-between text-sm">
            <span>Progress</span>
            <span>{job.progress_percentage || 0}%</span>
          </div>
          <Progress value={job.progress_percentage || 0} className="h-2" />
        </div>
      )}

      {/* Current task info derived from available data */}
      {job.status === 'processing' && (
        <div className="text-sm text-gray-600">
          <span className="font-medium">Status:</span> {
            job.total_tasks && job.completed_tasks !== undefined && job.total_tasks > 0
              ? `Processing (${Math.min(job.completed_tasks, job.total_tasks)}/${job.total_tasks} tasks completed)`
              : job.progress_percentage 
                ? `Processing (${job.progress_percentage}% complete)`
                : 'Processing course generation...'
          }
        </div>
      )}

      {/* Error message */}
      {job.error_message && (
        <Alert variant="destructive">
          <AlertTriangle className="h-4 w-4" />
          <AlertDescription className="text-sm">
            {job.error_message}
          </AlertDescription>
        </Alert>
      )}

      {/* Recovery actions */}
      {(needsAttention || job.status === 'failed') && (
        <div className="flex gap-2 pt-2 border-t">
          {recommendedAction === 'resume' && (
            <Button
              size="sm"
              variant="outline"
              onClick={() => handleRecoveryAction('resume')}
              className="text-xs"
            >
              <Play className="h-3 w-3 mr-1" />
              Resume
            </Button>
          )}
          
          {(job.status === 'failed' || recommendedAction === 'restart') && (
            <Button
              size="sm"
              variant="outline"
              onClick={() => handleRecoveryAction('restart')}
              className="text-xs"
            >
              <RotateCcw className="h-3 w-3 mr-1" />
              Restart
            </Button>
          )}
          
          <Button
            size="sm"
            variant="outline"
            onClick={() => handleRecoveryAction('delete')}
            className="text-xs text-red-600 hover:text-red-700"
          >
            <X className="h-3 w-3 mr-1" />
            Delete
          </Button>
        </div>
      )}

      {/* Job metadata */}
      <div className="text-xs text-gray-500 space-y-1">
        <div>Created: {new Date(job.created_at).toLocaleString()}</div>
        <div>Updated: {new Date(job.updated_at).toLocaleString()}</div>
      </div>
    </div>
  );
}

/**
 * Main production course generation widget
 */
export default function ProductionCourseGenerationWidget({ 
  userId, 
  className,
  initialJobs = []
}: ProductionCourseGenerationWidgetProps) {
  
  const {
    jobs,
    isLoading,
    error,
    connectionState,
    retryCount,
    activeJobs,
    completedJobs,
    failedJobs,
    isConnected,
    hasError,
    retryConnection,
    refreshJobs,
    clearJob
  } = useProductionRealtimeUserJobs({
    userId,
    enabled: true,
    includeCleared: false,
    initialJobs,
    onError: (error) => {
      console.error('Production widget error:', error);
    }
  });

  // Handle recovery actions
  const handleRecoveryAction = useCallback(async (jobId: string, action: 'resume' | 'restart' | 'delete') => {
    try {
      let response;
      if (action === 'resume') {
        response = await fetch(`/api/knowledge-base/jobs/${jobId}/resume`, { method: 'POST' });
      } else if (action === 'restart') {
        response = await fetch(`/api/knowledge-base/jobs/${jobId}/restart`, { method: 'POST' });
      } else if (action === 'delete') {
        response = await fetch(`/api/knowledge-base/jobs/${jobId}`, { method: 'DELETE' });
      }

      if (!response?.ok) {
        const errorData = await response?.json();
        throw new Error(errorData?.error || `Failed to ${action} job`);
      }

      console.log(`✅ Job ${action} initiated successfully`);
    } catch (error: any) {
      console.error(`Failed to ${action} job:`, error);
      throw error;
    }
  }, []);

  // Connection status display
  const connectionStatus = useMemo(() => {
    switch (connectionState) {
      case ConnectionState.CONNECTED:
        return { text: 'Connected', color: 'text-green-600' };
      case ConnectionState.CONNECTING:
        return { text: 'Connecting...', color: 'text-yellow-600' };
      case ConnectionState.RECONNECTING:
        return { text: 'Reconnecting...', color: 'text-yellow-600' };
      case ConnectionState.ERROR:
        return { text: 'Connection Error', color: 'text-red-600' };
      default:
        return { text: 'Disconnected', color: 'text-gray-600' };
    }
  }, [connectionState]);

  if (isLoading) {
    return (
      <Card className={className}>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <BookOpen className="h-5 w-5" />
            Course Generation Progress
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex items-center gap-2">
            <RefreshCw className="h-4 w-4 animate-spin" />
            <span>Loading course generation data...</span>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className={className}>
      <CardHeader>
        <CardTitle className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <BookOpen className="h-5 w-5" />
            Course Generation Progress
            {jobs.length > 0 && (
              <Badge variant="secondary" className="ml-2">
                {jobs.length}
              </Badge>
            )}
          </div>
          
          <div className="flex items-center gap-2">
            <span className={`text-xs ${connectionStatus.color}`}>
              {connectionStatus.text}
            </span>
            <Button 
              variant="ghost" 
              size="sm" 
              onClick={refreshJobs}
              disabled={isLoading}
            >
              <RefreshCw className={`h-4 w-4 ${isLoading ? 'animate-spin' : ''}`} />
            </Button>
          </div>
        </CardTitle>
        <p className="text-sm text-muted-foreground">
          Your courses are being generated. Track progress and resolve issues here.
        </p>
      </CardHeader>
      
      <CardContent>
        {/* Connection error */}
        {hasError && (
          <Alert className="mb-4">
            <AlertTriangle className="h-4 w-4" />
            <AlertDescription className="flex items-center justify-between">
              <span>{error || 'Connection issues detected'}</span>
              <Button size="sm" variant="outline" onClick={retryConnection}>
                Retry {retryCount > 0 && `(${retryCount})`}
              </Button>
            </AlertDescription>
          </Alert>
        )}

        {/* No jobs */}
        {jobs.length === 0 && !isLoading && (
          <div className="text-center py-8 text-gray-500">
            <BookOpen className="h-12 w-12 mx-auto mb-4 opacity-50" />
            <p>No course generation jobs found.</p>
            <p className="text-sm">Start creating a course to see progress here.</p>
          </div>
        )}

        {/* Jobs list */}
        {jobs.length > 0 && (
          <div className="space-y-4">
            {/* Active jobs (always visible) */}
            {activeJobs.map((job) => (
              <JobCard
                key={job.id}
                job={job}
                onClearJob={clearJob}
                onRecoveryAction={handleRecoveryAction}
              />
            ))}

            {/* Completed/Failed jobs (collapsible) */}
            {(completedJobs.length > 0 || failedJobs.length > 0) && (
              <Accordion type="single" collapsible className="w-full">
                {completedJobs.length > 0 && (
                  <AccordionItem value="completed">
                    <AccordionTrigger className="text-sm">
                      <div className="flex items-center gap-2">
                        <CheckCircle className="h-4 w-4 text-green-600" />
                        Completed Jobs ({completedJobs.length})
                      </div>
                    </AccordionTrigger>
                    <AccordionContent>
                      <div className="space-y-3 pt-2">
                        {completedJobs.map((job) => (
                          <JobCard
                            key={job.id}
                            job={job}
                            onClearJob={clearJob}
                            onRecoveryAction={handleRecoveryAction}
                          />
                        ))}
                      </div>
                    </AccordionContent>
                  </AccordionItem>
                )}

                {failedJobs.length > 0 && (
                  <AccordionItem value="failed">
                    <AccordionTrigger className="text-sm">
                      <div className="flex items-center gap-2">
                        <XCircle className="h-4 w-4 text-red-600" />
                        Failed Jobs ({failedJobs.length})
                      </div>
                    </AccordionTrigger>
                    <AccordionContent>
                      <div className="space-y-3 pt-2">
                        {failedJobs.map((job) => (
                          <JobCard
                            key={job.id}
                            job={job}
                            onClearJob={clearJob}
                            onRecoveryAction={handleRecoveryAction}
                          />
                        ))}
                      </div>
                    </AccordionContent>
                  </AccordionItem>
                )}
              </Accordion>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}