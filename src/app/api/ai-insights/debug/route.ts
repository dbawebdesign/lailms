import { createSupabaseServerClient } from '@/lib/supabase/server';
import { aiInsightsService } from '@/lib/services/ai-insights';
import { NextRequest, NextResponse } from 'next/server';

import { isTeacher, isStudent, PROFILE_ROLE_FIELDS } from '@/lib/utils/roleUtils';
export async function GET(request: NextRequest) {
  try {
    const supabase = createSupabaseServerClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    console.log('🔍 Debug: Starting AI insights debug for user:', user.id);

    // Step 1: Check if user profile exists
    const { data: profile, error: profileError } = await supabase
      .from('profiles')
      .select('*')
      .eq('user_id', user.id)
      .single();

    if (profileError || !profile) {
      return NextResponse.json({ 
        error: 'Profile not found', 
        details: profileError?.message,
        step: 'profile_lookup'
      }, { status: 404 });
    }

    console.log('✅ Debug: Profile found:', profile.first_name, profile.last_name, profile.role);

    // Step 2: Check existing insights
    const { data: existingInsights, error: insightsError } = await supabase
      .from('ai_insights')
      .select('*')
      .eq('user_id', user.id)
      .eq('is_dismissed', false)
      .gte('expires_at', new Date().toISOString());

    console.log('🔍 Debug: Existing insights:', existingInsights?.length || 0);

    // Step 3: Test data gathering
    let userData = null;
    try {
      if (isStudent(profile)) {
        // Test student data gathering
        const { data: courses } = await supabase
          .from('rosters')
          .select(`
            class_instances (
              id,
              name,
              base_classes (name, description)
            )
          `)
          .eq('profile_id', user.id)
          .eq('role', 'student');

        userData = {
          profile,
          activeCourses: courses || [],
          recentProgress: [],
          upcomingAssignments: [],
          grades: []
        };
      } else if (isTeacher(profile)) {
        // Test teacher data gathering
        const { data: classes } = await supabase
          .from('rosters')
          .select(`
            class_instances (
              id,
              name,
              base_classes (name, description)
            )
          `)
          .eq('profile_id', user.id)
          .eq('role', 'teacher');

        userData = {
          profile,
          activeClasses: classes || [],
          studentPerformance: [],
          gradingQueue: [],
          courseGeneration: []
        };
      }

      console.log('✅ Debug: User data gathered:', {
        role: profile.role,
        coursesCount: userData?.activeCourses?.length || userData?.activeClasses?.length || 0
      });

    } catch (dataError) {
      console.error('❌ Debug: Error gathering user data:', dataError);
      return NextResponse.json({ 
        error: 'Data gathering failed', 
        details: dataError,
        step: 'data_gathering'
      }, { status: 500 });
    }

    // Step 4: Test OpenAI API key
    const openaiConfigured = !!process.env.OPENAI_API_KEY;
    console.log('🔍 Debug: OpenAI configured:', openaiConfigured);

    // Step 5: Try generating insights
    try {
      console.log('🔄 Debug: Attempting to generate insights...');
      const insights = await aiInsightsService.getUserInsights(supabase, user.id);
      console.log('✅ Debug: Insights generated:', insights.length);

      return NextResponse.json({
        success: true,
        debug: {
          userId: user.id,
          profile: {
            name: `${profile.first_name} ${profile.last_name}`,
            role: profile.role
          },
          existingInsights: existingInsights?.length || 0,
          userData: {
            role: profile.role,
            coursesCount: userData?.activeCourses?.length || userData?.activeClasses?.length || 0
          },
          openaiConfigured,
          generatedInsights: insights.length
        },
        insights
      });

    } catch (generateError: any) {
      console.error('❌ Debug: Error generating insights:', generateError);
      return NextResponse.json({ 
        error: 'Insight generation failed', 
        details: generateError.message,
        step: 'insight_generation'
      }, { status: 500 });
    }

  } catch (error: any) {
    console.error('❌ Debug: General error:', error);
    return NextResponse.json(
      { error: 'Debug failed', details: error.message },
      { status: 500 }
    );
  }
} 