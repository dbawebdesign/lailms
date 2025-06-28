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
    <Card className="w-full max-w-4xl">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <BookOpen className="h-5 w-5" />
          Enhanced Course Generation
        </CardTitle>
        <CardDescription>
          Configure your course parameters for AI-powered generation with detailed customization options.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Generation Mode Selection */}
        {Object.keys(generationModes).length > 0 && (
          <div className="space-y-3">
            <Label className="text-sm font-medium">Generation Mode</Label>
            <Select value={selectedMode} onValueChange={setSelectedMode}>
              <SelectTrigger>
                <SelectValue placeholder="Select generation mode" />
              </SelectTrigger>
              <SelectContent>
                {Object.entries(generationModes).map(([key, mode]) => (
                  <SelectItem key={key} value={key}>
                    <div className="flex items-center space-x-2">
                      <div className={`w-2 h-2 rounded-full ${mode.suitable ? 'bg-green-500' : 'bg-yellow-500'}`}></div>
                      <div>
                        <div className="font-medium">{mode.title}</div>
                        <div className="text-xs text-muted-foreground">{mode.description}</div>
                      </div>
                    </div>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        )}

        <Separator />

        {/* Basic Course Information */}
        <div className="space-y-4">
          <h3 className="text-lg font-medium flex items-center gap-2">
            <Target className="h-4 w-4" />
            Course Information
          </h3>
          
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="title">Course Title *</Label>
              <Input
                id="title"
                placeholder="e.g., Introduction to Machine Learning"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="academic-level">Academic Level</Label>
              <Select value={academicLevel} onValueChange={setAcademicLevel}>
                <SelectTrigger>
                  <SelectValue placeholder="Select academic level" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="kindergarten">Kindergarten</SelectItem>
                  <SelectItem value="1st-grade">1st Grade</SelectItem>
                  <SelectItem value="2nd-grade">2nd Grade</SelectItem>
                  <SelectItem value="3rd-grade">3rd Grade</SelectItem>
                  <SelectItem value="4th-grade">4th Grade</SelectItem>
                  <SelectItem value="5th-grade">5th Grade</SelectItem>
                  <SelectItem value="6th-grade">6th Grade</SelectItem>
                  <SelectItem value="7th-grade">7th Grade</SelectItem>
                  <SelectItem value="8th-grade">8th Grade</SelectItem>
                  <SelectItem value="9th-grade">9th Grade</SelectItem>
                  <SelectItem value="10th-grade">10th Grade</SelectItem>
                  <SelectItem value="11th-grade">11th Grade</SelectItem>
                  <SelectItem value="12th-grade">12th Grade</SelectItem>
                  <SelectItem value="college">College</SelectItem>
                  <SelectItem value="graduate">Graduate</SelectItem>
                  <SelectItem value="professional">Professional</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="description">Course Description</Label>
            <Textarea
              id="description"
              placeholder="Describe what this course will cover..."
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={3}
            />
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
          <h3 className="text-lg font-medium flex items-center gap-2">
            <Clock className="h-4 w-4" />
            Course Structure
          </h3>
          
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="space-y-2">
              <Label>Course Duration: {estimatedWeeks[0]} weeks</Label>
              <Slider
                value={estimatedWeeks}
                onValueChange={setEstimatedWeeks}
                max={52}
                min={1}
                step={1}
                className="w-full"
              />
              <div className="flex justify-between text-xs text-muted-foreground">
                <span>1 week</span>
                <span>52 weeks</span>
              </div>
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
              <div className="flex justify-between text-xs text-muted-foreground">
                <span>1 lesson</span>
                <span>7 lessons</span>
              </div>
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="detail-level">Lesson Detail Level</Label>
            <Select value={lessonDetailLevel} onValueChange={setLessonDetailLevel}>
              <SelectTrigger>
                <SelectValue placeholder="Select detail level" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="basic">
                  <div className="flex items-center space-x-2">
                    <div className="w-2 h-2 bg-blue-500 rounded-full"></div>
                    <span>Basic - Key concepts and activities</span>
                  </div>
                </SelectItem>
                <SelectItem value="detailed">
                  <div className="flex items-center space-x-2">
                    <div className="w-2 h-2 bg-green-500 rounded-full"></div>
                    <span>Detailed - Comprehensive content and examples</span>
                  </div>
                </SelectItem>
                <SelectItem value="comprehensive">
                  <div className="flex items-center space-x-2">
                    <div className="w-2 h-2 bg-purple-500 rounded-full"></div>
                    <span>Comprehensive - In-depth coverage with resources</span>
                  </div>
                </SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>

        <Separator />

        {/* Learning Objectives */}
        <div className="space-y-4">
          <h3 className="text-lg font-medium flex items-center gap-2">
            <Target className="h-4 w-4" />
            Learning Objectives
          </h3>
          
          <div className="space-y-2">
            {learningObjectives.map((objective, index) => (
              <div key={index} className="flex items-center gap-2">
                <Input
                  placeholder={`Learning objective ${index + 1}`}
                  value={objective}
                  onChange={(e) => updateLearningObjective(index, e.target.value)}
                />
                {learningObjectives.length > 1 && (
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => removeLearningObjective(index)}
                    className="h-10 w-10 p-0"
                  >
                    ×
                  </Button>
                )}
              </div>
            ))}
          </div>
          
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={addLearningObjective}
            className="w-full"
          >
            Add Learning Objective
          </Button>
        </div>

        <Separator />

        {/* Assessment Settings */}
        <div className="space-y-4">
          <h3 className="text-lg font-medium flex items-center gap-2">
            <CheckCircle className="h-4 w-4" />
            Assessment Configuration
          </h3>
          
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="flex items-center space-x-2">
              <Switch
                checked={includeAssessments}
                onCheckedChange={setIncludeAssessments}
              />
              <Label>Lesson Assessments</Label>
            </div>
            
            <div className="flex items-center space-x-2">
              <Switch
                checked={includeQuizzes}
                onCheckedChange={setIncludeQuizzes}
              />
              <Label>Module Quizzes</Label>
            </div>
            
            <div className="flex items-center space-x-2">
              <Switch
                checked={includeFinalExam}
                onCheckedChange={setIncludeFinalExam}
              />
              <Label>Final Exam</Label>
            </div>
          </div>

          {(includeAssessments || includeQuizzes || includeFinalExam) && (
            <>
              <div className="space-y-2">
                <Label htmlFor="assessment-difficulty">Assessment Difficulty</Label>
                <Select value={assessmentDifficulty} onValueChange={setAssessmentDifficulty}>
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

              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                {includeAssessments && (
                  <div className="space-y-2">
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

                {includeQuizzes && (
                  <div className="space-y-2">
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

                {includeFinalExam && (
                  <div className="space-y-2">
                    <Label>Questions per Exam: {questionsPerExam[0]}</Label>
                    <Slider
                      value={questionsPerExam}
                      onValueChange={setQuestionsPerExam}
                      max={50}
                      min={10}
                      step={1}
                      className="w-full"
                    />
                  </div>
                )}
              </div>
            </>
          )}
        </div>

        <Separator />

        {/* Additional Guidance */}
        <div className="space-y-4">
          <h3 className="text-lg font-medium flex items-center gap-2">
            <Settings className="h-4 w-4" />
            Additional Guidance
          </h3>
          
          <div className="space-y-2">
            <Label htmlFor="user-guidance">Special Instructions (Optional)</Label>
            <Textarea
              id="user-guidance"
              placeholder="Any specific requirements, teaching approaches, or focus areas..."
              value={userGuidance}
              onChange={(e) => setUserGuidance(e.target.value)}
              rows={3}
            />
          </div>
        </div>

        {/* Error Display */}
        {error && (
          <Alert variant="destructive">
            <AlertCircle className="h-4 w-4" />
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        )}

        {/* Info Alert */}
        <Alert>
          <Info className="h-4 w-4" />
          <AlertDescription>
            This enhanced generation will create a comprehensive course structure with detailed lessons, 
            assessments, and customized content based on your specifications.
          </AlertDescription>
        </Alert>

        {/* Generate Button */}
        <div className="flex justify-end">
          <Button 
            onClick={handleGenerate} 
            disabled={isLoading || !title.trim()}
            className="px-8"
          >
            {isLoading ? (
              <>
                <Sparkles className="mr-2 h-4 w-4 animate-pulse" />
                Generating Course...
              </>
            ) : (
              <>
                <Sparkles className="mr-2 h-4 w-4" />
                Generate Enhanced Course
              </>
            )}
          </Button>
        </div>
      </CardContent>
    </Card>
  );
} 