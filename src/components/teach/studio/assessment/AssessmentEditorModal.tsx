import React, { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Badge } from '@/components/ui/badge';
import { Plus, Trash2, Edit3, Save, X, GripVertical } from 'lucide-react';
import { useToast } from '@/components/ui/use-toast';

interface AssessmentQuestion {
  id: string;
  question_text: string;
  question_type: 'multiple_choice' | 'short_answer' | 'essay' | 'true_false';
  points: number;
  order_index: number;
  answer_key: any;
  required: boolean;
  sample_response?: string;
}

interface Assessment {
  id: string;
  title: string;
  description?: string;
  instructions?: string;
  assessment_type: string;
  time_limit_minutes?: number;
  max_attempts?: number;
  passing_score_percentage?: number;
  questionCount: number;
}

interface AssessmentEditorModalProps {
  isOpen: boolean;
  onClose: () => void;
  assessment: Assessment | null;
  onSave?: () => void;
}

export function AssessmentEditorModal({ isOpen, onClose, assessment, onSave }: AssessmentEditorModalProps) {
  const [questions, setQuestions] = useState<AssessmentQuestion[]>([]);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [editingQuestion, setEditingQuestion] = useState<string | null>(null);
  const [assessmentSettings, setAssessmentSettings] = useState<Partial<Assessment>>({});
  const { toast } = useToast();

  useEffect(() => {
    if (isOpen && assessment) {
      fetchQuestions();
      setAssessmentSettings({
        title: assessment.title,
        description: assessment.description,
        instructions: assessment.instructions,
        time_limit_minutes: assessment.time_limit_minutes,
        max_attempts: assessment.max_attempts,
        passing_score_percentage: assessment.passing_score_percentage,
      });
    }
  }, [isOpen, assessment]);

  const fetchQuestions = async () => {
    if (!assessment) return;
    
    setLoading(true);
    try {
      const response = await fetch(`/api/teach/questions?assessment_id=${assessment.id}&orderBy=order_index`);
      if (!response.ok) {
        throw new Error('Failed to fetch questions');
      }
      
      const data = await response.json();
      setQuestions(data);
    } catch (err) {
      console.error('Error fetching questions:', err);
      toast({
        title: "Error",
        description: "Failed to load questions",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const saveAssessmentSettings = async () => {
    if (!assessment) return;
    
    setSaving(true);
    try {
      const response = await fetch(`/api/teach/assessments/${assessment.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(assessmentSettings),
      });

      if (!response.ok) {
        throw new Error('Failed to save assessment settings');
      }

      toast({
        title: "Success",
        description: "Assessment settings saved successfully",
      });
    } catch (err) {
      console.error('Error saving assessment:', err);
      toast({
        title: "Error",
        description: "Failed to save assessment settings",
        variant: "destructive",
      });
    } finally {
      setSaving(false);
    }
  };

  const addNewQuestion = () => {
    const newQuestion: AssessmentQuestion = {
      id: `temp-${Date.now()}`,
      question_text: '',
      question_type: 'multiple_choice',
      points: 1,
      order_index: questions.length,
      answer_key: { options: ['', '', '', ''], correct_option: '' },
      required: true,
    };
    setQuestions([...questions, newQuestion]);
    setEditingQuestion(newQuestion.id);
  };

  const updateQuestion = (questionId: string, updates: Partial<AssessmentQuestion>) => {
    setQuestions(questions.map(q => 
      q.id === questionId ? { ...q, ...updates } : q
    ));
  };

  const deleteQuestion = async (questionId: string) => {
    if (questionId.startsWith('temp-')) {
      // Remove temporary question
      setQuestions(questions.filter(q => q.id !== questionId));
      return;
    }

    try {
      const response = await fetch(`/api/teach/questions/${questionId}`, {
        method: 'DELETE',
      });

      if (!response.ok) {
        throw new Error('Failed to delete question');
      }

      setQuestions(questions.filter(q => q.id !== questionId));
      toast({
        title: "Success",
        description: "Question deleted successfully",
      });
    } catch (err) {
      console.error('Error deleting question:', err);
      toast({
        title: "Error",
        description: "Failed to delete question",
        variant: "destructive",
      });
    }
  };

  const saveQuestion = async (question: AssessmentQuestion) => {
    if (!assessment) return;

    try {
      const isNew = question.id.startsWith('temp-');
      const url = isNew 
        ? '/api/teach/questions'
        : `/api/teach/questions/${question.id}`;
      
      const method = isNew ? 'POST' : 'PATCH';
      const body = isNew 
        ? { ...question, assessment_id: assessment.id, id: undefined }
        : question;

      const response = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.error || `Failed to save question (${response.status})`);
      }

      const savedQuestion = await response.json();
      
      if (isNew) {
        setQuestions(questions.map(q => 
          q.id === question.id ? savedQuestion : q
        ));
      }

      setEditingQuestion(null);
      toast({
        title: "Success",
        description: "Question saved successfully",
      });
    } catch (err) {
      console.error('Error saving question:', err);
      toast({
        title: "Error",
        description: err instanceof Error ? err.message : "Failed to save question",
        variant: "destructive",
      });
    }
  };

  const renderQuestionEditor = (question: AssessmentQuestion) => {
    const isEditing = editingQuestion === question.id;
    
    if (!isEditing) {
      return (
        <Card key={question.id} className="mb-4">
          <CardHeader className="pb-3">
            <CardTitle className="text-base font-medium flex items-center justify-between">
              <div className="flex items-center gap-2">
                <GripVertical className="w-4 h-4 text-muted-foreground" />
                <span>Question {question.order_index + 1}</span>
                <Badge variant="outline" className="text-xs">
                  {question.question_type.replace('_', ' ')}
                </Badge>
                <span className="text-sm text-muted-foreground">
                  {question.points} pts
                </span>
              </div>
              <div className="flex gap-2">
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => setEditingQuestion(question.id)}
                >
                  <Edit3 className="w-4 h-4" />
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => deleteQuestion(question.id)}
                >
                  <Trash2 className="w-4 h-4" />
                </Button>
              </div>
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm">{question.question_text || 'No question text'}</p>
          </CardContent>
        </Card>
      );
    }

    return (
      <Card key={question.id} className="mb-4 border-primary">
        <CardHeader className="pb-3">
          <CardTitle className="text-base font-medium">
            Editing Question {question.order_index + 1}
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div>
            <Label htmlFor="question-text">Question Text</Label>
            <Textarea
              id="question-text"
              value={question.question_text}
              onChange={(e) => updateQuestion(question.id, { question_text: e.target.value })}
              placeholder="Enter the question text..."
              className="min-h-[100px]"
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label htmlFor="question-type">Question Type</Label>
              <Select
                value={question.question_type}
                onValueChange={(value: any) => {
                  let defaultAnswerKey = {};
                  switch (value) {
                    case 'multiple_choice':
                      defaultAnswerKey = { options: ['', '', '', ''], correct_option: '' };
                      break;
                    case 'true_false':
                      defaultAnswerKey = { correct_answer: true };
                      break;
                    case 'short_answer':
                      defaultAnswerKey = { acceptable_answers: [''] };
                      break;
                    case 'essay':
                      defaultAnswerKey = { grading_criteria: '' };
                      break;
                    case 'matching':
                      defaultAnswerKey = { pairs: [] };
                      break;
                    default:
                      defaultAnswerKey = {};
                  }
                  updateQuestion(question.id, { 
                    question_type: value, 
                    answer_key: defaultAnswerKey 
                  });
                }}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="multiple_choice">Multiple Choice</SelectItem>
                  <SelectItem value="true_false">True/False</SelectItem>
                  <SelectItem value="short_answer">Short Answer</SelectItem>
                  <SelectItem value="essay">Essay</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div>
              <Label htmlFor="points">Points</Label>
              <Input
                id="points"
                type="number"
                value={question.points}
                onChange={(e) => updateQuestion(question.id, { points: parseInt(e.target.value) || 1 })}
                min="1"
              />
            </div>
          </div>

          <div className="flex items-center space-x-2">
            <Switch
              id="required"
              checked={question.required}
              onCheckedChange={(checked) => updateQuestion(question.id, { required: checked })}
            />
            <Label htmlFor="required">Required question</Label>
          </div>

          {question.question_type === 'multiple_choice' && (
            <div>
              <Label>Answer Options</Label>
              <div className="space-y-2 mt-2">
                {(question.answer_key?.options || ['', '', '', '']).map((option: string, index: number) => (
                  <div key={index} className="flex items-center gap-2">
                    <Input
                      value={option}
                      onChange={(e) => {
                        const newOptions = [...(question.answer_key?.options || ['', '', '', ''])];
                        newOptions[index] = e.target.value;
                        updateQuestion(question.id, {
                          answer_key: { ...question.answer_key, options: newOptions }
                        });
                      }}
                      placeholder={`Option ${index + 1}`}
                    />
                    <Button
                      size="sm"
                      variant={question.answer_key?.correct_option === option ? "default" : "outline"}
                      onClick={() => updateQuestion(question.id, {
                        answer_key: { ...question.answer_key, correct_option: option }
                      })}
                    >
                      {question.answer_key?.correct_option === option ? "Correct" : "Mark Correct"}
                    </Button>
                  </div>
                ))}
              </div>
            </div>
          )}

          {question.question_type === 'true_false' && (
            <div>
              <Label>Correct Answer</Label>
              <Select
                value={question.answer_key?.correct_answer?.toString() || 'true'}
                onValueChange={(value) => updateQuestion(question.id, {
                  answer_key: { correct_answer: value === 'true' }
                })}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="true">True</SelectItem>
                  <SelectItem value="false">False</SelectItem>
                </SelectContent>
              </Select>
            </div>
          )}

          {question.question_type === 'short_answer' && (
            <div>
              <Label>Acceptable Answers</Label>
              <div className="space-y-2 mt-2">
                {(question.answer_key?.acceptable_answers || ['']).map((answer: string, index: number) => (
                  <div key={index} className="flex items-center gap-2">
                    <Input
                      value={answer}
                      onChange={(e) => {
                        const newAnswers = [...(question.answer_key?.acceptable_answers || [''])];
                        newAnswers[index] = e.target.value;
                        updateQuestion(question.id, {
                          answer_key: { acceptable_answers: newAnswers }
                        });
                      }}
                      placeholder={`Acceptable answer ${index + 1}`}
                    />
                    {index > 0 && (
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => {
                          const newAnswers = (question.answer_key?.acceptable_answers || ['']).filter((_, i) => i !== index);
                          updateQuestion(question.id, {
                            answer_key: { acceptable_answers: newAnswers }
                          });
                        }}
                      >
                        <Trash2 className="w-4 h-4" />
                      </Button>
                    )}
                  </div>
                ))}
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => {
                    const newAnswers = [...(question.answer_key?.acceptable_answers || ['']), ''];
                    updateQuestion(question.id, {
                      answer_key: { acceptable_answers: newAnswers }
                    });
                  }}
                >
                  <Plus className="w-4 h-4 mr-2" />
                  Add Answer
                </Button>
              </div>
            </div>
          )}

          {question.question_type === 'essay' && (
            <div>
              <Label htmlFor="grading-criteria">Grading Criteria</Label>
              <Textarea
                id="grading-criteria"
                value={question.answer_key?.grading_criteria || ''}
                onChange={(e) => updateQuestion(question.id, {
                  answer_key: { grading_criteria: e.target.value }
                })}
                placeholder="Describe the criteria for grading this essay question..."
                className="min-h-[100px]"
              />
            </div>
          )}

          <div className="flex gap-2">
            <Button onClick={() => saveQuestion(question)}>
              <Save className="w-4 h-4 mr-2" />
              Save Question
            </Button>
            <Button
              variant="outline"
              onClick={() => setEditingQuestion(null)}
            >
              <X className="w-4 h-4 mr-2" />
              Cancel
            </Button>
          </div>
        </CardContent>
      </Card>
    );
  };

  if (!assessment) return null;

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-6xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Edit Assessment: {assessment.title}</DialogTitle>
        </DialogHeader>
        
        <Tabs defaultValue="questions" className="space-y-4">
          <TabsList>
            <TabsTrigger value="questions">Questions</TabsTrigger>
            <TabsTrigger value="settings">Settings</TabsTrigger>
          </TabsList>

          <TabsContent value="questions" className="space-y-4">
            <div className="flex justify-between items-center">
              <h3 className="text-lg font-semibold">Questions ({questions.length})</h3>
              <Button onClick={addNewQuestion}>
                <Plus className="w-4 h-4 mr-2" />
                Add Question
              </Button>
            </div>

            {loading ? (
              <div className="text-center py-8">
                <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
                <p className="mt-2 text-sm text-muted-foreground">Loading questions...</p>
              </div>
            ) : (
              <div className="space-y-4">
                {questions.length === 0 ? (
                  <Card>
                    <CardContent className="pt-6 text-center">
                      <p className="text-muted-foreground">No questions yet. Add your first question to get started.</p>
                    </CardContent>
                  </Card>
                ) : (
                  questions.map(renderQuestionEditor)
                )}
              </div>
            )}
          </TabsContent>

          <TabsContent value="settings" className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle>Assessment Settings</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div>
                  <Label htmlFor="title">Title</Label>
                  <Input
                    id="title"
                    value={assessmentSettings.title || ''}
                    onChange={(e) => setAssessmentSettings({ ...assessmentSettings, title: e.target.value })}
                  />
                </div>

                <div>
                  <Label htmlFor="description">Description</Label>
                  <Textarea
                    id="description"
                    value={assessmentSettings.description || ''}
                    onChange={(e) => setAssessmentSettings({ ...assessmentSettings, description: e.target.value })}
                    placeholder="Optional description for this assessment..."
                  />
                </div>

                <div>
                  <Label htmlFor="instructions">Instructions</Label>
                  <Textarea
                    id="instructions"
                    value={assessmentSettings.instructions || ''}
                    onChange={(e) => setAssessmentSettings({ ...assessmentSettings, instructions: e.target.value })}
                    placeholder="Instructions for students taking this assessment..."
                  />
                </div>

                <div className="grid grid-cols-3 gap-4">
                  <div>
                    <Label htmlFor="time-limit">Time Limit (minutes)</Label>
                    <Input
                      id="time-limit"
                      type="number"
                      value={assessmentSettings.time_limit_minutes || ''}
                      onChange={(e) => setAssessmentSettings({ 
                        ...assessmentSettings, 
                        time_limit_minutes: e.target.value ? parseInt(e.target.value) : undefined 
                      })}
                      placeholder="No limit"
                    />
                  </div>

                  <div>
                    <Label htmlFor="max-attempts">Max Attempts</Label>
                    <Input
                      id="max-attempts"
                      type="number"
                      value={assessmentSettings.max_attempts || ''}
                      onChange={(e) => setAssessmentSettings({ 
                        ...assessmentSettings, 
                        max_attempts: e.target.value ? parseInt(e.target.value) : undefined 
                      })}
                      placeholder="Unlimited"
                    />
                  </div>

                  <div>
                    <Label htmlFor="passing-score">Passing Score (%)</Label>
                    <Input
                      id="passing-score"
                      type="number"
                      value={assessmentSettings.passing_score_percentage || ''}
                      onChange={(e) => setAssessmentSettings({ 
                        ...assessmentSettings, 
                        passing_score_percentage: e.target.value ? parseInt(e.target.value) : undefined 
                      })}
                      placeholder="No requirement"
                      min="0"
                      max="100"
                    />
                  </div>
                </div>

                <div className="flex gap-2">
                  <Button onClick={saveAssessmentSettings} disabled={saving}>
                    {saving ? 'Saving...' : 'Save Settings'}
                  </Button>
                </div>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>

        <div className="flex justify-end gap-2 pt-4 border-t">
          <Button variant="outline" onClick={onClose}>
            Close
          </Button>
          {onSave && (
            <Button onClick={onSave}>
              Save & Close
            </Button>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
} 