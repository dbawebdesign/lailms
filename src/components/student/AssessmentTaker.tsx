import { useState, useEffect } from 'react';
import { useRouter } from 'next/router';
import { 
  NewSchemaAssessment, 
  NewSchemaAssessmentQuestion, 
  NewSchemaStudentAttempt,
  NewSchemaStudentResponse,
  QuestionType 
} from '@/components/assessments/v2/types/newSchemaTypes';

import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Clock, AlertCircle } from 'lucide-react';

interface StudentResponse {
  questionId: string;
  answer: any;
  timeSpent?: number; // Track time spent on each question
}

interface AssessmentAttemptData {
  assessment: NewSchemaAssessment;
  questions: NewSchemaAssessmentQuestion[];
  attempt: NewSchemaStudentAttempt;
  existingResponses?: NewSchemaStudentResponse[];
}

const AssessmentTaker = () => {
  const router = useRouter();
  const { assessmentId } = router.query;

  const [attemptData, setAttemptData] = useState<AssessmentAttemptData | null>(null);
  const [currentQuestionIndex, setCurrentQuestionIndex] = useState(0);
  const [responses, setResponses] = useState<StudentResponse[]>([]);
  const [loading, setLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [timeRemaining, setTimeRemaining] = useState<number | null>(null);
  const [questionStartTime, setQuestionStartTime] = useState<number>(Date.now());

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
            timeSpent: r.time_spent_seconds
          }));
          setResponses(existingResponses);
        }

        // Set up timer if assessment has time limit
        if (data.assessment.time_limit_minutes) {
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

  // Timer countdown effect
  useEffect(() => {
    if (timeRemaining === null || timeRemaining <= 0) return;

    const interval = setInterval(() => {
      setTimeRemaining(prev => {
        if (prev === null || prev <= 1000) {
          // Auto-submit when time runs out
          handleSubmit();
          return 0;
        }
        return prev - 1000;
      });
    }, 1000);

    return () => clearInterval(interval);
  }, [timeRemaining]);

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

  const handleSubmit = async () => {
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
  };

  const handleQuestionNavigation = (direction: 'prev' | 'next') => {
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
  };

  const renderQuestion = (question: NewSchemaAssessmentQuestion) => {
    const response = responses.find(r => r.questionId === question.id);
    const studentAnswer = response ? response.answer : null;

    switch (question.question_type as QuestionType) {
      case 'multiple_choice':
        const mcOptions = question.answer_key?.options || [];
        return (
          <RadioGroup
            value={studentAnswer}
            onValueChange={(value) => handleAnswerChange(question.id, value)}
            className="space-y-3"
          >
            {mcOptions.map((option, index) => (
              <div key={index} className="flex items-center space-x-3">
                <RadioGroupItem value={option} id={`${question.id}-${index}`} />
                <Label htmlFor={`${question.id}-${index}`} className="text-base">
                  {String.fromCharCode(65 + index)}. {option}
                </Label>
              </div>
            ))}
          </RadioGroup>
        );

      case 'true_false':
        return (
          <RadioGroup
            value={studentAnswer}
            onValueChange={(value) => handleAnswerChange(question.id, value === 'true')}
            className="space-y-3"
          >
            <div className="flex items-center space-x-3">
              <RadioGroupItem value="true" id={`${question.id}-true`} />
              <Label htmlFor={`${question.id}-true`} className="text-base">True</Label>
            </div>
            <div className="flex items-center space-x-3">
              <RadioGroupItem value="false" id={`${question.id}-false`} />
              <Label htmlFor={`${question.id}-false`} className="text-base">False</Label>
            </div>
          </RadioGroup>
        );

      case 'short_answer':
        return (
          <div className="space-y-2">
            <Textarea
              value={studentAnswer || ''}
              onChange={(e) => handleAnswerChange(question.id, e.target.value)}
              placeholder="Enter your answer here..."
              className="min-h-[120px]"
              maxLength={500}
            />
            <p className="text-sm text-muted-foreground">
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
              className="min-h-[300px]"
            />
            <div className="flex justify-between text-sm text-muted-foreground">
              <span>{(studentAnswer || '').split(/\s+/).filter(word => word.length > 0).length} words</span>
              <span>{(studentAnswer || '').length} characters</span>
            </div>
            {question.answer_key?.key_points && (
              <Alert>
                <AlertCircle className="h-4 w-4" />
                <AlertDescription>
                  <strong>Key points to consider:</strong>
                  <ul className="list-disc list-inside mt-1">
                    {question.answer_key.key_points.map((point, index) => (
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
        const leftItems = matchingPairs.map(pair => pair.left);
        const rightItems = matchingPairs.map(pair => pair.right);
        const currentMatches = studentAnswer || {};

        return (
          <div className="space-y-4">
            <p className="text-sm text-muted-foreground">Match each item on the left with the correct item on the right:</p>
            {leftItems.map((leftItem, index) => (
              <div key={index} className="flex items-center space-x-4">
                <div className="flex-1 p-3 bg-muted rounded-md">
                  {leftItem}
                </div>
                <div className="text-muted-foreground">→</div>
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
                    <SelectTrigger>
                      <SelectValue placeholder="Select a match..." />
                    </SelectTrigger>
                    <SelectContent>
                      {rightItems.map((rightItem, rightIndex) => (
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
  
  if (loading) {
    return (
      <div className="flex justify-center items-center h-screen">
        <div className="text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto mb-4"></div>
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
    <main className="container mx-auto p-4 sm:p-6 md:p-8 max-w-4xl">
      <Card>
        <CardHeader>
          <div className="flex justify-between items-start">
            <div>
              <CardTitle className="text-2xl">{attemptData.assessment.title}</CardTitle>
              <CardDescription className="mt-2">{attemptData.assessment.description}</CardDescription>
            </div>
            {timeRemaining !== null && (
              <div className="flex items-center space-x-2 text-sm">
                <Clock className="h-4 w-4" />
                <span className={timeRemaining < 300000 ? 'text-red-500 font-semibold' : ''}>
                  {formatTime(timeRemaining)} remaining
                </span>
              </div>
            )}
          </div>
          <div className="pt-4">
            <Progress value={progressValue} aria-label={`${Math.round(progressValue)}% complete`} />
            <p className="text-sm text-center text-muted-foreground mt-2">
              Question {currentQuestionIndex + 1} of {attemptData.questions.length}
            </p>
          </div>
        </CardHeader>
        <CardContent>
          <fieldset>
            <legend className="text-lg font-semibold mb-6">{currentQuestion.question_text}</legend>
            {renderQuestion(currentQuestion)}
          </fieldset>
        </CardContent>
        <CardFooter className="flex justify-between">
          <Button 
            onClick={() => handleQuestionNavigation('prev')}
            disabled={currentQuestionIndex === 0}
            variant="outline"
          >
            Previous
          </Button>
          {currentQuestionIndex === attemptData.questions.length - 1 ? (
            <Button onClick={handleSubmit} disabled={isSubmitting}>
              {isSubmitting ? 'Submitting...' : 'Submit Assessment'}
            </Button>
          ) : (
            <Button 
              onClick={() => handleQuestionNavigation('next')}
            >
              Next
            </Button>
          )}
        </CardFooter>
      </Card>
      {isSubmitting && (
        <div aria-live="assertive" className="sr-only">
          Submitting your assessment.
        </div>
      )}
    </main>
  );
};

export default AssessmentTaker; 