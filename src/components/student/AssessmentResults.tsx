import { useState, useEffect } from 'react';
import { useRouter } from 'next/router';
import { Database } from '@learnologyai/types';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '@/components/ui/accordion';
import { Badge } from '@/components/ui/badge';
import { CheckCircle, XCircle } from 'lucide-react';

type AssessmentAttempt = Database['public']['Tables']['assessment_attempts']['Row'];
// The API needs to join assessment_answers with questions to provide the question text
type AnswerWithQuestion = Database['public']['Tables']['assessment_answers']['Row'] & {
  questions: Pick<Database['public']['Tables']['questions']['Row'], 'question_text'> | null;
};

const AssessmentResults = () => {
  const router = useRouter();
  const { attemptId } = router.query;

  const [attempt, setAttempt] = useState<AssessmentAttempt | null>(null);
  const [answers, setAnswers] = useState<AnswerWithQuestion[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!attemptId) return;

    const fetchResults = async () => {
      setLoading(true);
      setError(null);
      try {
        const response = await fetch(`/api/teach/assessments/attempt?attemptId=${attemptId}`);
        if (!response.ok) {
          throw new Error('Failed to fetch results');
        }
        const data = await response.json();
        setAttempt(data.attempt);
        setAnswers(data.answers); // Assuming the API returns 'answers'
      } catch (err: any) {
        console.error('Error fetching results:', err);
        setError(err.message);
      } finally {
        setLoading(false);
      }
    };

    fetchResults();
  }, [attemptId]);

  if (loading) {
    return <div className="flex justify-center items-center h-screen">Loading Results...</div>;
  }

  if (error) {
    return <div className="flex justify-center items-center h-screen text-red-500">{error}</div>;
  }

  if (!attempt) {
    return <div className="flex justify-center items-center h-screen">Results not found.</div>;
  }

  const getBadgeVariant = (isCorrect: boolean | null) => {
    if (isCorrect === null) return 'secondary';
    return isCorrect ? 'default' : 'destructive';
  };

  // Calculate percentage score from score and total questions
  const calculatePercentageScore = () => {
    if (!attempt.score || !attempt.total_questions) return 0;
    // Assuming each question is worth equal points
    const maxPossibleScore = attempt.total_questions * 10; // Assuming 10 points per question as default
    return Math.round((attempt.score / maxPossibleScore) * 100);
  };

  // Calculate max possible score
  const calculateMaxPossibleScore = () => {
    if (!attempt.total_questions) return 0;
    return attempt.total_questions * 10; // Assuming 10 points per question as default
  };

  const percentageScore = calculatePercentageScore();
  const maxPossibleScore = calculateMaxPossibleScore();

  return (
    <main className="container mx-auto p-4 sm:p-6 md:p-8 max-w-4xl">
      <Card>
        <CardHeader>
          <CardTitle className="text-3xl">Assessment Results</CardTitle>
          <CardDescription>Review of your attempt</CardDescription>
        </CardHeader>
        <CardContent className="grid gap-4 md:grid-cols-2">
            <div className="flex flex-col items-center justify-center p-6 bg-secondary rounded-lg">
                <p className="text-sm font-medium text-muted-foreground">SCORE</p>
                <p className="text-5xl font-bold">{percentageScore}%</p>
            </div>
            <div className="space-y-2 text-sm">
                <div className="flex justify-between">
                    <span className="text-muted-foreground">Status:</span>
                    <Badge variant={attempt.passed ? 'default' : 'destructive'}>
                        {attempt.passed ? 'Passed' : 'Failed'}
                    </Badge>
                </div>
                 <div className="flex justify-between">
                    <span className="text-muted-foreground">Points:</span>
                    <span className="font-medium">{attempt.score ?? 0} / {maxPossibleScore}</span>
                </div>
                <div className="flex justify-between">
                    <span className="text-muted-foreground">Correct Answers:</span>
                    <span className="font-medium">{attempt.correct_answers ?? 0} / {attempt.total_questions ?? 0}</span>
                </div>
                 <div className="flex justify-between">
                    <span className="text-muted-foreground">Completed:</span>
                    <span className="font-medium">{attempt.completed_at ? new Date(attempt.completed_at).toLocaleString() : 'N/A'}</span>
                </div>
            </div>
        </CardContent>
      </Card>
      
      <div className="mt-8">
        <h3 className="text-2xl font-semibold mb-4">Your Answers</h3>
        <Accordion type="single" collapsible className="w-full">
            {answers.map((answer) => (
                <AccordionItem value={answer.id} key={answer.id}>
                    <AccordionTrigger>
                        <div className="flex items-center justify-between w-full pr-4">
                           <span className="truncate flex-1 text-left">{answer.questions?.question_text || 'Question text unavailable'}</span>
                           {answer.is_correct === true && <CheckCircle className="h-5 w-5 text-green-500 ml-4 flex-shrink-0" />}
                           {answer.is_correct === false && <XCircle className="h-5 w-5 text-red-500 ml-4 flex-shrink-0" />}
                        </div>
                    </AccordionTrigger>
                    <AccordionContent className="p-4 bg-muted/50 rounded-b-md">
                        <div className="space-y-2">
                             <p><strong>Your Answer:</strong></p>
                             <div className="p-2 border rounded-md bg-background">
                                <pre className="whitespace-pre-wrap font-sans">{JSON.stringify(answer.user_answer, null, 2)}</pre>
                             </div>
                             {/* The API would need to provide feedback and correct answer if available */}
                        </div>
                    </AccordionContent>
                </AccordionItem>
            ))}
        </Accordion>
      </div>

    </main>
  );
};

export default AssessmentResults; 