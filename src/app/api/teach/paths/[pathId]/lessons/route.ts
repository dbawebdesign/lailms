import { createSupabaseServerClient } from '@/lib/supabase/server';
import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

interface PathLessonsParams {
  params: {
    pathId: string;
  };
}

// POST - Create a new lesson within a path
export async function POST(request: NextRequest, { params }: PathLessonsParams) {
  const supabase = await createSupabaseServerClient();
  const { pathId } = await params;

  const {
    data: { session },
  } = await supabase.auth.getSession();

  if (!session) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const { title, description, order_index } = await request.json();

    if (!title || !description) {
      return NextResponse.json({ error: 'title and description are required' }, { status: 400 });
    }

    const lessonData = {
      title,
      description,
      path_id: pathId,
      creator_user_id: session.user.id,
      order_index: order_index || 0,
    };

    const { data: newLesson, error: lessonError } = await supabase
      .from('lessons')
      .insert(lessonData)
      .select('*')
      .single();

    if (lessonError) {
      console.error('Error creating lesson:', lessonError);
      return NextResponse.json({ error: 'Failed to create lesson', details: lessonError.message }, { status: 500 });
    }

    return NextResponse.json(newLesson, { status: 201 });

  } catch (error: any) {
    console.error('POST Lesson API Error:', error);
    return NextResponse.json({ error: 'An unexpected error occurred', details: error.message }, { status: 500 });
  }
} 