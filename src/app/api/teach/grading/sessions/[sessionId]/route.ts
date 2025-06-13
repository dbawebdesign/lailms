import { NextRequest, NextResponse } from 'next/server';
import { createSupabaseServerClient } from '@/lib/supabase/server';
import { RubricService, GradeResponse } from '@/lib/services/rubric-service';

export async function GET(
  request: NextRequest,
  { params }: { params: { sessionId: string } }
) {
  try {
    const supabase = createSupabaseServerClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { sessionId } = params;

    if (!sessionId) {
      return NextResponse.json({ error: 'Session ID is required' }, { status: 400 });
    }

    const rubricService = new RubricService();
    const result = await rubricService.getGradingSession(sessionId);

    if (!result) {
      return NextResponse.json({ error: 'Grading session not found' }, { status: 404 });
    }

    // Verify user owns the session
    if (result.session.grader_id !== user.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 403 });
    }

    // Get responses to grade based on assessment type
    let responses = [];
    if (result.session.assessment_type === 'lesson_quiz' || result.session.assessment_type === 'practice') {
      const { data: assessmentResponses, error: responseError } = await supabase
        .from('assessment_responses')
        .select(`
          *,
          lesson_questions (
            id,
            question_text,
            question_type,
            correct_answer,
            options
          )
        `)
        .eq('attempt_id', result.session.assessment_id);

      if (responseError) {
        console.error('Error fetching assessment responses:', responseError);
        return NextResponse.json({ error: 'Failed to fetch responses' }, { status: 500 });
      }

      responses = assessmentResponses || [];
    } else {
      const { data: quizResponses, error: responseError } = await supabase
        .from('quiz_responses')
        .select(`
          *,
          questions (
            id,
            question_text,
            question_type,
            correct_answer,
            options
          )
        `)
        .eq('attempt_id', result.session.assessment_id);

      if (responseError) {
        console.error('Error fetching quiz responses:', responseError);
        return NextResponse.json({ error: 'Failed to fetch responses' }, { status: 500 });
      }

      responses = quizResponses || [];
    }

    // Get rubric details if available
    let rubric = null;
    if (result.session.rubric_id) {
      const rubricResult = await rubricService.getRubric(result.session.rubric_id);
      rubric = rubricResult;
    }

    return NextResponse.json({
      success: true,
      session: result.session,
      records: result.records,
      responses,
      rubric
    });
  } catch (error) {
    console.error('Error fetching grading session:', error);
    return NextResponse.json(
      { error: 'Failed to fetch grading session' },
      { status: 500 }
    );
  }
}

export async function POST(
  request: NextRequest,
  { params }: { params: { sessionId: string } }
) {
  try {
    const supabase = createSupabaseServerClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { sessionId } = params;
    const body = await request.json();
    const { action, grades, responses } = body;

    if (!sessionId) {
      return NextResponse.json({ error: 'Session ID is required' }, { status: 400 });
    }

    // Verify session exists and user owns it
    const { data: session, error: sessionError } = await supabase
      .from('grading_sessions')
      .select('*')
      .eq('id', sessionId)
      .eq('grader_id', user.id)
      .single();

    if (sessionError || !session) {
      return NextResponse.json({ error: 'Grading session not found or unauthorized' }, { status: 404 });
    }

    const rubricService = new RubricService();

    switch (action) {
      case 'grade_responses':
        if (!grades || !Array.isArray(grades)) {
          return NextResponse.json({ error: 'Grades array is required' }, { status: 400 });
        }

        // Validate grade structure
        for (const grade of grades) {
          if (!grade.responseId || typeof grade.pointsAwarded !== 'number' || typeof grade.maxPoints !== 'number') {
            return NextResponse.json({ error: 'Invalid grade structure' }, { status: 400 });
          }
        }

        const gradingRecords = await rubricService.gradeResponses(sessionId, grades);
        return NextResponse.json({
          success: true,
          records: gradingRecords
        });

      case 'auto_grade':
        if (!responses || !Array.isArray(responses)) {
          return NextResponse.json({ error: 'Responses array is required for auto-grading' }, { status: 400 });
        }

        const autoGradedRecords = await rubricService.autoGradeObjectiveQuestions(sessionId, responses);
        return NextResponse.json({
          success: true,
          records: autoGradedRecords
        });

      case 'ai_assisted_grade':
        if (!responses || !Array.isArray(responses)) {
          return NextResponse.json({ error: 'Responses array is required for AI-assisted grading' }, { status: 400 });
        }

        const aiGradedRecords = await rubricService.aiAssistedGrading(sessionId, responses, session.rubric_id);
        return NextResponse.json({
          success: true,
          records: aiGradedRecords
        });

      case 'complete_session':
        // Calculate final grade
        const finalGrade = await rubricService.calculateFinalGrade(sessionId);
        
        // Mark session as completed
        const { error: updateError } = await supabase
          .from('grading_sessions')
          .update({
            completed_at: new Date().toISOString(),
            metadata: {
              ...session.metadata,
              final_grade: finalGrade
            }
          })
          .eq('id', sessionId);

        if (updateError) {
          console.error('Error completing session:', updateError);
          return NextResponse.json({ error: 'Failed to complete session' }, { status: 500 });
        }

        return NextResponse.json({
          success: true,
          finalGrade,
          message: 'Grading session completed successfully'
        });

      default:
        return NextResponse.json({ error: 'Invalid action' }, { status: 400 });
    }
  } catch (error) {
    console.error('Error processing grading session action:', error);
    return NextResponse.json(
      { error: 'Failed to process grading action' },
      { status: 500 }
    );
  }
}

export async function PUT(
  request: NextRequest,
  { params }: { params: { sessionId: string } }
) {
  try {
    const supabase = createSupabaseServerClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { sessionId } = params;
    const body = await request.json();

    if (!sessionId) {
      return NextResponse.json({ error: 'Session ID is required' }, { status: 400 });
    }

    // Update session metadata or settings
    const { data: updatedSession, error: updateError } = await supabase
      .from('grading_sessions')
      .update({
        metadata: body.metadata,
        updated_at: new Date().toISOString()
      })
      .eq('id', sessionId)
      .eq('grader_id', user.id)
      .select()
      .single();

    if (updateError) {
      console.error('Error updating grading session:', updateError);
      return NextResponse.json({ error: 'Failed to update grading session' }, { status: 500 });
    }

    if (!updatedSession) {
      return NextResponse.json({ error: 'Grading session not found or unauthorized' }, { status: 404 });
    }

    return NextResponse.json({
      success: true,
      session: updatedSession
    });
  } catch (error) {
    console.error('Error updating grading session:', error);
    return NextResponse.json(
      { error: 'Failed to update grading session' },
      { status: 500 }
    );
  }
}
 