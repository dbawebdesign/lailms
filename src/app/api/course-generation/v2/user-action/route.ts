import { NextRequest, NextResponse } from 'next/server';
import { createSupabaseServerClient } from '@/lib/supabase/server';
import { 
  CreateUserActionRequest, 
  CreateUserActionResponse,
  CourseGenerationTaskUpdate,
  CourseGenerationJobUpdate
} from '@/types/course-generation';

export async function POST(request: NextRequest) {
  try {
    const supabase = createSupabaseServerClient();
    
    // Check authentication
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body: CreateUserActionRequest = await request.json();
    const { jobId, actionType, taskIds, actionContext } = body;

    // Verify job ownership
    const { data: job } = await supabase
      .from('course_generation_jobs')
      .select('*')
      .eq('id', jobId)
      .eq('user_id', user.id)
      .single();

    if (!job) {
      return NextResponse.json(
        { error: 'Job not found' }, 
        { status: 404 }
      );
    }

    // Record the user action
    const { data: userAction, error: actionError } = await supabase
      .from('course_generation_user_actions')
      .insert({
        job_id: jobId,
        user_id: user.id,
        action_type: actionType,
        affected_tasks: taskIds || [],
        action_context: actionContext || {},
        action_successful: true
      })
      .select()
      .single();

    if (actionError) {
      throw actionError;
    }

    // Handle different action types
    switch (actionType) {
      case 'retry_task':
        if (!taskIds || taskIds.length === 0) {
          throw new Error('Task IDs required for retry action');
        }
        
        // Update task statuses to pending for retry
        const retryUpdate: CourseGenerationTaskUpdate = {
          status: 'pending',
          current_retry_count: 0,
          error_message: null,
          error_category: null,
          error_severity: null,
          is_recoverable: null,
          recovery_suggestions: null
        };
        
        const { error: retryError } = await supabase
          .from('course_generation_tasks')
          .update(retryUpdate)
          .in('id', taskIds)
          .eq('job_id', jobId);
        
        if (retryError) throw retryError;
        break;

      case 'skip_task':
        if (!taskIds || taskIds.length === 0) {
          throw new Error('Task IDs required for skip action');
        }
        
        // Update task statuses to skipped
        const skipUpdate: CourseGenerationTaskUpdate = {
          status: 'skipped',
          completed_at: new Date().toISOString()
        };
        
        const { error: skipError } = await supabase
          .from('course_generation_tasks')
          .update(skipUpdate)
          .in('id', taskIds)
          .eq('job_id', jobId);
        
        if (skipError) throw skipError;
        break;

      case 'pause_job':
        // Update job status to paused
        const pauseUpdate: CourseGenerationJobUpdate = {
          status: 'paused',
          updated_at: new Date().toISOString()
        };
        
        const { error: pauseError } = await supabase
          .from('course_generation_jobs')
          .update(pauseUpdate)
          .eq('id', jobId);
        
        if (pauseError) throw pauseError;
        
        // Also pause any running tasks
        await supabase
          .from('course_generation_tasks')
          .update({ status: 'pending' })
          .eq('job_id', jobId)
          .eq('status', 'running');
        break;

      case 'resume_job':
        // Update job status to processing
        const resumeUpdate: CourseGenerationJobUpdate = {
          status: 'processing',
          updated_at: new Date().toISOString()
        };
        
        const { error: resumeError } = await supabase
          .from('course_generation_jobs')
          .update(resumeUpdate)
          .eq('id', jobId);
        
        if (resumeError) throw resumeError;
        break;

      case 'cancel_job':
        // Update job status to cancelled
        const cancelUpdate: CourseGenerationJobUpdate = {
          status: 'cancelled',
          completed_at: new Date().toISOString(),
          updated_at: new Date().toISOString()
        };
        
        const { error: cancelError } = await supabase
          .from('course_generation_jobs')
          .update(cancelUpdate)
          .eq('id', jobId);
        
        if (cancelError) throw cancelError;
        
        // Also cancel any pending tasks
        await supabase
          .from('course_generation_tasks')
          .update({ status: 'cancelled' })
          .eq('job_id', jobId)
          .in('status', ['pending', 'queued', 'running']);
        break;
    }

    // Fetch affected tasks if any
    let affectedTasks = [];
    if (taskIds && taskIds.length > 0) {
      const { data: tasks } = await supabase
        .from('course_generation_tasks')
        .select('*')
        .in('id', taskIds);
      
      affectedTasks = tasks || [];
    }

    const response: CreateUserActionResponse = {
      success: true,
      action: userAction,
      affectedTasks
    };

    return NextResponse.json(response);

  } catch (error) {
    console.error('Failed to process user action:', error);
    return NextResponse.json(
      { 
        error: 'Failed to process action',
        details: error instanceof Error ? error.message : 'Unknown error'
      }, 
      { status: 500 }
    );
  }
} 