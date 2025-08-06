'use client';

import { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';

interface PremiumGenerationModalProps {
  isOpen: boolean;
  jobId?: string;
  baseClassId?: string;
  onClose?: () => void;
}

export function PremiumGenerationModal({ 
  isOpen, 
  jobId, 
  baseClassId,
  onClose 
}: PremiumGenerationModalProps) {
  const router = useRouter();
  const [status, setStatus] = useState<'initializing' | 'redirecting' | 'ready'>('initializing');
  const [progress, setProgress] = useState(0);
  const hasRedirected = useRef(false);
  const checkInterval = useRef<NodeJS.Timeout | null>(null);

  // Check if orchestrator has started and tasks are locked
  const checkOrchestratorStatus = async () => {
    if (!jobId || hasRedirected.current) return;

    try {
      const response = await fetch(`/api/knowledge-base/generation-status/${jobId}`);
      const data = await response.json();

      if (data.success && data.job) {
        const job = data.job;
        
        // Check specifically for the task locking message - this is the critical point
        // The exact format is: "🔒 Locking {number} tasks as 'running'..."
        const recentMessages = data.messages?.slice(-10) || []; // Check last 10 messages to be sure
        let tasksAreLocked = false;
        
        for (const msg of recentMessages) {
          const message = msg?.message || '';
          
          // Check for the exact locking message pattern
          // Format: "🔒 Locking {number} tasks as 'running'..."
          if (message.includes('🔒 Locking') && message.includes("tasks as 'running'")) {
            console.log('Found task locking message:', message);
            tasksAreLocked = true;
            break;
          }
          
          // Also check for alternative formats that might appear
          if (message.includes('🔒') && message.includes('Locking') && message.includes('tasks')) {
            console.log('Found alternative locking message:', message);
            tasksAreLocked = true;
            break;
          }
          
          // Check for task initialization completion
          if (message.includes('📝 Initializing tasks') || message.includes('Task insert payload')) {
            console.log('Found task initialization message:', message);
            // Don't redirect yet, but note that initialization is happening
          }
        }
        
        // Also check if we have running tasks as a secondary indicator
        const hasRunningTasks = job.total_tasks > 0 && (
          job.running_tasks > 0 || 
          job.completed_tasks > 0 ||
          (job.status === 'processing' && job.progress_percentage > 0)
        );
        
        // Log current status for debugging
        if (data.messages?.length > 0) {
          const latestMessage = data.messages[data.messages.length - 1]?.message;
          console.log('Latest message:', latestMessage);
          console.log('Job status:', {
            status: job.status,
            total_tasks: job.total_tasks,
            running_tasks: job.running_tasks,
            completed_tasks: job.completed_tasks,
            progress: job.progress_percentage
          });
        }
        
        // Redirect when we see the locking message OR when we have clear evidence of running tasks
        if ((tasksAreLocked || (hasRunningTasks && job.running_tasks > 0)) && !hasRedirected.current) {
          console.log('Tasks are ready! Initiating redirect...');
          console.log('Redirect triggered by:', tasksAreLocked ? 'Locking message' : 'Running tasks detected');
          
          // Safe to redirect now - tasks are locked and running in background
          hasRedirected.current = true;
          setStatus('redirecting');
          setProgress(100); // Complete the progress bar
          
          // Smooth transition before redirect
          setTimeout(() => {
            router.push('/teach?from=course-generation');
            toast.success('Course generation is running! You can track progress in your dashboard.');
            onClose?.();
          }, 1500);
        }
      }
    } catch (error) {
      console.error('Error checking orchestrator status:', error);
    }
  };

  useEffect(() => {
    if (isOpen && jobId) {
      // Start checking immediately
      checkOrchestratorStatus();
      
      // Check every 2 seconds
      checkInterval.current = setInterval(checkOrchestratorStatus, 2000);
      
      // Animate progress smoothly
      const progressInterval = setInterval(() => {
        setProgress(prev => {
          if (prev >= 90) return 90; // Cap at 90% until redirect
          return prev + 10;
        });
      }, 500);

      // Fallback: Force redirect after 5 minutes if checks haven't triggered
      // This gives plenty of time for task locking to complete even under heavy load
      const fallbackTimeout = setTimeout(() => {
        if (!hasRedirected.current) {
          console.log('Fallback redirect triggered after 5 minutes');
          hasRedirected.current = true;
          setStatus('redirecting');
          setProgress(100);
          setTimeout(() => {
            router.push('/teach?from=course-generation');
            toast.success('Course generation is running in the background!');
            onClose?.();
          }, 1500);
        }
      }, 300000); // 5 minutes

      return () => {
        if (checkInterval.current) clearInterval(checkInterval.current);
        clearInterval(progressInterval);
        clearTimeout(fallbackTimeout);
      };
    }
  }, [isOpen, jobId]);

  // Prevent users from leaving during critical initialization
  useEffect(() => {
    if (isOpen && status === 'initializing') {
      const handleBeforeUnload = (e: BeforeUnloadEvent) => {
        e.preventDefault();
        e.returnValue = 'Your course is being initialized. Leaving now may interrupt the process.';
        return e.returnValue;
      };

      window.addEventListener('beforeunload', handleBeforeUnload);

      return () => {
        window.removeEventListener('beforeunload', handleBeforeUnload);
      };
    }
  }, [isOpen, status]);

  if (!isOpen) return null;

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm"
      >
        <motion.div
          initial={{ scale: 0.95, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          exit={{ scale: 0.95, opacity: 0 }}
          transition={{ type: "spring", damping: 25, stiffness: 300 }}
          className="relative w-full max-w-md mx-4"
        >
          <div className="bg-white dark:bg-gray-900 rounded-2xl shadow-2xl overflow-hidden">
            {/* Animated gradient background */}
            <div className="absolute inset-0 opacity-10">
              <div className="absolute inset-0 bg-gradient-to-br from-blue-500 via-purple-500 to-pink-500 animate-gradient" />
            </div>

            {/* Content */}
            <div className="relative p-8 space-y-6">
              {/* Logo/Icon */}
              <div className="flex justify-center">
                <motion.div
                  animate={{ 
                    rotate: status === 'redirecting' ? 360 : 0,
                    scale: status === 'redirecting' ? [1, 1.1, 1] : 1
                  }}
                  transition={{ 
                    rotate: { duration: 1, ease: "easeInOut" },
                    scale: { duration: 0.5, repeat: status === 'redirecting' ? Infinity : 0 }
                  }}
                  className="relative"
                >
                  <div className="w-20 h-20 rounded-full bg-gradient-to-br from-blue-500 to-purple-600 flex items-center justify-center shadow-xl">
                    <svg
                      className="w-10 h-10 text-white"
                      fill="none"
                      viewBox="0 0 24 24"
                      stroke="currentColor"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M13 10V3L4 14h7v7l9-11h-7z"
                      />
                    </svg>
                  </div>
                  
                  {/* Pulsing ring animation */}
                  <motion.div
                    animate={{ scale: [1, 1.5], opacity: [0.5, 0] }}
                    transition={{ duration: 2, repeat: Infinity }}
                    className="absolute inset-0 rounded-full bg-gradient-to-br from-blue-500 to-purple-600"
                  />
                </motion.div>
              </div>

              {/* Status Text */}
              <div className="text-center space-y-2">
                <motion.h2 
                  key={status}
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="text-2xl font-semibold text-gray-900 dark:text-white"
                >
                  {status === 'initializing' && 'Initializing Course Generation'}
                  {status === 'redirecting' && 'Background Processing Active'}
                  {status === 'ready' && 'Course Generation Running'}
                </motion.h2>
                
                <motion.p 
                  key={`desc-${status}`}
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  transition={{ delay: 0.2 }}
                  className="text-sm text-gray-600 dark:text-gray-400 max-w-sm mx-auto leading-relaxed"
                >
                  {status === 'initializing' && 'Preparing your course for background generation. This will continue even after you leave...'}
                  {status === 'redirecting' && 'Course is now generating in the background. Taking you to your dashboard...'}
                  {status === 'ready' && 'Your course continues generating. Check progress anytime in your dashboard.'}
                </motion.p>

                {/* Important notice - always visible */}
                <motion.div
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.4 }}
                  className="mt-4 p-3 bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 rounded-lg"
                >
                  <div className="flex items-start space-x-2">
                    <svg className="w-4 h-4 text-amber-600 dark:text-amber-400 mt-0.5 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20">
                      <path fillRule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
                    </svg>
                    <div className="text-xs text-amber-700 dark:text-amber-300">
                      <p className="font-medium mb-1">Please don't refresh or leave this page</p>
                      <p className="text-amber-600 dark:text-amber-400">You'll be automatically redirected to your dashboard shortly to track progress.</p>
                    </div>
                  </div>
                </motion.div>
              </div>

              {/* Progress Bar */}
              <div className="space-y-2">
                <div className="h-1.5 bg-gray-200 dark:bg-gray-800 rounded-full overflow-hidden">
                  <motion.div
                    className="h-full bg-gradient-to-r from-blue-500 to-purple-600"
                    initial={{ width: 0 }}
                    animate={{ width: `${progress}%` }}
                    transition={{ duration: 0.5, ease: "easeOut" }}
                  />
                </div>
                
                {/* Progress percentage */}
                <div className="flex justify-between text-xs text-gray-500 dark:text-gray-400">
                  <span>Initializing</span>
                  <motion.span
                    key={progress}
                    initial={{ opacity: 0, scale: 0.8 }}
                    animate={{ opacity: 1, scale: 1 }}
                  >
                    {progress}%
                  </motion.span>
                </div>
              </div>

              {/* Info text */}
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ delay: 0.5 }}
                className="text-center"
              >
                <p className="text-xs text-gray-500 dark:text-gray-400">
                  Your course will continue generating in the background
                </p>
              </motion.div>
            </div>
          </div>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
}

// Add required CSS for gradient animation
const gradientStyles = `
@keyframes gradient {
  0% { background-position: 0% 50%; }
  50% { background-position: 100% 50%; }
  100% { background-position: 0% 50%; }
}

.animate-gradient {
  background-size: 200% 200%;
  animation: gradient 15s ease infinite;
}
`;

// Inject styles
if (typeof document !== 'undefined') {
  const style = document.createElement('style');
  style.textContent = gradientStyles;
  document.head.appendChild(style);
}