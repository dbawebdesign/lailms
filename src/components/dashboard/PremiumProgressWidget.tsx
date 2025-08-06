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
        setJobs(data.jobs);
        
        // Check for completed jobs to trigger confetti
        data.jobs.forEach((job: GenerationJob) => {
          if (job.status === 'completed' && !sessionStorage.getItem(`confetti-${job.id}`)) {
            triggerConfetti();
            sessionStorage.setItem(`confetti-${job.id}`, 'true');
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
  job: GenerationJob; 
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
            <div className="flex items-center gap-2 text-green-600 dark:text-green-400">
              <CheckCircle2 className="w-5 h-5" />
              <span className="font-medium">Course generation complete!</span>
            </div>
            
            <Button 
              onClick={onViewCourse}
              className="w-full bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-700 hover:to-purple-700"
            >
              <BookOpen className="w-4 h-4 mr-2" />
              View Course
              <ArrowRight className="w-4 h-4 ml-2" />
            </Button>
          </motion.div>
        )}

        {/* Failed State */}
        {job.status === 'failed' && (
          <div className="space-y-3">
            <div className="flex items-center gap-2 text-red-600 dark:text-red-400">
              <AlertCircle className="w-5 h-5" />
              <span className="font-medium">Generation failed</span>
            </div>
            {job.error && (
              <p className="text-sm text-gray-600 dark:text-gray-400">
                {job.error}
              </p>
            )}
          </div>
        )}
      </div>
    </motion.div>
  );
}