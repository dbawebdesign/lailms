import { NextResponse } from 'next/server';
import { createSupabaseServerClient } from '@/lib/supabase/server';
import { generationLogger } from '@/lib/services/course-generation-logger';

export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ jobId: string }> }
) {
  try {
    const { jobId } = await params;

    if (!jobId) {
      return NextResponse.json(
        { error: 'Missing jobId' },
        { status: 400 }
      );
    }

    // Check authentication
    const supabase = createSupabaseServerClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Get job details
    const { data: job, error: jobError } = await supabase
      .from('course_generation_jobs')
      .select('*')
      .eq('id', jobId)
      .single();

    if (jobError || !job) {
      return NextResponse.json(
        { error: 'Job not found' },
        { status: 404 }
      );
    }

    // Verify user has access to this job
    if (job.user_id !== user.id) {
      return NextResponse.json({ error: 'Access denied' }, { status: 403 });
    }

    console.log(`🗑️ Deleting job: ${jobId}`);
    
    // Log the deletion attempt
    await generationLogger.logInfo(
      jobId,
      'Job deletion requested by user',
      'delete_api',
      { userId: user.id, jobStatus: job.status }
    );

    // Delete the job (this will cascade to delete tasks, logs, and alerts due to foreign key constraints)
    const { error: deleteError } = await supabase
      .from('course_generation_jobs')
      .delete()
      .eq('id', jobId);

    if (deleteError) {
      console.error('Failed to delete job:', deleteError);
      await generationLogger.logError(
        jobId,
        'Failed to delete job',
        'delete_api',
        deleteError
      );
      return NextResponse.json(
        { error: 'Failed to delete job' },
        { status: 500 }
      );
    }

    console.log(`✅ Job ${jobId} deleted successfully`);

    return NextResponse.json({
      success: true,
      message: 'Job deleted successfully',
      jobId
    });

  } catch (error) {
    console.error('Error deleting job:', error);
    const errorMessage = error instanceof Error ? error.message : 'An unknown error occurred';
    
    if (params) {
      const { jobId } = await params;
      await generationLogger.logCritical(
        jobId,
        'Failed to delete job',
        'delete_api',
        error,
        'DELETE_FAILED'
      );
    }
    
    return NextResponse.json({ error: errorMessage }, { status: 500 });
  }
}

export async function GET(
  request: Request,
  { params }: { params: Promise<{ jobId: string }> }
) {
  try {
    const { jobId } = await params;

    if (!jobId) {
      return NextResponse.json(
        { error: 'Missing jobId' },
        { status: 400 }
      );
    }

    // Check authentication
    const supabase = createSupabaseServerClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Get job details with tasks
    const { data: job, error: jobError } = await supabase
      .from('course_generation_jobs')
      .select(`
        *,
        course_generation_tasks(*)
      `)
      .eq('id', jobId)
      .single();

    if (jobError || !job) {
      return NextResponse.json(
        { error: 'Job not found' },
        { status: 404 }
      );
    }

    // Verify user has access to this job
    if (job.user_id !== user.id) {
      return NextResponse.json({ error: 'Access denied' }, { status: 403 });
    }

    return NextResponse.json({
      success: true,
      job
    });

  } catch (error) {
    console.error('Error fetching job:', error);
    const errorMessage = error instanceof Error ? error.message : 'An unknown error occurred';
    return NextResponse.json({ error: errorMessage }, { status: 500 });
  }
}