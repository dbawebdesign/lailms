'use client';

import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Brain, BookOpen, Layers, CheckCircle, ArrowRight } from 'lucide-react';
import Image from 'next/image';

interface CourseGenerationModalProps {
  isOpen: boolean;
  jobId?: string;
  onComplete?: () => void;
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
    icon: <Image src="/favicon.svg" alt="Learnology AI" width={24} height={24} className="w-6 h-6" />,
    duration: 40 // Increased from 25 to 40 seconds (added 15 seconds)
  }
];

export function CourseGenerationModal({ isOpen, jobId, onComplete }: CourseGenerationModalProps) {
  const [currentPhaseIndex, setCurrentPhaseIndex] = useState(0);
  const [phaseProgress, setPhaseProgress] = useState(0);
  const [isCompleted, setIsCompleted] = useState(false);
  const [taskCount, setTaskCount] = useState(0);
  const [isWaitingForTasks, setIsWaitingForTasks] = useState(false);

  // Check job status to see if we have enough tasks created
  const checkJobStatus = async () => {
    if (!jobId) return false;

    try {
      const response = await fetch(`/api/knowledge-base/generation-status/${jobId}`);
      const data = await response.json();

      if (data.success && data.job) {
        const job = data.job;
        setTaskCount(job.total_tasks || 0);
        
        // Check if we have enough tasks to show meaningful progress
        const hasEnoughTasks = (job.total_tasks || 0) >= 10;
        const hasStartedProcessing = job.status === 'processing';
        const hasAnyProgress = (job.completed_tasks || 0) > 0 || (job.running_tasks || 0) > 0;
        
        // Redirect when we have at least 10 tasks AND the job is processing with some activity
        return hasEnoughTasks && hasStartedProcessing && hasAnyProgress;
      }
    } catch (error) {
      console.error('Failed to check job status:', error);
    }
    
    return false;
  };

  useEffect(() => {
    if (!isOpen || !jobId) return;

    let phaseTimer: NodeJS.Timeout;
    let progressTimer: NodeJS.Timeout;
    let statusCheckTimer: NodeJS.Timeout;

    const startPhase = (phaseIndex: number) => {
      if (phaseIndex >= generationPhases.length) {
        // Animation complete - now wait for tasks to be created
        console.log('🎯 Initialization animation completed, waiting for tasks to be created...');
        setIsWaitingForTasks(true);
        
        // Start checking for task creation
        const checkTasks = async () => {
          const hasEnoughTasks = await checkJobStatus();
          
          if (hasEnoughTasks) {
            console.log(`✅ Found ${taskCount} tasks created, redirecting to dashboard`);
            setIsCompleted(true);
            setTimeout(() => {
              onComplete?.();
            }, 2000); // Show completion state for 2 seconds then redirect
          } else {
            // Keep checking every 2 seconds
            statusCheckTimer = setTimeout(checkTasks, 2000);
          }
        };
        
        checkTasks();
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
  }, [isOpen, jobId, onComplete, taskCount]);

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
          className="bg-white rounded-2xl shadow-2xl max-w-lg w-full p-8 text-center"
        >
          {!isCompleted ? (
            <>
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
                    <Image src="/favicon.svg" alt="Learnology AI" width={24} height={24} className="w-6 h-6" />
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
              <motion.h2
                key={isWaitingForTasks ? 'waiting-for-tasks' : currentPhase?.id}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                className="text-2xl font-bold text-gray-900 mb-3"
              >
                {isWaitingForTasks ? 'Creating Course Structure' : currentPhase?.title}
              </motion.h2>

              {/* Phase Description */}
              <motion.p
                key={isWaitingForTasks ? 'waiting-for-tasks-desc' : `${currentPhase?.id}-desc`}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.1 }}
                className="text-gray-600 mb-8 leading-relaxed"
              >
                {isWaitingForTasks 
                  ? `Setting up your course structure and preparing tasks for generation. We're creating lessons, assessments, and media components. Found ${taskCount} tasks so far...`
                  : currentPhase?.description
                }
              </motion.p>

              {/* Progress Bar */}
              <div className="w-full bg-gray-200 rounded-full h-2 mb-6">
                <motion.div
                  className="bg-gradient-to-r from-blue-500 to-purple-600 h-2 rounded-full"
                  style={{ width: isWaitingForTasks ? '85%' : `${phaseProgress}%` }}
                  transition={{ ease: "easeOut" }}
                />
              </div>

              {/* Phase Indicators - Only show if multiple phases and not waiting */}
              {generationPhases.length > 1 && !isWaitingForTasks && (
                <div className="flex justify-center space-x-3">
                  {generationPhases.map((phase, index) => (
                    <div
                      key={phase.id}
                      className={`w-3 h-3 rounded-full transition-colors duration-300 ${
                        index < currentPhaseIndex
                          ? 'bg-green-500'
                          : index === currentPhaseIndex
                          ? 'bg-blue-500'
                          : 'bg-gray-300'
                      }`}
                    />
                  ))}
                </div>
              )}

              {/* Task Count Display when waiting */}
              {isWaitingForTasks && (
                <motion.div
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="text-sm text-gray-500 mt-4"
                >
                  Tasks created: {taskCount} (waiting for at least 10 to start)
                </motion.div>
              )}
            </>
          ) : (
            /* Completion State */
            <motion.div
              initial={{ scale: 0, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              transition={{ type: "spring", duration: 0.6 }}
            >
              <div className="w-20 h-20 mx-auto bg-green-500 rounded-full flex items-center justify-center text-white shadow-lg mb-6">
                <CheckCircle className="w-8 h-8" />
              </div>
              
              <h2 className="text-2xl font-bold text-gray-900 mb-3">
                Course Generation Started!
              </h2>
              
              <p className="text-gray-600 mb-6">
                Your course is now being generated in the background. Redirecting to your dashboard to track progress...
              </p>

              <motion.div
                animate={{ x: [0, 5, 0] }}
                transition={{ duration: 1, repeat: Infinity, ease: "easeInOut" }}
                className="flex items-center justify-center text-blue-600"
              >
                <span className="mr-2">Taking you to your dashboard</span>
                <ArrowRight className="w-4 h-4" />
              </motion.div>
            </motion.div>
          )}
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
}