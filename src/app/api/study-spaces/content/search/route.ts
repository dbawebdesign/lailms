import { NextRequest, NextResponse } from 'next/server';
import { createSupabaseServerClient } from '@/lib/supabase/server';
import { StudyContentSearchQuery, StudyContentSearchResult } from '@/types/study-content';
import { FullTextSearchService } from '@/lib/services/full-text-search';
import OpenAI from 'openai';

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY!,
});

/**
 * POST /api/study-spaces/content/search
 * Search indexed content using vector similarity or full-text search
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
    const searchQuery: StudyContentSearchQuery = await request.json();
    
    if (!searchQuery.base_class_id) {
      return NextResponse.json({ 
        error: 'Base class ID is required' 
      }, { status: 400 });
    }

    // Get user's organization
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

    // Verify user has access to this base class
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

    const startTime = Date.now();
    let searchResults: any[] = [];

    // Initialize search service
    const searchService = new FullTextSearchService(supabase);

    if (searchQuery.query && searchQuery.query.trim()) {
      // Use our new full-text search service
      const searchOptions = {
        content_types: searchQuery.content_types || undefined,
        limit: searchQuery.limit || 20,
        offset: searchQuery.offset || 0,
        min_rank: 0.1
      };

      const { results } = await searchService.searchContent(
        searchQuery.base_class_id,
        searchQuery.query,
        searchOptions
      );

      searchResults = results;
    } else {
      // No query provided, return recent or featured content
      searchResults = await getRecentContent(
        supabase,
        searchQuery,
        profile.organisation_id
      );
    }

    const searchTime = Date.now() - startTime;

    // Format response
    const result: StudyContentSearchResult = {
      items: searchResults || [],
      total_count: searchResults?.length || 0,
      search_time_ms: searchTime,
      facets: generateFacets(searchResults || [])
    };

    return NextResponse.json(result);

  } catch (error) {
    console.error('Content search API error:', error);
    
    return NextResponse.json({
      error: 'Search failed',
      details: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 });
  }
}

/**
 * GET /api/study-spaces/content/search?baseClassId=xxx&query=xxx
 * Simple search endpoint for GET requests
 */
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const baseClassId = searchParams.get('baseClassId');
    const query = searchParams.get('query');
    const contentTypes = searchParams.get('contentTypes')?.split(',');
    const limit = parseInt(searchParams.get('limit') || '20');

    if (!baseClassId) {
      return NextResponse.json({ 
        error: 'Base class ID is required' 
      }, { status: 400 });
    }

    // Create search query object
    const searchQuery: StudyContentSearchQuery = {
      base_class_id: baseClassId,
      query: query || undefined,
      content_types: contentTypes as any,
      limit
    };

    // Forward to POST handler
    const postRequest = new Request(request.url, {
      method: 'POST',
      headers: request.headers,
      body: JSON.stringify(searchQuery)
    });

    return await POST(postRequest as any);

  } catch (error) {
    console.error('Content search GET API error:', error);
    
    return NextResponse.json({
      error: 'Search failed',
      details: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 });
  }
}

/**
 * Determine if vector search should be used based on query characteristics
 */
function shouldUseVectorSearch(query: string): boolean {
  // Use vector search for:
  // - Conceptual questions (contains question words)
  // - Complex phrases (more than 3 words)
  // - Educational concepts (contains academic terms)
  
  const questionWords = ['what', 'how', 'why', 'when', 'where', 'explain', 'describe', 'compare'];
  const academicTerms = ['concept', 'theory', 'principle', 'method', 'approach', 'strategy'];
  
  const lowerQuery = query.toLowerCase();
  const wordCount = query.split(/\s+/).length;
  
  const hasQuestionWords = questionWords.some(word => lowerQuery.includes(word));
  const hasAcademicTerms = academicTerms.some(term => lowerQuery.includes(term));
  const isComplexPhrase = wordCount > 3;
  
  return hasQuestionWords || hasAcademicTerms || isComplexPhrase;
}

/**
 * Perform vector similarity search
 */
async function performVectorSearch(
  supabase: any,
  searchQuery: StudyContentSearchQuery,
  organisationId: string
): Promise<any[]> {
  try {
    // Generate embedding for the search query
    const embedding = await generateQueryEmbedding(searchQuery.query!);
    
    // Call the search_study_content function
    const { data, error } = await supabase.rpc('search_study_content', {
      query_embedding: embedding,
      target_base_class_id: searchQuery.base_class_id,
      target_organisation_id: organisationId,
      content_types: searchQuery.content_types || null,
      match_threshold: 0.5,
      match_count: searchQuery.limit || 20
    });

    if (error) {
      console.error('Vector search error:', error);
      return [];
    }

    return data || [];
  } catch (error) {
    console.error('Vector search failed:', error);
    return [];
  }
}

/**
 * Perform full-text search
 */
async function performFullTextSearch(
  supabase: any,
  searchQuery: StudyContentSearchQuery,
  organisationId: string
): Promise<any[]> {
  try {
    // Call the search_study_content_text function
    const { data, error } = await supabase.rpc('search_study_content_text', {
      search_query: searchQuery.query!,
      target_base_class_id: searchQuery.base_class_id,
      target_organisation_id: organisationId,
      content_types: searchQuery.content_types || null,
      match_count: searchQuery.limit || 20
    });

    if (error) {
      console.error('Full-text search error:', error);
      return [];
    }

    return data || [];
  } catch (error) {
    console.error('Full-text search failed:', error);
    return [];
  }
}

/**
 * Get recent content when no query is provided
 */
async function getRecentContent(
  supabase: any,
  searchQuery: StudyContentSearchQuery,
  organisationId: string
): Promise<any[]> {
  try {
    const searchService = new FullTextSearchService(supabase);
    
    // Use filtered search without query to get recent content
    const { results } = await searchService.filteredSearch(
      searchQuery.base_class_id,
      '', // empty query
      {}, // no filters
      {
        limit: searchQuery.limit || 20,
        offset: searchQuery.offset || 0
      }
    );

    return results;
  } catch (error) {
    console.error('Recent content query failed:', error);
    return [];
  }
}

/**
 * Generate search facets for filtering
 */
function generateFacets(results: any[]): any {
  if (!results || results.length === 0) return {};

  const facets = {
    content_types: {} as Record<string, number>,
    tags: {} as Record<string, number>,
    difficulty_levels: {} as Record<string, number>
  };

  results.forEach(item => {
    // Count content types
    if (item.content_type) {
      facets.content_types[item.content_type] = 
        (facets.content_types[item.content_type] || 0) + 1;
    }

    // Count tags
    if (item.tags && Array.isArray(item.tags)) {
      item.tags.forEach((tag: string) => {
        facets.tags[tag] = (facets.tags[tag] || 0) + 1;
      });
    }

    // Count difficulty levels
    if (item.difficulty_level) {
      facets.difficulty_levels[item.difficulty_level] = 
        (facets.difficulty_levels[item.difficulty_level] || 0) + 1;
    }
  });

  return facets;
}

/**
 * Generate embedding for search query
 */
async function generateQueryEmbedding(query: string): Promise<number[]> {
  const response = await openai.embeddings.create({
    model: 'text-embedding-3-small',
    input: query,
    dimensions: 1536
  });
  
  return response.data[0].embedding;
} 