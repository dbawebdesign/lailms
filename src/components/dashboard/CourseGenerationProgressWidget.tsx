'use client';

import React, { useState, useEffect, useCallback } from 'react';
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
  FileCheck
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { formatEstimatedTime } from '@/lib/utils/courseGenerationEstimator';
import Link from 'next/link';

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

// --- Sub-component for a single Job ---

function JobProgressCard({ initialJob, onDismiss }: { initialJob: GenerationJob, onDismiss: (jobId: string) => void }) {
  const [job, setJob] = useState(initialJob);
  const [isPolling, setIsPolling] = useState(false);
  const [isRetrying, setIsRetrying] = useState<string | null>(null);

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
                </div>
              )}
            </div>
          </AccordionTrigger>
          <AccordionContent className="px-4 pb-4">
            {job.tasks && job.tasks.length > 0 ? (
              <div className="space-y-2 max-h-60 overflow-y-auto pr-2">
                {job.tasks.map(task => (
                  <div key={task.id} className="text-xs p-2 rounded-md bg-background">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        {getStatusIcon(task.status)}
                        {getTaskIcon(task.type)}
                        <span className="font-medium">{task.sectionTitle || task.type.replace('_', ' ')}</span>
                      </div>
                      {task.status === 'failed' && (
                        <Button size="sm" variant="outline" onClick={() => handleRegenerateTask(task.id)} disabled={isRetrying === task.id}>
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
            ) : (
              <p className='text-xs text-muted-foreground'>No detailed task information available.</p>
            )}
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