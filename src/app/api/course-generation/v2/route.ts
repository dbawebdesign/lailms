import { NextRequest, NextResponse } from 'next/server';
import { createSupabaseServerClient } from '@/lib/supabase/server';
import { CourseGenerationOrchestratorV2 } from '@/lib/services/course-generation-orchestrator-v2';
import { knowledgeBaseAnalyzer } from '@/lib/services/knowledge-base-analyzer';
import type { CourseGenerationRequest } from '@/lib/services/course-generator';

export async function POST(request: NextRequest) {
  try {
    const supabase = createSupabaseServerClient();
    
    // Check authentication
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    const {
      baseClassId,
      title,
      description,
      generationMode,
      estimatedDurationWeeks,
      academicLevel,
      lessonDetailLevel,
      targetAudience,
      prerequisites,
      lessonsPerWeek,
      learningObjectives,
      assessmentSettings,
      userGuidance
    } = body;

    // Validate required fields
    if (!baseClassId || !title) {
      return NextResponse.json(
        { error: 'baseClassId and title are required' }, 
        { status: 400 }
      );
    }

    // Verify base class exists and user has access
    const { data: baseClass, error: baseClassError } = await supabase
      .from('base_classes')
      .select('*')
      .eq('id', baseClassId)
      .single();

    if (baseClassError || !baseClass) {
      return NextResponse.json(
        { error: 'Base class not found' }, 
        { status: 404 }
      );
    }

    // Check if user has access to this base class
    if (baseClass.created_by !== user.id) {
      const { data: orgMember } = await supabase
        .from('organisation_members')
        .select('*')
        .eq('organisation_id', baseClass.organisation_id)
        .eq('user_id', user.id)
        .single();

      if (!orgMember) {
        return NextResponse.json(
          { error: 'Access denied to this base class' }, 
          { status: 403 }
        );
      }
    }

    // Create course generation request
    const generationRequest: CourseGenerationRequest = {
      baseClassId,
      organisationId: baseClass.organisation_id,
      userId: user.id,
      title,
      description,
      generationMode: generationMode || undefined,
      estimatedDurationWeeks,
      academicLevel,
      lessonDetailLevel,
      targetAudience,
      prerequisites,
      lessonsPerWeek,
      learningObjectives,
      assessmentSettings,
      userGuidance
    };

    // Create generation job in database
    const { data: jobData, error: jobError } = await supabase
      .from('course_generation_jobs')
      .insert({
        base_class_id: baseClassId,
        organisation_id: baseClass.organisation_id,
        user_id: user.id,
        job_type: 'generate_course_v2',
        status: 'queued',
        progress_percentage: 0,
        job_data: generationRequest,
        generation_config: {
          version: 'v2',
          orchestrator: 'CourseGenerationOrchestratorV2',
          features: [
            'enhanced_tracking',
            'task_level_monitoring', 
            'performance_analytics',
            'error_recovery',
            'user_action_logging'
          ]
        }
      })
      .select('id')
      .single();

    if (jobError) {
      console.error('Failed to create generation job:', jobError);
      return NextResponse.json(
        { error: 'Failed to create generation job' }, 
        { status: 500 }
      );
    }

    const jobId = jobData.id;

    // Start async processing with v2 orchestrator
    processV2GenerationJob(jobId, generationRequest, supabase).catch(error => {
      console.error('V2 Course generation failed:', error);
      updateJobStatus(jobId, 'failed', 0, supabase, error.message);
    });

    return NextResponse.json({ 
      success: true, 
      jobId,
      status: 'queued',
      version: 'v2',
      message: 'Enhanced course generation started with v2 system. Check job status for progress.',
      features: [
        'Real-time task tracking',
        'Performance analytics', 
        'Error recovery',
        'Enhanced monitoring'
      ]
    });

  } catch (error) {
    console.error('V2 Course generation API error:', error);
    return NextResponse.json(
      { error: 'Failed to start course generation' }, 
      { status: 500 }
    );
  }
}

export async function GET(request: NextRequest) {
  try {
    const supabase = createSupabaseServerClient();
    
    // Check authentication
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const status = searchParams.get('status');
    const limit = parseInt(searchParams.get('limit') || '10');

    // Build query
    let query = supabase
      .from('course_generation_jobs')
      .select(`
        *,
        base_classes!inner(
          id,
          name,
          description
        )
      `)
      .eq('user_id', user.id)
      .order('created_at', { ascending: false })
      .limit(limit);

    if (status) {
      query = query.eq('status', status);
    }

    const { data: jobs, error: jobsError } = await query;

    if (jobsError) {
      return NextResponse.json(
        { error: 'Failed to fetch jobs' }, 
        { status: 500 }
      );
    }

    return NextResponse.json({ 
      success: true, 
      jobs: jobs || [],
      total: jobs?.length || 0 
    });

  } catch (error) {
    console.error('Failed to fetch generation jobs:', error);
    return NextResponse.json(
      { error: 'Failed to fetch generation jobs' }, 
      { status: 500 }
    );
  }
}

// Helper function to process generation job asynchronously
async function processV2GenerationJob(
  jobId: string, 
  request: CourseGenerationRequest,
  supabase: any
): Promise<void> {
  try {
    // Update job status to processing
    await updateJobStatus(jobId, 'processing', 5, supabase);

    // Step 1: Knowledge base analysis (15% progress)
    const kbAnalysis = await knowledgeBaseAnalyzer.analyzeKnowledgeBase(request.baseClassId);
    await updateJobStatus(jobId, 'processing', 15, supabase);

    // Step 2: Determine generation mode (25% progress)
    const generationMode = request.generationMode || kbAnalysis.recommendedGenerationMode;
    await updateJobStatus(jobId, 'processing', 25, supabase);

    // Step 3: Generate course outline (45% progress)
    // Note: We'll need to import the generateCourseOutline method or create a v2 version
    const { CourseGenerator } = await import('@/lib/services/course-generator');
    const tempGenerator = new CourseGenerator();
    const outline = await (tempGenerator as any).generateCourseOutline(request, kbAnalysis, generationMode);
    await updateJobStatus(jobId, 'processing', 45, supabase);

    // Step 4: Save course outline (55% progress)
    const courseOutlineId = await (tempGenerator as any).saveCourseOutline(outline, request);
    await updateJobStatus(jobId, 'processing', 55, supabase);

    // Step 5: Create basic LMS entities (70% progress)
    await (tempGenerator as any).createBasicLMSEntities(courseOutlineId, outline, request);
    await updateJobStatus(jobId, 'processing', 70, supabase);

    // Step 6: Start v2 orchestrated content generation (85% progress)
    await updateJobStatus(jobId, 'processing', 85, supabase, null, { 
      message: 'Starting enhanced v2 orchestrated content generation...',
      courseOutlineId,
      orchestrator: 'v2'
    });

    // Use v2 orchestrator for enhanced generation
    const orchestrator = new CourseGenerationOrchestratorV2(supabase);
    await orchestrator.startOrchestration(jobId, outline, request);
    
    // The v2 orchestrator will handle completion status updates

  } catch (error) {
    console.error('V2 generation process failed:', error);
    await updateJobStatus(jobId, 'failed', 0, supabase, error instanceof Error ? error.message : 'Unknown error');
    throw error;
  }
}

// Helper function to update job status
async function updateJobStatus(
  jobId: string, 
  status: 'queued' | 'processing' | 'completed' | 'failed', 
  progress: number, 
  supabase: any,
  error?: string | null, 
  result?: any
): Promise<void> {
  try {
    const updateData: any = {
      status,
      progress_percentage: progress,
      updated_at: new Date().toISOString()
    };

    if (error !== undefined) {
      updateData.error_message = error;
    }

    if (result !== undefined) {
      updateData.result_data = result;
    }

    const { error: updateError } = await supabase
      .from('course_generation_jobs')
      .update(updateData)
      .eq('id', jobId);

    if (updateError) {
      console.error('Failed to update job status:', updateError);
      throw new Error(`Failed to update job status: ${updateError.message}`);
    }
  } catch (error) {
    console.error('Error updating job status:', error);
    throw error;
  }
} 