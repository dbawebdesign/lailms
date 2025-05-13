'use client';

import React, { useState, useEffect } from 'react';
import { useParams, useRouter, useSearchParams } from 'next/navigation';
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Loader2, Save } from 'lucide-react';
import Link from 'next/link';
import { BaseClass } from '@/types/teach';
// import { createClientComponentClient } from '@supabase/auth-helpers-nextjs';
import { supabase } from '@/utils/supabase/browser'; // <-- Revert to alias path
// import { supabase } from '../../../../../utils/supabase/browser'; // <-- Remove relative path

interface CourseModule {
  title: string;
  topics: string[];
  suggestedLessons?: { title: string; objective?: string }[];
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

  return (
    <div className="p-6 max-w-6xl mx-auto">
      <header className="mb-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold">{baseClass.name}</h1>
            <p className="text-muted-foreground mt-1">{baseClass.description}</p>
          </div>
          <div className="flex gap-2">
            <Button variant="outline" asChild>
              <Link href="/teach/base-classes">Back to Classes</Link>
            </Button>
            <Button variant="default">
              <Save className="h-4 w-4 mr-2" />
              Save Changes
            </Button>
          </div>
        </div>
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
        
        <TabsContent value="overview" className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <Card>
              <CardHeader>
                <CardTitle>Course Structure</CardTitle>
                <CardDescription>Overview of the modules and topics in this course</CardDescription>
              </CardHeader>
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
            </Card>
            
            <Card>
              <CardHeader>
                <CardTitle>Instance Management</CardTitle>
                <CardDescription>Create and manage instances of this class</CardDescription>
              </CardHeader>
              <CardContent>
                <Button variant="outline" className="w-full mb-4">
                  Create New Instance
                </Button>
                <p className="text-sm text-muted-foreground">
                  Instances let you create multiple occurrences of this class for different periods, semesters, or years.
                </p>
                <div className="mt-4">
                  <Link href={`/teach/base-classes/${baseClassId}/instances`} className="text-sm text-primary underline">
                    View All Instances
                  </Link>
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>
        
        <TabsContent value="paths">
          <Card>
            <CardHeader>
              <CardTitle>Learning Paths</CardTitle>
              <CardDescription>Create and manage learning paths for this course</CardDescription>
            </CardHeader>
            <CardContent className="h-[400px] flex items-center justify-center">
              <div className="text-center">
                <p className="text-muted-foreground">Learning path editor will be implemented here</p>
                <p className="text-sm text-muted-foreground mt-2">This is where the SmartCanvas visual editor will go</p>
              </div>
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