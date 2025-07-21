import { NextRequest, NextResponse } from 'next/server';
import { createSupabaseServerClient } from '@/lib/supabase/server';
import { FullTextSearchService } from '@/lib/services/full-text-search';

/**
 * GET /api/study-spaces/content/suggestions?baseClassId=xxx&query=xxx
 * Get search suggestions for autocomplete
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
    const query = searchParams.get('query');
    const limit = parseInt(searchParams.get('limit') || '10');
    
    if (!baseClassId) {
      return NextResponse.json({ 
        error: 'Base class ID is required' 
      }, { status: 400 });
    }

    if (!query || query.trim().length < 2) {
      return NextResponse.json({ 
        error: 'Query must be at least 2 characters' 
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
      .select('id, organisation_id')
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

    // Get suggestions using our search service
    const searchService = new FullTextSearchService(supabase);
    const suggestions = await searchService.getSearchSuggestions(
      baseClassId,
      query.trim(),
      limit
    );

    return NextResponse.json({
      query: query.trim(),
      suggestions,
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    console.error('Search suggestions API error:', error);
    
    return NextResponse.json({
      error: 'Failed to get suggestions',
      details: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 });
  }
} 