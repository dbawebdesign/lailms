'use client';

import { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Loader2, Save, Edit2, X, User, GraduationCap } from 'lucide-react';
import { toast } from 'sonner';

interface Student {
  userId: string;
  firstName: string;
  lastName: string | null;
  gradeLevel: string | null;
  isSubAccount: boolean;
  createdAt: string;
}

interface StudentManagementSectionProps {
  familyId: string | null;
}

export default function StudentManagementSection({ familyId }: StudentManagementSectionProps) {
  const [students, setStudents] = useState<Student[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [editingStudent, setEditingStudent] = useState<string | null>(null);
  const [editForm, setEditForm] = useState({
    firstName: '',
    lastName: '',
    gradeLevel: '',
  });
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    loadStudents();
  }, []);

  const loadStudents = async () => {
    setIsLoading(true);
    try {
      const response = await fetch('/api/settings/students/list');
      const data = await response.json();

      if (!response.ok) {
        toast.error(data.error || 'Failed to load students');
        return;
      }

      setStudents(data.students);
    } catch (error) {
      console.error('Error loading students:', error);
      toast.error('Failed to load students');
    } finally {
      setIsLoading(false);
    }
  };

  const handleEditClick = (student: Student) => {
    setEditingStudent(student.userId);
    setEditForm({
      firstName: student.firstName,
      lastName: student.lastName || '',
      gradeLevel: student.gradeLevel || '',
    });
  };

  const handleCancelEdit = () => {
    setEditingStudent(null);
    setEditForm({ firstName: '', lastName: '', gradeLevel: '' });
  };

  const handleSaveStudent = async (studentId: string) => {
    if (!editForm.firstName.trim()) {
      toast.error('First name is required');
      return;
    }

    setIsSaving(true);
    try {
      const response = await fetch('/api/settings/students/update', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          studentId,
          firstName: editForm.firstName.trim(),
          lastName: editForm.lastName.trim() || null,
          gradeLevel: editForm.gradeLevel.trim() || null,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        toast.error(data.error || 'Failed to update student');
        return;
      }

      // Update local state
      setStudents(students.map(s => 
        s.userId === studentId 
          ? {
              ...s,
              firstName: data.student.firstName,
              lastName: data.student.lastName,
              gradeLevel: data.student.gradeLevel,
            }
          : s
      ));

      setEditingStudent(null);
      toast.success('Student updated successfully');
    } catch (error) {
      console.error('Error updating student:', error);
      toast.error('Failed to update student');
    } finally {
      setIsSaving(false);
    }
  };

  if (isLoading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Student Management</CardTitle>
          <CardDescription>Loading students...</CardDescription>
        </CardHeader>
        <CardContent className="flex items-center justify-center py-8">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Student Management</CardTitle>
        <CardDescription>
          Manage your students&apos; names and grade levels
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {students.length === 0 ? (
          <div className="rounded-lg border border-dashed p-6 text-center">
            <User className="mx-auto h-10 w-10 text-muted-foreground/50" />
            <p className="mt-2 text-sm text-muted-foreground">
              No students found. Add students from the homeschool setup page.
            </p>
          </div>
        ) : (
          <div className="space-y-3">
            {students.map((student) => (
              <div
                key={student.userId}
                className="rounded-lg border p-4 transition-colors hover:bg-muted/30"
              >
                {editingStudent === student.userId ? (
                  // Edit Mode
                  <div className="space-y-4">
                    <div className="grid gap-4 sm:grid-cols-3">
                      <div className="space-y-2">
                        <Label htmlFor={`firstName-${student.userId}`}>First Name</Label>
                        <Input
                          id={`firstName-${student.userId}`}
                          value={editForm.firstName}
                          onChange={(e) => setEditForm({ ...editForm, firstName: e.target.value })}
                          placeholder="First name"
                        />
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor={`lastName-${student.userId}`}>Last Name</Label>
                        <Input
                          id={`lastName-${student.userId}`}
                          value={editForm.lastName}
                          onChange={(e) => setEditForm({ ...editForm, lastName: e.target.value })}
                          placeholder="Last name (optional)"
                        />
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor={`gradeLevel-${student.userId}`}>Grade Level</Label>
                        <Input
                          id={`gradeLevel-${student.userId}`}
                          value={editForm.gradeLevel}
                          onChange={(e) => setEditForm({ ...editForm, gradeLevel: e.target.value })}
                          placeholder="e.g., 5th, 10th"
                        />
                      </div>
                    </div>
                    <div className="flex gap-2">
                      <Button
                        size="sm"
                        onClick={() => handleSaveStudent(student.userId)}
                        disabled={isSaving}
                      >
                        {isSaving ? (
                          <>
                            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                            Saving...
                          </>
                        ) : (
                          <>
                            <Save className="mr-2 h-4 w-4" />
                            Save
                          </>
                        )}
                      </Button>
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={handleCancelEdit}
                        disabled={isSaving}
                      >
                        <X className="mr-2 h-4 w-4" />
                        Cancel
                      </Button>
                    </div>
                  </div>
                ) : (
                  // View Mode
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div className="flex h-10 w-10 items-center justify-center rounded-full bg-primary/10">
                        <GraduationCap className="h-5 w-5 text-primary" />
                      </div>
                      <div>
                        <p className="font-medium">
                          {student.firstName} {student.lastName}
                        </p>
                        <div className="flex items-center gap-2 mt-0.5">
                          {student.gradeLevel && (
                            <Badge variant="secondary" className="text-xs">
                              Grade {student.gradeLevel}
                            </Badge>
                          )}
                          {student.isSubAccount && (
                            <span className="text-xs text-muted-foreground">
                              Sub-account
                            </span>
                          )}
                        </div>
                      </div>
                    </div>
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => handleEditClick(student)}
                    >
                      <Edit2 className="h-4 w-4" />
                    </Button>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
