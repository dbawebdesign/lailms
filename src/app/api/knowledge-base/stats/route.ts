import { NextRequest, NextResponse } from 'next/server';
import { createSupabaseServerClient } from '@/lib/supabase/server';
import { Tables } from 'packages/types/db';

export async function GET(request: NextRequest) {
  try {
    const supabase = createSupabaseServerClient();

    // Check authentication
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    // Get total documents count for the current user
    const { count: totalDocuments, error: documentsError } = await supabase
      .from('documents')
      .select('*', { count: 'exact', head: true })
      .eq('uploaded_by', user.id);

    if (documentsError) {
      console.error('Error fetching documents count:', documentsError);
    }

    // Get pending processing count for the current user
    const { count: pendingProcessing, error: pendingError } = await supabase
      .from('documents')
      .select('*', { count: 'exact', head: true })
      .eq('uploaded_by', user.id)
      .in('status', ['queued', 'processing']);

    if (pendingError) {
      console.error('Error fetching pending documents count:', pendingError);
    }

    // Get recent uploads (last 7 days) for the current user
    const sevenDaysAgo = new Date();
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);

    const { count: recentUploads, error: recentError } = await supabase
      .from('documents')
      .select('*', { count: 'exact', head: true })
      .eq('uploaded_by', user.id)
      .gte('created_at', sevenDaysAgo.toISOString());

    if (recentError) {
      console.error('Error fetching recent uploads count:', recentError);
    }

    // Get active base classes count (classes owned by user that have documents uploaded by them)
    const { data: activeClasses, error: classesError } = await supabase
      .from('base_classes')
      .select(`
        id,
        documents!inner (
          id
        )
      `)
      .eq('user_id', user.id)
      .eq('documents.uploaded_by', user.id);

    if (classesError) {
      console.error('Error fetching active classes:', classesError);
    }

    const stats = {
      totalDocuments: totalDocuments || 0,
      pendingProcessing: pendingProcessing || 0,
      recentUploads: recentUploads || 0,
      activeClassesWithKB: activeClasses?.length || 0
    };

    return NextResponse.json(stats);

  } catch (error) {
    console.error('Knowledge base stats error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
} 