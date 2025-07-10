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

    // Get recent generation jobs for the user with base class info
    const { data: jobs, error: jobsError } = await supabase
      .from('course_generation_jobs')
      .select(`
        *,
        base_classes(id, name)
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