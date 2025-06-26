'use client';

import { useEffect, useState } from 'react';
import { FileUploadDropzone } from '@/components/knowledge-base/FileUploadDropzone';
import { FileListTable } from '@/components/knowledge-base/FileListTable';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { toast } from 'sonner';
import { createBrowserClient } from '@supabase/ssr';
import { Database } from '@learnologyai/types';
import { Loader2 } from 'lucide-react';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { Brain, BookOpen, Target, Lightbulb, ArrowRight } from 'lucide-react';

export default function KnowledgeBasePage() {
  const [userOrgId, setUserOrgId] = useState<string | null>(null);
  const [isLoadingOrg, setIsLoadingOrg] = useState(true);
  const [error, setError] = useState<string | null>(null);
  
  // Create Supabase client
  const supabase = createBrowserClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  );

  useEffect(() => {
    async function fetchUserOrganisation() {
      setIsLoadingOrg(true);
      setError(null);
      try {
        // Get the user session
        const { data: { session }, error: sessionError } = await supabase.auth.getSession();
        
        if (sessionError) throw new Error('Authentication error: ' + sessionError.message);
        if (!session) throw new Error('You must be logged in to access this page');
        
        // Get the user's organisation ID from their member record
        const { data: memberData, error: memberError } = await supabase
          .from('members')
          .select('organisation_id')
          .eq('auth_id', session.user.id)
          .single();
        
        if (memberError) throw new Error('Could not retrieve organization membership: ' + memberError.message);
        if (!memberData) throw new Error('You are not associated with any organization');
        
        // Type assertion for proper access
        const typedMemberData = memberData as unknown as { organisation_id: string };
        if (!typedMemberData.organisation_id) throw new Error('You are not associated with any organization');
        
        setUserOrgId(typedMemberData.organisation_id);
      } catch (err) {
        console.error("Failed to fetch user organisation context:", err);
        const message = err instanceof Error ? err.message : "An unknown error occurred";
        setError(`Failed to load context: ${message}`);
        toast.error(`Failed to load context: ${message}`);
        setUserOrgId(null);
      } finally {
        setIsLoadingOrg(false);
      }
    }

    fetchUserOrganisation();
  }, [supabase]);

  if (isLoadingOrg) {
    return (
      <div className="container mx-auto p-8 flex flex-col items-center justify-center min-h-[50vh]">
        <Loader2 className="h-8 w-8 animate-spin text-primary mb-4" />
        <p className="text-muted-foreground">Loading your organization context...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="container mx-auto p-8">
        <Card className="border-red-200 bg-red-50">
          <CardContent className="pt-6">
            <p className="text-red-600">{error}</p>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (!userOrgId) {
    return (
      <div className="container mx-auto p-8">
        <Card className="border-amber-200 bg-amber-50">
          <CardContent className="pt-6">
            <p className="text-amber-600">Could not determine your organisation context. Please contact an administrator.</p>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="container mx-auto p-4 space-y-6">
      <h1 className="text-3xl font-bold">Knowledge Base</h1>
      <p className="text-muted-foreground">Upload, manage, and search through your organization's documents.</p>

      {/* Course Creation Call-to-Action */}
      <Card className="border-primary/20 bg-primary/5">
        <CardHeader>
          <CardTitle className="flex items-center space-x-2">
            <Brain className="h-5 w-5 text-primary" />
            <span>Create Courses from Your Knowledge Base</span>
          </CardTitle>
          <CardDescription>
            Transform your knowledge base content into comprehensive, AI-generated courses with lessons, assessments, and structured learning paths.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="flex items-start space-x-3">
              <div className="inline-flex items-center justify-center w-8 h-8 rounded-full bg-blue-100">
                <BookOpen className="h-4 w-4 text-blue-600" />
              </div>
              <div>
                <h4 className="font-medium text-sm">KB Only Mode</h4>
                <p className="text-xs text-muted-foreground">Generate content exclusively from your uploaded sources</p>
              </div>
            </div>
            <div className="flex items-start space-x-3">
              <div className="inline-flex items-center justify-center w-8 h-8 rounded-full bg-purple-100">
                <Target className="h-4 w-4 text-purple-600" />
              </div>
              <div>
                <h4 className="font-medium text-sm">KB Priority Mode</h4>
                <p className="text-xs text-muted-foreground">Prioritize your content, fill gaps with general knowledge</p>
              </div>
            </div>
            <div className="flex items-start space-x-3">
              <div className="inline-flex items-center justify-center w-8 h-8 rounded-full bg-green-100">
                <Lightbulb className="h-4 w-4 text-green-600" />
              </div>
              <div>
                <h4 className="font-medium text-sm">KB Supplemented</h4>
                <p className="text-xs text-muted-foreground">Use KB as foundation, expand with general knowledge</p>
              </div>
            </div>
          </div>
          <div className="flex justify-end">
            <Button asChild className="px-6">
              <Link href="/teach/knowledge-base/create">
                <Brain className="mr-2 h-4 w-4" />
                Create Course from Knowledge Base
                <ArrowRight className="ml-2 h-4 w-4" />
              </Link>
            </Button>
          </div>
        </CardContent>
      </Card>

      <>
        <Card>
          <CardHeader>
            <CardTitle>Upload Documents</CardTitle>
            <CardDescription>
              Drag and drop files or click to select. Supported formats include PDF, DOCX, PPT, CSV, audio, and video files.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <FileUploadDropzone organisationId={userOrgId} />
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Uploaded Documents</CardTitle>
            <CardDescription>
              View and manage all documents in your organization's knowledge base.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <FileListTable organisationId={userOrgId} />
          </CardContent>
        </Card>
      </>
    </div>
  );
} 