import { createSupabaseServerClient } from '@/lib/supabase/server';
import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

interface LessonParams {
  params: Promise<{
    lessonId: string;
  }>;
}

// PATCH - Update a lesson
export async function PATCH(request: NextRequest, { params }: LessonParams) {
  const supabase = await createSupabaseServerClient();
  const { lessonId } = await params;

  const {
    data: { session },
  } = await supabase.auth.getSession();

  if (!session) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const updates = await request.json();

    // Remove any fields that shouldn't be updated directly
    const allowedFields = ['title', 'description'];
    const filteredUpdates = Object.keys(updates)
      .filter(key => allowedFields.includes(key))
      .reduce((obj: any, key) => {
        obj[key] = updates[key];
        return obj;
      }, {});

    if (Object.keys(filteredUpdates).length === 0) {
      return NextResponse.json({ error: 'No valid fields to update' }, { status: 400 });
    }

    const { data: updatedLesson, error: updateError } = await supabase
      .from('lessons')
      .update(filteredUpdates)
      .eq('id', lessonId)
      .select('*')
      .single();

    if (updateError) {
      console.error('Error updating lesson:', updateError);
      return NextResponse.json({ error: 'Failed to update lesson', details: updateError.message }, { status: 500 });
    }

    return NextResponse.json(updatedLesson);

  } catch (error: any) {
    console.error('PATCH Lesson API Error:', error);
    return NextResponse.json({ error: 'An unexpected error occurred', details: error.message }, { status: 500 });
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