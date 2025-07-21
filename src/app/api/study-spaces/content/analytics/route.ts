import { NextRequest, NextResponse } from 'next/server';
import { createSupabaseServerClient } from '@/lib/supabase/server';
import { FullTextSearchService } from '@/lib/services/full-text-search';

/**
 * GET /api/study-spaces/content/analytics?baseClassId=xxx
 * Get content analytics and statistics
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
    const includePopularTerms = searchParams.get('includePopularTerms') === 'true';
    
    if (!baseClassId) {
      return NextResponse.json({ 
        error: 'Base class ID is required' 
      }, { status: 400 });
    }

    // Get user's organization and verify access
    const { data: profile } = await supabase
      .from('profiles')
      .select('organisation_id, role, active_role')
      .eq('user_id', user.id!)
      .single();

    if (!profile || !profile.organisation_id) {
      return NextResponse.json({ 
        error: 'User profile not found or missing organization' 
      }, { status: 404 });
    }

    // Verify access to base class
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

    // Only allow teachers/admins to view detailed analytics
    const userRole = profile.active_role || profile.role;
    if (userRole === 'student') {
      return NextResponse.json({ 
        error: 'Students cannot access detailed analytics' 
      }, { status: 403 });
    }

    // Get analytics using our search service
    const searchService = new FullTextSearchService(supabase);
    
    // Get content statistics
    const contentStats = await searchService.getContentStatistics(baseClassId);
    
    // Get popular search terms if requested
    let popularTerms: any[] = [];
    if (includePopularTerms) {
      popularTerms = await searchService.getPopularSearchTerms(baseClassId, 20);
    }

    // Get recent indexing activity
    const { data: recentJobs } = await supabase
      .from('content_indexing_jobs')
      .select('id, status, progress, created_at, completed_at, processed_items, total_items')
      .eq('base_class_id', baseClassId)
      .order('created_at', { ascending: false })
      .limit(10);

    // Get content distribution over time
    const { data: contentTimeline } = await supabase
      .from('study_content_index')
      .select('created_at, content_type')
      .eq('base_class_id', baseClassId)
      .order('created_at', { ascending: false })
      .limit(100);

    // Process timeline data
    const timelineStats = processTimelineData(contentTimeline || []);

    return NextResponse.json({
      baseClassId,
      baseClassName: baseClass.name,
      contentStatistics: contentStats,
      popularTerms: includePopularTerms ? popularTerms : undefined,
      recentIndexingJobs: recentJobs || [],
      contentTimeline: timelineStats,
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    console.error('Content analytics API error:', error);
    
    return NextResponse.json({
      error: 'Failed to get analytics',
      details: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 });
  }
}

/**
 * Process timeline data to create aggregated statistics
 */
function processTimelineData(contentData: any[]): any {
  if (!contentData || contentData.length === 0) {
    return { daily: {}, weekly: {}, byType: {} };
  }

  const daily: Record<string, number> = {};
  const weekly: Record<string, number> = {};
  const byType: Record<string, Record<string, number>> = {};

  contentData.forEach(item => {
    const date = new Date(item.created_at);
    const dayKey = date.toISOString().split('T')[0]; // YYYY-MM-DD
    const weekKey = getWeekKey(date);
    const contentType = item.content_type || 'unknown';

    // Daily counts
    daily[dayKey] = (daily[dayKey] || 0) + 1;

    // Weekly counts
    weekly[weekKey] = (weekly[weekKey] || 0) + 1;

    // By type and day
    if (!byType[contentType]) {
      byType[contentType] = {};
    }
    byType[contentType][dayKey] = (byType[contentType][dayKey] || 0) + 1;
  });

  return { daily, weekly, byType };
}

/**
 * Get week key for date (e.g., "2024-W01")
 */
function getWeekKey(date: Date): string {
  const year = date.getFullYear();
  const week = getWeekNumber(date);
  return `${year}-W${week.toString().padStart(2, '0')}`;
}

/**
 * Get ISO week number
 */
function getWeekNumber(date: Date): number {
  const d = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()));
  const dayNum = d.getUTCDay() || 7;
  d.setUTCDate(d.getUTCDate() + 4 - dayNum);
  const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
  return Math.ceil((((d.getTime() - yearStart.getTime()) / 86400000) + 1) / 7);
} 