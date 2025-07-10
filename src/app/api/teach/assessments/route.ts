import { NextRequest, NextResponse } from 'next/server';
import { createSupabaseServerClient } from '@/lib/supabase/server';
import { Tables } from 'packages/types/db';

// GET /api/teach/assessments - List assessments
export async function GET(request: NextRequest) {
  try {
    const supabase = createSupabaseServerClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    // Handle both parameter names for compatibility
    const baseClassId = searchParams.get('base_class_id') || searchParams.get('baseClassId');
    const includeStats = searchParams.get('includeStats') === 'true';

    if (!baseClassId) {
      return NextResponse.json({ error: 'base_class_id is required' }, { status: 400 });
    }

    const { data: assessments, error } = await supabase
      .from('assessments')
      .select('*')
      .eq('base_class_id', baseClassId)
      .returns<Tables<'assessments'>[]>();

    if (error) {
      console.error('Error fetching assessments:', error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    // If stats are requested, fetch actual question counts and other stats
    if (includeStats) {
      if (!assessments || assessments.length === 0) {
        return NextResponse.json({ assessments: [] });
      }

      // Get question counts for all assessments
      const assessmentIds = assessments.map((a) => a.id);
      const { data: questionCounts, error: questionError } = await supabase
        .from('assessment_questions')
        .select('assessment_id')
        .in('assessment_id', assessmentIds)
        .returns<Pick<Tables<'assessment_questions'>, 'assessment_id'>[]>();

      if (questionError) {
        console.error('Error fetching question counts:', questionError);
      }

      // Count questions per assessment
      const questionCountMap = new Map<string, number>();
      if (questionCounts) {
        questionCounts.forEach((q) => {
          const count = questionCountMap.get(q.assessment_id!) || 0;
          questionCountMap.set(q.assessment_id!, count + 1);
        });
      }

      // Get attempt counts and scores
      const { data: attempts, error: attemptError } = await supabase
        .from('student_attempts')
        .select('assessment_id, percentage_score')
        .in('assessment_id', assessmentIds)
        .eq('status', 'submitted')
        .returns<Pick<Tables<'student_attempts'>, 'assessment_id' | 'percentage_score'>[]>();

      if (attemptError) {
        console.error('Error fetching attempt stats:', attemptError);
      }

      // Calculate attempt stats per assessment
      const attemptStatsMap = new Map<string, { count: number; totalScore: number; scores: number[] }>();
      if (attempts) {
        attempts.forEach((attempt) => {
          const assessmentId = attempt.assessment_id!;
          const stats = attemptStatsMap.get(assessmentId) || { count: 0, totalScore: 0, scores: [] };
          stats.count++;
          if (attempt.percentage_score !== null) {
            stats.totalScore += attempt.percentage_score!;
            stats.scores.push(attempt.percentage_score!);
          }
          attemptStatsMap.set(assessmentId, stats);
        });
      }

      const assessmentsWithStats = assessments.map((assessment) => {
        const questionCount = questionCountMap.get(assessment.id) || 0;
        const attemptStats = attemptStatsMap.get(assessment.id) || { count: 0, totalScore: 0, scores: [] };
        const averageScore = attemptStats.scores.length > 0 
          ? attemptStats.totalScore / attemptStats.scores.length 
          : 0;

        return {
          ...assessment,
          questionCount,
          attemptCount: attemptStats.count,
          averageScore,
          completionRate: 0, // TODO: Calculate based on enrollments vs attempts
          lessonTitle: null, // TODO: Fetch if lesson_id exists
          pathTitle: null    // TODO: Fetch if path_id exists
        };
      });
      
      return NextResponse.json({ assessments: assessmentsWithStats });
    }

    // For simple requests, return assessments directly
    return NextResponse.json(assessments);

  } catch (error) {
    console.error('Error in GET /api/teach/assessments:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

// POST /api/teach/assessments - Create a new assessment
export async function POST(request: NextRequest) {
  try {
    const supabase = createSupabaseServerClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body: any = await request.json();

    if (!body.title || !body.assessment_type || !body.base_class_id) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
    }

    // Validate assessment type - use the database values directly
    const validAssessmentTypes = ['lesson', 'path', 'class'] as const;
    type ValidAssessmentType = typeof validAssessmentTypes[number];
    const assessmentType: ValidAssessmentType = validAssessmentTypes.includes(body.assessment_type as ValidAssessmentType) 
      ? body.assessment_type as ValidAssessmentType
      : 'lesson';

    const { data, error } = await supabase
      .from('assessments')
      .insert({
        title: body.title,
        assessment_type: assessmentType,
        base_class_id: body.base_class_id,
        lesson_id: body.lesson_id || null,
        path_id: body.path_id || null,
        description: body.description,
        settings: body.settings ?? {},
      })
      .select()
      .single<Tables<'assessments'>>();

    if (error) {
      console.error('Error creating assessment:', error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json(data, { status: 201 });

  } catch (error) {
    console.error('Error in POST /api/teach/assessments:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
