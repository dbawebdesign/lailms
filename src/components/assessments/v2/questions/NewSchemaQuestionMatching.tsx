/**
 * NEW SCHEMA MATCHING QUESTION COMPONENT (V2)
 * 
 * Handles matching questions for the new 4-table assessment schema.
 * Uses dropdown selectors for simplicity and accessibility.
 */

'use client';

import { NewSchemaQuestion } from '../types/newSchemaTypes';
import { InstantFeedback } from '@/lib/services/instant-grading-service';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Label } from '@/components/ui/label';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { CheckCircle, XCircle } from 'lucide-react';

interface MatchingPair {
  left: string;
  right: string;
}

interface NewSchemaQuestionMatchingProps {
  question: NewSchemaQuestion;
  value?: Record<string, string>;
  onChange: (value: Record<string, string>) => void;
  disabled?: boolean;
  instantFeedback?: InstantFeedback;
}

export function NewSchemaQuestionMatching({
  question,
  value = {},
  onChange,
  disabled = false,
  instantFeedback
}: NewSchemaQuestionMatchingProps) {
  
  // Extract matching data from options or answer_key
  const leftItems: string[] = question.options?.left_items || question.answer_key?.left_items || [];
  const rightItems: string[] = question.options?.right_items || question.answer_key?.right_items || [];

  if (leftItems.length === 0 || rightItems.length === 0) {
    return (
      <div className="text-muted-foreground italic">
        No matching items available for this question.
      </div>
    );
  }

  const handleMatchChange = (leftItemKey: string, rightItem: string) => {
    const newMatches = { ...value };
    if (rightItem === 'unselected') {
      delete newMatches[leftItemKey];
    } else {
      newMatches[leftItemKey] = rightItem;
    }
    onChange(newMatches);
  };

  // Get unique right items for display (remove duplicates for UI)
  const uniqueRightItems = Array.from(new Set(rightItems));
  
  // Determine how many times each right item can be used
  // First, try to get this from the answer key pairs
  const rightItemCounts: Record<string, number> = {};
  
  if (question.answer_key?.pairs) {
    // Count how many times each right item appears in the answer key
    question.answer_key.pairs.forEach((pair: MatchingPair) => {
      rightItemCounts[pair.right] = (rightItemCounts[pair.right] || 0) + 1;
    });
    console.log('Using answer key pairs for counts:', rightItemCounts);
  } else {
    // Fallback: count occurrences in the right_items array
    rightItems.forEach(item => {
      rightItemCounts[item] = (rightItemCounts[item] || 0) + 1;
    });
    console.log('Using right_items array for counts:', rightItemCounts);
  }
  
  // If we still don't have counts, default to allowing each right item to be used once
  uniqueRightItems.forEach(item => {
    if (!(item in rightItemCounts)) {
      rightItemCounts[item] = 1;
    }
  });
  
  console.log('Final rightItemCounts:', rightItemCounts);
  
  // Count how many times each right item has been used
  const usedRightItemCounts: Record<string, number> = {};
  Object.values(value).forEach(item => {
    usedRightItemCounts[item] = (usedRightItemCounts[item] || 0) + 1;
  });
  
  console.log('Current usedRightItemCounts:', usedRightItemCounts);
  console.log('Current value:', value);

  // Check correct matches for visual feedback
  const correctPairs: Record<string, string> = {};
  if (question.answer_key?.pairs) {
    question.answer_key.pairs.forEach((pair: MatchingPair) => {
      const leftItemKey = leftItems.indexOf(pair.left) >= 0 ? `${leftItems.indexOf(pair.left)}:${pair.left}` : pair.left;
      correctPairs[leftItemKey] = pair.right;
    });
  }

  return (
    <div className="space-y-4">
      <div className="text-sm text-muted-foreground mb-4">
        Match each item on the left with the correct item on the right.
      </div>
      
      <div className="space-y-3">
        {leftItems.map((leftItem, index) => {
          // Create unique key for each left item using index
          const leftItemKey = `${index}:${leftItem}`;
          const selectedMatch = value[leftItemKey];
          const correctMatch = correctPairs[leftItemKey];
          const isCorrectMatch = selectedMatch && selectedMatch === correctMatch;
          const isIncorrectMatch = selectedMatch && selectedMatch !== correctMatch && instantFeedback && !instantFeedback.isCorrect;
          const showCorrectAnswer = instantFeedback && !instantFeedback.isCorrect && selectedMatch;
          
          return (
            <Card key={index} className={`p-4 transition-all duration-300 ${
              isCorrectMatch && instantFeedback
                ? 'border-green-300 bg-green-50 dark:border-green-700 dark:bg-green-950/20'
                : isIncorrectMatch
                ? 'border-red-300 bg-red-50 dark:border-red-700 dark:bg-red-950/20'
                : ''
            }`}>
              <CardContent className="p-0">
                <div className="flex items-center gap-4">
                  {/* Left item */}
                  <div className="flex-1">
                    <Label className="text-sm font-medium flex items-center gap-2">
                      <span className="text-accent mr-2">{index + 1}.</span>
                      {leftItem}
                      
                      {/* Show feedback icon for this match */}
                      {selectedMatch && instantFeedback && (
                        isCorrectMatch ? (
                          <CheckCircle className="h-4 w-4 text-green-600" />
                        ) : (
                          <XCircle className="h-4 w-4 text-red-600" />
                        )
                      )}
                    </Label>
                  </div>
                  
                  {/* Arrow */}
                  <div className="text-muted-foreground">
                    →
                  </div>
                  
                  {/* Right item selector */}
                  <div className="flex-1">
                    <Select
                      value={value[leftItemKey] || 'unselected'}
                      onValueChange={(selectedRight) => handleMatchChange(leftItemKey, selectedRight)}
                      disabled={disabled}
                    >
                    <SelectTrigger className="w-full">
                      <SelectValue placeholder="Select a match..." />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="unselected">
                        <span className="text-muted-foreground">-- Select a match --</span>
                      </SelectItem>
                      {uniqueRightItems.map((rightItem, rightIndex) => {
                        // Check if this item has reached its usage limit
                        // But allow selection if it's already selected for this left item
                        const availableCount = rightItemCounts[rightItem] || 1;
                        const usedCount = usedRightItemCounts[rightItem] || 0;
                        const isCurrentlySelected = value[leftItemKey] === rightItem;
                        const isFullyUsed = usedCount >= availableCount && !isCurrentlySelected;
                        
                        return (
                          <SelectItem 
                            key={rightIndex} 
                            value={rightItem}
                            disabled={isFullyUsed}
                          >
                            <div className="flex items-center justify-between w-full">
                              <span className={isFullyUsed ? 'text-muted-foreground line-through' : ''}>
                                {rightItem}
                              </span>
                              {isFullyUsed && (
                                <span className="text-xs text-muted-foreground ml-2">(fully used)</span>
                              )}
                              {availableCount > 1 && (
                                <span className="text-xs text-muted-foreground ml-2">
                                  ({usedCount}/{availableCount})
                                </span>
                              )}
                            </div>
                          </SelectItem>
                        );
                      })}
                    </SelectContent>
                  </Select>
                  </div>
                </div>
                
                {/* Show correct answer hint for this specific match if incorrect */}
                {showCorrectAnswer && correctMatch && selectedMatch !== correctMatch && (
                  <div className="mt-2 p-2 bg-green-50 dark:bg-green-950/20 rounded border border-green-200 dark:border-green-800">
                    <div className="flex items-center gap-2 text-sm">
                      <CheckCircle className="h-4 w-4 text-green-600" />
                      <span className="text-green-700 dark:text-green-300">
                        Correct match: <strong>{correctMatch}</strong>
                      </span>
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>
          );
        })}
      </div>
      
      {/* Progress indicator */}
      <div className="text-xs text-muted-foreground text-center mt-4">
        {Object.keys(value).length} of {leftItems.length} matches completed
      </div>
      
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
                  {instantFeedback.isCorrect ? 'Perfect Match!' : 'Some matches need review'}
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