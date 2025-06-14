'use client';

import React, { useState } from 'react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { FileUploadDropzone } from './FileUploadDropzone';
import { FileListTable } from './FileListTable';
import CourseGenerationInterface from './CourseGenerationInterface';
import GeneratedCourseViewer from './GeneratedCourseViewer';
import { BookOpen, Upload, Brain, ArrowRight, CheckCircle } from 'lucide-react';

interface KnowledgeBaseCourseGeneratorProps {
  baseClassId: string;
}

type WorkflowStep = 'upload' | 'generate' | 'review' | 'deploy';

export default function KnowledgeBaseCourseGenerator({ baseClassId }: KnowledgeBaseCourseGeneratorProps) {
  const [currentStep, setCurrentStep] = useState<WorkflowStep>('upload');
  const [generatedCourseId, setGeneratedCourseId] = useState<string | null>(null);
  const [hasDocuments, setHasDocuments] = useState(false);

  const handleCourseGenerated = (courseOutlineId: string) => {
    setGeneratedCourseId(courseOutlineId);
    setCurrentStep('review');
  };

  const handleDeployToCourse = (courseOutlineId: string) => {
    setCurrentStep('deploy');
    // This would integrate with the existing course structure
    console.log('Deploying course:', courseOutlineId);
  };

  const canProceedToGenerate = hasDocuments || true; // Allow generation even without documents

  const stepConfig = {
    upload: {
      title: 'Upload Knowledge Base',
      description: 'Upload documents that will form the foundation of your course',
      icon: <Upload className="h-5 w-5" />,
      completed: hasDocuments
    },
    generate: {
      title: 'Generate Course',
      description: 'Configure and generate your course from the knowledge base',
      icon: <Brain className="h-5 w-5" />,
      completed: !!generatedCourseId
    },
    review: {
      title: 'Review & Refine',
      description: 'Review the generated course and make adjustments',
      icon: <BookOpen className="h-5 w-5" />,
      completed: currentStep === 'deploy'
    },
    deploy: {
      title: 'Deploy Course',
      description: 'Deploy the course to your class structure',
      icon: <CheckCircle className="h-5 w-5" />,
      completed: currentStep === 'deploy'
    }
  };

  return (
    <div className="w-full space-y-6">
      {/* Workflow Steps */}
      <Card>
        <CardHeader>
          <CardTitle>Course Generation Workflow</CardTitle>
          <CardDescription>
            Follow these steps to create a course from your knowledge base
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-between">
            {Object.entries(stepConfig).map(([step, config], index) => (
              <React.Fragment key={step}>
                <div className="flex flex-col items-center space-y-2">
                  <Button
                    variant={currentStep === step ? 'default' : config.completed ? 'secondary' : 'outline'}
                    size="lg"
                    className="h-12 w-12 rounded-full p-0"
                    onClick={() => {
                      if (step === 'upload' || (step === 'generate' && canProceedToGenerate) || 
                          (step === 'review' && generatedCourseId)) {
                        setCurrentStep(step as WorkflowStep);
                      }
                    }}
                    disabled={
                      (step === 'generate' && !canProceedToGenerate) ||
                      (step === 'review' && !generatedCourseId) ||
                      (step === 'deploy' && !generatedCourseId)
                    }
                  >
                    {config.completed ? <CheckCircle className="h-5 w-5" /> : config.icon}
                  </Button>
                  <div className="text-center">
                    <div className="font-medium text-sm">{config.title}</div>
                    <div className="text-xs text-muted-foreground max-w-24">{config.description}</div>
                  </div>
                </div>
                {index < Object.keys(stepConfig).length - 1 && (
                  <ArrowRight className="h-4 w-4 text-muted-foreground" />
                )}
              </React.Fragment>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Step Content */}
      <div className="min-h-[600px]">
        {currentStep === 'upload' && (
          <div className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center space-x-2">
                  <Upload className="h-5 w-5" />
                  <span>Upload Knowledge Base Content</span>
                </CardTitle>
                <CardDescription>
                  Upload documents, PDFs, videos, or URLs that will be used to generate your course content.
                  You can also proceed without uploads to generate courses from general knowledge.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                <FileUploadDropzone 
                  baseClassId={baseClassId} 
                  onUploadComplete={() => setHasDocuments(true)}
                />
                <FileListTable 
                  baseClassId={baseClassId}
                  onDocumentsChange={(count) => setHasDocuments(count > 0)}
                />
              </CardContent>
            </Card>

            <div className="flex justify-end">
              <Button 
                onClick={() => setCurrentStep('generate')}
                disabled={!canProceedToGenerate}
              >
                Proceed to Course Generation
                <ArrowRight className="ml-2 h-4 w-4" />
              </Button>
            </div>
          </div>
        )}

        {currentStep === 'generate' && (
          <div className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center space-x-2">
                  <Brain className="h-5 w-5" />
                  <span>Generate Course</span>
                </CardTitle>
                <CardDescription>
                  Configure how your course should be generated from the knowledge base content
                </CardDescription>
              </CardHeader>
            </Card>

            <CourseGenerationInterface
              baseClassId={baseClassId}
              onCourseGenerated={handleCourseGenerated}
            />
          </div>
        )}

        {currentStep === 'review' && generatedCourseId && (
          <div className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center space-x-2">
                  <BookOpen className="h-5 w-5" />
                  <span>Review Generated Course</span>
                </CardTitle>
                <CardDescription>
                  Review the generated course outline and content before deploying
                </CardDescription>
              </CardHeader>
            </Card>

            <GeneratedCourseViewer
              courseOutlineId={generatedCourseId}
              onDeployToCourse={handleDeployToCourse}
            />
          </div>
        )}

        {currentStep === 'deploy' && (
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center space-x-2">
                <CheckCircle className="h-5 w-5 text-green-500" />
                <span>Course Deployed Successfully</span>
              </CardTitle>
              <CardDescription>
                Your course has been deployed and is ready for students
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="bg-green-50 border border-green-200 rounded-lg p-4">
                <div className="text-green-800">
                  ✅ Course structure created<br />
                  ✅ Lessons and content generated<br />
                  ✅ Assessments configured<br />
                  ✅ Ready for student enrollment
                </div>
              </div>

              <div className="flex space-x-4">
                <Button variant="default">
                  View Course
                </Button>
                <Button variant="outline">
                  Manage Enrollments
                </Button>
                <Button variant="outline" onClick={() => {
                  setCurrentStep('upload');
                  setGeneratedCourseId(null);
                }}>
                  Create Another Course
                </Button>
              </div>
            </CardContent>
          </Card>
        )}
      </div>

      {/* Help Section */}
      <Card>
        <CardHeader>
          <CardTitle>Knowledge Base Course Generation</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="space-y-2">
              <div className="flex items-center space-x-2">
                <Badge variant="outline">KB Only</Badge>
              </div>
              <p className="text-sm text-muted-foreground">
                Generate content exclusively from your uploaded sources. Best for compliance training and certification courses.
              </p>
            </div>
            <div className="space-y-2">
              <div className="flex items-center space-x-2">
                <Badge variant="outline">KB Priority</Badge>
              </div>
              <p className="text-sm text-muted-foreground">
                Prioritize your knowledge base content while filling small gaps with general knowledge. Balanced approach.
              </p>
            </div>
            <div className="space-y-2">
              <div className="flex items-center space-x-2">
                <Badge variant="outline">KB Supplemented</Badge>
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