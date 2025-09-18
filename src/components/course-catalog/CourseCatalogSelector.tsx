'use client';

import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
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
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { 
  BookOpen, 
  Search, 
  Filter,
  GraduationCap,
  Users,
  Calendar,
  Copy,
  Loader2,
  AlertCircle,
  CheckCircle,
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

interface CourseCatalogSelectorProps {
  onCourseSelected?: (courseId: string, courseName: string) => void;
}

// Predefined course categories and grade levels
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

const SUBJECTS = [
  { value: 'math', label: 'Math' },
  { value: 'reading', label: 'Reading' },
  { value: 'language_arts', label: 'Language Arts' },
  { value: 'science', label: 'Science' },
  { value: 'history', label: 'History' },
  { value: 'earth_sciences', label: 'Earth Sciences' },
  { value: 'algebra_1', label: 'Algebra 1' },
  { value: 'geometry', label: 'Geometry' },
  { value: 'world_history', label: 'World History' },
  { value: 'us_history', label: 'U.S. History' },
  { value: 'biology', label: 'Biology' },
  { value: 'chemistry', label: 'Chemistry' },
  { value: 'physics', label: 'Physics' },
  { value: 'english', label: 'English' },
  { value: 'literature', label: 'Literature' },
];

export function CourseCatalogSelector({ onCourseSelected }: CourseCatalogSelectorProps) {
  const [courses, setCourses] = useState<CatalogCourse[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedGrade, setSelectedGrade] = useState<string>('');
  const [selectedSubject, setSelectedSubject] = useState<string>('');
  const [duplicating, setDuplicating] = useState<string | null>(null);
  const [selectedCourse, setSelectedCourse] = useState<CatalogCourse | null>(null);
  const [showPreview, setShowPreview] = useState(false);

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

  useEffect(() => {
    fetchCourses();
  }, []);

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
        // Call the callback if provided
        if (onCourseSelected) {
          onCourseSelected(data.newBaseClassId, data.newCourseName);
        }
        
        // Show success message or redirect
        setShowPreview(false);
      } else {
        setError(data.error || 'Failed to duplicate course');
      }
    } catch (err) {
      setError('Failed to duplicate course');
    } finally {
      setDuplicating(null);
    }
  };

  const filteredCourses = courses.filter(course => {
    const matchesSearch = !searchTerm || 
      course.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      (course.description && course.description.toLowerCase().includes(searchTerm.toLowerCase()));
    
    const matchesGrade = !selectedGrade || 
      course.name.toLowerCase().includes(selectedGrade.toLowerCase()) ||
      (course.description && course.description.toLowerCase().includes(selectedGrade.toLowerCase()));
    
    const matchesSubject = !selectedSubject || 
      course.name.toLowerCase().includes(selectedSubject.toLowerCase()) ||
      (course.description && course.description.toLowerCase().includes(selectedSubject.toLowerCase()));
    
    return matchesSearch && matchesGrade && matchesSubject;
  });

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric'
    });
  };

  if (loading) {
    return (
      <Card>
        <CardContent className="py-8">
          <div className="flex items-center justify-center">
            <Loader2 className="h-6 w-6 animate-spin mr-2" />
            Loading course catalog...
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <BookOpen className="h-5 w-5" />
            Course Catalog
          </CardTitle>
          <CardDescription>
            Choose from our pre-built courses and customize them for your needs.
            Each course includes lessons, assessments, and teaching materials.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* Filters */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground h-4 w-4" />
              <Input
                placeholder="Search courses..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-10"
              />
            </div>
            
            <Select value={selectedGrade} onValueChange={setSelectedGrade}>
              <SelectTrigger>
                <SelectValue placeholder="Select grade level" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="">All grades</SelectItem>
                {GRADE_LEVELS.map(grade => (
                  <SelectItem key={grade.value} value={grade.value}>
                    {grade.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            
            <Select value={selectedSubject} onValueChange={setSelectedSubject}>
              <SelectTrigger>
                <SelectValue placeholder="Select subject" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="">All subjects</SelectItem>
                {SUBJECTS.map(subject => (
                  <SelectItem key={subject.value} value={subject.value}>
                    {subject.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Results count */}
          <div className="flex items-center justify-between">
            <Badge variant="secondary">
              {filteredCourses.length} course{filteredCourses.length !== 1 ? 's' : ''} found
            </Badge>
            {(selectedGrade || selectedSubject || searchTerm) && (
              <Button
                variant="ghost"
                size="sm"
                onClick={() => {
                  setSelectedGrade('');
                  setSelectedSubject('');
                  setSearchTerm('');
                }}
              >
                Clear filters
              </Button>
            )}
          </div>

          {/* Error Display */}
          {error && (
            <Alert variant="destructive">
              <AlertCircle className="h-4 w-4" />
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          )}

          {/* Course Grid */}
          {filteredCourses.length === 0 ? (
            <Card>
              <CardContent className="py-8">
                <div className="text-center">
                  <BookOpen className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
                  <h3 className="text-lg font-medium mb-2">No courses found</h3>
                  <p className="text-muted-foreground">
                    {searchTerm || selectedGrade || selectedSubject 
                      ? 'Try adjusting your filters to see more courses.' 
                      : 'No courses are available in the catalog yet.'}
                  </p>
                </div>
              </CardContent>
            </Card>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {filteredCourses.map((course) => (
                <Card key={course.id} className="hover:shadow-md transition-shadow">
                  <CardHeader>
                    <CardTitle className="text-lg">{course.name}</CardTitle>
                    <CardDescription className="line-clamp-2">
                      {course.description || 'No description available'}
                    </CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    {/* Course Stats */}
                    {course._count && (
                      <div className="flex flex-wrap gap-2">
                        <Badge variant="outline" className="text-xs">
                          <BookOpen className="h-3 w-3 mr-1" />
                          {course._count.paths} modules
                        </Badge>
                        <Badge variant="outline" className="text-xs">
                          <Users className="h-3 w-3 mr-1" />
                          {course._count.lessons} lessons
                        </Badge>
                        {course._count.assessments > 0 && (
                          <Badge variant="outline" className="text-xs">
                            <GraduationCap className="h-3 w-3 mr-1" />
                            {course._count.assessments} assessments
                          </Badge>
                        )}
                      </div>
                    )}

                    <div className="text-xs text-muted-foreground">
                      Created {formatDate(course.created_at)}
                    </div>

                    {/* Action Buttons */}
                    <div className="flex gap-2">
                      <Dialog open={showPreview && selectedCourse?.id === course.id} onOpenChange={(open) => {
                        setShowPreview(open);
                        if (!open) setSelectedCourse(null);
                      }}>
                        <DialogTrigger asChild>
                          <Button 
                            variant="outline" 
                            size="sm" 
                            className="flex-1"
                            onClick={() => setSelectedCourse(course)}
                          >
                            Preview
                          </Button>
                        </DialogTrigger>
                        <DialogContent className="max-w-2xl">
                          <DialogHeader>
                            <DialogTitle>{course.name}</DialogTitle>
                            <DialogDescription>
                              {course.description || 'No description available'}
                            </DialogDescription>
                          </DialogHeader>
                          <div className="space-y-4">
                            {course._count && (
                              <div className="grid grid-cols-3 gap-4">
                                <div className="text-center">
                                  <div className="text-2xl font-bold">{course._count.paths}</div>
                                  <div className="text-sm text-muted-foreground">Modules</div>
                                </div>
                                <div className="text-center">
                                  <div className="text-2xl font-bold">{course._count.lessons}</div>
                                  <div className="text-sm text-muted-foreground">Lessons</div>
                                </div>
                                <div className="text-center">
                                  <div className="text-2xl font-bold">{course._count.assessments}</div>
                                  <div className="text-sm text-muted-foreground">Assessments</div>
                                </div>
                              </div>
                            )}
                            
                            <div className="flex justify-end gap-2">
                              <Button
                                variant="outline"
                                onClick={() => setShowPreview(false)}
                              >
                                Cancel
                              </Button>
                              <Button
                                onClick={() => handleDuplicateCourse(course)}
                                disabled={duplicating === course.id}
                              >
                                {duplicating === course.id ? (
                                  <>
                                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                                    Duplicating...
                                  </>
                                ) : (
                                  <>
                                    <Copy className="mr-2 h-4 w-4" />
                                    Use This Course
                                  </>
                                )}
                              </Button>
                            </div>
                          </div>
                        </DialogContent>
                      </Dialog>
                      
                      <Button 
                        size="sm" 
                        className="flex-1"
                        onClick={() => handleDuplicateCourse(course)}
                        disabled={duplicating === course.id}
                      >
                        {duplicating === course.id ? (
                          <>
                            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                            Duplicating...
                          </>
                        ) : (
                          <>
                            <Sparkles className="mr-2 h-4 w-4" />
                            Use Course
                          </>
                        )}
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
