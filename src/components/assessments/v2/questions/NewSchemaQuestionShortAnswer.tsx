/**
 * NEW SCHEMA SHORT ANSWER QUESTION COMPONENT (V2)
 * 
 * Handles short answer questions for the new 4-table assessment schema.
 * Uses Textarea with character counting and auto-resize.
 */

'use client';

import { useState } from 'react';
import { NewSchemaQuestion } from '../types/newSchemaTypes';
import { InstantFeedback } from '@/lib/services/instant-grading-service';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Clock, CheckCircle } from 'lucide-react';

interface NewSchemaQuestionShortAnswerProps {
  question: NewSchemaQuestion;
  value?: string;
  onChange: (value: string) => void;
  disabled?: boolean;
  maxLength?: number;
  instantFeedback?: InstantFeedback;
}

export function NewSchemaQuestionShortAnswer({
  question,
  value = '',
  onChange,
  disabled = false,
  maxLength = 500,
  instantFeedback
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

      {/* Submission Feedback */}
      {instantFeedback && (
        <div className={`mt-4 p-4 rounded-lg border transition-all duration-500 animate-in slide-in-from-top-2 ${
          instantFeedback.confidence < 1.0 
            ? 'bg-gradient-to-r from-blue-50 to-indigo-50 border-blue-200 dark:from-blue-950/20 dark:to-indigo-950/20 dark:border-blue-800'
            : instantFeedback.isCorrect 
            ? 'bg-gradient-to-r from-green-50 to-emerald-50 border-green-200 dark:from-green-950/20 dark:to-emerald-950/20 dark:border-green-800'
            : 'bg-gradient-to-r from-red-50 to-rose-50 border-red-200 dark:from-red-950/20 dark:to-rose-950/20 dark:border-red-800'
        }`}>
          <div className="flex items-center gap-3">
            <div className={`p-1 rounded-full ${
              instantFeedback.confidence < 1.0 
                ? 'bg-blue-100 text-blue-600 dark:bg-blue-900 dark:text-blue-400'
                : instantFeedback.isCorrect 
                ? 'bg-green-100 text-green-600 dark:bg-green-900 dark:text-green-400' 
                : 'bg-red-100 text-red-600 dark:bg-red-900 dark:text-red-400'
            }`}>
              {instantFeedback.confidence < 1.0 ? (
                <Clock className="h-5 w-5" />
              ) : (
                <CheckCircle className="h-5 w-5" />
              )}
            </div>
            <div className="flex-1">
              <div className="flex items-center gap-2 mb-1">
                <span className={`font-semibold ${
                  instantFeedback.confidence < 1.0 
                    ? 'text-blue-800 dark:text-blue-200'
                    : instantFeedback.isCorrect 
                    ? 'text-green-800 dark:text-green-200' 
                    : 'text-red-800 dark:text-red-200'
                }`}>
                  {instantFeedback.confidence < 1.0 ? 'Submitted for AI Grading' : (instantFeedback.isCorrect ? 'Submitted' : 'Submitted')}
                </span>
                {instantFeedback.confidence >= 1.0 && (
                  <Badge variant="outline" className="text-xs">
                    {instantFeedback.pointsEarned}/{instantFeedback.maxPoints} pts
                  </Badge>
                )}
              </div>
              <p className={`text-sm ${
                instantFeedback.confidence < 1.0 
                  ? 'text-blue-700 dark:text-blue-300'
                  : instantFeedback.isCorrect 
                  ? 'text-green-700 dark:text-green-300' 
                  : 'text-red-700 dark:text-red-300'
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