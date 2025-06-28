'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { 
  Clock, 
  CheckCircle, 
  AlertCircle, 
  ExternalLink, 
  RefreshCw,
  Sparkles,
  BookOpen,
  X
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { formatEstimatedTime } from '@/lib/utils/courseGenerationEstimator';
import Link from 'next/link';

interface GenerationJob {
  id: string;
  status: 'queued' | 'processing' | 'completed' | 'failed';
  progress: number;
  baseClassId: string;
  baseClassName: string;
  title: string;
  error?: string;
  result?: {
    courseOutlineId?: string;
    message?: string;
    stats?: {
      modules: number;
      totalLessons: number;
      totalSections: number;
    };
  };
  createdAt: string;
  updatedAt: string;
  estimatedMinutes?: number;
  isCleared?: boolean;
}

interface CourseGenerationProgressWidgetProps {
  userId: string;
  className?: string;
}

export default function CourseGenerationProgressWidget({ 
  userId, 
  className 
}: CourseGenerationProgressWidgetProps) {
  const [jobs, setJobs] = useState<GenerationJob[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isRefreshing, setIsRefreshing] = useState(false);

  const fetchJobs = useCallback(async () => {
    try {
      const response = await fetch('/api/knowledge-base/generation-jobs');
      if (!response.ok) {
        throw new Error('Failed to fetch generation jobs');
      }
      
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
      setIsRefreshing(false);
    }
  }, []);

  const dismissJob = useCallback(async (jobId: string) => {
    try {
      await fetch(`/api/knowledge-base/generation-jobs/${jobId}/dismiss`, {
        method: 'POST'
      });
      setJobs(prev => prev.filter(job => job.id !== jobId));
    } catch (err) {
      console.error('Failed to dismiss job:', err);
    }
  }, []);

  const refreshJobs = useCallback(async () => {
    setIsRefreshing(true);
    await fetchJobs();
  }, [fetchJobs]);

  useEffect(() => {
    fetchJobs();
  }, [fetchJobs]);

  // Poll for updates on active jobs
  useEffect(() => {
    const activeJobs = jobs.filter(job => 
      job.status === 'queued' || job.status === 'processing'
    );

    if (activeJobs.length === 0) return;

    const interval = setInterval(() => {
      fetchJobs();
    }, 3000); // Poll every 3 seconds

    return () => clearInterval(interval);
  }, [jobs, fetchJobs]);

  // Don't show widget if no jobs
  const visibleJobs = jobs.filter(job => !job.isCleared);

  if (isLoading) {
    return null; // Don't show loading state for this widget
  }

  if (visibleJobs.length === 0) {
    return null; // Don't show widget if no active jobs
  }

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'completed':
        return <CheckCircle className="h-4 w-4 text-green-500" />;
      case 'failed':
        return <AlertCircle className="h-4 w-4 text-red-500" />;
      case 'processing':
      case 'queued':
        return <Clock className="h-4 w-4 text-blue-500" />;
      default:
        return <Clock className="h-4 w-4 text-gray-500" />;
    }
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'completed':
        return <Badge className="bg-green-100 text-green-800 border-green-200">Completed</Badge>;
      case 'failed':
        return <Badge className="bg-red-100 text-red-800 border-red-200">Failed</Badge>;
      case 'processing':
        return <Badge className="bg-blue-100 text-blue-800 border-blue-200">Processing</Badge>;
      case 'queued':
        return <Badge className="bg-yellow-100 text-yellow-800 border-yellow-200">Queued</Badge>;
      default:
        return <Badge variant="outline">{status}</Badge>;
    }
  };

  const getProgressMessage = (job: GenerationJob) => {
    if (job.status === 'completed') {
      return job.result?.message || 'Course generation completed successfully! Your course is ready to view.';
    }
    
    if (job.status === 'failed') {
      return job.error || 'Course generation failed';
    }

    if (job.status === 'queued') {
      return 'Waiting to start... Feel free to continue with other tasks while this processes.';
    }

    // Processing status messages based on progress
    const progress = job.progress || 0;
    if (progress < 20) return 'Analyzing knowledge base... You can continue working on other tasks.';
    if (progress < 50) return 'Generating course outline... This will continue in the background.';
    if (progress < 70) return 'Creating learning paths and lessons... Feel free to navigate away.';
    if (progress < 90) return 'Generating lesson content... Almost done! Check back here for updates.';
    return 'Creating assessments and quizzes... Nearly complete!';
  };

  const getEstimatedTimeRemaining = (job: GenerationJob) => {
    if (!job.estimatedMinutes || job.status !== 'processing') return null;
    
    const progress = Math.max(1, job.progress || 1);
    const remainingProgress = 100 - progress;
    // Apply the same 20% reduction and 30-minute cap to remaining time calculations
    const rawRemainingMinutes = (job.estimatedMinutes * remainingProgress) / 100;
    const remainingMinutes = Math.min(30, rawRemainingMinutes * 0.8); // 20% reduction + cap
    
    return formatEstimatedTime(remainingMinutes);
  };

  return (
    <Card className={cn("w-full", className)}>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <div className="flex-1">
            <CardTitle className="text-lg font-semibold flex items-center gap-2">
              <Sparkles className="h-5 w-5 text-primary" />
              Course Generation
            </CardTitle>
            <p className="text-sm text-muted-foreground mt-1">
              Your courses are being generated in the background. Continue working - we'll update you here!
            </p>
          </div>
          <Button
            variant="ghost"
            size="sm"
            onClick={refreshJobs}
            disabled={isRefreshing}
            className="h-8 w-8 p-0"
          >
            <RefreshCw className={cn("h-4 w-4", isRefreshing && "animate-spin")} />
          </Button>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {error && (
          <Alert variant="destructive">
            <AlertCircle className="h-4 w-4" />
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        )}

        {visibleJobs.map((job) => (
          <div
            key={job.id}
            className="border rounded-lg p-4 space-y-3 bg-card/50"
          >
            <div className="flex items-start justify-between">
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-1">
                  {getStatusIcon(job.status)}
                  <h4 className="font-medium text-sm truncate">{job.title}</h4>
                  {getStatusBadge(job.status)}
                </div>
                <p className="text-xs text-muted-foreground truncate">
                  {job.baseClassName}
                </p>
              </div>
              
              <Button
                variant="ghost"
                size="sm"
                onClick={() => dismissJob(job.id)}
                className="h-6 w-6 p-0 opacity-50 hover:opacity-100"
              >
                <X className="h-3 w-3" />
              </Button>
            </div>

            {(job.status === 'processing' || job.status === 'queued') && (
              <div className="space-y-2">
                <Progress value={job.progress || 0} className="h-2" />
                <div className="flex justify-between text-xs text-muted-foreground">
                  <span>{getProgressMessage(job)}</span>
                  <span>{job.progress || 0}%</span>
                </div>
                {getEstimatedTimeRemaining(job) && (
                  <p className="text-xs text-muted-foreground">
                    About {getEstimatedTimeRemaining(job)} remaining
                  </p>
                )}
              </div>
            )}

            {job.status === 'completed' && (
              <div className="space-y-3">
                <p className="text-sm text-green-700 dark:text-green-400">
                  {getProgressMessage(job)}
                </p>
                {job.result?.stats && (
                  <div className="flex gap-4 text-xs text-muted-foreground">
                    <span>{job.result.stats.modules} modules</span>
                    <span>{job.result.stats.totalLessons} lessons</span>
                    <span>{job.result.stats.totalSections} sections</span>
                  </div>
                )}
                <div>
                  <Link href={`/teach/base-classes/${job.baseClassId}`}>
                    <Button size="sm" className="text-xs h-7">
                      <BookOpen className="h-3 w-3 mr-1" />
                      View Course
                    </Button>
                  </Link>
                </div>
              </div>
            )}

            {job.status === 'failed' && (
              <div className="space-y-2">
                <p className="text-sm text-red-700 dark:text-red-400">
                  {getProgressMessage(job)}
                </p>
                <Link href={`/teach/knowledge-base/${job.baseClassId}`}>
                  <Button variant="outline" size="sm" className="text-xs h-7">
                    Try Again
                  </Button>
                </Link>
              </div>
            )}
          </div>
        ))}
      </CardContent>
    </Card>
  );
} 