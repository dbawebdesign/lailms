import { NextRequest, NextResponse } from 'next/server';
import { createSupabaseServerClient } from '@/lib/supabase/server';
import { AssessmentAnalyticsService } from '@/lib/services/assessment-analytics-service';
import { Tables } from 'packages/types/db';

// GET /api/teach/analytics/assessments/[assessmentId] - Get analytics for specific assessment
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ assessmentId: string }> }
) {
  try {
    const supabase = createSupabaseServerClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { assessmentId } = await params;

    if (!assessmentId) {
      return NextResponse.json({ error: 'Assessment ID is required' }, { status: 400 });
    }

    // Verify user has access to this assessment
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

    // Check if user has access to the base class (teacher/admin check)
    const { data: baseClass, error: baseClassError } = await supabase
      .from('base_classes')
      .select('id, user_id')
      .eq('id', assessment.base_class_id)
      .single<Tables<'base_classes'>>();

    if (baseClassError || !baseClass) {
      return NextResponse.json({ error: 'Base class not found' }, { status: 404 });
    }

    // For now, allow access if user is the creator of the base class
    // TODO: Implement proper role-based access control
    if (baseClass.user_id !== user.id) {
      return NextResponse.json({ error: 'Access denied' }, { status: 403 });
    }

    const analyticsService = new AssessmentAnalyticsService();

    try {
      const analytics = await analyticsService.getAssessmentAnalytics(assessmentId);
      return NextResponse.json(analytics);
    } catch (serviceError: any) {
      console.error('Error getting assessment analytics:', serviceError);
      return NextResponse.json({ error: serviceError.message || 'Analytics service error' }, { status: 500 });
    }

  } catch (error) {
    console.error('Error in GET /api/teach/analytics/assessments/[assessmentId]:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

// POST /api/teach/analytics/assessments/[assessmentId] - Update cached analytics
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ assessmentId: string }> }
) {
  try {
    const supabase = createSupabaseServerClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { assessmentId } = await params;

    if (!assessmentId) {
      return NextResponse.json({ error: 'Assessment ID is required' }, { status: 400 });
    }

    // Verify user has access to this assessment
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

    const analyticsService = new AssessmentAnalyticsService();

    try {
      await analyticsService.updateCachedAnalytics(assessmentId);
      return NextResponse.json({ message: 'Analytics cache updated successfully' });
    } catch (serviceError: any) {
      console.error('Error updating cached analytics:', serviceError);
      return NextResponse.json({ error: serviceError.message || 'Analytics service error' }, { status: 500 });
    }

  } catch (error) {
    console.error('Error in POST /api/teach/analytics/assessments/[assessmentId]:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
