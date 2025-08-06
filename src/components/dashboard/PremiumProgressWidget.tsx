'use client';

import React, { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useRouter } from 'next/navigation';
import { cn } from '@/lib/utils';
import { 
  CheckCircle2, 
  Circle, 
  AlertCircle, 
  Sparkles,
  ArrowRight,
  Clock,
  Zap,
  BookOpen,
  Brain,
  FileText,
  HelpCircle,
  X
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import JSConfetti from 'js-confetti';
import { toast } from 'sonner';

interface GenerationJob {
  id: string;
  status: 'queued' | 'processing' | 'completed' | 'failed';
  progress: number;
  baseClassId: string;
  baseClassName: string;
  title: string;
  error?: string;
  createdAt: string;
  updatedAt: string;
  total_tasks?: number;
  completed_tasks?: number;
  failed_tasks?: number;
  current_phase?: string;
  pending_tasks?: number;
  running_tasks?: number;
}

interface PremiumProgressWidgetProps {
  userId: string;
  className?: string;
}

export default function PremiumProgressWidget({ userId, className }: PremiumProgressWidgetProps) {
  const router = useRouter();
  const [jobs, setJobs] = useState<GenerationJob[]>([]);
  const [loading, setLoading] = useState(true);
  const confettiRef = useRef<JSConfetti | null>(null);

  // Fetch active jobs
  const fetchJobs = async () => {
    try {
      const response = await fetch('/api/course-generation/active-jobs');
      const data = await response.json();
      
      if (data.success) {
        // Process jobs to check for effective completion
        const processedJobs = data.jobs.map((job: GenerationJob) => {
          // Check if job is effectively complete (all tasks either completed or failed)
          if (job.status === 'processing' && job.total_tasks) {
            const completedAndFailed = (job.completed_tasks || 0) + (job.failed_tasks || 0);
            const pendingAndRunning = (job.pending_tasks || 0) + (job.running_tasks || 0);
            
            // If all tasks are done (completed or failed) and no tasks are pending/running
            if (completedAndFailed >= job.total_tasks && pendingAndRunning === 0) {
              // Mark as completed if majority succeeded, or failed if majority failed
              const successRate = (job.completed_tasks || 0) / job.total_tasks;
              return {
                ...job,
                status: successRate >= 0.7 ? 'completed' : 'failed',
                effectivelyComplete: true,
                successRate
              };
            }
          }
          return job;
        });
        
        setJobs(processedJobs);
        
        // Check for completed jobs to trigger confetti
        processedJobs.forEach((job: GenerationJob & { effectivelyComplete?: boolean }) => {
          if (job.status === 'completed' && !sessionStorage.getItem(`confetti-${job.id}`)) {
            triggerConfetti();
            sessionStorage.setItem(`confetti-${job.id}`, 'true');
            
            // Show success toast for effectively complete jobs
            if (job.effectivelyComplete) {
              toast.success('Course generation complete! Some tasks may have been skipped, but your course is ready.');
            }
          }
        });
      }
    } catch (error) {
      console.error('Error fetching jobs:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (typeof window !== 'undefined') {
      confettiRef.current = new JSConfetti();
    }
    
    fetchJobs();
    const interval = setInterval(fetchJobs, 5000);
    
    return () => clearInterval(interval);
  }, []);

  const triggerConfetti = () => {
    confettiRef.current?.addConfetti({
      emojis: ['🎉', '📚', '✨', '🚀'],
      emojiSize: 100,
      confettiNumber: 30,
    });
  };

  const dismissJob = async (jobId: string) => {
    try {
      await fetch(`/api/course-generation/dismiss-job/${jobId}`, { method: 'POST' });
      setJobs(jobs.filter(j => j.id !== jobId));
      toast.success('Dismissed from view');
    } catch (error) {
      toast.error('Failed to dismiss');
    }
  };

  if (loading) {
    return (
      <div className={cn("animate-pulse", className)}>
        <div className="h-32 bg-gray-100 dark:bg-gray-800 rounded-xl" />
      </div>
    );
  }

  if (jobs.length === 0) {
    return null;
  }

  return (
    <div className={cn("space-y-4", className)}>
      {jobs.map((job) => (
        <JobCard 
          key={job.id} 
          job={job} 
          onDismiss={dismissJob}
          onViewCourse={() => router.push(`/teach/base-classes/${job.baseClassId}`)}
        />
      ))}
    </div>
  );
}

function JobCard({ 
  job, 
  onDismiss, 
  onViewCourse 
}: { 
  job: GenerationJob & { effectivelyComplete?: boolean; successRate?: number }; 
  onDismiss: (id: string) => void;
  onViewCourse: () => void;
}) {
  const getPhaseIcon = (phase?: string) => {
    switch (phase) {
      case 'outline': return <Brain className="w-4 h-4" />;
      case 'lessons': return <FileText className="w-4 h-4" />;
      case 'assessments': return <HelpCircle className="w-4 h-4" />;
      default: return <Sparkles className="w-4 h-4" />;
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'completed': return 'text-green-600 dark:text-green-400';
      case 'failed': return 'text-red-600 dark:text-red-400';
      case 'processing': return 'text-blue-600 dark:text-blue-400';
      default: return 'text-gray-600 dark:text-gray-400';
    }
  };

  const formatTime = (date: string) => {
    const diff = Date.now() - new Date(date).getTime();
    const minutes = Math.floor(diff / 60000);
    if (minutes < 1) return 'Just now';
    if (minutes < 60) return `${minutes}m ago`;
    return `${Math.floor(minutes / 60)}h ago`;
  };

  return (
    <motion.div
      layout
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, scale: 0.95 }}
      className="relative bg-white dark:bg-gray-900 rounded-xl border border-gray-200 dark:border-gray-800 overflow-hidden"
    >
      {/* Animated gradient border for processing jobs */}
      {job.status === 'processing' && (
        <div className="absolute inset-0 rounded-xl">
          <div className="absolute inset-0 rounded-xl bg-gradient-to-r from-blue-500 via-purple-500 to-pink-500 opacity-20 animate-gradient" />
        </div>
      )}

      <div className="relative p-6">
        {/* Header */}
        <div className="flex items-start justify-between mb-4">
          <div className="flex-1">
            <div className="flex items-center gap-2 mb-1">
              <h3 className="font-semibold text-gray-900 dark:text-white">
                {job.title || job.baseClassName}
              </h3>
              <Badge 
                variant={job.status === 'completed' ? 'default' : 'secondary'}
                className={cn("text-xs", getStatusColor(job.status))}
              >
                {job.status}
              </Badge>
            </div>
            <p className="text-sm text-gray-500 dark:text-gray-400 flex items-center gap-2">
              <Clock className="w-3 h-3" />
              Started {formatTime(job.createdAt)}
            </p>
          </div>
          
          <Button
            variant="ghost"
            size="icon"
            className="h-8 w-8"
            onClick={() => onDismiss(job.id)}
          >
            <X className="h-4 w-4" />
          </Button>
        </div>

        {/* Progress Section */}
        {job.status === 'processing' && (
          <div className="space-y-3 mb-4">
            {/* Progress Bar */}
            <div className="space-y-2">
              <div className="flex justify-between text-sm">
                <span className="text-gray-600 dark:text-gray-400 flex items-center gap-1">
                  {getPhaseIcon(job.current_phase)}
                  {job.current_phase ? `Generating ${job.current_phase}` : 'Processing'}
                </span>
                <span className="font-medium text-gray-900 dark:text-white">
                  {job.progress}%
                </span>
              </div>
              
              <div className="h-2 bg-gray-100 dark:bg-gray-800 rounded-full overflow-hidden">
                <motion.div
                  className="h-full bg-gradient-to-r from-blue-500 to-purple-600"
                  initial={{ width: 0 }}
                  animate={{ width: `${job.progress}%` }}
                  transition={{ duration: 0.5, ease: "easeOut" }}
                />
              </div>
            </div>

            {/* Task Stats */}
            {job.total_tasks && (
              <div className="flex items-center gap-4 text-xs">
                <div className="flex items-center gap-1">
                  <CheckCircle2 className="w-3 h-3 text-green-500" />
                  <span className="text-gray-600 dark:text-gray-400">
                    {job.completed_tasks || 0}/{job.total_tasks} tasks
                  </span>
                </div>
                {job.failed_tasks && job.failed_tasks > 0 && (
                  <div className="flex items-center gap-1">
                    <AlertCircle className="w-3 h-3 text-yellow-500" />
                    <span className="text-gray-600 dark:text-gray-400">
                      {job.failed_tasks} retrying
                    </span>
                  </div>
                )}
              </div>
            )}

            {/* Live indicator */}
            <div className="flex items-center gap-2">
              <div className="flex items-center gap-1">
                <motion.div
                  animate={{ scale: [1, 1.2, 1] }}
                  transition={{ duration: 2, repeat: Infinity }}
                  className="w-2 h-2 bg-green-500 rounded-full"
                />
                <span className="text-xs text-gray-500 dark:text-gray-400">
                  Live generation in progress
                </span>
              </div>
            </div>
          </div>
        )}

        {/* Completed State */}
        {job.status === 'completed' && (
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            className="space-y-3"
          >
            <div className="space-y-2">
              <div className="flex items-center gap-2 text-green-600 dark:text-green-400">
                <CheckCircle2 className="w-5 h-5" />
                <span className="font-medium">
                  {job.effectivelyComplete && job.successRate && job.successRate < 1 
                    ? 'Course generation complete with some skipped content'
                    : 'Course generation complete!'}
                </span>
              </div>
              
              {/* Show completion stats if some tasks failed */}
              {job.effectivelyComplete && job.total_tasks && job.failed_tasks && job.failed_tasks > 0 && (
                <div className="flex items-center gap-4 text-sm text-gray-600 dark:text-gray-400">
                  <div className="flex items-center gap-1">
                    <CheckCircle2 className="w-3 h-3 text-green-500" />
                    <span>{job.completed_tasks || 0} successful</span>
                  </div>
                  <div className="flex items-center gap-1">
                    <AlertCircle className="w-3 h-3 text-yellow-500" />
                    <span>{job.failed_tasks} skipped</span>
                  </div>
                  <Badge variant="outline" className="text-xs">
                    {Math.round((job.successRate || 1) * 100)}% complete
                  </Badge>
                </div>
              )}
            </div>
            
            <div className="flex gap-2">
              <Button 
                onClick={onViewCourse}
                className="flex-1 bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-700 hover:to-purple-700"
              >
                <BookOpen className="w-4 h-4 mr-2" />
                View Course
                <ArrowRight className="w-4 h-4 ml-auto" />
              </Button>
              {job.effectivelyComplete && job.failed_tasks && job.failed_tasks > 0 && (
                <Button
                  variant="outline"
                  size="icon"
                  title="Some content was skipped but your course is ready to use"
                  className="shrink-0"
                >
                  <HelpCircle className="w-4 h-4" />
                </Button>
              )}
            </div>
          </motion.div>
        )}

        {/* Failed State */}
        {job.status === 'failed' && (
          <div className="space-y-3">
            <div className="space-y-2">
              <div className="flex items-center gap-2 text-amber-600 dark:text-amber-400">
                <AlertCircle className="w-5 h-5" />
                <span className="font-medium">
                  {job.effectivelyComplete 
                    ? 'Course partially generated'
                    : 'Generation encountered issues'}
                </span>
              </div>
              
              {/* Show what was completed if effectively complete */}
              {job.effectivelyComplete && job.total_tasks && (
                <div className="flex items-center gap-4 text-sm text-gray-600 dark:text-gray-400">
                  <div className="flex items-center gap-1">
                    <CheckCircle2 className="w-3 h-3 text-green-500" />
                    <span>{job.completed_tasks || 0} completed</span>
                  </div>
                  <div className="flex items-center gap-1">
                    <AlertCircle className="w-3 h-3 text-amber-500" />
                    <span>{job.failed_tasks || 0} incomplete</span>
                  </div>
                  <Badge variant="outline" className="text-xs">
                    {Math.round((job.successRate || 0) * 100)}% generated
                  </Badge>
                </div>
              )}
              
              {job.error && (
                <p className="text-sm text-gray-600 dark:text-gray-400">
                  {job.error}
                </p>
              )}
            </div>
            
            {/* Still allow viewing if partially complete */}
            {job.effectivelyComplete && job.successRate && job.successRate > 0.3 && (
              <div className="flex gap-2">
                <Button 
                  onClick={onViewCourse}
                  variant="outline"
                  className="flex-1"
                >
                  <BookOpen className="w-4 h-4 mr-2" />
                  View Partial Course
                  <ArrowRight className="w-4 h-4 ml-auto" />
                </Button>
                <Button
                  variant="outline"
                  size="icon"
                  title="Some content generation failed but you can still view what was created"
                  className="shrink-0"
                >
                  <HelpCircle className="w-4 h-4" />
                </Button>
              </div>
            )}
          </div>
        )}
      </div>
    </motion.div>
  );
}