'use client';

import React, { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Loader2, Sparkles } from 'lucide-react';
import { cn } from '@/lib/utils';

interface InsertionModalProps {
  isOpen: boolean;
  onClose: () => void;
  itemType: 'path' | 'lesson' | 'section';
  position: 'above' | 'below';
  onSubmit: (data: InsertionFormData) => Promise<void>;
  isLoading?: boolean;
}

export interface InsertionFormData {
  title: string;
  description: string;
  shouldGenerate?: boolean; // Only for sections
}

export const InsertionModal: React.FC<InsertionModalProps> = ({
  isOpen,
  onClose,
  itemType,
  position,
  onSubmit,
  isLoading = false
}) => {
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [shouldGenerate, setShouldGenerate] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Reset form when modal opens/closes
  useEffect(() => {
    if (isOpen) {
      setTitle('');
      setDescription('');
      setShouldGenerate(false);
    }
  }, [isOpen]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!title.trim()) return;
    
    setIsSubmitting(true);
    
    try {
      await onSubmit({
        title: title.trim(),
        description: description.trim(),
        shouldGenerate: itemType === 'section' ? shouldGenerate : undefined
      });
      
      // Close modal on success
      onClose();
    } catch (error) {
      console.error('Error submitting insertion form:', error);
      // Error handling could be improved with toast notifications
    } finally {
      setIsSubmitting(false);
    }
  };

  const getModalTitle = () => {
    const action = position === 'above' ? 'Insert Above' : 'Insert Below';
    const itemName = itemType === 'section' ? 'Lesson Section' : 
                     itemType === 'lesson' ? 'Lesson' : 'Learning Path';
    return `${action}: New ${itemName}`;
  };

  const getModalDescription = () => {
    const itemName = itemType === 'section' ? 'lesson section' : 
                     itemType === 'lesson' ? 'lesson' : 'learning path';
    return `Create a new ${itemName} ${position} the current item.`;
  };

  const getPlaceholders = () => {
    switch (itemType) {
      case 'path':
        return {
          title: 'e.g., Introduction to Algebra',
          description: 'Brief overview of what this learning path covers...'
        };
      case 'lesson':
        return {
          title: 'e.g., Linear Equations',
          description: 'What students will learn in this lesson...'
        };
      case 'section':
        return {
          title: 'e.g., Solving for X',
          description: 'Specific content or concept this section will cover...'
        };
      default:
        return {
          title: 'Enter title...',
          description: 'Enter description...'
        };
    }
  };

  const placeholders = getPlaceholders();

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            {getModalTitle()}
          </DialogTitle>
          <DialogDescription>
            {getModalDescription()}
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          {/* Title Input */}
          <div className="space-y-2">
            <Label htmlFor="title" className="text-sm font-medium">
              Title <span className="text-destructive">*</span>
            </Label>
            <Input
              id="title"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder={placeholders.title}
              required
              disabled={isSubmitting || isLoading}
              className="w-full"
            />
          </div>

          {/* Description Input */}
          <div className="space-y-2">
            <Label htmlFor="description" className="text-sm font-medium">
              Description
            </Label>
            <Textarea
              id="description"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder={placeholders.description}
              disabled={isSubmitting || isLoading}
              className="w-full min-h-[80px] resize-none"
              rows={3}
            />
          </div>

          {/* Generate Section Option (only for sections) */}
          {itemType === 'section' && (
            <div className="space-y-3 p-4 bg-muted/50 rounded-lg border">
              <div className="flex items-center space-x-2">
                <input
                  type="checkbox"
                  id="shouldGenerate"
                  checked={shouldGenerate}
                  onChange={(e) => setShouldGenerate(e.target.checked)}
                  disabled={isSubmitting || isLoading}
                  className="rounded border-gray-300 text-primary focus:ring-primary"
                />
                <Label 
                  htmlFor="shouldGenerate" 
                  className="text-sm font-medium cursor-pointer flex items-center gap-2"
                >
                  <Sparkles size={16} className="text-primary" />
                  Generate content with AI
                </Label>
              </div>
              <p className="text-xs text-muted-foreground ml-6">
                Automatically generate educational content for this lesson section using AI, 
                similar to the course generation process.
              </p>
            </div>
          )}

          {/* Action Buttons */}
          <div className="flex justify-end space-x-2 pt-4">
            <Button
              type="button"
              variant="outline"
              onClick={onClose}
              disabled={isSubmitting || isLoading}
            >
              Cancel
            </Button>
            <Button
              type="submit"
              disabled={!title.trim() || isSubmitting || isLoading}
              className={cn(
                "min-w-[100px]",
                shouldGenerate && itemType === 'section' && "bg-gradient-to-r from-primary to-primary/80"
              )}
            >
              {isSubmitting || isLoading ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  {shouldGenerate && itemType === 'section' ? 'Generating...' : 'Creating...'}
                </>
              ) : (
                <>
                  {shouldGenerate && itemType === 'section' && (
                    <Sparkles className="mr-2 h-4 w-4" />
                  )}
                  {shouldGenerate && itemType === 'section' ? 'Generate' : 'Create'}
                </>
              )}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
};

export default InsertionModal;
