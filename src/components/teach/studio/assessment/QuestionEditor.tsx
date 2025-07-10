'use client';

import React, { useState, useEffect } from 'react';
import { Database } from '../../../../../packages/types/db';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { 
  Plus, 
  Save, 
  X, 
  Sparkles,
  Trash2
} from 'lucide-react';
import { QuestionPreview } from './QuestionPreview';
import { createClient } from '@supabase/supabase-js';
import { toast } from 'sonner';

type Question = Database['public']['Tables']['assessment_questions']['Row'] & {
  // Legacy fields that may not exist in current DB schema but are expected by UI
  difficulty_score?: number;
  cognitive_level?: string;
  tags?: string[];
  learning_objectives?: string[];
  estimated_time?: number;
  folder_id?: string;
  ai_generated?: boolean;
  legacy_question_text?: string;
  lesson_id?: string;
};
type QuestionInsert = Database['public']['Tables']['assessment_questions']['Insert'];
type Json = Database['public']['Tables']['assessment_questions']['Row']['answer_key'];

// Define the structure for question options as stored in the JSONB field
interface QuestionOptionData {
  id: string;
  option_text: string;
  is_correct: boolean;
  order_index?: number;
  explanation?: string;
}

interface QuestionEditorProps {
  question: Question | null;
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
  const [editedQuestion, setEditedQuestion] = useState<Partial<Question>>({
    question_text: '',
    question_type: 'multiple_choice',
    points: 1,
    options: null,
    correct_answer: '',
    difficulty_score: 5,
    cognitive_level: 'knowledge',
    tags: [],
    learning_objectives: [],
    estimated_time: 5,
    lesson_id: lessonId || '',
    legacy_question_text: ''
  });
  
  const [options, setOptions] = useState<QuestionOptionData[]>([]);
  const [activeTab, setActiveTab] = useState<'content' | 'settings' | 'preview'>('content');
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [isLoading, setIsLoading] = useState(false);

  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  );

  useEffect(() => {
    if (initialQuestion) {
      setEditedQuestion(initialQuestion);
      
      // Parse options from the JSONB field if it exists
      if (initialQuestion.options && initialQuestion.question_type === 'multiple_choice') {
        try {
          const parsedOptions = Array.isArray(initialQuestion.options) 
            ? (initialQuestion.options as unknown as QuestionOptionData[])
            : [];
          setOptions(parsedOptions);
        } catch (error) {
          console.error('Error parsing question options:', error);
          setOptions([]);
        }
      } else {
        setOptions([]);
      }
    } else {
      // Reset for new question
      setEditedQuestion({
        question_text: '',
        question_type: 'multiple_choice',
        points: 1,
        options: null,
        correct_answer: '',
        difficulty_score: 5,
        cognitive_level: 'knowledge',
        tags: [],
        learning_objectives: [],
        estimated_time: 5,
        lesson_id: lessonId || '',
        legacy_question_text: ''
      });
      setOptions([
        { id: '1', option_text: '', is_correct: false, order_index: 0 },
        { id: '2', option_text: '', is_correct: false, order_index: 1 },
      ]);
    }
  }, [initialQuestion, lessonId]);

  const updateQuestion = (updates: Partial<Question>) => {
    setEditedQuestion(prev => ({ ...prev, ...updates }));
  };

  const validateQuestion = (): boolean => {
    const newErrors: Record<string, string> = {};

    // Validate question text
    const questionText = editedQuestion.question_text?.trim();
    if (!questionText) {
      newErrors.question_text = 'Question text is required';
    }

    // Validate multiple choice questions
    if (editedQuestion.question_type === 'multiple_choice') {
      if (!options || options.length < 2) {
        newErrors.options = 'Multiple choice questions must have at least 2 options';
      } else if (!options.some(opt => opt.is_correct)) {
        newErrors.correct_answer = 'Multiple choice questions must have at least one correct answer';
      }
    }

    // Validate other question types
    if ((editedQuestion.question_type === 'short_answer' || editedQuestion.question_type === 'long_answer') 
        && !editedQuestion.correct_answer) {
      newErrors.correct_answer = 'Answer key is required for this question type';
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSave = async () => {
    if (!validateQuestion()) {
      toast.error('Please fix the validation errors before saving');
      return;
    }

    setIsLoading(true);
    try {
      const questionData: QuestionInsert = {
        assessment_id: baseClassId, // Use baseClassId as assessment_id for now
        question_text: editedQuestion.question_text?.trim() || '',
        question_type: editedQuestion.question_type || 'multiple_choice',
        points: editedQuestion.points || 1,
        order_index: 0, // Default order
        answer_key: editedQuestion.question_type === 'multiple_choice' ? (options as unknown as Json) : (editedQuestion.correct_answer as Json || ''),
        options: editedQuestion.question_type === 'multiple_choice' ? (options as unknown as Json) : null,
        correct_answer: editedQuestion.correct_answer as Json || null,
      };

      if (initialQuestion?.id) {
        // Update existing question
        const { data, error } = await supabase
          .from('assessment_questions')
          .update(questionData)
          .eq('id', initialQuestion.id)
          .select()
          .single();

        if (error) throw error;
        onSave(data);
        toast.success('Question updated successfully');
      } else {
        // Create new question
        const { data, error } = await supabase
          .from('assessment_questions')
          .insert(questionData)
          .select()
          .single();

        if (error) throw error;
        onSave(data);
        toast.success('Question created successfully');
      }
    } catch (error) {
      console.error('Error saving question:', error);
      toast.error('Failed to save question');
    } finally {
      setIsLoading(false);
    }
  };

  const addOption = () => {
    const newOption: QuestionOptionData = {
      id: Date.now().toString(),
      option_text: '',
      is_correct: false,
      order_index: options.length,
    };
    setOptions([...options, newOption]);
  };

  const removeOption = (index: number) => {
    if (options.length > 2) {
      setOptions(options.filter((_, i) => i !== index));
    }
  };

  const updateOption = (index: number, field: keyof QuestionOptionData, value: string | boolean | number) => {
    const updatedOptions = [...options];
    updatedOptions[index] = { ...updatedOptions[index], [field]: value };
    setOptions(updatedOptions);
  };

  const setCorrectOption = (index: number) => {
    const updatedOptions = options.map((opt, i) => ({
      ...opt,
      is_correct: i === index,
    }));
    setOptions(updatedOptions);
  };

  const renderQuestionTypeEditor = () => {
    switch (editedQuestion.question_type) {
      case 'multiple_choice':
        return (
          <div className="space-y-4">
            <div className="flex justify-between items-center">
              <Label>Answer Options</Label>
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={addOption}
                className="flex items-center gap-2"
              >
                <Plus className="h-4 w-4" />
                Add Option
              </Button>
            </div>
            
            <div className="space-y-3">
              {options.map((option, index) => (
                <div key={option.id} className="flex items-center gap-3 p-3 border rounded-lg">
                  <input
                    type="radio"
                    name="correctAnswer"
                    checked={option.is_correct}
                    onChange={() => setCorrectOption(index)}
                    className="h-4 w-4"
                  />
                  <Input
                    value={option.option_text}
                    onChange={(e) => updateOption(index, 'option_text', e.target.value)}
                    placeholder={`Option ${index + 1}`}
                    className="flex-1"
                  />
                  {options.length > 2 && (
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      onClick={() => removeOption(index)}
                      className="text-red-500 hover:text-red-700"
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  )}
                </div>
              ))}
            </div>
            
            {errors.options && (
              <p className="text-sm text-red-500">{errors.options}</p>
            )}
            {errors.correct_answer && (
              <p className="text-sm text-red-500">{errors.correct_answer}</p>
            )}
          </div>
        );

      case 'true_false':
        return (
          <div className="space-y-4">
            <Label>Correct Answer</Label>
            <Select
              value={typeof editedQuestion.correct_answer === 'string' ? editedQuestion.correct_answer : 'true'}
              onValueChange={(value) => updateQuestion({ correct_answer: value })}
            >
              <SelectTrigger>
                <SelectValue placeholder="Select correct answer" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="true">True</SelectItem>
                <SelectItem value="false">False</SelectItem>
              </SelectContent>
            </Select>
          </div>
        );

      case 'short_answer':
      case 'long_answer':
        return (
          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="correctAnswer">Answer Key</Label>
              <Textarea
                id="correctAnswer"
                value={typeof editedQuestion.correct_answer === 'string' ? editedQuestion.correct_answer : ''}
                onChange={(e) => updateQuestion({ correct_answer: e.target.value })}
                placeholder="Enter the correct answer or acceptable answers separated by |"
                className={errors.correct_answer ? 'border-red-500' : ''}
              />
              {errors.correct_answer && (
                <p className="text-sm text-red-500">{errors.correct_answer}</p>
              )}
            </div>
          </div>
        );

      default:
        return null;
    }
  };

  return (
    <Card className="w-full max-w-4xl mx-auto">
      <CardHeader>
        <CardTitle className="flex items-center justify-between">
          <span>{initialQuestion ? 'Edit Question' : 'Create New Question'}</span>
        </CardTitle>
      </CardHeader>

      <CardContent>
        <Tabs value={activeTab} onValueChange={(value) => setActiveTab(value as typeof activeTab)}>
          <TabsList className="grid w-full grid-cols-3">
            <TabsTrigger value="content">Content</TabsTrigger>
            <TabsTrigger value="settings">Settings</TabsTrigger>
            <TabsTrigger value="preview">Preview</TabsTrigger>
          </TabsList>

          <TabsContent value="content" className="space-y-6">
            {/* Question Type */}
            <div className="space-y-2">
              <Label htmlFor="questionType">Question Type</Label>
              <Select
                value={editedQuestion.question_type || 'multiple_choice'}
                onValueChange={(value) => updateQuestion({ question_type: value })}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select question type" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="multiple_choice">Multiple Choice</SelectItem>
                  <SelectItem value="true_false">True/False</SelectItem>
                  <SelectItem value="short_answer">Short Answer</SelectItem>
                  <SelectItem value="long_answer">Long Answer</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {/* Question Text */}
            <div className="space-y-2">
              <Label htmlFor="questionText">Question Text</Label>
              <Textarea
                id="questionText"
                value={editedQuestion.question_text || ''}
                onChange={(e) => updateQuestion({ question_text: e.target.value })}
                placeholder="Enter your question here..."
                rows={3}
                className={errors.question_text ? 'border-red-500' : ''}
              />
              {errors.question_text && (
                <p className="text-sm text-red-500">{errors.question_text}</p>
              )}
            </div>

            {/* Question Type Specific Editor */}
            {renderQuestionTypeEditor()}
          </TabsContent>

          <TabsContent value="settings" className="space-y-6">
            {/* Points */}
            <div className="space-y-2">
              <Label htmlFor="points">Points</Label>
              <Input
                id="points"
                type="number"
                min="1"
                max="100"
                value={editedQuestion.points || 1}
                onChange={(e) => updateQuestion({ points: parseInt(e.target.value) || 1 })}
              />
            </div>

            {/* Difficulty */}
            <div className="space-y-2">
              <Label htmlFor="difficulty">Difficulty (1-10)</Label>
              <Input
                id="difficulty"
                type="number"
                min="1"
                max="10"
                value={editedQuestion.difficulty_score || 5}
                onChange={(e) => updateQuestion({ difficulty_score: parseInt(e.target.value) || 5 })}
              />
            </div>

            {/* Cognitive Level */}
            <div className="space-y-2">
              <Label htmlFor="cognitiveLevel">Cognitive Level</Label>
              <Select
                value={editedQuestion.cognitive_level || 'knowledge'}
                onValueChange={(value) => updateQuestion({ cognitive_level: value })}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select cognitive level" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="knowledge">Knowledge</SelectItem>
                  <SelectItem value="comprehension">Comprehension</SelectItem>
                  <SelectItem value="application">Application</SelectItem>
                  <SelectItem value="analysis">Analysis</SelectItem>
                  <SelectItem value="synthesis">Synthesis</SelectItem>
                  <SelectItem value="evaluation">Evaluation</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {/* Estimated Time */}
            <div className="space-y-2">
              <Label htmlFor="estimatedTime">Estimated Time (minutes)</Label>
              <Input
                id="estimatedTime"
                type="number"
                min="1"
                max="60"
                value={editedQuestion.estimated_time || 5}
                onChange={(e) => updateQuestion({ estimated_time: parseInt(e.target.value) || 5 })}
              />
            </div>
          </TabsContent>

          <TabsContent value="preview" className="space-y-6">
            <QuestionPreview 
              question={{
                ...editedQuestion,
                options: editedQuestion.question_type === 'multiple_choice' ? (options as unknown as Json) : null
              } as Question} 
            />
          </TabsContent>
        </Tabs>

        {/* Action Buttons */}
        <div className="flex justify-end gap-3 pt-6 mt-6 border-t">
          <Button
            type="button"
            variant="outline"
            onClick={onCancel}
            disabled={isLoading}
          >
            <X className="h-4 w-4 mr-2" />
            Cancel
          </Button>
          <Button
            type="button"
            onClick={handleSave}
            disabled={isLoading}
          >
            <Save className="h-4 w-4 mr-2" />
            {isLoading ? 'Saving...' : 'Save Question'}
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}; 