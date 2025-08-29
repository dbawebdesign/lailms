import { NextRequest, NextResponse } from 'next/server'
import { createSupabaseServerClient } from '@/lib/supabase/server'
import { getActiveProfile } from '@/lib/auth/family-helpers'

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const attemptId = searchParams.get('attemptId');

    console.log('Status API called with attemptId:', attemptId);

    if (!attemptId) {
      return NextResponse.json({ error: 'Attempt ID is required' }, { status: 400 });
    }

    const supabase = createSupabaseServerClient();

    // Get the active profile (handles both regular users and sub-accounts)
    const activeProfileData = await getActiveProfile();
    
    if (!activeProfileData) {
      console.log('Auth error in status API: No active profile found');
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    
    const { profile } = activeProfileData;
    console.log('User authenticated:', profile.user_id);

    // Get the attempt with assessment details
    const { data: attempt, error: attemptError } = await supabase
      .from('student_attempts')
      .select(`
        *,
        assessment:assessments (
          id,
          title,
          passing_score_percentage
        )
      `)
      .eq('id', attemptId)
      .eq('student_id', profile.user_id) // Use student_id instead of user_id
      .single();

    if (attemptError || !attempt) {
      console.log('Attempt not found error:', attemptError, 'attemptId:', attemptId, 'userId:', profile.user_id);
      return NextResponse.json({ error: 'Attempt not found' }, { status: 404 });
    }

    console.log('Attempt found:', attempt.id, 'status:', attempt.status, 'ai_grading_status:', attempt.ai_grading_status);

    // Return the current status and scores
    return NextResponse.json({
      success: true,
      attemptId: attempt.id,
      status: attempt.status,
      aiGradingStatus: attempt.ai_grading_status,
      totalPoints: attempt.total_points || 0,
      earnedPoints: attempt.earned_points || 0,
      percentageScore: attempt.percentage_score || 0,
      passed: attempt.passed,
      needsAiGrading: attempt.ai_grading_status === 'pending' || attempt.ai_grading_status === 'in_progress',
      isGradingComplete: attempt.ai_grading_status === 'completed' || attempt.ai_grading_status === 'failed',
      gradingFailed: attempt.ai_grading_status === 'failed',
      submittedAt: attempt.submitted_at,
      gradedAt: attempt.ai_graded_at,
      assessment: attempt.assessment
    });

  } catch (error) {
    console.error('Error checking assessment status:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
} 