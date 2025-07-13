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
import { InstantGradingService, InstantFeedback } from '@/lib/services/instant-grading-service';

import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { Clock, AlertCircle, Keyboard, CheckCircle, XCircle, Trophy, Target } from 'lucide-react';
import { SkipToMain } from '@/components/ui/skip-link';
import { TimerAnnouncement, StatusAnnouncement, AlertAnnouncement } from '@/components/ui/live-region';
import { emitProgressUpdate } from '@/lib/utils/progressEvents';

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
  // Instant feedback state
  const [questionFeedback, setQuestionFeedback] = useState<Record<string, InstantFeedback | null>>({});
  const [currentScore, setCurrentScore] = useState({ earned: 0, total: 0, percentage: 0 });
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
      
      // Emit progress event to notify navigation tree of completion
      // This ensures immediate UI updates in the navigation tree
      if (attemptData?.assessment) {
        const progressStatus = results.needsAiGrading ? 'in_progress' : (results.passed ? 'passed' : 'failed');
        const progressPercentage = results.needsAiGrading ? 50 : 100;
        
        console.log(`🔄 Client: Emitting assessment progress event: ${attemptData.assessment.id} -> ${progressStatus} (${progressPercentage}%)`);
        emitProgressUpdate('assessment', attemptData.assessment.id, progressPercentage, progressStatus);
      }
      
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
            const options = currentQuestion.options || [];
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

    // Instant grading for objective questions
    if (attemptData) {
      const question = attemptData.questions.find(q => q.id === questionId);
      if (question) {
        const feedback = InstantGradingService.gradeAnswer(question, answer);
        
        setQuestionFeedback(prev => ({
          ...prev,
          [questionId]: feedback
        }));

        // Update current score
        const allFeedback = { ...questionFeedback, [questionId]: feedback };
        const scoreData = InstantGradingService.calculateTotalScore(
          attemptData.questions.map(q => allFeedback[q.id] || null)
        );
        setCurrentScore({
          earned: scoreData.earnedPoints,
          total: scoreData.totalPoints,
          percentage: scoreData.percentage
        });
      }
    }

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
    const feedback = questionFeedback[question.id];

    // Helper component for instant feedback display with elegant design
    const InstantFeedbackDisplay = () => {
      if (!feedback) return null;
      
      return (
        <div className={`mt-6 transition-all duration-500 ease-out transform ${feedback ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-2'}`}>
          <div className={`relative overflow-hidden rounded-2xl border ${
            feedback.isCorrect 
              ? 'bg-gradient-to-r from-green-50 to-emerald-50 border-green-200/60' 
              : 'bg-gradient-to-r from-red-50 to-rose-50 border-red-200/60'
          } shadow-sm`}>
            {/* Animated background accent */}
            <div className={`absolute inset-0 opacity-5 ${
              feedback.isCorrect ? 'bg-green-500' : 'bg-red-500'
            }`} />
            
            <div className="relative p-5">
              <div className="flex items-start space-x-4">
                {/* Icon with subtle animation */}
                <div className={`flex-shrink-0 w-8 h-8 rounded-full flex items-center justify-center ${
                  feedback.isCorrect 
                    ? 'bg-green-100 text-green-600' 
                    : 'bg-red-100 text-red-600'
                } transition-all duration-300`}>
                  {feedback.isCorrect ? (
                    <CheckCircle className="h-5 w-5" />
                  ) : (
                    <XCircle className="h-5 w-5" />
                  )}
                </div>
                
                <div className="flex-1 min-w-0">
                  {/* Status and score */}
                  <div className="flex items-center justify-between mb-3">
                    <div className="flex items-center space-x-3">
                      <span className={`font-semibold text-lg ${
                        feedback.isCorrect ? 'text-green-800' : 'text-red-800'
                      }`}>
                        {feedback.isCorrect ? 'Correct!' : 'Incorrect'}
                      </span>
                      <div className={`px-3 py-1 rounded-full text-sm font-medium ${
                        feedback.isCorrect 
                          ? 'bg-green-200/50 text-green-700' 
                          : 'bg-red-200/50 text-red-700'
                      }`}>
                        {feedback.pointsEarned}/{feedback.maxPoints} {feedback.maxPoints === 1 ? 'point' : 'points'}
                      </div>
                    </div>
                  </div>
                  
                  {/* Feedback text */}
                  <p className="text-gray-700 leading-relaxed mb-4">
                    {feedback.feedback}
                  </p>
                  
                  {/* Additional explanation */}
                  {feedback.explanation && (
                    <div className="p-4 bg-white/60 rounded-xl border border-gray-100">
                      <div className="flex items-start space-x-2">
                        <div className="flex-shrink-0 w-5 h-5 rounded-full bg-blue-100 flex items-center justify-center mt-0.5">
                          <span className="text-blue-600 text-xs">💡</span>
                        </div>
                        <p className="text-gray-600 text-sm leading-relaxed">
                          <span className="font-medium text-gray-800">Explanation: </span>
                          {feedback.explanation}
                        </p>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>
        </div>
      );
    };

    switch (question.question_type as NewSchemaQuestionType) {
      case 'multiple_choice':
        const mcOptions = question.options || [];
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
              {mcOptions.map((option: string, index: number) => {
                const isSelected = studentAnswer === option;
                return (
                  <div 
                    key={index} 
                    className={`group relative p-4 rounded-xl border-2 transition-all duration-200 cursor-pointer hover:shadow-md ${
                      isSelected 
                        ? 'border-blue-300 bg-blue-50/50 shadow-sm' 
                        : 'border-gray-200 hover:border-gray-300 hover:bg-gray-50/50'
                    }`}
                  >
                    <div className="flex items-center space-x-4">
                      <RadioGroupItem 
                        value={option} 
                        id={`${question.id}-${index}`}
                        className="flex-shrink-0"
                      />
                      <Label 
                        htmlFor={`${question.id}-${index}`} 
                        className="flex-1 text-base cursor-pointer flex items-center"
                      >
                        <span className={`inline-flex items-center justify-center w-6 h-6 rounded-full text-sm font-medium mr-3 flex-shrink-0 ${
                          isSelected 
                            ? 'bg-blue-100 text-blue-700' 
                            : 'bg-gray-100 text-gray-600 group-hover:bg-gray-200'
                        }`}>
                          {String.fromCharCode(65 + index)}
                        </span>
                        <span className="sr-only">Option {String.fromCharCode(65 + index)} (Press {index + 1}): </span>
                        <span className={`transition-colors ${isSelected ? 'text-gray-800' : 'text-gray-700'}`}>
                          {option}
                        </span>
                      </Label>
                    </div>
                  </div>
                );
              })}
            </RadioGroup>
            <InstantFeedbackDisplay />
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
              {[
                { value: 'true', label: 'True', icon: '✓', shortcut: 'T' },
                { value: 'false', label: 'False', icon: '✗', shortcut: 'F' }
              ].map((option) => {
                const isSelected = studentAnswer?.toString() === option.value;
                return (
                  <div 
                    key={option.value}
                    className={`group relative p-4 rounded-xl border-2 transition-all duration-200 cursor-pointer hover:shadow-md ${
                      isSelected 
                        ? 'border-blue-300 bg-blue-50/50 shadow-sm' 
                        : 'border-gray-200 hover:border-gray-300 hover:bg-gray-50/50'
                    }`}
                  >
                    <div className="flex items-center space-x-4">
                      <RadioGroupItem 
                        value={option.value} 
                        id={`${question.id}-${option.value}`}
                        className="flex-shrink-0"
                      />
                      <Label 
                        htmlFor={`${question.id}-${option.value}`} 
                        className="flex-1 text-base cursor-pointer flex items-center"
                      >
                        <span className={`inline-flex items-center justify-center w-8 h-8 rounded-full text-lg font-medium mr-3 flex-shrink-0 ${
                          option.value === 'true'
                            ? isSelected 
                              ? 'bg-green-100 text-green-700' 
                              : 'bg-green-50 text-green-600 group-hover:bg-green-100'
                            : isSelected 
                              ? 'bg-red-100 text-red-700' 
                              : 'bg-red-50 text-red-600 group-hover:bg-red-100'
                        }`}>
                          {option.icon}
                        </span>
                        <span className={`font-medium transition-colors ${isSelected ? 'text-gray-800' : 'text-gray-700'}`}>
                          {option.label}
                        </span>
                        <span className="sr-only">(Press {option.shortcut})</span>
                      </Label>
                    </div>
                  </div>
                );
              })}
            </RadioGroup>
            <InstantFeedbackDisplay />
          </div>
        );

      case 'short_answer':
        return (
          <div className="space-y-4">
            <Textarea
              value={studentAnswer || ''}
              onChange={(e) => handleAnswerChange(question.id, e.target.value)}
              placeholder="Enter your answer here..."
              className="min-h-[120px] focus:ring-2 focus:ring-blue-500 focus:border-blue-500 border-2 border-gray-200 rounded-xl p-4 text-base transition-all duration-200 hover:border-gray-300 resize-none"
              aria-describedby={`question-${question.id}-word-count`}
              aria-label="Short answer response"
            />
            <div id={`question-${question.id}-word-count`} className="flex justify-between text-sm text-muted-foreground">
              <span>{(studentAnswer || '').split(/\s+/).filter((word: string) => word.length > 0).length} words</span>
              <span>{(studentAnswer || '').length} characters</span>
            </div>
            {/* Show sample response hint if available */}
            {question.answer_key?.grading_notes && (
              <Alert>
                <AlertCircle className="h-4 w-4" />
                <AlertDescription>
                  <strong>Hint:</strong> {question.answer_key.grading_notes}
                </AlertDescription>
              </Alert>
            )}
            {/* AI grading notice with elegant design */}
            {studentAnswer && (
              <div className="mt-4 p-4 bg-gradient-to-r from-blue-50 to-cyan-50 rounded-xl border border-blue-200/60 shadow-sm">
                <div className="flex items-center space-x-3">
                  <div className="w-6 h-6 rounded-full bg-blue-100 flex items-center justify-center">
                    <Target className="h-4 w-4 text-blue-600" />
                  </div>
                  <div>
                    <p className="text-blue-800 font-medium text-sm">AI Grading Enabled</p>
                    <p className="text-blue-600 text-xs mt-1">This response will be analyzed and graded after submission</p>
                  </div>
                </div>
              </div>
            )}
          </div>
        );

      case 'essay':
        return (
          <div className="space-y-4">
            <Textarea
              value={studentAnswer || ''}
              onChange={(e) => handleAnswerChange(question.id, e.target.value)}
              placeholder="Write your essay response here..."
              className="min-h-[300px] focus:ring-2 focus:ring-blue-500 focus:border-blue-500 border-2 border-gray-200 rounded-xl p-4 text-base transition-all duration-200 hover:border-gray-300 resize-none"
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
            {/* AI grading notice with elegant design */}
            {studentAnswer && (
              <div className="mt-4 p-4 bg-gradient-to-r from-blue-50 to-cyan-50 rounded-xl border border-blue-200/60 shadow-sm">
                <div className="flex items-center space-x-3">
                  <div className="w-6 h-6 rounded-full bg-blue-100 flex items-center justify-center">
                    <Target className="h-4 w-4 text-blue-600" />
                  </div>
                  <div>
                    <p className="text-blue-800 font-medium text-sm">AI Essay Grading</p>
                    <p className="text-blue-600 text-xs mt-1">This essay will be evaluated using AI with detailed rubric criteria</p>
                  </div>
                </div>
              </div>
            )}
          </div>
        );

      case 'matching':
        // Handle matching questions with the new schema
        const matchingOptions = question.options || { left_items: [], right_items: [] };
        return (
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-6">
              <div>
                <h4 className="font-medium mb-3">Items</h4>
                <div className="space-y-2">
                  {matchingOptions.left_items?.map((item: string, index: number) => (
                    <div key={index} className="p-3 border rounded-lg bg-muted/50">
                      <span className="font-medium text-sm mr-2">{index + 1}.</span>
                      {item}
                    </div>
                  ))}
                </div>
              </div>
              <div>
                <h4 className="font-medium mb-3">Matches</h4>
                <div className="space-y-2">
                  {matchingOptions.right_items?.map((item: string, index: number) => (
                    <div key={index} className="p-3 border rounded-lg bg-muted/50">
                      <span className="font-medium text-sm mr-2">{String.fromCharCode(65 + index)}.</span>
                      {item}
                    </div>
                  ))}
                </div>
              </div>
            </div>
            <Alert>
              <AlertCircle className="h-4 w-4" />
              <AlertDescription>
                Drag and drop or use selection controls to match items. (Interactive matching interface coming soon)
              </AlertDescription>
            </Alert>
            <InstantFeedbackDisplay />
          </div>
        );

      default:
        return (
          <Alert>
            <AlertCircle className="h-4 w-4" />
            <AlertDescription>
              Question type "{question.question_type}" is not yet supported.
            </AlertDescription>
          </Alert>
        );
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
      
      <main id="main-content" className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50/30 to-indigo-50/40">
        <div className="container mx-auto p-4 sm:p-6 md:p-8 max-w-4xl">
        <Card className="border-0 shadow-xl bg-white/95 backdrop-blur-sm">
          <CardHeader className="bg-gradient-to-r from-gray-50 to-white border-b border-gray-100">
            <div className="flex justify-between items-start">
              <div>
                <CardTitle className="text-2xl font-semibold text-gray-900">{attemptData.assessment.title}</CardTitle>
                <CardDescription className="mt-2 text-gray-600">{attemptData.assessment.description}</CardDescription>
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
              <div className="flex items-center justify-between">
                <span className="text-sm text-muted-foreground">
                  Question {currentQuestionIndex + 1} of {attemptData.questions.length}
                </span>
                {currentScore.total > 0 && (
                  <div className="flex items-center space-x-3">
                    {/* Real-time score display with elegant design */}
                    <div className="flex items-center space-x-2 px-4 py-2 bg-gradient-to-r from-blue-50 to-indigo-50 rounded-full border border-blue-100/60 shadow-sm">
                      <div className="w-5 h-5 rounded-full bg-blue-100 flex items-center justify-center">
                        <Trophy className="h-3 w-3 text-blue-600" />
                      </div>
                      <div className="flex items-center space-x-1">
                        <span className="font-semibold text-blue-900">
                          {currentScore.earned}
                        </span>
                        <span className="text-blue-600 text-sm">
                          /{currentScore.total}
                        </span>
                        <span className="text-xs text-blue-600 ml-1">
                          ({isNaN(currentScore.percentage) ? '0' : currentScore.percentage.toFixed(0)}%)
                        </span>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            </div>
          </CardHeader>
          <CardContent className="p-8">
            <div 
              ref={questionRef}
              tabIndex={-1}
              className="focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 rounded-lg p-4 -m-4"
            >
              <fieldset>
                <legend className="text-xl font-medium text-gray-800 leading-relaxed mb-8 max-w-none">
                  <span className="sr-only">Question {currentQuestionIndex + 1} of {attemptData.questions.length}: </span>
                  <div className="relative">
                    <div className="absolute -left-4 top-0 w-1 h-full bg-gradient-to-b from-blue-400 to-blue-600 rounded-full"></div>
                    <div className="pl-6">
                      {currentQuestion.question_text}
                    </div>
                  </div>
                </legend>
                {renderQuestion(currentQuestion)}
              </fieldset>
            </div>
          </CardContent>
          <CardFooter className="flex justify-between items-center p-8 bg-gradient-to-r from-gray-50 to-white border-t border-gray-100">
            <Button 
              ref={prevButtonRef}
              onClick={() => handleQuestionNavigation('prev')}
              disabled={currentQuestionIndex === 0}
              variant="outline"
              aria-label={currentQuestionIndex === 0 ? "No previous question" : "Go to previous question (Ctrl+←)"}
              title={currentQuestionIndex === 0 ? "" : "Ctrl+← or Ctrl+↑"}
              className="px-6 py-3 rounded-xl border-2 border-gray-200 hover:border-gray-300 disabled:opacity-50 disabled:cursor-not-allowed transition-all duration-200"
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
                className="px-8 py-3 rounded-xl bg-gradient-to-r from-blue-600 to-blue-700 hover:from-blue-700 hover:to-blue-800 text-white font-medium shadow-lg hover:shadow-xl transition-all duration-200 disabled:opacity-50"
              >
                {isSubmitting ? (
                  <div className="flex items-center space-x-2">
                    <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                    <span>Submitting...</span>
                  </div>
                ) : (
                  'Submit Assessment'
                )}
              </Button>
            ) : (
              <Button 
                ref={nextButtonRef}
                onClick={() => handleQuestionNavigation('next')}
                aria-label="Go to next question (Ctrl+→)"
                title="Ctrl+→ or Ctrl+↓"
                className="px-6 py-3 rounded-xl bg-gradient-to-r from-blue-600 to-blue-700 hover:from-blue-700 hover:to-blue-800 text-white font-medium shadow-md hover:shadow-lg transition-all duration-200"
              >
                Next
              </Button>
            )}
          </CardFooter>
        </Card>
        </div>
      </main>
    </>
  );
};

export default AssessmentTaker; 