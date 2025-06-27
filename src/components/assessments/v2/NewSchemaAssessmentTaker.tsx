/**
 * NEW ASSESSMENT SCHEMA COMPONENT (V2)
 * 
 * This component is specifically designed for the new 4-table assessment schema
 * and should be used for all new assessment taking functionality.
 * 
 * DO NOT confuse with legacy AssessmentTaker in src/components/student/
 */

'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { NewSchemaAssessment, NewSchemaQuestion, NewSchemaStudentAttempt, NewSchemaStudentResponse } from './types/newSchemaTypes';

import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Skeleton } from '@/components/ui/skeleton';

import { NewSchemaQuestionMultipleChoice } from './questions/NewSchemaQuestionMultipleChoice';
import { NewSchemaQuestionTrueFalse } from './questions/NewSchemaQuestionTrueFalse';
import { NewSchemaQuestionShortAnswer } from './questions/NewSchemaQuestionShortAnswer';
import { NewSchemaQuestionEssay } from './questions/NewSchemaQuestionEssay';
import { NewSchemaQuestionMatching } from './questions/NewSchemaQuestionMatching';

interface NewSchemaAssessmentTakerProps {
  assessmentId: string;
  onComplete?: (attemptId: string) => void;
  className?: string;
}

export function NewSchemaAssessmentTaker({ 
  assessmentId, 
  onComplete,
  className 
}: NewSchemaAssessmentTakerProps) {
  const router = useRouter();
  
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

  // Timer for tracking time spent
  useEffect(() => {
    const timer = setInterval(() => {
      setTimeSpent(prev => prev + 1);
    }, 1000);

    return () => clearInterval(timer);
  }, []);

  // Initialize assessment attempt
  useEffect(() => {
    if (!assessmentId) return;

    const initializeAttempt = async () => {
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
          throw new Error(errorData.message || 'Failed to start assessment');
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
      }
    };

    initializeAttempt();
  }, [assessmentId]);

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
      const response = await fetch('/api/teach/assessments/attempt', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          attemptId: currentAttempt.id,
          responses: responses,
          timeSpent: timeSpent,
          isSubmission: true,
        }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.message || 'Failed to submit assessment');
      }
      
      const result = await response.json();
      
      if (onComplete) {
        onComplete(result.attemptId);
      } else {
        router.push(`/assessments/results/${result.attemptId}`);
      }
      
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