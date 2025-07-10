import { NextRequest, NextResponse } from 'next/server';
import { createSupabaseServerClient } from '@/lib/supabase/server';
import { RubricService, GradingRequest } from '@/lib/services/rubric-service';

export async function GET(request: NextRequest) {
  try {
    const supabase = createSupabaseServerClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const assessmentId = searchParams.get('assessmentId');
    const status = searchParams.get('status');

    let query = supabase
      .from('grading_sessions')
      .select(`
        *,
        rubrics (
          id,
          name,
          description
        )
      `)
      .eq('grader_id', user.id)
      .order('created_at', { ascending: false });

    if (assessmentId) {
      query = query.eq('assessment_id', assessmentId);
    }

    if (status === 'active') {
      query = query.is('completed_at', null);
    } else if (status === 'completed') {
      query = query.not('completed_at', 'is', null);
    }

    const { data: sessions, error } = await query;

    if (error) {
      console.error('Error fetching grading sessions:', error);
      return NextResponse.json({ error: 'Failed to fetch grading sessions' }, { status: 500 });
    }

    return NextResponse.json({
      success: true,
      sessions: sessions || []
    });
  } catch (error) {
    console.error('Error fetching grading sessions:', error);
    return NextResponse.json(
      { error: 'Failed to fetch grading sessions' },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const supabase = createSupabaseServerClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    const {
      assessmentId,
      assessmentType,
      gradingMethod,
      rubricId
    } = body;

    // Validate required fields
    if (!assessmentId || !assessmentType || !gradingMethod) {
      return NextResponse.json(
        { error: 'Missing required fields: assessmentId, assessmentType, gradingMethod' },
        { status: 400 }
      );
    }

    // Validate assessment type
    const validAssessmentTypes = ['practice', 'lesson_quiz', 'path_exam', 'final_exam', 'diagnostic', 'benchmark'];
    if (!validAssessmentTypes.includes(assessmentType)) {
      return NextResponse.json(
        { error: 'Invalid assessment type' },
        { status: 400 }
      );
    }

    // Validate grading method
    const validGradingMethods = ['automatic', 'manual', 'hybrid', 'peer_review', 'ai_assisted'];
    if (!validGradingMethods.includes(gradingMethod)) {
      return NextResponse.json(
        { error: 'Invalid grading method' },
        { status: 400 }
      );
    }

    // Check if there's already an active session for this assessment
    const { data: existingSession, error: checkError } = await supabase
      .from('grading_sessions')
      .select('id')
      .eq('assessment_id', assessmentId)
      .eq('grader_id', user.id)
      .is('completed_at', null)
      .limit(1);

    if (checkError) {
      console.error('Error checking existing sessions:', checkError);
      return NextResponse.json({ error: 'Failed to check existing sessions' }, { status: 500 });
    }

    if (existingSession && existingSession.length > 0) {
      return NextResponse.json(
        { error: 'An active grading session already exists for this assessment' },
        { status: 400 }
      );
    }

    const gradingRequest: GradingRequest = {
      assessmentId,
      assessmentType,
      gradingMethod,
      rubricId
    };

    const rubricService = new RubricService();
    const session = await rubricService.startGradingSession(gradingRequest, user.id);

    return NextResponse.json({
      success: true,
      session
    });
  } catch (error) {
    console.error('Error starting grading session:', error);
    return NextResponse.json(
      { error: 'Failed to start grading session' },
      { status: 500 }
    );
  }
} 