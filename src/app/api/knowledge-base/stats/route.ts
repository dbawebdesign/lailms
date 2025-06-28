import { NextRequest, NextResponse } from 'next/server';
import { createSupabaseServerClient } from '@/lib/supabase/server';
import { Tables } from 'packages/types/db';

export async function GET(request: NextRequest) {
  try {
    const supabase = createSupabaseServerClient();
    const { searchParams } = new URL(request.url);
    const organisationId = searchParams.get('organisationId');

    if (!organisationId) {
      return NextResponse.json(
        { error: 'Organisation ID is required' },
        { status: 400 }
      );
    }

    // Check authentication
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    // Verify user has access to this organization
    const { data: profile, error: profileError } = await supabase
      .from('profiles')
      .select('organisation_id')
      .eq('user_id', user.id)
      .single<Tables<"profiles">>();

    if (profileError || !profile || profile.organisation_id !== organisationId) {
      return NextResponse.json(
        { error: 'Access denied' },
        { status: 403 }
      );
    }

    // Get total documents count
    const { count: totalDocuments, error: documentsError } = await supabase
      .from('documents')
      .select('*', { count: 'exact', head: true })
      .eq('organisation_id', organisationId);

    if (documentsError) {
      console.error('Error fetching documents count:', documentsError);
    }

    // Get pending processing count
    const { count: pendingProcessing, error: pendingError } = await supabase
      .from('documents')
      .select('*', { count: 'exact', head: true })
      .eq('organisation_id', organisationId)
      .in('status', ['queued', 'processing']);

    if (pendingError) {
      console.error('Error fetching pending documents count:', pendingError);
    }

    // Get recent uploads (last 7 days)
    const sevenDaysAgo = new Date();
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);

    const { count: recentUploads, error: recentError } = await supabase
      .from('documents')
      .select('*', { count: 'exact', head: true })
      .eq('organisation_id', organisationId)
      .gte('created_at', sevenDaysAgo.toISOString());

    if (recentError) {
      console.error('Error fetching recent uploads count:', recentError);
    }

    // Get active base classes count (classes with documents)
    const { data: activeClasses, error: classesError } = await supabase
      .from('base_classes')
      .select(`
        id,
        documents!inner (
          id
        )
      `)
      .eq('user_id', user.id);

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