import { useState, useEffect } from 'react';
import { useRouter } from 'next/router';
import { 
  NewSchemaAssessment,
  NewSchemaStudentAttempt,
  NewSchemaStudentResponse,
  NewSchemaQuestion,
  NewSchemaQuestionType 
} from '@/components/assessments/v2/types/newSchemaTypes';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '@/components/ui/accordion';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { CheckCircle, XCircle, Clock, User, Calendar, Trophy, AlertCircle } from 'lucide-react';

interface AssessmentResultData {
  assessment: NewSchemaAssessment;
  attempt: NewSchemaStudentAttempt;
  responses: (NewSchemaStudentResponse & {
    question: NewSchemaQuestion;
  })[];
}

const AssessmentResults = () => {
  const router = useRouter();
  const { attemptId } = router.query;

  const [resultData, setResultData] = useState<AssessmentResultData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!attemptId) return;

    const fetchResults = async () => {
      setLoading(true);
      setError(null);
      try {
        const response = await fetch(`/api/teach/assessments/attempt/${attemptId}/results`);
        if (!response.ok) {
          throw new Error('Failed to fetch results');
        }
        const data: AssessmentResultData = await response.json();
        setResultData(data);
      } catch (err: any) {
        console.error('Error fetching results:', err);
        setError(err.message);
      } finally {
        setLoading(false);
      }
    };

    fetchResults();
  }, [attemptId]);

  const formatTime = (seconds: number | null) => {
    if (!seconds) return 'N/A';
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    const remainingSeconds = seconds % 60;
    
    if (hours > 0) {
      return `${hours}h ${minutes}m ${remainingSeconds}s`;
    } else if (minutes > 0) {
      return `${minutes}m ${remainingSeconds}s`;
    } else {
      return `${remainingSeconds}s`;
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'completed': return 'default';
      case 'graded': return 'default';
      case 'in_progress': return 'secondary';
      case 'abandoned': return 'destructive';
      case 'grading': return 'secondary';
      default: return 'secondary';
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'completed': return <CheckCircle className="h-4 w-4" />;
      case 'graded': return <Trophy className="h-4 w-4" />;
      case 'in_progress': return <Clock className="h-4 w-4" />;
      case 'abandoned': return <XCircle className="h-4 w-4" />;
      case 'grading': return <Clock className="h-4 w-4" />;
      default: return <AlertCircle className="h-4 w-4" />;
    }
  };

  const renderAnswer = (response: NewSchemaStudentResponse, question: NewSchemaQuestion) => {
    const questionType = question.question_type as NewSchemaQuestionType;
    const answer = response.response_data;

    switch (questionType) {
      case 'multiple_choice':
        const options = question.answer_key?.options || [];
        const correctAnswer = question.answer_key?.correct_answer;
        const selectedOption = answer?.selected_option;
        return (
          <div className="space-y-2">
            <div className="grid gap-2">
              {options.map((option: string, index: number) => {
                const isSelected = selectedOption === option;
                const isCorrect = option === correctAnswer;
                const label = String.fromCharCode(65 + index);
                
                return (
                  <div 
                    key={index} 
                    className={`p-2 rounded-md border ${
                      isSelected 
                        ? isCorrect 
                          ? 'bg-green-50 border-green-200 text-green-800' 
                          : 'bg-red-50 border-red-200 text-red-800'
                        : isCorrect 
                          ? 'bg-green-50 border-green-200 text-green-800' 
                          : 'bg-muted/50'
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <span><strong>{label}.</strong> {option}</span>
                      <div className="flex items-center space-x-1">
                        {isSelected && <Badge variant="outline" className="text-xs">Your Answer</Badge>}
                        {isCorrect && <Badge variant="default" className="text-xs">Correct</Badge>}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        );

      case 'true_false':
        const correctBool = question.answer_key?.correct_answer;
        const selectedAnswer = answer?.selected_answer;
        const isCorrect = selectedAnswer === correctBool;
        return (
          <div className="space-y-2">
            <div className="flex items-center space-x-4">
              <span className="font-medium">Your Answer:</span>
              <Badge variant={isCorrect ? 'default' : 'destructive'}>
                {selectedAnswer ? 'True' : 'False'}
              </Badge>
            </div>
            {!isCorrect && (
              <div className="flex items-center space-x-4">
                <span className="font-medium">Correct Answer:</span>
                <Badge variant="default">
                  {correctBool ? 'True' : 'False'}
                </Badge>
              </div>
            )}
            {question.answer_key?.explanation && (
              <div className="mt-3 p-3 bg-blue-50 rounded-md border border-blue-200">
                <p className="text-blue-800 text-sm">{question.answer_key.explanation}</p>
              </div>
            )}
          </div>
        );

      case 'short_answer':
      case 'essay':
        const textAnswer = answer?.text_answer || answer?.essay_text;
        return (
          <div className="space-y-4">
            <div>
              <h4 className="font-medium mb-2">Your Answer:</h4>
              <div className="p-3 bg-muted/50 rounded-md border">
                <p className="whitespace-pre-wrap">{textAnswer || 'No answer provided'}</p>
              </div>
            </div>
            
            {response.ai_feedback && (
              <div>
                <h4 className="font-medium mb-2">AI Feedback:</h4>
                <Alert>
                  <AlertCircle className="h-4 w-4" />
                  <AlertDescription className="whitespace-pre-wrap">
                    {response.ai_feedback}
                  </AlertDescription>
                </Alert>
              </div>
            )}

            {response.manual_feedback && (
              <div>
                <h4 className="font-medium mb-2">Instructor Feedback:</h4>
                <Alert>
                  <AlertCircle className="h-4 w-4" />
                  <AlertDescription className="whitespace-pre-wrap">
                    {response.manual_feedback}
                  </AlertDescription>
                </Alert>
              </div>
            )}

            {question.sample_response && (
              <div>
                <h4 className="font-medium mb-2">Sample Response:</h4>
                <div className="p-3 bg-blue-50 rounded-md border border-blue-200">
                  <p className="whitespace-pre-wrap text-blue-800">{question.sample_response}</p>
                </div>
              </div>
            )}

            {question.answer_key?.key_points && (
              <div>
                <h4 className="font-medium mb-2">Key Points:</h4>
                <ul className="list-disc list-inside space-y-1 text-sm">
                  {question.answer_key.key_points.map((point: string, index: number) => (
                    <li key={index}>{point}</li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        );

      case 'matching':
        const pairs = question.answer_key?.pairs || [];
        const userMatches = answer?.matches || {};
        return (
          <div className="space-y-3">
            <h4 className="font-medium">Your Matches:</h4>
            {pairs.map((pair: {left: string, right: string}, index: number) => {
              const userAnswer = userMatches[pair.left];
              const isCorrect = userAnswer === pair.right;
              
              return (
                <div key={index} className="flex items-center space-x-4 p-2 rounded-md border">
                  <div className="flex-1">
                    <strong>{pair.left}</strong>
                  </div>
                  <div className="text-muted-foreground">→</div>
                  <div className="flex-1">
                    <div className="flex items-center justify-between">
                      <span className={isCorrect ? 'text-green-600' : 'text-red-600'}>
                        {userAnswer || 'No answer'}
                      </span>
                      {isCorrect ? (
                        <CheckCircle className="h-4 w-4 text-green-500" />
                      ) : (
                        <div className="flex items-center space-x-2">
                          <XCircle className="h-4 w-4 text-red-500" />
                          <span className="text-sm text-green-600">({pair.right})</span>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        );

      default:
        return (
          <div className="p-3 bg-muted/50 rounded-md">
            <pre className="whitespace-pre-wrap font-sans text-sm">
              {JSON.stringify(answer, null, 2)}
            </pre>
          </div>
        );
    }
  };

  if (loading) {
    return (
      <div className="flex justify-center items-center h-screen">
        <div className="text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto mb-4"></div>
          <p>Loading Results...</p>
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

  if (!resultData) {
    return (
      <div className="flex justify-center items-center h-screen">
        <Alert className="max-w-md">
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>Results not found.</AlertDescription>
        </Alert>
      </div>
    );
  }

  const { assessment, attempt, responses } = resultData;
  const correctCount = responses.filter(r => r.is_correct).length;
  const totalQuestions = responses.length;
  const percentageScore = attempt.percentage_score || 0;

  return (
    <main className="container mx-auto p-4 sm:p-6 md:p-8 max-w-4xl">
      {/* Header */}
      <div className="mb-6">
        <h1 className="text-3xl font-bold mb-2">{assessment.title}</h1>
        {assessment.description && <p className="text-muted-foreground">{assessment.description}</p>}
      </div>

      {/* Score Card */}
      <Card className="mb-8">
        <CardHeader>
          <CardTitle className="flex items-center space-x-2">
            <Trophy className="h-5 w-5" />
            <span>Assessment Results</span>
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid gap-6 md:grid-cols-2">
            {/* Score Display */}
            <div className="flex flex-col items-center justify-center p-8 bg-gradient-to-br from-primary/10 to-primary/5 rounded-lg border">
              <div className="text-center">
                <p className="text-sm font-medium text-muted-foreground uppercase tracking-wide mb-2">
                  Final Score
                </p>
                <p className="text-6xl font-bold text-primary mb-2">
                  {Math.round(percentageScore)}%
                </p>
                <Badge 
                  variant={percentageScore >= (assessment.passing_score_percentage || 70) ? 'default' : 'destructive'} 
                  className="text-sm"
                >
                  {percentageScore >= (assessment.passing_score_percentage || 70) ? 'Passed' : 'Failed'}
                </Badge>
              </div>
            </div>

            {/* Stats */}
            <div className="space-y-4">
              <div className="flex items-center justify-between p-3 bg-muted/50 rounded-md">
                <div className="flex items-center space-x-2">
                  <Badge variant={getStatusColor(attempt.status)} className="flex items-center space-x-1">
                    {getStatusIcon(attempt.status)}
                    <span className="capitalize">{attempt.status.replace('_', ' ')}</span>
                  </Badge>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4 text-sm">
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Correct:</span>
                  <span className="font-medium">{correctCount} / {totalQuestions}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Points:</span>
                  <span className="font-medium">{attempt.earned_points || 0} / {attempt.total_points || totalQuestions * 10}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Time:</span>
                  <span className="font-medium">{formatTime(attempt.time_spent_minutes ? attempt.time_spent_minutes * 60 : null)}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Submitted:</span>
                  <span className="font-medium">
                    {attempt.submitted_at ? new Date(attempt.submitted_at).toLocaleDateString() : 'N/A'}
                  </span>
                </div>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Detailed Results */}
      <Card>
        <CardHeader>
          <CardTitle>Question-by-Question Review</CardTitle>
          <CardDescription>
            Review your answers and see detailed feedback
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Accordion type="single" collapsible className="w-full">
            {responses.map((response, index) => {
              const isCorrect = response.is_correct;
              return (
                <AccordionItem value={response.id} key={response.id}>
                  <AccordionTrigger className="hover:no-underline">
                    <div className="flex items-center justify-between w-full pr-4">
                      <div className="flex items-center space-x-3">
                        <Badge variant="outline" className="text-xs">
                          Q{index + 1}
                        </Badge>
                        <span className="truncate flex-1 text-left font-medium">
                          {response.question.question_text}
                        </span>
                      </div>
                      <div className="flex items-center space-x-2">
                        {response.points_earned !== null && (
                          <Badge variant="secondary" className="text-xs">
                            {response.points_earned}/{response.question.points || 10} pts
                          </Badge>
                        )}
                        {isCorrect === true && <CheckCircle className="h-5 w-5 text-green-500 flex-shrink-0" />}
                        {isCorrect === false && <XCircle className="h-5 w-5 text-red-500 flex-shrink-0" />}
                        {isCorrect === null && <Clock className="h-5 w-5 text-yellow-500 flex-shrink-0" />}
                      </div>
                    </div>
                  </AccordionTrigger>
                  <AccordionContent className="pt-4">
                    <div className="space-y-4">
                      {renderAnswer(response, response.question)}
                      
                      {response.created_at && (
                        <div className="flex items-center space-x-2 text-sm text-muted-foreground">
                          <Clock className="h-3 w-3" />
                          <span>Answered: {new Date(response.created_at).toLocaleString()}</span>
                        </div>
                      )}
                    </div>
                  </AccordionContent>
                </AccordionItem>
              );
            })}
          </Accordion>
        </CardContent>
      </Card>

      {/* Actions */}
      <div className="mt-8 flex justify-center space-x-4">
        <Button 
          variant="outline" 
          onClick={() => router.back()}
        >
          Back to Course
        </Button>
        {assessment.max_attempts && attempt.attempt_number < assessment.max_attempts && attempt.status === 'completed' && (
          <Button 
            onClick={() => router.push(`/assessments/${assessment.id}/take`)}
          >
            Retake Assessment
          </Button>
        )}
      </div>
    </main>
  );
};

export default AssessmentResults; 