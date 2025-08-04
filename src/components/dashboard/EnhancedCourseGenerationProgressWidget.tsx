'use client';

import React, { useState, useEffect, useCallback, useRef } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '@/components/ui/accordion';
import { 
  Clock, 
  CheckCircle, 
  AlertCircle, 
  ExternalLink, 
  RefreshCw,
  Sparkles,
  BookOpen,
  X,
  ChevronDown,
  FileText,
  FlaskConical,
  HelpCircle,
  FileCheck,
  Calendar,
  Timer,
  BarChart3,
  Activity,
  AlertTriangle,
  XCircle,
  Trash2,
  RotateCcw
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { formatEstimatedTime } from '@/lib/utils/courseGenerationEstimator';
import Link from 'next/link';
import JSConfetti from 'js-confetti';
import { useProgressStream } from '@/hooks/use-progress-stream';
import { useCourseGenerationHealth } from '@/hooks/useCourseGenerationHealth';
import { toast } from 'sonner';

// --- Types ---
interface GenerationTask {
  id: string;
  type: 'lesson_section' | 'lesson_assessment' | 'path_quiz' | 'class_exam';
  status: 'pending' | 'running' | 'completed' | 'failed';
  sectionTitle?: string;
  error?: string;
}

interface GenerationJob {
  id: string;
  title: string;
  status: 'queued' | 'processing' | 'completed' | 'failed' | 'cancelled';
  progress?: number;
  baseClassId: string;
  createdAt: string;
  completedAt?: string;
  errorMessage?: string;
  tasks?: GenerationTask[];
  isCleared: boolean;
}

interface CourseGenerationProgressWidgetProps {
  userId: string;
  className?: string;
}

// --- Enhanced Job Progress Card with Health Monitoring ---
function EnhancedJobProgressCard({ 
  initialJob, 
  onDismiss 
}: { 
  initialJob: GenerationJob, 
  onDismiss: (jobId: string) => void 
}) {
  const [job, setJob] = useState(initialJob);
  const [showHealthDetails, setShowHealthDetails] = useState(false);
  const confettiRef = useRef<JSConfetti | null>(null);
  
  // Use progress stream for real-time updates
  const streamProgress = useProgressStream(job.id);
  
  // Use health monitoring for resilience
  const {
    health,
    needsAttention,
    isHealthy,
    canRecover,
    recommendedAction,
    userMessage,
    attemptRecovery,
    isRecovering,
    error: healthError
  } = useCourseGenerationHealth({
    jobId: job.id,
    enabled: job.status === 'processing',
    pollInterval: 30000, // Check every 30 seconds
    onHealthChange: (newHealth) => {
      // Show health details if there are issues
      if (['stalled', 'stuck', 'failed', 'abandoned'].includes(newHealth.status)) {
        setShowHealthDetails(true);
      }
    }
  });

  // Update job from stream progress
  useEffect(() => {
    if (streamProgress?.job) {
      setJob(streamProgress.job);
    }
  }, [streamProgress]);

  // Handle confetti for completion
  useEffect(() => {
    if (job.status === 'completed' && !confettiRef.current) {
      confettiRef.current = new JSConfetti();
      confettiRef.current.addConfetti({
        emojis: ['🎉', '📚', '✨', '🎓'],
        emojiSize: 50,
        confettiNumber: 30,
      });
    }
  }, [job.status]);

  const handleRecovery = async () => {
    try {
      const result = await attemptRecovery();
      if (result.success) {
        toast.success('Recovery initiated', {
          description: result.message
        });
        setShowHealthDetails(false);
      } else {
        toast.error('Recovery failed', {
          description: result.message
        });
      }
    } catch (error) {
      toast.error('Recovery failed', {
        description: error instanceof Error ? error.message : 'Unknown error occurred'
      });
    }
  };

  const handleRestart = async () => {
    try {
      const response = await fetch(`/api/knowledge-base/jobs/${job.id}/restart`, {
        method: 'POST'
      });
      
      if (response.ok) {
        toast.success('Job restart initiated');
        // Refresh the job data
        window.location.reload();
      } else {
        const data = await response.json();
        toast.error('Failed to restart job', {
          description: data.error || 'Unknown error'
        });
      }
    } catch (error) {
      toast.error('Failed to restart job', {
        description: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  };

  const handleDelete = async () => {
    if (!confirm('Are you sure you want to delete this generation job? This action cannot be undone.')) {
      return;
    }
    
    try {
      const response = await fetch(`/api/knowledge-base/jobs/${job.id}`, {
        method: 'DELETE'
      });
      
      if (response.ok) {
        toast.success('Job deleted successfully');
        onDismiss(job.id);
      } else {
        const data = await response.json();
        toast.error('Failed to delete job', {
          description: data.error || 'Unknown error'
        });
      }
    } catch (error) {
      toast.error('Failed to delete job', {
        description: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  };

  const failedTasks = job.tasks?.filter(t => t.status === 'failed') || [];
  const completedCount = job.tasks?.filter(t => t.status === 'completed').length || 0;
  const failedCount = failedTasks.length;
  const runningCount = job.tasks?.filter(t => t.status === 'running').length || 0;
  const totalCount = job.tasks?.length || 0;
  const finishedCount = completedCount + failedCount;
  const progressPercentage = totalCount > 0 ? Math.round((finishedCount / totalCount) * 100) : job.progress || 0;

  const getStatusIcon = () => {
    if (needsAttention) {
      switch (health?.status) {
        case 'stalled':
          return <Clock className="h-4 w-4 text-yellow-500" />;
        case 'stuck':
          return <AlertTriangle className="h-4 w-4 text-orange-500" />;
        case 'failed':
        case 'abandoned':
          return <XCircle className="h-4 w-4 text-red-500" />;
        default:
          return <AlertCircle className="h-4 w-4 text-yellow-500" />;
      }
    }

    switch (job.status) {
      case 'completed':
        return <CheckCircle className="h-4 w-4 text-green-500" />;
      case 'failed':
        return <XCircle className="h-4 w-4 text-red-500" />;
      case 'processing':
        return <Activity className="h-4 w-4 text-blue-500 animate-pulse" />;
      default:
        return <Clock className="h-4 w-4 text-gray-500" />;
    }
  };

  const getStatusBadge = () => {
    if (needsAttention) {
      const variant = health?.status === 'stalled' ? 'secondary' : 'destructive';
      return (
        <Badge variant={variant} className="ml-2">
          {health?.status || 'attention needed'}
        </Badge>
      );
    }

    const variant = job.status === 'completed' ? 'default' : 
                   job.status === 'failed' ? 'destructive' : 'secondary';
    return (
      <Badge variant={variant} className="ml-2">
        {job.status}
      </Badge>
    );
  };

  const getRecoveryActions = () => {
    if (!needsAttention || !canRecover) return null;

    return (
      <div className="mt-3 p-3 bg-yellow-50 border border-yellow-200 rounded-md">
        <div className="flex items-start justify-between">
          <div className="flex-1">
            <h4 className="text-sm font-medium text-yellow-800 mb-1">
              Action Required
            </h4>
            <p className="text-sm text-yellow-700 mb-2">
              {userMessage}
            </p>
          </div>
        </div>
        
        <div className="flex gap-2 mt-2">
          {recommendedAction === 'resume' && (
            <Button
              size="sm"
              onClick={handleRecovery}
              disabled={isRecovering}
              className="h-7 text-xs"
            >
              {isRecovering ? (
                <>
                  <RefreshCw className="mr-1 h-3 w-3 animate-spin" />
                  Resuming...
                </>
              ) : (
                <>
                  <RefreshCw className="mr-1 h-3 w-3" />
                  Resume
                </>
              )}
            </Button>
          )}
          
          {recommendedAction === 'restart' && (
            <>
              {canRecover && (
                <Button
                  size="sm"
                  onClick={handleRecovery}
                  disabled={isRecovering}
                  className="h-7 text-xs"
                >
                  {isRecovering ? (
                    <>
                      <RefreshCw className="mr-1 h-3 w-3 animate-spin" />
                      Recovering...
                    </>
                  ) : (
                    <>
                      <RefreshCw className="mr-1 h-3 w-3" />
                      Try Recovery
                    </>
                  )}
                </Button>
              )}
              <Button
                size="sm"
                variant="outline"
                onClick={handleRestart}
                className="h-7 text-xs"
              >
                <RotateCcw className="mr-1 h-3 w-3" />
                Restart
              </Button>
            </>
          )}
          
          {recommendedAction === 'delete_and_retry' && (
            <Button
              size="sm"
              variant="destructive"
              onClick={handleDelete}
              className="h-7 text-xs"
            >
              <Trash2 className="mr-1 h-3 w-3" />
              Delete & Retry
            </Button>
          )}
          
          <Button
            size="sm"
            variant="ghost"
            onClick={() => setShowHealthDetails(!showHealthDetails)}
            className="h-7 text-xs"
          >
            {showHealthDetails ? 'Hide Details' : 'Show Details'}
          </Button>
        </div>
      </div>
    );
  };

  return (
    <div className="border rounded-lg overflow-hidden">
      <Accordion type="single" collapsible className="w-full">
        <AccordionItem value="job" className="border-none">
          <AccordionTrigger className="px-4 py-3 hover:no-underline">
            <div className="flex items-center justify-between w-full mr-4">
              <div className="flex items-center gap-3 flex-1 min-w-0">
                {getStatusIcon()}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1">
                    <h3 className="font-medium text-sm truncate">{job.title}</h3>
                    {getStatusBadge()}
                  </div>
                  
                  {/* Status Message */}
                  {job.status === 'processing' ? (
                    (() => {
                      // Show health message if there are issues, otherwise show progress
                      if (needsAttention && userMessage) {
                        return (
                          <div className="flex items-center gap-2">
                            <AlertTriangle className="h-3 w-3 text-yellow-500" />
                            <p className="text-xs text-yellow-600 font-medium truncate">{userMessage}</p>
                          </div>
                        );
                      } else if (streamProgress?.liveMessage?.message) {
                        return (
                          <div className="space-y-1">
                            <div className="flex items-center gap-2">
                              <Activity className="h-3 w-3 text-blue-500 animate-pulse" />
                              <p className="text-xs text-blue-600 font-medium truncate">{streamProgress.liveMessage.message}</p>
                            </div>
                            {totalCount > 0 && (
                              <div className="flex items-center gap-2 text-xs text-muted-foreground">
                                <span>{finishedCount}/{totalCount} tasks completed</span>
                                <span>•</span>
                                <span>{progressPercentage}% done</span>
                                {runningCount > 0 && <span>• {runningCount} running</span>}
                              </div>
                            )}
                          </div>
                        );
                      } else if (totalCount > 0) {
                        return (
                          <div className="flex items-center gap-2 text-xs text-muted-foreground">
                            <span>{finishedCount}/{totalCount} tasks completed</span>
                            <span>•</span>
                            <span>{progressPercentage}% done</span>
                            {runningCount > 0 && <span>• {runningCount} running</span>}
                          </div>
                        );
                      } else {
                        return (
                          <p className="text-xs text-muted-foreground">Setting up generation tasks...</p>
                        );
                      }
                    })()
                  ) : job.status === 'failed' ? (
                    <p className="text-xs text-red-600">
                      {job.errorMessage || 'Generation failed'}
                    </p>
                  ) : job.status === 'completed' ? (
                    <p className="text-xs text-green-600">Generation completed successfully</p>
                  ) : (
                    <p className="text-xs text-muted-foreground">
                      {job.status === 'queued' ? 'Queued for generation' : 'Processing...'}
                    </p>
                  )}
                </div>
              </div>
              
              <Button
                variant="ghost"
                size="sm"
                onClick={(e) => {
                  e.stopPropagation();
                  onDismiss(job.id);
                }}
                className="h-6 w-6 p-0 ml-2"
              >
                <X className="h-3 w-3" />
              </Button>
            </div>
          </AccordionTrigger>
          
          <AccordionContent className="px-4 pb-4">
            {/* Progress Bar */}
            {job.status !== 'completed' && job.status !== 'failed' && (
              <div className="mb-4">
                <Progress value={health?.progressPercentage || progressPercentage} className="h-2" />
              </div>
            )}
            
            {/* Recovery Actions */}
            {getRecoveryActions()}
            
            {/* Health Details */}
            {showHealthDetails && health && (
              <div className="mt-3 p-3 bg-gray-50 border border-gray-200 rounded-md">
                <h4 className="font-semibold text-sm mb-2">Health Details</h4>
                <div className="grid grid-cols-2 gap-2 text-xs">
                  <div>
                    <span className="font-medium">Status:</span> {health.status}
                  </div>
                  <div>
                    <span className="font-medium">Progress:</span> {health.progressPercentage}%
                  </div>
                  <div>
                    <span className="font-medium">Running Tasks:</span> {health.runningTasks}
                  </div>
                  <div>
                    <span className="font-medium">Pending Tasks:</span> {health.pendingTasks}
                  </div>
                  <div>
                    <span className="font-medium">Failed Tasks:</span> {health.failedTasks}
                  </div>
                  <div>
                    <span className="font-medium">Recovery Attempts:</span> {health.recoveryAttempts}/{health.maxRecoveryAttempts}
                  </div>
                </div>
                {health.errorDetails && (
                  <div className="mt-2">
                    <span className="font-medium text-xs">Error Details:</span>
                    <p className="text-xs text-gray-600 mt-1">{health.errorDetails}</p>
                  </div>
                )}
                <div className="mt-2">
                  <span className="font-medium text-xs">Last Activity:</span>
                  <p className="text-xs text-gray-600">{health.lastActivity.toLocaleString()}</p>
                </div>
              </div>
            )}
            
            {/* Error Display */}
            {(healthError || failedTasks.length > 0) && (
              <div className="mt-3">
                {healthError && (
                  <Alert variant="destructive" className="mb-2">
                    <AlertCircle className="h-4 w-4" />
                    <AlertTitle>Health Check Error</AlertTitle>
                    <AlertDescription>{healthError}</AlertDescription>
                  </Alert>
                )}
                
                {failedTasks.length > 0 && (
                  <div className='text-xs text-red-500 flex items-center gap-1'>
                    <AlertCircle className='h-3 w-3'/>
                    {failedTasks.length} item(s) failed to generate.
                  </div>
                )}
              </div>
            )}

            {/* Success Actions */}
            {job.status === 'completed' && !failedTasks.length && (
              <div className='text-xs text-green-500 flex items-center gap-1 mt-3'>
                <CheckCircle className='h-3 w-3'/>
                Course generated successfully.
                <Link 
                  href={`/teach/base-classes/${job.baseClassId}`}
                  className="ml-2 inline-flex items-center gap-1 text-xs bg-primary text-primary-foreground hover:bg-primary/90 px-2 py-1 rounded-md transition-colors"
                >
                  <BookOpen className="h-3 w-3" />
                  View Course
                </Link>
              </div>
            )}
          </AccordionContent>
        </AccordionItem>
      </Accordion>
    </div>
  );
}

// --- Main Enhanced Widget Component ---
export default function EnhancedCourseGenerationProgressWidget({ 
  userId, 
  className 
}: CourseGenerationProgressWidgetProps) {
  const [jobs, setJobs] = useState<GenerationJob[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchJobs = useCallback(async () => {
    setIsLoading(true);
    try {
      const response = await fetch('/api/knowledge-base/generation-jobs');
      if (!response.ok) throw new Error('Failed to fetch generation jobs');
      
      const data = await response.json();
      if (data.success) {
        setJobs(data.jobs || []);
        setError(null);
      } else {
        setError(data.error || 'Failed to load generation jobs');
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load generation jobs');
    } finally {
      setIsLoading(false);
    }
  }, []);

  const dismissJob = useCallback(async (jobId: string) => {
    // This is optimistic UI. The job is removed from state immediately.
    setJobs(prev => prev.filter(job => job.id !== jobId));
    try {
      await fetch(`/api/knowledge-base/generation-jobs/${jobId}/dismiss`, { method: 'POST' });
    } catch (err) {
      console.error('Failed to dismiss job:', err);
      // If the API call fails, we might want to add the job back or show an error.
      // For now, we'll just log it.
    }
  }, []);

  useEffect(() => {
    fetchJobs();
    const interval = setInterval(fetchJobs, 30000); // Refresh the list of jobs every 30 seconds
    return () => clearInterval(interval);
  }, [fetchJobs]);
  
  const visibleJobs = jobs.filter(job => !job.isCleared);

  if (isLoading) return null;
  if (visibleJobs.length === 0) return null;

  return (
    <Card className={cn("w-full", className)}>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <div className="flex-1">
            <CardTitle className="text-lg font-semibold flex items-center gap-2">
              <Sparkles className="h-5 w-5 text-primary" />
              Course Generation Progress
            </CardTitle>
             <p className="text-sm text-muted-foreground mt-1">
              Your courses are being generated. Track progress and resolve issues here.
            </p>
          </div>
          <Button variant="ghost" size="sm" onClick={fetchJobs} disabled={isLoading} className="h-8 w-8 p-0">
            <RefreshCw className={cn("h-4 w-4", isLoading && "animate-spin")} />
          </Button>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {error && (
          <Alert variant="destructive">
             <AlertCircle className="h-4 w-4" />
             <AlertTitle>Error</AlertTitle>
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        )}

        {visibleJobs.map((job) => (
          <EnhancedJobProgressCard key={job.id} initialJob={job} onDismiss={dismissJob} />
        ))}
      </CardContent>
    </Card>
  );
}