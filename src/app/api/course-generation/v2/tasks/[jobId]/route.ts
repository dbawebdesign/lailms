import { NextRequest, NextResponse } from 'next/server';
import { createSupabaseServerClient } from '@/lib/supabase/server';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ jobId: string }> }
) {
  try {
    const supabase = createSupabaseServerClient();
    const resolvedParams = await params;
    
    // Check authentication
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Verify job ownership
    const { data: job } = await supabase
      .from('course_generation_jobs')
      .select('id')
      .eq('id', resolvedParams.jobId)
      .eq('user_id', user.id)
      .single();

    if (!job) {
      return NextResponse.json(
        { error: 'Job not found' }, 
        { status: 404 }
      );
    }

    // Fetch all tasks for this job
    const { data: tasks, error: tasksError } = await supabase
      .from('course_generation_tasks')
      .select(`
        id,
        task_identifier,
        task_type,
        status,
        lesson_id,
        path_id,
        section_title,
        section_index,
        dependencies,
        execution_priority,
        current_retry_count,
        max_retry_count,
        error_message,
        error_severity,
        recovery_suggestions,
        started_at,
        completed_at,
        actual_duration_seconds,
        estimated_duration_seconds,
        result_metadata
      `)
      .eq('job_id', resolvedParams.jobId)
      .order('execution_priority', { ascending: true });

    if (tasksError) {
      console.error('Failed to fetch tasks:', tasksError);
      return NextResponse.json(
        { error: 'Failed to fetch tasks' }, 
        { status: 500 }
      );
    }

    // Group tasks by type for easier processing
    const tasksByType = tasks?.reduce((acc, task) => {
      if (!acc[task.task_type]) {
        acc[task.task_type] = [];
      }
      acc[task.task_type].push(task);
      return acc;
    }, {} as Record<string, any[]>) || {};

    return NextResponse.json({ 
      success: true, 
      tasks: tasks || [],
      tasksByType,
      summary: {
        total: tasks?.length || 0,
        pending: tasks?.filter(t => t.status === 'pending').length || 0,
        running: tasks?.filter(t => t.status === 'running').length || 0,
        completed: tasks?.filter(t => t.status === 'completed').length || 0,
        failed: tasks?.filter(t => t.status === 'failed').length || 0,
        skipped: tasks?.filter(t => t.status === 'skipped').length || 0,
      }
    });

  } catch (error) {
    console.error('Failed to fetch tasks:', error);
    return NextResponse.json(
      { error: 'Failed to fetch tasks' }, 
      { status: 500 }
    );
  }
} 