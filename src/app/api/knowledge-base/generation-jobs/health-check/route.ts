import { NextRequest, NextResponse } from 'next/server';
import { createSupabaseServerClient } from '@/lib/supabase/server';
import { courseGenerationOrchestrator } from '@/lib/services/course-generation-orchestrator';
import { Tables } from 'packages/types/db';

interface StuckJob {
  id: string;
  status: string;
  created_at: string;
  updated_at: string;
  progress_percentage: number;
  stuck_duration_minutes: number;
  running_tasks?: string[];
  failed_tasks?: string[];
}

export async function GET(request: NextRequest) {
  try {
    const supabase = createSupabaseServerClient();
    
    // Check authentication
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Get all jobs that might be stuck (running for more than 30 minutes)
    const thirtyMinutesAgo = new Date();
    thirtyMinutesAgo.setMinutes(thirtyMinutesAgo.getMinutes() - 30);

    const { data: potentiallyStuckJobs, error: jobsError } = await supabase
      .from('course_generation_jobs')
      .select('*')
      .eq('user_id', user.id)
      .in('status', ['running', 'pending'])
      .lt('updated_at', thirtyMinutesAgo.toISOString())
      .order('created_at', { ascending: false });

    if (jobsError) {
      return NextResponse.json({ error: 'Failed to fetch jobs' }, { status: 500 });
    }

    const stuckJobs: StuckJob[] = [];
    const healthyJobs: any[] = [];

    for (const job of potentiallyStuckJobs || []) {
      // Skip jobs with invalid dates
      if (!job.created_at || !job.updated_at) {
        console.warn(`Skipping job ${job.id} with invalid dates`);
        continue;
      }
      
      const createdAt = new Date(job.created_at);
      const updatedAt = new Date(job.updated_at);
      const now = new Date();
      
      const stuckDurationMinutes = Math.floor((now.getTime() - updatedAt.getTime()) / (1000 * 60));
      
      // Check if job has live orchestration state
      const liveState = courseGenerationOrchestrator.getJobState(job.id);
      
      if (liveState) {
        // Job has live state - check if tasks are actually progressing
        const runningTasks = Array.from(liveState.runningTasks);
        const tasksArray = Array.from(liveState.tasks.values());
        const failedTasks = tasksArray.filter(t => t.status === 'failed').map(t => t.id);
        
        // Consider stuck if no progress for 30+ minutes
        if (stuckDurationMinutes >= 30) {
          stuckJobs.push({
            id: job.id,
            status: job.status || 'unknown',
            created_at: job.created_at,
            updated_at: job.updated_at,
            progress_percentage: job.progress_percentage || 0,
            stuck_duration_minutes: stuckDurationMinutes,
            running_tasks: runningTasks,
            failed_tasks: failedTasks
          });
        } else {
          healthyJobs.push({
            id: job.id,
            status: job.status,
            progress_percentage: liveState.progress,
            active_tasks: runningTasks.length,
            completed_tasks: liveState.completedTasks.size
          });
        }
      } else {
        // No live state - definitely stuck
        stuckJobs.push({
          id: job.id,
          status: job.status || 'unknown',
          created_at: job.created_at,
          updated_at: job.updated_at,
          progress_percentage: job.progress_percentage || 0,
          stuck_duration_minutes: stuckDurationMinutes,
          running_tasks: [],
          failed_tasks: []
        });
      }
    }

    return NextResponse.json({
      success: true,
      timestamp: new Date().toISOString(),
      summary: {
        total_jobs_checked: potentiallyStuckJobs?.length || 0,
        stuck_jobs: stuckJobs.length,
        healthy_jobs: healthyJobs.length
      },
      stuck_jobs: stuckJobs,
      healthy_jobs: healthyJobs,
      recommendations: stuckJobs.length > 0 ? [
        'Consider using the /recovery endpoint to restart stuck jobs',
        'Check OpenAI API key and rate limits',
        'Monitor server logs for timeout errors',
        'Verify database connectivity'
      ] : ['All jobs appear to be running normally']
    });

  } catch (error) {
    console.error('Health check error:', error);
    return NextResponse.json(
      { error: 'Failed to perform health check' }, 
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const supabase = createSupabaseServerClient();
    
    // Check authentication
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    const { action, jobId } = body;

    if (action === 'recover' && jobId) {
      // Attempt to recover a specific stuck job
      console.log(`🔧 Attempting to recover stuck job: ${jobId}`);
      
      // First, check if the job exists and belongs to the user
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

      // Mark job as failed so it can be restarted
      const { error: updateError } = await supabase
        .from('course_generation_jobs')
        .update({
          status: 'failed',
          error_message: 'Job recovered from stuck state',
          updated_at: new Date().toISOString()
        })
        .eq('id', jobId);

      if (updateError) {
        return NextResponse.json(
          { error: 'Failed to update job status' }, 
          { status: 500 }
        );
      }

      return NextResponse.json({
        success: true,
        message: `Job ${jobId} has been marked as failed and can now be restarted`,
        jobId
      });
    }

    return NextResponse.json({ error: 'Invalid action' }, { status: 400 });

  } catch (error) {
    console.error('Recovery action error:', error);
    return NextResponse.json(
      { error: 'Failed to perform recovery action' }, 
      { status: 500 }
    );
  }
} 