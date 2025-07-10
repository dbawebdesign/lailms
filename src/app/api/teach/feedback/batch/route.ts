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
    const { requests } = body;

    // Validate requests array
    if (!Array.isArray(requests) || requests.length === 0) {
      return NextResponse.json(
        { error: 'requests must be a non-empty array' },
        { status: 400 }
      );
    }

    // Validate each request
    for (const req of requests) {
      if (!req.responseId || !req.responseType || !req.questionType || 
          req.studentAnswer === undefined || req.correctAnswer === undefined || 
          req.isCorrect === undefined) {
        return NextResponse.json(
          { error: 'Each request must have responseId, responseType, questionType, studentAnswer, correctAnswer, and isCorrect' },
          { status: 400 }
        );
      }

      if (!['assessment_response', 'quiz_response'].includes(req.responseType)) {
        return NextResponse.json(
          { error: 'Invalid response type in request. Must be assessment_response or quiz_response' },
          { status: 400 }
        );
      }
    }

    // Limit batch size to prevent overwhelming the system
    if (requests.length > 50) {
      return NextResponse.json(
        { error: 'Batch size cannot exceed 50 requests' },
        { status: 400 }
      );
    }

    // Convert to FeedbackRequest objects
    const feedbackRequests: FeedbackRequest[] = requests.map(req => ({
      responseId: req.responseId,
      responseType: req.responseType,
      questionType: req.questionType,
      studentAnswer: req.studentAnswer,
      correctAnswer: req.correctAnswer,
      isCorrect: req.isCorrect,
      pointsAwarded: req.pointsAwarded || 0,
      maxPoints: req.maxPoints || 1,
      conceptsAssessed: req.conceptsAssessed || [],
      learningObjectives: req.learningObjectives || [],
      contextualData: req.contextualData || {}
    }));

    // Generate batch feedback
    const feedbackService = new FeedbackService();
    const feedbacks = await feedbackService.generateBatchFeedback(feedbackRequests);

    return NextResponse.json({
      success: true,
      feedbacks,
      processed: feedbacks.length,
      total: requests.length
    });
  } catch (error) {
    console.error('Error generating batch feedback:', error);
    return NextResponse.json(
      { error: 'Failed to generate batch feedback' },
      { status: 500 }
    );
  }
} 