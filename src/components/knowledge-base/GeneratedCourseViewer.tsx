'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Progress } from '@/components/ui/progress';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { 
  BookOpen, 
  Brain, 
  Lightbulb, 
  Clock, 
  Target, 
  CheckCircle2,
  PlayCircle,
  FileText,
  Users,
  BarChart3,
  Loader2,
  Copy,
  Download,
  Share2,
  Plus,
  Sparkles
} from 'lucide-react';

interface CourseOutline {
  id: string;
  title: string;
  description: string;
  generationMode: 'kb_only' | 'kb_priority' | 'kb_supplemented';
  learningObjectives: string[];
  estimatedDurationWeeks: number;
  modules: CourseModule[];
  status: 'draft' | 'approved' | 'published' | 'archived';
}

interface CourseModule {
  id: string;
  title: string;
  description: string;
  order: number;
  estimatedDurationWeeks: number;
  learningObjectives: string[];
  lessons: ModuleLesson[];
  assessments: ModuleAssessment[];
}

interface ModuleLesson {
  id: string;
  title: string;
  description: string;
  order: number;
  estimatedDurationHours: number;
  contentType: 'lecture' | 'activity' | 'discussion' | 'reading' | 'lab';
  learningObjectives: string[];
  contentOutline: string[];
  sourceReferences: string[];
}

interface ModuleAssessment {
  id: string;
  title: string;
  type: 'quiz' | 'assignment' | 'project' | 'exam' | 'discussion';
  order: number;
  estimatedDurationMinutes: number;
  learningObjectives: string[];
  masteryThreshold: number;
  contentFocus: 'course_content' | 'kb_supplemented';
}

interface GeneratedCourseViewerProps {
  courseOutlineId: string;
  baseClassId?: string;
  onDeployToCourse?: (courseOutlineId: string) => void;
}

const GENERATION_MODE_CONFIG = {
  kb_only: {
    icon: <BookOpen className="h-4 w-4" />,
    label: 'Knowledge Base Only',
    color: 'bg-blue-500'
  },
  kb_priority: {
    icon: <Brain className="h-4 w-4" />,
    label: 'Knowledge Base Priority',
    color: 'bg-purple-500'
  },
  kb_supplemented: {
    icon: <Lightbulb className="h-4 w-4" />,
    label: 'Knowledge Base Supplemented',
    color: 'bg-green-500'
  }
};

const CONTENT_TYPE_ICONS = {
  lecture: <FileText className="h-4 w-4" />,
  activity: <PlayCircle className="h-4 w-4" />,
  discussion: <Users className="h-4 w-4" />,
  reading: <BookOpen className="h-4 w-4" />,
  lab: <BarChart3 className="h-4 w-4" />
};

export default function GeneratedCourseViewer({ courseOutlineId, baseClassId, onDeployToCourse }: GeneratedCourseViewerProps) {
  const [courseOutline, setCourseOutline] = useState<CourseOutline | null>(null);
  const [loading, setLoading] = useState(true);
  const [deploying, setDeploying] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [creatingAssessments, setCreatingAssessments] = useState<Set<string>>(new Set());

  const loadCourseOutline = useCallback(async () => {
    try {
      setLoading(true);
      const response = await fetch(`/api/knowledge-base/generation-status/${courseOutlineId}`);
      const data = await response.json();

      if (data.success && data.courseOutline) {
        setCourseOutline(data.courseOutline);
      } else {
        setError('Failed to load course outline');
      }
    } catch (err) {
      setError('Failed to load course outline');
    } finally {
      setLoading(false);
    }
  }, [courseOutlineId]);

  useEffect(() => {
    loadCourseOutline();
  }, [loadCourseOutline]);

  const handleDeployToCourse = async () => {
    if (!courseOutline) return;

    try {
      setDeploying(true);
      // This would call an API to deploy the generated course to the actual course structure
      // For now, we'll just simulate it
      await new Promise(resolve => setTimeout(resolve, 2000));
      onDeployToCourse?.(courseOutlineId);
    } catch (err) {
      setError('Failed to deploy course');
    } finally {
      setDeploying(false);
    }
  };

  const calculateTotalLessons = () => {
    if (!courseOutline) return 0;
    return courseOutline.modules.reduce((total, module) => total + module.lessons.length, 0);
  };

  const calculateTotalAssessments = () => {
    if (!courseOutline) return 0;
    return courseOutline.modules.reduce((total, module) => total + module.assessments.length, 0);
  };

  const calculateTotalHours = () => {
    if (!courseOutline) return 0;
    return courseOutline.modules.reduce((total, module) => 
      total + module.lessons.reduce((lessonTotal, lesson) => lessonTotal + lesson.estimatedDurationHours, 0), 0
    );
  };

  const handleCreateAssessment = async (assessment: ModuleAssessment, moduleTitle: string, lessonId?: string, pathId?: string) => {
    if (!baseClassId) {
      setError('Base class ID required for assessment creation');
      return;
    }

    setCreatingAssessments(prev => new Set(prev).add(assessment.id));
    
    try {
      let assessmentType = 'class_exam';
      if (lessonId) assessmentType = 'lesson_assessment';
      else if (pathId) assessmentType = 'path_quiz';

      const assessmentData = {
        title: assessment.title,
        description: `${assessment.type.charAt(0).toUpperCase() + assessment.type.slice(1)} for ${moduleTitle}`,
        instructions: `Complete this ${assessment.type} to demonstrate mastery of the learning objectives.`,
        assessment_type: assessmentType,
        base_class_id: baseClassId,
        lesson_id: lessonId || null,
        path_id: pathId || null,
        time_limit_minutes: assessment.estimatedDurationMinutes,
        passing_score_percentage: assessment.masteryThreshold,
        ai_grading_enabled: true,
        metadata: {
          learningObjectives: assessment.learningObjectives,
          contentFocus: assessment.contentFocus,
          generatedFromOutline: true,
          sourceModuleId: assessment.id
        }
      };

      const response = await fetch('/api/teach/assessments', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(assessmentData),
      });

      if (!response.ok) {
        throw new Error('Failed to create assessment');
      }

      const result = await response.json();
      
      alert(`Assessment "${assessment.title}" created successfully! You can now add questions and configure it in the studio.`);
      
    } catch (err) {
      console.error('Error creating assessment:', err);
      setError(`Failed to create assessment: ${err instanceof Error ? err.message : 'Unknown error'}`);
    } finally {
      setCreatingAssessments(prev => {
        const newSet = new Set(prev);
        newSet.delete(assessment.id);
        return newSet;
      });
    }
  };

  if (loading) {
    return (
      <Card className="w-full">
        <CardContent className="p-6">
          <div className="flex items-center justify-center space-x-3">
            <Loader2 className="h-6 w-6 animate-spin" />
            <span>Loading course outline...</span>
          </div>
        </CardContent>
      </Card>
    );
  }

  if (error || !courseOutline) {
    return (
      <Alert variant="destructive">
        <AlertDescription>{error || 'Course outline not found'}</AlertDescription>
      </Alert>
    );
  }

  const modeConfig = GENERATION_MODE_CONFIG[courseOutline.generationMode];

  return (
    <div className="w-full space-y-6">
      <Card>
        <CardHeader>
          <div className="flex items-start justify-between">
            <div className="space-y-2">
              <CardTitle className="text-2xl">{courseOutline.title}</CardTitle>
              <CardDescription>{courseOutline.description}</CardDescription>
              <div className="flex items-center space-x-4">
                <Badge variant="outline" className="flex items-center space-x-1">
                  {modeConfig.icon}
                  <span>{modeConfig.label}</span>
                </Badge>
                <Badge variant={courseOutline.status === 'draft' ? 'secondary' : 'default'}>
                  {courseOutline.status}
                </Badge>
              </div>
            </div>
            <div className="flex space-x-2">
              <Button variant="outline" size="sm">
                <Copy className="h-4 w-4 mr-2" />
                Clone
              </Button>
              <Button variant="outline" size="sm">
                <Download className="h-4 w-4 mr-2" />
                Export
              </Button>
              <Button variant="outline" size="sm">
                <Share2 className="h-4 w-4 mr-2" />
                Share
              </Button>
              <Button onClick={handleDeployToCourse} disabled={deploying}>
                {deploying && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                Deploy to Course
              </Button>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <div className="text-center">
              <div className="text-2xl font-bold">{courseOutline.modules.length}</div>
              <div className="text-sm text-muted-foreground">Modules</div>
            </div>
            <div className="text-center">
              <div className="text-2xl font-bold">{calculateTotalLessons()}</div>
              <div className="text-sm text-muted-foreground">Lessons</div>
            </div>
            <div className="text-center">
              <div className="text-2xl font-bold">{calculateTotalAssessments()}</div>
              <div className="text-sm text-muted-foreground">Assessments</div>
            </div>
            <div className="text-center">
              <div className="text-2xl font-bold">{calculateTotalHours()}h</div>
              <div className="text-sm text-muted-foreground">Est. Hours</div>
            </div>
          </div>
        </CardContent>
      </Card>

      <Tabs defaultValue="overview" className="w-full">
        <TabsList className="grid w-full grid-cols-4">
          <TabsTrigger value="overview">Overview</TabsTrigger>
          <TabsTrigger value="modules">Modules</TabsTrigger>
          <TabsTrigger value="objectives">Objectives</TabsTrigger>
          <TabsTrigger value="assessments">Assessments</TabsTrigger>
        </TabsList>

        <TabsContent value="overview" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center space-x-2">
                <Clock className="h-5 w-5" />
                <span>Course Timeline</span>
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                <div className="flex justify-between items-center">
                  <span>Total Duration</span>
                  <span className="font-semibold">{courseOutline.estimatedDurationWeeks} weeks</span>
                </div>
                <Progress value={(calculateTotalHours() / (courseOutline.estimatedDurationWeeks * 40)) * 100} />
                <div className="text-sm text-muted-foreground">
                  Estimated {calculateTotalHours()} hours over {courseOutline.estimatedDurationWeeks} weeks
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Generation Summary</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <h4 className="font-medium mb-2">Content Distribution</h4>
                  <div className="space-y-2 text-sm">
                    <div className="flex justify-between">
                      <span>Lectures</span>
                      <span>{courseOutline.modules.flatMap(m => m.lessons).filter(l => l.contentType === 'lecture').length}</span>
                    </div>
                    <div className="flex justify-between">
                      <span>Activities</span>
                      <span>{courseOutline.modules.flatMap(m => m.lessons).filter(l => l.contentType === 'activity').length}</span>
                    </div>
                    <div className="flex justify-between">
                      <span>Discussions</span>
                      <span>{courseOutline.modules.flatMap(m => m.lessons).filter(l => l.contentType === 'discussion').length}</span>
                    </div>
                  </div>
                </div>
                <div>
                  <h4 className="font-medium mb-2">Assessment Strategy</h4>
                  <div className="space-y-2 text-sm">
                    <div className="flex justify-between">
                      <span>Course Content Focus</span>
                      <span>{courseOutline.modules.flatMap(m => m.assessments).filter(a => a.contentFocus === 'course_content').length}</span>
                    </div>
                    <div className="flex justify-between">
                      <span>KB Supplemented</span>
                      <span>{courseOutline.modules.flatMap(m => m.assessments).filter(a => a.contentFocus === 'kb_supplemented').length}</span>
                    </div>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="modules" className="space-y-4">
          {courseOutline.modules.map((module, index) => (
            <Card key={module.id}>
              <CardHeader>
                <div className="flex items-start justify-between">
                  <div>
                    <CardTitle className="text-lg">
                      Module {module.order}: {module.title}
                    </CardTitle>
                    <CardDescription>{module.description}</CardDescription>
                  </div>
                  <Badge variant="outline">
                    {module.estimatedDurationWeeks} weeks
                  </Badge>
                </div>
              </CardHeader>
              <CardContent className="space-y-4">
                <div>
                  <h4 className="font-medium mb-2">Lessons ({module.lessons.length})</h4>
                  <div className="space-y-2">
                    {module.lessons.map((lesson) => (
                      <div key={lesson.id} className="flex items-center justify-between p-3 border rounded-lg">
                        <div className="flex items-center space-x-3">
                          {CONTENT_TYPE_ICONS[lesson.contentType]}
                          <div>
                            <div className="font-medium">{lesson.title}</div>
                            <div className="text-sm text-muted-foreground">{lesson.description}</div>
                          </div>
                        </div>
                        <div className="text-sm text-muted-foreground">
                          {lesson.estimatedDurationHours}h
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                {module.assessments.length > 0 && (
                  <div>
                    <div className="flex items-center justify-between mb-2">
                      <h4 className="font-medium">Assessments ({module.assessments.length})</h4>
                      {baseClassId && (
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => {
                            module.assessments.forEach(assessment => {
                              handleCreateAssessment(assessment, module.title);
                            });
                          }}
                          disabled={module.assessments.some(a => creatingAssessments.has(a.id))}
                          className="text-xs"
                        >
                          {module.assessments.some(a => creatingAssessments.has(a.id)) ? (
                            <Loader2 className="h-3 w-3 mr-1 animate-spin" />
                          ) : (
                            <Plus className="h-3 w-3 mr-1" />
                          )}
                          Create All
                        </Button>
                      )}
                    </div>
                    <div className="space-y-2">
                      {module.assessments.map((assessment) => (
                        <div key={assessment.id} className="flex items-center justify-between p-3 border rounded-lg">
                          <div className="flex-1">
                            <div className="font-medium">{assessment.title}</div>
                            <div className="text-sm text-muted-foreground">
                              {assessment.type} • {assessment.estimatedDurationMinutes} min • {assessment.masteryThreshold}% mastery
                            </div>
                          </div>
                          <div className="flex items-center space-x-2">
                            <Badge variant={assessment.contentFocus === 'course_content' ? 'default' : 'secondary'}>
                              {assessment.contentFocus === 'course_content' ? 'Course Focus' : 'KB Supplemented'}
                            </Badge>
                            <Badge variant="outline">{assessment.type}</Badge>
                            {baseClassId && (
                              <Button
                                variant="outline"
                                size="sm"
                                onClick={() => handleCreateAssessment(assessment, module.title)}
                                disabled={creatingAssessments.has(assessment.id)}
                              >
                                {creatingAssessments.has(assessment.id) ? (
                                  <Loader2 className="h-3 w-3 mr-1 animate-spin" />
                                ) : (
                                  <Sparkles className="h-3 w-3 mr-1" />
                                )}
                                Create
                              </Button>
                            )}
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>
          ))}
        </TabsContent>

        <TabsContent value="objectives" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center space-x-2">
                <Target className="h-5 w-5" />
                <span>Course Learning Objectives</span>
              </CardTitle>
            </CardHeader>
            <CardContent>
              <ul className="space-y-2">
                {courseOutline.learningObjectives.map((objective, index) => (
                  <li key={index} className="flex items-start space-x-2">
                    <CheckCircle2 className="h-4 w-4 text-green-500 mt-0.5 flex-shrink-0" />
                    <span>{objective}</span>
                  </li>
                ))}
              </ul>
            </CardContent>
          </Card>

          {courseOutline.modules.map((module) => (
            <Card key={module.id}>
              <CardHeader>
                <CardTitle className="text-lg">Module {module.order}: {module.title}</CardTitle>
              </CardHeader>
              <CardContent>
                <ul className="space-y-2">
                  {module.learningObjectives.map((objective, index) => (
                    <li key={index} className="flex items-start space-x-2">
                      <CheckCircle2 className="h-4 w-4 text-blue-500 mt-0.5 flex-shrink-0" />
                      <span>{objective}</span>
                    </li>
                  ))}
                </ul>
              </CardContent>
            </Card>
          ))}
        </TabsContent>

        <TabsContent value="assessments" className="space-y-4">
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle>Assessment Strategy Overview</CardTitle>
                  <CardDescription>
                    How assessments are designed to test mastery of course content
                  </CardDescription>
                </div>
                {baseClassId && calculateTotalAssessments() > 0 && (
                  <Button
                    variant="default"
                    onClick={() => {
                      courseOutline.modules.forEach(module => {
                        module.assessments.forEach(assessment => {
                          handleCreateAssessment(assessment, module.title);
                        });
                      });
                    }}
                    disabled={courseOutline.modules.some(m => 
                      m.assessments.some(a => creatingAssessments.has(a.id))
                    )}
                  >
                    {courseOutline.modules.some(m => 
                      m.assessments.some(a => creatingAssessments.has(a.id))
                    ) ? (
                      <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    ) : (
                      <Sparkles className="h-4 w-4 mr-2" />
                    )}
                    Create All Assessments
                  </Button>
                )}
              </div>
            </CardHeader>
            <CardContent>
              <Alert>
                <Target className="h-4 w-4" />
                <AlertDescription>
                  Assessments prioritize testing understanding of course content and practical application 
                  over knowledge base fact memorization to ensure true mastery.
                </AlertDescription>
              </Alert>
            </CardContent>
          </Card>

          {courseOutline.modules.map((module) => (
            module.assessments.length > 0 && (
              <Card key={module.id}>
                <CardHeader>
                  <div className="flex items-center justify-between">
                    <CardTitle className="text-lg">Module {module.order}: {module.title}</CardTitle>
                    {baseClassId && (
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => {
                          module.assessments.forEach(assessment => {
                            handleCreateAssessment(assessment, module.title);
                          });
                        }}
                        disabled={module.assessments.some(a => creatingAssessments.has(a.id))}
                      >
                        {module.assessments.some(a => creatingAssessments.has(a.id)) ? (
                          <Loader2 className="h-3 w-3 mr-1 animate-spin" />
                        ) : (
                          <Plus className="h-3 w-3 mr-1" />
                        )}
                        Create Module Assessments
                      </Button>
                    )}
                  </div>
                </CardHeader>
                <CardContent className="space-y-4">
                  {module.assessments.map((assessment) => (
                    <div key={assessment.id} className="border rounded-lg p-4 space-y-3">
                      <div className="flex items-center justify-between">
                        <h4 className="font-medium">{assessment.title}</h4>
                        <div className="flex items-center space-x-2">
                          <Badge variant={assessment.contentFocus === 'course_content' ? 'default' : 'secondary'}>
                            {assessment.contentFocus === 'course_content' ? 'Course Focus' : 'KB Supplemented'}
                          </Badge>
                          <Badge variant="outline">{assessment.type}</Badge>
                          {baseClassId && (
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => handleCreateAssessment(assessment, module.title)}
                              disabled={creatingAssessments.has(assessment.id)}
                            >
                              {creatingAssessments.has(assessment.id) ? (
                                <Loader2 className="h-3 w-3 mr-1 animate-spin" />
                              ) : (
                                <Sparkles className="h-3 w-3 mr-1" />
                              )}
                              Create Assessment
                            </Button>
                          )}
                        </div>
                      </div>
                      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-sm">
                        <div>
                          <span className="font-medium">Duration:</span> {assessment.estimatedDurationMinutes} minutes
                        </div>
                        <div>
                          <span className="font-medium">Mastery Threshold:</span> {assessment.masteryThreshold}%
                        </div>
                        <div>
                          <span className="font-medium">Objectives:</span> {assessment.learningObjectives.length}
                        </div>
                      </div>
                    </div>
                  ))}
                </CardContent>
              </Card>
            )
          ))}
        </TabsContent>
      </Tabs>
    </div>
  );
} 