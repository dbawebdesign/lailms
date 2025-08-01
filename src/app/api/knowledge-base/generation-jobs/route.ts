import { NextRequest, NextResponse } from 'next/server';
import { createSupabaseServerClient } from '@/lib/supabase/server';

export async function GET(request: NextRequest) {
  try {
    const supabase = createSupabaseServerClient();
    
    // Check authentication
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Get recent generation jobs for the user with base class info and tasks
    const { data: jobs, error: jobsError } = await supabase
      .from('course_generation_jobs')
      .select(`
        *,
        base_classes(id, name),
        course_generation_tasks(
          id,
          task_identifier,
          task_type,
          status,
          error_message,
          created_at,
          updated_at
        )
      `)
      .eq('user_id', user.id)
      .order('created_at', { ascending: false })
      .limit(10);

    if (jobsError) {
      console.error('Error fetching generation jobs:', jobsError);
      return NextResponse.json(
        { error: 'Failed to fetch generation jobs' }, 
        { status: 500 }
      );
    }

    // Transform the data for the frontend
    const transformedJobs = (jobs || []).map((job: any) => {
      const jobData = job.job_data || {};
      const generationConfig = job.generation_config || {};
      const isV2Job = generationConfig.version === 'v2' || generationConfig.orchestrator === 'CourseGenerationOrchestratorV2';
      
      // Transform tasks data for V2 jobs
      const tasks = (job.course_generation_tasks || []).map((task: any) => ({
        id: task.id,
        type: task.task_type,
        status: task.status,
        sectionTitle: task.task_identifier,
        error: task.error_message
      }));
      
      return {
        id: job.id,
        status: job.status,
        progress: job.progress_percentage || 0,
        baseClassId: job.base_class_id,
        baseClassName: job.base_classes?.name || 'Unknown Course',
        title: jobData.title || 'Course Generation',
        error: job.error_message,
        result: job.result_data,
        createdAt: job.created_at,
        updatedAt: job.updated_at,
        estimatedMinutes: jobData.estimatedMinutes,
        isCleared: job.is_cleared,
        confettiShown: job.confetti_shown || false,
        // Include tasks data for V2 jobs
        tasks: isV2Job ? tasks : undefined,
        // V2 system indicators
        version: isV2Job ? 'v2' : 'v1',
        isV2: isV2Job,
        features: isV2Job ? generationConfig.features || [] : [],
        source: generationConfig.source || 'legacy'
      };
    });

    return NextResponse.json({
      success: true,
      jobs: transformedJobs
    });

  } catch (error) {
    console.error('Generation jobs API error:', error);
    return NextResponse.json(
      { error: 'Failed to fetch generation jobs' }, 
      { status: 500 }
    );
  }
} 