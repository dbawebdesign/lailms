import { NextRequest, NextResponse } from 'next/server';
import { createSupabaseServerClient } from '@/lib/supabase/server';
import { AIGradingService } from '@/lib/services/ai-grading-service';

export async function POST(request: NextRequest) {
  try {
    const supabase = createSupabaseServerClient();
    
    // Get the current user (should be admin/instructor)
    const { data: { user }, error: userError } = await supabase.auth.getUser();
    if (userError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Get all attempts that need AI grading
    const { data: pendingAttempts, error: attemptsError } = await supabase
      .from('student_attempts')
      .select(`
        id,
        assessment_id,
        student_id,
        ai_grading_status,
        status
      `)
      .eq('ai_grading_status', 'pending')
      .in('status', ['grading', 'submitted']);

    if (attemptsError) {
      console.error('Error fetching pending attempts:', attemptsError);
      return NextResponse.json({ error: 'Failed to fetch pending attempts' }, { status: 500 });
    }

    if (!pendingAttempts || pendingAttempts.length === 0) {
      return NextResponse.json({ 
        message: 'No pending attempts found for AI grading',
        processed: 0 
      });
    }

    console.log(`Found ${pendingAttempts.length} attempts needing AI grading`);

    // Filter attempts that actually have subjective questions needing grading
    const attemptsWithSubjectiveQuestions = [];
    
    for (const attempt of pendingAttempts) {
      const { data: subjectiveResponses, error: responsesError } = await supabase
        .from('student_responses')
        .select(`
          id,
          assessment_questions!inner(question_type, ai_grading_enabled)
        `)
        .eq('attempt_id', attempt.id)
        .eq('assessment_questions.ai_grading_enabled', true)
        .in('assessment_questions.question_type', ['short_answer', 'essay'])
        .is('ai_score', null);

      if (!responsesError && subjectiveResponses && subjectiveResponses.length > 0) {
        attemptsWithSubjectiveQuestions.push(attempt.id);
      }
    }

    if (attemptsWithSubjectiveQuestions.length === 0) {
      return NextResponse.json({ 
        message: 'No attempts with subjective questions found for AI grading',
        processed: 0 
      });
    }

    console.log(`Processing ${attemptsWithSubjectiveQuestions.length} attempts with subjective questions`);

    // Update all attempts to in_progress status
    const { error: updateError } = await supabase
      .from('student_attempts')
      .update({ ai_grading_status: 'in_progress' })
      .in('id', attemptsWithSubjectiveQuestions);

    if (updateError) {
      console.error('Error updating attempt statuses:', updateError);
      return NextResponse.json({ error: 'Failed to update attempt statuses' }, { status: 500 });
    }

    // Initialize AI grading service
    const gradingService = new AIGradingService();
    
    // Process attempts in background (don't await to avoid timeout)
    const batchProcessing = gradingService.batchGradeAttempts(
      attemptsWithSubjectiveQuestions,
      (message) => {
        console.log(`Batch AI Grading Progress: ${message}`);
      }
    ).then(() => {
      console.log(`Batch AI grading completed for ${attemptsWithSubjectiveQuestions.length} attempts`);
    }).catch((error) => {
      console.error('Batch AI grading failed:', error);
    });

    // Don't await the batch processing to avoid timeout
    return NextResponse.json({
      success: true,
      message: 'Batch AI grading started successfully',
      attemptIds: attemptsWithSubjectiveQuestions,
      totalAttempts: attemptsWithSubjectiveQuestions.length,
      status: 'processing'
    });

  } catch (error) {
    console.error('Error in batch AI grading:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

// GET endpoint to check batch processing status
export async function GET(request: NextRequest) {
  try {
    const supabase = createSupabaseServerClient();
    
    // Get the current user
    const { data: { user }, error: userError } = await supabase.auth.getUser();
    if (userError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Get status of all grading attempts
    const { data: gradingAttempts, error: statusError } = await supabase
      .from('student_attempts')
      .select('ai_grading_status')
      .in('ai_grading_status', ['pending', 'in_progress', 'completed', 'failed']);

    if (statusError) {
      console.error('Error fetching grading status:', statusError);
      return NextResponse.json({ error: 'Failed to fetch grading status' }, { status: 500 });
    }

    // Count statuses manually
    const statusCounts = gradingAttempts?.reduce((acc: any, item: any) => {
      acc[item.ai_grading_status] = (acc[item.ai_grading_status] || 0) + 1;
      return acc;
    }, {}) || {};

    return NextResponse.json({
      status: statusCounts,
      summary: {
        pending: statusCounts.pending || 0,
        inProgress: statusCounts.in_progress || 0,
        completed: statusCounts.completed || 0,
        failed: statusCounts.failed || 0
      }
    });

  } catch (error) {
    console.error('Error checking batch grading status:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
} 