import { NextResponse } from 'next/server';
import { createSupabaseServerClient } from '@/lib/supabase/server';
import { courseGenerationOrchestrator } from '@/lib/services/course-generation-orchestrator';
import { CourseGenerationOrchestratorV2 } from '@/lib/services/course-generation-orchestrator-v2';

export async function POST(
  request: Request,
  { params }: { params: Promise<{ jobId: string }> }
) {
  try {
    const { jobId } = await params;
    const { taskId, taskIdentifier } = await request.json();

    if (!jobId || (!taskId && !taskIdentifier)) {
      return NextResponse.json(
        { error: 'Missing jobId and taskId/taskIdentifier' },
        { status: 400 }
      );
    }

    // Check authentication
    const supabase = createSupabaseServerClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Get job details to determine which orchestrator to use
    const { data: job, error: jobError } = await supabase
      .from('course_generation_jobs')
      .select('generation_config, user_id, base_class_id')
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

    const isV2 = job.generation_config?.version === 'v2';
    let success = false;

    if (isV2) {
      // Use V2 orchestrator
      const orchestratorV2 = new CourseGenerationOrchestratorV2();
      const identifier = taskIdentifier || taskId; // V2 uses task_identifier
      success = await orchestratorV2.regenerateTask(jobId, identifier);
    } else {
      // Use V1 orchestrator
      const identifier = taskId || taskIdentifier; // V1 uses taskId
      success = await courseGenerationOrchestrator.regenerateTask(jobId, identifier);
    }

    if (success) {
      return NextResponse.json({ 
        message: 'Task regeneration started',
        orchestrator: isV2 ? 'v2' : 'v1'
      });
    } else {
      return NextResponse.json(
        { error: 'Failed to regenerate task. Job or task not found, or task not in failed state.' },
        { status: 404 }
      );
    }
  } catch (error) {
    console.error('Error regenerating task:', error);
    const errorMessage = error instanceof Error ? error.message : 'An unknown error occurred';
    return NextResponse.json({ error: errorMessage }, { status: 500 });
  }
} 