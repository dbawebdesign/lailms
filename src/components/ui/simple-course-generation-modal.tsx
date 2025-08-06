'use client';

import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useRouter } from 'next/navigation';
import { Sparkles, ArrowRight, CheckCircle } from 'lucide-react';
import Image from 'next/image';

interface SimpleCourseGenerationModalProps {
  isOpen: boolean;
  onComplete?: () => void;
  jobId?: string; // Add jobId to track generation progress
}

export function SimpleCourseGenerationModal({ isOpen, onComplete, jobId }: SimpleCourseGenerationModalProps) {
  const [progress, setProgress] = useState(0);
  const [isCompleted, setIsCompleted] = useState(false);
  const [statusMessage, setStatusMessage] = useState('Initializing course generation...');
  const router = useRouter();

  useEffect(() => {
    if (!isOpen) {
      setProgress(0);
      setIsCompleted(false);
      setStatusMessage('Initializing course generation...');
      return;
    }

    // If no jobId provided, fall back to 7-second timer (legacy behavior)
    if (!jobId) {
      const duration = 7000; // 7 seconds
      const interval = 50; // Update every 50ms for smooth animation
      const increment = (interval / duration) * 100;

      const timer = setInterval(() => {
        setProgress(prev => {
          const newProgress = prev + increment;
          if (newProgress >= 100) {
            clearInterval(timer);
            setIsCompleted(true);
            
            // Redirect to dashboard after a brief delay
            setTimeout(() => {
              router.push('/dashboard');
              onComplete?.();
            }, 1000);
            
            return 100;
          }
          return newProgress;
        });
      }, interval);

      return () => clearInterval(timer);
    }

    // New behavior: Poll job status until completion
    let pollTimer: NodeJS.Timeout;
    
    const checkJobStatus = async () => {
      try {
        const response = await fetch(`/api/knowledge-base/generation-status/${jobId}`);
        const data = await response.json();

        if (data.success && data.job) {
          const job = data.job;
          const jobProgress = job.progress_percentage || 0;
          
          setProgress(jobProgress);
          
          // Update status message based on job progress
          if (jobProgress < 25) {
            setStatusMessage('Analyzing knowledge base...');
          } else if (jobProgress < 50) {
            setStatusMessage('Generating course outline...');
          } else if (jobProgress < 85) {
            setStatusMessage('Creating course structure...');
          } else if (jobProgress < 100) {
            setStatusMessage('Launching advanced generation...');
          }

          if (job.status === 'completed') {
            setProgress(100);
            setStatusMessage('Course generation completed!');
            setIsCompleted(true);
            
            // Redirect to dashboard after completion
            setTimeout(() => {
              router.push('/dashboard');
              onComplete?.();
            }, 1500);
            
            return; // Stop polling
          } else if (job.status === 'failed') {
            setStatusMessage('Course generation failed. Redirecting...');
            setTimeout(() => {
              router.push('/dashboard');
              onComplete?.();
            }, 2000);
            return; // Stop polling
          }
        }
      } catch (error) {
        console.error('Failed to check job status:', error);
        setStatusMessage('Checking generation status...');
      }

      // Continue polling if job is still processing
      pollTimer = setTimeout(checkJobStatus, 2000); // Poll every 2 seconds
    };

    // Start polling immediately
    checkJobStatus();

    return () => {
      if (pollTimer) {
        clearTimeout(pollTimer);
      }
    };
  }, [isOpen, router, onComplete, jobId]);

  if (!isOpen) return null;

  return (
    <AnimatePresence>
      <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
        <motion.div
          initial={{ opacity: 0, scale: 0.9 }}
          animate={{ opacity: 1, scale: 1 }}
          exit={{ opacity: 0, scale: 0.9 }}
          className="bg-white rounded-2xl shadow-2xl max-w-md w-full p-8 text-center"
        >
          {/* Logo */}
          <div className="flex justify-center mb-6">
            <div className="relative">
              <Image 
                src="/favicon.svg" 
                alt="Learnology AI" 
                width={64} 
                height={64} 
                className="w-16 h-16"
              />
              <motion.div
                className="absolute -inset-2 rounded-full border-2 border-blue-200"
                animate={{ rotate: 360 }}
                transition={{ duration: 2, repeat: Infinity, ease: "linear" }}
              />
            </div>
          </div>

          {/* Title and Description */}
          <div className="mb-8">
            <h2 className="text-2xl font-bold text-gray-900 mb-3 flex items-center justify-center gap-2">
              {isCompleted ? (
                <>
                  <CheckCircle className="w-6 h-6 text-green-500" />
                  Course Generation Started!
                </>
              ) : (
                <>
                  <Sparkles className="w-6 h-6 text-blue-500" />
                  Initializing Course Builder
                </>
              )}
            </h2>
            <p className="text-gray-600 leading-relaxed">
              {isCompleted ? (
                "Redirecting you to the dashboard where you can track the course generation progress..."
              ) : (
                statusMessage
              )}
            </p>
          </div>

          {/* Progress Bar */}
          <div className="mb-6">
            <div className="w-full bg-gray-200 rounded-full h-3 overflow-hidden">
              <motion.div
                className="h-full bg-gradient-to-r from-blue-500 to-purple-500 rounded-full"
                style={{ width: `${progress}%` }}
                transition={{ duration: 0.1 }}
              />
            </div>
            <div className="mt-2 text-sm text-gray-500">
              {isCompleted ? "Complete!" : `${Math.round(progress)}%`}
            </div>
          </div>

          {/* Status Message */}
          <div className="text-sm text-gray-500 flex items-center justify-center gap-2">
            {isCompleted ? (
              <>
                <ArrowRight className="w-4 h-4" />
                Redirecting to dashboard...
              </>
            ) : (
              <>
                <motion.div
                  animate={{ rotate: 360 }}
                  transition={{ duration: 1, repeat: Infinity, ease: "linear" }}
                  className="w-4 h-4 border-2 border-blue-500 border-t-transparent rounded-full"
                />
                Preparing your course...
              </>
            )}
          </div>

          {/* Info Note */}
          {!isCompleted && (
            <div className="mt-6 p-3 bg-blue-50 rounded-lg">
              <p className="text-xs text-blue-700">
                <strong>Note:</strong> Course generation typically takes 10-20 minutes depending on complexity. 
                You can monitor detailed progress from your dashboard.
              </p>
            </div>
          )}
        </motion.div>
      </div>
    </AnimatePresence>
  );
}