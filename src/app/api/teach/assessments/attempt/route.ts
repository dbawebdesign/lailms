import { NextRequest, NextResponse } from 'next/server';
import { createSupabaseServerClient } from '@/lib/supabase/server';
import { QuestionValidationService } from '@/lib/services/question-validation-service';

// POST /api/teach/assessments/attempt - Start a new assessment attempt
export async function POST(request: NextRequest) {
  try {
    const supabase = createSupabaseServerClient();
    const body = await request.json();

    // Verify user authentication
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const {
      assessmentId,
      assessmentType, // 'lesson', 'path', 'final'
      lessonId,
      pathId,
      baseClassId
    } = body;

    if (!assessmentId || !assessmentType) {
      return NextResponse.json(
        { error: 'Assessment ID and type are required' },
        { status: 400 }
      );
    }

    // Create new attempt
    const { data: attempt, error: attemptError } = await supabase
      .from('assessment_attempts')
      .insert({
        assessment_id: assessmentId,
        assessment_type: assessmentType,
        user_id: user.id,
        lesson_id: lessonId || null,
        path_id: pathId || null,
        base_class_id: baseClassId || null,
        started_at: new Date().toISOString(),
        status: 'in_progress'
      })
      .select()
      .single();

    if (attemptError) {
      console.error('Error creating assessment attempt:', attemptError);
      return NextResponse.json(
        { error: 'Failed to start assessment attempt' },
        { status: 500 }
      );
    }

    return NextResponse.json({
      attempt,
      message: 'Assessment attempt started successfully'
    }, { status: 201 });

  } catch (error) {
    console.error('Error in assessment attempt POST:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

// PUT /api/teach/assessments/attempt - Submit assessment responses
export async function PUT(request: NextRequest) {
  try {
    const supabase = createSupabaseServerClient();
    const body = await request.json();

    // Verify user authentication
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const {
      attemptId,
      responses, // Array of question responses
      isSubmission = false // true for final submission, false for saving progress
    } = body;

    if (!attemptId || !responses || !Array.isArray(responses)) {
      return NextResponse.json(
        { error: 'Attempt ID and responses are required' },
        { status: 400 }
      );
    }

    // Verify attempt exists and belongs to user
    const { data: attempt, error: attemptError } = await supabase
      .from('assessment_attempts')
      .select('id, user_id, status')
      .eq('id', attemptId)
      .eq('user_id', user.id)
      .single();

    if (attemptError || !attempt) {
      return NextResponse.json({ error: 'Assessment attempt not found' }, { status: 404 });
    }

    if (attempt.status !== 'in_progress') {
      return NextResponse.json({ error: 'Assessment attempt is not in progress' }, { status: 400 });
    }

    // Initialize validation service
    const validationService = new QuestionValidationService(supabase);

    // Process responses
    const processedResponses = [];
    let totalScore = 0;
    let maxPossibleScore = 0;

    for (const response of responses) {
      try {
        // Validate and grade the response
        const validationResult = await validationService.validateResponse(response);
        
        totalScore += validationResult.score;
        maxPossibleScore += validationResult.maxScore;

        // Save or update response in database
        const { data: savedResponse, error: responseError } = await supabase
          .from('assessment_responses')
          .upsert({
            attempt_id: attemptId,
            question_id: response.questionId,
            question_type: response.questionType,
            student_answer: typeof response.studentAnswer === 'object' 
              ? JSON.stringify(response.studentAnswer) 
              : String(response.studentAnswer),
            is_correct: validationResult.isCorrect,
            score: validationResult.score,
            max_score: validationResult.maxScore,
            feedback: validationResult.feedback,
            detailed_feedback: validationResult.detailedFeedback,
            time_spent: response.timeSpent || 0,
            grading_notes: validationResult.gradingNotes,
            updated_at: new Date().toISOString()
          }, {
            onConflict: 'attempt_id,question_id'
          })
          .select()
          .single();

        if (responseError) {
          console.error('Error saving response:', responseError);
        }

        processedResponses.push({
          questionId: response.questionId,
          validation: validationResult,
          saved: !responseError
        });

      } catch (validationError) {
        console.error('Error validating response:', validationError);
        processedResponses.push({
          questionId: response.questionId,
          validation: null,
          error: 'Validation failed',
          saved: false
        });
      }
    }

    // Calculate percentage score
    const percentageScore = maxPossibleScore > 0 ? (totalScore / maxPossibleScore) * 100 : 0;

    // Update attempt with current progress
    const attemptUpdate: any = {
      total_score: totalScore,
      max_possible_score: maxPossibleScore,
      percentage_score: percentageScore,
      updated_at: new Date().toISOString()
    };

    // If this is a final submission, mark as completed
    if (isSubmission) {
      attemptUpdate.status = 'completed';
      attemptUpdate.completed_at = new Date().toISOString();
    }

    const { data: updatedAttempt, error: updateError } = await supabase
      .from('assessment_attempts')
      .update(attemptUpdate)
      .eq('id', attemptId)
      .select()
      .single();

    if (updateError) {
      console.error('Error updating attempt:', updateError);
    }

    const responseData = {
      attempt: updatedAttempt || attempt,
      responses: processedResponses,
      summary: {
        totalScore,
        maxPossibleScore,
        percentageScore: Math.round(percentageScore * 100) / 100,
        questionsAnswered: responses.length,
        isSubmitted: isSubmission
      },
      message: isSubmission ? 'Assessment submitted successfully' : 'Progress saved successfully'
    };

    return NextResponse.json(responseData);

  } catch (error) {
    console.error('Error in assessment attempt PUT:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

// GET /api/teach/assessments/attempt?attemptId=... - Get attempt details
export async function GET(request: NextRequest) {
  try {
    const supabase = createSupabaseServerClient();
    const { searchParams } = new URL(request.url);
    const attemptId = searchParams.get('attemptId');

    // Verify user authentication
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    if (!attemptId) {
      return NextResponse.json(
        { error: 'Attempt ID is required' },
        { status: 400 }
      );
    }

    // Get attempt details with responses
    const { data: attempt, error: attemptError } = await supabase
      .from('assessment_attempts')
      .select(`
        id,
        assessment_id,
        assessment_type,
        user_id,
        status,
        started_at,
        completed_at,
        time_limit,
        total_score,
        max_possible_score,
        percentage_score,
        assessment_responses(
          id,
          question_id,
          question_type,
          student_answer,
          is_correct,
          score,
          max_score,
          feedback,
          detailed_feedback,
          time_spent,
          grading_notes
        )
      `)
      .eq('id', attemptId)
      .eq('user_id', user.id)
      .single();

    if (attemptError || !attempt) {
      return NextResponse.json({ error: 'Assessment attempt not found' }, { status: 404 });
    }

    return NextResponse.json({
      attempt,
      message: 'Assessment attempt retrieved successfully'
    });

  } catch (error) {
    console.error('Error in assessment attempt GET:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
