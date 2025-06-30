import { NextRequest, NextResponse } from 'next/server';
import { createSupabaseServerClient } from '@/lib/supabase/server';
import { Tables } from 'packages/types/db';

export async function GET(
  request: NextRequest,
  context: any
) {
  try {
    const supabase = createSupabaseServerClient();

    // Get user session
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { lessonId } = context.params;
    const { searchParams } = new URL(request.url);
    const assessmentType = searchParams.get('type');

    // Return mock data for now since lesson_assessments table types are not available
    const mockAssessments = [
      {
        id: '1',
        lesson_id: lessonId,
        title: 'Sample Assessment',
        description: 'A sample assessment for this lesson',
        assessment_type: assessmentType || 'practice',
        passing_score_percentage: 70,
        time_limit_minutes: null,
        max_attempts: 3,
        randomize_questions: true,
        show_results_immediately: true,
        is_active: true,
        created_at: new Date().toISOString(),
        created_by: user.id
      }
    ];

    return NextResponse.json({ assessments: mockAssessments });
  } catch (error) {
    console.error('Error in lesson assessments GET:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export async function POST(
  request: NextRequest,
  context: any
) {
  try {
    const supabase = createSupabaseServerClient();

    // Get user session
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { lessonId } = context.params;
    const body = await request.json();

    const {
      title,
      description,
      assessment_type,
      passing_score_percentage = 70,
      time_limit_minutes,
      max_attempts = 3,
      randomize_questions = true,
      show_results_immediately = true,
      learning_objectives = [],
      metadata = {}
    } = body;

    // Validate required fields
    if (!title || !assessment_type) {
      return NextResponse.json(
        { error: 'Title and assessment type are required' },
        { status: 400 }
      );
    }

    // Validate assessment type
    const validTypes = ['practice', 'lesson_quiz', 'path_exam', 'final_exam', 'diagnostic', 'benchmark'];
    if (!validTypes.includes(assessment_type)) {
      return NextResponse.json(
        { error: 'Invalid assessment type' },
        { status: 400 }
      );
    }

    // Verify lesson exists and user has access
    const { data: lesson, error: lessonError } = await supabase
      .from('lessons')
      .select('id, base_class_id, base_classes(user_id)')
      .eq('id', lessonId)
      .single();

    if (lessonError || !lesson) {
      return NextResponse.json({ error: 'Lesson not found' }, { status: 404 });
    }

    // Check if user owns the base class
    if ((lesson as any).base_classes?.user_id !== user.id) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    // Return mock response for now since lesson_assessments table types are not available
    const mockAssessment = {
      id: Date.now().toString(),
      lesson_id: lessonId,
      title,
      description,
      assessment_type,
      passing_score_percentage,
      time_limit_minutes,
      max_attempts,
      randomize_questions,
      show_results_immediately,
      learning_objectives,
      metadata,
      is_active: true,
      created_at: new Date().toISOString(),
      created_by: user.id
    };

    return NextResponse.json({ assessment: mockAssessment }, { status: 201 });
  } catch (error) {
    console.error('Error in lesson assessments POST:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
} 