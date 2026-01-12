import React from 'react';
import { createSupabaseServerClient } from '@/lib/supabase/server';
import { redirect } from 'next/navigation';
import TeacherKnowledgeBaseDashboard from '@/components/teach/knowledge/TeacherKnowledgeBaseDashboard';
import { Tables } from 'packages/types/db';

// Force dynamic rendering for auth-protected pages
export const dynamic = 'force-dynamic';

export default async function TeacherKnowledgePage() {
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

  // Get teacher's base classes for filtering
  const { data: baseClasses, error: baseClassesError } = await supabase
    .from('base_classes')
    .select(`
      id,
      name,
      description,
      created_at
    `)
    .eq('user_id', user.id)
    .order('created_at', { ascending: false })
    .returns<Array<{
      id: string;
      name: string;
      description: string | null;
      created_at: string;
    }>>();

  if (baseClassesError) {
    console.error('Error fetching base classes:', baseClassesError);
  }

  return (
    <div className="min-h-screen bg-background">
      <TeacherKnowledgeBaseDashboard 
        userId={user.id}
        organisationId={profile.organisation_id}
        baseClasses={baseClasses || []}
      />
    </div>
  );
} 