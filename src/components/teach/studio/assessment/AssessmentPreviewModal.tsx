import React, { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Clock, FileText, AlertCircle } from 'lucide-react';

interface AssessmentQuestion {
  id: string;
  question_text: string;
  question_type: 'multiple_choice' | 'short_answer' | 'essay' | 'true_false';
  points: number;
  order_index: number;
  options?: any; // JSONB field for question-specific options
  correct_answer?: any; // JSONB field for the correct answer(s)
  answer_key: any; // JSONB field (legacy/additional grading info)
  required: boolean;
  explanation?: string; // Optional explanation
}

interface Assessment {
  id: string;
  title: string;
  description?: string;
  instructions?: string;
  assessment_type: string;
  time_limit_minutes?: number;
  questionCount: number;
}

interface AssessmentPreviewModalProps {
  isOpen: boolean;
  onClose: () => void;
  assessment: Assessment | null;
}

export function AssessmentPreviewModal({ isOpen, onClose, assessment }: AssessmentPreviewModalProps) {
  const [questions, setQuestions] = useState<AssessmentQuestion[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [answers, setAnswers] = useState<Record<string, any>>({});

  useEffect(() => {
    if (isOpen && assessment) {
      fetchQuestions();
    }
  }, [isOpen, assessment]);

  const fetchQuestions = async () => {
    if (!assessment) return;
    
    setLoading(true);
    setError(null);
    
    try {
      const response = await fetch(`/api/teach/questions?assessment_id=${assessment.id}&orderBy=order_index`);
      if (!response.ok) {
        throw new Error('Failed to fetch questions');
      }
      
      const data = await response.json();
      setQuestions(data);
    } catch (err) {
      console.error('Error fetching questions:', err);
      setError('Failed to load questions');
    } finally {
      setLoading(false);
    }
  };

  const handleAnswerChange = (questionId: string, value: any) => {
    setAnswers(prev => ({
      ...prev,
      [questionId]: value
    }));
  };

  const renderQuestion = (question: AssessmentQuestion, index: number) => {
    const answerKey = question.answer_key || {};
    
    return (
      <Card key={question.id} className="mb-4">
        <CardHeader className="pb-3">
          <CardTitle className="text-base font-medium flex items-center gap-2">
            <span className="bg-primary text-primary-foreground rounded-full w-6 h-6 flex items-center justify-center text-sm">
              {index + 1}
            </span>
            Question {index + 1}
            {question.required && <span className="text-red-500">*</span>}
            <span className="text-sm text-muted-foreground ml-auto">
              {question.points} {question.points === 1 ? 'point' : 'points'}
            </span>
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="mb-4">
            <p className="text-sm leading-relaxed">{question.question_text}</p>
          </div>
          
          {question.question_type === 'multiple_choice' && (
            <RadioGroup
              value={answers[question.id] || ''}
              onValueChange={(value) => handleAnswerChange(question.id, value)}
            >
              {(question.options || answerKey.options || []).map((option: string, optionIndex: number) => (
                <div key={optionIndex} className="flex items-center space-x-2">
                  <RadioGroupItem value={option} id={`${question.id}-${optionIndex}`} />
                  <Label htmlFor={`${question.id}-${optionIndex}`} className="text-sm">
                    {option}
                  </Label>
                </div>
              ))}
            </RadioGroup>
          )}
          
          {question.question_type === 'true_false' && (
            <RadioGroup
              value={answers[question.id] || ''}
              onValueChange={(value) => handleAnswerChange(question.id, value)}
            >
              <div className="flex items-center space-x-2">
                <RadioGroupItem value="true" id={`${question.id}-true`} />
                <Label htmlFor={`${question.id}-true`} className="text-sm">True</Label>
              </div>
              <div className="flex items-center space-x-2">
                <RadioGroupItem value="false" id={`${question.id}-false`} />
                <Label htmlFor={`${question.id}-false`} className="text-sm">False</Label>
              </div>
            </RadioGroup>
          )}
          
          {(question.question_type === 'short_answer' || question.question_type === 'essay') && (
            <Textarea
              placeholder="Enter your answer here..."
              value={answers[question.id] || ''}
              onChange={(e) => handleAnswerChange(question.id, e.target.value)}
              className="min-h-[100px]"
            />
          )}
        </CardContent>
      </Card>
    );
  };

  if (!assessment) return null;

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <FileText className="w-5 h-5" />
            Assessment Preview: {assessment.title}
          </DialogTitle>
        </DialogHeader>
        
        <div className="space-y-6">
          {/* Assessment Info */}
          <Card>
            <CardContent className="pt-6">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-sm">
                <div className="flex items-center gap-2">
                  <FileText className="w-4 h-4 text-muted-foreground" />
                  <span className="font-medium">Type:</span>
                  <span className="capitalize">{assessment.assessment_type}</span>
                </div>
                <div className="flex items-center gap-2">
                  <Clock className="w-4 h-4 text-muted-foreground" />
                  <span className="font-medium">Time Limit:</span>
                  <span>{assessment.time_limit_minutes ? `${assessment.time_limit_minutes} minutes` : 'No limit'}</span>
                </div>
                <div className="flex items-center gap-2">
                  <AlertCircle className="w-4 h-4 text-muted-foreground" />
                  <span className="font-medium">Questions:</span>
                  <span>{assessment.questionCount}</span>
                </div>
              </div>
              
              {assessment.description && (
                <div className="mt-4 pt-4 border-t">
                  <h4 className="font-medium mb-2">Description</h4>
                  <p className="text-sm text-muted-foreground">{assessment.description}</p>
                </div>
              )}
              
              {assessment.instructions && (
                <div className="mt-4 pt-4 border-t">
                  <h4 className="font-medium mb-2">Instructions</h4>
                  <p className="text-sm text-muted-foreground">{assessment.instructions}</p>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Questions */}
          {loading && (
            <div className="text-center py-8">
              <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
              <p className="mt-2 text-sm text-muted-foreground">Loading questions...</p>
            </div>
          )}

          {error && (
            <Card className="border-red-200 bg-red-50">
              <CardContent className="pt-6">
                <div className="flex items-center gap-2 text-red-600">
                  <AlertCircle className="w-4 h-4" />
                  <span className="text-sm">{error}</span>
                </div>
              </CardContent>
            </Card>
          )}

          {!loading && !error && questions.length === 0 && (
            <Card className="border-yellow-200 bg-yellow-50">
              <CardContent className="pt-6">
                <div className="flex items-center gap-2 text-yellow-600">
                  <AlertCircle className="w-4 h-4" />
                  <span className="text-sm">No questions found for this assessment.</span>
                </div>
              </CardContent>
            </Card>
          )}

          {!loading && questions.length > 0 && (
            <div className="space-y-4">
              <h3 className="text-lg font-semibold">Questions</h3>
              {questions.map((question, index) => renderQuestion(question, index))}
            </div>
          )}

          {/* Footer */}
          <div className="flex justify-end gap-2 pt-4 border-t">
            <Button variant="outline" onClick={onClose}>
              Close Preview
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
} 