'use client';

import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { 
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { 
  ArrowLeft,
  GraduationCap,
  BookOpen,
  Users,
  Calendar,
  Copy,
  Loader2,
  AlertCircle,
  Sparkles
} from 'lucide-react';

interface CatalogCourse {
  id: string;
  name: string;
  description: string | null;
  created_at: string;
  settings: any;
  _count?: {
    paths: number;
    lessons: number;
    assessments: number;
  };
}

interface CourseCatalogGradeLevelSelectorProps {
  onCourseSelected: (courseId: string, courseName: string) => void;
  onBack: () => void;
}

// Individual grade level definitions
const GRADE_LEVELS = [
  { value: 'K', label: 'Kindergarten' },
  { value: '1', label: '1st Grade' },
  { value: '2', label: '2nd Grade' },
  { value: '3', label: '3rd Grade' },
  { value: '4', label: '4th Grade' },
  { value: '5', label: '5th Grade' },
  { value: '6', label: '6th Grade' },
  { value: '7', label: '7th Grade' },
  { value: '8', label: '8th Grade' },
  { value: '9', label: '9th Grade' },
  { value: '10', label: '10th Grade' },
  { value: '11', label: '11th Grade' },
  { value: '12', label: '12th Grade' },
];

export function CourseCatalogGradeLevelSelector({ 
  onCourseSelected, 
  onBack 
}: CourseCatalogGradeLevelSelectorProps) {
  const [selectedGradeLevel, setSelectedGradeLevel] = useState<string>('');
  const [courses, setCourses] = useState<CatalogCourse[]>([]);
  const [filteredCourses, setFilteredCourses] = useState<CatalogCourse[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [duplicating, setDuplicating] = useState<string | null>(null);

  // Fetch courses when component mounts
  useEffect(() => {
    fetchCourses();
  }, []);

  // Filter courses when grade level changes
  useEffect(() => {
    if (selectedGradeLevel && courses.length > 0) {
      const filtered = courses.filter(course => {
        const courseName = course.name.toLowerCase();
        const courseDescription = course.description?.toLowerCase() || '';
        
        // Filter by specific grade level
        const gradeTerms = [
          `grade ${selectedGradeLevel.toLowerCase()}`,
          `${selectedGradeLevel.toLowerCase()}th grade`,
          `${selectedGradeLevel.toLowerCase()}st grade`,
          `${selectedGradeLevel.toLowerCase()}nd grade`,
          `${selectedGradeLevel.toLowerCase()}rd grade`,
        ];
        
        if (selectedGradeLevel === 'K') {
          return courseName.includes('kindergarten') || 
                 courseName.includes('grade k') || 
                 courseDescription.includes('kindergarten');
        }
        
        return gradeTerms.some(term => 
          courseName.includes(term) || courseDescription.includes(term)
        );
      });
      setFilteredCourses(filtered);
    } else {
      setFilteredCourses([]);
    }
  }, [selectedGradeLevel, courses]);

  const fetchCourses = async () => {
    try {
      setLoading(true);
      const response = await fetch('/api/course-catalog');
      const data = await response.json();
      
      if (data.success) {
        setCourses(data.courses);
      } else {
        setError(data.error || 'Failed to fetch course catalog');
      }
    } catch (err) {
      setError('Failed to fetch course catalog');
    } finally {
      setLoading(false);
    }
  };

  const handleDuplicateCourse = async (course: CatalogCourse) => {
    try {
      setDuplicating(course.id);
      
      const response = await fetch('/api/course-catalog/duplicate', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          sourceBaseClassId: course.id,
          newCourseName: `${course.name} (My Copy)`
        }),
      });

      const data = await response.json();
      
      if (data.success) {
        onCourseSelected(data.newBaseClassId, data.newCourseName);
      } else {
        setError(data.error || 'Failed to duplicate course');
      }
    } catch (err) {
      setError('Failed to duplicate course');
    } finally {
      setDuplicating(null);
    }
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric'
    });
  };

  return (
    <div className="space-y-6">
      {/* Back Button */}
      <Button variant="outline" onClick={onBack} className="mb-4">
        <ArrowLeft className="w-4 h-4 mr-2" />
        Back to Options
      </Button>

      {/* Grade Level Selection */}
      <div className="space-y-4">
        <div>
          <h3 className="text-lg font-semibold mb-2">Step 1: Select Grade Level</h3>
          <p className="text-sm text-muted-foreground mb-4">
            Choose the grade level for your course to see available options.
          </p>
        </div>

        <Select value={selectedGradeLevel} onValueChange={setSelectedGradeLevel}>
          <SelectTrigger className="w-full">
            <SelectValue placeholder="Select a grade level..." />
          </SelectTrigger>
          <SelectContent>
            {GRADE_LEVELS.map((level) => (
              <SelectItem key={level.value} value={level.value}>
                {level.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* Course Selection */}
      {selectedGradeLevel && (
        <div className="space-y-4">
          <div>
            <h3 className="text-lg font-semibold mb-2">Step 2: Choose Your Course</h3>
            <p className="text-sm text-muted-foreground mb-4">
              Select from available courses for {GRADE_LEVELS.find(g => g.value === selectedGradeLevel)?.label}.
            </p>
          </div>

          {/* Loading State */}
          {loading && (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="h-6 w-6 animate-spin mr-2" />
              Loading courses...
            </div>
          )}

          {/* Error State */}
          {error && (
            <Alert variant="destructive">
              <AlertCircle className="h-4 w-4" />
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          )}

          {/* Course Selection Dropdown */}
          {!loading && !error && (
            <>
              {filteredCourses.length === 0 && courses.length > 0 ? (
                <Alert>
                  <BookOpen className="h-4 w-4" />
                  <AlertDescription>
                    No courses available for {GRADE_LEVELS.find(g => g.value === selectedGradeLevel)?.label} yet. 
                    Try selecting a different grade level or check back later.
                  </AlertDescription>
                </Alert>
              ) : filteredCourses.length > 0 ? (
                <div className="space-y-4">
                  <Select onValueChange={(courseId) => {
                    const course = filteredCourses.find(c => c.id === courseId);
                    if (course) {
                      handleDuplicateCourse(course);
                    }
                  }}>
                    <SelectTrigger className="w-full">
                      <SelectValue placeholder="Choose a course..." />
                    </SelectTrigger>
                    <SelectContent>
                      {filteredCourses.map((course) => (
                        <SelectItem key={course.id} value={course.id}>
                          <div className="flex flex-col items-start">
                            <span className="font-medium">{course.name}</span>
                            {course.description && (
                              <span className="text-xs text-muted-foreground line-clamp-1">
                                {course.description}
                              </span>
                            )}
                          </div>
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  
                  {duplicating && (
                    <div className="flex items-center justify-center py-4">
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      Adding course to your account...
                    </div>
                  )}
                </div>
              ) : null}
            </>
          )}
        </div>
      )}
    </div>
  );
}
