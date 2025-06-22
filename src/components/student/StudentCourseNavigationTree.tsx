'use client';

import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { 
  BookOpen, 
  FileText, 
  GraduationCap,
  ChevronDown,
  ChevronRight,
  CheckCircle2,
  Circle,
  Clock,
  PlayCircle,
  Award,
  Target,
  AlertCircle
} from 'lucide-react';

interface StudentCourseNavigationTreeProps {
  baseClassId: string;
  onSelectItem: (type: 'lesson' | 'assessment', itemId: string) => void;
  selectedItemId?: string;
  selectedItemType?: string;
}

interface LessonWithProgress {
  id: string;
  title: string;
  description: string;
  order: number;
  estimatedDurationHours: number;
  completed: boolean;
  progress: number; // 0-100
  assessments: AssessmentWithProgress[];
}

interface AssessmentWithProgress {
  id: string;
  title: string;
  assessment_type: 'lesson_assessment' | 'path_quiz' | 'class_exam';
  time_limit_minutes?: number;
  passing_score_percentage: number;
  // Student progress data
  status: 'not_started' | 'in_progress' | 'completed' | 'passed' | 'failed';
  score?: number;
  attempts: number;
  maxAttempts?: number;
  lastAttemptDate?: string;
  dueDate?: string;
}

interface PathWithProgress {
  id: string;
  title: string;
  description: string;
  order: number;
  lessons: LessonWithProgress[];
  assessments: AssessmentWithProgress[]; // Path-level quizzes
  completed: boolean;
  progress: number; // 0-100
}

interface CourseData {
  id: string;
  title: string;
  description: string;
  paths: PathWithProgress[];
  classAssessments: AssessmentWithProgress[]; // Class-level exams
  overallProgress: number;
}

export default function StudentCourseNavigationTree({ 
  baseClassId, 
  onSelectItem, 
  selectedItemId, 
  selectedItemType 
}: StudentCourseNavigationTreeProps) {
  const [courseData, setCourseData] = useState<CourseData | null>(null);
  const [loading, setLoading] = useState(true);
  const [expandedPaths, setExpandedPaths] = useState<Set<string>>(new Set());
  const [expandedLessons, setExpandedLessons] = useState<Set<string>>(new Set());

  useEffect(() => {
    fetchCourseData();
  }, [baseClassId]);

  const fetchCourseData = async () => {
    setLoading(true);
    try {
      const response = await fetch(`/api/learn/courses/${baseClassId}/navigation`);
      if (!response.ok) throw new Error('Failed to fetch course data');
      
      const data = await response.json();
      setCourseData(data);
    } catch (error) {
      console.error('Error fetching course data:', error);
    } finally {
      setLoading(false);
    }
  };

  const togglePathExpansion = (pathId: string) => {
    setExpandedPaths(prev => {
      const newSet = new Set(prev);
      if (newSet.has(pathId)) {
        newSet.delete(pathId);
      } else {
        newSet.add(pathId);
      }
      return newSet;
    });
  };

  const toggleLessonExpansion = (lessonId: string) => {
    setExpandedLessons(prev => {
      const newSet = new Set(prev);
      if (newSet.has(lessonId)) {
        newSet.delete(lessonId);
      } else {
        newSet.add(lessonId);
      }
      return newSet;
    });
  };

  const getAssessmentStatusIcon = (assessment: AssessmentWithProgress) => {
    switch (assessment.status) {
      case 'completed':
      case 'passed':
        return <CheckCircle2 className="h-4 w-4 text-green-500" />;
      case 'failed':
        return <AlertCircle className="h-4 w-4 text-red-500" />;
      case 'in_progress':
        return <PlayCircle className="h-4 w-4 text-blue-500" />;
      default:
        return <Circle className="h-4 w-4 text-muted-foreground" />;
    }
  };

  const getAssessmentStatusBadge = (assessment: AssessmentWithProgress) => {
    const variant = assessment.status === 'passed' || assessment.status === 'completed' 
      ? 'default' 
      : assessment.status === 'failed' 
        ? 'destructive' 
        : assessment.status === 'in_progress'
          ? 'secondary'
          : 'outline';

    return (
      <Badge variant={variant} className="text-xs">
        {assessment.status.replace('_', ' ').replace(/\b\w/g, l => l.toUpperCase())}
        {assessment.score !== undefined && ` (${assessment.score}%)`}
      </Badge>
    );
  };

  const AssessmentItem = ({ assessment, level = 0 }: { assessment: AssessmentWithProgress; level?: number }) => {
    const isSelected = selectedItemType === 'assessment' && selectedItemId === assessment.id;
    const indentClass = level === 0 ? 'ml-0' : level === 1 ? 'ml-6' : 'ml-12';
    
    return (
      <div 
        className={`${indentClass} p-3 rounded-lg cursor-pointer transition-colors hover:bg-muted/50 ${
          isSelected ? 'bg-primary/10 border border-primary/20' : ''
        }`}
        onClick={() => onSelectItem('assessment', assessment.id)}
      >
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-3 flex-1">
            {getAssessmentStatusIcon(assessment)}
            <div className="flex-1">
              <div className="flex items-center space-x-2">
                <span className="font-medium text-sm">{assessment.title}</span>
                {assessment.assessment_type === 'lesson_assessment' && (
                  <FileText className="h-3 w-3 text-muted-foreground" />
                )}
                {assessment.assessment_type === 'path_quiz' && (
                  <BookOpen className="h-3 w-3 text-muted-foreground" />
                )}
                {assessment.assessment_type === 'class_exam' && (
                  <GraduationCap className="h-3 w-3 text-muted-foreground" />
                )}
              </div>
              <div className="flex items-center space-x-2 text-xs text-muted-foreground">
                {assessment.time_limit_minutes && (
                  <span className="flex items-center">
                    <Clock className="h-3 w-3 mr-1" />
                    {assessment.time_limit_minutes} min
                  </span>
                )}
                <span>Pass: {assessment.passing_score_percentage}%</span>
                {assessment.attempts > 0 && (
                  <span>Attempts: {assessment.attempts}{assessment.maxAttempts ? `/${assessment.maxAttempts}` : ''}</span>
                )}
              </div>
            </div>
          </div>
          <div className="flex items-center space-x-2">
            {getAssessmentStatusBadge(assessment)}
          </div>
        </div>
      </div>
    );
  };

  const LessonItem = ({ lesson, pathId }: { lesson: LessonWithProgress; pathId: string }) => {
    const isExpanded = expandedLessons.has(lesson.id);
    const isSelected = selectedItemType === 'lesson' && selectedItemId === lesson.id;
    const hasAssessments = lesson.assessments.length > 0;
    
    return (
      <div className="ml-6">
        <Collapsible open={isExpanded} onOpenChange={() => hasAssessments && toggleLessonExpansion(lesson.id)}>
          <div 
            className={`p-3 rounded-lg cursor-pointer transition-colors hover:bg-muted/50 ${
              isSelected ? 'bg-primary/10 border border-primary/20' : ''
            }`}
            onClick={() => onSelectItem('lesson', lesson.id)}
          >
            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-3 flex-1">
                {lesson.completed ? (
                  <CheckCircle2 className="h-4 w-4 text-green-500" />
                ) : (
                  <Circle className="h-4 w-4 text-muted-foreground" />
                )}
                <div className="flex-1">
                  <div className="flex items-center space-x-2">
                    <span className="font-medium">{lesson.title}</span>
                    <Badge variant="outline" className="text-xs">
                      {lesson.estimatedDurationHours}h
                    </Badge>
                    {hasAssessments && (
                      <CollapsibleTrigger asChild>
                        <Button
                          variant="ghost"
                          size="sm"
                          className="h-6 w-6 p-0"
                          onClick={(e) => {
                            e.stopPropagation();
                            toggleLessonExpansion(lesson.id);
                          }}
                        >
                          {isExpanded ? (
                            <ChevronDown className="h-3 w-3" />
                          ) : (
                            <ChevronRight className="h-3 w-3" />
                          )}
                        </Button>
                      </CollapsibleTrigger>
                    )}
                  </div>
                  <div className="flex items-center space-x-2 mt-1">
                    <Progress value={lesson.progress} className="flex-1 h-2" />
                    <span className="text-xs text-muted-foreground">{lesson.progress}%</span>
                  </div>
                </div>
              </div>
            </div>
          </div>
          
          {hasAssessments && (
            <CollapsibleContent className="space-y-1 mt-2">
              {lesson.assessments.map(assessment => (
                <AssessmentItem key={assessment.id} assessment={assessment} level={2} />
              ))}
            </CollapsibleContent>
          )}
        </Collapsible>
      </div>
    );
  };

  const PathItem = ({ path }: { path: PathWithProgress }) => {
    const isExpanded = expandedPaths.has(path.id);
    const hasContent = path.lessons.length > 0 || path.assessments.length > 0;
    
    return (
      <Card className="mb-4">
        <Collapsible open={isExpanded} onOpenChange={() => hasContent && togglePathExpansion(path.id)}>
          <CollapsibleTrigger asChild>
            <CardHeader className="cursor-pointer hover:bg-muted/50 transition-colors">
              <div className="flex items-center justify-between">
                <div className="flex items-center space-x-3 flex-1">
                  {path.completed ? (
                    <CheckCircle2 className="h-5 w-5 text-green-500" />
                  ) : (
                    <Circle className="h-5 w-5 text-muted-foreground" />
                  )}
                  <div className="flex-1">
                    <CardTitle className="text-lg">{path.title}</CardTitle>
                    <div className="flex items-center space-x-2 mt-2">
                      <Progress value={path.progress} className="flex-1 h-2" />
                      <span className="text-sm text-muted-foreground">{path.progress}%</span>
                    </div>
                  </div>
                </div>
                <div className="flex items-center space-x-2">
                  <Badge variant="outline">
                    {path.lessons.length} lessons
                  </Badge>
                  {path.assessments.length > 0 && (
                    <Badge variant="secondary">
                      {path.assessments.length} quizzes
                    </Badge>
                  )}
                  {hasContent && (
                    <Button variant="ghost" size="sm" className="h-8 w-8 p-0">
                      {isExpanded ? (
                        <ChevronDown className="h-4 w-4" />
                      ) : (
                        <ChevronRight className="h-4 w-4" />
                      )}
                    </Button>
                  )}
                </div>
              </div>
            </CardHeader>
          </CollapsibleTrigger>
          
          {hasContent && (
            <CollapsibleContent>
              <CardContent className="pt-0 space-y-2">
                {/* Path-level assessments */}
                {path.assessments.map(assessment => (
                  <AssessmentItem key={assessment.id} assessment={assessment} level={1} />
                ))}
                
                {/* Lessons */}
                {path.lessons.map(lesson => (
                  <LessonItem key={lesson.id} lesson={lesson} pathId={path.id} />
                ))}
              </CardContent>
            </CollapsibleContent>
          )}
        </Collapsible>
      </Card>
    );
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto mb-2"></div>
          <p className="text-muted-foreground">Loading course content...</p>
        </div>
      </div>
    );
  }

  if (!courseData) {
    return (
      <div className="text-center p-8">
        <p className="text-muted-foreground">No course data available</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Course Header */}
      <Card>
        <CardHeader>
          <CardTitle className="text-xl">{courseData.title}</CardTitle>
          <div className="flex items-center space-x-4 mt-2">
            <div className="flex-1">
              <Progress value={courseData.overallProgress} className="h-3" />
            </div>
            <span className="text-sm font-medium">{courseData.overallProgress}% Complete</span>
          </div>
        </CardHeader>
      </Card>

      {/* Class-level Exams */}
      {courseData.classAssessments.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-lg flex items-center">
              <GraduationCap className="h-5 w-5 mr-2" />
              Class Exams
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {courseData.classAssessments.map(assessment => (
              <AssessmentItem key={assessment.id} assessment={assessment} />
            ))}
          </CardContent>
        </Card>
      )}

      {/* Learning Paths */}
      <div>
        <h3 className="text-lg font-semibold mb-4 flex items-center">
          <BookOpen className="h-5 w-5 mr-2" />
          Learning Paths
        </h3>
        {courseData.paths.map(path => (
          <PathItem key={path.id} path={path} />
        ))}
      </div>
    </div>
  );
} 