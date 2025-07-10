'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { useToast } from '@/components/ui/use-toast';
import { ArrowRight, GraduationCap, CalendarDays, BookOpen } from 'lucide-react';
import { format } from 'date-fns';

interface Course {
  id: string;
  name: string;
  baseClass: {
    id: string;
    name: string;
    description: string | null;
    subject: string | null;
    gradeLevel: string | null;
  };
  enrollmentId: string;
  enrollmentCode: string;
  startDate: string | null;
  endDate: string | null;
  status: string;
  settings: any;
  joinedAt: string;
}

export default function CoursesPage() {
  const [courses, setCourses] = useState<Course[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const { toast } = useToast();

  useEffect(() => {
    const fetchCourses = async () => {
      try {
        const response = await fetch('/api/learn/courses');
        if (!response.ok) {
          throw new Error('Failed to fetch courses');
        }
        const data = await response.json();
        setCourses(data);
      } catch (error: any) {
        toast({
          title: 'Error',
          description: error.message || 'Failed to fetch courses',
          variant: 'destructive',
        });
      } finally {
        setIsLoading(false);
      }
    };

    fetchCourses();
  }, [toast]);

  const getStatusColor = (status: string) => {
    switch (status.toLowerCase()) {
      case 'active':
        return 'bg-success/10 text-success border-success/20';
      case 'upcoming':
        return 'bg-info/10 text-info border-info/20';
      case 'completed':
        return 'bg-muted/10 text-muted-foreground border-muted/20';
      case 'archived':
        return 'bg-warning/10 text-warning border-warning/20';
      default:
        return 'bg-muted/10 text-muted-foreground border-muted/20';
    }
  };

  if (isLoading) {
    return (
      <div className="container mx-auto py-12 px-4 sm:px-6 lg:px-8">
        <div className="flex justify-between items-center mb-8">
          <h1 className="text-3xl font-bold">My Courses</h1>
          <Skeleton className="h-10 w-32" />
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {[1, 2, 3].map((i) => (
            <Skeleton key={i} className="h-[300px]" />
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="container mx-auto py-12 px-4 sm:px-6 lg:px-8">
      <div className="flex justify-between items-center mb-8">
        <h1 className="text-3xl font-bold">My Courses</h1>
        <Button asChild>
          <Link href="/learn/enroll">
            Enroll in Course
            <ArrowRight className="ml-2 h-4 w-4" />
          </Link>
        </Button>
      </div>

      {courses.length === 0 ? (
        <Card>
          <CardContent className="py-8">
            <div className="text-center">
              <GraduationCap className="mx-auto h-12 w-12 text-muted-foreground/50" />
              <h2 className="mt-4 text-xl font-semibold">No Courses Yet</h2>
              <p className="mt-2 text-muted-foreground">
                You haven't enrolled in any courses yet. Use an enrollment code to get started.
              </p>
              <Button asChild className="mt-4">
                <Link href="/learn/enroll">
                  Enroll Now
                  <ArrowRight className="ml-2 h-4 w-4" />
                </Link>
              </Button>
            </div>
          </CardContent>
        </Card>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {courses.map((course) => (
            <Card key={course.id} className="overflow-hidden">
              <CardHeader>
                <div className="flex justify-between items-start gap-4">
                  <div>
                    <CardTitle className="line-clamp-2">{course.name}</CardTitle>
                    <CardDescription className="line-clamp-1 mt-1">
                      {course.baseClass.name}
                    </CardDescription>
                  </div>
                  <div className={`px-2 py-1 rounded-md text-xs font-medium ${getStatusColor(course.status)}`}>
                    {course.status}
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  {course.baseClass.description && (
                    <p className="text-sm text-muted-foreground line-clamp-3">
                      {course.baseClass.description}
                    </p>
                  )}
                  <div className="space-y-2">
                    {course.startDate && (
                      <div className="flex items-center text-sm text-muted-foreground">
                        <CalendarDays className="mr-2 h-4 w-4" />
                        <span>Starts {format(new Date(course.startDate), 'MMM d, yyyy')}</span>
                      </div>
                    )}
                    {course.baseClass.subject && (
                      <div className="flex items-center text-sm text-muted-foreground">
                        <BookOpen className="mr-2 h-4 w-4" />
                        <span>{course.baseClass.subject}</span>
                      </div>
                    )}
                  </div>
                  <Button asChild className="w-full">
                    <Link href={`/learn/courses/${course.id}`}>
                      Go to Course
                      <ArrowRight className="ml-2 h-4 w-4" />
                    </Link>
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
} 