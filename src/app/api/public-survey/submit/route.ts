import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { PublicSurveySubmissionData, PublicSurveyQuestionSubmission } from '@/types/publicSurvey';

export async function POST(request: NextRequest) {
  try {
    // Use client-side Supabase client for public submissions
    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
    );
    
    const body: PublicSurveySubmissionData = await request.json();

    // Extract IP address from headers
    const forwardedFor = request.headers.get('x-forwarded-for');
    const realIp = request.headers.get('x-real-ip');
    const ip = forwardedFor?.split(',')[0] || realIp || 'unknown';

    // Get user agent
    const userAgent = request.headers.get('user-agent') || 'unknown';

    // Create survey response record
    const { data: surveyResponse, error: surveyError } = await supabase
      .from('public_survey_responses')
      .insert({
        session_id: crypto.randomUUID(),
        email: body.email || null,
        ip_address: ip,
        user_agent: userAgent,
        duration_seconds: body.duration || 0,
        device_info: body.deviceInfo || {
          userAgent,
          timestamp: new Date().toISOString()
        },
        completed_at: new Date().toISOString()
      })
      .select()
      .single();

    if (surveyError || !surveyResponse) {
      console.error('Error creating survey response:', surveyError);
      return NextResponse.json(
        { error: 'Failed to create survey response' },
        { status: 500 }
      );
    }

    // Insert individual question responses
    const questionResponses = body.responses.map((response: PublicSurveyQuestionSubmission) => ({
      survey_response_id: surveyResponse.id,
      question_id: response.question_id,
      response_value: response.answer
    }));

    const { error: responsesError } = await supabase
      .from('public_survey_question_responses')
      .insert(questionResponses);

    if (responsesError) {
      console.error('Error creating question responses:', responsesError);
      return NextResponse.json(
        { error: 'Failed to save question responses' },
        { status: 500 }
      );
    }

    return NextResponse.json({ success: true });

  } catch (error) {
    console.error('Error in public survey submission:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
} 