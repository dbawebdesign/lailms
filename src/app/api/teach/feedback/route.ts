import { NextRequest, NextResponse } from 'next/server';
import { createSupabaseServerClient } from '@/lib/supabase/server';
import { FeedbackService, FeedbackRequest } from '@/lib/services/feedback-service';

export async function POST(request: NextRequest) {
  try {
    const supabase = createSupabaseServerClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    const { responseId, responseType, questionType, studentAnswer, correctAnswer, isCorrect, pointsAwarded, maxPoints, conceptsAssessed, learningObjectives, contextualData } = body;

    // Validate required fields
    if (!responseId || !responseType || !questionType || studentAnswer === undefined || correctAnswer === undefined || isCorrect === undefined) {
      return NextResponse.json(
        { error: 'Missing required fields: responseId, responseType, questionType, studentAnswer, correctAnswer, isCorrect' },
        { status: 400 }
      );
    }

    // Validate response type
    if (!['assessment_response', 'quiz_response'].includes(responseType)) {
      return NextResponse.json(
        { error: 'Invalid response type. Must be assessment_response or quiz_response' },
        { status: 400 }
      );
    }

    // Create feedback request
    const feedbackRequest: FeedbackRequest = {
      responseId,
      responseType,
      questionType,
      studentAnswer,
      correctAnswer,
      isCorrect,
      pointsAwarded: pointsAwarded || 0,
      maxPoints: maxPoints || 1,
      conceptsAssessed: conceptsAssessed || [],
      learningObjectives: learningObjectives || [],
      contextualData: contextualData || {}
    };

    // Generate feedback
    const feedbackService = new FeedbackService();
    const feedback = await feedbackService.generateFeedback(feedbackRequest);

    return NextResponse.json({
      success: true,
      feedback
    });
  } catch (error) {
    console.error('Error generating feedback:', error);
    return NextResponse.json(
      { error: 'Failed to generate feedback' },
      { status: 500 }
    );
  }
}

export async function GET(request: NextRequest) {
  try {
    const supabase = createSupabaseServerClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const responseId = searchParams.get('responseId');
    const responseType = searchParams.get('responseType');
    const limit = parseInt(searchParams.get('limit') || '10');

    let query = supabase
      .from('feedback_records')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(limit);

    if (responseId) {
      query = query.eq('response_id', responseId);
    }

    if (responseType) {
      query = query.eq('response_type', responseType);
    }

    const { data: feedbackRecords, error } = await query;

    if (error) {
      console.error('Error fetching feedback records:', error);
      return NextResponse.json({ error: 'Failed to fetch feedback records' }, { status: 500 });
    }

    return NextResponse.json({
      success: true,
      feedbackRecords: feedbackRecords || []
    });
  } catch (error) {
    console.error('Error fetching feedback records:', error);
    return NextResponse.json(
      { error: 'Failed to fetch feedback records' },
      { status: 500 }
    );
  }
} 