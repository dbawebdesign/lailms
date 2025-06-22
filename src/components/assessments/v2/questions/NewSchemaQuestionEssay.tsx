/**
 * NEW SCHEMA ESSAY QUESTION COMPONENT (V2)
 * 
 * Handles essay questions for the new 4-table assessment schema.
 * Features word counting, auto-save, and rubric display.
 */

'use client';

import { useState, useEffect } from 'react';
import { NewSchemaQuestion } from '../types/newSchemaTypes';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { ChevronDown, FileText } from 'lucide-react';

interface NewSchemaQuestionEssayProps {
  question: NewSchemaQuestion;
  value?: string;
  onChange: (value: string) => void;
  disabled?: boolean;
  minWords?: number;
  maxWords?: number;
}

export function NewSchemaQuestionEssay({
  question,
  value = '',
  onChange,
  disabled = false,
  minWords = 50,
  maxWords = 1000
}: NewSchemaQuestionEssayProps) {
  const [wordCount, setWordCount] = useState(0);
  const [showRubric, setShowRubric] = useState(false);

  // Calculate word count
  useEffect(() => {
    const words = value.trim().split(/\s+/).filter(word => word.length > 0);
    setWordCount(words.length);
  }, [value]);

  const handleChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const newValue = e.target.value;
    const words = newValue.trim().split(/\s+/).filter(word => word.length > 0);
    
    if (words.length <= maxWords || newValue.length < value.length) {
      onChange(newValue);
    }
  };

  const getWordCountColor = () => {
    if (wordCount < minWords) return 'text-orange-600';
    if (wordCount > maxWords * 0.9) return 'text-orange-600';
    return 'text-green-600';
  };

  const rubric = question.answer_key?.rubric;
  const keyPoints = question.answer_key?.key_points || [];
  const gradingCriteria = question.answer_key?.grading_criteria;

  return (
    <div className="space-y-6">
      {/* Essay Input */}
      <div>
        <div className="flex items-center justify-between mb-3">
          <Label 
            htmlFor={`essay-${question.id}`}
            className="text-sm font-medium text-muted-foreground"
          >
            Your Essay
          </Label>
          <div className="flex items-center gap-3">
            <Badge variant="outline" className={getWordCountColor()}>
              <FileText className="w-3 h-3 mr-1" />
              {wordCount} / {maxWords} words
            </Badge>
            {wordCount < minWords && (
              <span className="text-xs text-orange-600">
                Minimum {minWords} words required
              </span>
            )}
          </div>
        </div>
        
        <Textarea
          id={`essay-${question.id}`}
          value={value}
          onChange={handleChange}
          disabled={disabled}
          placeholder="Begin writing your essay here. Take your time to develop your thoughts and provide detailed explanations..."
          className="min-h-[300px] text-base leading-relaxed resize-none"
        />
        
        {gradingCriteria && (
          <div className="mt-3 p-3 bg-blue-50 dark:bg-blue-950/20 rounded-lg border border-blue-200 dark:border-blue-800">
            <p className="text-sm text-blue-800 dark:text-blue-200">
              <strong>💡 Grading Focus:</strong> {gradingCriteria}
            </p>
          </div>
        )}
      </div>

      {/* Key Points */}
      {keyPoints.length > 0 && (
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base">Key Points to Consider</CardTitle>
          </CardHeader>
          <CardContent>
            <ul className="space-y-2">
              {keyPoints.map((point: string, index: number) => (
                <li key={index} className="flex items-start gap-2 text-sm">
                  <span className="text-accent font-medium mt-0.5">•</span>
                  <span>{point}</span>
                </li>
              ))}
            </ul>
          </CardContent>
        </Card>
      )}

      {/* Rubric */}
      {rubric && Object.keys(rubric).length > 0 && (
        <Collapsible open={showRubric} onOpenChange={setShowRubric}>
          <CollapsibleTrigger className="flex items-center gap-2 text-sm font-medium text-muted-foreground hover:text-foreground transition-colors">
            <ChevronDown className={`w-4 h-4 transition-transform ${showRubric ? 'rotate-180' : ''}`} />
            View Grading Rubric
          </CollapsibleTrigger>
          <CollapsibleContent className="mt-3">
            <Card>
              <CardContent className="p-4">
                <div className="space-y-4">
                  {Object.entries(rubric).map(([criterion, details]: [string, any]) => (
                    <div key={criterion} className="border-b border-border last:border-b-0 pb-4 last:pb-0">
                      <h4 className="font-medium text-sm mb-2 capitalize">
                        {criterion.replace(/_/g, ' ')} ({details.points} points)
                      </h4>
                      <p className="text-xs text-muted-foreground mb-2">{details.description}</p>
                      <div className="grid grid-cols-2 md:grid-cols-4 gap-2 text-xs">
                        <div className="p-2 bg-green-50 dark:bg-green-950/20 rounded border border-green-200 dark:border-green-800">
                          <div className="font-medium text-green-800 dark:text-green-200">Excellent</div>
                          <div className="text-green-700 dark:text-green-300">{details.excellent}</div>
                        </div>
                        <div className="p-2 bg-blue-50 dark:bg-blue-950/20 rounded border border-blue-200 dark:border-blue-800">
                          <div className="font-medium text-blue-800 dark:text-blue-200">Good</div>
                          <div className="text-blue-700 dark:text-blue-300">{details.good}</div>
                        </div>
                        <div className="p-2 bg-yellow-50 dark:bg-yellow-950/20 rounded border border-yellow-200 dark:border-yellow-800">
                          <div className="font-medium text-yellow-800 dark:text-yellow-200">Fair</div>
                          <div className="text-yellow-700 dark:text-yellow-300">{details.fair}</div>
                        </div>
                        <div className="p-2 bg-red-50 dark:bg-red-950/20 rounded border border-red-200 dark:border-red-800">
                          <div className="font-medium text-red-800 dark:text-red-200">Poor</div>
                          <div className="text-red-700 dark:text-red-300">{details.poor}</div>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          </CollapsibleContent>
        </Collapsible>
      )}
    </div>
  );
} 