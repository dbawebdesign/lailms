import { NextRequest, NextResponse } from 'next/server';
import { createSupabaseServerClient } from '@/lib/supabase/server';
import { getActiveProfile } from '@/lib/auth/family-helpers';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ lessonId: string }> }
) {
  try {
    const { lessonId } = await params;

    if (!lessonId) {
      return NextResponse.json(
        { error: 'Lesson ID is required' },
        { status: 400 }
      );
    }

    const supabase = createSupabaseServerClient();

    // Get the active profile (handles both regular users and sub-accounts)
    const activeProfileData = await getActiveProfile();
    
    if (!activeProfileData) {
      return NextResponse.json(
        { error: 'Authentication required' },
        { status: 401 }
      );
    }
    
    const { profile } = activeProfileData;

    // Fetch comprehensive lesson data
    const { data: lesson, error: lessonError } = await supabase
      .from('lessons')
      .select(`
        *,
        lesson_sections (
          id,
          title,
          content,
          order_index,
          section_type
        ),
        assessments (
          id,
          title,
          description,
          assessment_type,
          time_limit_minutes,
          passing_score_percentage,
          assessment_questions (
            id,
            question_text,
            question_type,
            options,
            correct_answer,
            explanation,
            points,
            order_index
          )
        )
      `)
      .eq('id', lessonId)
      .single();

    if (lessonError) {
      console.error('Error fetching lesson:', lessonError);
      return NextResponse.json(
        { error: 'Failed to fetch lesson content' },
        { status: 500 }
      );
    }

    if (!lesson) {
      return NextResponse.json(
        { error: 'Lesson not found' },
        { status: 404 }
      );
    }

    // Fetch user progress for this lesson
    const { data: progress } = await supabase
      .from('progress')
      .select('*')
      .eq('user_id', profile.user_id)
      .eq('item_id', lessonId)
      .eq('item_type', 'lesson')
      .single();

    // Check for mind map and podcast content in lesson_media_assets
    const { data: mediaAssets, error: mediaError } = await supabase
      .from('lesson_media_assets')
      .select('*')
      .eq('lesson_id', lessonId)
      .in('asset_type', ['mind_map', 'podcast']);

    const mindMap = mediaAssets?.find(asset => asset.asset_type === 'mind_map') || null;
    const brainbytes = mediaAssets?.find(asset => asset.asset_type === 'podcast') || null;

    // Structure the response
    const response = {
      lesson: {
        ...lesson,
        sections: lesson.lesson_sections?.sort((a, b) => a.order_index - b.order_index) || [],
        assessments: lesson.assessments || []
      },
      progress: progress || null,
      mindMap: mindMap || null,
      brainbytes: brainbytes || null,
      hasInteractiveContent: !!(mindMap || brainbytes)
    };

    return NextResponse.json(response);

  } catch (error) {
    console.error('Error in lesson content API:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
} 