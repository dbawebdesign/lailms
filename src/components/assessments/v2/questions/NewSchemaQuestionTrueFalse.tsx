/**
 * NEW SCHEMA TRUE/FALSE QUESTION COMPONENT (V2)
 * 
 * Handles true/false questions for the new 4-table assessment schema.
 */

'use client';

import { NewSchemaQuestion } from '../types/newSchemaTypes';
import { InstantFeedback } from '@/lib/services/instant-grading-service';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { CheckCircle, XCircle, Check, X } from 'lucide-react';

interface NewSchemaQuestionTrueFalseProps {
  question: NewSchemaQuestion;
  value?: boolean;
  onChange: (value: boolean) => void;
  disabled?: boolean;
  instantFeedback?: InstantFeedback;
}

export function NewSchemaQuestionTrueFalse({
  question,
  value,
  onChange,
  disabled = false,
  instantFeedback
}: NewSchemaQuestionTrueFalseProps) {
  
  const trueSelected = value === true;
  const falseSelected = value === false;
  const showCorrectAnswer = instantFeedback && !instantFeedback.isCorrect;
  const correctAnswer = question.correct_answer;
  
  return (
    <div className="space-y-4">
      <RadioGroup
        value={value?.toString() || ''}
        onValueChange={(stringValue) => onChange(stringValue === 'true')}
        disabled={disabled}
        className="space-y-3"
      >
        {/* True Option */}
        <div className={`flex items-center space-x-3 p-6 rounded-lg border transition-all duration-300 ${
          trueSelected && instantFeedback
            ? instantFeedback.isCorrect
              ? 'border-green-300 bg-green-50 dark:border-green-700 dark:bg-green-950/20'
              : 'border-red-300 bg-red-50 dark:border-red-700 dark:bg-red-950/20'
            : showCorrectAnswer && correctAnswer === true
            ? 'border-green-300 bg-green-50 dark:border-green-700 dark:bg-green-950/20'
            : 'border-border hover:bg-accent/10'
        }`}>
          <RadioGroupItem 
            value="true" 
            id={`${question.id}-true`}
            className="flex-shrink-0"
          />
          <Label 
            htmlFor={`${question.id}-true`}
            className="text-base leading-relaxed cursor-pointer flex-1 flex items-center justify-between"
          >
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-full bg-green-100 text-green-600 dark:bg-green-900 dark:text-green-400">
                <Check className="h-4 w-4" />
              </div>
              <span className="font-medium text-green-600 dark:text-green-400">True</span>
            </div>
            
            {/* Show feedback for true option */}
            {trueSelected && instantFeedback && (
              <div className="flex items-center gap-2">
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
            
            {/* Show correct answer indicator for true */}
            {showCorrectAnswer && correctAnswer === true && !trueSelected && (
              <div className="flex items-center gap-2">
                <CheckCircle className="h-5 w-5 text-green-600" />
                <Badge variant="outline" className="text-xs bg-green-50 text-green-700">
                  Correct
                </Badge>
              </div>
            )}
          </Label>
        </div>
        
        {/* False Option */}
        <div className={`flex items-center space-x-3 p-6 rounded-lg border transition-all duration-300 ${
          falseSelected && instantFeedback
            ? instantFeedback.isCorrect
              ? 'border-green-300 bg-green-50 dark:border-green-700 dark:bg-green-950/20'
              : 'border-red-300 bg-red-50 dark:border-red-700 dark:bg-red-950/20'
            : showCorrectAnswer && correctAnswer === false
            ? 'border-green-300 bg-green-50 dark:border-green-700 dark:bg-green-950/20'
            : 'border-border hover:bg-accent/10'
        }`}>
          <RadioGroupItem 
            value="false" 
            id={`${question.id}-false`}
            className="flex-shrink-0"
          />
          <Label 
            htmlFor={`${question.id}-false`}
            className="text-base leading-relaxed cursor-pointer flex-1 flex items-center justify-between"
          >
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-full bg-red-100 text-red-600 dark:bg-red-900 dark:text-red-400">
                <X className="h-4 w-4" />
              </div>
              <span className="font-medium text-red-600 dark:text-red-400">False</span>
            </div>
            
            {/* Show feedback for false option */}
            {falseSelected && instantFeedback && (
              <div className="flex items-center gap-2">
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
            
            {/* Show correct answer indicator for false */}
            {showCorrectAnswer && correctAnswer === false && !falseSelected && (
              <div className="flex items-center gap-2">
                <CheckCircle className="h-5 w-5 text-green-600" />
                <Badge variant="outline" className="text-xs bg-green-50 text-green-700">
                  Correct
                </Badge>
              </div>
            )}
          </Label>
        </div>
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