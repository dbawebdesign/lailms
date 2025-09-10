'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Progress } from '@/components/ui/progress';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Separator } from '@/components/ui/separator';
import { triggerCelebration } from '@/components/ui/confetti';
import { RealTimeProgress } from '@/components/ui/real-time-progress';
import { 
  Loader2, 
  Upload,
  FileText,
  Link as LinkIcon,
  X,
  CheckCircle, 
  AlertCircle, 
  Clock,
  Sparkles,
  ArrowRight,
  Info,
  Plus
} from 'lucide-react';

interface QueuedItem {
  id: string;
  type: 'file' | 'url';
  file?: File;
  url?: string;
  name: string;
  size?: number;
  status: 'queued' | 'uploading' | 'completed' | 'error';
  error?: string;
}

interface CreationProgress {
  step: 'upload' | 'analyzing' | 'generating' | 'complete';
  progress: number;
  message: string;
  baseClassId?: string;
}

interface GenerationJob {
  id: string;
  status: 'queued' | 'processing' | 'completed' | 'failed';
  progress: number;
  estimatedMinutes?: number;
  baseClassId: string;
}

// Grade level options for catalog courses
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

export function DevAdminCourseGenerator() {
  const router = useRouter();
  
  // Form state - simplified for dev-admin with fixed parameters
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [gradeLevel, setGradeLevel] = useState('');
  const [additionalGuidance, setAdditionalGuidance] = useState('');
  
  // File upload state
  const [queuedItems, setQueuedItems] = useState<QueuedItem[]>([]);
  const [dragActive, setDragActive] = useState(false);
  const [urlInput, setUrlInput] = useState('');
  
  // Progress and generation state
  const [creationProgress, setCreationProgress] = useState<CreationProgress | null>(null);
  const [generationJob, setGenerationJob] = useState<GenerationJob | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [createdBaseClassId, setCreatedBaseClassId] = useState<string | null>(null);
  
  // Fixed parameters for catalog courses
  const FIXED_PARAMS = {
    estimatedWeeks: 18,
    lessonsPerWeek: 3,
    lessonDetailLevel: 'standard',
    assessmentDifficulty: 'medium',
    questionsPerLesson: 5,
    questionsPerQuiz: 10,
    questionsPerExam: 50,
    includeAssessments: true,
    includeQuizzes: true,
    includeFinalExam: true
  };

  // File upload handlers
  const handleDrag = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === "dragenter" || e.type === "dragover") {
      setDragActive(true);
    } else if (e.type === "dragleave") {
      setDragActive(false);
    }
  }, []);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);
    
    const files = Array.from(e.dataTransfer.files);
    files.forEach(addFileToQueue);
  }, []);

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files) {
      Array.from(e.target.files).forEach(addFileToQueue);
    }
  };

  const addFileToQueue = (file: File) => {
    const newItem: QueuedItem = {
      id: Math.random().toString(36).substr(2, 9),
      type: 'file',
      file,
      name: file.name,
      size: file.size,
      status: 'queued'
    };
    setQueuedItems(prev => [...prev, newItem]);
  };

  const addUrlToQueue = () => {
    if (!urlInput.trim()) return;
    
    const newItem: QueuedItem = {
      id: Math.random().toString(36).substr(2, 9),
      type: 'url',
      url: urlInput.trim(),
      name: urlInput.trim(),
      status: 'queued'
    };
    setQueuedItems(prev => [...prev, newItem]);
    setUrlInput('');
  };

  const removeQueuedItem = (id: string) => {
    setQueuedItems(prev => prev.filter(item => item.id !== id));
  };

  // Poll for job status
  const checkJobStatus = useCallback(async (jobId: string) => {
    try {
      const response = await fetch(`/api/knowledge-base/generate-course?jobId=${jobId}`);
      const data = await response.json();
      
      if (data.success && data.job) {
        setGenerationJob(prev => prev ? { ...prev, ...data.job } : null);
        
        // Update progress
        setCreationProgress(prev => prev ? {
          ...prev,
          progress: data.job.progress || prev.progress,
          message: data.job.status_message || prev.message
        } : null);
        
        if (data.job.status === 'completed') {
          triggerCelebration();
          setCreationProgress({
            step: 'complete',
            progress: 100,
            message: 'Course catalog entry created successfully!',
            baseClassId: data.job.baseClassId
          });
          
          // Redirect to manage tab after success
          setTimeout(() => {
            router.push('/dev-admin/course-catalog?tab=manage');
          }, 2000);
        } else if (data.job.status === 'failed') {
          setError(data.job.error_message || 'Course generation failed');
          setIsProcessing(false);
        }
      }
    } catch (err) {
      console.error('Error checking job status:', err);
    }
  }, [router]);

  useEffect(() => {
    if (generationJob && ['queued', 'processing'].includes(generationJob.status)) {
      const interval = setInterval(() => {
        checkJobStatus(generationJob.id);
      }, 2000);
      
      return () => clearInterval(interval);
    }
  }, [generationJob, checkJobStatus]);

  // Create base class and upload files (following knowledge base creation process)
  const handleCreateCourse = useCallback(async () => {
    if (queuedItems.length === 0) {
      setError('Please upload at least one file or add a URL before generating the course.');
      return;
    }

    if (!title.trim()) {
      setError('Course title is required');
      return;
    }

    if (!gradeLevel) {
      setError('Grade level is required');
      return;
    }

    try {
      setIsProcessing(true);
      setError(null);
      setCreationProgress({
        step: 'upload',
        progress: 10,
        message: 'Creating course structure...'
      });

      // Step 1: Create placeholder base class (using knowledge base API)
      const baseClassResponse = await fetch('/api/knowledge-base/create-placeholder-base-class', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          organisationId: 'dev-admin', // Special org ID for dev-admin
          userId: 'dev-admin',
          name: title.trim(),
          description: description.trim(),
          course_catalog: true // Mark as catalog course
        }),
      });

      const baseClassData = await baseClassResponse.json();
      if (!baseClassData.success) {
        throw new Error(baseClassData.error || 'Failed to create course structure');
      }

      const newBaseClassId = baseClassData.baseClassId;
      setCreatedBaseClassId(newBaseClassId);

      setCreationProgress({
        step: 'upload',
        progress: 30,
        message: 'Uploading and processing files...'
      });

      // Step 2: Upload all files and URLs (following StreamlinedCourseCreator pattern)
      const uploadPromises = queuedItems.map(async (item) => {
        setQueuedItems(prev => prev.map(qi => 
          qi.id === item.id ? { ...qi, status: 'uploading' } : qi
        ));

        try {
          if (item.type === 'file' && item.file) {
            const formData = new FormData();
            formData.append('file', item.file);
            formData.append('organisation_id', 'dev-admin');
            formData.append('base_class_id', newBaseClassId);

            const response = await fetch('/api/knowledge-base/upload', {
              method: 'POST',
              body: formData,
            });

            if (!response.ok) {
              const errorData = await response.json().catch(() => ({}));
              throw new Error(errorData.error || `Upload failed with status ${response.status}`);
            }
          } else if (item.type === 'url' && item.url) {
            const urlType = item.url.includes('youtube.com') || item.url.includes('youtu.be') ? 'youtube' : 'webpage';
            
            const response = await fetch('/api/knowledge-base/url', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ 
                url: item.url, 
                type: urlType,
                base_class_id: newBaseClassId
              }),
            });

            if (!response.ok) {
              const errorData = await response.json().catch(() => ({}));
              throw new Error(errorData.error || `URL processing failed with status ${response.status}`);
            }
          }

          setQueuedItems(prev => prev.map(qi => 
            qi.id === item.id ? { ...qi, status: 'completed' } : qi
          ));
        } catch (err) {
          setQueuedItems(prev => prev.map(qi => 
            qi.id === item.id ? { ...qi, status: 'error', error: err instanceof Error ? err.message : 'Upload failed' } : qi
          ));
          throw err;
        }
      });

      await Promise.all(uploadPromises);

      setCreationProgress({
        step: 'analyzing',
        progress: 60,
        message: 'Analyzing content and generating course...'
      });

      // Step 3: Start course generation with fixed parameters
      const generationResponse = await fetch('/api/knowledge-base/generate-course', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          baseClassId: newBaseClassId,
          title: title.trim(),
          description: description.trim(),
          gradeLevel: gradeLevel,
          estimatedDurationWeeks: FIXED_PARAMS.estimatedWeeks,
          lessonsPerWeek: FIXED_PARAMS.lessonsPerWeek,
          lessonDetailLevel: FIXED_PARAMS.lessonDetailLevel,
          assessmentSettings: {
            includeAssessments: FIXED_PARAMS.includeAssessments,
            includeQuizzes: FIXED_PARAMS.includeQuizzes,
            includeFinalExam: FIXED_PARAMS.includeFinalExam,
            assessmentDifficulty: FIXED_PARAMS.assessmentDifficulty,
            questionsPerLesson: FIXED_PARAMS.questionsPerLesson,
            questionsPerQuiz: FIXED_PARAMS.questionsPerQuiz,
            questionsPerExam: FIXED_PARAMS.questionsPerExam
          },
          userGuidance: additionalGuidance.trim(),
          isDevAdmin: true,
          course_catalog: true
        }),
      });

      const generationData = await generationResponse.json();

      if (generationData.success) {
        setGenerationJob({
          id: generationData.jobId,
          status: generationData.status,
          progress: 0,
          baseClassId: newBaseClassId
        });

        setCreationProgress({
          step: 'generating',
          progress: 70,
          message: 'Course generation started...'
        });
      } else {
        throw new Error(generationData.error || 'Failed to start course generation');
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to create course');
      setIsProcessing(false);
    }
  }, [queuedItems, title, description, gradeLevel, additionalGuidance, FIXED_PARAMS]);

  // Format file size for display
  const formatFileSize = (bytes: number) => {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  };

  // Show progress tracking if processing
  if (isProcessing && creationProgress) {
    return (
      <div className="space-y-6">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Sparkles className="h-5 w-5" />
              Creating Course Catalog Entry
            </CardTitle>
            <CardDescription>
              Please wait while we process your content and generate the course...
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <div className="flex justify-between text-sm">
                <span>{creationProgress.message}</span>
                <span>{creationProgress.progress}%</span>
              </div>
              <Progress value={creationProgress.progress} className="h-2" />
            </div>
            
            {generationJob && (
              <RealTimeProgress 
                jobId={generationJob.id}
                onComplete={() => {
                  // Handle completion
                }}
              />
            )}
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Course Basic Information */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <FileText className="h-5 w-5" />
            Course Information
          </CardTitle>
          <CardDescription>
            Basic information about the course catalog entry you're creating.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 gap-4">
            <div>
              <Label htmlFor="title">Course Title *</Label>
              <Input
                id="title"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="e.g., Introduction to Algebra, World History, etc."
                className="mt-1"
              />
            </div>
            
            <div>
              <Label htmlFor="description">Course Description</Label>
              <Textarea
                id="description"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="Describe what this course covers and who it's for..."
                rows={3}
                className="mt-1"
              />
            </div>

            <div>
              <Label htmlFor="gradeLevel">Grade Level *</Label>
              <Select value={gradeLevel} onValueChange={setGradeLevel}>
                <SelectTrigger className="mt-1">
                  <SelectValue placeholder="Select grade level..." />
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
          </div>
        </CardContent>
      </Card>

      {/* File Upload Section */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Upload className="h-5 w-5" />
            Upload Course Materials
          </CardTitle>
          <CardDescription>
            Upload documents, PDFs, videos, or add URLs to create your course content.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* File Drop Zone */}
          <div
            className={`border-2 border-dashed rounded-lg p-8 text-center transition-colors ${
              dragActive 
                ? 'border-primary bg-primary/5' 
                : 'border-muted-foreground/25 hover:border-muted-foreground/50'
            }`}
            onDragEnter={handleDrag}
            onDragLeave={handleDrag}
            onDragOver={handleDrag}
            onDrop={handleDrop}
          >
            <Upload className="mx-auto h-12 w-12 text-muted-foreground mb-4" />
            <div className="space-y-2">
              <p className="text-lg font-medium">Drop files here or click to browse</p>
              <p className="text-sm text-muted-foreground">
                Supports PDFs, Word docs, PowerPoints, videos, and more
              </p>
            </div>
            <input
              type="file"
              multiple
              onChange={handleFileSelect}
              className="hidden"
              id="file-upload"
            />
            <Button 
              variant="outline" 
              className="mt-4"
              onClick={() => document.getElementById('file-upload')?.click()}
            >
              Browse Files
            </Button>
          </div>

          {/* URL Input */}
          <div className="flex gap-2">
            <Input
              placeholder="Add a URL (webpage, YouTube video, etc.)"
              value={urlInput}
              onChange={(e) => setUrlInput(e.target.value)}
              onKeyPress={(e) => e.key === 'Enter' && addUrlToQueue()}
            />
            <Button onClick={addUrlToQueue} disabled={!urlInput.trim()}>
              <Plus className="h-4 w-4" />
            </Button>
          </div>

          {/* Queued Items */}
          {queuedItems.length > 0 && (
            <div className="space-y-2">
              <Label>Queued Items ({queuedItems.length})</Label>
              <div className="space-y-2 max-h-40 overflow-y-auto">
                {queuedItems.map((item) => (
                  <div key={item.id} className="flex items-center justify-between p-2 bg-muted rounded">
                    <div className="flex items-center gap-2 flex-1 min-w-0">
                      {item.type === 'file' ? (
                        <FileText className="h-4 w-4 flex-shrink-0" />
                      ) : (
                        <LinkIcon className="h-4 w-4 flex-shrink-0" />
                      )}
                      <span className="truncate text-sm">{item.name}</span>
                      {item.size && (
                        <span className="text-xs text-muted-foreground">
                          ({formatFileSize(item.size)})
                        </span>
                      )}
                    </div>
                    <div className="flex items-center gap-2">
                      {item.status === 'completed' && (
                        <CheckCircle className="h-4 w-4 text-green-500" />
                      )}
                      {item.status === 'uploading' && (
                        <Loader2 className="h-4 w-4 animate-spin" />
                      )}
                      {item.status === 'error' && (
                        <AlertCircle className="h-4 w-4 text-red-500" />
                      )}
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => removeQueuedItem(item.id)}
                      >
                        <X className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Fixed Course Parameters Info */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Info className="h-5 w-5" />
            Course Parameters
          </CardTitle>
          <CardDescription>
            This course will be created with standardized parameters for catalog consistency.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
            <div>
              <Label className="text-xs font-medium text-muted-foreground">Duration</Label>
              <p className="font-medium">{FIXED_PARAMS.estimatedWeeks} weeks</p>
            </div>
            <div>
              <Label className="text-xs font-medium text-muted-foreground">Lessons/Week</Label>
              <p className="font-medium">{FIXED_PARAMS.lessonsPerWeek}</p>
            </div>
            <div>
              <Label className="text-xs font-medium text-muted-foreground">Content Detail</Label>
              <p className="font-medium capitalize">{FIXED_PARAMS.lessonDetailLevel}</p>
            </div>
            <div>
              <Label className="text-xs font-medium text-muted-foreground">Assessment Difficulty</Label>
              <p className="font-medium capitalize">{FIXED_PARAMS.assessmentDifficulty}</p>
            </div>
          </div>
          <Separator className="my-4" />
          <div className="grid grid-cols-3 gap-4 text-sm">
            <div>
              <Label className="text-xs font-medium text-muted-foreground">Lesson Questions</Label>
              <p className="font-medium">{FIXED_PARAMS.questionsPerLesson}</p>
            </div>
            <div>
              <Label className="text-xs font-medium text-muted-foreground">Path Quiz Questions</Label>
              <p className="font-medium">{FIXED_PARAMS.questionsPerQuiz}</p>
            </div>
            <div>
              <Label className="text-xs font-medium text-muted-foreground">Final Exam Questions</Label>
              <p className="font-medium">{FIXED_PARAMS.questionsPerExam}</p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Additional Guidance */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Info className="h-5 w-5" />
            Additional Guidance (Optional)
          </CardTitle>
          <CardDescription>
            Provide any specific instructions or preferences for course generation.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Textarea
            value={additionalGuidance}
            onChange={(e) => setAdditionalGuidance(e.target.value)}
            placeholder="Any specific requirements, teaching approaches, or content preferences..."
            rows={4}
          />
        </CardContent>
      </Card>

      {/* Error Display */}
      {error && (
        <Alert variant="destructive">
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      {/* Generate Button */}
      <Card>
        <CardContent className="pt-6">
          <Button
            onClick={handleCreateCourse}
            disabled={isProcessing || !title.trim() || !gradeLevel || queuedItems.length === 0}
            className="w-full"
            size="lg"
          >
            {isProcessing ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Creating Course Catalog Entry...
              </>
            ) : (
              <>
                <Sparkles className="mr-2 h-4 w-4" />
                Generate Course Catalog Entry
              </>
            )}
          </Button>
          
          {queuedItems.length === 0 && (
            <p className="text-sm text-muted-foreground text-center mt-2">
              Please upload at least one file or add a URL to continue
            </p>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
