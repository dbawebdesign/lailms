/**
 * NEW ASSESSMENT SCHEMA COMPONENT (V2)
 * 
 * This component is specifically designed for the new 4-table assessment schema
 * and should be used for all new assessment taking functionality.
 * 
 * DO NOT confuse with legacy AssessmentTaker in src/components/student/
 */

'use client';

import { useState, useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { NewSchemaAssessment, NewSchemaQuestion, NewSchemaStudentAttempt, NewSchemaStudentResponse } from './types/newSchemaTypes';
import { useLunaContextControl } from '@/context/LunaContextProvider';

import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Skeleton } from '@/components/ui/skeleton';
import { Badge } from '@/components/ui/badge';
import { Trophy, CheckCircle, Clock, ArrowLeft } from 'lucide-react';

import { NewSchemaQuestionMultipleChoice } from './questions/NewSchemaQuestionMultipleChoice';
import { NewSchemaQuestionTrueFalse } from './questions/NewSchemaQuestionTrueFalse';
import { NewSchemaQuestionShortAnswer } from './questions/NewSchemaQuestionShortAnswer';
import { NewSchemaQuestionEssay } from './questions/NewSchemaQuestionEssay';
import { NewSchemaQuestionMatching } from './questions/NewSchemaQuestionMatching';

// @ts-ignore - js-confetti doesn't have types
import JSConfetti from 'js-confetti';

interface NewSchemaAssessmentTakerProps {
  assessmentId: string;
  onComplete?: (attemptId: string) => void;
  className?: string;
}

interface AssessmentResults {
  success: boolean;
  attemptId: string;
  totalPoints: number;
  earnedPoints: number;
  percentageScore: number;
  passed: boolean | null;
  needsAiGrading: boolean;
  message: string;
}

export function NewSchemaAssessmentTaker({ 
  assessmentId, 
  onComplete,
  className 
}: NewSchemaAssessmentTakerProps) {
  const router = useRouter();
  const { registerComponent, updateComponent, unregisterComponent } = useLunaContextControl();
  const lunaComponentId = useRef<string | null>(null);
  
  // State management following new schema structure
  const [assessment, setAssessment] = useState<NewSchemaAssessment | null>(null);
  const [questions, setQuestions] = useState<NewSchemaQuestion[]>([]);
  const [currentAttempt, setCurrentAttempt] = useState<NewSchemaStudentAttempt | null>(null);
  const [currentQuestionIndex, setCurrentQuestionIndex] = useState(0);
  const [responses, setResponses] = useState<NewSchemaStudentResponse[]>([]);
  const [timeSpent, setTimeSpent] = useState(0);
  
  // UI state
  const [loading, setLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  
  // Prevent concurrent initialization - use a more robust approach
  const initializingRef = useRef(false);
  const initializationPromiseRef = useRef<Promise<void> | null>(null);

  // New completion state
  const [isCompleted, setIsCompleted] = useState(false);
  const [completionResults, setCompletionResults] = useState<AssessmentResults | null>(null);
  const [showScore, setShowScore] = useState(false);
  const [justGraded, setJustGraded] = useState(false);
  
  const confettiRef = useRef<JSConfetti | null>(null);
  const timerRef = useRef<NodeJS.Timeout | null>(null);
  const pollTimerRef = useRef<NodeJS.Timeout | null>(null);

  // Register component with Luna on mount
  useEffect(() => {
    const componentId = registerComponent({
      type: 'AssessmentTaker',
      role: 'StudentAssessment',
      props: { assessmentId },
    });
    lunaComponentId.current = componentId;

    return () => {
      if (componentId) {
        unregisterComponent(componentId);
      }
    };
  }, [assessmentId, registerComponent, unregisterComponent]);

  // Update Luna context when data changes
  useEffect(() => {
    if (!lunaComponentId.current || !assessment) return;

    const currentQuestion = questions[currentQuestionIndex];
    if (!currentQuestion) return;

    const currentResponse = responses.find(r => r.question_id === currentQuestion.id);

    updateComponent(lunaComponentId.current, {
      state: {
        currentQuestionIndex,
        totalQuestions: questions.length,
        timeSpent,
        isLastQuestion: currentQuestionIndex === questions.length - 1,
      },
      content: {
        assessment,
        questions, 
        currentQuestion: {
          ...currentQuestion,
          question_data: currentQuestion.question_data,
        },
        currentResponse: currentResponse || null,
      },
      metadata: {
        componentPurpose: 'This component renders a single question in an assessment. Luna should use the provided context, including the correct answer data, to help the student understand the material without giving away the answer directly unless specifically instructed.',
      }
    });
  }, [
    assessment, 
    questions, 
    currentQuestionIndex, 
    timeSpent, 
    updateComponent,
    responses
  ]);

  // Timer for tracking time spent
  useEffect(() => {
    if (!isCompleted) {
      timerRef.current = setInterval(() => {
        setTimeSpent(prev => prev + 1);
      }, 1000);
    }

    return () => {
      if (timerRef.current) {
        clearInterval(timerRef.current);
        timerRef.current = null;
      }
    };
  }, [isCompleted]);

  // Initialize assessment attempt
  useEffect(() => {
    if (!assessmentId) return;
    
    // If already initializing, wait for the existing promise
    if (initializingRef.current && initializationPromiseRef.current) {
      return;
    }

    const initializeAttempt = async () => {
      // Double-check to prevent race conditions
      if (initializingRef.current) return;
      
      initializingRef.current = true;
      setLoading(true);
      setError(null);
      
      try {
        const response = await fetch('/api/learn/assessments/start', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ assessmentId }),
        });

        if (!response.ok) {
          const errorData = await response.json();
          throw new Error(errorData.error || errorData.message || 'Failed to start assessment');
        }

        const data = await response.json();
        setAssessment(data.assessment);
        setQuestions(data.questions);
        setCurrentAttempt(data.attempt);
        
      } catch (err: any) {
        console.error('Error initializing assessment:', err);
        setError(err.message);
      } finally {
        setLoading(false);
        initializingRef.current = false;
        initializationPromiseRef.current = null;
      }
    };

    // Store the promise to prevent duplicate calls
    initializationPromiseRef.current = initializeAttempt();

    // Don't reset the ref in cleanup - let the async function handle it
    return () => {
      // Only reset if the component is truly unmounting
      // The async function will reset initializingRef when it completes
    };
  }, [assessmentId]);

  // Initialize confetti
  useEffect(() => {
    confettiRef.current = new JSConfetti();
    return () => {
      confettiRef.current = null;
    };
  }, []);

  // Poll for AI grading completion
  const pollGradingStatus = async (attemptId: string) => {
    try {
      const response = await fetch(`/api/learn/assessments/status?attemptId=${attemptId}`);
      if (!response.ok) return;
      
      const statusData = await response.json();
      
      // If grading is complete, update the results
      if (statusData.isGradingComplete && completionResults) {
        setJustGraded(true);
        setCompletionResults({
          ...completionResults,
          totalPoints: statusData.totalPoints,
          earnedPoints: statusData.earnedPoints,
          percentageScore: statusData.percentageScore,
          passed: statusData.passed,
          needsAiGrading: false,
          message: statusData.gradingFailed 
            ? 'Grading completed with some issues. Please contact support if needed.'
            : 'Assessment graded successfully!'
        });
        
        // Stop polling
        if (pollTimerRef.current) {
          clearInterval(pollTimerRef.current);
          pollTimerRef.current = null;
        }
        
        // Trigger a celebratory confetti burst for the final score
        if (confettiRef.current && !statusData.gradingFailed) {
          setTimeout(() => {
            if (confettiRef.current) {
              confettiRef.current.addConfetti({
                confettiColors: ['#4ade80', '#22c55e', '#16a34a'],
                confettiRadius: 5,
                confettiNumber: 150,
              });
            }
          }, 500);
        }
        
        // Reset the "just graded" indicator after animation
        setTimeout(() => {
          setJustGraded(false);
        }, 2000);
      }
    } catch (error) {
      console.error('Error polling grading status:', error);
    }
  };

  // Start polling when AI grading is needed
  useEffect(() => {
    if (completionResults?.needsAiGrading && completionResults.attemptId) {
      // Start polling every 3 seconds
      pollTimerRef.current = setInterval(() => {
        pollGradingStatus(completionResults.attemptId);
      }, 3000);
      
      // Stop polling after 10 minutes to prevent infinite polling
      setTimeout(() => {
        if (pollTimerRef.current) {
          clearInterval(pollTimerRef.current);
          pollTimerRef.current = null;
        }
      }, 600000); // 10 minutes
    }
    
    return () => {
      if (pollTimerRef.current) {
        clearInterval(pollTimerRef.current);
        pollTimerRef.current = null;
      }
    };
  }, [completionResults?.needsAiGrading, completionResults?.attemptId, completionResults]);

  // Handle answer changes
  const handleAnswerChange = (questionId: string, responseData: any) => {
    setResponses(prev => {
      const existingIndex = prev.findIndex(r => r.question_id === questionId);
      const newResponse: NewSchemaStudentResponse = {
        id: existingIndex > -1 ? prev[existingIndex].id : `temp-${Date.now()}`,
        attempt_id: currentAttempt?.id || '',
        question_id: questionId,
        response_data: responseData,

        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
        is_correct: undefined, // Will be determined by grading
        manual_score: undefined,
        ai_graded_at: undefined,
        ai_confidence: undefined,
        manually_graded_at: undefined,
        manually_graded_by: undefined
      };

      if (existingIndex > -1) {
        const updated = [...prev];
        updated[existingIndex] = newResponse;
        return updated;
      }
      
      return [...prev, newResponse];
    });
  };

  // Submit assessment
  const handleSubmit = async () => {
    if (!currentAttempt) return;
    
    setIsSubmitting(true);
    setError(null);
    
    try {
      const response = await fetch('/api/learn/assessments/submit', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          attemptId: currentAttempt.id,
          responses: responses,
          timeSpent: Math.floor(timeSpent / 60), // Convert seconds to minutes
          isSubmission: true,
        }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.message || 'Failed to submit assessment');
      }
      
      const result: AssessmentResults = await response.json();
      
      // Stop the timer immediately
      if (timerRef.current) {
        clearInterval(timerRef.current);
        timerRef.current = null;
      }
      
      // Set completion state and trigger confetti
      setCompletionResults(result);
      setIsCompleted(true);
      
      // Trigger spectacular confetti animation
      if (confettiRef.current) {
        // Initial burst
        confettiRef.current.addConfetti({
          confettiRadius: 6,
          confettiNumber: 300,
        });
        
        // Second burst with different colors after a short delay
        setTimeout(() => {
          if (confettiRef.current) {
            confettiRef.current.addConfetti({
              confettiColors: ['#ff6b6b', '#4ecdc4', '#45b7d1', '#96ceb4', '#ffeaa7', '#dda0dd'],
              confettiRadius: 8,
              confettiNumber: 200,
            });
          }
        }, 300);
        
        // Final celebratory burst
        setTimeout(() => {
          if (confettiRef.current) {
            confettiRef.current.addConfetti({
              emojis: ['🎉', '🎊', '⭐', '🏆'],
              emojiSize: 50,
              confettiNumber: 50,
            });
          }
        }, 600);
      }
      
      // Show score after a short delay
      setTimeout(() => {
        setShowScore(true);
      }, 1500);
      
    } catch (err: any) {
      console.error('Error submitting assessment:', err);
      setError(err.message);
    } finally {
      setIsSubmitting(false);
    }
  };

  // Render question based on type
  const renderQuestion = (question: NewSchemaQuestion) => {
    const response = responses.find(r => r.question_id === question.id);
    const responseData = response?.response_data;

    switch (question.question_type) {
      case 'multiple_choice':
        return (
          <NewSchemaQuestionMultipleChoice
            question={question}
            value={responseData?.selected_option}
            onChange={(value) => handleAnswerChange(question.id, { selected_option: value })}
          />
        );
      
      case 'true_false':
        return (
          <NewSchemaQuestionTrueFalse
            question={question}
            value={responseData?.selected_answer}
            onChange={(value) => handleAnswerChange(question.id, { selected_answer: value })}
          />
        );
      
      case 'short_answer':
        return (
          <NewSchemaQuestionShortAnswer
            question={question}
            value={responseData?.text_answer}
            onChange={(value) => handleAnswerChange(question.id, { text_answer: value })}
          />
        );
      
      case 'essay':
        return (
          <NewSchemaQuestionEssay
            question={question}
            value={responseData?.essay_text}
            onChange={(value) => handleAnswerChange(question.id, { essay_text: value, word_count: value?.length || 0 })}
          />
        );
      
      case 'matching':
        return (
          <NewSchemaQuestionMatching
            question={question}
            value={responseData?.matches}
            onChange={(value) => handleAnswerChange(question.id, { matches: value })}
          />
        );
      
      default:
        return (
          <Alert>
            <AlertDescription>
              Unsupported question type: {question.question_type}
            </AlertDescription>
          </Alert>
        );
    }
  };

  // Loading state
  if (loading) {
    return (
      <div className={`container mx-auto p-6 max-w-4xl ${className || ''}`}>
        <Card>
          <CardHeader className="space-y-6">
            <Skeleton className="h-8 w-3/4" />
            <Skeleton className="h-4 w-full" />
            <Skeleton className="h-2 w-full" />
          </CardHeader>
          <CardContent className="space-y-6">
            <Skeleton className="h-6 w-full" />
            <div className="space-y-4">
              <Skeleton className="h-10 w-full" />
              <Skeleton className="h-10 w-full" />
              <Skeleton className="h-10 w-full" />
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  // Error state
  if (error) {
    return (
      <div className={`container mx-auto p-6 max-w-4xl ${className || ''}`}>
        <Alert variant="destructive">
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      </div>
    );
  }

  // No assessment found
  if (!assessment || questions.length === 0) {
    return (
      <div className={`container mx-auto p-6 max-w-4xl ${className || ''}`}>
        <Alert>
          <AlertDescription>
            Assessment not found or contains no questions.
          </AlertDescription>
        </Alert>
      </div>
    );
  }

  const currentQuestion = questions[currentQuestionIndex];
  const progressValue = ((currentQuestionIndex + 1) / questions.length) * 100;
  const isLastQuestion = currentQuestionIndex === questions.length - 1;
  const canGoNext = responses.some(r => r.question_id === currentQuestion.id);



  // Handle navigation back
  const handleNavigateBack = () => {
    // Stop polling when navigating away
    if (pollTimerRef.current) {
      clearInterval(pollTimerRef.current);
      pollTimerRef.current = null;
    }
    
    if (onComplete && completionResults) {
      onComplete(completionResults.attemptId);
    } else {
      router.back();
    }
  };

  // Completion screen
  if (isCompleted && completionResults) {
    return (
      <div className={`container mx-auto p-6 max-w-4xl ${className || ''}`}>
        <div className="flex items-center justify-center min-h-[60vh]">
          <Card className="w-full max-w-2xl shadow-2xl border-0 bg-gradient-to-br from-background to-muted/20">
            <CardContent className="p-12 text-center space-y-8">
              {/* Celebration Icon */}
              <div className="flex justify-center">
                <Trophy className="h-20 w-20 text-yellow-500 animate-bounce" />
              </div>

              {/* Completion Message */}
              <div className="space-y-4">
                <h1 className="text-4xl font-bold text-foreground">
                  Assessment Complete!
                </h1>
                <p className="text-lg text-muted-foreground">
                  Congratulations! You've successfully completed the assessment.
                </p>
              </div>

              {/* Score Display */}
              {showScore && (
                <div className="space-y-6 animate-in slide-in-from-bottom-4 duration-700">
                  <div className="bg-gradient-to-r from-primary/10 to-primary/5 rounded-xl p-8 border">
                    <div className="space-y-4">
                      <p className="text-sm font-medium text-muted-foreground uppercase tracking-wide">
                        Your Score
                      </p>
                                             <div className="text-6xl font-bold text-primary transition-all duration-1000">
                         {completionResults.needsAiGrading ? (
                           <div className="flex items-center justify-center gap-3">
                             <Clock className="h-12 w-12 animate-spin" />
                             <span className="text-3xl">Grading...</span>
                           </div>
                         ) : (
                           <div className="animate-in zoom-in-50 duration-700">
                             {Math.round(completionResults.percentageScore)}%
                           </div>
                         )}
                       </div>
                      
                      {!completionResults.needsAiGrading && (
                        <Badge 
                          variant={completionResults.passed ? 'default' : 'destructive'} 
                          className="text-lg px-4 py-2"
                        >
                          {completionResults.passed ? 'Passed' : 'Failed'}
                        </Badge>
                      )}
                      
                                             {completionResults.needsAiGrading && (
                         <div className="space-y-2">
                           <Badge variant="outline" className="text-sm px-3 py-1">
                             AI Grading in Progress
                           </Badge>
                           <p className="text-sm text-muted-foreground">
                             Your essay and short answer questions are being graded. 
                             Final results will be available shortly.
                           </p>
                         </div>
                       )}
                       
                       {justGraded && (
                         <div className="animate-in slide-in-from-bottom-2 duration-500">
                           <Badge variant="default" className="text-sm px-3 py-1 bg-green-500">
                             ✨ Grading Complete!
                           </Badge>
                         </div>
                       )}
                    </div>
                  </div>

                  {/* Score Breakdown */}
                  <div className="grid grid-cols-2 gap-4 text-sm">
                    <div className="bg-muted/50 rounded-lg p-4">
                      <p className="font-medium text-muted-foreground">Points Earned</p>
                      <p className="text-2xl font-bold">
                        {completionResults.earnedPoints} / {completionResults.totalPoints}
                      </p>
                    </div>
                    <div className="bg-muted/50 rounded-lg p-4">
                      <p className="font-medium text-muted-foreground">Time Spent</p>
                      <p className="text-2xl font-bold">
                        {Math.floor(timeSpent / 60)}:{(timeSpent % 60).toString().padStart(2, '0')}
                      </p>
                    </div>
                  </div>

                  {/* Navigation Button */}
                  <Button 
                    onClick={handleNavigateBack}
                    size="lg" 
                    className="w-full max-w-sm mx-auto text-lg py-6"
                  >
                    <ArrowLeft className="h-5 w-5 mr-2" />
                    Continue Learning
                  </Button>
                </div>
              )}

              {/* Loading state while waiting for score */}
              {!showScore && (
                <div className="space-y-4">
                  <div className="animate-pulse">
                    <div className="h-4 bg-muted rounded w-3/4 mx-auto mb-4"></div>
                    <div className="h-16 bg-muted rounded w-1/2 mx-auto"></div>
                  </div>
                  <p className="text-sm text-muted-foreground">
                    Calculating your results...
                  </p>
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    );
  }

  return (
    <div className={`container mx-auto p-6 max-w-4xl ${className || ''}`}>
      <Card className="shadow-lg">
        {/* Header with progress */}
        <CardHeader className="space-y-6">
          <div>
            <CardTitle className="text-2xl font-semibold text-foreground">
              {assessment.title}
            </CardTitle>
            {assessment.description && (
              <CardDescription className="mt-2 text-base text-muted-foreground">
                {assessment.description}
              </CardDescription>
            )}
          </div>
          
          {/* Progress indicator */}
          <div className="space-y-3">
            <Progress 
              value={progressValue} 
              className="h-2"
              aria-label={`${Math.round(progressValue)}% complete`} 
            />
            <div className="flex justify-between items-center text-sm text-muted-foreground">
              <span>Question {currentQuestionIndex + 1} of {questions.length}</span>
              <span>Time: {Math.floor(timeSpent / 60)}:{(timeSpent % 60).toString().padStart(2, '0')}</span>
            </div>
          </div>
        </CardHeader>

        {/* Question content */}
        <CardContent className="space-y-8">
          <div>
            <h2 className="text-lg font-medium text-foreground mb-6">
              {currentQuestion.question_text}
            </h2>
            {renderQuestion(currentQuestion)}
          </div>
        </CardContent>

        {/* Navigation footer */}
        <CardFooter className="flex justify-between items-center pt-6">
          <Button 
            onClick={() => setCurrentQuestionIndex(prev => Math.max(0, prev - 1))}
            disabled={currentQuestionIndex === 0}
            variant="outline"
            size="lg"
          >
            Previous
          </Button>
          
          <div className="flex gap-3">
            {!isLastQuestion ? (
              <Button 
                onClick={() => setCurrentQuestionIndex(prev => Math.min(questions.length - 1, prev + 1))}
                disabled={!canGoNext}
                size="lg"
              >
                Next
              </Button>
            ) : (
              <Button 
                onClick={handleSubmit}
                disabled={isSubmitting || !canGoNext}
                size="lg"
                className="min-w-[120px]"
              >
                {isSubmitting ? 'Submitting...' : 'Submit Assessment'}
              </Button>
            )}
          </div>
        </CardFooter>
      </Card>
    </div>
  );
} 