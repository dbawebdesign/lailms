import { NextRequest, NextResponse } from 'next/server';
import { createSupabaseServerClient } from '@/lib/supabase/server';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ jobId: string }> }
) {
  try {
    const { jobId } = await params;
    const supabase = await createSupabaseServerClient();
    
    // Get the job details
    const { data: job, error: jobError } = await supabase
      .from('course_generation_jobs')
      .select(`
        *,
        base_classes!inner(
          id,
          name,
          description
        )
      `)
      .eq('id', jobId)
      .single();

    if (jobError || !job) {
      return NextResponse.json(
        { error: 'Job not found' },
        { status: 404 }
      );
    }

    // If job is completed, get the course outline
    let courseOutline = null;
    if (job.status === 'completed' && job.result_data && typeof job.result_data === 'object' && 'courseOutlineId' in job.result_data) {
      const { data: outline } = await supabase
        .from('course_outlines')
        .select('*')
        .eq('id', (job.result_data as any).courseOutlineId)
        .single();
      
      courseOutline = outline;
    }

    // Get task statistics
    const { data: taskStats } = await supabase
      .from('course_generation_tasks')
      .select('status')
      .eq('job_id', jobId);

    const totalTasks = taskStats?.length || 0;
    const completedTasks = taskStats?.filter(t => t.status === 'completed').length || 0;
    const failedTasks = taskStats?.filter(t => t.status === 'failed').length || 0;

    return NextResponse.json({
      success: true,
      job: {
        ...job,
        total_tasks: totalTasks,
        completed_tasks: completedTasks,
        failed_tasks: failedTasks
      },
      courseOutline
    });

  } catch (error) {
    console.error('Failed to get job status:', error);
    return NextResponse.json(
      { error: 'Failed to get job status' },
      { status: 500 }
    );
  }
}