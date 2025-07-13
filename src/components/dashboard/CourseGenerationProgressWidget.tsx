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
  BarChart3
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { formatEstimatedTime } from '@/lib/utils/courseGenerationEstimator';
import Link from 'next/link';
import JSConfetti from 'js-confetti';

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
  status: 'queued' | 'processing' | 'completed' | 'failed';
  progress: number;
  baseClassId: string;
  baseClassName: string;
  title: string;
  error?: string;
  tasks?: GenerationTask[];
  createdAt: string;
  updatedAt: string;
  isCleared?: boolean;
  confettiShown?: boolean;
}

interface CourseGenerationProgressWidgetProps {
  userId: string;
  className?: string;
}

// --- Helper Functions ---

const getStatusIcon = (status: string) => {
  switch (status) {
    case 'completed': return <CheckCircle className="h-4 w-4 text-green-500" />;
    case 'failed': return <AlertCircle className="h-4 w-4 text-red-500" />;
    case 'running': return <RefreshCw className="h-4 w-4 text-blue-500 animate-spin" />;
    case 'pending':
    case 'queued': return <Clock className="h-4 w-4 text-gray-500" />;
    default: return <Clock className="h-4 w-4 text-gray-500" />;
  }
};

const getTaskIcon = (type: GenerationTask['type']) => {
  switch (type) {
    case 'lesson_section': return <FileText className="h-4 w-4" />;
    case 'lesson_assessment': return <HelpCircle className="h-4 w-4" />;
    case 'path_quiz': return <FlaskConical className="h-4 w-4" />;
    case 'class_exam': return <FileCheck className="h-4 w-4" />;
    default: return <FileText className="h-4 w-4" />;
  }
};

const formatDuration = (startTime: string, endTime: string) => {
  const start = new Date(startTime);
  const end = new Date(endTime);
  const duration = end.getTime() - start.getTime();
  
  const minutes = Math.floor(duration / (1000 * 60));
  const seconds = Math.floor((duration % (1000 * 60)) / 1000);
  
  if (minutes > 0) {
    return `${minutes}m ${seconds}s`;
  }
  return `${seconds}s`;
};

const formatDurationFromMs = (durationMs: number) => {
  const minutes = Math.floor(durationMs / (1000 * 60));
  const seconds = Math.floor((durationMs % (1000 * 60)) / 1000);
  
  if (minutes > 0) {
    return `${minutes}m ${seconds}s`;
  }
  return `${seconds}s`;
};

const getTaskTypeLabel = (type: GenerationTask['type']) => {
  switch (type) {
    case 'lesson_section': return 'Lesson Section';
    case 'lesson_assessment': return 'Lesson Assessment';
    case 'path_quiz': return 'Path Quiz';
    case 'class_exam': return 'Class Exam';
  }
};

// --- Sub-component for a single Job ---

function JobProgressCard({ initialJob, onDismiss }: { initialJob: GenerationJob, onDismiss: (jobId: string) => void }) {
  const [job, setJob] = useState(initialJob);
  const [isPolling, setIsPolling] = useState(false);
  const [isRetrying, setIsRetrying] = useState<string | null>(null);
  const [hasTriggeredConfetti, setHasTriggeredConfetti] = useState(false);
  const [previousStatus, setPreviousStatus] = useState(initialJob.status);
  const jsConfettiRef = useRef<JSConfetti | null>(null);

  // Initialize confetti instance
  useEffect(() => {
    if (typeof window !== 'undefined') {
      jsConfettiRef.current = new JSConfetti();
    }
  }, []);

  // Trigger confetti on completion (only if not already shown in database)
  useEffect(() => {
    const shouldTriggerConfetti = (
      job.status === 'completed' && 
      !job.confettiShown && // Only trigger if not already shown in database
      !hasTriggeredConfetti && 
      jsConfettiRef.current &&
      // Trigger if status just changed to completed OR if it was already completed on load
      (previousStatus !== 'completed' || initialJob.status === 'completed')
    );

    if (shouldTriggerConfetti) {
      // Check if there are any failed tasks (only if tasks data is available)
      const failedTasksCount = job.tasks?.filter(t => t.status === 'failed').length || 0;
      
      // Trigger confetti if no failed tasks or if tasks data is not available (assume success)
      if (failedTasksCount === 0 && jsConfettiRef.current) {
        jsConfettiRef.current.addConfetti({
          emojis: ['🎉', '📚', '✨', '🎓', '📖'],
          emojiSize: 50,
          confettiNumber: 100,
        });
        setHasTriggeredConfetti(true);
        
        // Mark confetti as shown in database
        fetch(`/api/knowledge-base/generation-jobs/${job.id}/mark-confetti-shown`, {
          method: 'POST',
        }).catch(error => {
          console.error('Failed to mark confetti as shown:', error);
        });
      }
    }
    
    setPreviousStatus(job.status);
  }, [job.status, job.confettiShown, hasTriggeredConfetti, job.tasks, previousStatus, initialJob.status, job.id]);

  const pollStatus = useCallback(async () => {
    if (isPolling) return;
    setIsPolling(true);
    try {
      const response = await fetch(`/api/knowledge-base/generation-status/${job.id}`);
      if (response.ok) {
        const data = await response.json();
        if (data.success) {
          setJob(prevJob => ({ ...prevJob, ...data.job }));
        }
      }
    } catch (error) {
      console.error('Failed to poll job status:', error);
    } finally {
      setIsPolling(false);
    }
  }, [job.id, isPolling]);

  useEffect(() => {
    const isActive = job.status === 'queued' || job.status === 'processing';
    if (!isActive) return;

    const interval = setInterval(pollStatus, 5000); // Poll every 5 seconds
    return () => clearInterval(interval);
  }, [job.status, pollStatus]);

  const handleRegenerateTask = async (taskId: string) => {
    setIsRetrying(taskId);
    try {
      await fetch(`/api/knowledge-base/jobs/${job.id}/regenerate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ taskId }),
      });
      // Poll immediately after requesting retry
      await pollStatus(); 
    } catch (error) {
      console.error(`Failed to regenerate task ${taskId}:`, error);
    } finally {
      setIsRetrying(null);
    }
  };
  
  const failedTasks = job.tasks?.filter(t => t.status === 'failed') || [];
  const completedTasks = job.tasks?.filter(t => t.status === 'completed') || [];
  const totalTasks = job.tasks?.length || 0;

  // Try to get task summary from stored result_data first
  const storedSummary = (job as any).result?.taskSummary;
  
  // Generate summary data with fallbacks for completed jobs without task details
  const generationSummary = storedSummary ? {
    totalItems: storedSummary.totalItems,
    completedItems: storedSummary.completedItems,
    failedItems: storedSummary.failedItems,
    successRate: storedSummary.successRate,
    generationTime: storedSummary.generationTimeMs 
      ? formatDurationFromMs(storedSummary.generationTimeMs)
      : formatDuration(job.createdAt, job.updatedAt),
    startTime: new Date(job.createdAt).toLocaleString(),
    endTime: (job.status === 'completed' || job.status === 'failed') 
      ? new Date(job.updatedAt).toLocaleString() 
      : null,
    hasTaskDetails: storedSummary.hasTaskDetails,
    tasksByType: storedSummary.tasksByType
  } : {
    totalItems: totalTasks > 0 ? totalTasks : (job.status === 'completed' ? 'N/A' : 0),
    completedItems: totalTasks > 0 ? completedTasks.length : (job.status === 'completed' ? 'N/A' : 0),
    failedItems: totalTasks > 0 ? failedTasks.length : 0,
    successRate: totalTasks > 0 ? Math.round((completedTasks.length / totalTasks) * 100) : (job.status === 'completed' ? 100 : 0),
    generationTime: job.status === 'completed' || job.status === 'failed' 
      ? formatDuration(job.createdAt, job.updatedAt)
      : null,
    startTime: new Date(job.createdAt).toLocaleString(),
    endTime: (job.status === 'completed' || job.status === 'failed') 
      ? new Date(job.updatedAt).toLocaleString() 
      : null,
    hasTaskDetails: totalTasks > 0,
    tasksByType: undefined
  };

  return (
    <div className="border rounded-lg bg-card/50 relative">
       <Button
        variant="ghost"
        size="sm"
        onClick={() => onDismiss(job.id)}
        className="absolute top-2 right-2 h-6 w-6 p-0 opacity-50 hover:opacity-100 z-10"
      >
        <X className="h-3 w-3" />
      </Button>
      <Accordion type="single" collapsible className="w-full">
        <AccordionItem value={job.id} className="border-b-0">
          <AccordionTrigger className="p-4 pr-10 hover:no-underline">
            <div className="w-full space-y-3">
              <div className="flex items-start justify-between">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1">
                    {getStatusIcon(job.status)}
                    <h4 className="font-medium text-sm truncate">{job.title}</h4>
                    <Badge variant={job.status === 'failed' ? 'destructive' : 'outline'}>{job.status}</Badge>
                  </div>
                   <p className="text-xs text-muted-foreground truncate">{job.baseClassName}</p>
                </div>
              </div>
              
              {job.status !== 'completed' && job.status !== 'failed' && <Progress value={job.progress} className="h-2" />}
              
              {failedTasks.length > 0 && (
                <div className='text-xs text-red-500 flex items-center gap-1'>
                  <AlertCircle className='h-3 w-3'/>
                  {failedTasks.length} item(s) failed to generate.
                </div>
              )}

              {job.status === 'completed' && !failedTasks.length && (
                 <div className='text-xs text-green-500 flex items-center gap-1'>
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
            </div>
          </AccordionTrigger>
          <AccordionContent className="px-4 pb-4">
            <div className="space-y-4">
              {/* Generation Summary */}
              {(job.status === 'completed' || job.status === 'failed') && (
                <div className="bg-background/50 rounded-lg p-4 space-y-3">
                  <h5 className="font-medium text-sm flex items-center gap-2">
                    <BarChart3 className="h-4 w-4" />
                    Generation Summary
                  </h5>
                  <div className="grid grid-cols-2 gap-4 text-xs">
                    <div className="space-y-2">
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">Total Items:</span>
                        <span className="font-medium">{generationSummary.totalItems}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">Completed:</span>
                        <span className="font-medium text-green-600">{generationSummary.completedItems}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">Failed:</span>
                        <span className="font-medium text-red-600">{generationSummary.failedItems}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">Success Rate:</span>
                        <span className="font-medium">{generationSummary.successRate}%</span>
                      </div>
                    </div>
                    <div className="space-y-2">
                      <div className="flex justify-between">
                        <span className="text-muted-foreground flex items-center gap-1">
                          <Calendar className="h-3 w-3" />
                          Started:
                        </span>
                        <span className="font-medium text-right text-xs">{generationSummary.startTime}</span>
                      </div>
                      {generationSummary.endTime && (
                        <div className="flex justify-between">
                          <span className="text-muted-foreground flex items-center gap-1">
                            <Calendar className="h-3 w-3" />
                            Completed:
                          </span>
                          <span className="font-medium text-right text-xs">{generationSummary.endTime}</span>
                        </div>
                      )}
                      {generationSummary.generationTime && (
                        <div className="flex justify-between">
                          <span className="text-muted-foreground flex items-center gap-1">
                            <Timer className="h-3 w-3" />
                            Duration:
                          </span>
                          <span className="font-medium">{generationSummary.generationTime}</span>
                        </div>
                      )}
                    </div>
                  </div>
                  {!generationSummary.hasTaskDetails && (
                    <div className="mt-2 p-2 bg-blue-50 dark:bg-blue-950/20 border border-blue-200 dark:border-blue-800 rounded text-xs">
                      <p className="text-blue-700 dark:text-blue-300">
                        <strong>Note:</strong> Detailed task breakdown is not available for this completed generation. 
                        The course was successfully created and is ready to use.
                      </p>
                    </div>
                  )}
                </div>
              )}

              {/* Task Details */}
              {job.tasks && job.tasks.length > 0 ? (
                <div className="space-y-2">
                  <h5 className="font-medium text-sm flex items-center gap-2">
                    <FileText className="h-4 w-4" />
                    Task Details
                  </h5>
                  <div className="space-y-2 max-h-60 overflow-y-auto pr-2">
                    {job.tasks.map(task => (
                      <div key={task.id} className="text-xs p-2 rounded-md bg-background">
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-2">
                            {getStatusIcon(task.status)}
                            {getTaskIcon(task.type)}
                            <span className="font-medium">{task.sectionTitle || getTaskTypeLabel(task.type)}</span>
                            <Badge variant="outline" className="text-xs px-1 py-0">
                              {getTaskTypeLabel(task.type)}
                            </Badge>
                          </div>
                          {task.status === 'failed' && (
                            <Button size="sm" variant="outline" onClick={(e) => {
                              e.stopPropagation();
                              handleRegenerateTask(task.id);
                            }} disabled={isRetrying === task.id}>
                               {isRetrying === task.id ? <RefreshCw className="h-3 w-3 animate-spin"/> : 'Retry'}
                            </Button>
                          )}
                        </div>
                        {task.status === 'failed' && task.error && (
                          <p className="mt-1 pl-8 text-red-600">{task.error}</p>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              ) : (
                <p className='text-xs text-muted-foreground'>No detailed task information available.</p>
              )}
            </div>
          </AccordionContent>
        </AccordionItem>
      </Accordion>
    </div>
  );
}

// --- Main Widget Component ---

export default function CourseGenerationProgressWidget({ 
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
          <JobProgressCard key={job.id} initialJob={job} onDismiss={dismissJob} />
        ))}
      </CardContent>
    </Card>
  );
} 