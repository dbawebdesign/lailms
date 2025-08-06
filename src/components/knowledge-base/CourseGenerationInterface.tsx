'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Slider } from '@/components/ui/slider';
import { Switch } from '@/components/ui/switch';
import { Progress } from '@/components/ui/progress';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Separator } from '@/components/ui/separator';
import { triggerCelebration } from '@/components/ui/confetti';
import { RealTimeProgress } from '@/components/ui/real-time-progress';
import { PremiumGenerationModal } from '@/components/course-generation/PremiumGenerationModal';
import { 
  estimateCourseGenerationTime, 
  formatEstimatedTime, 
  getTimeEstimateExplanation,
  type CourseGenerationParams 
} from '@/lib/utils/courseGenerationEstimator';
import { 
  Loader2, 
  BookOpen, 
  Brain, 
  Lightbulb, 
  CheckCircle, 
  AlertCircle, 
  Clock,
  GraduationCap,
  Target,
  Settings,
  FileText,
  Users,
  Calendar,
  Layers,
  Plus,
  X,
  Sparkles,
  ArrowRight,
  Home,
  Info
} from 'lucide-react';

interface KnowledgeBaseAnalysis {
  totalDocuments: number;
  totalChunks: number;
  contentDepth: 'minimal' | 'moderate' | 'comprehensive';
  subjectCoverage: string[];
  recommendedGenerationMode: 'kb_only' | 'kb_priority' | 'kb_supplemented';
  analysisDetails: {
    contentQuality: 'low' | 'medium' | 'high';
    conceptCoverage: string[];
    knowledgeGaps: string[];
  };
}

interface GenerationMode {
  title: string;
  description: string;
  suitable: boolean;
}

interface CourseGenerationInterfaceProps {
  baseClassId: string;
  baseClassInfo?: {
    id: string;
    name: string;
    description: string;
    settings?: {
      course_metadata?: {
        subject?: string;
        learning_objectives?: string[];
        target_audience?: string;
      };
    };
  } | null;
  onCourseGenerated?: (courseOutlineId: string) => void;
}

const GENERATION_MODE_ICONS = {
  kb_only: <BookOpen className="h-5 w-5" />,
  kb_priority: <Brain className="h-5 w-5" />,
  kb_supplemented: <Lightbulb className="h-5 w-5" />
};

const GENERATION_MODE_DESCRIPTIONS = {
  kb_only: {
    pros: ['100% source fidelity', 'Verifiable content', 'Original context preserved'],
    cons: ['Limited scope', 'Potential gaps', 'Depends on source quality'],
    bestFor: 'Compliance training, specific skill courses, certification prep'
  },
  kb_priority: {
    pros: ['Source-driven content', 'Gap filling', 'Balanced approach'],
    cons: ['Some interpretation', 'Quality varies', 'Moderate expansion'],
    bestFor: 'Professional development, domain-specific training, guided learning'
  },
  kb_supplemented: {
    pros: ['Comprehensive coverage', 'Rich context', 'Complete curricula'],
    cons: ['Less source fidelity', 'Potential drift', 'General knowledge mix'],
    bestFor: 'Foundational courses, exploratory learning, broad topic coverage'
  }
};

export default function CourseGenerationInterface({ baseClassId, baseClassInfo, onCourseGenerated }: CourseGenerationInterfaceProps) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [showCelebration, setShowCelebration] = useState(false);
  const [redirecting, setRedirecting] = useState(false);
  const [analyzing, setAnalyzing] = useState(true);
  const [kbAnalysis, setKbAnalysis] = useState<KnowledgeBaseAnalysis | null>(null);
  const [generationModes, setGenerationModes] = useState<Record<string, GenerationMode>>({});
  const [selectedMode, setSelectedMode] = useState<string>('');
  const [title, setTitle] = useState(baseClassInfo?.name || '');
  const [description, setDescription] = useState(baseClassInfo?.description || '');
  const [estimatedWeeks, setEstimatedWeeks] = useState(12);
  const [academicLevel, setAcademicLevel] = useState<'kindergarten' | '1st-grade' | '2nd-grade' | '3rd-grade' | '4th-grade' | '5th-grade' | '6th-grade' | '7th-grade' | '8th-grade' | '9th-grade' | '10th-grade' | '11th-grade' | '12th-grade' | 'college' | 'graduate' | 'professional' | 'master'>('college');
  const [lessonDetailLevel, setLessonDetailLevel] = useState<'basic' | 'detailed' | 'comprehensive'>('detailed');
  const [includeAssessments, setIncludeAssessments] = useState(true);
  const [includeQuizzes, setIncludeQuizzes] = useState(true);
  const [includeFinalExam, setIncludeFinalExam] = useState(true);
  const [assessmentDifficulty, setAssessmentDifficulty] = useState<'easy' | 'medium' | 'hard'>('medium');
  const [questionsPerLesson, setQuestionsPerLesson] = useState([3]);
  const [questionsPerQuiz, setQuestionsPerQuiz] = useState([10]);
  const [questionsPerExam, setQuestionsPerExam] = useState([20]);
  const [lessonsPerWeek, setLessonsPerWeek] = useState([2]);
  const [targetAudience, setTargetAudience] = useState(baseClassInfo?.settings?.course_metadata?.target_audience || '');
  const [prerequisites, setPrerequisites] = useState('');
  const [learningObjectives, setLearningObjectives] = useState<string[]>(
    baseClassInfo?.settings?.course_metadata?.learning_objectives || []
  );
  const [userGuidance, setUserGuidance] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [generationJob, setGenerationJob] = useState<any>(null);
  const [showTimeEstimate, setShowTimeEstimate] = useState(false);
  const [showPremiumModal, setShowPremiumModal] = useState(false);

  const handleModalComplete = useCallback(() => {
    setShowPremiumModal(false);
    // Modal handles its own redirect to dashboard
  }, []);

  const loadKnowledgeBaseAnalysis = useCallback(async () => {
    try {
      setAnalyzing(true);
      const response = await fetch(`/api/course-generation/v2?baseClassId=${baseClassId}`);
      const data = await response.json();

      if (data.success) {
        setKbAnalysis(data.knowledgeBaseAnalysis);
        setGenerationModes(data.generationModes);
        setSelectedMode(data.recommendedMode);
      } else {
        setError(data.error || 'Failed to analyze knowledge base');
      }
    } catch (err) {
      setError('Failed to load knowledge base analysis');
    } finally {
      setAnalyzing(false);
    }
  }, [baseClassId]);

  // Calculate time estimate based on current settings
  const getTimeEstimate = useCallback(() => {
    if (!selectedMode || !kbAnalysis) return null;

    const params: CourseGenerationParams = {
      estimatedWeeks,
      lessonsPerWeek: lessonsPerWeek[0],
      includeAssessments,
      includeQuizzes,
      includeFinalExam,
      lessonDetailLevel,
      generationMode: selectedMode as any,
      documentCount: kbAnalysis.totalDocuments
    };

    return estimateCourseGenerationTime(params);
  }, [
    selectedMode, 
    estimatedWeeks, 
    lessonsPerWeek, 
    includeAssessments, 
    includeQuizzes, 
    includeFinalExam, 
    lessonDetailLevel, 
    kbAnalysis
  ]);

  const timeEstimate = getTimeEstimate();

  const returnToDashboard = () => {
    router.push('/teach?from=course-creation');
  };

  const onCourseGeneratedSafe = onCourseGenerated;
  const checkJobStatus = useCallback(async () => {
    if (!generationJob?.id) return;

    try {
      const response = await fetch(`/api/knowledge-base/generation-status/${generationJob.id}`);
      const data = await response.json();

      if (data.success) {
        setGenerationJob(data.job);
        
        if (data.job.status === 'completed') {
          if (data.courseOutline?.id) {
            // Trigger celebration animation
            setShowCelebration(true);
            triggerCelebration(() => {
              // After celebration, redirect to base class studio
              setRedirecting(true);
              setTimeout(() => {
                router.push(`/teach/base-classes/${baseClassId}`);
              }, 1000);
            });
            onCourseGeneratedSafe?.(data.courseOutline.id);
          }
        } else if (data.job.status === 'failed') {
          setError(data.job.error || 'Course generation failed');
          setGenerationJob(null);
        }
      }
    } catch (err) {
      console.error('Failed to check job status:', err);
    }
  }, [generationJob, onCourseGeneratedSafe]);

  useEffect(() => {
    loadKnowledgeBaseAnalysis();
  }, [loadKnowledgeBaseAnalysis]);

  useEffect(() => {
    let interval: NodeJS.Timeout | null = null;
    
    if (generationJob && (generationJob.status === 'processing' || generationJob.status === 'queued')) {
      interval = setInterval(checkJobStatus, 5000);
    }
    
    return () => {
      if (interval) {
        clearInterval(interval);
      }
    };
  }, [generationJob, checkJobStatus]);

  const generateCourse = async () => {
    if (!title.trim()) {
      setError('Course title is required');
      return;
    }

    try {
      setLoading(true);
      setError(null);

      const requestData = {
        baseClassId,
        title: title.trim(),
        description: description.trim(),
        generationMode: selectedMode,
        estimatedDurationWeeks: estimatedWeeks,
        academicLevel,
        lessonDetailLevel,
        targetAudience: targetAudience.trim(),
        prerequisites: prerequisites.trim(),
        lessonsPerWeek: lessonsPerWeek[0],
        learningObjectives: learningObjectives.filter(obj => obj.trim().length > 0),
        assessmentSettings: {
          includeAssessments,
          includeQuizzes,
          includeFinalExam,
          assessmentDifficulty,
          questionsPerLesson: questionsPerLesson[0],
          questionsPerQuiz: questionsPerQuiz[0],
          questionsPerExam: questionsPerExam[0]
        },
        userGuidance: userGuidance.trim(),
        estimatedMinutes: timeEstimate?.estimatedMinutes
      };

      const response = await fetch('/api/course-generation/v2', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(requestData),
      });

      const data = await response.json();

      if (data.success) {
        setGenerationJob({
          id: data.jobId,
          status: data.status,
          progress: 0,
          estimatedMinutes: timeEstimate?.estimatedMinutes,
          baseClassId: baseClassId
        });
        // Show the premium generation modal
        setShowPremiumModal(true);
      } else {
        setError(data.error || 'Failed to start course generation');
      }
    } catch (err) {
      setError('Failed to generate course');
    } finally {
      setLoading(false);
    }
  };

  if (analyzing) {
    return (
      <div className="flex flex-col items-center justify-center h-64">
        <Loader2 className="h-8 w-8 animate-spin text-gray-500" />
        <p className="mt-4 text-lg text-gray-600">Analyzing Knowledge Base...</p>
        <p className="text-sm text-gray-500">This may take a moment.</p>
      </div>
    );
  }

  // Progress is now handled by the modal - no need for separate progress UI

  // Completion is now handled by the modal with redirect

  return (
    <div className="w-full space-y-6">
      {/* Knowledge Base Analysis Summary */}
      {kbAnalysis && (
        <Card>
          <CardHeader>
            <CardTitle>Knowledge Base Analysis</CardTitle>
            <CardDescription>
              Summary of your uploaded content and recommended generation approach
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="text-center">
                <div className="text-2xl font-bold">{kbAnalysis.totalDocuments}</div>
                <div className="text-sm text-muted-foreground">Documents</div>
              </div>
              <div className="text-center">
                <div className="text-2xl font-bold">{kbAnalysis.totalChunks}</div>
                <div className="text-sm text-muted-foreground">Content Chunks</div>
              </div>
              <div className="text-center">
                <Badge variant={
                  kbAnalysis.contentDepth === 'comprehensive' ? 'default' : 
                  kbAnalysis.contentDepth === 'moderate' ? 'secondary' : 'outline'
                }>
                  {kbAnalysis.contentDepth} depth
                </Badge>
              </div>
            </div>
            
            {kbAnalysis.subjectCoverage.length > 0 && (
              <div>
                <Label className="text-sm font-medium">Subject Coverage</Label>
                <div className="flex flex-wrap gap-2 mt-2">
                  {kbAnalysis.subjectCoverage.map((subject, index) => (
                    <Badge key={index} variant="outline">{subject}</Badge>
                  ))}
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* Course Details Form */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center space-x-2">
            <Settings className="h-5 w-5" />
            <span>Course Configuration</span>
          </CardTitle>
          <CardDescription>
            Configure your course settings to match your educational goals
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* Basic Information */}
          <div className="space-y-4">
            <h4 className="text-sm font-medium flex items-center space-x-2">
              <FileText className="h-4 w-4" />
              <span>Basic Information</span>
            </h4>
            
            <div className="grid grid-cols-1 gap-4">
              <div className="space-y-2">
                <Label htmlFor="title">Course Title *</Label>
                <Input
                  id="title"
                  placeholder="Enter a descriptive course title"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="description">Course Description</Label>
                <Textarea
                  id="description"
                  placeholder="Describe what this course covers and its learning objectives"
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  rows={3}
                />
              </div>
            </div>
          </div>

          <Separator />

          {/* Learning Objectives */}
          <div className="space-y-4">
            <h4 className="text-sm font-medium flex items-center space-x-2">
              <Target className="h-4 w-4" />
              <span>Learning Objectives</span>
            </h4>
            
            <div className="space-y-3">
              {learningObjectives.map((objective, index) => (
                <div key={index} className="flex items-start space-x-2">
                  <Textarea
                    value={objective}
                    onChange={(e) => {
                      const newObjectives = [...learningObjectives];
                      newObjectives[index] = e.target.value;
                      setLearningObjectives(newObjectives);
                    }}
                    placeholder={`Learning objective ${index + 1}`}
                    className="flex-1 min-h-[60px]"
                    rows={2}
                  />
                  <Button
                    variant="outline"
                    size="icon"
                    onClick={() => {
                      const newObjectives = learningObjectives.filter((_, i) => i !== index);
                      setLearningObjectives(newObjectives);
                    }}
                    className="mt-1"
                  >
                    <X className="h-4 w-4" />
                  </Button>
                </div>
              ))}
              
              <Button
                variant="outline"
                size="sm"
                onClick={() => setLearningObjectives([...learningObjectives, ''])}
                className="w-full"
              >
                <Plus className="h-4 w-4 mr-2" />
                Add Learning Objective
              </Button>
            </div>
          </div>

          <Separator />

          {/* Academic Settings */}
          <div className="space-y-4">
            <h4 className="text-sm font-medium flex items-center space-x-2">
              <GraduationCap className="h-4 w-4" />
              <span>Academic Settings</span>
            </h4>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="academic-level">Academic Level</Label>
                <Select value={academicLevel} onValueChange={(value: 'kindergarten' | '1st-grade' | '2nd-grade' | '3rd-grade' | '4th-grade' | '5th-grade' | '6th-grade' | '7th-grade' | '8th-grade' | '9th-grade' | '10th-grade' | '11th-grade' | '12th-grade' | 'college' | 'graduate' | 'professional' | 'master') => setAcademicLevel(value)}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select academic level" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="kindergarten">
                      <div className="flex items-center space-x-2">
                        <div className="w-2 h-2 bg-green-500 rounded-full"></div>
                        <span>Kindergarten</span>
                      </div>
                    </SelectItem>
                    <SelectItem value="1st-grade">
                      <div className="flex items-center space-x-2">
                        <div className="w-2 h-2 bg-green-500 rounded-full"></div>
                        <span>1st Grade</span>
                      </div>
                    </SelectItem>
                    <SelectItem value="2nd-grade">
                      <div className="flex items-center space-x-2">
                        <div className="w-2 h-2 bg-green-500 rounded-full"></div>
                        <span>2nd Grade</span>
                      </div>
                    </SelectItem>
                    <SelectItem value="3rd-grade">
                      <div className="flex items-center space-x-2">
                        <div className="w-2 h-2 bg-green-500 rounded-full"></div>
                        <span>3rd Grade</span>
                      </div>
                    </SelectItem>
                    <SelectItem value="4th-grade">
                      <div className="flex items-center space-x-2">
                        <div className="w-2 h-2 bg-green-500 rounded-full"></div>
                        <span>4th Grade</span>
                      </div>
                    </SelectItem>
                    <SelectItem value="5th-grade">
                      <div className="flex items-center space-x-2">
                        <div className="w-2 h-2 bg-green-500 rounded-full"></div>
                        <span>5th Grade</span>
                      </div>
                    </SelectItem>
                    <SelectItem value="6th-grade">
                      <div className="flex items-center space-x-2">
                        <div className="w-2 h-2 bg-green-500 rounded-full"></div>
                        <span>6th Grade</span>
                      </div>
                    </SelectItem>
                    <SelectItem value="7th-grade">
                      <div className="flex items-center space-x-2">
                        <div className="w-2 h-2 bg-green-500 rounded-full"></div>
                        <span>7th Grade</span>
                      </div>
                    </SelectItem>
                    <SelectItem value="8th-grade">
                      <div className="flex items-center space-x-2">
                        <div className="w-2 h-2 bg-green-500 rounded-full"></div>
                        <span>8th Grade</span>
                      </div>
                    </SelectItem>
                    <SelectItem value="9th-grade">
                      <div className="flex items-center space-x-2">
                        <div className="w-2 h-2 bg-green-500 rounded-full"></div>
                        <span>9th Grade</span>
                      </div>
                    </SelectItem>
                    <SelectItem value="10th-grade">
                      <div className="flex items-center space-x-2">
                        <div className="w-2 h-2 bg-green-500 rounded-full"></div>
                        <span>10th Grade</span>
                      </div>
                    </SelectItem>
                    <SelectItem value="11th-grade">
                      <div className="flex items-center space-x-2">
                        <div className="w-2 h-2 bg-green-500 rounded-full"></div>
                        <span>11th Grade</span>
                      </div>
                    </SelectItem>
                    <SelectItem value="12th-grade">
                      <div className="flex items-center space-x-2">
                        <div className="w-2 h-2 bg-green-500 rounded-full"></div>
                        <span>12th Grade</span>
                      </div>
                    </SelectItem>
                    <SelectItem value="college">
                      <div className="flex items-center space-x-2">
                        <div className="w-2 h-2 bg-blue-500 rounded-full"></div>
                        <span>College - Undergraduate Level</span>
                      </div>
                    </SelectItem>
                    <SelectItem value="graduate">
                      <div className="flex items-center space-x-2">
                        <div className="w-2 h-2 bg-purple-500 rounded-full"></div>
                        <span>Graduate - Master's Level</span>
                      </div>
                    </SelectItem>
                    <SelectItem value="professional">
                      <div className="flex items-center space-x-2">
                        <div className="w-2 h-2 bg-orange-500 rounded-full"></div>
                        <span>Professional - Working Professionals</span>
                      </div>
                    </SelectItem>
                    <SelectItem value="master">
                      <div className="flex items-center space-x-2">
                        <div className="w-2 h-2 bg-red-500 rounded-full"></div>
                        <span>Master - Expert/Advanced Practice</span>
                      </div>
                    </SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label htmlFor="lesson-detail">Lesson Detail Level</Label>
                <Select value={lessonDetailLevel} onValueChange={(value: 'basic' | 'detailed' | 'comprehensive') => setLessonDetailLevel(value)}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select detail level" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="basic">
                      <div className="flex items-center space-x-2">
                        <Layers className="h-4 w-4" />
                        <span>Basic - Essential concepts (2-3 pages/section)</span>
                      </div>
                    </SelectItem>
                    <SelectItem value="detailed">
                      <div className="flex items-center space-x-2">
                        <Layers className="h-4 w-4" />
                        <span>Detailed - Thorough coverage (4-6 pages/section)</span>
                      </div>
                    </SelectItem>
                    <SelectItem value="comprehensive">
                      <div className="flex items-center space-x-2">
                        <Layers className="h-4 w-4" />
                        <span>Comprehensive - Deep dive (8-12 pages/section)</span>
                      </div>
                    </SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="target-audience">Target Audience</Label>
                <Input
                  id="target-audience"
                  placeholder="e.g., Software developers, Medical professionals"
                  value={targetAudience}
                  onChange={(e) => setTargetAudience(e.target.value)}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="prerequisites">Prerequisites</Label>
                <Input
                  id="prerequisites"
                  placeholder="e.g., Basic programming knowledge"
                  value={prerequisites}
                  onChange={(e) => setPrerequisites(e.target.value)}
                />
              </div>
            </div>
          </div>

          <Separator />

          {/* Course Structure */}
          <div className="space-y-4">
            <h4 className="text-sm font-medium flex items-center space-x-2">
              <Calendar className="h-4 w-4" />
              <span>Course Structure</span>
            </h4>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="weeks">Course Duration (weeks)</Label>
                <Input
                  id="weeks"
                  type="number"
                  min="1"
                  max="52"
                  value={estimatedWeeks}
                  onChange={(e) => setEstimatedWeeks(parseInt(e.target.value) || 12)}
                />
                <p className="text-xs text-muted-foreground">
                  Recommended: 8-16 weeks for comprehensive courses
                </p>
              </div>

              <div className="space-y-2">
                <Label>Lessons per Week: {lessonsPerWeek[0]}</Label>
                <Slider
                  value={lessonsPerWeek}
                  onValueChange={setLessonsPerWeek}
                  max={7}
                  min={1}
                  step={1}
                  className="w-full"
                />
                <p className="text-xs text-muted-foreground">
                  Total lessons: ~{estimatedWeeks * lessonsPerWeek[0]}
                </p>
              </div>
            </div>
          </div>

          <Separator />

          {/* Assessment Settings */}
          <div className="space-y-4">
            <h4 className="text-sm font-medium flex items-center space-x-2">
              <Target className="h-4 w-4" />
              <span>Assessment & Progress Tracking</span>
            </h4>
            
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <div className="space-y-0.5">
                  <Label className="text-sm font-medium">Lesson Assessments</Label>
                  <p className="text-xs text-muted-foreground">
                    Include knowledge checks and practice questions within each lesson
                  </p>
                </div>
                <Switch
                  checked={includeAssessments}
                  onCheckedChange={setIncludeAssessments}
                />
              </div>

              {includeAssessments && (
                <div className="ml-4 space-y-2">
                  <Label>Questions per Lesson: {questionsPerLesson[0]}</Label>
                  <Slider
                    value={questionsPerLesson}
                    onValueChange={setQuestionsPerLesson}
                    max={10}
                    min={1}
                    step={1}
                    className="w-full"
                  />
                </div>
              )}

              <div className="flex items-center justify-between">
                <div className="space-y-0.5">
                  <Label className="text-sm font-medium">Path Quizzes</Label>
                  <p className="text-xs text-muted-foreground">
                    Add comprehensive quizzes at the end of each learning path/module
                  </p>
                </div>
                <Switch
                  checked={includeQuizzes}
                  onCheckedChange={setIncludeQuizzes}
                />
              </div>

              {includeQuizzes && (
                <div className="ml-4 space-y-2">
                  <Label>Questions per Quiz: {questionsPerQuiz[0]}</Label>
                  <Slider
                    value={questionsPerQuiz}
                    onValueChange={setQuestionsPerQuiz}
                    max={25}
                    min={5}
                    step={1}
                    className="w-full"
                  />
                </div>
              )}

              <div className="flex items-center justify-between">
                <div className="space-y-0.5">
                  <Label className="text-sm font-medium">Class Exams</Label>
                  <p className="text-xs text-muted-foreground">
                    Include comprehensive final exams covering all course content
                  </p>
                </div>
                <Switch
                  checked={includeFinalExam}
                  onCheckedChange={setIncludeFinalExam}
                />
              </div>

              {includeFinalExam && (
                <div className="ml-4 space-y-2">
                  <Label>Questions per Exam: {questionsPerExam[0]}</Label>
                  <Slider
                    value={questionsPerExam}
                    onValueChange={setQuestionsPerExam}
                    max={50}
                    min={10}
                    step={2}
                    className="w-full"
                  />
                </div>
              )}

              {(includeAssessments || includeQuizzes || includeFinalExam) && (
                <div className="space-y-2">
                  <Label htmlFor="assessment-difficulty">Assessment Difficulty</Label>
                  <Select value={assessmentDifficulty} onValueChange={(value: 'easy' | 'medium' | 'hard') => setAssessmentDifficulty(value)}>
                    <SelectTrigger>
                      <SelectValue placeholder="Select difficulty level" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="easy">
                        <div className="flex items-center space-x-2">
                          <div className="w-2 h-2 bg-green-500 rounded-full"></div>
                          <span>Easy - Basic recall and understanding</span>
                        </div>
                      </SelectItem>
                      <SelectItem value="medium">
                        <div className="flex items-center space-x-2">
                          <div className="w-2 h-2 bg-blue-500 rounded-full"></div>
                          <span>Medium - Application and analysis</span>
                        </div>
                      </SelectItem>
                      <SelectItem value="hard">
                        <div className="flex items-center space-x-2">
                          <div className="w-2 h-2 bg-purple-500 rounded-full"></div>
                          <span>Hard - Synthesis and evaluation</span>
                        </div>
                      </SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              )}
            </div>
          </div>

          <Separator />

          {/* Additional Guidance */}
          <div className="space-y-4">
            <h4 className="text-sm font-medium flex items-center space-x-2">
              <Brain className="h-4 w-4" />
              <span>Additional Guidance</span>
            </h4>
            
            <div className="space-y-2">
              <Label htmlFor="guidance">Special Instructions (Optional)</Label>
              <Textarea
                id="guidance"
                placeholder="Any specific teaching approaches, focus areas, constraints, or special requirements..."
                value={userGuidance}
                onChange={(e) => setUserGuidance(e.target.value)}
                rows={3}
              />
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Generation Mode Selection */}
      <Card>
        <CardHeader>
          <CardTitle>Generation Mode</CardTitle>
          <CardDescription>
            Choose how to use your knowledge base content
          </CardDescription>
        </CardHeader>
        <CardContent>
          <RadioGroup value={selectedMode} onValueChange={setSelectedMode}>
            {Object.entries(generationModes).map(([mode, config]) => (
              <div key={mode} className="space-y-3">
                <div className="flex items-center space-x-2">
                  <RadioGroupItem value={mode} id={mode} disabled={!config.suitable} />
                  <Label 
                    htmlFor={mode} 
                    className={`flex items-center space-x-2 cursor-pointer ${!config.suitable ? 'opacity-50' : ''}`}
                  >
                    {GENERATION_MODE_ICONS[mode as keyof typeof GENERATION_MODE_ICONS]}
                    <span className="font-medium">{config.title}</span>
                    {mode === kbAnalysis?.recommendedGenerationMode && (
                      <Badge variant="default" className="text-xs">Recommended</Badge>
                    )}
                    {!config.suitable && (
                      <Badge variant="outline" className="text-xs">Limited Content</Badge>
                    )}
                  </Label>
                </div>
                <div className="ml-6 space-y-2">
                  <p className="text-sm text-muted-foreground">{config.description}</p>
                  {GENERATION_MODE_DESCRIPTIONS[mode as keyof typeof GENERATION_MODE_DESCRIPTIONS] && (
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-xs">
                      <div>
                        <div className="font-medium text-green-600">Pros:</div>
                        <ul className="list-disc list-inside space-y-1">
                          {GENERATION_MODE_DESCRIPTIONS[mode as keyof typeof GENERATION_MODE_DESCRIPTIONS].pros.map((pro, index) => (
                            <li key={index}>{pro}</li>
                          ))}
                        </ul>
                      </div>
                      <div>
                        <div className="font-medium text-amber-600">Considerations:</div>
                        <ul className="list-disc list-inside space-y-1">
                          {GENERATION_MODE_DESCRIPTIONS[mode as keyof typeof GENERATION_MODE_DESCRIPTIONS].cons.map((con, index) => (
                            <li key={index}>{con}</li>
                          ))}
                        </ul>
                      </div>
                      <div>
                        <div className="font-medium text-blue-600">Best For:</div>
                        <p>{GENERATION_MODE_DESCRIPTIONS[mode as keyof typeof GENERATION_MODE_DESCRIPTIONS].bestFor}</p>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            ))}
          </RadioGroup>
        </CardContent>
      </Card>

      {/* Time Estimate */}
      {timeEstimate && selectedMode && (
        <Card className="border-blue-200 bg-blue-50/50 dark:bg-blue-950/20 dark:border-blue-800">
          <CardContent className="p-4">
            <div className="flex items-start justify-between">
              <div className="flex items-center space-x-2">
                <Clock className="h-5 w-5 text-blue-600" />
                <div>
                  <h4 className="font-medium text-sm">Estimated Generation Time</h4>
                  <p className="text-2xl font-bold text-blue-700 dark:text-blue-400">
                    {formatEstimatedTime(timeEstimate.estimatedMinutes)}
                  </p>
                  <p className="text-xs text-muted-foreground mt-1">
                    {getTimeEstimateExplanation({
                      estimatedWeeks,
                      lessonsPerWeek: lessonsPerWeek[0],
                      includeAssessments,
                      includeQuizzes,
                      includeFinalExam,
                      lessonDetailLevel,
                      generationMode: selectedMode as any,
                      documentCount: kbAnalysis?.totalDocuments
                    })}
                  </p>
                </div>
              </div>
              <Button
                variant="outline"
                size="sm"
                onClick={() => setShowTimeEstimate(!showTimeEstimate)}
                className="text-xs"
              >
                <Info className="h-3 w-3 mr-1" />
                {showTimeEstimate ? 'Hide' : 'Show'} Details
              </Button>
            </div>
            
            {showTimeEstimate && (
              <div className="mt-4 pt-4 border-t border-blue-200 dark:border-blue-800">
                <h5 className="font-medium text-sm mb-2">Time Breakdown:</h5>
                <div className="grid grid-cols-2 gap-2 text-xs">
                  <div>Knowledge Base Analysis: {formatEstimatedTime(timeEstimate.taskBreakdown.kbAnalysis)}</div>
                  <div>Outline Generation: {formatEstimatedTime(timeEstimate.taskBreakdown.outlineGeneration)}</div>
                  <div>Path Creation: {formatEstimatedTime(timeEstimate.taskBreakdown.pathCreation)}</div>
                  <div>Lesson Generation: {formatEstimatedTime(timeEstimate.taskBreakdown.lessonGeneration)}</div>
                  {timeEstimate.taskBreakdown.assessmentCreation > 0 && (
                    <div className="col-span-2">Assessment Creation: {formatEstimatedTime(timeEstimate.taskBreakdown.assessmentCreation)}</div>
                  )}
                </div>
                <div className="mt-2 text-xs text-muted-foreground">
                  Total tasks to complete: {timeEstimate.totalTasks}
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* Error Display */}
      {error && (
        <Alert variant="destructive">
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      {/* Generate Button */}
      <div className="flex justify-end">
        <Button 
          onClick={generateCourse} 
          disabled={loading || !title.trim() || !selectedMode}
          className="px-8"
        >
          {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
          Generate Course
        </Button>
      </div>

      {/* Course Generation Modal */}
            <PremiumGenerationModal 
        isOpen={showPremiumModal}
        jobId={generationJob?.id}
        baseClassId={baseClassId}
        onClose={handleModalComplete}
      />
    </div>
  );
} 