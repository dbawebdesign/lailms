/**
 * NEW SCHEMA MULTIPLE CHOICE QUESTION COMPONENT (V2)
 * 
 * Handles multiple choice questions for the new 4-table assessment schema.
 * Uses RadioGroup for single selection with proper accessibility.
 */

'use client';

import { NewSchemaQuestion } from '../types/newSchemaTypes';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Label } from '@/components/ui/label';

interface MultipleChoiceOption {
  id: string;
  text: string;
}

interface NewSchemaQuestionMultipleChoiceProps {
  question: NewSchemaQuestion;
  value?: string;
  onChange: (value: string) => void;
  disabled?: boolean;
}

export function NewSchemaQuestionMultipleChoice({
  question,
  value,
  onChange,
  disabled = false
}: NewSchemaQuestionMultipleChoiceProps) {
  // Extract options from answer_key JSON structure
  const options: MultipleChoiceOption[] = question.answer_key?.options || [];

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
        {options.map((option, index) => (
          <div 
            key={option.id} 
            className="flex items-start space-x-3 p-4 rounded-lg border border-border hover:bg-accent/10 transition-colors"
          >
            <RadioGroupItem 
              value={option.id} 
              id={`${question.id}-${option.id}`}
              className="mt-0.5 flex-shrink-0"
            />
            <Label 
              htmlFor={`${question.id}-${option.id}`}
              className="text-base leading-relaxed cursor-pointer flex-1"
            >
              <span className="font-medium text-muted-foreground mr-2">
                {String.fromCharCode(65 + index)}.
              </span>
              {option.text}
            </Label>
          </div>
        ))}
      </RadioGroup>
    </div>
  );
} 