/**
 * NEW SCHEMA TRUE/FALSE QUESTION COMPONENT (V2)
 * 
 * Handles true/false questions for the new 4-table assessment schema.
 */

'use client';

import { NewSchemaQuestion } from '../types/newSchemaTypes';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Label } from '@/components/ui/label';

interface NewSchemaQuestionTrueFalseProps {
  question: NewSchemaQuestion;
  value?: boolean;
  onChange: (value: boolean) => void;
  disabled?: boolean;
}

export function NewSchemaQuestionTrueFalse({
  question,
  value,
  onChange,
  disabled = false
}: NewSchemaQuestionTrueFalseProps) {
  
  return (
    <div className="space-y-4">
      <RadioGroup
        value={value?.toString() || ''}
        onValueChange={(stringValue) => onChange(stringValue === 'true')}
        disabled={disabled}
        className="space-y-3"
      >
        <div className="flex items-center space-x-3 p-4 rounded-lg border border-border hover:bg-accent/10 transition-colors">
          <RadioGroupItem 
            value="true" 
            id={`${question.id}-true`}
            className="flex-shrink-0"
          />
          <Label 
            htmlFor={`${question.id}-true`}
            className="text-base leading-relaxed cursor-pointer flex-1"
          >
            <span className="font-medium text-green-600 mr-2">True</span>
          </Label>
        </div>
        
        <div className="flex items-center space-x-3 p-4 rounded-lg border border-border hover:bg-accent/10 transition-colors">
          <RadioGroupItem 
            value="false" 
            id={`${question.id}-false`}
            className="flex-shrink-0"
          />
          <Label 
            htmlFor={`${question.id}-false`}
            className="text-base leading-relaxed cursor-pointer flex-1"
          >
            <span className="font-medium text-red-600 mr-2">False</span>
          </Label>
        </div>
      </RadioGroup>
    </div>
  );
} 