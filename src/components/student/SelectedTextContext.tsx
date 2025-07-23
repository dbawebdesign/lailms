'use client';

import React from 'react';
import { Badge } from '@/components/ui/badge';
import { Card } from '@/components/ui/card';
import { FileText, X } from 'lucide-react';
import { Button } from '@/components/ui/button';

interface SelectedTextContextProps {
  selectedText: string;
  source?: string;
  onRemove?: () => void;
}

export function SelectedTextContext({ 
  selectedText, 
  source = "lesson content", 
  onRemove 
}: SelectedTextContextProps) {
  const truncatedText = selectedText.length > 100 
    ? selectedText.substring(0, 100) + '...' 
    : selectedText;

  return (
    <Card className="p-3 bg-purple-50 dark:bg-purple-900/20 border-purple-200 dark:border-purple-700/50">
      <div className="flex items-start justify-between gap-2">
        <div className="flex items-start gap-2 flex-1 min-w-0">
          <div className="p-1 rounded bg-purple-100 dark:bg-purple-800/50 mt-0.5">
            <FileText className="h-3 w-3 text-purple-600 dark:text-purple-400" />
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 mb-1">
              <Badge variant="secondary" className="text-xs bg-purple-100 dark:bg-purple-800/50 text-purple-700 dark:text-purple-300">
                Selected
              </Badge>
              <span className="text-xs text-purple-600 dark:text-purple-400 truncate">
                from {source}
              </span>
            </div>
            <p className="text-sm text-purple-800 dark:text-purple-200 italic">
              "{truncatedText}"
            </p>
          </div>
        </div>
        {onRemove && (
          <Button
            variant="ghost"
            size="sm"
            onClick={onRemove}
            className="h-6 w-6 p-0 text-purple-500 hover:text-purple-700 dark:text-purple-400 dark:hover:text-purple-200"
          >
            <X className="h-3 w-3" />
          </Button>
        )}
      </div>
    </Card>
  );
} 