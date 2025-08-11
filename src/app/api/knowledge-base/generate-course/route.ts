import { NextRequest, NextResponse } from 'next/server';
import { createSupabaseServerClient, createSupabaseServiceClient } from '@/lib/supabase/server';
import { CourseGenerationOrchestratorV2 } from '@/lib/services/course-generation-orchestrator-v2';
import { knowledgeBaseAnalyzer } from '@/lib/services/knowledge-base-analyzer';
import type { CourseGenerationRequest } from '@/lib/services/course-generator';
import { Tables } from 'packages/types/db';

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
        { error: 'Base class ID and title are required' }, 
        { status: 400 }
      );
    }

    // Verify user has access to this base class
    const { data: baseClass, error: baseClassError } = await supabase
      .from('base_classes')
      .select('organisation_id')
      .eq('id', baseClassId)
      .eq('user_id', user.id)
      .single<Tables<'base_classes'>>();

    if (baseClassError || !baseClass) {
      return NextResponse.json(
        { error: 'Base class not found or access denied' }, 
        { status: 404 }
      );
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

    // Create generation job in database using v2 system
    const { data: jobData, error: jobError } = await supabase
      .from('course_generation_jobs')
      .insert({
        base_class_id: baseClassId,
        organisation_id: baseClass.organisation_id,
        user_id: user.id,
        job_type: 'generate_course_v2_kb',
        status: 'queued',
        progress_percentage: 0,
        job_data: generationRequest as any,
        generation_config: {
          version: 'v2',
          orchestrator: 'CourseGenerationOrchestratorV2',
          source: 'knowledge_base_api',
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

    // Enqueue the job and return immediately
    const serviceClient = createSupabaseServiceClient();
    const { error: enqueueError } = await (serviceClient as any)
      .from('course_generation_queue')
      .insert({ job_id: jobId, status: 'queued', priority: 5 });

    if (enqueueError) {
      console.error('Failed to enqueue generation job:', enqueueError);
      return NextResponse.json(
        { error: 'Failed to enqueue generation job' },
        { status: 500 }
      );
    }

    return NextResponse.json({ 
      success: true, 
      jobId,
      status: 'queued',
      version: 'v2',
      message: 'Course generation queued for background processing.',
      features: [
        'Real-time task tracking',
        'Performance analytics', 
        'Error recovery',
        'Enhanced monitoring'
      ],
      source: 'knowledge_base_api'
    });

  } catch (error) {
    console.error('Course generation error:', error);
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
    const baseClassId = searchParams.get('baseClassId');

    if (!baseClassId) {
      return NextResponse.json(
        { error: 'Base class ID is required' }, 
        { status: 400 }
      );
    }

    // Verify user has access to this base class
    const { data: baseClass, error: baseClassError } = await supabase
      .from('base_classes')
      .select('*')
      .eq('id', baseClassId)
      .eq('user_id', user.id)
      .single<Tables<'base_classes'>>();

    if (baseClassError || !baseClass) {
      return NextResponse.json(
        { error: 'Base class not found or access denied' }, 
        { status: 404 }
      );
    }

    // Get knowledge base analysis for this base class
    const kbAnalysis = await knowledgeBaseAnalyzer.analyzeKnowledgeBase(baseClassId);

    // Get existing course outlines for this base class
    const { data: courseOutlines, error: outlinesError } = await supabase
      .from('course_outlines')
      .select('*')
      .eq('base_class_id', baseClassId)
      .eq('user_id', user.id)
      .order('created_at', { ascending: false })
      .returns<Tables<'course_outlines'>[]>();

    if (outlinesError) {
      return NextResponse.json(
        { error: 'Failed to fetch course outlines' }, 
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      baseClass,
      knowledgeBaseAnalysis: kbAnalysis,
      courseOutlines: courseOutlines || [],
      generationModes: {
        kb_only: {
          title: 'Knowledge Base Only',
          description: 'Generate content exclusively from uploaded sources',
          suitable: kbAnalysis.contentDepth === 'comprehensive' && 
                   kbAnalysis.totalChunks >= 40 &&
                   kbAnalysis.analysisDetails.contentQuality === 'high'
        },
        kb_priority: {
          title: 'Knowledge Base Priority', 
          description: 'Prioritize knowledge base content, fill minor gaps with general knowledge',
          suitable: kbAnalysis.contentDepth !== 'minimal' && 
                   kbAnalysis.totalChunks >= 40
        },
        kb_supplemented: {
          title: 'Knowledge Base Supplemented',
          description: 'Use knowledge base as foundation, freely supplement with general knowledge', 
          suitable: true // Always available
        }
      },
      recommendedMode: kbAnalysis.recommendedGenerationMode
    });

  } catch (error) {
    console.error('Knowledge base analysis error:', error);
    return NextResponse.json(
      { error: 'Failed to analyze knowledge base' }, 
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
      orchestrator: 'v2',
      source: 'knowledge_base_api'
    });

    // Use v2 orchestrator for enhanced generation (it will use service role client internally)
    const orchestrator = new CourseGenerationOrchestratorV2();
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

// Complete V2 generation process from start to finish
async function processCompleteV2GenerationJob(
  jobId: string, 
  request: CourseGenerationRequest, 
  supabase: any
): Promise<void> {
  try {
    console.log(`🚀 Starting complete V2 generation for job ${jobId}`);

    // Use the complete v2 orchestrator (no outline needed - it will generate everything)
    // It will use service role client internally for background operations
    const orchestrator = new CourseGenerationOrchestratorV2();
    await orchestrator.startCompleteOrchestration(jobId, request);
    
    // Success log is now handled inside the orchestrator

  } catch (error) {
    console.error('Complete V2 generation process failed:', error);
    await updateJobStatus(jobId, 'failed', 0, supabase, error instanceof Error ? error.message : 'Unknown error');
    throw error;
  }
} 