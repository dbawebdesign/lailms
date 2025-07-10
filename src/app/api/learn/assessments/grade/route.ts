import { NextRequest, NextResponse } from 'next/server';
import { createSupabaseServerClient } from '@/lib/supabase/server';
import { AIGradingService } from '@/lib/services/ai-grading-service';

interface GradeAttemptRequest {
  attemptId: string;
}

export async function POST(request: NextRequest) {
  try {
    const supabase = createSupabaseServerClient();
    
    // Get the current user
    const { data: { user }, error: userError } = await supabase.auth.getUser();
    if (userError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body: GradeAttemptRequest = await request.json();
    const { attemptId } = body;

    if (!attemptId) {
      return NextResponse.json({ error: 'Attempt ID is required' }, { status: 400 });
    }

    // Verify the attempt exists and belongs to the user
    const { data: attempt, error: attemptError } = await supabase
      .from('student_attempts')
      .select(`
        *,
        assessment:assessments(*)
      `)
      .eq('id', attemptId)
      .eq('student_id', user.id)
      .single();

    if (attemptError || !attempt) {
      return NextResponse.json({ error: 'Attempt not found' }, { status: 404 });
    }

    // Check if attempt is in a state that can be graded
    if (attempt.ai_grading_status === 'completed' || attempt.ai_grading_status === 'in_progress') {
      return NextResponse.json({ 
        error: 'Attempt has already been graded or is currently being graded' 
      }, { status: 400 });
    }

    // Update grading status to in_progress
    const { error: updateError } = await supabase
      .from('student_attempts')
      .update({ 
        ai_grading_status: 'in_progress'
      })
      .eq('id', attemptId);

    if (updateError) {
      console.error('Error updating grading status:', updateError);
      return NextResponse.json({ error: 'Failed to start grading process' }, { status: 500 });
    }

    // Initialize AI grading service and start grading
    const gradingService = new AIGradingService();
    
    // Run grading asynchronously (don't await to avoid timeout)
    gradingService.gradeAttempt(attemptId, (message) => {
      console.log(`AI Grading Progress for ${attemptId}: ${message}`);
    }).catch(async (error) => {
      console.error('AI grading failed:', error);
      
      // Update status to failed
      await supabase
        .from('student_attempts')
        .update({ 
          ai_grading_status: 'failed',
          ai_graded_at: new Date().toISOString()
        })
        .eq('id', attemptId);
    });

    return NextResponse.json({
      success: true,
      message: 'AI grading started successfully',
      attemptId: attemptId,
      status: 'in_progress'
    });

  } catch (error) {
    console.error('Error starting AI grading:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

// GET endpoint to check grading status
export async function GET(request: NextRequest) {
  try {
    const supabase = createSupabaseServerClient();
    
    // Get the current user
    const { data: { user }, error: userError } = await supabase.auth.getUser();
    if (userError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const attemptId = searchParams.get('attemptId');

    if (!attemptId) {
      return NextResponse.json({ error: 'Attempt ID is required' }, { status: 400 });
    }

    // Get attempt with grading status
    const { data: attempt, error: attemptError } = await supabase
      .from('student_attempts')
      .select('id, ai_grading_status, ai_graded_at, percentage_score, passed')
      .eq('id', attemptId)
      .eq('student_id', user.id)
      .single();

    if (attemptError || !attempt) {
      return NextResponse.json({ error: 'Attempt not found' }, { status: 404 });
    }

    return NextResponse.json({
      attemptId: attempt.id,
      gradingStatus: attempt.ai_grading_status,
      gradedAt: attempt.ai_graded_at,
      percentageScore: attempt.percentage_score,
      passed: attempt.passed
    });

  } catch (error) {
    console.error('Error checking grading status:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
} 