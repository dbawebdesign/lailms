import { createSupabaseServerClient } from '@/lib/supabase/server';
import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

interface LessonParams {
  params: Promise<{
    lessonId: string;
  }>;
}

// GET - Check if lesson has existing teaching outline
export async function GET(request: NextRequest, { params }: LessonParams) {
  const supabase = await createSupabaseServerClient();
  const { lessonId } = await params;

  const {
    data: { user },
    error: authError
  } = await supabase.auth.getUser();

  if (authError || !user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const { data: lesson, error } = await supabase
      .from('lessons')
      .select('teaching_outline_content, teaching_outline_generated_at')
      .eq('id', lessonId)
      .single();

    if (error) {
      console.error('Error fetching lesson outline status:', error);
      return NextResponse.json({ error: 'Failed to fetch lesson outline status' }, { status: 500 });
    }

    // Type assertion since we know these fields exist in the database
    const lessonWithOutline = lesson as any;

    return NextResponse.json({
      hasOutline: !!lessonWithOutline.teaching_outline_content,
      generatedAt: lessonWithOutline.teaching_outline_generated_at
    });

  } catch (error: any) {
    console.error('Teaching outline status API Error:', error);
    return NextResponse.json({ error: 'An unexpected error occurred' }, { status: 500 });
  }
} 