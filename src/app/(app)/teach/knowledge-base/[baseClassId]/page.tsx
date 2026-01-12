import React from 'react';
import { createSupabaseServerClient } from '@/lib/supabase/server';
import { redirect } from 'next/navigation';
import KnowledgeBaseCourseGenerator from '@/components/knowledge-base/KnowledgeBaseCourseGenerator';

// Force dynamic rendering for auth-protected pages
export const dynamic = 'force-dynamic';

interface PageProps {
  params: Promise<{
    baseClassId: string;
  }>;
}

export default async function KnowledgeBasePage({ params }: PageProps) {
  const { baseClassId } = await params;
  const supabase = createSupabaseServerClient();
  
  // Check authentication
  const { data: { user }, error: authError } = await supabase.auth.getUser();
  if (authError || !user) {
    redirect('/auth/signin');
  }

  // Verify user has access to this base class
  const { data: baseClass, error: baseClassError } = await supabase
    .from('base_classes')
    .select(`
      id,
      name,
      description,
      organisation_id,
      created_at,
      updated_at
    `)
    .eq('id', baseClassId)
    .eq('user_id', user.id)
    .single();

  if (baseClassError || !baseClass) {
    redirect('/teach/base-classes');
  }

  // Get document count for this base class
  const { count: documentCount } = await supabase
    .from('documents')
    .select('*', { count: 'exact', head: true })
    .eq('base_class_id', baseClassId)
    .eq('status', 'completed');

  return (
    <div className="min-h-screen bg-background">
      <div className="container mx-auto py-6 space-y-6">
        {/* Header */}
        <div className="border-b pb-6">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-3xl font-bold tracking-tight">Knowledge Base Course Generation</h1>
              <p className="text-muted-foreground mt-2">
                Generate comprehensive courses from your uploaded knowledge base content
              </p>
            </div>
          </div>
        </div>

        {/* Main Course Generation Interface */}
        <KnowledgeBaseCourseGenerator baseClassId={baseClassId} />
      </div>
    </div>
  );
} 