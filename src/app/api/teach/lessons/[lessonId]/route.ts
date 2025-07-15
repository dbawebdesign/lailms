import { createSupabaseServerClient } from '@/lib/supabase/server';
import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { Tables } from 'packages/types/db';

interface LessonParams {
  params: Promise<{
    lessonId: string;
  }>;
}

// GET /api/teach/lessons/[lessonId] - Get a specific lesson
export async function GET(
  request: Request,
  { params }: { params: { lessonId: string } }
) {
  const supabase = createSupabaseServerClient();
  const {
    data: { user },
    error: authError
  } = await supabase.auth.getUser();

  if (authError || !user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    // Get user's organization
    const { data: profile } = await supabase
      .from('profiles')
      .select('organisation_id')
      .eq('user_id', user.id)
      .single<Tables<'profiles'>>();

    if (!profile?.organisation_id) {
      return NextResponse.json({ error: 'Organization not found' }, { status: 404 });
    }

    // Get the lesson
    const { data: lesson, error } = await supabase
      .from('lessons')
      .select('*')
      .eq('id', params.lessonId)
      .eq('organisation_id', profile.organisation_id)
      .single();

    if (error) {
      return NextResponse.json({ error: 'Lesson not found' }, { status: 404 });
    }

    return NextResponse.json(lesson);
  } catch (error) {
    console.error('Error fetching lesson:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

// PUT /api/teach/lessons/[lessonId] - Update a lesson
export async function PUT(
  request: Request,
  { params }: { params: { lessonId: string } }
) {
  const supabase = createSupabaseServerClient();
  const {
    data: { user },
    error: authError
  } = await supabase.auth.getUser();

  if (authError || !user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const body = await request.json();
    const { title, description, content, status } = body;

    // Get user's organization
    const { data: profile } = await supabase
      .from('profiles')
      .select('organisation_id')
      .eq('user_id', user.id)
      .single<Tables<'profiles'>>();

    if (!profile?.organisation_id) {
      return NextResponse.json({ error: 'Organization not found' }, { status: 404 });
    }

    // Update the lesson
    const { data: lesson, error } = await supabase
      .from('lessons')
      .update({
        title,
        description,
        content,
        status,
        updated_at: new Date().toISOString()
      })
      .eq('id', params.lessonId)
      .eq('organisation_id', profile.organisation_id)
      .select()
      .single();

    if (error) {
      return NextResponse.json({ error: 'Failed to update lesson' }, { status: 500 });
    }

    return NextResponse.json(lesson);
  } catch (error) {
    console.error('Error updating lesson:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

// DELETE - Delete a lesson
export async function DELETE(request: NextRequest, { params }: LessonParams) {
  const supabase = await createSupabaseServerClient();
  const { lessonId } = await params;

  const {
    data: { session },
  } = await supabase.auth.getSession();

  if (!session) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const { error: deleteError } = await supabase
      .from('lessons')
      .delete()
      .eq('id', lessonId);

    if (deleteError) {
      console.error('Error deleting lesson:', deleteError);
      return NextResponse.json({ error: 'Failed to delete lesson', details: deleteError.message }, { status: 500 });
    }

    return NextResponse.json({ message: 'Lesson deleted successfully' });

  } catch (error: any) {
    console.error('DELETE Lesson API Error:', error);
    return NextResponse.json({ error: 'An unexpected error occurred', details: error.message }, { status: 500 });
  }
} 