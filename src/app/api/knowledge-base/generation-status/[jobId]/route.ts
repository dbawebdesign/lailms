import { NextRequest, NextResponse } from 'next/server';
import { createSupabaseServerClient } from '@/lib/supabase/server';
import { courseGenerator } from '@/lib/services/course-generator';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ jobId: string }> }
) {
  try {
    const { jobId } = await params;
    const supabase = createSupabaseServerClient();
    
    // Check authentication
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Verify user owns this job
    const { data: job, error: jobError } = await supabase
      .from('course_generation_jobs')
      .select('*')
      .eq('id', jobId)
      .eq('user_id', user.id)
      .single();

    if (jobError || !job) {
      return NextResponse.json(
        { error: 'Job not found or access denied' }, 
        { status: 404 }
      );
    }

    // Get current job status
    const jobStatus = await courseGenerator.getGenerationJob(jobId);

    if (!jobStatus) {
      return NextResponse.json(
        { error: 'Job status not available' }, 
        { status: 404 }
      );
    }

    let courseOutline = null;
    if (jobStatus.status === 'completed' && jobStatus.result?.courseOutlineId) {
      courseOutline = await courseGenerator.getCourseOutline(jobStatus.result.courseOutlineId);
    }

    return NextResponse.json({
      success: true,
      job: {
        id: jobStatus.id,
        status: jobStatus.status,
        progress: jobStatus.progress,
        error: jobStatus.error,
        result: jobStatus.result
      },
      courseOutline,
      createdAt: job.created_at,
      updatedAt: job.updated_at
    });

  } catch (error) {
    console.error('Job status check error:', error);
    return NextResponse.json(
      { error: 'Failed to check job status' }, 
      { status: 500 }
    );
  }
} 