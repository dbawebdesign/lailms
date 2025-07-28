'use client';

import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { StepIndicator, type Step } from '@/components/ui/step-indicator';
import { FileUploadDropzone } from './FileUploadDropzone';
import { FileListTable } from './FileListTable';
import CourseGenerationInterface from './CourseGenerationInterface';
import GeneratedCourseViewer from './GeneratedCourseViewer';
import { 
  BookOpen, 
  Upload, 
  Brain, 
  ArrowRight, 
  CheckCircle, 
  Settings,
  FileText,
  Users,
  GraduationCap,
  Clock,
  Target,
  Layers,
  Sparkles,
  Info
} from 'lucide-react';

interface KnowledgeBaseCourseGeneratorProps {
  baseClassId: string;
}

interface BaseClassInfo {
  id: string;
  name: string;
  description: string;
  created_at: string;
  organisation_id: string;
  settings?: {
    course_metadata?: {
      subject?: string;
      learning_objectives?: string[];
      target_audience?: string;
    };
  };
}

interface DocumentSummary {
  total: number;
  completed: number;
  types: string[];
}

type WorkflowStep = 'overview' | 'generate' | 'review' | 'deploy';

export default function KnowledgeBaseCourseGenerator({ baseClassId }: KnowledgeBaseCourseGeneratorProps) {
  const [currentStep, setCurrentStep] = useState<WorkflowStep>('overview');
  const [generatedCourseId, setGeneratedCourseId] = useState<string | null>(null);
  const [baseClassInfo, setBaseClassInfo] = useState<BaseClassInfo | null>(null);
  const [documentSummary, setDocumentSummary] = useState<DocumentSummary | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  // Load base class information and documents
  useEffect(() => {
    const loadCourseData = async () => {
      setIsLoading(true);
      try {
        // Load base class info
        const baseClassResponse = await fetch(`/api/teach/base-classes/${baseClassId}/info`);
        if (baseClassResponse.ok) {
          const baseClassData = await baseClassResponse.json();
          setBaseClassInfo(baseClassData);
        }

        // Load document summary
        const docsResponse = await fetch(`/api/knowledge-base/documents?base_class_id=${baseClassId}&summary=true`);
        if (docsResponse.ok) {
          const docsData = await docsResponse.json();
          setDocumentSummary(docsData);
          
          // Check if we should start at generation step (documents exist)
          if (docsData?.completed > 0) {
            setCurrentStep('generate');
          }
        }
      } catch (error) {
        console.error('Error loading course data:', error);
      } finally {
        setIsLoading(false);
      }
    };

    loadCourseData();
  }, [baseClassId]);

  const handleCourseGenerated = (courseOutlineId: string) => {
    setGeneratedCourseId(courseOutlineId);
    setCurrentStep('review');
  };

  const handleDeployToCourse = (courseOutlineId: string) => {
    setCurrentStep('deploy');
    console.log('Deploying course:', courseOutlineId);
  };

  const steps: Step[] = [
    {
      id: 'overview',
      title: 'Course Overview',
      description: 'Review knowledge base',
      icon: <BookOpen className="h-5 w-5" />,
      completed: !!baseClassInfo && currentStep !== 'overview'
    },
    {
      id: 'generate',
      title: 'Generate Course',
      description: 'AI course creation',
      icon: <Brain className="h-5 w-5" />,
      completed: !!generatedCourseId && currentStep !== 'generate'
    },
    {
      id: 'review',
      title: 'Review & Edit',
      description: 'Customize course content',
      icon: <Settings className="h-5 w-5" />,
      completed: !!generatedCourseId && currentStep !== 'review'
    },
    {
      id: 'deploy',
      title: 'Deploy Course',
      description: 'Make course live',
      icon: <CheckCircle className="h-5 w-5" />,
      completed: currentStep === 'deploy'
    }
  ];

  if (isLoading) {
    return (
      <div className="w-full space-y-6">
        <Card>
          <CardContent className="pt-6">
            <div className="text-center">
              <div className="inline-flex items-center justify-center w-12 h-12 rounded-full bg-primary/10 mb-4">
                <Brain className="h-6 w-6 text-primary animate-pulse" />
              </div>
              <h3 className="text-lg font-medium mb-2">Loading Course Management Center</h3>
              <p className="text-muted-foreground">Setting up your course data...</p>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="w-full space-y-6">
      {/* Course Header */}
      {baseClassInfo && (
        <Card>
          <CardHeader>
            <div className="flex items-start justify-between">
              <div className="space-y-2">
                <CardTitle className="text-2xl">{baseClassInfo.name}</CardTitle>
                <CardDescription className="text-base max-w-3xl">
                  {baseClassInfo.description}
                </CardDescription>
                
                {/* Learning Objectives */}
                {baseClassInfo.settings?.course_metadata?.learning_objectives && 
                 baseClassInfo.settings.course_metadata.learning_objectives.length > 0 && (
                  <div className="pt-4 border-t">
                    <h3 className="text-sm font-semibold text-foreground mb-2">Learning Objectives:</h3>
                    <ul className="text-sm text-muted-foreground space-y-1">
                      {baseClassInfo.settings.course_metadata.learning_objectives.map((objective, index) => (
                        <li key={index} className="flex items-start space-x-2">
                          <span className="text-primary mt-1">•</span>
                          <span>{objective}</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
                
                <div className="flex items-center space-x-4 text-sm text-muted-foreground">
                  {baseClassInfo.settings?.course_metadata?.subject && (
                    <div className="flex items-center space-x-1">
                      <GraduationCap className="h-4 w-4" />
                      <span>{baseClassInfo.settings.course_metadata.subject}</span>
                    </div>
                  )}
                  {documentSummary && (
                    <div className="flex items-center space-x-1">
                      <FileText className="h-4 w-4" />
                      <span>{documentSummary.completed} Knowledge Sources</span>
                    </div>
                  )}
                  <div className="flex items-center space-x-1">
                    <Clock className="h-4 w-4" />
                    <span>Created {new Date(baseClassInfo.created_at).toLocaleDateString()}</span>
                  </div>
                </div>
              </div>
              
              <Badge variant="secondary" className="flex items-center space-x-1">
                <Layers className="h-3 w-3" />
                <span>Knowledge Base Course</span>
              </Badge>
            </div>
          </CardHeader>
        </Card>
      )}

      {/* Step Indicator */}
      <StepIndicator 
        steps={steps}
        currentStepId={currentStep}
        className="mb-8"
      />

      {/* Current Step Content */}
      {currentStep === 'overview' && (
        <div className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* Knowledge Base Summary */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center space-x-2">
                  <FileText className="h-5 w-5" />
                  <span>Knowledge Base Sources</span>
                </CardTitle>
                <CardDescription>
                  Sources analyzed to create this course
                </CardDescription>
              </CardHeader>
              <CardContent>
                {documentSummary ? (
                  <div className="space-y-4">
                    <div className="grid grid-cols-2 gap-4">
                      <div className="text-center p-4 bg-muted/50 rounded-lg">
                        <div className="text-2xl font-bold text-primary">{documentSummary.completed}</div>
                        <div className="text-sm text-muted-foreground">Sources Processed</div>
                      </div>
                      <div className="text-center p-4 bg-muted/50 rounded-lg">
                        <div className="text-2xl font-bold text-green-600">{documentSummary.types?.length || 0}</div>
                        <div className="text-sm text-muted-foreground">Content Types</div>
                      </div>
                    </div>
                    
                    {documentSummary.types && documentSummary.types.length > 0 && (
                      <div className="space-y-2">
                        <h4 className="font-medium text-sm">Source Types:</h4>
                        <div className="flex flex-wrap gap-2">
                          {documentSummary.types.map((type, index) => (
                            <Badge key={index} variant="outline" className="text-xs">
                              {type}
                            </Badge>
                          ))}
                        </div>
                      </div>
                    )}

                    <Button 
                      variant="outline" 
                      size="sm" 
                      className="w-full"
                      onClick={() => setCurrentStep('generate')}
                    >
                      <Brain className="h-4 w-4 mr-2" />
                      Generate Course from Sources
                    </Button>
                  </div>
                ) : (
                  <div className="text-center py-8 text-muted-foreground">
                    <Upload className="h-12 w-12 mx-auto mb-4 opacity-50" />
                    <h3 className="font-medium mb-2">No Knowledge Sources</h3>
                    <p className="text-sm mb-4">Upload documents to create a knowledge base course</p>
                    {baseClassInfo && (
                      <FileUploadDropzone 
                        organisationId={baseClassInfo.organisation_id}
                      />
                    )}
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Course Generation Status */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center space-x-2">
                  <Target className="h-5 w-5" />
                  <span>Course Generation</span>
                </CardTitle>
                <CardDescription>
                  Current status and next steps
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  {!generatedCourseId ? (
                    <div className="space-y-4">
                      <Alert>
                        <Info className="h-4 w-4" />
                        <AlertDescription>
                          Ready to generate comprehensive course content from your knowledge base sources.
                        </AlertDescription>
                      </Alert>

                      <div className="space-y-3">
                        <h4 className="font-medium text-sm">Generation Options:</h4>
                        <div className="space-y-2 text-sm">
                          <div className="flex items-center space-x-2">
                            <div className="w-2 h-2 bg-blue-500 rounded-full"></div>
                            <span><strong>KB Only:</strong> Strict adherence to your sources</span>
                          </div>
                          <div className="flex items-center space-x-2">
                            <div className="w-2 h-2 bg-purple-500 rounded-full"></div>
                            <span><strong>KB Priority:</strong> Sources first, fill gaps intelligently</span>
                          </div>
                          <div className="flex items-center space-x-2">
                            <div className="w-2 h-2 bg-green-500 rounded-full"></div>
                            <span><strong>KB Supplemented:</strong> Enhanced with external knowledge</span>
                          </div>
                        </div>
                      </div>

                      <Button 
                        className="w-full"
                        onClick={() => setCurrentStep('generate')}
                        disabled={!documentSummary || documentSummary.completed === 0}
                      >
                        <Sparkles className="h-4 w-4 mr-2" />
                        Start Course Generation
                      </Button>
                    </div>
                  ) : (
                    <div className="space-y-4">
                      <Alert>
                        <CheckCircle className="h-4 w-4" />
                        <AlertDescription>
                          Course generated successfully! Review and customize before deployment.
                        </AlertDescription>
                      </Alert>

                      <Button 
                        variant="outline" 
                        className="w-full"
                        onClick={() => setCurrentStep('review')}
                      >
                        <ArrowRight className="h-4 w-4 mr-2" />
                        Review Generated Course
                      </Button>
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>
          </div>

          {/* File Management */}
          {baseClassInfo && (
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center space-x-2">
                  <Upload className="h-5 w-5" />
                  <span>Knowledge Base Management</span>
                </CardTitle>
                <CardDescription>
                  Manage your source documents and files
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                <FileListTable 
                  organisationId={baseClassInfo.organisation_id}
                  baseClassId={baseClassId}
                />
              </CardContent>
            </Card>
          )}
        </div>
      )}

      {currentStep === 'generate' && (
        <div className="space-y-6">
          <CourseGenerationInterface
            baseClassId={baseClassId}
            baseClassInfo={baseClassInfo}
            onCourseGenerated={handleCourseGenerated}
          />
        </div>
      )}

      {currentStep === 'review' && (
        <div className="space-y-6">
          {generatedCourseId ? (
            <GeneratedCourseViewer
              courseOutlineId={generatedCourseId}
              baseClassId={baseClassId}
              onDeployToCourse={handleDeployToCourse}
            />
          ) : (
            <Card>
              <CardContent className="pt-6">
                <div className="text-center">
                  <Alert className="max-w-md mx-auto">
                    <AlertDescription>
                      No generated course found. Please return to the generation step.
                    </AlertDescription>
                  </Alert>
                  <Button 
                    variant="outline" 
                    className="mt-4"
                    onClick={() => setCurrentStep('generate')}
                  >
                    <ArrowRight className="h-4 w-4 mr-2" />
                    Go to Course Generation
                  </Button>
                </div>
              </CardContent>
            </Card>
          )}
        </div>
      )}

      {currentStep === 'deploy' && (
        <div className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center space-x-2">
                <CheckCircle className="h-5 w-5 text-green-500" />
                <span>Course Deployed Successfully</span>
              </CardTitle>
              <CardDescription>
                Your course is now live and ready for students
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="bg-green-50 border border-green-200 rounded-lg p-6">
                <div className="text-green-800 space-y-2">
                  <div className="flex items-center space-x-2">
                    <CheckCircle className="h-4 w-4" />
                    <span>Course structure and modules created</span>
                  </div>
                  <div className="flex items-center space-x-2">
                    <CheckCircle className="h-4 w-4" />
                    <span>Learning paths and lessons generated</span>
                  </div>
                  <div className="flex items-center space-x-2">
                    <CheckCircle className="h-4 w-4" />
                    <span>Assessments and quizzes configured</span>
                  </div>
                  <div className="flex items-center space-x-2">
                    <CheckCircle className="h-4 w-4" />
                    <span>Course is live and accessible to students</span>
                  </div>
                </div>
              </div>

              <div className="flex gap-4">
                <Button 
                  className="flex-1"
                  onClick={() => window.location.href = `/teach/courses/${baseClassId}`}
                >
                  <Settings className="h-4 w-4 mr-2" />
                  Manage Course
                </Button>
                <Button 
                  variant="outline"
                  className="flex-1"
                  onClick={() => setCurrentStep('overview')}
                >
                  <Sparkles className="h-4 w-4 mr-2" />
                  Create New Course
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  );
} 