'use client';

import React, { useState, useEffect } from 'react';
import { Database } from '../../../../../packages/types/db';
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
import { Checkbox } from '@/components/ui/checkbox';
import { QuestionPreview } from './QuestionPreview';

type Question = Database['public']['Tables']['questions']['Row'];
type QuestionOption = Database['public']['Tables']['question_options']['Row'];

interface QuestionEditorProps {
  question: Partial<Question> | null;
  onSave: (question: Partial<Question>) => void;
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
  const [question, setQuestion] = useState<Partial<Question>>(initialQuestion || {});
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

  const getOptions = (): Partial<QuestionOption>[] => {
    return Array.isArray(question.options) ? question.options : [];
  };

  const updateOptions = (newOptions: Partial<QuestionOption>[]) => {
    updateQuestion({ options: newOptions as any });
  };

  const addOption = () => {
    const options = getOptions();
    const newOption: Partial<QuestionOption> = {
      option_text: '',
      is_correct: false,
      order_index: options.length,
    };
    updateOptions([...options, newOption]);
  };

  const removeOption = (index: number) => {
    const options = getOptions();
    updateOptions(options.filter((_, i) => i !== index));
  };

  const updateOption = (index: number, updates: Partial<QuestionOption>) => {
    const options = getOptions();
    updateOptions(
      options.map((opt, i) => (i === index ? { ...opt, ...updates } : opt))
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
        const generatedOptions: Partial<QuestionOption>[] = mockGenerated.options.map((opt, index) => ({
          option_text: opt.option_text,
          is_correct: opt.is_correct,
          order_index: index,
        }));
        updateOptions(generatedOptions);
      }
      
      updateQuestion({ ai_generated: true });
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
              {getOptions().map((option, index) => (
                <Card key={option.id} className="p-3">
                  <div className="flex items-center gap-3">
                    <div className="flex items-center gap-2">
                      <Badge variant="outline" className="w-8 h-8 flex items-center justify-center">
                        {String.fromCharCode(65 + index)}
                      </Badge>
                      <Switch
                        checked={option.is_correct}
                        onCheckedChange={(checked) => updateOption(index, { is_correct: checked })}
                      />
                    </div>
                    
                    <Input
                      placeholder={`Option ${String.fromCharCode(65 + index)}`}
                      value={option.option_text}
                      onChange={(e) => updateOption(index, { option_text: e.target.value })}
                      className="flex-1"
                    />
                    
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => removeOption(index)}
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
                  question.correct_answer === 'true' ? 'border-green-500 bg-green-50' : 'border-gray-200'
                )}
                onClick={() => updateQuestion({ correct_answer: 'true' })}
              >
                <div className="text-center">
                  <CheckCircle className="h-6 w-6 mx-auto mb-2 text-green-600" />
                  <p className="font-medium">True</p>
                </div>
              </Card>
              <Card 
                className={cn("p-4 cursor-pointer border-2", 
                  question.correct_answer === 'false' ? 'border-red-500 bg-red-50' : 'border-gray-200'
                )}
                onClick={() => updateQuestion({ correct_answer: 'false' })}
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
                value={question.model_answer || ''}
                onChange={(e) => updateQuestion({ model_answer: e.target.value })}
                rows={question.question_type === 'essay' ? 6 : 3}
              />
            </div>
            
            <div>
              <Label className="text-base font-medium">Grading Rubric</Label>
              <Textarea
                placeholder="Enter grading criteria and rubric..."
                value={question.grading_rubric || ''}
                onChange={(e) => updateQuestion({ grading_rubric: e.target.value })}
                rows={4}
              />
            </div>
            
            {question.question_type === 'short_answer' && (
              <div>
                <Label className="text-base font-medium">Maximum Word Count</Label>
                <Input
                  type="number"
                  placeholder="e.g., 100"
                  value={question.max_words || ''}
                  onChange={(e) => updateQuestion({ max_words: parseInt(e.target.value) || undefined })}
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
                value={question.correct_answers?.join('\n') || ''}
                onChange={(e) => updateQuestion({ 
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
            {question.question_type?.replace('_', ' ').replace(/\b\w/g, l => l.toUpperCase())} Question
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
              value={question.question_text || ''}
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
                  <Slider
                    defaultValue={[question.difficulty_score || 2]}
                    min={1} max={3} step={1}
                    onValueChange={(value) => updateQuestion({ difficulty_score: value[0] })}
                  />
                  <div className="flex justify-between text-xs text-muted-foreground mt-1">
                    <span>Easy</span>
                    <span>Medium</span>
                    <span>Hard</span>
                  </div>
                </div>
                
                <div>
                  <Label>Estimated Time (minutes)</Label>
                  <Input
                    type="number"
                    min="1"
                    value={question.estimated_time || 2}
                    onChange={(e) => updateQuestion({ estimated_time: parseInt(e.target.value) || 2 })}
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
                  <Label>Cognitive Level (Bloom's Taxonomy)</Label>
                  <Select 
                    value={question.cognitive_level || 'understand'} 
                    onValueChange={(value) => updateQuestion({ cognitive_level: value })}
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
                    value={(question.tags as string[])?.join(', ') || ''}
                    onChange={(e) => updateQuestion({ 
                      tags: e.target.value.split(',').map(t => t.trim()).filter(Boolean) 
                    })}
                  />
                </div>
                
                <div>
                  <Label>Learning Objectives</Label>
                  <Textarea
                    placeholder="Enter learning objectives, one per line"
                    value={(question.learning_objectives as string[])?.join('\n') || ''}
                    onChange={(e) => updateQuestion({ 
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
                  <Badge>{question.difficulty_score ? 'Difficulty: ' + question.difficulty_score : 'No difficulty score'}</Badge>
                  <Badge variant="outline">{question.points} pts</Badge>
                </div>
              </div>
              
              <div className="prose max-w-none">
                <p className="text-base">{question.question_text || 'Enter question text to see preview'}</p>
                
                {question.question_type === 'multiple_choice' && getOptions().length > 0 && (
                  <div className="mt-4 space-y-2">
                    {getOptions().map((option, index) => (
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
                    <Button variant={question.correct_answer === 'true' ? 'default' : 'outline'}>
                      True
                    </Button>
                    <Button variant={question.correct_answer === 'false' ? 'default' : 'outline'}>
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
          <span>Estimated time: {question.estimated_time || 2} minutes</span>
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