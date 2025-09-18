'use client';

import React, { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { Loader2, Users, BookOpen } from 'lucide-react';
import { format } from 'date-fns';
import { FamilyStudentSelector } from '@/components/teach/FamilyStudentSelector';
import { useToast } from '@/components/ui/use-toast';

// Define the type locally since the import is not available
interface ClassInstanceCreationData {
  name: string;
  start_date?: string;
  end_date?: string;
  baseClassId?: string;
  createdAt?: string;
  updatedAt?: string;
}

interface BaseClass {
  id: string;
  name: string;
  description?: string;
}

interface CreateInstanceModalWithBaseClassSelectionProps {
  isOpen: boolean;
  onClose: () => void;
  onInstanceCreated?: (instanceId: string) => void;
}

const CreateInstanceModalWithBaseClassSelection: React.FC<CreateInstanceModalWithBaseClassSelectionProps> = ({
  isOpen,
  onClose,
  onInstanceCreated
}) => {
  const { toast } = useToast();
  const [isLoading, setIsLoading] = useState(false);
  const [isLoadingBaseClasses, setIsLoadingBaseClasses] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [baseClasses, setBaseClasses] = useState<BaseClass[]>([]);
  
  // Form state
  const [formData, setFormData] = useState({
    baseClassId: '',
    name: '',
    startDate: undefined as Date | undefined,
    endDate: undefined as Date | undefined,
  });
  
  // Student selection state
  const [selectedStudents, setSelectedStudents] = useState<string[]>([]);

  // Fetch base classes when modal opens
  useEffect(() => {
    if (isOpen) {
      fetchBaseClasses();
    }
  }, [isOpen]);

  const fetchBaseClasses = async () => {
    setIsLoadingBaseClasses(true);
    try {
      const response = await fetch('/api/teach/base-classes');
      if (!response.ok) {
        throw new Error('Failed to fetch base classes');
      }
      const data = await response.json();
      setBaseClasses(data);
    } catch (err) {
      console.error('Error fetching base classes:', err);
      setError('Failed to load base classes. Please try again.');
    } finally {
      setIsLoadingBaseClasses(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.baseClassId) {
      setError('Please select a base class');
      return;
    }
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
      };

      const response = await fetch(`/api/teach/base-classes/${formData.baseClassId}/instances`, {
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
        baseClassId: '',
        name: '',
        startDate: undefined,
        endDate: undefined,
      });
      setSelectedStudents([]);

      toast({
        title: "Instance Created!",
        description: `Successfully created instance: ${formData.name}`,
      });

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
        baseClassId: '',
        name: '',
        startDate: undefined,
        endDate: undefined,
      });
      setSelectedStudents([]);
      setError(null);
      onClose();
    }
  };

  const selectedBaseClass = baseClasses.find(bc => bc.id === formData.baseClassId);

  return (
    <TooltipProvider>
      <Dialog open={isOpen} onOpenChange={handleClose}>
        <DialogContent className="sm:max-w-[600px] max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Users className="w-5 h-5 text-primary" />
            Create New Class Instance
          </DialogTitle>
          <p className="text-sm text-muted-foreground mt-2">
            Select a base class and create a new instance for your students
          </p>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-6 overflow-x-hidden">
          {/* Base Class Selection */}
          <div className="space-y-2">
            <Label htmlFor="base-class">Base Class *</Label>
            {isLoadingBaseClasses ? (
              <div className="flex items-center justify-center p-4 border rounded-md">
                <Loader2 className="w-4 h-4 animate-spin mr-2" />
                <span className="text-sm text-muted-foreground">Loading base classes...</span>
              </div>
            ) : (
              <Select
                value={formData.baseClassId}
                onValueChange={(value) => setFormData(prev => ({ ...prev, baseClassId: value }))}
                disabled={isLoading}
              >
                <SelectTrigger className="w-full">
                  <SelectValue placeholder="Select a base class" />
                </SelectTrigger>
                <SelectContent className="max-w-[500px]">
                  {baseClasses.length === 0 ? (
                    <div className="p-4 text-center text-sm text-muted-foreground">
                      No base classes found. Create a base class first.
                    </div>
                  ) : (
                    baseClasses.map((baseClass) => (
                      <SelectItem key={baseClass.id} value={baseClass.id}>
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <div className="flex items-center gap-2 w-full cursor-pointer">
                              <BookOpen className="w-4 h-4 flex-shrink-0" />
                              <div className="flex-1 min-w-0">
                                <div className="font-medium break-words leading-tight">
                                  {baseClass.name.length > 40 
                                    ? baseClass.name.substring(0, 40) + '...'
                                    : baseClass.name
                                  }
                                </div>
                              </div>
                            </div>
                          </TooltipTrigger>
                          <TooltipContent side="right" className="max-w-[300px]">
                            <div className="font-medium">{baseClass.name}</div>
                          </TooltipContent>
                        </Tooltip>
                      </SelectItem>
                    ))
                  )}
                </SelectContent>
              </Select>
            )}
            {selectedBaseClass && (
              <p className="text-sm text-muted-foreground break-words">
                Creating instance for: <span className="font-medium">{selectedBaseClass.name}</span>
              </p>
            )}
          </div>

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
                  const date = e.target.value ? new Date(e.target.value + 'T00:00:00') : undefined;
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
                  const date = e.target.value ? new Date(e.target.value + 'T00:00:00') : undefined;
                  setFormData(prev => ({ ...prev, endDate: date }));
                }}
                disabled={isLoading}
                className="w-full"
                min={formData.startDate ? format(formData.startDate, "yyyy-MM-dd") : format(new Date(), "yyyy-MM-dd")}
              />
            </div>
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
              disabled={isLoading || !formData.name.trim() || !formData.baseClassId || baseClasses.length === 0}
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
    </TooltipProvider>
  );
};

export default CreateInstanceModalWithBaseClassSelection;
