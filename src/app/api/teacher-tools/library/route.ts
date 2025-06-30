import { NextRequest, NextResponse } from 'next/server';
import { createSupabaseServerClient } from '@/lib/supabase/server';
import { TeacherToolCreationInput, ToolLibraryFilters, ToolLibrarySort } from '@/types/teachingTools';
import { Tables, Json } from 'packages/types/db';

export async function GET(request: NextRequest) {
  try {
    const supabase = createSupabaseServerClient();
    
    // Check authentication
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Get user profile to verify teacher role
    const { data: profile, error: profileError } = await supabase
      .from('profiles')
      .select('role')
      .eq('user_id', user.id)
      .single<Tables<'profiles'>>();

    if (profileError || !profile || (profile as any).role !== 'teacher') {
      return NextResponse.json({ error: 'Access denied. Teacher role required.' }, { status: 403 });
    }

    // Parse query parameters
    const { searchParams } = new URL(request.url);
    const toolId = searchParams.get('toolId');
    const search = searchParams.get('search');
    const tags = searchParams.get('tags')?.split(',').filter(Boolean);
    const gradeLevel = searchParams.get('gradeLevel');
    const subject = searchParams.get('subject');
    const favorites = searchParams.get('favorites') === 'true';
    const page = parseInt(searchParams.get('page') || '1');
    const limit = parseInt(searchParams.get('limit') || '20');
    const sortField = searchParams.get('sortField') || 'created_at';
    const sortDirection = searchParams.get('sortDirection') || 'desc';

    // Build query
    let query = supabase
      .from('teacher_tool_creations')
      .select('*', { count: 'exact' })
      .eq('user_id', user.id);

    // Apply filters
    if (toolId) {
      query = query.eq('tool_id', toolId);
    }

    if (search) {
      query = query.or(`title.ilike.%${search}%,description.ilike.%${search}%`);
    }

    if (tags && tags.length > 0) {
      query = query.overlaps('tags', tags);
    }

    if (gradeLevel) {
      query = query.eq('metadata->>gradeLevel', gradeLevel);
    }

    if (subject) {
      query = query.eq('metadata->>subject', subject);
    }

    if (favorites) {
      query = query.eq('is_favorite', true);
    }

    // Apply sorting
    query = query.order(sortField as any, { ascending: sortDirection === 'asc' });

    // Apply pagination
    const from = (page - 1) * limit;
    const to = from + limit - 1;
    query = query.range(from, to);

    const { data: creations, error: queryError, count } = await query.returns<Tables<'teacher_tool_creations'>[]>();

    if (queryError) {
      console.error('Library query error:', queryError);
      return NextResponse.json({ error: 'Failed to fetch library items' }, { status: 500 });
    }

    return NextResponse.json({
      creations: creations || [],
      totalCount: count || 0,
      hasMore: (count || 0) > page * limit,
      filters: {
        toolId,
        search,
        tags,
        gradeLevel,
        subject,
        favorites
      },
      sort: {
        field: sortField,
        direction: sortDirection
      }
    });

  } catch (error) {
    console.error('Library API error:', error);
    return NextResponse.json(
      { error: 'Failed to process request' },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const supabase = createSupabaseServerClient();
    
    // Check authentication
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Get user profile to verify teacher role
    const { data: profile, error: profileError } = await supabase
      .from('profiles')
      .select('role')
      .eq('user_id', user.id)
      .single<Tables<'profiles'>>();

    if (profileError || !profile || (profile as any).role !== 'teacher') {
      return NextResponse.json({ error: 'Access denied. Teacher role required.' }, { status: 403 });
    }

    const creationData: TeacherToolCreationInput = await request.json();

    if (!creationData.tool_id || !creationData.tool_name || !creationData.title || !creationData.content) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
    }

    // Insert new creation
    const { data: creation, error: insertError } = await supabase
      .from('teacher_tool_creations')
      .insert({
        user_id: user.id,
        tool_id: creationData.tool_id,
        tool_name: creationData.tool_name,
        title: creationData.title,
        description: creationData.description,
        content: creationData.content as Json, // Cast to Json type for database compatibility
        metadata: (creationData.metadata || {}) as Json,
        tags: creationData.tags || []
      })
      .select()
      .single<Tables<'teacher_tool_creations'>>();

    if (insertError) {
      console.error('Creation insert error:', insertError);
      return NextResponse.json({ error: 'Failed to save creation' }, { status: 500 });
    }

    return NextResponse.json({ creation }, { status: 201 });

  } catch (error) {
    console.error('Library POST error:', error);
    return NextResponse.json(
      { error: 'Failed to process request' },
      { status: 500 }
    );
  }
} 