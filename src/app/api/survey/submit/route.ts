import { NextRequest, NextResponse } from 'next/server';
import { createSupabaseServerClient } from '@/lib/supabase/server';

export async function POST(request: NextRequest) {
  try {
    const { responses, duration, deviceInfo } = await request.json();
    
    if (!responses || !duration) {
      return NextResponse.json(
        { error: 'Missing required fields' },
        { status: 400 }
      );
    }

    const supabase = createSupabaseServerClient();
    
    // Get current user
    const { data: { user }, error: userError } = await supabase.auth.getUser();
    
    if (userError || !user) {
      return NextResponse.json(
        { error: 'User not authenticated' },
        { status: 401 }
      );
    }

    // Use raw SQL to insert survey response
    const { data: surveyResponse, error: responseError } = await supabase
      .rpc('insert_survey_response', {
        p_user_id: user.id,
        p_duration_seconds: duration,
        p_device_info: deviceInfo,
        p_responses: JSON.stringify(responses)
      });

    if (responseError) {
      console.error('Error saving survey response:', responseError);
      return NextResponse.json(
        { error: 'Failed to save survey response' },
        { status: 500 }
      );
    }

    // Update user profile to mark survey as completed
    const { error: profileError } = await supabase
      .rpc('update_profile_survey_completed', {
        p_user_id: user.id
      });

    if (profileError) {
      console.error('Error updating profile:', profileError);
      return NextResponse.json(
        { error: 'Failed to update profile' },
        { status: 500 }
      );
    }

    return NextResponse.json({ 
      success: true, 
      message: 'Survey submitted successfully' 
    });

  } catch (error) {
    console.error('Survey submission error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
} 