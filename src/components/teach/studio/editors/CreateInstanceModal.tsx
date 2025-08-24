'use client';

import React, { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Loader2, Users, Clock } from 'lucide-react';
import { format } from 'date-fns';
import { FamilyStudentSelector } from '@/components/teach/FamilyStudentSelector';
// Define the type locally since the import is not available
interface ClassInstanceCreationData {
  name: string;
  start_date?: string;
  end_date?: string;
  period?: string;
  capacity?: number;
  baseClassId?: string;
  createdAt?: string;
  updatedAt?: string;
}

interface CreateInstanceModalProps {
  isOpen: boolean;
  onClose: () => void;
  baseClassId: string;
  baseClassName: string;
  onInstanceCreated?: (instanceId: string) => void;
}

const CreateInstanceModal: React.FC<CreateInstanceModalProps> = ({
  isOpen,
  onClose,
  baseClassId,
  baseClassName,
  onInstanceCreated
}) => {
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  
  // Form state
  const [formData, setFormData] = useState({
    name: '',
    startDate: undefined as Date | undefined,
    endDate: undefined as Date | undefined,
    period: '',
    capacity: undefined as number | undefined,
  });
  
  // Student selection state
  const [selectedStudents, setSelectedStudents] = useState<string[]>([]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.name.trim()) {
      setError('Instance name is required');
      return;
    }

    setIsLoading(true);
    setError(null);

    try {
      const requestData: Omit<ClassInstanceCreationData, 'baseClassId' | 'createdAt' | 'updatedAt'> = {
        name: formData.name.trim(),
        start_date: formData.startDate?.toISOString(),
        end_date: formData.endDate?.toISOString(),
        period: formData.period || undefined,
        capacity: formData.capacity || undefined,
      };

      const response = await fetch(`/api/teach/base-classes/${baseClassId}/instances`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(requestData),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to create instance');
      }

      const newInstance = await response.json();
      
      // If students were selected, enroll them in the class
      if (selectedStudents.length > 0) {
        try {
          await Promise.all(
            selectedStudents.map(studentId =>
              fetch(`/api/teach/instances/${newInstance.id}/enrollments`, {
                method: 'POST',
                headers: {
                  'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                  profile_id: studentId,
                  role: 'student'
                }),
              })
            )
          );
        } catch (enrollmentError) {
          console.error('Error enrolling students:', enrollmentError);
          // Don't fail the whole operation, just log the error
        }
      }
      
      // Reset form
      setFormData({
        name: '',
        startDate: undefined,
        endDate: undefined,
        period: '',
        capacity: undefined,
      });
      setSelectedStudents([]);

      onInstanceCreated?.(newInstance.id);
      onClose();
    } catch (err) {
      console.error('Error creating instance:', err);
      setError(err instanceof Error ? err.message : 'Failed to create instance');
    } finally {
      setIsLoading(false);
    }
  };

  const handleClose = () => {
    if (!isLoading) {
      setFormData({
        name: '',
        startDate: undefined,
        endDate: undefined,
        period: '',
        capacity: undefined,
      });
      setSelectedStudents([]);
      setError(null);
      onClose();
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-[500px] max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Users className="w-5 h-5 text-primary" />
            Create New Class Instance
          </DialogTitle>
          <p className="text-sm text-muted-foreground mt-2">
            Create a new instance of <span className="font-medium">{baseClassName}</span>
          </p>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-6">
          {/* Instance Name */}
          <div className="space-y-2">
            <Label htmlFor="instance-name">Instance Name *</Label>
            <Input
              id="instance-name"
              placeholder="e.g., Spring 2024 - Section A, Period 3 Math"
              value={formData.name}
              onChange={(e) => setFormData(prev => ({ ...prev, name: e.target.value }))}
              disabled={isLoading}
              className="w-full"
            />
          </div>

          {/* Date Range */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="start-date">Start Date</Label>
              <Input
                id="start-date"
                type="date"
                value={formData.startDate ? format(formData.startDate, "yyyy-MM-dd") : ""}
                onChange={(e) => {
                  const date = e.target.value ? new Date(e.target.value) : undefined;
                  setFormData(prev => ({ ...prev, startDate: date }));
                }}
                disabled={isLoading}
                className="w-full"
                min={format(new Date(), "yyyy-MM-dd")}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="end-date">End Date</Label>
              <Input
                id="end-date"
                type="date"
                value={formData.endDate ? format(formData.endDate, "yyyy-MM-dd") : ""}
                onChange={(e) => {
                  const date = e.target.value ? new Date(e.target.value) : undefined;
                  setFormData(prev => ({ ...prev, endDate: date }));
                }}
                disabled={isLoading}
                className="w-full"
                min={formData.startDate ? format(formData.startDate, "yyyy-MM-dd") : format(new Date(), "yyyy-MM-dd")}
              />
            </div>
          </div>

          {/* Period/Schedule */}
          <div className="space-y-2">
            <Label htmlFor="period">Period/Schedule</Label>
            <Input
              id="period"
              placeholder="e.g., Period 3, Mon/Wed/Fri 10:00 AM, Block A"
              value={formData.period}
              onChange={(e) => setFormData(prev => ({ ...prev, period: e.target.value }))}
              disabled={isLoading}
              className="w-full"
            />
          </div>

          {/* Capacity */}
          <div className="space-y-2">
            <Label htmlFor="capacity">Class Capacity</Label>
            <Input
              id="capacity"
              type="number"
              placeholder="e.g., 25"
              value={formData.capacity || ''}
              onChange={(e) => setFormData(prev => ({ 
                ...prev, 
                capacity: e.target.value ? parseInt(e.target.value) : undefined 
              }))}
              disabled={isLoading}
              className="w-full"
              min="1"
              max="200"
            />
          </div>

          {/* Student Selection */}
          <div className="space-y-2">
            <Label>Add Family Students</Label>
            <p className="text-sm text-muted-foreground mb-2">
              Select students from your family to automatically enroll them in this class.
            </p>
            <FamilyStudentSelector
              selectedStudents={selectedStudents}
              onStudentsChange={setSelectedStudents}
              disabled={isLoading}
              placeholder="Select students to enroll..."
            />
          </div>

          {error && (
            <div className="p-3 rounded-md bg-destructive/10 border border-destructive/20">
              <p className="text-sm text-destructive">{error}</p>
            </div>
          )}

          <DialogFooter className="gap-2">
            <Button
              type="button"
              variant="outline"
              onClick={handleClose}
              disabled={isLoading}
            >
              Cancel
            </Button>
            <Button
              type="submit"
              disabled={isLoading || !formData.name.trim()}
              className="bg-brand-gradient hover:opacity-90 transition-airy"
            >
              {isLoading ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Creating...
                </>
              ) : (
                <>
                  <Users className="w-4 h-4 mr-2" />
                  Create Instance
                </>
              )}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
};

export default CreateInstanceModal; 