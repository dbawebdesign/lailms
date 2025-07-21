import { NextRequest, NextResponse } from 'next/server';
import { createSupabaseServerClient } from '@/lib/supabase/server';
import { ContentAggregationService } from '@/lib/services/content-aggregation';
import { FullTextSearchService } from '@/lib/services/full-text-search';

/**
 * POST /api/study-spaces/content/aggregate
 * Triggers content aggregation for a base class
 */
export async function POST(request: NextRequest) {
  try {
    const supabase = createSupabaseServerClient();
    
    // Check authentication
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Parse request body
    const { baseClassId, options = {} } = await request.json();
    
    if (!baseClassId) {
      return NextResponse.json({ 
        error: 'Base class ID is required' 
      }, { status: 400 });
    }

    // Verify user has access to this base class
    const { data: profile } = await supabase
      .from('profiles')
      .select('organisation_id, role, active_role')
      .eq('user_id', user.id)
      .single();

    if (!profile || !profile.organisation_id) {
      return NextResponse.json({ 
        error: 'User profile not found or missing organization' 
      }, { status: 404 });
    }

    // Check if user is teacher/admin or enrolled student
    const { data: baseClass } = await supabase
      .from('base_classes')
      .select('id, organisation_id, name')
      .eq('id', baseClassId)
      .eq('organisation_id', profile.organisation_id)
      .single();

    if (!baseClass) {
      return NextResponse.json({ 
        error: 'Base class not found or access denied' 
      }, { status: 404 });
    }

    // For students, verify enrollment
    const userRole = profile.active_role || profile.role;
    if (userRole === 'student') {
      const { data: enrollment } = await supabase
        .from('rosters')
        .select('id')
        .eq('profile_id', user.id!)
        .eq('role', 'student')
        .limit(1);

      if (!enrollment || enrollment.length === 0) {
        return NextResponse.json({ 
          error: 'Not enrolled in this class' 
        }, { status: 403 });
      }
    }

    // Initialize aggregation service and start processing
    const aggregationService = new ContentAggregationService();
    
    console.log(`Starting content aggregation for base class: ${baseClass.name} (${baseClassId})`);
    
    const stats = await aggregationService.aggregateClassContent(
      baseClassId,
      profile.organisation_id,
      {
        includeDocuments: options.includeDocuments !== false,
        includeAssessments: options.includeAssessments !== false,
        includeMediaAssets: options.includeMediaAssets !== false,
        forceReindex: options.forceReindex || false,
        batchSize: options.batchSize || 10
      }
    );

    return NextResponse.json({
      success: true,
      message: `Content aggregation completed for ${baseClass.name}`,
      baseClassId,
      baseClassName: baseClass.name,
      stats,
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    console.error('Content aggregation API error:', error);
    
    return NextResponse.json({
      error: 'Content aggregation failed',
      details: error instanceof Error ? error.message : 'Unknown error',
      timestamp: new Date().toISOString()
    }, { status: 500 });
  }
}

/**
 * GET /api/study-spaces/content/aggregate?baseClassId=xxx
 * Get aggregation status for a base class
 */
export async function GET(request: NextRequest) {
  try {
    const supabase = createSupabaseServerClient();
    
    // Check authentication
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const baseClassId = searchParams.get('baseClassId');
    
    if (!baseClassId) {
      return NextResponse.json({ 
        error: 'Base class ID is required' 
      }, { status: 400 });
    }

    // Get user's organization
    const { data: profile } = await supabase
      .from('profiles')
      .select('organisation_id')
      .eq('user_id', user.id!)
      .single();

    if (!profile || !profile.organisation_id) {
      return NextResponse.json({ 
        error: 'User profile not found or missing organization' 
      }, { status: 404 });
    }

    // Get content index stats using our search service
    const searchService = new FullTextSearchService(supabase);
    const contentStats = await searchService.getContentStatistics(baseClassId);
    
    const stats = {
      total_items: contentStats.total_content,
      by_type: contentStats.by_type,
      by_difficulty: contentStats.by_difficulty,
      avg_estimated_time: contentStats.avg_estimated_time,
      total_tags: contentStats.total_tags,
      last_indexed: null as string | null,
      is_indexed: contentStats.total_content > 0
    };

    // Get recent indexing jobs
    const { data: recentJobs } = await supabase
      .from('content_indexing_jobs')
      .select('*')
      .eq('base_class_id', baseClassId)
      .order('created_at', { ascending: false })
      .limit(5);

    return NextResponse.json({
      baseClassId,
      stats,
      recentJobs: recentJobs || [],
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    console.error('Content aggregation status API error:', error);
    
    return NextResponse.json({
      error: 'Failed to get aggregation status',
      details: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 });
  }
} 