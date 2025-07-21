import { NextRequest, NextResponse } from 'next/server';
import { createSupabaseServerClient } from '@/lib/supabase/server';

/**
 * GET /api/study-spaces/content/status?baseClassId=xxx
 * Get indexing status and progress for a base class
 */
export async function GET(request: NextRequest) {
  try {
    const supabase = createSupabaseServerClient();
    
    // Check authentication
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const baseClassId = searchParams.get('baseClassId');
    
    if (!baseClassId) {
      return NextResponse.json({ 
        error: 'Base class ID is required' 
      }, { status: 400 });
    }

    // Get user's organization and verify access
    const { data: profile } = await supabase
      .from('profiles')
      .select('organisation_id, role, active_role')
      .eq('user_id', user.id!)
      .single();

    if (!profile || !profile.organisation_id) {
      return NextResponse.json({ 
        error: 'User profile not found or missing organization' 
      }, { status: 404 });
    }

    // Verify access to base class
    const { data: baseClass } = await supabase
      .from('base_classes')
      .select('id, organisation_id, name')
      .eq('id', baseClassId)
      .eq('organisation_id', profile.organisation_id)
      .single();

    if (!baseClass) {
      return NextResponse.json({ 
        error: 'Base class not found or access denied' 
      }, { status: 404 });
    }

    // For students, verify enrollment
    const userRole = profile.active_role || profile.role;
    if (userRole === 'student') {
      const { data: enrollment } = await supabase
        .from('rosters')
        .select('id')
        .eq('profile_id', user.id!)
        .eq('role', 'student')
        .limit(1);

      if (!enrollment || enrollment.length === 0) {
        return NextResponse.json({ 
          error: 'Not enrolled in this class' 
        }, { status: 403 });
      }
    }

    // Get current indexing job status
    const { data: currentJob } = await supabase
      .from('content_indexing_jobs')
      .select('*')
      .eq('base_class_id', baseClassId)
      .in('status', ['pending', 'processing'])
      .order('created_at', { ascending: false })
      .limit(1);

    // Get most recent completed job
    const { data: lastCompletedJob } = await supabase
      .from('content_indexing_jobs')
      .select('*')
      .eq('base_class_id', baseClassId)
      .eq('status', 'completed')
      .order('completed_at', { ascending: false })
      .limit(1);

    // Get content statistics
    const { data: contentCount } = await supabase
      .from('study_content_index')
      .select('id', { count: 'exact' })
      .eq('base_class_id', baseClassId);

    // Get reindex queue status
    const { data: queuedItems } = await supabase
      .from('content_reindex_queue')
      .select('id', { count: 'exact' })
      .eq('base_class_id', baseClassId)
      .eq('status', 'pending');

    // Determine overall status
    let overallStatus = 'idle';
    let progressPercentage = 0;
    let estimatedCompletion: string | null = null;

    if (currentJob && currentJob.length > 0) {
      const job = currentJob[0];
      overallStatus = job.status;
      
      if (job.total_items && job.processed_items) {
        progressPercentage = Math.round((job.processed_items / job.total_items) * 100);
        
        // Estimate completion time if processing
        if (job.status === 'processing' && job.started_at) {
          const startTime = new Date(job.started_at).getTime();
          const currentTime = Date.now();
          const elapsedTime = currentTime - startTime;
          const itemsRemaining = job.total_items - job.processed_items;
          
          if (job.processed_items > 0) {
            const avgTimePerItem = elapsedTime / job.processed_items;
            const estimatedRemainingTime = avgTimePerItem * itemsRemaining;
            estimatedCompletion = new Date(currentTime + estimatedRemainingTime).toISOString();
          }
        }
      }
    } else if ((queuedItems?.[0] as any)?.count > 0) {
      overallStatus = 'queued';
    } else if ((contentCount?.[0] as any)?.count > 0) {
      overallStatus = 'indexed';
      progressPercentage = 100;
    }

    return NextResponse.json({
      baseClassId,
      baseClassName: baseClass.name,
      overallStatus,
      progressPercentage,
      estimatedCompletion,
      currentJob: currentJob?.[0] || null,
      lastCompletedJob: lastCompletedJob?.[0] || null,
      contentCount: (contentCount?.[0] as any)?.count || 0,
      queuedItemsCount: (queuedItems?.[0] as any)?.count || 0,
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    console.error('Content status API error:', error);
    
    return NextResponse.json({
      error: 'Failed to get status',
      details: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 });
  }
} 