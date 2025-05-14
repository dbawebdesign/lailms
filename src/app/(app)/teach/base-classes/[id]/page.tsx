'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { useParams, useRouter, useSearchParams } from 'next/navigation';
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Loader2, Save, Sparkles } from 'lucide-react';
import Link from 'next/link';
import { BaseClass, GeneratedLesson } from '@/types/teach';
// import { createClientComponentClient } from '@supabase/auth-helpers-nextjs';
import { supabase } from '@/utils/supabase/browser'; // <-- Revert to alias path
// import { supabase } from '../../../../../utils/supabase/browser'; // <-- Remove relative path
import LunaContextElement from '@/components/luna/LunaContextElement';

// Import the new components
import BaseClassDocumentUpload from '@/components/teach/BaseClassDocumentUpload';
import BaseClassDocumentList from '@/components/teach/BaseClassDocumentList';

interface CourseModule {
  title: string;
  description: string;
  topics: string[];
  suggestedLessons: GeneratedLesson[];
  suggestedAssessments?: { type: string; description?: string }[];
}

interface BaseClassWithModules extends BaseClass {
  settings?: {
    generatedOutline?: {
      modules: CourseModule[];
    };
  };
}

export default function BaseClassDetailPage() {
  const params = useParams();
  const router = useRouter();
  const searchParams = useSearchParams();
  const idFromParams = params.id as string;
  const idFromQuery = searchParams.get('id');
  const baseClassId = idFromParams || idFromQuery;
  const [baseClass, setBaseClass] = useState<BaseClassWithModules | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState('overview');
  const [documentListVersion, setDocumentListVersion] = useState(0); // State for refreshing list

  // New state variables for content generation
  const [isGeneratingContent, setIsGeneratingContent] = useState(false);
  const [generationStatus, setGenerationStatus] = useState('');
  const [generationError, setGenerationError] = useState<string | null>(null);

  // Callback to refresh the document list
  const refreshDocumentList = useCallback(() => {
    setDocumentListVersion(prev => prev + 1);
  }, []);

  useEffect(() => {
    const fetchBaseClass = async () => {
      setIsLoading(true);
      setError(null);
      
      try {
        console.log('Fetching base class with ID:', baseClassId);
        const { data, error } = await supabase
          .from('base_classes')
          .select('*')
          .eq('id', baseClassId)
          .single();
          
        if (error) throw error;
        if (!data) throw new Error('Base class not found');
        
        // Parse the data and cast to our interface
        const baseClassData: BaseClassWithModules = {
          id: data.id,
          name: data.name,
          description: data.description || '',
          subject: data.settings?.subject || '',
          gradeLevel: data.settings?.gradeLevel || '',
          lengthInWeeks: data.settings?.lengthInWeeks || 0,
          creationDate: data.created_at,
          organisation_id: data.organisation_id,
          settings: data.settings || {}
        };
        
        console.log('Fetched base class data:', baseClassData);
        setBaseClass(baseClassData);
      } catch (err: any) {
        console.error('Error fetching base class:', err, 'using ID:', baseClassId);
        let displayError = err.message || 'Failed to load base class';
        if (err.message && err.message.includes('JSON object requested')) {
          displayError = `${err.message} (ID: ${baseClassId})`;
        }
        setError(displayError);
      } finally {
        setIsLoading(false);
      }
    };
    
    if (baseClassId) {
      fetchBaseClass();
    } else {
      console.error('BaseClassDetailPage: baseClassId is not available. Params:', params, 'Query:', searchParams.toString());
      setError('Course ID is missing. Cannot load course details.');
      setIsLoading(false);
    }
  }, [baseClassId, params, searchParams]);
  
  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-full">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
        <span className="ml-2">Loading course structure...</span>
      </div>
    );
  }
  
  if (error || !baseClass) {
    return (
      <div className="p-6 max-w-4xl mx-auto">
        <div className="bg-destructive/10 p-4 rounded-lg text-destructive">
          <h2 className="font-semibold text-lg">Error Loading Course</h2>
          <p>{error || 'Unable to load course details'}</p>
        </div>
        <Button className="mt-4" asChild>
          <Link href="/teach/base-classes">Return to Base Classes</Link>
        </Button>
      </div>
    );
  }
  
  // Extract modules from the settings if they exist
  const modules = baseClass.settings?.generatedOutline?.modules || [];

  const handleGenerateAllLessonsContent = async () => {
    if (!baseClassId) {
      setGenerationError('Base Class ID is missing.');
      return;
    }

    setIsGeneratingContent(true);
    setGenerationStatus('Fetching lesson list...');
    setGenerationError(null);

    let lessonsToProcess: { id: string; title: string }[] = [];

    try {
      const response = await fetch(`/api/teach/base-classes/${baseClassId}/lessons`);
      if (!response.ok) {
        const errorData = await response.json().catch(() => ({ message: 'Failed to fetch lesson list' }));
        throw new Error(errorData.message || 'Failed to fetch lesson list');
      }
      const data = await response.json();
      lessonsToProcess = data.lessons || [];

      if (lessonsToProcess.length === 0) {
        setGenerationStatus('No lessons found for this base class to generate content for.');
        setIsGeneratingContent(false);
        return;
      }

      setGenerationStatus(`Found ${lessonsToProcess.length} lessons. Starting content generation...`);
    } catch (err: any) {
      console.error('Error fetching lessons:', err);
      setGenerationError(err.message || 'Could not retrieve lessons for content generation.');
      setIsGeneratingContent(false);
      return;
    }

    const CONCURRENCY_LIMIT = 3; // Process 3 lessons at a time
    let completedCount = 0;
    let errorCount = 0;
    const totalLessons = lessonsToProcess.length;
    const results: { lessonTitle: string; success: boolean; error?: string }[] = [];

    // Function to process a single lesson
    const processLesson = async (lesson: { id: string; title: string }) => {
      try {
        setGenerationStatus(`Generating content for: \"${lesson.title}\" (${completedCount + 1}/${totalLessons})...`);
        const res = await fetch(`/api/teach/lessons/${lesson.id}/auto-generate-sections`, {
          method: 'POST',
        });
        if (!res.ok) {
          const errorData = await res.json().catch(() => ({ message: `HTTP error ${res.status}` }));
          throw new Error(errorData.message || `Failed to generate content for \"${lesson.title}\"` );
        }
        const resultData = await res.json();
        console.log(`Successfully generated content for lesson ${lesson.id} (\"${lesson.title}\"):`, resultData);
        results.push({ lessonTitle: lesson.title, success: true });
      } catch (e: any) {
        console.error(`Error generating content for lesson ${lesson.id} (\"${lesson.title}\"):`, e);
        results.push({ lessonTitle: lesson.title, success: false, error: e.message });
        errorCount++;
      }
      completedCount++;
      setGenerationStatus(`Processed: \"${lesson.title}\" (${completedCount}/${totalLessons})...`);
    };

    // Concurrency management
    const queue = [...lessonsToProcess];
    const activePromises: Promise<void>[] = [];

    const runNext = () => {
      if (queue.length === 0) {
        return null; // All tasks are either active or finished
      }
      const lesson = queue.shift()!;
      const promise = processLesson(lesson).then(() => {
        // Remove this promise from activePromises and run the next one if available
        activePromises.splice(activePromises.indexOf(promise), 1);
        const nextPromise = runNext();
        if (nextPromise) {
          activePromises.push(nextPromise);
        }
      });
      return promise;
    };

    for (let i = 0; i < Math.min(CONCURRENCY_LIMIT, queue.length); i++) {
      const initialPromise = runNext();
      if (initialPromise) activePromises.push(initialPromise);
    }

    await Promise.allSettled(activePromises); // Wait for initial batch
    // Wait for all subsequent dynamic promises to complete
    // This simple model waits for the initial set; more robust queueing might be needed for very large numbers
    // For this case, we rely on processLesson updating completedCount and the loop condition of activePromises to eventually empty
    // A more robust approach for very large N might involve a while loop checking completedCount < totalLessons
    
    // Simplified: Wait for all processLesson calls to complete by checking completedCount
    while(completedCount < totalLessons && activePromises.length > 0) {
        await Promise.allSettled(activePromises); // Wait for currently active ones
        // Check if more tasks were added by runNext and keep waiting
        if(queue.length > 0 && activePromises.length < CONCURRENCY_LIMIT){
            const nextP = runNext();
            if(nextP) activePromises.push(nextP);
        }
        if (activePromises.length === 0 && queue.length > 0) { // Repopulate if queue still has items but active is empty
             for (let i = 0; i < Math.min(CONCURRENCY_LIMIT, queue.length); i++) {
                const initialPromise = runNext();
                if (initialPromise) activePromises.push(initialPromise);
            }
        }
        // Small delay to prevent tight loop if something unexpected happens
        if (activePromises.length > 0) await new Promise(r => setTimeout(r, 100)); 
    }
    // Final wait for any stragglers if the loop exited prematurely
    while (activePromises.length > 0) {
        await Promise.allSettled(activePromises);
    }

    if (completedCount !== totalLessons) {
        console.warn(`Concurrency issue: completedCount (${completedCount}) !== totalLessons (${totalLessons})`);
        // Potentially add any remaining queue items to errors or re-attempt (out of scope for this immediate fix)
        // For now, assume all processLesson calls have resolved.
    }

    let finalMessage = `Content generation complete. ${completedCount - errorCount} of ${totalLessons} lessons successful.`;
    if (errorCount > 0) {
      finalMessage += ` ${errorCount} failed.`;
      setGenerationError(`Some lessons failed. Check console for details. Failures: ${results.filter(r => !r.success).map(r => r.lessonTitle).join(', ')}`);
    }
    setGenerationStatus(finalMessage);
    setIsGeneratingContent(false);
    console.log('All lesson content generation attempts finished.', results);
  };

  return (
    <div className="p-6 max-w-6xl mx-auto">
      <header className="mb-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold">{baseClass.name}</h1>
            <p className="text-muted-foreground mt-1">{baseClass.description}</p>
          </div>
          <div className="flex gap-2">
            {/* New Button for Generating All Lesson Content */}
            <Button 
              variant="outline" 
              onClick={handleGenerateAllLessonsContent}
              disabled={isGeneratingContent}
            >
              {isGeneratingContent ? (
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              ) : (
                <Sparkles className="h-4 w-4 mr-2" />
              )}
              {isGeneratingContent ? generationStatus : 'Generate All Lesson Content'}
            </Button>
            <Button variant="outline" asChild>
              <Link href="/teach/base-classes">Back to Classes</Link>
            </Button>
            <Button variant="default">
              <Save className="h-4 w-4 mr-2" />
              Save Changes
            </Button>
          </div>
        </div>
        {/* Generation Status/Error Display */}
        {isGeneratingContent && !generationError && (
          <div className="mt-2 p-2 bg-blue-50 border border-blue-200 text-blue-700 rounded-md text-sm">
            {generationStatus}
          </div>
        )}
        {generationError && (
          <div className="mt-2 p-2 bg-destructive/10 border border-destructive/20 text-destructive rounded-md text-sm">
            Error: {generationError}
          </div>
        )}
        <div className="flex flex-wrap gap-2 mt-2">
          {baseClass.subject && (
            <span className="bg-muted text-muted-foreground text-sm px-2 py-1 rounded">
              Subject: {baseClass.subject}
            </span>
          )}
          {baseClass.gradeLevel && (
            <span className="bg-muted text-muted-foreground text-sm px-2 py-1 rounded">
              Grade: {baseClass.gradeLevel}
            </span>
          )}
          {baseClass.lengthInWeeks > 0 && (
            <span className="bg-muted text-muted-foreground text-sm px-2 py-1 rounded">
              Length: {baseClass.lengthInWeeks} weeks
            </span>
          )}
        </div>
      </header>
      
      {/* Structure Tabs for organizing content */}
      <Tabs defaultValue="overview" className="w-full" value={activeTab} onValueChange={setActiveTab}>
        <TabsList className="grid grid-cols-4 mb-6">
          <TabsTrigger value="overview">Overview</TabsTrigger>
          <TabsTrigger value="paths">Learning Paths</TabsTrigger>
          <TabsTrigger value="lessons">Lessons</TabsTrigger>
          <TabsTrigger value="assessments">Assessments</TabsTrigger>
        </TabsList>

        {/* Document Management Section - Moved Here */}
        {baseClassId && (
          <div className="my-6 space-y-6"> {/* Added margin and spacing */}
            <BaseClassDocumentUpload 
              baseClassId={baseClassId} 
              onUploadSuccess={refreshDocumentList} 
            />
            <BaseClassDocumentList 
              baseClassId={baseClassId} 
              refreshCounter={documentListVersion} 
            />
          </div>
        )}
        
        <TabsContent value="overview" className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <Card>
              <CardHeader>
                <CardTitle>Course Structure</CardTitle>
                <CardDescription>Overview of the modules and topics in this course</CardDescription>
              </CardHeader>
              <LunaContextElement 
                type="course-structure" 
                role="display" 
                content={{ modules }}
                metadata={{ baseClassId: baseClass.id, baseClassName: baseClass.name }}
              >
                <CardContent>
                  {modules.length > 0 ? (
                    <div className="space-y-4">
                      {modules.map((module, idx) => (
                        <div key={idx} className="border rounded-lg p-4">
                          <h3 className="font-semibold text-lg">{module.title}</h3>
                          <p className="text-sm text-muted-foreground mb-2">Topics:</p>
                          <ul className="list-disc list-inside space-y-1 pl-2">
                            {module.topics.map((topic, topicIdx) => (
                              <li key={topicIdx} className="text-sm">{topic}</li>
                            ))}
                          </ul>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <p className="text-muted-foreground">No modules defined yet. Use the Class Co-Pilot to generate a course structure.</p>
                  )}
                </CardContent>
              </LunaContextElement>
            </Card>
            
            <Card>
              <CardHeader>
                <CardTitle>Instance Management</CardTitle>
                <CardDescription>Create and manage instances of this class</CardDescription>
              </CardHeader>
              <CardContent>
                <Button className="w-full mb-2" asChild>
                   <Link href={`/teach/instances/create?baseClassId=${baseClass.id}`}>Create New Instance</Link>
                </Button>
                <p className="text-sm text-muted-foreground mb-4">
                    Instances let you create multiple occurrences of this class for different periods, semesters, or years.
                </p>
                <Link href={`/teach/instances?baseClassId=${baseClass.id}`} className="text-sm text-primary hover:underline">
                  View All Instances
                </Link>
              </CardContent>
            </Card>
          </div>
        </TabsContent>
        
        <TabsContent value="paths" className="space-y-6">
          {/* Path-specific content can be added here */}
          <Card>
            <CardHeader>
              <CardTitle>Learning Paths</CardTitle>
              <CardDescription>Manage and visualize learning paths for this course.</CardDescription>
            </CardHeader>
            <CardContent>
              <p>Learning Path content will go here.</p>
            </CardContent>
          </Card>
        </TabsContent>
        
        <TabsContent value="lessons">
          <Card>
            <CardHeader>
              <CardTitle>Lessons</CardTitle>
              <CardDescription>Manage all lessons for this course</CardDescription>
            </CardHeader>
            <CardContent>
              {modules.length > 0 && modules.some(m => m.suggestedLessons && m.suggestedLessons.length > 0) ? (
                <div className="space-y-6">
                  {modules.map((module, idx) => module.suggestedLessons && module.suggestedLessons.length > 0 && (
                    <div key={idx} className="border rounded-lg p-4">
                      <h3 className="font-semibold">{module.title}</h3>
                      <div className="mt-2 space-y-2">
                        {module.suggestedLessons.map((lesson, lessonIdx) => (
                          <div key={lessonIdx} className="flex items-center justify-between p-2 bg-muted/50 rounded">
                            <div>
                              <p className="font-medium">{lesson.title}</p>
                              {lesson.objective && <p className="text-xs text-muted-foreground">{lesson.objective}</p>}
                            </div>
                            <Button variant="ghost" size="sm">Edit</Button>
                          </div>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="text-center py-8">
                  <p className="text-muted-foreground">No lessons have been created yet</p>
                  <Button className="mt-4">Create First Lesson</Button>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>
        
        <TabsContent value="assessments">
          <Card>
            <CardHeader>
              <CardTitle>Assessments</CardTitle>
              <CardDescription>Manage quizzes, tests, and assignments</CardDescription>
            </CardHeader>
            <CardContent>
              {modules.length > 0 && modules.some(m => m.suggestedAssessments && m.suggestedAssessments.length > 0) ? (
                <div className="space-y-6">
                  {modules.map((module, idx) => module.suggestedAssessments && module.suggestedAssessments.length > 0 && (
                    <div key={idx} className="border rounded-lg p-4">
                      <h3 className="font-semibold">{module.title}</h3>
                      <div className="mt-2 space-y-2">
                        {module.suggestedAssessments.map((assessment, assessmentIdx) => (
                          <div key={assessmentIdx} className="flex items-center justify-between p-2 bg-muted/50 rounded">
                            <div>
                              <p className="font-medium">{assessment.type}</p>
                              {assessment.description && <p className="text-xs text-muted-foreground">{assessment.description}</p>}
                            </div>
                            <Button variant="ghost" size="sm">Edit</Button>
                          </div>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="text-center py-8">
                  <p className="text-muted-foreground">No assessments have been created yet</p>
                  <Button className="mt-4">Create First Assessment</Button>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
} 