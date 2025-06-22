/**
 * NEW SCHEMA MATCHING QUESTION COMPONENT (V2)
 * 
 * Handles matching questions for the new 4-table assessment schema.
 * Uses dropdown selectors for simplicity and accessibility.
 */

'use client';

import { NewSchemaQuestion } from '../types/newSchemaTypes';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Label } from '@/components/ui/label';
import { Card, CardContent } from '@/components/ui/card';

interface MatchingPair {
  left: string;
  right: string;
}

interface NewSchemaQuestionMatchingProps {
  question: NewSchemaQuestion;
  value?: Record<string, string>;
  onChange: (value: Record<string, string>) => void;
  disabled?: boolean;
}

export function NewSchemaQuestionMatching({
  question,
  value = {},
  onChange,
  disabled = false
}: NewSchemaQuestionMatchingProps) {
  
  // Extract matching data from answer_key
  const leftItems: string[] = question.answer_key?.left_items || [];
  const rightItems: string[] = question.answer_key?.right_items || [];

  if (leftItems.length === 0 || rightItems.length === 0) {
    return (
      <div className="text-muted-foreground italic">
        No matching items available for this question.
      </div>
    );
  }

  const handleMatchChange = (leftItem: string, rightItem: string) => {
    const newMatches = { ...value };
    if (rightItem === 'unselected') {
      delete newMatches[leftItem];
    } else {
      newMatches[leftItem] = rightItem;
    }
    onChange(newMatches);
  };

  // Get used right items to prevent duplicate selections
  const usedRightItems = Object.values(value);

  return (
    <div className="space-y-4">
      <div className="text-sm text-muted-foreground mb-4">
        Match each item on the left with the correct item on the right.
      </div>
      
      <div className="space-y-3">
        {leftItems.map((leftItem, index) => (
          <Card key={index} className="p-4">
            <CardContent className="p-0">
              <div className="flex items-center gap-4">
                {/* Left item */}
                <div className="flex-1">
                  <Label className="text-sm font-medium">
                    <span className="text-accent mr-2">{index + 1}.</span>
                    {leftItem}
                  </Label>
                </div>
                
                {/* Arrow */}
                <div className="text-muted-foreground">
                  →
                </div>
                
                {/* Right item selector */}
                <div className="flex-1">
                  <Select
                    value={value[leftItem] || 'unselected'}
                    onValueChange={(selectedRight) => handleMatchChange(leftItem, selectedRight)}
                    disabled={disabled}
                  >
                    <SelectTrigger className="w-full">
                      <SelectValue placeholder="Select a match..." />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="unselected">
                        <span className="text-muted-foreground">-- Select a match --</span>
                      </SelectItem>
                      {rightItems.map((rightItem, rightIndex) => {
                        const isUsed = usedRightItems.includes(rightItem) && value[leftItem] !== rightItem;
                        return (
                          <SelectItem 
                            key={rightIndex} 
                            value={rightItem}
                            disabled={isUsed}
                          >
                            <div className="flex items-center justify-between w-full">
                              <span className={isUsed ? 'text-muted-foreground line-through' : ''}>
                                {rightItem}
                              </span>
                              {isUsed && (
                                <span className="text-xs text-muted-foreground ml-2">(used)</span>
                              )}
                            </div>
                          </SelectItem>
                        );
                      })}
                    </SelectContent>
                  </Select>
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
      
      {/* Progress indicator */}
      <div className="text-xs text-muted-foreground text-center mt-4">
        {Object.keys(value).length} of {leftItems.length} matches completed
      </div>
    </div>
  );
} 