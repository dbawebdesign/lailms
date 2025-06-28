"use client";

import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { Slider } from '@/components/ui/slider';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Separator } from '@/components/ui/separator';
import { 
  BookOpen, 
  Target, 
  Clock, 
  Users, 
  CheckCircle, 
  AlertCircle,
  Info,
  Sparkles,
  Settings,
  GraduationCap
} from 'lucide-react';

interface EnhancedCourseGenerationMessageProps {
  baseClassId: string;
  initialTitle?: string;
  initialDescription?: string;
  generationModes?: Record<string, GenerationMode>;
  recommendedMode?: string;
  onGenerateCourse: (params: CourseGenerationParams) => void;
  isLoading?: boolean;
}

interface GenerationMode {
  title: string;
  description: string;
  suitable: boolean;
}

interface CourseGenerationParams {
  title: string;
  description: string;
  generationMode: string;
  estimatedDurationWeeks: number;
  academicLevel: string;
  lessonDetailLevel: string;
  targetAudience: string;
  prerequisites: string;
  lessonsPerWeek: number;
  learningObjectives: string[];
  assessmentSettings: {
    includeAssessments: boolean;
    includeQuizzes: boolean;
    includeFinalExam: boolean;
    assessmentDifficulty: string;
    questionsPerLesson: number;
    questionsPerQuiz: number;
    questionsPerExam: number;
  };
  userGuidance: string;
}

export default function EnhancedCourseGenerationMessage({ 
  baseClassId,
  initialTitle = '',
  initialDescription = '',
  generationModes = {},
  recommendedMode = 'kb_supplemented',
  onGenerateCourse,
  isLoading = false 
}: EnhancedCourseGenerationMessageProps) {
  const [title, setTitle] = useState(initialTitle);
  const [description, setDescription] = useState(initialDescription);
  const [selectedMode, setSelectedMode] = useState(recommendedMode);
  const [estimatedWeeks, setEstimatedWeeks] = useState([12]);
  const [academicLevel, setAcademicLevel] = useState('college');
  const [lessonDetailLevel, setLessonDetailLevel] = useState('detailed');
  const [targetAudience, setTargetAudience] = useState('');
  const [prerequisites, setPrerequisites] = useState('');
  const [lessonsPerWeek, setLessonsPerWeek] = useState([2]);
  const [learningObjectives, setLearningObjectives] = useState<string[]>(['']);
  const [includeAssessments, setIncludeAssessments] = useState(true);
  const [includeQuizzes, setIncludeQuizzes] = useState(true);
  const [includeFinalExam, setIncludeFinalExam] = useState(true);
  const [assessmentDifficulty, setAssessmentDifficulty] = useState('medium');
  const [questionsPerLesson, setQuestionsPerLesson] = useState([3]);
  const [questionsPerQuiz, setQuestionsPerQuiz] = useState([10]);
  const [questionsPerExam, setQuestionsPerExam] = useState([20]);
  const [userGuidance, setUserGuidance] = useState('');
  const [error, setError] = useState<string | null>(null);

  const addLearningObjective = () => {
    setLearningObjectives([...learningObjectives, '']);
  };

  const updateLearningObjective = (index: number, value: string) => {
    const newObjectives = [...learningObjectives];
    newObjectives[index] = value;
    setLearningObjectives(newObjectives);
  };

  const removeLearningObjective = (index: number) => {
    const newObjectives = learningObjectives.filter((_, i) => i !== index);
    setLearningObjectives(newObjectives.length === 0 ? [''] : newObjectives);
  };

  const handleGenerate = () => {
    if (!title.trim()) {
      setError('Course title is required');
      return;
    }

    setError(null);
    
    const params: CourseGenerationParams = {
      title: title.trim(),
      description: description.trim(),
      generationMode: selectedMode,
      estimatedDurationWeeks: estimatedWeeks[0],
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
      userGuidance: userGuidance.trim()
    };

    onGenerateCourse(params);
  };

  return (
    <Card className="w-full">
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-2 text-sm">
          <BookOpen className="h-4 w-4" />
          Enhanced Course Generation
        </CardTitle>
        <CardDescription className="text-xs">
          Configure your course parameters for AI-powered generation.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4 pt-0">
        {/* Generation Mode Selection - Compact */}
        {Object.keys(generationModes).length > 0 && (
          <div className="space-y-2">
            <Label className="text-xs font-medium">Generation Mode</Label>
            <Select value={selectedMode} onValueChange={setSelectedMode}>
              <SelectTrigger className="h-8 text-xs">
                <SelectValue placeholder="Select mode" />
              </SelectTrigger>
              <SelectContent>
                {Object.entries(generationModes).map(([key, mode]) => (
                  <SelectItem key={key} value={key}>
                    <div className="flex items-center space-x-1">
                      <div className={`w-1.5 h-1.5 rounded-full ${mode.suitable ? 'bg-green-500' : 'bg-yellow-500'}`}></div>
                      <span className="text-xs">{mode.title}</span>
                    </div>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        )}

        {/* Essential Course Information - Compact */}
        <div className="space-y-3">
          <h3 className="text-sm font-medium flex items-center gap-1">
            <Target className="h-3 w-3" />
            Course Info
          </h3>
          
          <div className="space-y-2">
            <div>
              <Label htmlFor="title" className="text-xs">Course Title *</Label>
              <Input
                id="title"
                placeholder="e.g., 6th Grade World History"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                className="h-8 text-xs"
              />
            </div>

            <div>
              <Label htmlFor="academic-level" className="text-xs">Academic Level</Label>
              <Select value={academicLevel} onValueChange={setAcademicLevel}>
                <SelectTrigger className="h-8 text-xs">
                  <SelectValue placeholder="Select level" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="6th-grade">6th Grade</SelectItem>
                  <SelectItem value="7th-grade">7th Grade</SelectItem>
                  <SelectItem value="8th-grade">8th Grade</SelectItem>
                  <SelectItem value="9th-grade">9th Grade</SelectItem>
                  <SelectItem value="10th-grade">10th Grade</SelectItem>
                  <SelectItem value="11th-grade">11th Grade</SelectItem>
                  <SelectItem value="12th-grade">12th Grade</SelectItem>
                  <SelectItem value="college">College</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div>
              <Label htmlFor="description" className="text-xs">Description</Label>
              <Textarea
                id="description"
                placeholder="Brief course description..."
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                rows={2}
                className="text-xs"
              />
            </div>
          </div>
        </div>

        {/* Course Structure - Compact */}
        <div className="space-y-3">
          <h3 className="text-sm font-medium flex items-center gap-1">
            <Clock className="h-3 w-3" />
            Structure
          </h3>
          
          <div className="space-y-2">
            <div>
              <Label className="text-xs">Duration: {estimatedWeeks[0]} weeks</Label>
              <Slider
                value={estimatedWeeks}
                onValueChange={setEstimatedWeeks}
                max={52}
                min={1}
                step={1}
                className="w-full"
              />
            </div>

            <div>
              <Label className="text-xs">Lessons/Week: {lessonsPerWeek[0]}</Label>
              <Slider
                value={lessonsPerWeek}
                onValueChange={setLessonsPerWeek}
                max={7}
                min={1}
                step={1}
                className="w-full"
              />
            </div>

            <div>
              <Label htmlFor="detail-level" className="text-xs">Detail Level</Label>
              <Select value={lessonDetailLevel} onValueChange={setLessonDetailLevel}>
                <SelectTrigger className="h-8 text-xs">
                  <SelectValue placeholder="Select detail" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="basic">Basic</SelectItem>
                  <SelectItem value="detailed">Detailed</SelectItem>
                  <SelectItem value="comprehensive">Comprehensive</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
        </div>

        {/* Assessment Settings - Compact */}
        <div className="space-y-2">
          <h3 className="text-sm font-medium flex items-center gap-1">
            <CheckCircle className="h-3 w-3" />
            Assessments
          </h3>
          
          <div className="flex flex-wrap gap-2 text-xs">
            <div className="flex items-center space-x-1">
              <Switch
                checked={includeAssessments}
                onCheckedChange={setIncludeAssessments}
              />
              <Label className="text-xs">Lessons</Label>
            </div>
            
            <div className="flex items-center space-x-1">
              <Switch
                checked={includeQuizzes}
                onCheckedChange={setIncludeQuizzes}
              />
              <Label className="text-xs">Quizzes</Label>
            </div>
            
            <div className="flex items-center space-x-1">
              <Switch
                checked={includeFinalExam}
                onCheckedChange={setIncludeFinalExam}
              />
              <Label className="text-xs">Final Exam</Label>
            </div>
          </div>
        </div>

        {/* Error Display */}
        {error && (
          <Alert variant="destructive" className="py-2">
            <AlertCircle className="h-3 w-3" />
            <AlertDescription className="text-xs">{error}</AlertDescription>
          </Alert>
        )}

        {/* Compact Info */}
        <div className="text-[10px] text-muted-foreground bg-muted/50 rounded p-2">
          🚀 Enhanced generation creates comprehensive course with detailed lessons and assessments.
        </div>

        {/* Generate Button - Compact */}
        <Button 
          onClick={handleGenerate} 
          disabled={isLoading || !title.trim()}
          className="w-full h-8 text-xs"
          size="sm"
        >
          {isLoading ? (
            <>
              <Sparkles className="mr-1 h-3 w-3 animate-pulse" />
              Generating...
            </>
          ) : (
            <>
              <Sparkles className="mr-1 h-3 w-3" />
              Generate Course
            </>
          )}
        </Button>
      </CardContent>
    </Card>
  );
} 