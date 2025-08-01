import { NextRequest, NextResponse } from 'next/server';
import { createSupabaseServerClient } from '@/lib/supabase/server';
import { TaskAnalytics, ErrorAnalytics } from '@/types/course-generation';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ jobId: string }> }
) {
  try {
    const supabase = createSupabaseServerClient();
    const resolvedParams = await params;
    
    // Check authentication
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Verify job ownership
    const { data: job } = await supabase
      .from('course_generation_jobs')
      .select('id')
      .eq('id', resolvedParams.jobId)
      .eq('user_id', user.id)
      .single();

    if (!job) {
      return NextResponse.json(
        { error: 'Job not found' }, 
        { status: 404 }
      );
    }

    // Fetch analytics data
    const { data: analytics, error: analyticsError } = await supabase
      .from('course_generation_analytics')
      .select(`
        id,
        job_id,
        api_calls_made,
        api_calls_failed,
        tokens_consumed,
        total_generation_time_seconds,
        success_rate,
        created_at,
        updated_at
      `)
      .eq('job_id', resolvedParams.jobId)
      .single();

    if (analyticsError && analyticsError.code !== 'PGRST116') {
      throw analyticsError;
    }

    // Fetch task statistics
    const { data: tasks } = await supabase
      .from('course_generation_tasks')
      .select(`
        id,
        task_identifier,
        task_type,
        status,
        actual_duration_seconds
      `)
      .eq('job_id', resolvedParams.jobId);

    // Fetch error statistics
    const { data: errors } = await supabase
      .from('course_generation_errors')
      .select(`
        id,
        task_id,
        error_severity,
        error_category,
        resolved_at
      `)
      .eq('job_id', resolvedParams.jobId);

    // Calculate task analytics
    const taskAnalytics: TaskAnalytics = {
      totalTasks: tasks?.length || 0,
      completedTasks: tasks?.filter(t => t.status === 'completed').length || 0,
      failedTasks: tasks?.filter(t => t.status === 'failed').length || 0,
      skippedTasks: tasks?.filter(t => t.status === 'skipped').length || 0,
      pendingTasks: tasks?.filter(t => ['pending', 'queued', 'running'].includes(t.status || '')).length || 0,
      avgExecutionTime: tasks?.reduce((sum, t) => sum + (t.actual_duration_seconds ?? 0), 0) / (tasks?.length || 1) || 0,
      tasksByType: tasks?.reduce((acc, t) => {
        const type = t.task_type;
        acc[type] = (acc[type] || 0) + 1;
        return acc;
      }, {} as Record<string, number>) || {},
      tasksByStatus: tasks?.reduce((acc, t) => {
        const status = t.status || 'pending';
        acc[status] = (acc[status] || 0) + 1;
        return acc;
      }, {} as Record<string, number>) || {}
    };

    // Calculate error analytics
    const errorAnalytics: ErrorAnalytics = {
      totalErrors: errors?.length || 0,
      errorsBySeverity: errors?.reduce((acc, e) => {
        const severity = e.error_severity || 'low';
        acc[severity] = (acc[severity] || 0) + 1;
        return acc;
      }, {} as Record<string, number>) || {},
      errorsByCategory: errors?.reduce((acc, e) => {
        const category = e.error_category;
        acc[category] = (acc[category] || 0) + 1;
        return acc;
      }, {} as Record<string, number>) || {},
      errorsByTask: errors?.reduce((acc, e) => {
        if (e.task_id) {
          acc[e.task_id] = (acc[e.task_id] || 0) + 1;
        }
        return acc;
      }, {} as Record<string, number>) || {},
      recoveryRate: errors?.filter(e => e.resolved_at).length / (errors?.length || 1) || 0,
      criticalErrors: errors?.filter(e => e.error_severity === 'critical') || []
    };

    return NextResponse.json({
      success: true,
      analytics: analytics || null,
      taskAnalytics,
      errorAnalytics
    });

  } catch (error) {
    console.error('Failed to fetch analytics:', error);
    return NextResponse.json(
      { error: 'Failed to fetch analytics' }, 
      { status: 500 }
    );
  }
} 