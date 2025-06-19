import { NextRequest, NextResponse } from 'next/server';
import { createSupabaseServerClient } from '@/lib/supabase/server';
import { AssessmentAnalyticsService } from '@/lib/services/assessment-analytics-service';

// GET /api/teach/analytics - Get general analytics overview
export async function GET(request: NextRequest) {
  try {
    const supabase = createSupabaseServerClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const type = searchParams.get('type');

    if (!type) {
      return NextResponse.json({ 
        error: 'Missing type parameter. Use: student-results, assessment-analytics, user-progress, trends, insights, difficulty-analysis' 
      }, { status: 400 });
    }

    const analyticsService = new AssessmentAnalyticsService();

    try {
      switch (type) {
        case 'student-results': {
          const userId = searchParams.get('user_id') || user.id;
          const assessmentId = searchParams.get('assessment_id');
          const assessmentType = searchParams.get('assessment_type') as any;

          const results = await analyticsService.getStudentResults(userId, assessmentId || undefined, assessmentType);
          return NextResponse.json(results);
        }

        case 'user-progress': {
          const userId = searchParams.get('user_id') || user.id;
          const assessmentId = searchParams.get('assessment_id');

          if (!assessmentId) {
            return NextResponse.json({ error: 'assessment_id is required for user-progress' }, { status: 400 });
          }

          const progress = await analyticsService.getUserProgress(userId, assessmentId);
          return NextResponse.json(progress);
        }

        case 'trends': {
          const userId = searchParams.get('user_id') || user.id;
          const assessmentType = searchParams.get('assessment_type') as any;
          const daysPeriod = parseInt(searchParams.get('days_period') || '30');

          const trends = await analyticsService.getUserPerformanceTrends(userId, assessmentType, daysPeriod);
          return NextResponse.json(trends);
        }

        case 'insights': {
          const userId = searchParams.get('user_id') || user.id;
          const assessmentId = searchParams.get('assessment_id');

          const insights = await analyticsService.generateInsights(userId, assessmentId || undefined);
          return NextResponse.json(insights);
        }

        case 'difficulty-analysis': {
          const assessmentIds = searchParams.get('assessment_ids')?.split(',');
          
          if (!assessmentIds || assessmentIds.length === 0) {
            return NextResponse.json({ error: 'assessment_ids is required for difficulty-analysis' }, { status: 400 });
          }

          const analysis = await analyticsService.getAssessmentDifficultyAnalysis(assessmentIds);
          return NextResponse.json(analysis);
        }

        default:
          return NextResponse.json({ error: 'Invalid type parameter' }, { status: 400 });
      }
    } catch (serviceError: any) {
      console.error(`Error in analytics service (${type}):`, serviceError);
      return NextResponse.json({ error: serviceError.message || 'Analytics service error' }, { status: 500 });
    }

  } catch (error) {
    console.error('Error in GET /api/teach/analytics:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
} 