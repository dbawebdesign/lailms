import { NextResponse } from 'next/server';
import { createSupabaseServerClient } from '@/lib/supabase/server';
import { resilienceMonitor } from '@/lib/services/course-generation-resilience-monitor';

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

    // Verify user has access to this job
    const { data: job, error: jobError } = await supabase
      .from('course_generation_jobs')
      .select('user_id')
      .eq('id', jobId)
      .single();

    if (jobError || !job) {
      return NextResponse.json(
        { error: 'Job not found' },
        { status: 404 }
      );
    }

    if (job.user_id !== user.id) {
      return NextResponse.json({ error: 'Access denied' }, { status: 403 });
    }

    // Check job health
    const healthStatus = await resilienceMonitor.checkJobHealth(jobId);

    return NextResponse.json({
      success: true,
      health: healthStatus
    });

  } catch (error) {
    console.error('Error checking job health:', error);
    const errorMessage = error instanceof Error ? error.message : 'An unknown error occurred';
    return NextResponse.json({ error: errorMessage }, { status: 500 });
  }
}

export async function POST(
  request: Request,
  { params }: { params: Promise<{ jobId: string }> }
) {
  try {
    const { jobId } = await params;
    const { action } = await request.json();

    if (!jobId) {
      return NextResponse.json(
        { error: 'Missing jobId' },
        { status: 400 }
      );
    }

    if (!action || !['recover', 'check'].includes(action)) {
      return NextResponse.json(
        { error: 'Invalid action. Must be "recover" or "check"' },
        { status: 400 }
      );
    }

    // Check authentication
    const supabase = createSupabaseServerClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Verify user has access to this job
    const { data: job, error: jobError } = await supabase
      .from('course_generation_jobs')
      .select('user_id')
      .eq('id', jobId)
      .single();

    if (jobError || !job) {
      return NextResponse.json(
        { error: 'Job not found' },
        { status: 404 }
      );
    }

    if (job.user_id !== user.id) {
      return NextResponse.json({ error: 'Access denied' }, { status: 403 });
    }

    if (action === 'recover') {
      // Attempt recovery
      const recoveryResult = await resilienceMonitor.attemptRecovery(jobId);
      
      return NextResponse.json({
        success: recoveryResult.success,
        recovery: recoveryResult
      });
    } else {
      // Just check health
      const healthStatus = await resilienceMonitor.checkJobHealth(jobId);
      
      return NextResponse.json({
        success: true,
        health: healthStatus
      });
    }

  } catch (error) {
    console.error('Error in job health endpoint:', error);
    const errorMessage = error instanceof Error ? error.message : 'An unknown error occurred';
    return NextResponse.json({ error: errorMessage }, { status: 500 });
  }
}