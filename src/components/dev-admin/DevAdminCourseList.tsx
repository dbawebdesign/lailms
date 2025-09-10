'use client';

import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { 
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { 
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { 
  BookOpen, 
  Search, 
  MoreHorizontal,
  Eye,
  Edit,
  Trash2,
  Users,
  Calendar,
  AlertCircle,
  Loader2
} from 'lucide-react';

interface CatalogCourse {
  id: string;
  name: string;
  description: string | null;
  created_at: string;
  updated_at: string;
  user_id: string | null;
  organisation_id: string;
  settings: any;
  assessment_config: any;
  course_catalog: boolean;
  _count?: {
    paths: number;
    lessons: number;
    assessments: number;
  };
}

export function DevAdminCourseList() {
  const [courses, setCourses] = useState<CatalogCourse[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [deleting, setDeleting] = useState<string | null>(null);

  const fetchCourses = async () => {
    try {
      setLoading(true);
      const response = await fetch('/api/dev-admin/course-catalog', {
        headers: {
          'x-dev-admin-password': 'TerroirLAI'
        }
      });

      const data = await response.json();
      
      if (data.success) {
        setCourses(data.courses);
      } else {
        setError(data.error || 'Failed to fetch courses');
      }
    } catch (err) {
      setError('Failed to fetch courses');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchCourses();
  }, []);

  const handleDelete = async (courseId: string) => {
    if (!confirm('Are you sure you want to delete this course? This action cannot be undone.')) {
      return;
    }

    try {
      setDeleting(courseId);
      const response = await fetch(`/api/dev-admin/course-catalog/${courseId}`, {
        method: 'DELETE',
        headers: {
          'x-dev-admin-password': 'TerroirLAI'
        }
      });

      const data = await response.json();
      
      if (data.success) {
        setCourses(courses.filter(course => course.id !== courseId));
      } else {
        setError(data.error || 'Failed to delete course');
      }
    } catch (err) {
      setError('Failed to delete course');
    } finally {
      setDeleting(null);
    }
  };

  const filteredCourses = courses.filter(course =>
    course.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    (course.description && course.description.toLowerCase().includes(searchTerm.toLowerCase()))
  );

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric'
    });
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-8">
        <Loader2 className="h-6 w-6 animate-spin mr-2" />
        Loading courses...
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Search */}
      <div className="flex items-center gap-4">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground h-4 w-4" />
          <Input
            placeholder="Search courses..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="pl-10"
          />
        </div>
        <Badge variant="secondary">
          {filteredCourses.length} course{filteredCourses.length !== 1 ? 's' : ''}
        </Badge>
      </div>

      {/* Error Display */}
      {error && (
        <Alert variant="destructive">
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      {/* Courses Table */}
      {filteredCourses.length === 0 ? (
        <Card>
          <CardContent className="py-8">
            <div className="text-center">
              <BookOpen className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
              <h3 className="text-lg font-medium mb-2">No courses found</h3>
              <p className="text-muted-foreground">
                {searchTerm ? 'No courses match your search criteria.' : 'No courses have been created yet.'}
              </p>
            </div>
          </CardContent>
        </Card>
      ) : (
        <Card>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Course Name</TableHead>
                <TableHead>Description</TableHead>
                <TableHead>Content</TableHead>
                <TableHead>Created</TableHead>
                <TableHead>Updated</TableHead>
                <TableHead className="w-[70px]">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredCourses.map((course) => (
                <TableRow key={course.id}>
                  <TableCell>
                    <div className="flex flex-col">
                      <span className="font-medium">{course.name}</span>
                      <Badge variant="outline" className="w-fit mt-1">
                        Course Catalog
                      </Badge>
                    </div>
                  </TableCell>
                  <TableCell>
                    <div className="max-w-xs">
                      <p className="text-sm text-muted-foreground truncate">
                        {course.description || 'No description'}
                      </p>
                    </div>
                  </TableCell>
                  <TableCell>
                    <div className="flex flex-col gap-1">
                      {course._count && (
                        <>
                          <div className="flex items-center gap-1 text-sm text-muted-foreground">
                            <BookOpen className="h-3 w-3" />
                            {course._count.paths} paths
                          </div>
                          <div className="flex items-center gap-1 text-sm text-muted-foreground">
                            <Users className="h-3 w-3" />
                            {course._count.lessons} lessons
                          </div>
                          {course._count.assessments > 0 && (
                            <div className="flex items-center gap-1 text-sm text-muted-foreground">
                              <Calendar className="h-3 w-3" />
                              {course._count.assessments} assessments
                            </div>
                          )}
                        </>
                      )}
                    </div>
                  </TableCell>
                  <TableCell>
                    <span className="text-sm text-muted-foreground">
                      {formatDate(course.created_at)}
                    </span>
                  </TableCell>
                  <TableCell>
                    <span className="text-sm text-muted-foreground">
                      {formatDate(course.updated_at)}
                    </span>
                  </TableCell>
                  <TableCell>
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button 
                          variant="ghost" 
                          className="h-8 w-8 p-0"
                          disabled={deleting === course.id}
                        >
                          {deleting === course.id ? (
                            <Loader2 className="h-4 w-4 animate-spin" />
                          ) : (
                            <MoreHorizontal className="h-4 w-4" />
                          )}
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        <DropdownMenuItem
                          onClick={() => window.open(`/teach/base-classes/${course.id}`, '_blank')}
                        >
                          <Eye className="mr-2 h-4 w-4" />
                          View Course
                        </DropdownMenuItem>
                        <DropdownMenuItem
                          onClick={() => window.open(`/teach/base-classes/${course.id}/edit`, '_blank')}
                        >
                          <Edit className="mr-2 h-4 w-4" />
                          Edit Course
                        </DropdownMenuItem>
                        <DropdownMenuItem
                          onClick={() => handleDelete(course.id)}
                          className="text-destructive"
                        >
                          <Trash2 className="mr-2 h-4 w-4" />
                          Delete Course
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </Card>
      )}
    </div>
  );
}
