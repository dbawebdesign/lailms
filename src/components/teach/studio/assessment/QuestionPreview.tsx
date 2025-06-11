'use client';

import React from 'react';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Checkbox } from '@/components/ui/checkbox';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Label } from '@/components/ui/label';
import { 
  CheckCircle, 
  Clock, 
  Star, 
  Target,
  Brain,
  HelpCircle 
} from 'lucide-react';
import { cn } from '@/lib/utils';

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

interface QuestionPreviewProps {
  question: Question;
  showAnswers?: boolean;
  showMetadata?: boolean;
  interactive?: boolean;
  className?: string;
  questionNumber?: number;
}

export const QuestionPreview: React.FC<QuestionPreviewProps> = ({
  question,
  showAnswers = false,
  showMetadata = false,
  interactive = false,
  className,
  questionNumber
}) => {
  const getDifficultyColor = (difficulty?: string) => {
    switch (difficulty) {
      case 'easy':
        return 'bg-green-100 text-green-700 border-green-200';
      case 'medium':
        return 'bg-yellow-100 text-yellow-700 border-yellow-200';
      case 'hard':
        return 'bg-red-100 text-red-700 border-red-200';
      default:
        return 'bg-gray-100 text-gray-700 border-gray-200';
    }
  };

  const renderQuestionContent = () => {
    switch (question.question_type) {
      case 'multiple_choice':
        return (
          <div className="space-y-3">
            {question.options?.map((option, index) => (
              <div 
                key={option.id}
                className={cn(
                  "flex items-center gap-3 p-3 rounded-lg border transition-colors",
                  showAnswers && option.is_correct 
                    ? "bg-green-50 border-green-200" 
                    : "bg-gray-50 border-gray-200 hover:bg-gray-100",
                  interactive && "cursor-pointer"
                )}
              >
                {interactive ? (
                  <RadioGroup>
                    <div className="flex items-center space-x-2">
                      <RadioGroupItem value={option.id} id={option.id} />
                      <Label htmlFor={option.id} className="cursor-pointer">
                        <span className="font-medium text-sm mr-2">
                          {String.fromCharCode(65 + index)}.
                        </span>
                        {option.option_text}
                      </Label>
                    </div>
                  </RadioGroup>
                ) : (
                  <>
                    <div className="w-6 h-6 rounded-full border-2 border-gray-300 flex items-center justify-center text-sm font-medium">
                      {String.fromCharCode(65 + index)}
                    </div>
                    <span className="flex-1">{option.option_text}</span>
                    {showAnswers && option.is_correct && (
                      <CheckCircle className="h-5 w-5 text-green-600" />
                    )}
                  </>
                )}
              </div>
            ))}
          </div>
        );

      case 'true_false':
        return (
          <div className="flex gap-4">
            <div 
              className={cn(
                "flex-1 p-4 rounded-lg border-2 text-center transition-colors",
                showAnswers && question.metadata?.correct_answer === 'true'
                  ? "bg-green-50 border-green-500"
                  : "bg-gray-50 border-gray-200",
                interactive && "cursor-pointer hover:bg-gray-100"
              )}
            >
              <div className="flex items-center justify-center gap-2">
                {interactive && <RadioGroupItem value="true" />}
                <span className="font-medium">True</span>
                {showAnswers && question.metadata?.correct_answer === 'true' && (
                  <CheckCircle className="h-5 w-5 text-green-600" />
                )}
              </div>
            </div>
            <div 
              className={cn(
                "flex-1 p-4 rounded-lg border-2 text-center transition-colors",
                showAnswers && question.metadata?.correct_answer === 'false'
                  ? "bg-green-50 border-green-500"
                  : "bg-gray-50 border-gray-200",
                interactive && "cursor-pointer hover:bg-gray-100"
              )}
            >
              <div className="flex items-center justify-center gap-2">
                {interactive && <RadioGroupItem value="false" />}
                <span className="font-medium">False</span>
                {showAnswers && question.metadata?.correct_answer === 'false' && (
                  <CheckCircle className="h-5 w-5 text-green-600" />
                )}
              </div>
            </div>
          </div>
        );

      case 'short_answer':
        return (
          <div className="space-y-3">
            {interactive ? (
              <Textarea
                placeholder="Enter your answer here..."
                rows={3}
                className="w-full"
              />
            ) : (
              <div className="p-4 bg-gray-50 border border-gray-200 rounded-lg">
                <p className="text-gray-500 italic">Student answer will appear here</p>
              </div>
            )}
            
            {showAnswers && question.metadata?.model_answer && (
              <div className="mt-4 p-4 bg-blue-50 border border-blue-200 rounded-lg">
                <h5 className="font-medium text-blue-900 mb-2">Model Answer:</h5>
                <p className="text-blue-800">{question.metadata.model_answer}</p>
              </div>
            )}
            
            {question.metadata?.max_words && (
              <p className="text-sm text-muted-foreground">
                Maximum {question.metadata.max_words} words
              </p>
            )}
          </div>
        );

      case 'essay':
        return (
          <div className="space-y-3">
            {interactive ? (
              <Textarea
                placeholder="Write your essay here..."
                rows={8}
                className="w-full"
              />
            ) : (
              <div className="p-6 bg-gray-50 border border-gray-200 rounded-lg min-h-[200px]">
                <p className="text-gray-500 italic">Student essay will appear here</p>
              </div>
            )}
            
            {showAnswers && question.metadata?.model_answer && (
              <div className="mt-4 p-4 bg-blue-50 border border-blue-200 rounded-lg">
                <h5 className="font-medium text-blue-900 mb-2">Model Answer:</h5>
                <p className="text-blue-800 whitespace-pre-wrap">{question.metadata.model_answer}</p>
              </div>
            )}
            
            {showAnswers && question.metadata?.grading_rubric && (
              <div className="mt-4 p-4 bg-purple-50 border border-purple-200 rounded-lg">
                <h5 className="font-medium text-purple-900 mb-2">Grading Rubric:</h5>
                <p className="text-purple-800 whitespace-pre-wrap">{question.metadata.grading_rubric}</p>
              </div>
            )}
          </div>
        );

      case 'fill_in_blank':
        const questionWithBlanks = question.question_text.split('_____').map((part, index, array) => (
          <React.Fragment key={index}>
            {part}
            {index < array.length - 1 && (
              interactive ? (
                <Input 
                  className="inline-block w-32 mx-2" 
                  placeholder="____"
                />
              ) : (
                <span className="inline-block w-32 mx-2 px-2 py-1 bg-gray-100 border border-gray-300 rounded">
                  ____
                </span>
              )
            )}
          </React.Fragment>
        ));

        return (
          <div className="space-y-4">
            <div className="text-base leading-relaxed">
              {questionWithBlanks}
            </div>
            
            {showAnswers && question.metadata?.correct_answers && (
              <div className="mt-4 p-4 bg-green-50 border border-green-200 rounded-lg">
                <h5 className="font-medium text-green-900 mb-2">Correct Answers:</h5>
                <ul className="text-green-800 space-y-1">
                  {question.metadata.correct_answers.map((answer, index) => (
                    <li key={index}>• {answer}</li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        );

      default:
        return (
          <div className="text-center py-8">
            <HelpCircle className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
            <p className="text-muted-foreground">
              Preview for {question.question_type.replace('_', ' ')} questions coming soon
            </p>
          </div>
        );
    }
  };

  return (
    <Card className={cn("p-6", className)}>
      {/* Question Header */}
      <div className="flex items-start justify-between mb-4">
        <div className="flex items-center gap-3">
          {questionNumber && (
            <div className="w-8 h-8 bg-primary text-primary-foreground rounded-full flex items-center justify-center font-medium text-sm">
              {questionNumber}
            </div>
          )}
          <div>
            <Badge variant="outline" className="text-xs">
              {question.question_type.replace('_', ' ').replace(/\b\w/g, l => l.toUpperCase())}
            </Badge>
            {question.metadata?.ai_generated && (
              <Badge variant="secondary" className="text-xs ml-2">
                <Brain className="h-3 w-3 mr-1" />
                AI Generated
              </Badge>
            )}
          </div>
        </div>
        
        <div className="flex items-center gap-2">
          <Badge variant="outline" className="text-xs">
            {question.points} pt{question.points !== 1 ? 's' : ''}
          </Badge>
          {question.metadata?.difficulty_level && (
            <Badge 
              className={cn("text-xs", getDifficultyColor(question.metadata.difficulty_level))}
            >
              {question.metadata.difficulty_level}
            </Badge>
          )}
          {question.metadata?.estimated_time && (
            <div className="flex items-center gap-1 text-xs text-muted-foreground">
              <Clock className="h-3 w-3" />
              {question.metadata.estimated_time}m
            </div>
          )}
        </div>
      </div>

      {/* Question Text */}
      <div className="mb-6">
        <h4 className="text-lg font-medium leading-relaxed mb-2">
          {question.question_text || 'Question text not provided'}
        </h4>
      </div>

      {/* Question Content */}
      <div className="mb-6">
        {renderQuestionContent()}
      </div>

      {/* Metadata */}
      {showMetadata && question.metadata && (
        <div className="border-t pt-4 space-y-3">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
            {question.metadata.bloom_taxonomy && (
              <div>
                <span className="font-medium text-muted-foreground">Bloom's Taxonomy: </span>
                <span className="capitalize">{question.metadata.bloom_taxonomy}</span>
              </div>
            )}
            
            {question.metadata.learning_objectives && question.metadata.learning_objectives.length > 0 && (
              <div>
                <span className="font-medium text-muted-foreground">Learning Objectives: </span>
                <span>{question.metadata.learning_objectives.join(', ')}</span>
              </div>
            )}
            
            {question.metadata.tags && question.metadata.tags.length > 0 && (
              <div className="md:col-span-2">
                <span className="font-medium text-muted-foreground">Tags: </span>
                <div className="inline-flex gap-1 mt-1">
                  {question.metadata.tags.map(tag => (
                    <Badge key={tag} variant="secondary" className="text-xs">
                      {tag}
                    </Badge>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </Card>
  );
};