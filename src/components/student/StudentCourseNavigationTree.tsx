'use client';

import React, { useState, useEffect } from 'react';
import { progressEvents } from '@/lib/utils/progressEvents';
import LunaContextElement from '@/components/luna/LunaContextElement';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { 
  BookOpen, 
  GraduationCap,
  ChevronLeft,
  Target,
  Trophy,
  ArrowLeft,
  Home,
  RefreshCw,
  CheckCircle2,
  Clock,
  ChevronRight,
  Lock
} from 'lucide-react';
import { cn } from '@/lib/utils';

interface StudentCourseNavigationTreeProps {
  baseClassId: string;
  onSelectItem: (type: 'lesson' | 'assessment' | 'clear', itemId: string) => void;
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
  status: string;
  lastPosition?: string;
}

interface AssessmentWithProgress {
  id: string;
  title: string;
  assessment_type: 'lesson' | 'path' | 'class';
  time_limit_minutes?: number;
  passing_score_percentage: number;
  status: 'not_started' | 'in_progress' | 'completed' | 'passed' | 'failed';
  score?: number;
  attempts: number;
  maxAttempts?: number;
  lastAttemptDate?: string;
  dueDate?: string;
  passed?: boolean;
  progress?: number;
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

type NavigationState = 'overview' | 'path' | 'lesson';

export default function StudentCourseNavigationTree({ 
  baseClassId, 
  onSelectItem, 
  selectedItemId, 
  selectedItemType 
}: StudentCourseNavigationTreeProps) {
  const [courseData, setCourseData] = useState<CourseData | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [navigationState, setNavigationState] = useState<NavigationState>('overview');
  const [selectedPath, setSelectedPath] = useState<PathWithProgress | null>(null);
  const [selectedLesson, setSelectedLesson] = useState<LessonWithProgress | null>(null);

  useEffect(() => {
    fetchCourseData();
  }, [baseClassId]);

  // Listen for progress updates and refresh course data (with debouncing)
  useEffect(() => {
    let timeoutId: NodeJS.Timeout;
    
    const unsubscribe = progressEvents.subscribe((event) => {
      console.log('🔄 Navigation Tree: Progress event received:', event);
      console.log('🔄 Navigation Tree: Current course data before refresh:', courseData);
      
      // Clear existing timeout
      if (timeoutId) {
        clearTimeout(timeoutId);
      }
      
      // Debounce the refresh to avoid too many API calls
      timeoutId = setTimeout(() => {
        console.log('🔄 Navigation Tree: Refreshing course data after progress event...');
        fetchCourseData(true); // Mark as refresh
      }, 1000); // Increased to 1000ms to allow hierarchical progress updates to complete
    });

    return () => {
      if (timeoutId) {
        clearTimeout(timeoutId);
      }
      unsubscribe();
    };
  }, []); // Remove courseData dependency to prevent subscription recreation

  // Add this effect to refresh the selected path/lesson when courseData is updated
  useEffect(() => {
    if (courseData && selectedPath) {
      const newSelectedPath = courseData.paths.find(p => p.id === selectedPath.id);
      if (newSelectedPath) {
        setSelectedPath(newSelectedPath);

        if (selectedLesson) {
          const newSelectedLesson = newSelectedPath.lessons.find(l => l.id === selectedLesson.id);
          if (newSelectedLesson) {
            setSelectedLesson(newSelectedLesson);
          }
        }
      }
    }
  }, [courseData]);

  const fetchCourseData = async (isRefresh = false, retryCount = 0) => {
    if (isRefresh) {
      setRefreshing(true);
      console.log('🔄 Navigation Tree: Refreshing course data...');
    } else {
      setLoading(true);
      console.log('🔄 Navigation Tree: Initial course data fetch...');
    }
    
    try {
      console.log('🔄 Navigation Tree: Fetching course data for baseClassId:', baseClassId);
      const response = await fetch(`/api/learn/courses/${baseClassId}/navigation`, {
        cache: 'no-store', // Ensure we get fresh data
        headers: {
          'Cache-Control': 'no-cache'
        }
      });
      console.log('🔄 Navigation Tree: Response status:', response.status);
      console.log('🔄 Navigation Tree: Response ok:', response.ok);
      
      if (!response.ok) {
        const errorText = await response.text();
        console.error('🔄 Navigation Tree: API Error:', errorText);
        throw new Error(`Failed to fetch course data: ${response.status} ${errorText}`);
      }
      
      const data = await response.json();
      console.log('🔄 Navigation Tree: Fetched course data:', data);
      console.log('🔄 Navigation Tree: Previous course data:', courseData);
      
      // Log specific lesson and path progress if available
      if (data.paths && data.paths.length > 0) {
        data.paths.forEach((path: any, pathIndex: number) => {
          console.log(`🔄 Navigation Tree: Path ${pathIndex + 1} (${path.title}): ${path.progress}%`);
          if (path.lessons && path.lessons.length > 0) {
            path.lessons.forEach((lesson: any, lessonIndex: number) => {
              console.log(`🔄 Navigation Tree: Path ${pathIndex + 1}, Lesson ${lessonIndex + 1} (${lesson.title}): ${lesson.progress}% - ${lesson.status}`);
            });
          }
        });
      }
      
      setCourseData(data);
    } catch (error) {
      console.error('🔄 Navigation Tree: Error fetching course data:', error);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  const getStatusIndicator = (status: string, isAssessment = false, passed = false) => {
    if (status === 'completed' || (isAssessment && passed)) {
      return <div className="w-2 h-2 rounded-full bg-emerald-500" />;
    }
    if (status === 'in_progress') {
      return <div className="w-2 h-2 rounded-full bg-blue-500 animate-pulse" />;
    }
    if (isAssessment && status === 'failed') {
      return <div className="w-2 h-2 rounded-full bg-red-500" />;
    }
    return <div className="w-2 h-2 rounded-full bg-gray-300" />;
  };

  // Check if an assessment is accessible based on prerequisites
  const isAssessmentAccessible = (assessment: AssessmentWithProgress, context?: { lesson?: LessonWithProgress, path?: PathWithProgress }) => {
    // Lesson assessments: require the lesson to be completed
    if (assessment.assessment_type === 'lesson' && context?.lesson) {
      return context.lesson.completed || context.lesson.status === 'completed';
    }
    
    // Path assessments: require all lessons in the path to be completed
    if (assessment.assessment_type === 'path' && context?.path) {
      return context.path.lessons.every(lesson => lesson.completed || lesson.status === 'completed');
    }
    
    // Class assessments: require all paths to be completed
    if (assessment.assessment_type === 'class' && courseData) {
      return courseData.paths.every(path => 
        path.lessons.every(lesson => lesson.completed || lesson.status === 'completed')
      );
    }
    
    return true; // Default to accessible if we can't determine prerequisites
  };

  const navigateToPath = (path: PathWithProgress) => {
    setSelectedPath(path);
    setNavigationState('path');
  };

  const navigateToLesson = (lesson: LessonWithProgress) => {
    setSelectedLesson(lesson);
    setNavigationState('lesson');
  };

  const navigateBack = () => {
    // Clear selected content when navigating back
    onSelectItem('clear', ''); // This will clear the content in the parent by passing invalid type
    
    if (navigationState === 'lesson') {
      setNavigationState('path');
      setSelectedLesson(null);
    } else if (navigationState === 'path') {
      setNavigationState('overview');
      setSelectedPath(null);
    }
  };

  const navigateToOverview = () => {
    // Clear selected content when navigating to overview
    onSelectItem('clear', ''); // This will clear the content in the parent by passing invalid type
    
    setNavigationState('overview');
    setSelectedPath(null);
    setSelectedLesson(null);
  };

  const AssessmentItem = ({ assessment, compact = false, context }: { 
    assessment: AssessmentWithProgress; 
    compact?: boolean; 
    context?: { lesson?: LessonWithProgress, path?: PathWithProgress } 
  }) => {
    const isSelected = selectedItemId === assessment.id && selectedItemType === 'assessment';
    const isPassed = assessment.passed || assessment.status === 'passed';
    const isFailed = assessment.status === 'failed';
    const hasProgress = assessment.progress && assessment.progress > 0 && assessment.progress < 100;
    const isAccessible = isAssessmentAccessible(assessment, context);
    
    const handleClick = () => {
      if (isAccessible) {
        onSelectItem('assessment', assessment.id);
      }
    };
    
    return (
      <button
        onClick={handleClick}
        disabled={!isAccessible}
        className={cn(
          "w-full text-left group transition-all duration-200 rounded-lg",
          compact ? "py-2 px-3" : "py-3 px-4",
          !isAccessible 
            ? "opacity-50 cursor-not-allowed bg-gray-50/30 dark:bg-gray-800/30" 
            : isSelected 
              ? "bg-blue-50 dark:bg-blue-950/30" 
              : "hover:bg-gray-50/50 dark:hover:bg-white/5"
        )}
      >
        <div className="flex items-center space-x-3">
          {!isAccessible ? (
            <Lock className="w-4 h-4 text-gray-400" />
          ) : (
            getStatusIndicator(assessment.status, true, isPassed)
          )}
          
          <div className="flex-1 min-w-0">
            <div className="flex items-center justify-between">
              <div className="flex-1 min-w-0">
                <span className={cn(
                  "font-medium",
                  compact ? "text-sm" : "text-base",
                  !isAccessible ? "text-gray-400 dark:text-gray-500" :
                  isPassed ? "text-emerald-700 dark:text-emerald-300" : 
                  isFailed ? "text-red-700 dark:text-red-300" : 
                  "text-gray-900 dark:text-white"
                )}>
                  {assessment.title}
                </span>
                
                {!isAccessible && (
                  <p className="text-xs text-gray-400 mt-1">
                    {assessment.assessment_type === 'lesson' ? 'Complete the lesson first' :
                     assessment.assessment_type === 'path' ? 'Complete all lessons in this path first' :
                     'Complete all course content first'}
                  </p>
                )}
                
                {hasProgress && isAccessible && (
                  <div className="mt-2">
                    <Progress value={assessment.progress} className="h-1" />
                  </div>
                )}
              </div>
              
              {isAccessible && (
                <div className="flex items-center space-x-2 text-xs text-gray-500 ml-4">
                  {assessment.score !== null && assessment.score !== undefined && (
                    <span className={cn(
                      "px-2 py-1 rounded-full text-xs font-medium",
                      isPassed ? "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300" :
                      isFailed ? "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-300" :
                      "bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-300"
                    )}>
                      {assessment.score}%
                    </span>
                  )}
                </div>
              )}
            </div>
          </div>
        </div>
      </button>
    );
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-center">
          <div className="w-8 h-8 border-2 border-blue-500 border-t-transparent rounded-full animate-spin mx-auto mb-3"></div>
          <p className="text-gray-600 dark:text-gray-400 text-sm">Loading course...</p>
        </div>
      </div>
    );
  }

  if (!courseData) {
    return (
      <div className="text-center p-8">
        <p className="text-gray-600 dark:text-gray-400">No course data available</p>
      </div>
    );
  }

  // Overview State - List of all paths
  if (navigationState === 'overview') {
    return (
      <LunaContextElement
        type="course-navigation"
        role="navigation"
        content={{
          courseTitle: courseData.title,
          courseDescription: courseData.description,
          overallProgress: courseData.overallProgress,
          totalPaths: courseData.paths.length,
          navigationState: 'overview'
        }}
        metadata={{
          baseClassId,
          selectedItemId,
          selectedItemType
        }}
        state={{
          loading,
          refreshing
        }}
        actionable={true}
      >
        <div className="space-y-6">
          {/* Course Header */}
          <div className="flex items-center justify-between p-4 bg-white dark:bg-gray-900 rounded-xl border border-gray-200 dark:border-gray-800">
            <div className="flex items-center space-x-3 flex-1 min-w-0">
              <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-blue-500 to-purple-600 flex items-center justify-center">
                <GraduationCap className="w-4 h-4 text-white" />
              </div>
              <div className="min-w-0 flex-1">
                <h1 className="text-lg font-semibold text-gray-900 dark:text-white">
                  {courseData.title}
                </h1>
                <div className="flex items-center space-x-3 mt-1">
                  <div className="flex-1 bg-gray-200 dark:bg-gray-700 rounded-full h-1">
                    <div 
                      className="h-1 bg-gradient-to-r from-blue-500 to-purple-600 rounded-full transition-all duration-300"
                      style={{ width: `${courseData.overallProgress}%` }}
                    />
                  </div>
                  <span className="text-sm font-medium text-gray-600 dark:text-gray-400">
                    {courseData.overallProgress}%
                  </span>
                </div>
              </div>
            </div>
            
            <Button 
              variant="ghost" 
              size="sm" 
              onClick={() => fetchCourseData(true)}
              disabled={loading || refreshing}
              className="w-8 h-8 p-0 hover:bg-gray-100 dark:hover:bg-gray-800"
            >
              <RefreshCw className={cn("w-4 h-4", (loading || refreshing) && "animate-spin")} />
            </Button>
          </div>

          {/* Learning Paths List */}
          <div className="space-y-3">
            {courseData.paths.map((path, index) => (
              <button
                key={path.id}
                onClick={() => navigateToPath(path)}
                className="w-full text-left p-4 bg-white dark:bg-gray-900 rounded-xl border border-gray-200 dark:border-gray-800 hover:bg-gray-50/50 dark:hover:bg-white/5 transition-all duration-200 group"
              >
                <div className="flex items-center space-x-4">
                  <div className="w-10 h-10 rounded-lg bg-gradient-to-br from-blue-500 to-purple-600 flex items-center justify-center">
                    <BookOpen className="w-5 h-5 text-white" />
                  </div>
                  
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between">
                      <div className="flex-1 min-w-0">
                        <h3 className="text-base font-semibold text-gray-900 dark:text-white">
                          {path.title}
                        </h3>
                        <p className="text-sm text-gray-600 dark:text-gray-400 mt-1 line-clamp-2">
                          {path.description}
                        </p>
                        <div className="flex items-center space-x-3 mt-2">
                          <div className="flex-1 bg-gray-200 dark:bg-gray-700 rounded-full h-1">
                            <div 
                              className="h-1 bg-gradient-to-r from-blue-500 to-purple-600 rounded-full transition-all duration-300"
                              style={{ width: `${path.progress}%` }}
                            />
                          </div>
                          <span className="text-xs font-medium text-gray-600 dark:text-gray-400">
                            {path.progress}%
                          </span>
                        </div>
                      </div>
                      
                      <div className="flex flex-col items-end space-y-2 ml-4">
                        <span className="text-xs text-gray-500 px-2 py-1 bg-gray-100 dark:bg-gray-800 rounded-full">
                          {path.lessons.length} lesson{path.lessons.length !== 1 ? 's' : ''}
                        </span>
                        {path.assessments.length > 0 && (
                          <span className="text-xs text-amber-700 dark:text-amber-300 px-2 py-1 bg-amber-100 dark:bg-amber-900/30 rounded-full">
                            {path.assessments.length} quiz{path.assessments.length !== 1 ? 'zes' : ''}
                          </span>
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              </button>
            ))}
          </div>

          {/* Final Exams */}
          {courseData.classAssessments.length > 0 && (
            <div className="p-4 bg-gradient-to-r from-purple-50 to-pink-50 dark:from-purple-950/20 dark:to-pink-950/20 rounded-xl border border-purple-200 dark:border-purple-800/30">
              <div className="flex items-center space-x-3 mb-3">
                <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-purple-500 to-pink-600 flex items-center justify-center">
                  <Trophy className="w-4 h-4 text-white" />
                </div>
                <h2 className="text-lg font-semibold text-gray-900 dark:text-white">
                  Final Exams
                </h2>
              </div>
              <div className="space-y-1">
                {courseData.classAssessments.map(assessment => (
                  <AssessmentItem key={assessment.id} assessment={assessment} context={{}} />
                ))}
              </div>
            </div>
          )}
        </div>
      </LunaContextElement>
    );
  }

  // Path State - Detailed view of a specific path
  if (navigationState === 'path' && selectedPath) {
    return (
      <LunaContextElement
        type="path-navigation"
        role="navigation"
        content={{
          pathTitle: selectedPath.title,
          pathDescription: selectedPath.description,
          pathProgress: selectedPath.progress,
          totalLessons: selectedPath.lessons.length,
          navigationState: 'path'
        }}
        metadata={{
          baseClassId,
          pathId: selectedPath.id,
          selectedItemId,
          selectedItemType
        }}
        state={{
          loading,
          refreshing
        }}
        actionable={true}
      >
        <div className="space-y-6">
          {/* Path Header with Navigation */}
          <div className="p-4 bg-white dark:bg-gray-900 rounded-xl border border-gray-200 dark:border-gray-800">
            <div className="flex items-center space-x-3 mb-3">
              <Button
                variant="ghost"
                size="sm"
                onClick={navigateBack}
                className="w-8 h-8 p-0 hover:bg-gray-100 dark:hover:bg-gray-800"
              >
                <ChevronLeft className="w-4 h-4" />
              </Button>
              <Button
                variant="ghost"
                size="sm"
                onClick={navigateToOverview}
                className="w-8 h-8 p-0 hover:bg-gray-100 dark:hover:bg-gray-800"
              >
                <Home className="w-4 h-4" />
              </Button>
              <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-blue-500 to-purple-600 flex items-center justify-center">
                <BookOpen className="w-4 h-4 text-white" />
              </div>
              <div className="flex-1">
                <h1 className="text-lg font-semibold text-gray-900 dark:text-white">
                  {selectedPath.title}
                </h1>
                <div className="flex items-center space-x-3 mt-1">
                  <div className="flex-1 bg-gray-200 dark:bg-gray-700 rounded-full h-1">
                    <div 
                      className="h-1 bg-gradient-to-r from-blue-500 to-purple-600 rounded-full transition-all duration-300"
                      style={{ width: `${selectedPath.progress}%` }}
                    />
                  </div>
                  <span className="text-sm font-medium text-gray-600 dark:text-gray-400">
                    {selectedPath.progress}%
                  </span>
                </div>
              </div>
            </div>
            {selectedPath.description && (
              <p className="text-sm text-gray-600 dark:text-gray-400 pl-20">
                {selectedPath.description}
              </p>
            )}
          </div>

          {/* Lessons List */}
          <div className="space-y-2">
            {selectedPath.lessons.map((lesson, index) => (
              <div key={lesson.id} className="space-y-1">
                <button
                  onClick={() => lesson.assessments.length > 0 ? navigateToLesson(lesson) : onSelectItem('lesson', lesson.id)}
                  className={cn(
                    "w-full text-left p-4 bg-white dark:bg-gray-900 rounded-lg border border-gray-200 dark:border-gray-800 transition-all duration-200 group",
                    selectedItemId === lesson.id && selectedItemType === 'lesson'
                      ? "bg-blue-50 dark:bg-blue-950/30 border-blue-200 dark:border-blue-800" 
                      : "hover:bg-gray-50/50 dark:hover:bg-white/5"
                  )}
                >
                  <div className="flex items-center space-x-3">
                    {getStatusIndicator(lesson.status)}
                    
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between">
                        <div className="flex-1 min-w-0">
                          <h3 className="font-medium text-base text-gray-900 dark:text-white">
                            {lesson.title}
                          </h3>
                          
                          {lesson.progress > 0 && lesson.progress < 100 && (
                            <div className="mt-2">
                              <Progress value={lesson.progress} className="h-1" />
                            </div>
                          )}
                        </div>
                        
                        <div className="flex items-center space-x-3 text-xs text-gray-500 ml-4">
                          {lesson.assessments.length > 0 && (
                            <span className="px-2 py-1 bg-gray-100 dark:bg-gray-800 rounded-full">
                              {lesson.assessments.length} quiz{lesson.assessments.length !== 1 ? 'zes' : ''}
                            </span>
                          )}
                        </div>
                      </div>
                    </div>
                  </div>
                </button>
              </div>
            ))}
          </div>

          {/* Path Assessments */}
          {selectedPath.assessments.length > 0 && (
            <div className="p-4 bg-amber-50 dark:bg-amber-950/20 rounded-xl border border-amber-200 dark:border-amber-800/30">
              <div className="flex items-center space-x-3 mb-3">
                <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-amber-500 to-orange-600 flex items-center justify-center">
                  <Target className="w-4 h-4 text-white" />
                </div>
                <h2 className="text-lg font-semibold text-gray-900 dark:text-white">
                  Path Quiz{selectedPath.assessments.length !== 1 ? 'zes' : ''}
                </h2>
              </div>
              <div className="space-y-1">
                {selectedPath.assessments.map(assessment => (
                  <AssessmentItem key={assessment.id} assessment={assessment} context={{ path: selectedPath }} />
                ))}
              </div>
            </div>
          )}
        </div>
      </LunaContextElement>
    );
  }

  // Lesson State - Detailed view of a specific lesson
  if (navigationState === 'lesson' && selectedLesson && selectedPath) {
    return (
      <LunaContextElement
        type="lesson-navigation"
        role="navigation"
        content={{
          lessonTitle: selectedLesson.title,
          lessonDescription: selectedLesson.description,
          lessonProgress: selectedLesson.progress,
          totalAssessments: selectedLesson.assessments.length,
          navigationState: 'lesson'
        }}
        metadata={{
          baseClassId,
          pathId: selectedPath.id,
          lessonId: selectedLesson.id,
          selectedItemId,
          selectedItemType
        }}
        state={{
          loading,
          refreshing
        }}
        actionable={true}
      >
        <div className="space-y-6">
          {/* Lesson Header with Navigation */}
          <div className="p-4 bg-white dark:bg-gray-900 rounded-xl border border-gray-200 dark:border-gray-800">
            <div className="flex items-center space-x-3 mb-3">
              <Button
                variant="ghost"
                size="sm"
                onClick={navigateBack}
                className="w-8 h-8 p-0 hover:bg-gray-100 dark:hover:bg-gray-800"
              >
                <ChevronLeft className="w-4 h-4" />
              </Button>
              <Button
                variant="ghost"
                size="sm"
                onClick={navigateToOverview}
                className="w-8 h-8 p-0 hover:bg-gray-100 dark:hover:bg-gray-800"
              >
                <Home className="w-4 h-4" />
              </Button>
              {getStatusIndicator(selectedLesson.status)}
              <div className="flex-1">
                <h1 className="text-lg font-semibold text-gray-900 dark:text-white">
                  {selectedLesson.title}
                </h1>
                <div className="flex items-center space-x-3 mt-1">
                  <div className="flex-1 bg-gray-200 dark:bg-gray-700 rounded-full h-1">
                    <div 
                      className="h-1 bg-gradient-to-r from-blue-500 to-purple-600 rounded-full transition-all duration-300"
                      style={{ width: `${selectedLesson.progress}%` }}
                    />
                  </div>
                  <span className="text-sm font-medium text-gray-600 dark:text-gray-400">
                    {selectedLesson.progress}%
                  </span>
                </div>
              </div>
            </div>
            <div className="pl-20">
              <p className="text-xs text-gray-500 mb-2">
                {selectedPath.title} • Lesson {selectedPath.lessons.findIndex(l => l.id === selectedLesson.id) + 1} of {selectedPath.lessons.length}
              </p>
              {selectedLesson.description && (
                <p className="text-sm text-gray-600 dark:text-gray-400">
                  {selectedLesson.description}
                </p>
              )}
            </div>
          </div>

          {/* Lesson Content Button */}
          <button
            onClick={() => onSelectItem('lesson', selectedLesson.id)}
            className={cn(
              "w-full text-left p-4 bg-white dark:bg-gray-900 rounded-xl border border-gray-200 dark:border-gray-800 transition-all duration-200",
              selectedItemId === selectedLesson.id && selectedItemType === 'lesson'
                ? "bg-blue-50 dark:bg-blue-950/30 border-blue-200 dark:border-blue-800" 
                : "hover:bg-gray-50/50 dark:hover:bg-white/5"
            )}
          >
            <div className="flex items-center space-x-3">
              <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-green-500 to-teal-600 flex items-center justify-center">
                <BookOpen className="w-4 h-4 text-white" />
              </div>
              <div className="flex-1">
                <h3 className="font-medium text-base text-gray-900 dark:text-white">
                  Start Learning
                </h3>
                <p className="text-sm text-gray-600 dark:text-gray-400">
                  Begin or continue this lesson
                </p>
              </div>
            </div>
          </button>

          {/* Lesson Assessments */}
          {selectedLesson.assessments.length > 0 && (
            <div className="p-4 bg-blue-50 dark:bg-blue-950/20 rounded-xl border border-blue-200 dark:border-blue-800/30">
              <div className="flex items-center space-x-3 mb-3">
                <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-blue-500 to-indigo-600 flex items-center justify-center">
                  <Target className="w-4 h-4 text-white" />
                </div>
                <h2 className="text-lg font-semibold text-gray-900 dark:text-white">
                  Lesson Quiz{selectedLesson.assessments.length !== 1 ? 'zes' : ''}
                </h2>
              </div>
              <div className="space-y-1">
                {selectedLesson.assessments.map(assessment => (
                  <AssessmentItem key={assessment.id} assessment={assessment} context={{ lesson: selectedLesson }} />
                ))}
              </div>
            </div>
          )}
        </div>
      </LunaContextElement>
    );
  }

  return null;
} 