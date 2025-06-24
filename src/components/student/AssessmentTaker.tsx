import { useState, useEffect, useCallback, useRef } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import { 
  NewSchemaAssessment, 
  NewSchemaQuestion, 
  NewSchemaStudentAttempt,
  NewSchemaStudentResponse,
  NewSchemaQuestionType
} from '@/components/assessments/v2/types/newSchemaTypes';

import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Clock, AlertCircle, Keyboard } from 'lucide-react';
import { SkipToMain } from '@/components/ui/skip-link';
import { TimerAnnouncement, StatusAnnouncement, AlertAnnouncement } from '@/components/ui/live-region';

interface StudentResponse {
  questionId: string;
  answer: any;
  timeSpent?: number; // Track time spent on each question
}

interface AssessmentAttemptData {
  assessment: NewSchemaAssessment;
  questions: NewSchemaQuestion[];
  attempt: NewSchemaStudentAttempt;
  existingResponses?: NewSchemaStudentResponse[];
}

const AssessmentTaker = () => {
  const router = useRouter();
  const searchParams = useSearchParams();
  const assessmentId = searchParams.get('id');

  // Refs for focus management
  const questionRef = useRef<HTMLDivElement>(null);
  const prevButtonRef = useRef<HTMLButtonElement>(null);
  const nextButtonRef = useRef<HTMLButtonElement>(null);
  const submitButtonRef = useRef<HTMLButtonElement>(null);

  const [attemptData, setAttemptData] = useState<AssessmentAttemptData | null>(null);
  const [currentQuestionIndex, setCurrentQuestionIndex] = useState(0);
  const [responses, setResponses] = useState<StudentResponse[]>([]);
  const [loading, setLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [timeRemaining, setTimeRemaining] = useState<number | null>(null);
  const [questionStartTime, setQuestionStartTime] = useState<number>(Date.now());
  const [lastTimerAnnouncement, setLastTimerAnnouncement] = useState<number | null>(null);
  const [showKeyboardHelp, setShowKeyboardHelp] = useState(false);

  const handleSubmit = useCallback(async () => {
    if (!attemptData) return;

    setIsSubmitting(true);
    setError(null);
    try {
      const response = await fetch('/api/teach/assessments/attempt', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          attemptId: attemptData.attempt.id,
          responses: responses,
          isSubmission: true,
        }),
      });

      if (!response.ok) throw new Error('Failed to submit assessment');
      
      const results = await response.json();
      router.push(`/assessments/results/${results.attemptId}`);
    } catch (err: any) {
      console.error('Error submitting assessment:', err);
      setError(err.message);
    } finally {
      setIsSubmitting(false);
    }
  }, [attemptData, responses, router]);

  // Keyboard navigation handler
  const handleKeyDown = useCallback((event: KeyboardEvent) => {
    // Don't interfere with typing in text areas or inputs
    if (event.target instanceof HTMLTextAreaElement || 
        event.target instanceof HTMLInputElement ||
        (event.target as HTMLElement)?.isContentEditable) {
      return;
    }

    // Handle keyboard shortcuts
    switch (event.key) {
      case 'ArrowLeft':
      case 'ArrowUp':
        if (event.ctrlKey || event.metaKey) {
          event.preventDefault();
          handleQuestionNavigation('prev');
        }
        break;
      
      case 'ArrowRight':
      case 'ArrowDown':
        if (event.ctrlKey || event.metaKey) {
          event.preventDefault();
          handleQuestionNavigation('next');
        }
        break;
      
      case 'Enter':
        if (event.ctrlKey || event.metaKey) {
          event.preventDefault();
          if (attemptData && currentQuestionIndex === attemptData.questions.length - 1) {
            handleSubmit();
          } else {
            handleQuestionNavigation('next');
          }
        }
        break;
      
      case 'h':
      case 'H':
        if (event.ctrlKey || event.metaKey) {
          event.preventDefault();
          setShowKeyboardHelp(prev => !prev);
        }
        break;
      
      case 'Escape':
        if (showKeyboardHelp) {
          event.preventDefault();
          setShowKeyboardHelp(false);
        }
        break;
      
      // Number keys for multiple choice (1-9)
      case '1':
      case '2':
      case '3':
      case '4':
      case '5':
      case '6':
      case '7':
      case '8':
      case '9':
        if (attemptData && !event.ctrlKey && !event.metaKey) {
          const currentQuestion = attemptData.questions[currentQuestionIndex];
          if (currentQuestion.question_type === 'multiple_choice') {
            const optionIndex = parseInt(event.key) - 1;
            const options = currentQuestion.answer_key?.options || [];
            if (optionIndex < options.length) {
              event.preventDefault();
              handleAnswerChange(currentQuestion.id, options[optionIndex]);
            }
          }
        }
        break;
      
      // T/F for true/false questions
      case 't':
      case 'T':
        if (attemptData && !event.ctrlKey && !event.metaKey) {
          const currentQuestion = attemptData.questions[currentQuestionIndex];
          event.preventDefault();
          handleAnswerChange(currentQuestion.id, true);
        }
        break;
      
      case 'f':
      case 'F':
        if (attemptData && !event.ctrlKey && !event.metaKey) {
          const currentQuestion = attemptData.questions[currentQuestionIndex];
          event.preventDefault();
          handleAnswerChange(currentQuestion.id, false);
        }
        break;
    }
  }, [attemptData, currentQuestionIndex, showKeyboardHelp, handleSubmit]);

  // Setup keyboard event listeners
  useEffect(() => {
    document.addEventListener('keydown', handleKeyDown);
    return () => {
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [handleKeyDown]);

  // Focus management when question changes
  useEffect(() => {
    if (questionRef.current && !loading) {
      // Focus the question area when navigating
      questionRef.current.focus();
    }
  }, [currentQuestionIndex, loading]);

  useEffect(() => {
    if (!assessmentId) return;

    const startAttempt = async () => {
      setLoading(true);
      setError(null);
      try {
        const response = await fetch('/api/teach/assessments/attempt', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ assessmentId }),
        });

        if (!response.ok) {
          const errorData = await response.json();
          throw new Error(errorData.message || 'Failed to start assessment attempt');
        }

        const data: AssessmentAttemptData = await response.json();
        setAttemptData(data);
        
        // Initialize responses from existing data if resuming
        if (data.existingResponses && data.existingResponses.length > 0) {
          const existingResponses: StudentResponse[] = data.existingResponses.map(r => ({
            questionId: r.question_id,
            answer: r.response_data,
            timeSpent: 0 // Time tracking handled locally during session
          }));
          setResponses(existingResponses);
        }

        // Set up timer if assessment has time limit
        if (data.assessment.time_limit_minutes && data.attempt.started_at) {
          const attemptStartTime = new Date(data.attempt.started_at).getTime();
          const timeLimit = data.assessment.time_limit_minutes * 60 * 1000; // Convert to milliseconds
          const elapsed = Date.now() - attemptStartTime;
          const remaining = Math.max(0, timeLimit - elapsed);
          setTimeRemaining(remaining);
        }
        
      } catch (err: any) {
        console.error('Error starting assessment attempt:', err);
        setError(err.message);
        setAttemptData(null);
      } finally {
        setLoading(false);
      }
    };

    startAttempt();
  }, [assessmentId]);

  // Timer countdown effect with accessibility announcements
  useEffect(() => {
    if (timeRemaining === null || timeRemaining <= 0) return;

    const interval = setInterval(() => {
      setTimeRemaining(prev => {
        if (prev === null || prev <= 1000) {
          // Auto-submit when time runs out
          handleSubmit();
          return 0;
        }
        
        // Announce time warnings at specific intervals
        const minutes = Math.floor(prev / 60000);
        if ((minutes === 10 || minutes === 5 || minutes === 1) && lastTimerAnnouncement !== minutes) {
          setLastTimerAnnouncement(minutes);
        }
        
        return prev - 1000;
      });
    }, 1000);

    return () => clearInterval(interval);
  }, [timeRemaining, lastTimerAnnouncement]);

  const handleAnswerChange = (questionId: string, answer: any) => {
    // Track time spent on current question
    const timeSpent = Math.floor((Date.now() - questionStartTime) / 1000);
    
    setResponses(prev => {
      const existingResponseIndex = prev.findIndex(r => r.questionId === questionId);
      if (existingResponseIndex > -1) {
        const updatedResponses = [...prev];
        updatedResponses[existingResponseIndex] = { 
          questionId, 
          answer,
          timeSpent: (updatedResponses[existingResponseIndex].timeSpent || 0) + timeSpent
        };
        return updatedResponses;
      }
      return [...prev, { questionId, answer, timeSpent }];
    });

    // Reset question timer
    setQuestionStartTime(Date.now());
  };



  const handleQuestionNavigation = useCallback((direction: 'prev' | 'next') => {
    // Save time spent on current question before navigation
    if (attemptData) {
      const currentQuestion = attemptData.questions[currentQuestionIndex];
      const timeSpent = Math.floor((Date.now() - questionStartTime) / 1000);
      
      setResponses(prev => {
        const existingResponseIndex = prev.findIndex(r => r.questionId === currentQuestion.id);
        if (existingResponseIndex > -1) {
          const updatedResponses = [...prev];
          updatedResponses[existingResponseIndex] = {
            ...updatedResponses[existingResponseIndex],
            timeSpent: (updatedResponses[existingResponseIndex].timeSpent || 0) + timeSpent
          };
          return updatedResponses;
        }
        return prev;
      });
    }

    // Navigate to next/previous question
    if (direction === 'prev') {
      setCurrentQuestionIndex(prev => Math.max(0, prev - 1));
    } else {
      setCurrentQuestionIndex(prev => Math.min((attemptData?.questions.length || 1) - 1, prev + 1));
    }

    // Reset question timer
    setQuestionStartTime(Date.now());
  }, [attemptData, currentQuestionIndex, questionStartTime]);

  const renderQuestion = (question: NewSchemaQuestion) => {
    const response = responses.find(r => r.questionId === question.id);
    const studentAnswer = response ? response.answer : null;

    switch (question.question_type as NewSchemaQuestionType) {
      case 'multiple_choice':
        const mcOptions = question.answer_key?.options || [];
        return (
          <div className="space-y-4">
            <div id={`question-${question.id}-instructions`} className="sr-only">
              Select one answer from the options below. Use arrow keys to navigate between options, or press number keys 1-{mcOptions.length} to select directly.
            </div>
            <RadioGroup
              value={studentAnswer}
              onValueChange={(value) => handleAnswerChange(question.id, value)}
              className="space-y-3"
              aria-describedby={`question-${question.id}-instructions`}
            >
              {mcOptions.map((option: string, index: number) => (
                <div key={index} className="flex items-center space-x-3">
                  <RadioGroupItem value={option} id={`${question.id}-${index}`} />
                  <Label htmlFor={`${question.id}-${index}`} className="text-base cursor-pointer">
                    <span className="font-medium text-muted-foreground mr-2" aria-hidden="true">
                      {String.fromCharCode(65 + index)}.
                    </span>
                    <span className="sr-only">Option {String.fromCharCode(65 + index)} (Press {index + 1}): </span>
                    {option}
                  </Label>
                </div>
              ))}
            </RadioGroup>
          </div>
        );

      case 'true_false':
        return (
          <div className="space-y-4">
            <div id={`question-${question.id}-instructions`} className="sr-only">
              Select either True or False. Use arrow keys to navigate between options, or press T for True, F for False.
            </div>
            <RadioGroup
              value={studentAnswer?.toString()}
              onValueChange={(value) => handleAnswerChange(question.id, value === 'true')}
              className="space-y-3"
              aria-describedby={`question-${question.id}-instructions`}
            >
              <div className="flex items-center space-x-3">
                <RadioGroupItem value="true" id={`${question.id}-true`} />
                <Label htmlFor={`${question.id}-true`} className="text-base cursor-pointer">
                  <span className="font-medium mr-2" style={{ color: 'var(--success)' }}>
                    ✓ True
                  </span>
                  <span className="sr-only">(Press T)</span>
                </Label>
              </div>
              <div className="flex items-center space-x-3">
                <RadioGroupItem value="false" id={`${question.id}-false`} />
                <Label htmlFor={`${question.id}-false`} className="text-base cursor-pointer">
                  <span className="font-medium mr-2" style={{ color: 'var(--destructive)' }}>
                    ✗ False
                  </span>
                  <span className="sr-only">(Press F)</span>
                </Label>
              </div>
            </RadioGroup>
          </div>
        );

      case 'short_answer':
        return (
          <div className="space-y-2">
            <Textarea
              value={studentAnswer || ''}
              onChange={(e) => handleAnswerChange(question.id, e.target.value)}
              placeholder="Enter your answer here..."
              className="min-h-[120px] focus:ring-2 focus:ring-primary focus:border-primary"
              maxLength={500}
              aria-describedby={`question-${question.id}-char-count`}
              aria-label="Short answer response"
            />
            <p id={`question-${question.id}-char-count`} className="text-sm text-muted-foreground">
              {(studentAnswer || '').length}/500 characters
            </p>
          </div>
        );

      case 'essay':
        return (
          <div className="space-y-4">
            <Textarea
              value={studentAnswer || ''}
              onChange={(e) => handleAnswerChange(question.id, e.target.value)}
              placeholder="Write your essay response here..."
              className="min-h-[300px] focus:ring-2 focus:ring-primary focus:border-primary"
              aria-describedby={`question-${question.id}-word-count ${question.answer_key?.key_points ? `question-${question.id}-key-points` : ''}`}
              aria-label="Essay response"
            />
            <div id={`question-${question.id}-word-count`} className="flex justify-between text-sm text-muted-foreground">
              <span>{(studentAnswer || '').split(/\s+/).filter((word: string) => word.length > 0).length} words</span>
              <span>{(studentAnswer || '').length} characters</span>
            </div>
            {question.answer_key?.key_points && (
              <Alert>
                <AlertCircle className="h-4 w-4" />
                <AlertDescription id={`question-${question.id}-key-points`}>
                  <strong>Key points to consider:</strong>
                  <ul className="list-disc list-inside mt-1">
                    {question.answer_key.key_points.map((point: string, index: number) => (
                      <li key={index}>{point}</li>
                    ))}
                  </ul>
                </AlertDescription>
              </Alert>
            )}
          </div>
        );

      case 'matching':
        const matchingPairs = question.answer_key?.pairs || [];
        const leftItems = matchingPairs.map((pair: any) => pair.left);
        const rightItems = matchingPairs.map((pair: any) => pair.right);
        const currentMatches = studentAnswer || {};

        return (
          <div className="space-y-4">
            <div id={`question-${question.id}-instructions`} className="text-sm text-muted-foreground">
              Match each item on the left with the correct item on the right. Use the dropdown menus to make your selections. Tab through the dropdowns and use arrow keys to navigate options.
            </div>
            <div role="group" aria-labelledby={`question-${question.id}-instructions`}>
              {leftItems.map((leftItem: string, index: number) => (
                <div key={index} className="flex items-center space-x-4 mb-3">
                  <div className="flex-1 p-3 bg-muted rounded-md">
                    {leftItem}
                  </div>
                  <div className="text-muted-foreground" aria-hidden="true">→</div>
                  <div className="flex-1">
                    <Select
                      value={currentMatches[leftItem] || ''}
                      onValueChange={(value) => {
                        const newMatches = { ...currentMatches };
                        if (value) {
                          newMatches[leftItem] = value;
                        } else {
                          delete newMatches[leftItem];
                        }
                        handleAnswerChange(question.id, newMatches);
                      }}
                    >
                      <SelectTrigger 
                        aria-label={`Match for: ${leftItem}`}
                        className="focus:ring-2 focus:ring-primary focus:border-primary"
                      >
                        <SelectValue placeholder="Select a match..." />
                      </SelectTrigger>
                      <SelectContent>
                        {rightItems.map((rightItem: string, rightIndex: number) => (
                          <SelectItem key={rightIndex} value={rightItem}>
                            {rightItem}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>
              ))}
            </div>
          </div>
        );

      default:
        return <div className="text-red-500">Unsupported question type: {question.question_type}</div>;
    }
  };

  const formatTime = (milliseconds: number) => {
    const minutes = Math.floor(milliseconds / 60000);
    const seconds = Math.floor((milliseconds % 60000) / 1000);
    return `${minutes}:${seconds.toString().padStart(2, '0')}`;
  };
  
  // Keyboard help modal
  const KeyboardHelpModal = () => (
    <div 
      className={`fixed inset-0 bg-black bg-opacity-50 z-50 flex items-center justify-center p-4 ${showKeyboardHelp ? 'block' : 'hidden'}`}
      role="dialog"
      aria-modal="true"
      aria-labelledby="keyboard-help-title"
    >
      <div className="bg-background border rounded-lg max-w-2xl w-full max-h-[80vh] overflow-y-auto">
        <div className="p-6">
          <div className="flex justify-between items-center mb-4">
            <h2 id="keyboard-help-title" className="text-xl font-semibold">Keyboard Shortcuts</h2>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setShowKeyboardHelp(false)}
              aria-label="Close keyboard help"
            >
              ✕
            </Button>
          </div>
          
          <div className="space-y-4">
            <div>
              <h3 className="font-medium mb-2">Navigation</h3>
              <ul className="space-y-1 text-sm">
                <li><kbd className="px-2 py-1 bg-muted rounded">Ctrl/Cmd + ←</kbd> Previous question</li>
                <li><kbd className="px-2 py-1 bg-muted rounded">Ctrl/Cmd + →</kbd> Next question</li>
                <li><kbd className="px-2 py-1 bg-muted rounded">Ctrl/Cmd + Enter</kbd> Next question or Submit</li>
              </ul>
            </div>
            
            <div>
              <h3 className="font-medium mb-2">Multiple Choice</h3>
              <ul className="space-y-1 text-sm">
                <li><kbd className="px-2 py-1 bg-muted rounded">1-9</kbd> Select option by number</li>
                <li><kbd className="px-2 py-1 bg-muted rounded">↑↓</kbd> Navigate between options</li>
              </ul>
            </div>
            
            <div>
              <h3 className="font-medium mb-2">True/False</h3>
              <ul className="space-y-1 text-sm">
                <li><kbd className="px-2 py-1 bg-muted rounded">T</kbd> Select True</li>
                <li><kbd className="px-2 py-1 bg-muted rounded">F</kbd> Select False</li>
              </ul>
            </div>
            
            <div>
              <h3 className="font-medium mb-2">General</h3>
              <ul className="space-y-1 text-sm">
                <li><kbd className="px-2 py-1 bg-muted rounded">Ctrl/Cmd + H</kbd> Toggle this help</li>
                <li><kbd className="px-2 py-1 bg-muted rounded">Tab</kbd> Navigate between elements</li>
                <li><kbd className="px-2 py-1 bg-muted rounded">Escape</kbd> Close dialogs</li>
              </ul>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
  
  if (loading) {
    return (
      <div className="flex justify-center items-center h-screen">
        <div className="text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto mb-4" aria-label="Loading assessment"></div>
          <p>Loading Assessment...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex justify-center items-center h-screen">
        <Alert className="max-w-md">
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      </div>
    );
  }

  if (!attemptData || attemptData.questions.length === 0) {
    return (
      <div className="flex justify-center items-center h-screen">
        <Alert className="max-w-md">
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>Assessment not found or has no questions.</AlertDescription>
        </Alert>
      </div>
    );
  }

  const currentQuestion = attemptData.questions[currentQuestionIndex];
  const progressValue = ((currentQuestionIndex + 1) / attemptData.questions.length) * 100;

  return (
    <>
      <SkipToMain />
      
      {/* ARIA Live Regions for announcements */}
      <TimerAnnouncement timeRemaining={timeRemaining} />
      {isSubmitting && (
        <AlertAnnouncement>Submitting your assessment.</AlertAnnouncement>
      )}
      
      {/* Keyboard Help Modal */}
      <KeyboardHelpModal />
      
      <main id="main-content" className="container mx-auto p-4 sm:p-6 md:p-8 max-w-4xl">
        <Card>
          <CardHeader>
            <div className="flex justify-between items-start">
              <div>
                <CardTitle className="text-2xl">{attemptData.assessment.title}</CardTitle>
                <CardDescription className="mt-2">{attemptData.assessment.description}</CardDescription>
              </div>
              <div className="flex items-center space-x-4">
                {timeRemaining !== null && (
                  <div className="flex items-center space-x-2 text-sm">
                    <Clock className="h-4 w-4" />
                    <span 
                      className={timeRemaining < 300000 ? 'font-semibold' : ''}
                      style={{ 
                        color: timeRemaining < 300000 ? 'var(--destructive)' : 'inherit' 
                      }}
                      aria-live="polite"
                      aria-label={`${formatTime(timeRemaining)} remaining`}
                    >
                      {formatTime(timeRemaining)} remaining
                    </span>
                  </div>
                )}
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setShowKeyboardHelp(true)}
                  aria-label="Show keyboard shortcuts (Ctrl+H)"
                  title="Keyboard shortcuts (Ctrl+H)"
                >
                  <Keyboard className="h-4 w-4" />
                </Button>
              </div>
            </div>
            <div className="pt-4">
              <Progress 
                value={progressValue} 
                aria-label={`Assessment progress: ${Math.round(progressValue)}% complete`}
                className="mb-2"
              />
              <p className="text-sm text-center text-muted-foreground">
                Question {currentQuestionIndex + 1} of {attemptData.questions.length}
              </p>
            </div>
          </CardHeader>
          <CardContent>
            <div 
              ref={questionRef}
              tabIndex={-1}
              className="focus:outline-none focus:ring-2 focus:ring-primary focus:ring-offset-2 rounded-md p-2 -m-2"
            >
              <fieldset>
                <legend className="text-lg font-semibold mb-6">
                  <span className="sr-only">Question {currentQuestionIndex + 1} of {attemptData.questions.length}: </span>
                  {currentQuestion.question_text}
                </legend>
                {renderQuestion(currentQuestion)}
              </fieldset>
            </div>
          </CardContent>
          <CardFooter className="flex justify-between">
            <Button 
              ref={prevButtonRef}
              onClick={() => handleQuestionNavigation('prev')}
              disabled={currentQuestionIndex === 0}
              variant="outline"
              aria-label={currentQuestionIndex === 0 ? "No previous question" : "Go to previous question (Ctrl+←)"}
              title={currentQuestionIndex === 0 ? "" : "Ctrl+← or Ctrl+↑"}
            >
              Previous
            </Button>
            {currentQuestionIndex === attemptData.questions.length - 1 ? (
              <Button 
                ref={submitButtonRef}
                onClick={handleSubmit} 
                disabled={isSubmitting}
                aria-label={isSubmitting ? "Submitting assessment..." : "Submit assessment (Ctrl+Enter)"}
                title={isSubmitting ? "" : "Ctrl+Enter"}
                className="focus:ring-2 focus:ring-offset-2"
              >
                {isSubmitting ? 'Submitting...' : 'Submit Assessment'}
              </Button>
            ) : (
              <Button 
                ref={nextButtonRef}
                onClick={() => handleQuestionNavigation('next')}
                aria-label="Go to next question (Ctrl+→)"
                title="Ctrl+→ or Ctrl+↓"
                className="focus:ring-2 focus:ring-offset-2"
              >
                Next
              </Button>
            )}
          </CardFooter>
        </Card>
      </main>
    </>
  );
};

export default AssessmentTaker; 