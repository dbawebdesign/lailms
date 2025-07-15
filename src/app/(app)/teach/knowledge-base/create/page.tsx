import React from 'react';
import { createSupabaseServerClient } from '@/lib/supabase/server';
import { redirect } from 'next/navigation';
import StreamlinedCourseCreator from '@/components/knowledge-base/StreamlinedCourseCreator';
import { Tables } from 'packages/types/db';

interface PageProps {
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>;
}

export default async function CreateKnowledgeBaseCoursePage({ searchParams }: PageProps) {
  const resolvedSearchParams = await searchParams;
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

  // Extract baseClassId from search params if provided
  const baseClassId = typeof resolvedSearchParams.baseClassId === 'string' ? resolvedSearchParams.baseClassId : undefined;

  return (
    <StreamlinedCourseCreator 
      userId={user.id}
      organisationId={profile.organisation_id}
      existingBaseClassId={baseClassId}
    />
  );
} 