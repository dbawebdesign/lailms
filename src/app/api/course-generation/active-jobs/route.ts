import { NextRequest, NextResponse } from 'next/server';
import { createSupabaseServerClient } from '@/lib/supabase/server';

export async function GET(request: NextRequest) {
  try {
    const supabase = createSupabaseServerClient();
    
    // Get current user
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Fetch active jobs with base class info
    const { data: jobs, error } = await supabase
      .from('course_generation_jobs')
      .select(`
        id,
        status,
        progress_percentage,
        base_class_id,
        job_data,
        error_message,
        created_at,
        updated_at,
        total_tasks,
        completed_tasks,
        failed_tasks,
        base_classes (
          name
        )
      `)
      .eq('user_id', user.id)
      .eq('is_cleared', false)
      .in('status', ['queued', 'processing', 'completed', 'failed'])
      .order('created_at', { ascending: false })
      .limit(5);

    if (error) {
      console.error('Error fetching active jobs:', error);
      return NextResponse.json({ error: 'Failed to fetch jobs' }, { status: 500 });
    }

    // Transform data for the widget
    const transformedJobs = jobs?.map(job => ({
      id: job.id,
      status: job.status,
      progress: job.progress_percentage || 0,
      baseClassId: job.base_class_id,
      baseClassName: job.base_classes?.name || 'Unknown Course',
      title: (job.job_data as any)?.title || job.base_classes?.name || 'Course Generation',
      error: job.error_message,
      createdAt: job.created_at,
      updatedAt: job.updated_at,
      total_tasks: job.total_tasks,
      completed_tasks: job.completed_tasks,
      failed_tasks: job.failed_tasks,
      current_phase: (job.job_data as any)?.current_phase
    })) || [];

    return NextResponse.json({ 
      success: true, 
      jobs: transformedJobs 
    });

  } catch (error) {
    console.error('Error in active-jobs API:', error);
    return NextResponse.json({ 
      error: 'Internal server error' 
    }, { status: 500 });
  }
}