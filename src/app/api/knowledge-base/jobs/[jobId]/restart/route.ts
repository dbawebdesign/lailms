import { NextResponse } from 'next/server';
import { createSupabaseServerClient } from '@/lib/supabase/server';
import { generationLogger } from '@/lib/services/course-generation-logger';

export async function POST(
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

    console.log(`🔄 Restarting job: ${jobId}`);
    
    // Log the restart attempt
    await generationLogger.logInfo(
      jobId,
      'Job restart requested by user',
      'restart_api',
      { userId: user.id, jobStatus: job.status }
    );

    // Mark job as failed first to stop any running processes
    await supabase
      .from('course_generation_jobs')
      .update({
        status: 'failed',
        error_message: 'Job restarted by user',
        updated_at: new Date().toISOString()
      })
      .eq('id', jobId);

    // Delete all existing tasks for a clean restart
    const { error: deleteError } = await supabase
      .from('course_generation_tasks')
      .delete()
      .eq('job_id', jobId);

    if (deleteError) {
      console.error('Failed to delete existing tasks:', deleteError);
      await generationLogger.logError(
        jobId,
        'Failed to delete existing tasks during restart',
        'restart_api',
        deleteError
      );
    }

    await generationLogger.logInfo(
      jobId,
      'Job marked for restart - ready for new generation',
      'restart_api',
      { userId: user.id }
    );

    return NextResponse.json({
      success: true,
      message: 'Job has been marked for restart. You can now initiate a new generation process.',
      jobId
    });

  } catch (error) {
    console.error('Error restarting job:', error);
    const errorMessage = error instanceof Error ? error.message : 'An unknown error occurred';
    
    if (params) {
      const { jobId } = await params;
      await generationLogger.logCritical(
        jobId,
        'Failed to restart job',
        'restart_api',
        error,
        'RESTART_FAILED'
      );
    }
    
    return NextResponse.json({ error: errorMessage }, { status: 500 });
  }
}