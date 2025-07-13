'use client';

import { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, ChevronLeft, ChevronRight } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { SurveySection } from './SurveySection';
import { useSurvey } from '@/hooks/useSurvey';
import { SurveyQuestion, SurveyResponse } from '@/types/survey';
import Image from 'next/image';

interface SurveyModalProps {
  isOpen: boolean;
  onClose: () => void;
  onComplete: () => void;
}

export function SurveyModal({ isOpen, onClose, onComplete }: SurveyModalProps) {
  const [showIntro, setShowIntro] = useState(true)
  const [showThankYou, setShowThankYou] = useState(false)
  const [currentSection, setCurrentSection] = useState(0)
  const [responses, setResponses] = useState<Record<string, any>>({})
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [startTime, setStartTime] = useState<number | null>(null)
  const contentRef = useRef<HTMLDivElement>(null)
  
  const { sections, questions, submitSurvey, isLoading } = useSurvey()

  // Scroll to top when section changes
  useEffect(() => {
    if (contentRef.current && !showIntro) {
      contentRef.current.scrollTop = 0
    }
  }, [currentSection, showIntro])

  const handleBeginSurvey = () => {
    setShowIntro(false)
    setStartTime(Date.now()) // Start tracking time when survey begins
  }

  const handleResponse = (questionId: number, value: any) => {
    setResponses(prev => ({
      ...prev,
      [questionId]: value
    }))
  }

  const handleNext = () => {
    if (currentSection < sections.length - 1) {
      setCurrentSection(currentSection + 1)
    }
  }

  const handlePrevious = () => {
    if (currentSection > 0) {
      setCurrentSection(currentSection - 1)
    }
  }

  const getDeviceInfo = () => {
    try {
      return {
        userAgent: navigator.userAgent,
        platform: navigator.platform,
        language: navigator.language,
        cookieEnabled: navigator.cookieEnabled,
        onLine: navigator.onLine,
        screenWidth: screen.width,
        screenHeight: screen.height,
        windowWidth: window.innerWidth,
        windowHeight: window.innerHeight,
        timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
        timestamp: new Date().toISOString()
      }
    } catch (error) {
      console.error('Error collecting device info:', error)
      return {
        error: 'Failed to collect device info',
        timestamp: new Date().toISOString()
      }
    }
  }

  const handleSubmit = async () => {
    setIsSubmitting(true)
    try {
      // Calculate duration in seconds
      const duration = startTime ? Math.round((Date.now() - startTime) / 1000) : 0
      
      // Collect device information
      const deviceInfo = getDeviceInfo()
      
      // Create proper submission data structure
      const submissionData = {
        responses,
        duration,
        deviceInfo
      }
      await submitSurvey(submissionData)
      setShowThankYou(true)
    } catch (error) {
      console.error('Error submitting survey:', error)
    } finally {
      setIsSubmitting(false)
    }
  }

  const handleContinueToApp = () => {
    onComplete()
  }

  const getTotalQuestions = () => {
    return questions.length;
  };

  const getAnsweredQuestions = () => {
    return Object.keys(responses).length;
  };

  const getCurrentSectionQuestions = () => {
    const currentSectionData = sections[currentSection]
    if (!currentSectionData) return []
    return questions.filter(q => q.section_id === currentSectionData.id)
  };

  const isLastSection = currentSection === sections.length - 1;
  const canProceed = getCurrentSectionQuestions().every((q: SurveyQuestion) => responses[q.id] !== undefined);

  if (!isOpen) return null;

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 bg-black/50 backdrop-blur-sm z-[9999] flex items-center justify-center p-4"
      >
        <motion.div
          initial={{ scale: 0.9, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          exit={{ scale: 0.9, opacity: 0 }}
          transition={{ type: "spring", duration: 0.5, bounce: 0.3 }}
          className="bg-white rounded-2xl shadow-2xl w-full max-w-4xl max-h-[90vh] overflow-hidden flex flex-col"
        >
          {showIntro ? (
            // Intro Modal
            <div className="p-8 text-center">
              {/* Header with improved logo visibility */}
              <div className="flex items-center justify-center mb-8">
                <Image
                  src="/Horizontal black text.png"
                  alt="Learnology AI"
                  width={280}
                  height={70}
                  className="h-12 w-auto"
                />
              </div>

              <motion.div
                initial={{ y: 20, opacity: 0 }}
                animate={{ y: 0, opacity: 1 }}
                transition={{ delay: 0.2 }}
                className="space-y-6"
              >
                <h1 className="text-h2 font-light text-slate-900">
                  Welcome to Your Learning Journey
                </h1>
                
                <div className="space-y-4 text-body text-slate-600 max-w-2xl mx-auto">
                  <p>
                    Before you dive into your <strong>free 2-month pilot program</strong>, we'd love to learn more about your homeschooling needs and challenges.
                  </p>
                  
                  <p>
                    This brief 5-minute survey is completely <strong>anonymous</strong> and helps us ensure we're providing the best solutions for your unique educational goals.
                  </p>
                  
                  <p>
                    Your insights drive our product development and help us create tools that truly make a difference in your homeschooling experience.
                  </p>
                </div>

                <motion.div
                  initial={{ y: 20, opacity: 0 }}
                  animate={{ y: 0, opacity: 1 }}
                  transition={{ delay: 0.4 }}
                  className="pt-4"
                >
                  <Button
                    onClick={handleBeginSurvey}
                    size="lg"
                    className="bg-brand-gradient hover:opacity-90 text-white px-8 py-3 rounded-xl font-medium transition-all duration-200 shadow-lg hover:shadow-xl"
                  >
                    Begin Survey
                  </Button>
                </motion.div>
              </motion.div>
            </div>
          ) : showThankYou ? (
            // Thank You Modal
            <div className="p-8 text-center">
              {/* Header with logo */}
              <div className="flex items-center justify-center mb-8">
                <Image
                  src="/Horizontal black text.png"
                  alt="Learnology AI"
                  width={280}
                  height={70}
                  className="h-12 w-auto"
                />
              </div>

              <motion.div
                initial={{ y: 20, opacity: 0 }}
                animate={{ y: 0, opacity: 1 }}
                transition={{ delay: 0.2 }}
                className="space-y-6"
              >
                <div className="mb-6">
                  <motion.div
                    initial={{ scale: 0 }}
                    animate={{ scale: 1 }}
                    transition={{ delay: 0.3, type: "spring", stiffness: 200, damping: 20 }}
                    className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4"
                  >
                    <svg className="w-8 h-8 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                    </svg>
                  </motion.div>
                  <h1 className="text-3xl font-light text-slate-900 mb-2">
                    Thank You!
                  </h1>
                  <p className="text-lg text-slate-600">
                    Your survey has been successfully submitted
                  </p>
                </div>
                
                <div className="space-y-4 text-base text-slate-600 max-w-2xl mx-auto">
                  <p>
                    We're incredibly grateful for your time and insights! Your feedback helps us build better educational tools that truly serve homeschooling families like yours.
                  </p>
                  
                  <p>
                    You're now ready to explore your <strong className="text-slate-900">free 2-month pilot program</strong>. Dive in, experiment with our AI-powered features, and discover how Learnology AI can transform your homeschooling experience.
                  </p>
                  
                  <p>
                    As you use the platform, we'd love to hear from you! Use the <strong className="text-slate-900">Feedback</strong> link in the navigation to share your thoughts, request support, or report any bugs you encounter. Your ongoing feedback helps us make Learnology AI even better.
                  </p>
                  
                  <p className="text-slate-700">
                    <strong>Happy learning!</strong> 🎓✨
                  </p>
                </div>

                <motion.div
                  initial={{ y: 20, opacity: 0 }}
                  animate={{ y: 0, opacity: 1 }}
                  transition={{ delay: 0.6 }}
                  className="pt-6"
                >
                  <Button
                    onClick={handleContinueToApp}
                    size="lg"
                    className="bg-brand-gradient hover:opacity-90 text-white px-8 py-3 rounded-xl font-medium transition-all duration-200 shadow-lg hover:shadow-xl"
                  >
                    Continue to Learnology AI
                  </Button>
                </motion.div>
              </motion.div>
            </div>
          ) : (
            // Main Survey
            <>
              {/* Header with improved logo visibility */}
              <div className="bg-white px-8 py-6 border-b border-slate-200">
                <div className="flex items-center justify-between">
                  <div className="flex items-center space-x-6">
                    <Image
                      src="/Horizontal black text.png"
                      alt="Learnology AI"
                      width={200}
                      height={50}
                      className="h-10 w-auto"
                    />
                    <div>
                      <h1 className="text-xl font-medium text-slate-900">
                        Welcome to Learnology AI
                      </h1>
                      <p className="text-sm text-slate-700 mt-1">
                        Help us personalize your learning experience
                      </p>
                    </div>
                  </div>
                  
                  <div className="text-right">
                    <p className="text-sm font-medium text-slate-900">
                      {currentSection + 1} of {sections.length}
                    </p>
                  </div>
                </div>

                {/* Progress */}
                <div className="mt-6 space-y-2">
                  <div className="flex justify-between text-sm font-medium text-slate-900">
                    <span>Progress</span>
                    <span>{getAnsweredQuestions()} of {getTotalQuestions()} questions</span>
                  </div>
                  <Progress 
                    value={(getAnsweredQuestions() / getTotalQuestions()) * 100} 
                    className="h-2 bg-slate-200"
                  />
                </div>

                {/* Section Navigation */}
                <div className="flex space-x-2 mt-6">
                  {sections.map((section, index) => (
                    <button
                      key={section.id}
                      onClick={() => setCurrentSection(index)}
                      className={`px-4 py-2 rounded-lg text-sm font-medium transition-all duration-200 ${
                        index === currentSection
                          ? 'bg-slate-900 text-white shadow-sm'
                          : 'text-slate-700 hover:text-slate-900 hover:bg-slate-100'
                      }`}
                    >
                      {section.title}
                    </button>
                  ))}
                </div>
              </div>

              {/* Content */}
              <div className="flex-1 overflow-y-auto min-h-0" ref={contentRef}>
                <AnimatePresence mode="wait">
                  <motion.div
                    key={currentSection}
                    initial={{ opacity: 0, x: 20 }}
                    animate={{ opacity: 1, x: 0 }}
                    exit={{ opacity: 0, x: -20 }}
                    transition={{ 
                      type: "spring", 
                      stiffness: 300, 
                      damping: 30,
                      duration: 0.3
                    }}
                    className="p-8"
                  >
                    {sections[currentSection] && (
                      <SurveySection
                        section={sections[currentSection]}
                        questions={getCurrentSectionQuestions()}
                        responses={responses}
                        onResponse={handleResponse}
                      />
                    )}
                  </motion.div>
                </AnimatePresence>
              </div>

              {/* Footer */}
              <div className="border-t border-slate-200 p-6 bg-slate-50">
                <div className="flex justify-between items-center">
                  <Button
                    variant="ghost"
                    onClick={handlePrevious}
                    disabled={currentSection === 0}
                    className="flex items-center space-x-2 text-slate-600 hover:text-slate-900"
                  >
                    <ChevronLeft className="w-4 h-4" />
                    <span>Previous</span>
                  </Button>

                  <div className="flex space-x-3">
                    {isLastSection ? (
                      <Button
                        onClick={handleSubmit}
                        disabled={!canProceed || isSubmitting}
                        className="bg-brand-gradient hover:opacity-90 text-white px-6 py-2 rounded-lg font-medium transition-all duration-200 shadow-sm hover:shadow-md"
                      >
                        {isSubmitting ? 'Submitting...' : 'Complete Survey'}
                      </Button>
                    ) : (
                      <Button
                        onClick={handleNext}
                        disabled={!canProceed}
                        className="bg-brand-gradient hover:opacity-90 text-white px-6 py-2 rounded-lg font-medium transition-all duration-200 shadow-sm hover:shadow-md flex items-center space-x-2"
                      >
                        <span>Next</span>
                        <ChevronRight className="w-4 h-4" />
                      </Button>
                    )}
                  </div>
                </div>
              </div>
            </>
          )}
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
} 