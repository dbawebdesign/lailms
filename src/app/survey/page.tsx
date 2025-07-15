'use client';

import { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { ChevronLeft, ChevronRight, Mail } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import PublicSurveySection from '@/components/survey/PublicSurveySection';
import { usePublicSurvey } from '@/hooks/usePublicSurvey';
import { PublicSurveyQuestion } from '@/types/publicSurvey';
import Image from 'next/image';

export default function PublicSurveyPage() {
  const [showIntro, setShowIntro] = useState(true);
  const [showThankYou, setShowThankYou] = useState(false);
  const [currentSection, setCurrentSection] = useState(0);
  const [responses, setResponses] = useState<Record<string, any>>({});
  const [email, setEmail] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [startTime, setStartTime] = useState<number | null>(null);
  const contentRef = useRef<HTMLDivElement>(null);
  
  const { sections, questions, submitSurvey, isLoading } = usePublicSurvey();

  // Scroll to top when section changes
  useEffect(() => {
    if (contentRef.current && !showIntro) {
      contentRef.current.scrollTop = 0;
    }
  }, [currentSection, showIntro]);

  const handleBeginSurvey = () => {
    setShowIntro(false);
    setStartTime(Date.now());
  };

  const handleResponse = (questionId: number, value: any) => {
    setResponses(prev => ({
      ...prev,
      [questionId]: value
    }));
  };

  const handleNext = () => {
    if (currentSection < sections.length - 1) {
      setCurrentSection(currentSection + 1);
    }
  };

  const handlePrevious = () => {
    if (currentSection > 0) {
      setCurrentSection(currentSection - 1);
    }
  };

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
      };
    } catch (error) {
      console.error('Error collecting device info:', error);
      return {
        error: 'Failed to collect device info',
        timestamp: new Date().toISOString()
      };
    }
  };

  const handleSubmit = async () => {
    setIsSubmitting(true);
    try {
      const duration = startTime ? Math.round((Date.now() - startTime) / 1000) : 0;
      const deviceInfo = getDeviceInfo();
      
      // Convert responses object to array format expected by API
      const responseArray = Object.entries(responses).map(([questionId, answer]) => ({
        question_id: parseInt(questionId),
        answer: Array.isArray(answer) ? JSON.stringify(answer) : String(answer)
      }));
      
      const submissionData = {
        responses: responseArray,
        duration,
        deviceInfo,
        email: email.trim() || undefined
      };

      await submitSurvey(submissionData);
      setShowThankYou(true);
    } catch (error) {
      console.error('Error submitting survey:', error);
      // Handle error - could show an error message
    } finally {
      setIsSubmitting(false);
    }
  };

  const getCurrentSectionQuestions = (): PublicSurveyQuestion[] => {
    if (!sections[currentSection]) return [];
    return questions.filter(q => q.section_id === sections[currentSection].id);
  };

  const getAnsweredQuestions = (): number => {
    return Object.keys(responses).length;
  };

  const getTotalQuestions = (): number => {
    return questions.length;
  };

  const getCurrentSectionAnsweredQuestions = (): number => {
    const currentQuestions = getCurrentSectionQuestions();
    return currentQuestions.filter(q => responses[q.id] !== undefined).length;
  };

  const isCurrentSectionComplete = (): boolean => {
    const currentQuestions = getCurrentSectionQuestions();
    const requiredQuestions = currentQuestions.filter(q => q.required);
    return requiredQuestions.every(q => responses[q.id] !== undefined && responses[q.id] !== '');
  };

  const canProceed = isCurrentSectionComplete();
  const isLastSection = currentSection === sections.length - 1;

  if (isLoading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 flex items-center justify-center">
        <div className="bg-white rounded-2xl p-8 shadow-xl text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto mb-4"></div>
          <p className="text-gray-600">Loading survey...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100">
      <AnimatePresence mode="wait">
        <motion.div
          key={showIntro ? 'intro' : showThankYou ? 'thanks' : 'survey'}
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          exit={{ opacity: 0, scale: 0.95 }}
          transition={{ duration: 0.3 }}
          className="min-h-screen flex items-center justify-center p-4"
        >
          {showIntro ? (
            // Intro Screen
            <div className="bg-white rounded-2xl shadow-2xl max-w-2xl w-full p-8 text-center">
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
                <div>
                  <h1 className="text-3xl font-light text-slate-900 mb-4">
                    Homeschool Community Survey
                  </h1>
                  <p className="text-lg text-slate-600 leading-relaxed">
                    Help us understand the homeschooling community and build better educational tools together.
                  </p>
                </div>

                <div className="bg-blue-50 rounded-xl p-6 text-left space-y-4">
                  <h2 className="text-xl font-medium text-slate-900">What to expect:</h2>
                  <ul className="space-y-2 text-slate-700">
                    <li className="flex items-start">
                      <span className="text-blue-600 mr-2">•</span>
                      <span><strong>5-7 minutes</strong> to complete</span>
                    </li>
                    <li className="flex items-start">
                      <span className="text-blue-600 mr-2">•</span>
                      <span><strong>Anonymous</strong> responses (email is optional)</span>
                    </li>
                    <li className="flex items-start">
                      <span className="text-blue-600 mr-2">•</span>
                      <span><strong>4 sections</strong> covering challenges, interests, and demographics</span>
                    </li>
                    <li className="flex items-start">
                      <span className="text-blue-600 mr-2">•</span>
                      <span>Your input helps shape the future of <strong>homeschool technology</strong></span>
                    </li>
                  </ul>
                </div>

                <div className="space-y-4">
                  <div className="flex items-center justify-center space-x-4">
                    <Mail className="w-5 h-5 text-slate-500" />
                    <div className="flex-1">
                      <Label htmlFor="email" className="text-sm font-medium text-slate-700">
                        Email (optional - for follow-up)
                      </Label>
                      <Input
                        id="email"
                        type="email"
                        placeholder="your@email.com"
                        value={email}
                        onChange={(e) => setEmail(e.target.value)}
                        className="mt-1"
                      />
                    </div>
                  </div>

                  <Button
                    onClick={handleBeginSurvey}
                    size="lg"
                    className="w-full bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white px-8 py-3 rounded-xl font-medium transition-all duration-200 shadow-lg hover:shadow-xl"
                  >
                    Begin Survey
                  </Button>
                </div>
              </motion.div>
            </div>
          ) : showThankYou ? (
            // Thank You Screen
            <div className="bg-white rounded-2xl shadow-2xl max-w-2xl w-full p-8 text-center">
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
                
                <div className="space-y-4 text-base text-slate-600 max-w-xl mx-auto">
                  <p>
                    We're incredibly grateful for your time and insights! Your feedback helps us understand the homeschooling community better and build tools that truly serve families like yours.
                  </p>
                  
                  <p>
                    Your responses will help shape the future of educational technology for homeschoolers. We're committed to creating solutions that address real challenges and support your educational journey.
                  </p>
                  
                  <p className="text-slate-700">
                    <strong>Thank you for being part of our community!</strong> 🎓✨
                  </p>
                </div>

                <motion.div
                  initial={{ y: 20, opacity: 0 }}
                  animate={{ y: 0, opacity: 1 }}
                  transition={{ delay: 0.6 }}
                  className="pt-6"
                >
                  <Button
                    onClick={() => window.location.href = '/'}
                    size="lg"
                    className="bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white px-8 py-3 rounded-xl font-medium transition-all duration-200 shadow-lg hover:shadow-xl"
                  >
                    Learn More About Learnology AI
                  </Button>
                </motion.div>
              </motion.div>
            </div>
          ) : (
            // Main Survey
            <div className="bg-white rounded-2xl shadow-2xl max-w-4xl w-full max-h-[90vh] flex flex-col">
              {/* Header */}
              <div className="bg-white px-8 py-6 border-b border-slate-200 rounded-t-2xl">
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
                        Homeschool Community Survey
                      </h1>
                      <p className="text-sm text-slate-700 mt-1">
                        Help us understand your needs and challenges
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
                      <PublicSurveySection
                        section={sections[currentSection]}
                        questions={getCurrentSectionQuestions()}
                        responses={responses}
                        onResponseChange={handleResponse}
                      />
                    )}
                  </motion.div>
                </AnimatePresence>
              </div>

              {/* Footer */}
              <div className="border-t border-slate-200 p-6 bg-slate-50 rounded-b-2xl">
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
                        className="bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white px-6 py-2 rounded-lg font-medium transition-all duration-200 shadow-sm hover:shadow-md"
                      >
                        {isSubmitting ? 'Submitting...' : 'Complete Survey'}
                      </Button>
                    ) : (
                      <Button
                        onClick={handleNext}
                        disabled={!canProceed}
                        className="bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white px-6 py-2 rounded-lg font-medium transition-all duration-200 shadow-sm hover:shadow-md flex items-center space-x-2"
                      >
                        <span>Next</span>
                        <ChevronRight className="w-4 h-4" />
                      </Button>
                    )}
                  </div>
                </div>
              </div>
            </div>
          )}
        </motion.div>
      </AnimatePresence>
    </div>
  );
} 