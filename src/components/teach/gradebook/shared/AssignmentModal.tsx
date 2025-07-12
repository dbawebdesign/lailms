'use client';

import React, { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Checkbox } from '@/components/ui/checkbox';
import { Tables } from '../../../../../packages/types/db';

type Assignment = Tables<'assignments'>;

interface AssignmentModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  assignment?: Assignment | null;
  classInstanceId: string;
  onSubmit: (assignmentData: Partial<Assignment>) => Promise<void>;
  isSubmitting?: boolean;
}

export function AssignmentModal({
  open,
  onOpenChange,
  assignment,
  classInstanceId,
  onSubmit,
  isSubmitting = false
}: AssignmentModalProps) {
  const [formData, setFormData] = useState({
    name: '',
    description: '',
    type: 'assignment' as Assignment['type'],
    category: '',
    points_possible: 100,
    due_date: '',
    published: false
  });

  const isEditing = !!assignment;

  useEffect(() => {
    if (open) {
      if (isEditing && assignment) {
        // Convert ISO date to datetime-local format
        let formattedDate = '';
        if (assignment.due_date) {
          const date = new Date(assignment.due_date);
          // Format for datetime-local input (YYYY-MM-DDTHH:mm)
          formattedDate = date.toISOString().slice(0, 16);
        }
        
        setFormData({
          name: assignment.name || '',
          description: assignment.description || '',
          type: assignment.type,
          category: assignment.category || '',
          points_possible: assignment.points_possible || 100,
          due_date: formattedDate,
          published: assignment.published || false
        });
      } else {
        setFormData({
          name: '',
          description: '',
          type: 'assignment',
          category: '',
          points_possible: 100,
          due_date: '',
          published: false
        });
      }
    }
  }, [open, isEditing, assignment]);

  const handleSubmit = async () => {
    if (!formData.name.trim()) {
      alert('Assignment name is required');
      return;
    }

    try {
      // Convert datetime-local format to ISO string for database
      let formattedDueDate = null;
      if (formData.due_date) {
        const date = new Date(formData.due_date);
        formattedDueDate = date.toISOString();
      }

      const assignmentData = {
        name: formData.name.trim(),
        description: formData.description.trim(),
        type: formData.type,
        category: formData.category.trim(),
        points_possible: formData.points_possible,
        due_date: formattedDueDate,
        published: formData.published,
        class_instance_id: classInstanceId
      };

      await onSubmit(assignmentData);
      
      // Reset form
      setFormData({
        name: '',
        description: '',
        type: 'assignment',
        category: '',
        points_possible: 100,
        due_date: '',
        published: false
      });
      
      onOpenChange(false);
    } catch (error) {
      console.error('Failed to save assignment:', error);
      alert('Failed to save assignment. Please try again.');
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto bg-background border-divider">
        <DialogHeader>
          <DialogTitle className="text-h2 text-foreground">
            {isEditing ? 'Edit Assignment' : 'Create New Assignment'}
          </DialogTitle>
        </DialogHeader>
        
        <div className="space-y-6 py-4">
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="name" className="text-body font-medium text-foreground">Assignment Name</Label>
              <Input
                id="name"
                placeholder="Enter assignment name"
                value={formData.name}
                onChange={(e) => setFormData({...formData, name: e.target.value})}
                className="border-divider focus:border-primary/50"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="type" className="text-body font-medium text-foreground">Type</Label>
              <Select value={formData.type} onValueChange={(value) => setFormData({...formData, type: value as Assignment['type']})}>
                <SelectTrigger className="border-divider">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="quiz">Quiz</SelectItem>
                  <SelectItem value="assignment">Assignment</SelectItem>
                  <SelectItem value="project">Project</SelectItem>
                  <SelectItem value="exam">Exam</SelectItem>
                  <SelectItem value="lab">Lab</SelectItem>
                  <SelectItem value="discussion">Discussion</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          
          <div className="space-y-2">
            <Label htmlFor="description" className="text-body font-medium text-foreground">Description</Label>
            <Textarea
              id="description"
              placeholder="Describe the assignment"
              value={formData.description}
              onChange={(e) => setFormData({...formData, description: e.target.value})}
              rows={3}
              className="border-divider focus:border-primary/50"
            />
          </div>
          
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="points" className="text-body font-medium text-foreground">Points Possible</Label>
              <Input
                id="points"
                type="number"
                placeholder="100"
                value={formData.points_possible}
                onChange={(e) => setFormData({...formData, points_possible: Number(e.target.value)})}
                className="border-divider focus:border-primary/50"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="category" className="text-body font-medium text-foreground">Category</Label>
              <Input
                id="category"
                placeholder="e.g. Assessments"
                value={formData.category}
                onChange={(e) => setFormData({...formData, category: e.target.value})}
                className="border-divider focus:border-primary/50"
              />
            </div>
          </div>
          
          <div className="space-y-2">
            <Label htmlFor="due_date" className="text-body font-medium text-foreground">Due Date</Label>
            <Input
              id="due_date"
              type="datetime-local"
              value={formData.due_date}
              onChange={(e) => setFormData({...formData, due_date: e.target.value})}
              className="border-divider focus:border-primary/50"
            />
          </div>
          
          <div className="flex items-center space-x-2">
            <Checkbox
              id="published"
              checked={formData.published}
              onCheckedChange={(checked) => setFormData({...formData, published: !!checked})}
            />
            <Label htmlFor="published" className="text-body font-medium text-foreground">
              Publish immediately
            </Label>
          </div>
          
          <div className="flex justify-end gap-3 pt-4">
            <Button 
              variant="outline" 
              onClick={() => onOpenChange(false)}
              className="border-divider hover:bg-surface/80"
              disabled={isSubmitting}
            >
              Cancel
            </Button>
            <Button 
              onClick={handleSubmit}
              className="bg-brand-gradient hover:opacity-90 transition-airy"
              disabled={isSubmitting}
            >
              {isSubmitting ? 'Saving...' : (isEditing ? 'Update Assignment' : 'Create Assignment')}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
} 