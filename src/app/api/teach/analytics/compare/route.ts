import { NextRequest, NextResponse } from 'next/server';
import { createSupabaseServerClient } from '@/lib/supabase/server';
import { AssessmentAnalyticsService } from '@/lib/services/assessment-analytics-service';
import { Tables } from 'packages/types/db';

// POST /api/teach/analytics/compare - Compare user performance
export async function POST(request: NextRequest) {
  try {
    const supabase = createSupabaseServerClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    const { userIds, assessmentId, type = 'performance' } = body;

    if (!userIds || !Array.isArray(userIds) || userIds.length === 0) {
      return NextResponse.json({ error: 'userIds array is required' }, { status: 400 });
    }

    if (!assessmentId && type === 'performance') {
      return NextResponse.json({ error: 'assessmentId is required for performance comparison' }, { status: 400 });
    }

    // Verify user has access to the assessment (if provided)
    if (assessmentId) {
      const { data: assessment, error: assessmentError } = await supabase
        .from('assessments')
        .select('id, base_class_id')
        .eq('id', assessmentId)
        .single<Tables<'assessments'>>();

      if (assessmentError || !assessment) {
        return NextResponse.json({ error: 'Assessment not found' }, { status: 404 });
      }

      // Check if assessment has a base class
      if (!assessment.base_class_id) {
        return NextResponse.json({ error: 'Assessment not associated with a base class' }, { status: 400 });
      }

      // Check if user has access to the base class
      const { data: baseClass, error: baseClassError } = await supabase
        .from('base_classes')
        .select('id, user_id')
        .eq('id', assessment.base_class_id)
        .single<Tables<'base_classes'>>();

      if (baseClassError || !baseClass) {
        return NextResponse.json({ error: 'Base class not found' }, { status: 404 });
      }

      if (baseClass.user_id !== user.id) {
        return NextResponse.json({ error: 'Access denied' }, { status: 403 });
      }
    }

    const analyticsService = new AssessmentAnalyticsService();

    try {
      switch (type) {
        case 'performance': {
          const comparison = await analyticsService.compareUserPerformance(userIds, assessmentId);
          return NextResponse.json(comparison);
        }

        case 'topic-analysis': {
          // Get topic analysis for each user and compare
          const analyses = await Promise.all(
            userIds.map(async (userId: string) => {
              const analysis = await analyticsService.getTopicAnalysis(userId, assessmentId ? [assessmentId] : undefined);
              return {
                user_id: userId,
                ...analysis
              };
            })
          );

          return NextResponse.json({
            type: 'topic-analysis',
            users: analyses,
            comparison_summary: {
              total_users: analyses.length,
              common_strengths: findCommonTopics(analyses.map(a => a.strengths)),
              common_weaknesses: findCommonTopics(analyses.map(a => a.weaknesses))
            }
          });
        }

        default:
          return NextResponse.json({ error: 'Invalid comparison type' }, { status: 400 });
      }
    } catch (serviceError: any) {
      console.error('Error in comparison analytics:', serviceError);
      return NextResponse.json({ error: serviceError.message || 'Analytics service error' }, { status: 500 });
    }

  } catch (error) {
    console.error('Error in POST /api/teach/analytics/compare:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

// Helper function to find common topics across users
function findCommonTopics(topicArrays: Array<Array<{ topic: string; success_rate: number; question_count: number; avg_time_spent: number }>>) {
  if (topicArrays.length === 0) return [];

  const topicCounts: Record<string, { count: number; avg_success_rate: number; total_questions: number }> = {};

  topicArrays.forEach(topics => {
    topics.forEach(topicData => {
      if (!topicCounts[topicData.topic]) {
        topicCounts[topicData.topic] = {
          count: 0,
          avg_success_rate: 0,
          total_questions: 0
        };
      }
      topicCounts[topicData.topic].count++;
      topicCounts[topicData.topic].avg_success_rate += topicData.success_rate;
      topicCounts[topicData.topic].total_questions += topicData.question_count;
    });
  });

  // Return topics that appear for at least 50% of users
  const threshold = Math.ceil(topicArrays.length * 0.5);
  
  return Object.entries(topicCounts)
    .filter(([_, data]) => data.count >= threshold)
    .map(([topic, data]) => ({
      topic,
      frequency: data.count / topicArrays.length,
      avg_success_rate: data.avg_success_rate / data.count,
      total_questions: data.total_questions
    }))
    .sort((a, b) => b.frequency - a.frequency);
}
