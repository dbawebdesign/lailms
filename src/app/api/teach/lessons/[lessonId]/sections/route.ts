import { NextResponse } from 'next/server';
import { createServerClient, type CookieOptions } from '@supabase/ssr'; // Updated import
import { cookies } from 'next/headers';

interface SectionsParams {
  params: Promise<{
    lessonId: string;
  }>;
}

// Helper function to create Supabase client for Route Handlers
const supabaseRouteHandlerClient = async () => {
  const cookieStore = await cookies();
  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        get(name: string) {
          return cookieStore.get(name)?.value;
        },
        set(name: string, value: string, options: CookieOptions) {
          cookieStore.set(name, value, options);
        },
        remove(name: string, options: CookieOptions) {
          cookieStore.delete(name);
        },
      },
    }
  );
};

// GET all sections for a lesson
export async function GET(request: Request, { params }: SectionsParams) {
  try {
    const { lessonId } = await params;
    if (!lessonId) {
      return NextResponse.json({ error: 'Lesson ID is required' }, { status: 400 });
    }

    const supabase = await supabaseRouteHandlerClient();
    const { data: sections, error } = await supabase
      .from('lesson_sections')
      .select('*')
      .eq('lesson_id', lessonId)
      .order('order_index', { ascending: true });

    if (error) {
      console.error('Error fetching lesson sections:', error);
      return NextResponse.json({ error: 'Failed to fetch lesson sections', details: error.message }, { status: 500 });
    }

    return NextResponse.json(sections);
  } catch (e: any) {
    console.error('Unexpected error in GET /api/teach/lessons/[lessonId]/sections:', e);
    return NextResponse.json({ error: 'An unexpected error occurred.', details: e.message }, { status: 500 });
  }
}

// POST a new section to a lesson
export async function POST(request: Request, { params }: SectionsParams) {
  try {
    const { lessonId } = await params;
    if (!lessonId) {
      return NextResponse.json({ error: 'Lesson ID is required' }, { status: 400 });
    }

    const supabase = await supabaseRouteHandlerClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();

    if (authError || !user) {
      console.error('Auth error:', authError);
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    
    const creatorUserId = user.id; // This is auth.uid()

    const body = await request.json();
    const { 
      title, 
      content = { type: 'doc', content: [{ type: 'paragraph' }] }, 
      order_index, 
      section_type = 'text-editor' 
    } = body;

    if (!title) {
      return NextResponse.json({ error: 'Section title is required' }, { status: 400 });
    }
    
    // Call the PostgreSQL function to create section and initial version
    // Parameters must match the function signature: (p_lesson_id, p_title, p_content, p_order_index, p_section_type, p_creator_user_id)
    const { data: newSectionData, error: sectionError } = await supabase.rpc('create_lesson_section_with_initial_version', {
        p_lesson_id: lessonId,
        p_title: title,
        p_content: content,
        p_order_index: order_index || null, // Allow null for auto-ordering
        p_section_type: section_type,
        p_creator_user_id: creatorUserId
    }).select().single();

    if (sectionError) {
      console.error('Error creating new lesson section via RPC:', sectionError);
      return NextResponse.json({ error: 'Failed to create lesson section', details: sectionError.message }, { status: 500 });
    }

    return NextResponse.json(newSectionData, { status: 201 });

  } catch (e: any) {
    console.error('Unexpected error in POST /api/teach/lessons/[lessonId]/sections:', e);
    if (e.code) { 
        return NextResponse.json({ error: 'An unexpected error occurred.', details: e.message, code: e.code }, { status: 500 });
    }
    return NextResponse.json({ error: 'An unexpected error occurred.', details: e.message }, { status: 500 });
  }
} 