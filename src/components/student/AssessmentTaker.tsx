import { useState, useEffect } from 'react';
import { useRouter } from 'next/router';
import { Database } from '@learnologyai/types';

import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';

type Assessment = Database['public']['Tables']['assessments']['Row'];
type Question = Database['public']['Tables']['questions']['Row'];
// Assuming a structure for the options within the JSONB column
// e.g., { "options": [{ "id": "opt1", "label": "Option 1" }] }
type QuestionOption = { id: string; label: string }; 
type StudentResponse = {
  questionId: string;
  answer: any;
};

const AssessmentTaker = () => {
  const router = useRouter();
  const { assessmentId } = router.query;

  const [assessment, setAssessment] = useState<Assessment | null>(null);
  const [questions, setQuestions] = useState<Question[]>([]);
  const [currentQuestionIndex, setCurrentQuestionIndex] = useState(0);
  const [responses, setResponses] = useState<StudentResponse[]>([]);
  const [loading, setLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

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

        const data = await response.json();
        setAssessment(data.assessment);
        setQuestions(data.questions);
        
      } catch (err: any) {
        console.error('Error starting assessment attempt:', err);
        setError(err.message);
        setAssessment(null);
      } finally {
        setLoading(false);
      }
    };

    startAttempt();
  }, [assessmentId]);

  const handleAnswerChange = (questionId: string, answer: any) => {
    setResponses(prev => {
      const existingResponseIndex = prev.findIndex(r => r.questionId === questionId);
      if (existingResponseIndex > -1) {
        const updatedResponses = [...prev];
        updatedResponses[existingResponseIndex] = { questionId, answer };
        return updatedResponses;
      }
      return [...prev, { questionId, answer }];
    });
  };

  const handleSubmit = async () => {
    setIsSubmitting(true);
    setError(null);
    try {
      const response = await fetch('/api/teach/assessments/attempt', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          attemptId: assessment?.id, // This needs to be the attempt ID from the POST response
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
  
  if (loading) {
    return <div className="flex justify-center items-center h-screen">Loading Assessment...</div>;
  }

  if (error) {
    return <div className="flex justify-center items-center h-screen text-red-500">{error}</div>;
  }

  if (!assessment || questions.length === 0) {
    return <div className="flex justify-center items-center h-screen">Assessment not found or has no questions.</div>;
  }

  const currentQuestion = questions[currentQuestionIndex];
  const progressValue = ((currentQuestionIndex + 1) / questions.length) * 100;

  const renderQuestion = (question: Question) => {
    const response = responses.find(r => r.questionId === question.id);
    const studentAnswer = response ? response.answer : null;

    const options = (question.options as QuestionOption[] || []);

    switch (question.question_type) {
      case 'multiple_choice':
        return (
            <RadioGroup
                value={studentAnswer}
                onValueChange={(value) => handleAnswerChange(String(question.id), value)}
                className="space-y-2"
            >
                {options.map((option) => (
                    <div key={option.id} className="flex items-center space-x-2">
                        <RadioGroupItem value={option.id} id={`${question.id}-${option.id}`} />
                        <Label htmlFor={`${question.id}-${option.id}`}>{option.label}</Label>
                    </div>
                ))}
            </RadioGroup>
        );

      case 'true_false':
        return (
          <RadioGroup
            value={studentAnswer}
            onValueChange={(value) => handleAnswerChange(String(question.id), value)}
            className="space-y-2"
          >
            <div className="flex items-center space-x-2">
              <RadioGroupItem value="true" id={`${question.id}-true`} />
              <Label htmlFor={`${question.id}-true`}>True</Label>
            </div>
            <div className="flex items-center space-x-2">
              <RadioGroupItem value="false" id={`${question.id}-false`} />
              <Label htmlFor={`${question.id}-false`}>False</Label>
            </div>
          </RadioGroup>
        );

      case 'short_answer':
        return (
          <Textarea
            value={studentAnswer || ''}
            onChange={(e) => handleAnswerChange(String(question.id), e.target.value)}
            placeholder="Your answer here..."
            className="min-h-[150px]"
          />
        );

      default:
        return <div>Unsupported question type: {question.question_type}</div>;
    }
  };

  return (
    <main className="container mx-auto p-4 sm:p-6 md:p-8 max-w-4xl">
        <Card>
            <CardHeader>
                <CardTitle>{assessment.title}</CardTitle>
                <CardDescription>{assessment.description}</CardDescription>
                <div className="pt-4">
                    <Progress value={progressValue} aria-label={`${Math.round(progressValue)}% complete`} />
                    <p className="text-sm text-center text-muted-foreground mt-2">Question {currentQuestionIndex + 1} of {questions.length}</p>
                </div>
            </CardHeader>
            <CardContent>
                <fieldset>
                    <legend className="text-lg font-semibold mb-4">{currentQuestion.question_text}</legend>
                    {renderQuestion(currentQuestion)}
                </fieldset>
            </CardContent>
            <CardFooter className="flex justify-between">
                <Button 
                    onClick={() => setCurrentQuestionIndex(prev => Math.max(0, prev - 1))}
                    disabled={currentQuestionIndex === 0}
                    variant="outline"
                >
                    Previous
                </Button>
                {currentQuestionIndex === questions.length - 1 ? (
                    <Button onClick={handleSubmit} disabled={isSubmitting}>
                        {isSubmitting ? 'Submitting...' : 'Submit Assessment'}
                    </Button>
                ) : (
                    <Button 
                        onClick={() => setCurrentQuestionIndex(prev => Math.min(questions.length - 1, prev + 1))}
                    >
                        Next
                    </Button>
                )}
            </CardFooter>
        </Card>
        {isSubmitting && <div aria-live="assertive" className="sr-only">Submitting your assessment.</div>}
    </main>
  );
};

export default AssessmentTaker; 