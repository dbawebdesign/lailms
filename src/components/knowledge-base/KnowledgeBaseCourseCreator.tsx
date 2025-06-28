'use client';

import React, { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Progress } from '@/components/ui/progress';
import { Alert, AlertDescription } from '@/components/ui/alert';
import FileUploadForCourseCreation from './FileUploadForCourseCreation';
import { 
  BookOpen, 
  Upload, 
  Brain, 
  ArrowRight, 
  CheckCircle, 
  Loader2,
  AlertCircle,
  Info,
  Lightbulb,
  Target,
  Sparkles
} from 'lucide-react';

interface KnowledgeBaseCourseCreatorProps {
  userId: string;
  organisationId: string;
  existingBaseClassId?: string;
}

type CreationStep = 'upload' | 'analyzing' | 'review' | 'generation' | 'complete';

interface GeneratedCourseInfo {
  name: string;
  description: string;
  subject: string;
  targetAudience: string;
  learningObjectives: string[];
}

interface CreationProgress {
  step: CreationStep;
  progress: number;
  message: string;
  baseClassId?: string;
  generatedInfo?: GeneratedCourseInfo;
  error?: string;
}

export default function KnowledgeBaseCourseCreator({ userId, organisationId, existingBaseClassId }: KnowledgeBaseCourseCreatorProps) {
  const router = useRouter();
  const [currentStep, setCurrentStep] = useState<CreationStep>('upload');
  const [creationProgress, setCreationProgress] = useState<CreationProgress>({
    step: 'upload',
    progress: 0,
    message: 'Ready to upload your knowledge base sources'
  });
  const [isProcessing, setIsProcessing] = useState(false);
  const [userAdjustments, setUserAdjustments] = useState<Partial<GeneratedCourseInfo>>({});
  const [createdBaseClassId, setCreatedBaseClassId] = useState<string | null>(null);
  const [analysisResult, setAnalysisResult] = useState<GeneratedCourseInfo | null>(null);
  const [analysisMetrics, setAnalysisMetrics] = useState<any | null>(null);
  const [isAnalyzing, setIsAnalyzing] = useState(false);

  // Handle existing base class from Luna
  React.useEffect(() => {
    if (existingBaseClassId) {
      setCreatedBaseClassId(existingBaseClassId);
      setCreationProgress({
        step: 'upload',
        progress: 0,
        message: 'Luna has created your course foundation. Upload your documents to continue.',
        baseClassId: existingBaseClassId
      });
    }
  }, [existingBaseClassId]);

  const steps = [
    {
      id: 'upload',
      title: 'Upload Sources',
      description: 'Add your content',
      icon: <Upload className="h-5 w-5" />,
      completed: !['upload'].includes(currentStep)
    },
    {
      id: 'analyzing',
      title: 'AI Analysis',
      description: 'Understanding content',
      icon: <Brain className="h-5 w-5" />,
      completed: ['review', 'generation', 'complete'].includes(currentStep)
    },
    {
      id: 'review',
      title: 'Review Course',
      description: 'Check AI suggestions',
      icon: <Target className="h-5 w-5" />,
      completed: ['generation', 'complete'].includes(currentStep)
    },
    {
      id: 'generation',
      title: 'Generate Course',
      description: 'Create structure',
      icon: <BookOpen className="h-5 w-5" />,
      completed: currentStep === 'complete'
    }
  ];

  const handleUploadComplete = async () => {
    setIsProcessing(true);
    setCreationProgress({
      step: 'analyzing',
      progress: 25,
      message: 'Creating course structure and analyzing your content...'
    });
    setCurrentStep('analyzing');

    try {
      let targetBaseClassId = createdBaseClassId;

      // Step 1: Create a placeholder base class (only if we don't have one from Luna)
      if (!targetBaseClassId) {
        const baseClassResponse = await fetch('/api/knowledge-base/create-placeholder-base-class', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            organisationId,
            userId
          }),
        });

        const baseClassData = await baseClassResponse.json();
        if (!baseClassData.success) {
          throw new Error(baseClassData.error || 'Failed to create course structure');
        }

        targetBaseClassId = baseClassData.baseClassId;
        setCreatedBaseClassId(targetBaseClassId);
      }

      setCreationProgress(prev => ({
        ...prev,
        progress: 40,
        message: 'Associating uploaded documents with your course...',
        baseClassId: targetBaseClassId || undefined
      }));

      // Step 2: Associate recent uploads with the base class for proper isolation
      const associateResponse = await fetch('/api/knowledge-base/associate-documents-with-base-class', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          baseClassId: targetBaseClassId,
          organisationId,
          timeWindowMinutes: 15 // Look for uploads in the last 15 minutes
        }),
      });

      const associateData = await associateResponse.json();
      if (!associateData.success) {
        console.warn('Failed to associate documents:', associateData.error);
        // Don't fail the whole process, but log the issue
      }

      setCreationProgress(prev => ({
        ...prev,
        progress: 60,
        message: `Analyzing ${associateData.documentsAssociated || 0} document(s) to generate course information...`,
        baseClassId: targetBaseClassId || undefined
      }));

      // Step 3: Analyze content and generate course info
      if (targetBaseClassId) {
        await handleAnalyzeUploads(targetBaseClassId);
      }

    } catch (error) {
      setCreationProgress(prev => ({
        ...prev,
        error: error instanceof Error ? error.message : 'Failed to analyze content',
        progress: 0
      }));
    } finally {
      setIsProcessing(false);
    }
  };

  const handleSkipUpload = async () => {
    // Create placeholder base class for general knowledge generation
    setIsProcessing(true);
    setCreationProgress({
      step: 'analyzing',
      progress: 25,
      message: 'Creating course structure for general knowledge generation...'
    });

    try {
      const response = await fetch('/api/knowledge-base/create-placeholder-base-class', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          organisationId,
          userId,
          skipAnalysis: true
        }),
      });

      const data = await response.json();
      if (!data.success) {
        throw new Error(data.error || 'Failed to create course structure');
      }

      // Skip to generation since no content to analyze
      setCreatedBaseClassId(data.baseClassId);
      setCreationProgress({
        step: 'generation',
        progress: 90,
        message: 'Ready for course generation using general knowledge!',
        baseClassId: data.baseClassId
      });
      setCurrentStep('generation');

    } catch (error) {
      setCreationProgress(prev => ({
        ...prev,
        error: error instanceof Error ? error.message : 'Failed to create course structure'
      }));
    } finally {
      setIsProcessing(false);
    }
  };

  const handleApproveAndGenerate = async () => {
    if (!createdBaseClassId || !analysisResult) return;

    setIsProcessing(true);
    
    try {
      // Update base class with approved information
      const mergedInfo = { ...analysisResult, ...userAdjustments };
      
      const response = await fetch('/api/knowledge-base/update-base-class-info', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          baseClassId: createdBaseClassId,
          courseInfo: mergedInfo
        }),
      });

      const data = await response.json();
      if (!data.success) {
        throw new Error(data.error || 'Failed to update course information');
      }

      // Navigate to course generation
      router.push(`/teach/knowledge-base/${createdBaseClassId}`);

    } catch (error) {
      setCreationProgress(prev => ({
        ...prev,
        error: error instanceof Error ? error.message : 'Failed to update course information'
      }));
    } finally {
      setIsProcessing(false);
    }
  };

  const handleAnalyzeUploads = async (baseClassId?: string) => {
    const targetBaseClassId = baseClassId || (createdBaseClassId ? createdBaseClassId : undefined);
    if (!targetBaseClassId) {
      console.error('No base class ID available for analysis');
      return;
    }

    setCurrentStep('analyzing');
    setIsAnalyzing(true);

    try {
      console.log('Starting comprehensive analysis of all sources...');
      
      const response = await fetch('/api/knowledge-base/analyze-and-generate-course-info', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          baseClassId: targetBaseClassId,
          organisationId: organisationId,
        }),
      });

      const result = await response.json();

      if (result.success) {
        setAnalysisResult(result.courseInfo);
        setAnalysisMetrics(result.analysisMetrics);
        setCurrentStep('review');
        setCreationProgress({
          step: 'review',
          progress: 85,
          message: 'AI analysis complete! Review the generated course information.',
          baseClassId: targetBaseClassId
        });
        console.log('Comprehensive analysis completed:', result.analysisMetrics);
      } else {
        console.error('Analysis failed:', result.error);
        setCreationProgress(prev => ({
          ...prev,
          error: result.error || 'Failed to analyze content',
          progress: 0
        }));
      }
    } catch (error) {
      console.error('Error during analysis:', error);
      setCreationProgress(prev => ({
        ...prev,
        error: error instanceof Error ? error.message : 'Failed to analyze content',
        progress: 0
      }));
    } finally {
      setIsAnalyzing(false);
    }
  };

  const renderStepContent = () => {
    switch (currentStep) {
      case 'upload':
        return (
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center space-x-2">
                <Upload className="h-5 w-5" />
                <span>Upload Your Knowledge Base Sources</span>
              </CardTitle>
              <CardDescription>
                Start by uploading your documents, videos, URLs, or any content sources. Our AI will analyze them to automatically generate course information - just like NotebookLM!
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <FileUploadForCourseCreation
                baseClassId={null} // Will be created after upload
                organisationId={organisationId}
                onUploadComplete={handleUploadComplete}
                onSkipUploads={handleSkipUpload}
              />
            </CardContent>
          </Card>
        );

      case 'analyzing':
        return (
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center space-x-2">
                <Brain className="h-5 w-5" />
                <span>AI Analysis in Progress</span>
              </CardTitle>
              <CardDescription>
                Our AI is analyzing your uploaded content to understand the subject matter and generate appropriate course information.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="text-center py-8">
                <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-primary/10 mb-4">
                  <Brain className="h-8 w-8 text-primary animate-pulse" />
                </div>
                <h3 className="text-lg font-medium mb-2">Analyzing Your Content</h3>
                <p className="text-muted-foreground mb-4">
                  {isAnalyzing ? 
                    'Performing comprehensive analysis of all uploaded sources...' : 
                    'Creating course structure and analyzing subject matter...'
                  }
                </p>
                <Progress value={creationProgress.progress} className="w-full max-w-md mx-auto" />
                <p className="text-sm text-muted-foreground mt-2">
                  {creationProgress.progress}% complete
                </p>
              </div>

              <Alert>
                <Info className="h-4 w-4" />
                <AlertDescription>
                  <strong>What's happening:</strong>
                  <ul className="mt-2 list-disc list-inside space-y-1 text-sm">
                    <li>Creating course structure with placeholder information</li>
                    <li>Associating your uploaded documents with this specific course</li>
                    <li>Waiting for all documents to complete processing</li>
                    <li>Performing comprehensive analysis of ALL sources together</li>
                    <li>Identifying unified themes and learning opportunities</li>
                    <li>Generating cohesive course name, description, and objectives</li>
                  </ul>
                </AlertDescription>
              </Alert>
            </CardContent>
          </Card>
        );

      case 'review':
        return (
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center space-x-2">
                <Target className="h-5 w-5" />
                <span>Review AI-Generated Course Information</span>
              </CardTitle>
              <CardDescription>
                Based on your uploaded content, our AI has generated course information. Review and adjust as needed before creating your full course.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              {analysisResult && (
                <div className="space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="courseName">Course Name</Label>
                    <Input
                      id="courseName"
                      value={userAdjustments.name ?? analysisResult.name}
                      onChange={(e) => setUserAdjustments(prev => ({ ...prev, name: e.target.value }))}
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="courseDescription">Course Description</Label>
                    <Textarea
                      id="courseDescription"
                      value={userAdjustments.description ?? analysisResult.description}
                      onChange={(e) => setUserAdjustments(prev => ({ ...prev, description: e.target.value }))}
                      rows={4}
                    />
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label htmlFor="subject">Subject</Label>
                      <Input
                        id="subject"
                        value={userAdjustments.subject ?? analysisResult.subject}
                        onChange={(e) => setUserAdjustments(prev => ({ ...prev, subject: e.target.value }))}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="targetAudience">Target Audience</Label>
                      <Input
                        id="targetAudience"
                        value={userAdjustments.targetAudience ?? analysisResult.targetAudience}
                        onChange={(e) => setUserAdjustments(prev => ({ ...prev, targetAudience: e.target.value }))}
                      />
                    </div>
                  </div>

                  <div className="space-y-2">
                    <Label>Learning Objectives</Label>
                    <div className="space-y-2">
                      {analysisResult.learningObjectives.map((objective, index) => (
                        <div key={index} className="flex items-center space-x-2 p-2 bg-muted/50 rounded">
                          <CheckCircle className="h-4 w-4 text-green-600" />
                          <span className="text-sm">{objective}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              )}

              <Alert>
                <Sparkles className="h-4 w-4" />
                <AlertDescription>
                  <strong>AI Analysis Results:</strong> 
                  {analysisMetrics && (
                    <>
                      {' '}Our AI has comprehensively analyzed {analysisMetrics.totalSources} source{analysisMetrics.totalSources !== 1 ? 's' : ''} 
                      ({analysisMetrics.totalWords?.toLocaleString()} words) including {analysisMetrics.sourceTypes?.join(', ')} files.
                    </>
                  )}
                  {' '}You can adjust any details before proceeding to full course generation.
                </AlertDescription>
              </Alert>

              {creationProgress.error && (
                <Alert variant="destructive">
                  <AlertCircle className="h-4 w-4" />
                  <AlertDescription>{creationProgress.error}</AlertDescription>
                </Alert>
              )}

              <div className="flex justify-end">
                <Button 
                  onClick={handleApproveAndGenerate}
                  disabled={isProcessing}
                  className="px-8"
                >
                  {isProcessing && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                  Proceed to course options
                </Button>
              </div>
            </CardContent>
          </Card>
        );

      case 'generation':
        return (
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center space-x-2">
                <BookOpen className="h-5 w-5" />
                <span>Ready for Course Generation</span>
              </CardTitle>
              <CardDescription>
                Your course structure is ready. You can now generate your complete course with lessons and assessments!
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="text-center py-8">
                <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-green-100 mb-4">
                  <CheckCircle className="h-8 w-8 text-green-600" />
                </div>
                <h3 className="text-lg font-medium mb-2">Course Structure Ready!</h3>
                <p className="text-muted-foreground mb-6">
                  Your course information has been set up and is ready for full generation.
                </p>
              </div>

              <Alert>
                <Lightbulb className="h-4 w-4" />
                <AlertDescription>
                  <strong>Next Steps:</strong>
                  <ul className="mt-2 list-disc list-inside space-y-1 text-sm">
                    <li>Choose from three generation modes (KB Only, KB Priority, KB Supplemented)</li>
                    <li>Configure course parameters and learning objectives</li>
                    <li>Generate comprehensive course structure with lessons and assessments</li>
                    <li>Review and deploy your finished course</li>
                  </ul>
                </AlertDescription>
              </Alert>

              <div className="flex justify-center">
                <Button 
                  onClick={() => router.push(`/teach/knowledge-base/${createdBaseClassId}`)} 
                  size="lg" 
                  className="px-8"
                >
                  <Brain className="mr-2 h-5 w-5" />
                  Start Course Generation
                  <ArrowRight className="ml-2 h-4 w-4" />
                </Button>
              </div>
            </CardContent>
          </Card>
        );

      default:
        return null;
    }
  };

  return (
    <div className="w-full space-y-6">
      {/* Progress Steps */}
      <Card>
        <CardHeader>
          <CardTitle>AI-Powered Course Creation</CardTitle>
          <CardDescription>
            Upload your knowledge sources and let AI create comprehensive course information automatically
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-between">
            {steps.map((step, index) => (
              <React.Fragment key={step.id}>
                <div className="flex flex-col items-center space-y-2">
                  <Button
                    variant={currentStep === step.id ? 'default' : step.completed ? 'secondary' : 'outline'}
                    size="lg"
                    className="h-12 w-12 rounded-full p-0"
                    disabled
                  >
                    {step.completed ? <CheckCircle className="h-5 w-5" /> : step.icon}
                  </Button>
                  <div className="text-center">
                    <div className="font-medium text-sm">{step.title}</div>
                    <div className="text-xs text-muted-foreground max-w-20">{step.description}</div>
                  </div>
                </div>
                {index < steps.length - 1 && (
                  <ArrowRight className="h-4 w-4 text-muted-foreground" />
                )}
              </React.Fragment>
            ))}
          </div>
          
          {creationProgress.progress > 0 && (
            <div className="mt-6">
              <Progress value={creationProgress.progress} className="w-full" />
              <p className="text-sm text-muted-foreground mt-2 text-center">
                {creationProgress.message}
              </p>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Step Content */}
      {renderStepContent()}

      {/* Help Information */}
      <Card>
        <CardHeader>
          <CardTitle>About AI-Powered Course Generation</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="space-y-2">
              <div className="flex items-center space-x-2">
                <BookOpen className="h-4 w-4 text-blue-500" />
                <span className="font-medium">KB Only</span>
              </div>
              <p className="text-sm text-muted-foreground">
                Generate content exclusively from your uploaded sources. Perfect for compliance training and certification courses.
              </p>
            </div>
            <div className="space-y-2">
              <div className="flex items-center space-x-2">
                <Brain className="h-4 w-4 text-purple-500" />
                <span className="font-medium">KB Priority</span>
              </div>
              <p className="text-sm text-muted-foreground">
                Prioritize your knowledge base content while filling small gaps with general knowledge. Balanced approach for most courses.
              </p>
            </div>
            <div className="space-y-2">
              <div className="flex items-center space-x-2">
                <Lightbulb className="h-4 w-4 text-green-500" />
                <span className="font-medium">KB Supplemented</span>
              </div>
              <p className="text-sm text-muted-foreground">
                Use knowledge base as foundation but freely expand with general knowledge for comprehensive courses.
              </p>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
} 