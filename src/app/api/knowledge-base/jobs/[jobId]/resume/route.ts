import { NextResponse } from 'next/server';
import { createSupabaseServerClient } from '@/lib/supabase/server';
import { CourseGenerationOrchestratorV2 } from '@/lib/services/course-generation-orchestrator-v2';

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

    // Check authentication - allow service role bypass
    const isServiceRole = request.headers.get('x-service-role') === 'true';
    const supabase = createSupabaseServerClient();
    
    let user = null;
    if (!isServiceRole) {
      const { data: { user: authUser }, error: authError } = await supabase.auth.getUser();
      if (authError || !authUser) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
      }
      user = authUser;
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

    // Verify user has access to this job (skip for service role)
    if (!isServiceRole && job.user_id !== user?.id) {
      return NextResponse.json({ error: 'Access denied' }, { status: 403 });
    }

    // Check if job is in a resumable state
    if (job.status !== 'processing') {
      return NextResponse.json(
        { error: `Job is not in processing state. Current status: ${job.status}` },
        { status: 400 }
      );
    }

    console.log(`🔄 Resuming stuck job: ${jobId}`);
    
    // Get the request data from the job
    const request_data = job.job_data as any;
    if (!request_data) {
      return NextResponse.json(
        { error: 'Job data not found' },
        { status: 400 }
      );
    }

    // Create orchestrator and resume execution
    const orchestrator = new CourseGenerationOrchestratorV2();
    
    // We need to create a minimal outline to restart the execution engine
    // Since the job was already started, the tasks should be in the database
    const { data: tasks, error: tasksError } = await supabase
      .from('course_generation_tasks')
      .select('*')
      .eq('job_id', jobId)
      .limit(1);

    if (tasksError || !tasks || tasks.length === 0) {
      return NextResponse.json(
        { error: 'No tasks found for this job' },
        { status: 400 }
      );
    }

    // Resume execution in background
    setTimeout(async () => {
      try {
        console.log(`🚀 Starting execution engine resume for job ${jobId}`);
        
        // Create a minimal outline - the execution engine will work with existing tasks
        const minimalOutline = {
          title: request_data.title || 'Course',
          description: request_data.description || '',
          paths: [], // Will be populated from existing tasks
          totalLessons: 0,
          estimatedDurationWeeks: request_data.estimatedDurationWeeks || 4
        };

        // Start the execution engine directly (it will pick up existing tasks)
        await (orchestrator as any).runExecutionEngine(jobId, minimalOutline, request_data);
        
        // Finalize if successful
        await (orchestrator as any).finalizeGeneration(jobId);
        
        console.log(`✅ Job ${jobId} resumed and completed successfully`);
        
      } catch (error) {
        console.error(`❌ Failed to resume job ${jobId}:`, error);
        
        // Mark job as failed
        await supabase
          .from('course_generation_jobs')
          .update({
            status: 'failed',
            error_message: `Resume failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
            updated_at: new Date().toISOString()
          })
          .eq('id', jobId);
      }
    }, 1000); // Start after 1 second delay

    return NextResponse.json({
      success: true,
      message: `Job ${jobId} resume initiated. The execution engine will restart in the background.`,
      jobId
    });

  } catch (error) {
    console.error('Error resuming job:', error);
    const errorMessage = error instanceof Error ? error.message : 'An unknown error occurred';
    return NextResponse.json({ error: errorMessage }, { status: 500 });
  }
}