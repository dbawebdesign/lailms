/**
 * NEW SCHEMA SHORT ANSWER QUESTION COMPONENT (V2)
 * 
 * Handles short answer questions for the new 4-table assessment schema.
 * Uses Textarea with character counting and auto-resize.
 */

'use client';

import { useState } from 'react';
import { NewSchemaQuestion } from '../types/newSchemaTypes';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';

interface NewSchemaQuestionShortAnswerProps {
  question: NewSchemaQuestion;
  value?: string;
  onChange: (value: string) => void;
  disabled?: boolean;
  maxLength?: number;
}

export function NewSchemaQuestionShortAnswer({
  question,
  value = '',
  onChange,
  disabled = false,
  maxLength = 500
}: NewSchemaQuestionShortAnswerProps) {
  const [charCount, setCharCount] = useState(value.length);

  const handleChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const newValue = e.target.value;
    if (newValue.length <= maxLength) {
      setCharCount(newValue.length);
      onChange(newValue);
    }
  };

  return (
    <div className="space-y-4">
      <div>
        <Label 
          htmlFor={`short-answer-${question.id}`}
          className="text-sm font-medium text-muted-foreground"
        >
          Your Answer
        </Label>
        <Textarea
          id={`short-answer-${question.id}`}
          value={value}
          onChange={handleChange}
          disabled={disabled}
          placeholder="Enter your answer here..."
          className="mt-2 min-h-[120px] resize-none text-base leading-relaxed"
          maxLength={maxLength}
        />
        <div className="flex justify-between items-center mt-2">
          <div className="text-xs text-muted-foreground">
            {question.answer_key?.grading_criteria && (
              <span>💡 Tip: {question.answer_key.grading_criteria}</span>
            )}
          </div>
          <div className="text-xs text-muted-foreground">
            {charCount}/{maxLength} characters
          </div>
        </div>
      </div>
    </div>
  );
} 