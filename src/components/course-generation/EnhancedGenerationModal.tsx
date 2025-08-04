'use client';

import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Brain, BookOpen, Layers, CheckCircle, ArrowRight, AlertTriangle } from 'lucide-react';
import Image from 'next/image';
import { GenerationHealthMonitor } from './GenerationHealthMonitor';
import { useCourseGenerationHealth } from '@/hooks/useCourseGenerationHealth';
import { Button } from '@/components/ui/button';
import { toast } from 'sonner';

interface EnhancedGenerationModalProps {
  isOpen: boolean;
  jobId?: string;
  onComplete?: () => void;
  onRestart?: () => void;
  onDelete?: () => void;
}

interface GenerationPhase {
  id: string;
  title: string;
  description: string;
  icon: React.ReactNode;
  duration: number; // in seconds
}

const generationPhases: GenerationPhase[] = [
  {
    id: 'initializing',
    title: 'Initializing Course Builder',
    description: 'Analyzing your knowledge base and setting up the course generation process. You will be redirected to the dashboard where you can track detailed progress. Courses typically take 10-20 minutes to complete depending on complexity.',
    icon: <Image src="/favicon.svg" alt="Learnology AI" width={48} height={48} className="w-12 h-12" />,
    duration: 40
  }
];

export function EnhancedGenerationModal({ 
  isOpen, 
  jobId, 
  onComplete, 
  onRestart,
  onDelete 
}: EnhancedGenerationModalProps) {
  const [currentPhaseIndex, setCurrentPhaseIndex] = useState(0);
  const [phaseProgress, setPhaseProgress] = useState(0);
  const [isCompleted, setIsCompleted] = useState(false);
  const [taskCount, setTaskCount] = useState(0);
  const [isWaitingForTasks, setIsWaitingForTasks] = useState(false);
  const [showHealthMonitor, setShowHealthMonitor] = useState(false);
  const [initialLoadComplete, setInitialLoadComplete] = useState(false);

  // Use the health monitoring hook
  const {
    health,
    needsAttention,
    isHealthy,
    progressPercentage,
    userMessage
  } = useCourseGenerationHealth({
    jobId: jobId || '',
    enabled: isOpen && !!jobId,
    pollInterval: 15000, // Check every 15 seconds during generation
    onHealthChange: (newHealth) => {
      // Show health monitor if there are issues
      if (['stalled', 'stuck', 'failed', 'abandoned'].includes(newHealth.status)) {
        setShowHealthMonitor(true);
      }
      
      // Complete the modal if generation is successful
      if (newHealth.status === 'healthy' && newHealth.progressPercentage === 100) {
        setIsCompleted(true);
        setTimeout(() => {
          onComplete?.();
        }, 2000);
      }
    }
  });

  // Check job status to see if we have enough tasks created
  const checkJobStatus = async () => {
    if (!jobId) return false;

    try {
      const response = await fetch(`/api/knowledge-base/generation-status/${jobId}`);
      const data = await response.json();

      if (data.success && data.job) {
        const job = data.job;
        setTaskCount(job.total_tasks || 0);
        
        // If we have tasks and the job is processing, we can proceed
        if (job.total_tasks > 0 && job.status === 'processing') {
          setInitialLoadComplete(true);
          return true;
        }
        
        // If job is completed, mark as completed
        if (job.status === 'completed') {
          setIsCompleted(true);
          setTimeout(() => {
            onComplete?.();
          }, 1000);
          return true;
        }
        
        // If job failed, show health monitor
        if (job.status === 'failed') {
          setShowHealthMonitor(true);
          return true;
        }
      }
      
      return false;
    } catch (error) {
      console.error('Error checking job status:', error);
      // Show health monitor on error
      setShowHealthMonitor(true);
      return false;
    }
  };

  // Effect to handle the generation flow
  useEffect(() => {
    if (!isOpen || !jobId) return;

    let progressTimer: NodeJS.Timeout;
    let statusCheckTimer: NodeJS.Timeout;

    const startPhase = (phaseIndex: number) => {
      if (phaseIndex >= generationPhases.length) {
        // All phases complete, wait for actual job completion
        setIsWaitingForTasks(true);
        
        // Start checking job status more frequently
        const checkStatus = async () => {
          const hasTasksAndProcessing = await checkJobStatus();
          if (hasTasksAndProcessing) {
            // Tasks created and processing, show health monitor for detailed tracking
            setShowHealthMonitor(true);
          } else {
            // Keep checking
            statusCheckTimer = setTimeout(checkStatus, 3000);
          }
        };
        
        checkStatus();
        return;
      }

      const phase = generationPhases[phaseIndex];
      setCurrentPhaseIndex(phaseIndex);
      setPhaseProgress(0);

      // Animate progress for this phase
      const progressInterval = 50; // Update every 50ms
      const totalSteps = (phase.duration * 1000) / progressInterval;
      let currentStep = 0;

      progressTimer = setInterval(() => {
        currentStep++;
        const progress = Math.min((currentStep / totalSteps) * 100, 100);
        setPhaseProgress(progress);

        if (progress >= 100) {
          clearInterval(progressTimer);
          // Move to next phase after a brief pause
          setTimeout(() => startPhase(phaseIndex + 1), 500);
        }
      }, progressInterval);
    };

    // Start the first phase
    startPhase(0);

    return () => {
      clearInterval(progressTimer);
      clearTimeout(statusCheckTimer);
    };
  }, [isOpen, jobId, onComplete]);

  // Handle restart request
  const handleRestart = () => {
    setShowHealthMonitor(false);
    setIsCompleted(false);
    setCurrentPhaseIndex(0);
    setPhaseProgress(0);
    setTaskCount(0);
    setIsWaitingForTasks(false);
    setInitialLoadComplete(false);
    onRestart?.();
  };

  // Handle delete request
  const handleDelete = () => {
    onDelete?.();
  };

  if (!isOpen) return null;

  const currentPhase = generationPhases[currentPhaseIndex];

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4"
      >
        <motion.div
          initial={{ scale: 0.9, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          exit={{ scale: 0.9, opacity: 0 }}
          className="bg-white rounded-2xl shadow-2xl max-w-2xl w-full max-h-[90vh] overflow-y-auto"
        >
          {!isCompleted ? (
            <div className="p-8">
              {!showHealthMonitor ? (
                // Initial loading phase
                <div className="text-center">
                  {/* Animated Icon */}
                  <div className="relative mb-8">
                    <motion.div
                      animate={{ 
                        rotate: 360,
                        scale: [1, 1.1, 1]
                      }}
                      transition={{ 
                        rotate: { duration: 2, repeat: Infinity, ease: "linear" },
                        scale: { duration: 1.5, repeat: Infinity, ease: "easeInOut" }
                      }}
                      className="w-20 h-20 mx-auto bg-gradient-to-br from-blue-500 to-purple-600 rounded-full flex items-center justify-center text-white shadow-lg"
                    >
                      {isWaitingForTasks ? (
                        <Image src="/favicon.svg" alt="Learnology AI" width={48} height={48} className="w-12 h-12" />
                      ) : (
                        currentPhase?.icon
                      )}
                    </motion.div>
                    
                    {/* Pulse rings */}
                    <motion.div
                      animate={{ scale: [1, 2, 1], opacity: [0.5, 0, 0.5] }}
                      transition={{ duration: 2, repeat: Infinity, ease: "easeInOut" }}
                      className="absolute inset-0 w-20 h-20 mx-auto border-2 border-blue-400 rounded-full"
                    />
                    <motion.div
                      animate={{ scale: [1, 2.5, 1], opacity: [0.3, 0, 0.3] }}
                      transition={{ duration: 2, repeat: Infinity, ease: "easeInOut", delay: 0.5 }}
                      className="absolute inset-0 w-20 h-20 mx-auto border-2 border-purple-400 rounded-full"
                    />
                  </div>

                  {/* Phase Title */}
                  <h2 className="text-2xl font-bold text-gray-900 mb-4">
                    {isWaitingForTasks ? 'Setting Up Course Generation' : currentPhase?.title}
                  </h2>

                  {/* Phase Description */}
                  <p className="text-gray-600 mb-8 leading-relaxed">
                    {isWaitingForTasks 
                      ? `Creating ${taskCount > 0 ? taskCount : ''} generation tasks. This may take a moment...`
                      : currentPhase?.description
                    }
                  </p>

                  {/* Progress Bar */}
                  <div className="w-full bg-gray-200 rounded-full h-3 mb-6 overflow-hidden">
                    <motion.div
                      initial={{ width: 0 }}
                      animate={{ width: `${isWaitingForTasks ? 90 : phaseProgress}%` }}
                      transition={{ duration: 0.3, ease: "easeOut" }}
                      className="h-full bg-gradient-to-r from-blue-500 to-purple-600 rounded-full"
                    />
                  </div>

                  {/* Task Count Display */}
                  {taskCount > 0 && (
                    <div className="text-sm text-gray-500">
                      {taskCount} tasks created for generation
                    </div>
                  )}

                  {/* Show health monitor button if tasks are created */}
                  {initialLoadComplete && (
                    <Button
                      variant="outline"
                      onClick={() => setShowHealthMonitor(true)}
                      className="mt-4"
                    >
                      View Detailed Progress
                    </Button>
                  )}
                </div>
              ) : (
                // Health monitoring phase
                <div>
                  <div className="text-center mb-6">
                    <h2 className="text-2xl font-bold text-gray-900 mb-2">
                      Course Generation in Progress
                    </h2>
                    <p className="text-gray-600">
                      Monitor the detailed progress and handle any issues that arise.
                    </p>
                  </div>

                  {/* Health Monitor Component */}
                  <GenerationHealthMonitor
                    jobId={jobId || ''}
                    onRestartRequest={handleRestart}
                    onDeleteRequest={handleDelete}
                    onRecoverySuccess={() => {
                      toast.success('Recovery successful! Generation will continue.');
                    }}
                  />

                  {/* Action Buttons */}
                  <div className="mt-6 flex gap-3 justify-center">
                    <Button
                      variant="outline"
                      onClick={() => setShowHealthMonitor(false)}
                    >
                      Hide Details
                    </Button>
                    {onComplete && (
                      <Button
                        variant="outline"
                        onClick={onComplete}
                      >
                        Go to Dashboard
                      </Button>
                    )}
                  </div>
                </div>
              )}
            </div>
          ) : (
            // Completion phase
            <div className="p-8 text-center">
              <motion.div
                initial={{ scale: 0 }}
                animate={{ scale: 1 }}
                transition={{ type: "spring", stiffness: 200, damping: 20 }}
                className="w-20 h-20 mx-auto bg-green-500 rounded-full flex items-center justify-center text-white shadow-lg mb-6"
              >
                <CheckCircle className="w-10 h-10" />
              </motion.div>

              <h2 className="text-2xl font-bold text-gray-900 mb-4">
                Course Generated Successfully!
              </h2>

              <p className="text-gray-600 mb-8">
                Your course has been created and is ready for use. You can now manage it from your dashboard.
              </p>

              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.5 }}
                className="flex items-center justify-center text-blue-600 font-medium"
              >
                <span>Redirecting to dashboard</span>
                <ArrowRight className="ml-2 w-5 h-5" />
              </motion.div>
            </div>
          )}
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
}