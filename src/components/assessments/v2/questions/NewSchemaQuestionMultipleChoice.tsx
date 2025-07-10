/**
 * NEW SCHEMA MULTIPLE CHOICE QUESTION COMPONENT (V2)
 * 
 * Handles multiple choice questions for the new 4-table assessment schema.
 * Uses RadioGroup for single selection with proper accessibility.
 */

'use client';

import { NewSchemaQuestion } from '../types/newSchemaTypes';
import { InstantFeedback } from '@/lib/services/instant-grading-service';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { CheckCircle, XCircle } from 'lucide-react';

interface MultipleChoiceOption {
  id: string;
  text: string;
}

interface NewSchemaQuestionMultipleChoiceProps {
  question: NewSchemaQuestion;
  value?: string;
  onChange: (value: string) => void;
  disabled?: boolean;
  instantFeedback?: InstantFeedback;
}

export function NewSchemaQuestionMultipleChoice({
  question,
  value,
  onChange,
  disabled = false,
  instantFeedback
}: NewSchemaQuestionMultipleChoiceProps) {
  // Extract options from the question's options field (array of strings)
  const optionStrings: string[] = question.options || question.answer_key?.options || [];
  
  // Convert string array to objects with id and text
  const options: MultipleChoiceOption[] = optionStrings.map((optionText, index) => ({
    id: String.fromCharCode(65 + index), // A, B, C, D, etc.
    text: optionText
  }));

  if (options.length === 0) {
    return (
      <div className="text-muted-foreground italic">
        No options available for this question.
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <RadioGroup
        value={value || ''}
        onValueChange={onChange}
        disabled={disabled}
        className="space-y-3"
      >
        {options.map((option, index) => {
          const isSelected = value === option.id;
          const showCorrectAnswer = instantFeedback && !instantFeedback.isCorrect;
          const isCorrectOption = question.correct_answer === option.text || question.correct_answer === option.id;
          
          return (
            <div 
              key={option.id} 
              className={`flex items-start space-x-3 p-4 rounded-lg border transition-all duration-300 ${
                isSelected && instantFeedback
                  ? instantFeedback.isCorrect
                    ? 'border-green-300 bg-green-50 dark:border-green-700 dark:bg-green-950/20'
                    : 'border-red-300 bg-red-50 dark:border-red-700 dark:bg-red-950/20'
                  : showCorrectAnswer && isCorrectOption
                  ? 'border-green-300 bg-green-50 dark:border-green-700 dark:bg-green-950/20'
                  : 'border-border hover:bg-accent/10'
              }`}
            >
              <RadioGroupItem 
                value={option.id} 
                id={`${question.id}-${option.id}`}
                className="mt-0.5 flex-shrink-0"
              />
              <Label 
                htmlFor={`${question.id}-${option.id}`}
                className="text-base leading-relaxed cursor-pointer flex-1 flex items-center justify-between"
              >
                <span>
                  <span className="font-medium text-muted-foreground mr-2">
                    {String.fromCharCode(65 + index)}.
                  </span>
                  {option.text}
                </span>
                
                {/* Show feedback icons */}
                {isSelected && instantFeedback && (
                  <div className="flex items-center gap-2 ml-4">
                    {instantFeedback.isCorrect ? (
                      <CheckCircle className="h-5 w-5 text-green-600" />
                    ) : (
                      <XCircle className="h-5 w-5 text-red-600" />
                    )}
                    <Badge variant="outline" className="text-xs">
                      {instantFeedback.pointsEarned}/{instantFeedback.maxPoints} pts
                    </Badge>
                  </div>
                )}
                
                {/* Show correct answer indicator */}
                {showCorrectAnswer && isCorrectOption && !isSelected && (
                  <div className="flex items-center gap-2 ml-4">
                    <CheckCircle className="h-5 w-5 text-green-600" />
                    <Badge variant="outline" className="text-xs bg-green-50 text-green-700">
                      Correct
                    </Badge>
                  </div>
                )}
              </Label>
            </div>
          );
        })}
      </RadioGroup>
      
      {/* Instant Feedback Display */}
      {instantFeedback && (
        <div className={`mt-4 p-4 rounded-lg border transition-all duration-500 animate-in slide-in-from-top-2 ${
          instantFeedback.isCorrect 
            ? 'bg-gradient-to-r from-green-50 to-emerald-50 border-green-200 dark:from-green-950/20 dark:to-emerald-950/20 dark:border-green-800'
            : 'bg-gradient-to-r from-red-50 to-rose-50 border-red-200 dark:from-red-950/20 dark:to-rose-950/20 dark:border-red-800'
        }`}>
          <div className="flex items-center gap-3">
            <div className={`p-1 rounded-full ${
              instantFeedback.isCorrect ? 'bg-green-100 text-green-600 dark:bg-green-900 dark:text-green-400' : 'bg-red-100 text-red-600 dark:bg-red-900 dark:text-red-400'
            }`}>
              {instantFeedback.isCorrect ? <CheckCircle className="h-5 w-5" /> : <XCircle className="h-5 w-5" />}
            </div>
            <div className="flex-1">
              <div className="flex items-center gap-2 mb-1">
                <span className={`font-semibold ${
                  instantFeedback.isCorrect ? 'text-green-800 dark:text-green-200' : 'text-red-800 dark:text-red-200'
                }`}>
                  {instantFeedback.isCorrect ? 'Correct!' : 'Incorrect'}
                </span>
                <Badge variant="outline" className="text-xs">
                  {instantFeedback.pointsEarned}/{instantFeedback.maxPoints} pts
                </Badge>
              </div>
              <p className={`text-sm ${
                instantFeedback.isCorrect ? 'text-green-700 dark:text-green-300' : 'text-red-700 dark:text-red-300'
              }`}>
                {instantFeedback.feedback}
              </p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
} 