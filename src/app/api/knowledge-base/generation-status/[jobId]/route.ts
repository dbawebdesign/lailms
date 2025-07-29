import { NextRequest, NextResponse } from 'next/server';
import { createSupabaseServerClient } from '@/lib/supabase/server';
import { courseGenerationOrchestrator } from '@/lib/services/course-generation-orchestrator';
import { Tables } from 'packages/types/db';

interface GenerationTask {
  id: string;
  type: 'lesson_section' | 'lesson_assessment' | 'path_quiz' | 'class_exam';
  status: 'pending' | 'running' | 'completed' | 'failed';
}

function determineJobStatus(tasks: GenerationTask[], dbStatus: string): string {
  if (!tasks || tasks.length === 0) {
    // If no tasks available, rely on database status
    return dbStatus;
  }

  const completedTasks = tasks.filter(task => task.status === 'completed');
  const failedTasks = tasks.filter(task => task.status === 'failed');
  const runningTasks = tasks.filter(task => task.status === 'running');
  const pendingTasks = tasks.filter(task => task.status === 'pending');

  // If all tasks are completed, job is completed
  if (completedTasks.length === tasks.length) {
    return 'completed';
  }

  // If there are running or pending tasks, job is still processing
  if (runningTasks.length > 0 || pendingTasks.length > 0) {
    return 'processing';
  }

  // If some tasks completed and some failed, but no running/pending tasks
  if (completedTasks.length > 0 && failedTasks.length > 0) {
    return 'completed'; // Partial success is still considered completed
  }

  // If all tasks failed (very rare case)
  if (failedTasks.length === tasks.length) {
    return 'failed';
  }

  // Fallback to database status
  return dbStatus;
}

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
      .single<Tables<'course_generation_jobs'>>();

    if (jobError || !job) {
      return NextResponse.json(
        { error: 'Job not found or access denied' }, 
        { status: 404 }
      );
    }

    // Try to get live, detailed state from the orchestrator
    const liveState = courseGenerationOrchestrator.getJobState(jobId);

    if (liveState) {
      // Serialize Map to Array for JSON response
      const tasks = Array.from(liveState.tasks.values());
      const determinedStatus = determineJobStatus(tasks as GenerationTask[], job.status || 'processing');
      
      return NextResponse.json({
        success: true,
        isLive: true,
        job: {
          id: liveState.jobId,
          status: determinedStatus,
          progress: liveState.progress,
          error: job.error_message,
          tasks: tasks,
          confettiShown: (job as any).confetti_shown || false,
          result: job.result_data, // Include result for consistency with jobs list API
          result_data: job.result_data, // Include result_data for new code
        },
        result_data: job.result_data, // Include result_data for live jobs too
        progress_percentage: liveState.progress,
        courseOutline: (job.result_data as any)?.courseOutline, // Include courseOutline for redirect
        createdAt: job.created_at,
        updatedAt: job.updated_at
      });
    } else {
      // Fallback to database record if not live in memory
      // If result_data contains task summary, extract tasks for compatibility
      const resultData = job.result_data as any;
      const tasks = resultData?.tasks || undefined;
      
      // Use stored status or determine from tasks if available
      const determinedStatus = tasks ? determineJobStatus(tasks, job.status || 'processing') : job.status;
      
      return NextResponse.json({
        success: true,
        isLive: false,
        job: {
          id: job.id,
          status: determinedStatus,
          progress: job.progress_percentage,
          error: job.error_message,
          result: job.result_data, // Include result for consistency with jobs list API
          result_data: job.result_data, // Include result_data for new code
          tasks: tasks, // Include tasks from stored result_data if available
          confettiShown: (job as any).confetti_shown || false,
        },
        result_data: job.result_data, // Include result_data at root level for consistency
        progress_percentage: job.progress_percentage,
        courseOutline: (job.result_data as any)?.courseOutline, // Include courseOutline for redirect
        createdAt: job.created_at,
        updatedAt: job.updated_at
      });
    }

  } catch (error) {
    console.error('Job status check error:', error);
    return NextResponse.json(
      { error: 'Failed to check job status' }, 
      { status: 500 }
    );
  }
} 