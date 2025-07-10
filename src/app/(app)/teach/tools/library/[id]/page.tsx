import { createSupabaseServerClient } from '@/lib/supabase/server';
import { redirect } from 'next/navigation';
import { CreationViewer } from '@/components/teach/tools/CreationViewer';
import { Tables } from 'packages/types/db';

interface CreationViewPageProps {
  params: Promise<{
    id: string;
  }>;
}

export default async function CreationViewPage({ params }: CreationViewPageProps) {
  const { id } = await params;
  const supabase = createSupabaseServerClient();

  // Check authentication
  const { data: { user }, error: authError } = await supabase.auth.getUser();

  if (authError || !user) {
    redirect('/login');
  }

  // Get user profile to verify teacher role
  const { data: profile, error: profileError } = await supabase
    .from('profiles')
    .select('role, organisation_id')
    .eq('user_id', user.id)
    .single<Tables<"profiles">>();

  if (profileError || !profile || profile.role !== 'teacher') {
    redirect('/');
  }

  // Verify the creation exists and belongs to the user
  const { data: creation, error: creationError } = await supabase
    .from('teacher_tool_creations')
    .select('id, user_id')
    .eq('id', id)
    .eq('user_id', user.id)
    .single();

  if (creationError || !creation) {
    redirect('/teach/tools/library');
  }

  return (
    <div className="container mx-auto px-4 py-6">
      <CreationViewer creationId={id} />
    </div>
  );
} 