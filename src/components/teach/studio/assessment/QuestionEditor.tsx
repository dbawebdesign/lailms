'use client';

import React, { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Switch } from '@/components/ui/switch';
import { Slider } from '@/components/ui/slider';
import { 
  Plus, 
  Minus, 
  Move, 
  Eye, 
  Save, 
  X, 
  Brain, 
  BookOpen, 
  Target,
  Clock,
  Tag,
  AlertCircle,
  CheckCircle,
  HelpCircle,
  Sparkles
} from 'lucide-react';
import { cn } from '@/lib/utils';

// Import the Question type from QuestionManager
interface Question {
  id: string;
  quiz_id?: string;
  question_text: string;
  question_type: 'multiple_choice' | 'true_false' | 'short_answer' | 'essay' | 'fill_in_blank' | 'matching' | 'drag_drop' | 'sequence';
  points: number;
  order_index: number;
  created_by: string | null;
  created_at: string;
  updated_at: string;
  options?: QuestionOption[];
  metadata?: {
    difficulty_level?: 'easy' | 'medium' | 'hard';
    bloom_taxonomy?: 'remember' | 'understand' | 'apply' | 'analyze' | 'evaluate' | 'create';
    learning_objectives?: string[];
    tags?: string[];
    estimated_time?: number;
    lesson_content_refs?: string[];
    source_content?: string;
    ai_generated?: boolean;
    validation_status?: 'draft' | 'reviewed' | 'approved' | 'needs_revision';
  };
}

interface QuestionOption {
  id: string;
  question_id: string;
  option_text: string;
  is_correct: boolean;
  order_index: number;
  created_at: string;
  updated_at: string;
}

interface QuestionEditorProps {
  question: Question;
  onSave: (question: Question) => void;
  onCancel: () => void;
  lessonId?: string;
  baseClassId: string;
}

export const QuestionEditor: React.FC<QuestionEditorProps> = ({
  question: initialQuestion,
  onSave,
  onCancel,
  lessonId,
  baseClassId
}) => {
  const [question, setQuestion] = useState<Question>(initialQuestion);
  const [activeTab, setActiveTab] = useState<'content' | 'settings' | 'preview'>('content');
  const [isGeneratingFromContent, setIsGeneratingFromContent] = useState(false);
  const [lessonContent, setLessonContent] = useState<string>('');

  useEffect(() => {
    if (lessonId) {
      loadLessonContent();
    }
  }, [lessonId]);

  const loadLessonContent = async () => {
    try {
      // TODO: Implement API call to fetch lesson content
      // const response = await fetch(`/api/teach/lessons/${lessonId}/content`);
      // const data = await response.json();
      // setLessonContent(data.content || '');
      
      // Mock content for now
      setLessonContent('Sample lesson content about photosynthesis...');
    } catch (error) {
      console.error('Failed to load lesson content:', error);
    }
  };

  const updateQuestion = (updates: Partial<Question>) => {
    setQuestion(prev => ({ ...prev, ...updates }));
  };

  const updateMetadata = (updates: Partial<Question['metadata']>) => {
    setQuestion(prev => ({
      ...prev,
      metadata: { ...prev.metadata, ...updates }
    }));
  };

  const updateOptions = (options: QuestionOption[]) => {
    setQuestion(prev => ({ ...prev, options }));
  };

  const addOption = () => {
    const newOption: QuestionOption = {
      id: `temp-option-${Date.now()}`,
      question_id: question.id,
      option_text: '',
      is_correct: false,
      order_index: question.options?.length || 0,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
    };
    
    updateOptions([...(question.options || []), newOption]);
  };

  const removeOption = (optionId: string) => {
    updateOptions(question.options?.filter(opt => opt.id !== optionId) || []);
  };

  const updateOption = (optionId: string, updates: Partial<QuestionOption>) => {
    updateOptions(
      question.options?.map(opt => 
        opt.id === optionId ? { ...opt, ...updates } : opt
      ) || []
    );
  };

  const generateQuestionFromContent = async () => {
    if (!lessonContent) return;
    
    setIsGeneratingFromContent(true);
    try {
      // TODO: Implement AI generation from lesson content
      // const response = await fetch('/api/teach/questions/generate-from-content', {
      //   method: 'POST',
      //   headers: { 'Content-Type': 'application/json' },
      //   body: JSON.stringify({
      //     content: lessonContent,
      //     questionType: question.question_type,
      //     difficulty: question.metadata?.difficulty_level
      //   })
      // });
      // const data = await response.json();
      
      // Mock generated content
      const mockGenerated = {
        question_text: `What is the primary function of chlorophyll in photosynthesis?`,
        options: [
          { option_text: 'To absorb light energy', is_correct: true },
          { option_text: 'To produce oxygen', is_correct: false },
          { option_text: 'To create glucose', is_correct: false },
          { option_text: 'To release carbon dioxide', is_correct: false }
        ]
      };
      
      updateQuestion({ question_text: mockGenerated.question_text });
      
      if (question.question_type === 'multiple_choice' && mockGenerated.options) {
        const generatedOptions: QuestionOption[] = mockGenerated.options.map((opt, index) => ({
          id: `generated-option-${index}`,
          question_id: question.id,
          option_text: opt.option_text,
          is_correct: opt.is_correct,
          order_index: index,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString()
        }));
        updateOptions(generatedOptions);
      }
      
      updateMetadata({ ai_generated: true });
    } catch (error) {
      console.error('Failed to generate question from content:', error);
    } finally {
      setIsGeneratingFromContent(false);
    }
  };

  const handleSave = () => {
    // Validate question before saving
    if (!question.question_text.trim()) {
      alert('Please enter a question text');
      return;
    }
    
    if (question.question_type === 'multiple_choice' && (!question.options || question.options.length < 2)) {
      alert('Multiple choice questions must have at least 2 options');
      return;
    }
    
    if (question.question_type === 'multiple_choice' && !question.options?.some(opt => opt.is_correct)) {
      alert('Please mark at least one option as correct');
      return;
    }
    
    onSave(question);
  };

  const renderQuestionTypeEditor = () => {
    switch (question.question_type) {
      case 'multiple_choice':
        return (
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <Label className="text-base font-medium">Answer Options</Label>
              <Button
                variant="outline"
                size="sm"
                onClick={addOption}
                disabled={question.options && question.options.length >= 6}
              >
                <Plus className="h-4 w-4 mr-2" />
                Add Option
              </Button>
            </div>
            
            <div className="space-y-3">
              {question.options?.map((option, index) => (
                <Card key={option.id} className="p-3">
                  <div className="flex items-center gap-3">
                    <div className="flex items-center gap-2">
                      <Badge variant="outline" className="w-8 h-8 flex items-center justify-center">
                        {String.fromCharCode(65 + index)}
                      </Badge>
                      <Switch
                        checked={option.is_correct}
                        onCheckedChange={(checked) => updateOption(option.id, { is_correct: checked })}
                      />
                    </div>
                    
                    <Input
                      placeholder={`Option ${String.fromCharCode(65 + index)}`}
                      value={option.option_text}
                      onChange={(e) => updateOption(option.id, { option_text: e.target.value })}
                      className="flex-1"
                    />
                    
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => removeOption(option.id)}
                      disabled={question.options && question.options.length <= 2}
                    >
                      <Minus className="h-4 w-4" />
                    </Button>
                  </div>
                </Card>
              )) || []}
            </div>
            
            <p className="text-sm text-muted-foreground">
              Toggle the switches to mark correct answers. Multiple correct answers are allowed.
            </p>
          </div>
        );
      
      case 'true_false':
        return (
          <div className="space-y-4">
            <Label className="text-base font-medium">Correct Answer</Label>
            <div className="flex gap-4">
              <Card 
                className={cn("p-4 cursor-pointer border-2", 
                  question.metadata?.correct_answer === 'true' ? 'border-green-500 bg-green-50' : 'border-gray-200'
                )}
                onClick={() => updateMetadata({ correct_answer: 'true' })}
              >
                <div className="text-center">
                  <CheckCircle className="h-6 w-6 mx-auto mb-2 text-green-600" />
                  <p className="font-medium">True</p>
                </div>
              </Card>
              <Card 
                className={cn("p-4 cursor-pointer border-2", 
                  question.metadata?.correct_answer === 'false' ? 'border-red-500 bg-red-50' : 'border-gray-200'
                )}
                onClick={() => updateMetadata({ correct_answer: 'false' })}
              >
                <div className="text-center">
                  <X className="h-6 w-6 mx-auto mb-2 text-red-600" />
                  <p className="font-medium">False</p>
                </div>
              </Card>
            </div>
          </div>
        );
      
      case 'short_answer':
      case 'essay':
        return (
          <div className="space-y-4">
            <div>
              <Label className="text-base font-medium">Model Answer (Optional)</Label>
              <p className="text-sm text-muted-foreground mb-2">
                Provide a sample answer for grading reference
              </p>
              <Textarea
                placeholder="Enter a model answer..."
                value={question.metadata?.model_answer || ''}
                onChange={(e) => updateMetadata({ model_answer: e.target.value })}
                rows={question.question_type === 'essay' ? 6 : 3}
              />
            </div>
            
            <div>
              <Label className="text-base font-medium">Grading Rubric</Label>
              <Textarea
                placeholder="Enter grading criteria and rubric..."
                value={question.metadata?.grading_rubric || ''}
                onChange={(e) => updateMetadata({ grading_rubric: e.target.value })}
                rows={4}
              />
            </div>
            
            {question.question_type === 'short_answer' && (
              <div>
                <Label className="text-base font-medium">Maximum Word Count</Label>
                <Input
                  type="number"
                  placeholder="e.g., 100"
                  value={question.metadata?.max_words || ''}
                  onChange={(e) => updateMetadata({ max_words: parseInt(e.target.value) || undefined })}
                />
              </div>
            )}
          </div>
        );
      
      case 'fill_in_blank':
        return (
          <div className="space-y-4">
            <div>
              <Label className="text-base font-medium">Instructions</Label>
              <p className="text-sm text-muted-foreground mb-2">
                Use underscores _____ to mark blanks in your question text above
              </p>
            </div>
            
            <div>
              <Label className="text-base font-medium">Correct Answers</Label>
              <p className="text-sm text-muted-foreground mb-2">
                Enter possible correct answers, one per line
              </p>
              <Textarea
                placeholder="Answer 1&#10;Answer 2&#10;Answer 3"
                value={question.metadata?.correct_answers?.join('\n') || ''}
                onChange={(e) => updateMetadata({ 
                  correct_answers: e.target.value.split('\n').filter(a => a.trim()) 
                })}
                rows={4}
              />
            </div>
          </div>
        );
      
      default:
        return (
          <div className="text-center py-8">
            <HelpCircle className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
            <p className="text-muted-foreground">
              This question type editor is coming soon
            </p>
          </div>
        );
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-lg font-semibold">
            {question.id ? 'Edit Question' : 'Create New Question'}
          </h3>
          <p className="text-sm text-muted-foreground">
            {question.question_type.replace('_', ' ').replace(/\b\w/g, l => l.toUpperCase())} Question
          </p>
        </div>
        
        {lessonContent && (
          <Button
            variant="outline"
            onClick={generateQuestionFromContent}
            disabled={isGeneratingFromContent}
          >
            <Brain className="h-4 w-4 mr-2" />
            {isGeneratingFromContent ? 'Generating...' : 'Generate from Content'}
          </Button>
        )}
      </div>

      {/* Main Editor */}
      <Tabs value={activeTab} onValueChange={(value) => setActiveTab(value as any)} className="space-y-4">
        <TabsList className="grid w-full grid-cols-3">
          <TabsTrigger value="content">Content</TabsTrigger>
          <TabsTrigger value="settings">Settings</TabsTrigger>
          <TabsTrigger value="preview">Preview</TabsTrigger>
        </TabsList>

        {/* Content Tab */}
        <TabsContent value="content" className="space-y-6">
          {/* Question Text */}
          <div className="space-y-2">
            <Label className="text-base font-medium">Question Text</Label>
            <Textarea
              placeholder="Enter your question here..."
              value={question.question_text}
              onChange={(e) => updateQuestion({ question_text: e.target.value })}
              rows={3}
              className="text-base"
            />
          </div>

          {/* Question Type Specific Editor */}
          {renderQuestionTypeEditor()}
        </TabsContent>

        {/* Settings Tab */}
        <TabsContent value="settings" className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* Basic Settings */}
            <Card className="p-4">
              <CardHeader className="p-0 pb-4">
                <CardTitle className="text-base">Basic Settings</CardTitle>
              </CardHeader>
              <CardContent className="p-0 space-y-4">
                <div>
                  <Label>Points Value</Label>
                  <Input
                    type="number"
                    min="0.1"
                    step="0.1"
                    value={question.points}
                    onChange={(e) => updateQuestion({ points: parseFloat(e.target.value) || 1 })}
                  />
                </div>
                
                <div>
                  <Label>Difficulty Level</Label>
                  <Select 
                    value={question.metadata?.difficulty_level || 'medium'} 
                    onValueChange={(value) => updateMetadata({ difficulty_level: value as any })}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="easy">Easy</SelectItem>
                      <SelectItem value="medium">Medium</SelectItem>
                      <SelectItem value="hard">Hard</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                
                <div>
                  <Label>Estimated Time (minutes)</Label>
                  <Input
                    type="number"
                    min="1"
                    value={question.metadata?.estimated_time || 2}
                    onChange={(e) => updateMetadata({ estimated_time: parseInt(e.target.value) || 2 })}
                  />
                </div>
              </CardContent>
            </Card>

            {/* Educational Metadata */}
            <Card className="p-4">
              <CardHeader className="p-0 pb-4">
                <CardTitle className="text-base">Educational Settings</CardTitle>
              </CardHeader>
              <CardContent className="p-0 space-y-4">
                <div>
                  <Label>Bloom's Taxonomy Level</Label>
                  <Select 
                    value={question.metadata?.bloom_taxonomy || 'understand'} 
                    onValueChange={(value) => updateMetadata({ bloom_taxonomy: value as any })}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="remember">Remember</SelectItem>
                      <SelectItem value="understand">Understand</SelectItem>
                      <SelectItem value="apply">Apply</SelectItem>
                      <SelectItem value="analyze">Analyze</SelectItem>
                      <SelectItem value="evaluate">Evaluate</SelectItem>
                      <SelectItem value="create">Create</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                
                <div>
                  <Label>Tags</Label>
                  <Input
                    placeholder="Enter tags separated by commas"
                    value={question.metadata?.tags?.join(', ') || ''}
                    onChange={(e) => updateMetadata({ 
                      tags: e.target.value.split(',').map(t => t.trim()).filter(Boolean) 
                    })}
                  />
                </div>
                
                <div>
                  <Label>Learning Objectives</Label>
                  <Textarea
                    placeholder="Enter learning objectives, one per line"
                    value={question.metadata?.learning_objectives?.join('\n') || ''}
                    onChange={(e) => updateMetadata({ 
                      learning_objectives: e.target.value.split('\n').filter(Boolean) 
                    })}
                    rows={3}
                  />
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        {/* Preview Tab */}
        <TabsContent value="preview" className="space-y-4">
          <Card className="p-6">
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <h4 className="text-lg font-medium">Preview</h4>
                <div className="flex items-center gap-2">
                  <Badge>{question.metadata?.difficulty_level}</Badge>
                  <Badge variant="outline">{question.points} pts</Badge>
                </div>
              </div>
              
              <div className="prose max-w-none">
                <p className="text-base">{question.question_text || 'Enter question text to see preview'}</p>
                
                {question.question_type === 'multiple_choice' && question.options && (
                  <div className="mt-4 space-y-2">
                    {question.options.map((option, index) => (
                      <div 
                        key={option.id} 
                        className={cn(
                          "p-3 rounded border flex items-center gap-3",
                          option.is_correct ? "bg-green-50 border-green-200" : "bg-gray-50 border-gray-200"
                        )}
                      >
                        <div className="w-6 h-6 rounded-full border-2 border-gray-300 flex items-center justify-center text-sm">
                          {String.fromCharCode(65 + index)}
                        </div>
                        <span>{option.option_text || `Option ${String.fromCharCode(65 + index)}`}</span>
                        {option.is_correct && <CheckCircle className="h-4 w-4 text-green-600 ml-auto" />}
                      </div>
                    ))}
                  </div>
                )}
                
                {question.question_type === 'true_false' && (
                  <div className="mt-4 flex gap-4">
                    <Button variant={question.metadata?.correct_answer === 'true' ? 'default' : 'outline'}>
                      True
                    </Button>
                    <Button variant={question.metadata?.correct_answer === 'false' ? 'default' : 'outline'}>
                      False
                    </Button>
                  </div>
                )}
              </div>
            </div>
          </Card>
        </TabsContent>
      </Tabs>

      {/* Actions */}
      <div className="flex items-center justify-between pt-4 border-t">
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <Clock className="h-4 w-4" />
          <span>Estimated time: {question.metadata?.estimated_time || 2} minutes</span>
        </div>
        
        <div className="flex items-center gap-3">
          <Button variant="outline" onClick={onCancel}>
            Cancel
          </Button>
          <Button onClick={handleSave}>
            <Save className="h-4 w-4 mr-2" />
            Save Question
          </Button>
        </div>
      </div>
    </div>
  );
};