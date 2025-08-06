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
  const checkInterval = useRef<NodeJS.Timeout>();

  // Check if orchestrator has started
  const checkOrchestratorStatus = async () => {
    if (!jobId || hasRedirected.current) return;

    try {
      const response = await fetch(`/api/knowledge-base/generation-status/${jobId}`);
      const data = await response.json();

      if (data.success && data.job) {
        const job = data.job;
        
        // Check if orchestrator has started (status is processing and we have tasks)
        if (job.status === 'processing' && job.total_tasks > 0) {
          // Safe to redirect now - orchestrator is running
          if (!hasRedirected.current) {
            hasRedirected.current = true;
            setStatus('redirecting');
            
            // Smooth transition before redirect
            setTimeout(() => {
              router.push('/dashboard?from=course-generation');
              toast.success('Course generation started! Track progress in your dashboard.');
              onClose?.();
            }, 1500);
          }
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

      return () => {
        if (checkInterval.current) clearInterval(checkInterval.current);
        clearInterval(progressInterval);
      };
    }
  }, [isOpen, jobId]);

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
                  {status === 'initializing' && 'Initializing AI Engine'}
                  {status === 'redirecting' && 'Ready to Launch'}
                  {status === 'ready' && 'Course Generation Started'}
                </motion.h2>
                
                <motion.p 
                  key={`desc-${status}`}
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  transition={{ delay: 0.2 }}
                  className="text-sm text-gray-600 dark:text-gray-400 max-w-sm mx-auto"
                >
                  {status === 'initializing' && 'Setting up your personalized course generation pipeline...'}
                  {status === 'redirecting' && 'Redirecting to your dashboard for real-time progress tracking...'}
                  {status === 'ready' && 'Your course is being generated in the background.'}
                </motion.p>
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
                  Course generation typically takes 10-20 minutes
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