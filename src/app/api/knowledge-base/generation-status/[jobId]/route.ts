import { NextRequest, NextResponse } from 'next/server';
import { createSupabaseServerClient } from '@/lib/supabase/server';
import { courseGenerationOrchestrator } from '@/lib/services/course-generation-orchestrator';
import { Tables } from 'packages/types/db';

interface GenerationTask {
  id: string;
  type: 'lesson_section' | 'lesson_assessment' | 'path_quiz' | 'class_exam';
  status: 'pending' | 'running' | 'completed' | 'failed';
}

function areAllTasksFinished(tasks: GenerationTask[]): boolean {
  return tasks.every(task => task.status === 'completed' || task.status === 'failed');
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
      return NextResponse.json({
        success: true,
        isLive: true,
        job: {
          id: liveState.jobId,
          status: areAllTasksFinished(tasks as GenerationTask[]) ? 'completed' : job.status,
          progress: liveState.progress,
          error: job.error_message,
          tasks: tasks,
          confettiShown: (job as any).confetti_shown || false,
        },
        createdAt: job.created_at,
        updatedAt: job.updated_at
      });
    } else {
      // Fallback to database record if not live in memory
      // If result_data contains task summary, extract tasks for compatibility
      const resultData = job.result_data as any;
      const tasks = resultData?.tasks || undefined;
      
      return NextResponse.json({
        success: true,
        isLive: false,
        job: {
          id: job.id,
          status: job.status,
          progress: job.progress_percentage,
          error: job.error_message,
          result: job.result_data,
          tasks: tasks, // Include tasks from stored result_data if available
          confettiShown: (job as any).confetti_shown || false,
        },
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