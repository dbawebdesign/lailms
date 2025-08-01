import { NextResponse } from 'next/server';
import { createSupabaseServerClient } from '@/lib/supabase/server';

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

    // Get job details to verify access and determine version
    const { data: job, error: jobError } = await supabase
      .from('course_generation_jobs')
      .select('generation_config, user_id, base_class_id, status')
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
    
    if (isV2) {
      // Get failed tasks from V2 system (course_generation_tasks table)
      const { data: failedTasks, error: tasksError } = await supabase
        .from('course_generation_tasks')
        .select(`
          id,
          task_identifier,
          task_type,
          status,
          lesson_id,
          path_id,
          base_class_id,
          section_index,
          section_title,
          error_message,
          error_details,
          current_retry_count,
          max_retry_count,
          is_recoverable,
          recovery_suggestions,
          created_at,
          updated_at
        `)
        .eq('job_id', jobId)
        .eq('status', 'failed')
        .order('created_at', { ascending: true });

      if (tasksError) {
        console.error('Error fetching V2 failed tasks:', tasksError);
        return NextResponse.json(
          { error: 'Failed to fetch failed tasks' },
          { status: 500 }
        );
      }

      // Format tasks for display
      const formattedTasks = (failedTasks || []).map(task => ({
        id: task.id,
        identifier: task.task_identifier,
        type: task.task_type,
        status: task.status,
        displayName: getTaskDisplayName(task),
        errorMessage: task.error_message,
        errorDetails: task.error_details,
        retryCount: task.current_retry_count,
        maxRetries: task.max_retry_count,
        isRecoverable: task.is_recoverable,
        recoverySuggestions: task.recovery_suggestions,
        createdAt: task.created_at,
        updatedAt: task.updated_at
      }));

      return NextResponse.json({
        success: true,
        failedTasks: formattedTasks,
        totalFailed: formattedTasks.length,
        orchestrator: 'v2',
        jobStatus: job.status
      });

    } else {
      // For V1 system, we would need to check the orchestration state
      // Since V1 uses in-memory state, we can't easily get failed tasks after completion
      // This is a limitation of V1's architecture
      return NextResponse.json({
        success: true,
        failedTasks: [],
        totalFailed: 0,
        orchestrator: 'v1',
        jobStatus: job.status,
        message: 'V1 failed task retrieval not supported - tasks are only available during active generation'
      });
    }

  } catch (error) {
    console.error('Error fetching failed tasks:', error);
    const errorMessage = error instanceof Error ? error.message : 'An unknown error occurred';
    return NextResponse.json({ error: errorMessage }, { status: 500 });
  }
}

function getTaskDisplayName(task: any): string {
  const typeMap: Record<string, string> = {
    'lesson_section': 'Lesson Section',
    'lesson_assessment': 'Lesson Assessment', 
    'lesson_mind_map': 'Mind Map',
    'lesson_brainbytes': 'Brainbytes',
    'path_quiz': 'Path Quiz',
    'class_exam': 'Class Exam'
  };

  const baseType = typeMap[task.task_type] || task.task_type;
  
  if (task.section_title) {
    return `${baseType}: ${task.section_title}`;
  }
  
  return baseType;
}