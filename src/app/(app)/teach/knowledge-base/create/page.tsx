import React from 'react';
import { createSupabaseServerClient } from '@/lib/supabase/server';
import { redirect } from 'next/navigation';
import KnowledgeBaseCourseCreator from '@/components/knowledge-base/KnowledgeBaseCourseCreator';
import { Tables } from 'packages/types/db';

export default async function CreateKnowledgeBaseCoursePage() {
  const supabase = createSupabaseServerClient();
  
  // Check authentication
  const { data: { user }, error: authError } = await supabase.auth.getUser();
  if (authError || !user) {
    redirect('/auth/signin');
  }

  // Get user's organization
  const { data: profile, error: profileError } = await supabase
    .from('profiles')
    .select('organisation_id')
    .eq('user_id', user.id)
    .single<Tables<"profiles">>();

  if (profileError || !profile?.organisation_id) {
    redirect('/onboarding');
  }

  return (
    <div className="min-h-screen bg-background">
      <div className="container mx-auto py-6 space-y-6">
        {/* Header */}
        <div className="border-b pb-6">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-3xl font-bold tracking-tight">Create Knowledge Base Course</h1>
              <p className="text-muted-foreground mt-2">
                Transform your knowledge base content into comprehensive courses with AI-powered generation
              </p>
            </div>
          </div>
        </div>

        {/* Main Course Creator */}
        <KnowledgeBaseCourseCreator 
          userId={user.id}
          organisationId={profile.organisation_id}
        />
      </div>
    </div>
  );
} 