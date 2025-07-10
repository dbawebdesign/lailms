'use client';

import React, { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { MoreHorizontal, PlusCircle } from 'lucide-react';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { Assessment } from '@/types/assessment';

interface AssessmentManagerProps {
  baseClassId: string;
}

const AssessmentManager: React.FC<AssessmentManagerProps> = ({ baseClassId }) => {
  const [assessments, setAssessments] = useState<Assessment[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!baseClassId) return;

    const fetchAssessments = async () => {
      setLoading(true);
      try {
        const response = await fetch(`/api/teach/assessments?base_class_id=${baseClassId}`);
        const data = await response.json();
        setAssessments(data);
      } catch (error) {
        console.error("Failed to fetch assessments:", error);
        // Handle error state in UI
      } finally {
        setLoading(false);
      }
    };

    fetchAssessments();
  }, [baseClassId]);

  if (loading) {
    return <div>Loading assessments...</div>;
  }

  return (
    <div>
      <div className="flex justify-end mb-4">
        <a href={`/teach/assessments/create?baseClassId=${baseClassId}`}>
          <Button>
            <PlusCircle className="mr-2 h-4 w-4" /> Create New Assessment
          </Button>
        </a>
      </div>
      {assessments.length === 0 ? (
        <div className="text-center py-12">
          <h3 className="text-lg font-semibold">No assessments found.</h3>
          <p className="text-sm text-muted-foreground">Get started by creating a new assessment.</p>
        </div>
      ) : (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {assessments.map((assessment) => (
            <Card key={assessment.id}>
              <CardHeader className="flex flex-row items-center justify-between">
                <CardTitle>{assessment.title}</CardTitle>
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button variant="ghost" className="h-8 w-8 p-0">
                      <span className="sr-only">Open menu</span>
                      <MoreHorizontal className="h-4 w-4" />
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end">
                    <DropdownMenuLabel>Actions</DropdownMenuLabel>
                    <DropdownMenuItem>Edit</DropdownMenuItem>
                    <DropdownMenuItem>View Submissions</DropdownMenuItem>
                    <DropdownMenuItem>Archive</DropdownMenuItem>
                    <DropdownMenuItem className="text-red-600">Delete</DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              </CardHeader>
              <CardContent>
                <p className="text-sm text-muted-foreground">{assessment.description}</p>
              </CardContent>
              <CardFooter className="text-sm text-muted-foreground justify-between">
                <span>{assessment.question_ids?.length || 0} questions</span>
                <span className="capitalize">{assessment.status}</span>
              </CardFooter>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
};

export default AssessmentManager; 