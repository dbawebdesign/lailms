import { NextRequest, NextResponse } from 'next/server';
import { createSupabaseServerClient } from '@/lib/supabase/server';
import { CourseGenerationJobDetails } from '@/types/course-generation';

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

    // Fetch job details
    const { data: job, error: jobError } = await supabase
      .from('course_generation_jobs')
      .select(`
        *,
        base_classes!inner(
          id,
          name,
          description
        )
      `)
      .eq('id', resolvedParams.jobId)
      .eq('user_id', user.id)
      .single();

    if (jobError || !job) {
      return NextResponse.json(
        { error: 'Job not found' }, 
        { status: 404 }
      );
    }

    // Calculate real-time progress
    const { data: taskStats } = await supabase
      .from('course_generation_tasks')
      .select('status')
      .eq('job_id', resolvedParams.jobId);

    if (taskStats) {
      const total = taskStats.length;
      const completed = taskStats.filter(t => 
        t.status && ['completed', 'skipped'].includes(t.status)
      ).length;
      job.progress_percentage = total > 0 ? Math.round((completed / total) * 100) : 0;
    }

    return NextResponse.json({ 
      success: true, 
      job 
    });

  } catch (error) {
    console.error('Failed to fetch job:', error);
    return NextResponse.json(
      { error: 'Failed to fetch job details' }, 
      { status: 500 }
    );
  }
} 