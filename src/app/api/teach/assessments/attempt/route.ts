import { NextRequest, NextResponse } from 'next/server';
import { createSupabaseServerClient } from '@/lib/supabase/server';
import { Database } from '../../../../../../packages/types/db';
import { QuestionValidationService } from '@/lib/services/question-validation-service';

type Assessment = Database['public']['Tables']['assessments']['Row'];

// POST /api/teach/assessments/attempt - Start a new assessment attempt
export async function POST(request: NextRequest) {
  try {
    const supabase = createSupabaseServerClient();
    
    // Get the authenticated user
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { assessmentId } = await request.json();
    
    if (!assessmentId) {
      return NextResponse.json({ error: 'Assessment ID is required' }, { status: 400 });
    }

    // Get assessment details
    const { data: assessment, error: assessmentError } = await supabase
      .from('assessments')
      .select('*')
      .eq('id', assessmentId)
      .single();

    if (assessmentError || !assessment) {
      return NextResponse.json({ error: 'Assessment not found' }, { status: 404 });
    }

    // Check if user is enrolled in a class instance for this base class
    if (assessment.base_class_id) {
      const { data: classInstances, error: instanceError } = await supabase
        .from('class_instances')
        .select('id')
        .eq('base_class_id', assessment.base_class_id);

      if (instanceError || !classInstances || classInstances.length === 0) {
        return NextResponse.json({ error: 'No class instances found for this assessment' }, { status: 404 });
      }

      const classInstanceIds = classInstances.map(ci => ci.id);
      
      const { data: enrollment, error: enrollmentError } = await supabase
        .from('rosters')
        .select('*')
        .in('class_instance_id', classInstanceIds)
        .eq('profile_id', user.id)
        .single();

      if (enrollmentError || !enrollment) {
        return NextResponse.json({ error: 'Not enrolled in this class' }, { status: 403 });
      }
    }

    // Check if there's already an active attempt
    const { data: existingAttempt, error: attemptError } = await supabase
      .from('assessment_attempts')
      .select('*')
      .eq('assessment_id', assessmentId)
      .eq('user_id', user.id)
      .eq('status', 'in_progress')
      .single();

    if (existingAttempt && !attemptError) {
      return NextResponse.json({ 
        message: 'Active attempt found',
        attemptId: existingAttempt.id 
      });
    }

    // Create new attempt
    const { data: newAttempt, error: createError } = await supabase
      .from('assessment_attempts')
      .insert({
        assessment_id: assessmentId,
        assessment_type: assessment.assessment_type,
        user_id: user.id,
        status: 'in_progress',
        started_at: new Date().toISOString(),
        attempt_number: 1, // TODO: Calculate actual attempt number
        total_questions: 0, // TODO: Calculate from assessment questions
        base_class_id: assessment.base_class_id,
        lesson_id: assessment.lesson_id,
        path_id: assessment.path_id
      })
      .select()
      .single();

    if (createError || !newAttempt) {
      return NextResponse.json({ error: 'Failed to create assessment attempt' }, { status: 500 });
    }

    return NextResponse.json({
      message: 'Assessment attempt created successfully',
      attemptId: newAttempt.id
    });

  } catch (error) {
    console.error('Error creating assessment attempt:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
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
      // Fetch the question details from the database to get the correct answer and other metadata
      const { data: question, error: questionError } = await supabase
        .from('questions')
        .select(`
          *,
          options:question_options(*)
        `)
        .eq('id', response.questionId)
        .single();

      if (questionError || !question) {
        console.error(`Question not found for ID: ${response.questionId}`, questionError);
        // Optionally, add a marker to processedResponses for the client
        processedResponses.push({
          questionId: response.questionId,
          validation: null,
          error: 'Question not found',
          saved: false
        });
        continue; // Skip to the next response
      }
      
      try {
        // Validate and grade the response
        const validationResult = await validationService.validateAnswer(question, response);
        
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

// GET /api/teach/assessments/attempt?attemptId=<id> - Get assessment results
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
      return NextResponse.json({ error: 'Attempt ID is required' }, { status: 400 });
    }

    // Fetch attempt details
    const { data: attempt, error: attemptError } = await supabase
      .from('assessment_attempts')
      .select('*')
      .eq('id', attemptId)
      .eq('user_id', user.id)
      .single();

    if (attemptError || !attempt) {
      return NextResponse.json({ error: 'Assessment attempt not found' }, { status: 404 });
    }

    // Fetch responses for the attempt, including the question details
    const { data: responses, error: responsesError } = await supabase
      .from('assessment_responses')
      .select(`
        *,
        question:questions(*)
      `)
      .eq('attempt_id', attemptId);

    if (responsesError) {
      console.error('Error fetching assessment responses:', responsesError);
      return NextResponse.json(
        { error: 'Failed to fetch assessment responses' },
        { status: 500 }
      );
    }

    return NextResponse.json({ attempt, responses });

  } catch (error) {
    console.error('Error in assessment attempt GET:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
 