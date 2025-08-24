"use client";

import React, { useState, useEffect } from 'react';
import { Plus, UserMinus, Users, AlertCircle, CheckCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { useToast } from '@/components/ui/use-toast';
import { FamilyStudentSelector } from './FamilyStudentSelector';
import { createClient } from '@/lib/supabase/client';

interface EnrolledStudent {
  id: string;
  profile_id: string;
  first_name: string;
  last_name: string;
  grade_level?: string;
  joined_at: string;
}

interface ClassInstanceStudentManagerProps {
  classInstanceId: string;
  className?: string;
}

export function ClassInstanceStudentManager({ 
  classInstanceId, 
  className 
}: ClassInstanceStudentManagerProps) {
  const [enrolledStudents, setEnrolledStudents] = useState<EnrolledStudent[]>([]);
  const [selectedStudents, setSelectedStudents] = useState<string[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isEnrolling, setIsEnrolling] = useState(false);
  const [isRemoving, setIsRemoving] = useState<string | null>(null);
  const { toast } = useToast();
  const supabase = createClient();

  useEffect(() => {
    loadEnrolledStudents();
  }, [classInstanceId]);

  const loadEnrolledStudents = async () => {
    try {
      setIsLoading(true);
      
      const { data, error } = await supabase
        .from('rosters')
        .select(`
          id,
          profile_id,
          joined_at,
          profiles (
            first_name,
            last_name,
            grade_level
          )
        `)
        .eq('class_instance_id', classInstanceId)
        .eq('role', 'student')
        .order('joined_at', { ascending: false });

      if (error) throw error;

      const students = data?.map(roster => ({
        id: roster.id,
        profile_id: roster.profile_id,
        first_name: roster.profiles?.first_name || '',
        last_name: roster.profiles?.last_name || '',
        grade_level: roster.profiles?.grade_level,
        joined_at: roster.joined_at
      })) || [];

      setEnrolledStudents(students);
    } catch (error) {
      console.error('Error loading enrolled students:', error);
      toast({
        title: "Error",
        description: "Failed to load enrolled students",
        variant: "destructive"
      });
    } finally {
      setIsLoading(false);
    }
  };

  const handleEnrollStudents = async () => {
    if (selectedStudents.length === 0) return;

    setIsEnrolling(true);
    try {
      const enrollmentPromises = selectedStudents.map(studentId =>
        fetch(`/api/teach/instances/${classInstanceId}/enrollments`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            profile_id: studentId,
            role: 'student'
          }),
        })
      );

      const results = await Promise.all(enrollmentPromises);
      const failedEnrollments = results.filter(r => !r.ok);

      if (failedEnrollments.length > 0) {
        throw new Error(`Failed to enroll ${failedEnrollments.length} student(s)`);
      }

      toast({
        title: "Students Enrolled",
        description: `Successfully enrolled ${selectedStudents.length} student(s) in the class`,
      });

      setSelectedStudents([]);
      await loadEnrolledStudents();
    } catch (error) {
      console.error('Error enrolling students:', error);
      toast({
        title: "Enrollment Failed",
        description: error instanceof Error ? error.message : "Failed to enroll students",
        variant: "destructive"
      });
    } finally {
      setIsEnrolling(false);
    }
  };

  const handleRemoveStudent = async (rosterId: string, studentName: string) => {
    setIsRemoving(rosterId);
    try {
      const response = await fetch(`/api/teach/instances/${classInstanceId}/enrollments/${rosterId}`, {
        method: 'DELETE',
      });

      if (!response.ok) {
        throw new Error('Failed to remove student');
      }

      toast({
        title: "Student Removed",
        description: `${studentName} has been removed from the class`,
      });

      await loadEnrolledStudents();
    } catch (error) {
      console.error('Error removing student:', error);
      toast({
        title: "Removal Failed",
        description: error instanceof Error ? error.message : "Failed to remove student",
        variant: "destructive"
      });
    } finally {
      setIsRemoving(null);
    }
  };

  // Filter out already enrolled students from the selector
  const enrolledStudentIds = enrolledStudents.map(s => s.profile_id);

  if (isLoading) {
    return (
      <Card className={className}>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Users className="h-5 w-5" />
            Student Management
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            <div className="h-20 bg-muted animate-pulse rounded-md" />
            <div className="h-32 bg-muted animate-pulse rounded-md" />
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className={className}>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Users className="h-5 w-5" />
          Student Management
        </CardTitle>
        <CardDescription>
          Add or remove students from this class instance
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Add Students Section */}
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h4 className="text-sm font-medium">Add Family Students</h4>
            {selectedStudents.length > 0 && (
              <Button
                onClick={handleEnrollStudents}
                disabled={isEnrolling}
                size="sm"
                className="bg-brand-gradient hover:opacity-90"
              >
                <Plus className="h-4 w-4 mr-2" />
                {isEnrolling ? 'Enrolling...' : `Enroll ${selectedStudents.length} Student${selectedStudents.length > 1 ? 's' : ''}`}
              </Button>
            )}
          </div>
          
          <FamilyStudentSelector
            selectedStudents={selectedStudents}
            onStudentsChange={setSelectedStudents}
            disabled={isEnrolling}
            placeholder="Select students to add to this class..."
            // Custom filter to exclude already enrolled students
            excludeStudents={enrolledStudentIds}
          />
        </div>

        {/* Enrolled Students Section */}
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h4 className="text-sm font-medium">Enrolled Students</h4>
            <Badge variant="secondary">
              {enrolledStudents.length} student{enrolledStudents.length !== 1 ? 's' : ''}
            </Badge>
          </div>

          {enrolledStudents.length === 0 ? (
            <Alert>
              <AlertCircle className="h-4 w-4" />
              <AlertDescription>
                No students are currently enrolled in this class. Use the selector above to add family students.
              </AlertDescription>
            </Alert>
          ) : (
            <div className="space-y-2">
              {enrolledStudents.map((student) => (
                <div
                  key={student.id}
                  className="flex items-center justify-between p-3 border rounded-lg bg-muted/30"
                >
                  <div className="flex items-center space-x-3">
                    <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center">
                      <span className="text-sm font-medium text-primary">
                        {student.first_name.charAt(0)}{student.last_name.charAt(0)}
                      </span>
                    </div>
                    <div>
                      <div className="font-medium">
                        {student.first_name} {student.last_name}
                      </div>
                      <div className="text-sm text-muted-foreground">
                        {student.grade_level && `Grade ${student.grade_level} • `}
                        Joined {new Date(student.joined_at).toLocaleDateString()}
                      </div>
                    </div>
                  </div>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => handleRemoveStudent(student.id, `${student.first_name} ${student.last_name}`)}
                    disabled={isRemoving === student.id}
                    className="text-destructive hover:text-destructive hover:bg-destructive/10"
                  >
                    {isRemoving === student.id ? (
                      'Removing...'
                    ) : (
                      <>
                        <UserMinus className="h-4 w-4 mr-2" />
                        Remove
                      </>
                    )}
                  </Button>
                </div>
              ))}
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
