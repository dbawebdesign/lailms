import React from 'react';
import { createSupabaseServerClient } from '@/lib/supabase/server';
import { redirect } from 'next/navigation';
import KnowledgeBaseCourseGenerator from '@/components/knowledge-base/KnowledgeBaseCourseGenerator';

interface PageProps {
  params: {
    baseClassId: string;
  };
}

export default async function KnowledgeBasePage({ params }: PageProps) {
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
    .eq('id', params.baseClassId)
    .eq('user_id', user.id)
    .single();

  if (baseClassError || !baseClass) {
    redirect('/teach/base-classes');
  }

  // Get document count for this base class
  const { count: documentCount } = await supabase
    .from('documents')
    .select('*', { count: 'exact', head: true })
    .eq('base_class_id', params.baseClassId)
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

        {/* Base Class Info */}
        <div className="bg-muted/30 rounded-lg p-6">
          <div className="flex items-start justify-between">
            <div>
              <h2 className="text-xl font-semibold">{baseClass.name}</h2>
              <p className="text-muted-foreground mt-1">{baseClass.description}</p>
              <div className="flex items-center space-x-4 mt-3 text-sm text-muted-foreground">
                <span>{documentCount || 0} documents uploaded</span>
                <span>•</span>
                <span>Created {new Date(baseClass.created_at).toLocaleDateString()}</span>
              </div>
            </div>
          </div>
        </div>

        {/* Main Course Generation Interface */}
        <KnowledgeBaseCourseGenerator baseClassId={params.baseClassId} />
      </div>
    </div>
  );
} 