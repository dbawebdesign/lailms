import { NextRequest, NextResponse } from 'next/server';
import { createSupabaseServerClient, createSupabaseServiceClient } from '@/lib/supabase/server';
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
    if (baseClass.user_id !== user.id) {
      const { data: orgMember } = await supabase
        .from('profiles')
        .select('id, role')
        .eq('organisation_id', baseClass.organisation_id)
        .eq('id', user.id)
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
        job_data: generationRequest as any,
        generation_config: {
          version: 'v3',
          orchestrator: 'CourseGenerationOrchestratorV3',
          features: [
            'enhanced_tracking',
            'task_level_monitoring', 
            'performance_analytics',
            'error_recovery',
            'user_action_logging',
            'structured_outputs',
            'rate_limiting',
            'content_caching',
            'database_logging',
            'quality_validation',
            'model_optimization'
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

    // Enqueue the job for the background worker and return immediately
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
      version: 'v3',
      message: 'Course generation queued for background processing',
      processingMethod: 'render-worker'
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
    const baseClassId = searchParams.get('baseClassId');
    
    // If baseClassId is provided, return knowledge base analysis
    if (baseClassId) {
      // Verify user has access to this base class
      const { data: baseClass, error: baseClassError } = await supabase
        .from('base_classes')
        .select('*')
        .eq('id', baseClassId)
        .eq('user_id', user.id)
        .single();

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
        .order('created_at', { ascending: false });

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
        recommendedMode: kbAnalysis.recommendedGenerationMode,
        existingCourseOutlines: courseOutlines || []
      });
    }

    // Otherwise, return jobs list
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
    console.log(`🔧 Starting V2 generation job processing for ${jobId}`);
    
    // Update job status to processing
    await updateJobStatus(jobId, 'processing', 5, supabase);
    console.log(`✅ Updated job ${jobId} status to processing (5%)`);
    

    // Step 1: Knowledge base analysis (15% progress)
    console.log(`📊 Starting KB analysis for ${jobId}`);
    const kbAnalysis = await knowledgeBaseAnalyzer.analyzeKnowledgeBase(request.baseClassId);
    await updateJobStatus(jobId, 'processing', 15, supabase);
    console.log(`✅ KB analysis complete for ${jobId} (15%)`);

    // Step 2: Determine generation mode (25% progress)
    const generationMode = request.generationMode || kbAnalysis.recommendedGenerationMode;
    await updateJobStatus(jobId, 'processing', 25, supabase);
    console.log(`✅ Generation mode determined: ${generationMode} for ${jobId} (25%)`);

    // Step 3: Generate course outline (45% progress)
    console.log(`📝 Generating course outline for ${jobId}`);
    const { CourseGenerator } = await import('@/lib/services/course-generator');
    const tempGenerator = new CourseGenerator();
    const outline = await (tempGenerator as any).generateCourseOutline(request, kbAnalysis, generationMode);
    await updateJobStatus(jobId, 'processing', 45, supabase);
    console.log(`✅ Course outline generated for ${jobId} (45%)`);

    // Step 4: Save course outline (55% progress)
    console.log(`💾 Saving course outline for ${jobId}`);
    const courseOutlineId = await (tempGenerator as any).saveCourseOutline(outline, request);
    await updateJobStatus(jobId, 'processing', 55, supabase);
    console.log(`✅ Course outline saved: ${courseOutlineId} for ${jobId} (55%)`);

    // Step 5: Create basic LMS entities (70% progress)
    console.log(`🏗️ Creating basic LMS entities for ${jobId}`);
    await (tempGenerator as any).createBasicLMSEntities(courseOutlineId, outline, request);
    await updateJobStatus(jobId, 'processing', 70, supabase);
    console.log(`✅ Basic LMS entities created for ${jobId} (70%)`);

    // Step 6: Start v2 orchestrated content generation (85% progress)
    console.log(`🚀 Preparing to invoke V3 Edge Function for ${jobId}`);
    await updateJobStatus(jobId, 'processing', 85, supabase, null, { 
      message: 'Starting enhanced v2 orchestrated content generation...',
      courseOutlineId,
      orchestrator: 'v2'
    });

    // Call Supabase Edge Function for V3 orchestration (no timeout issues!)
    console.log(`🚀 Invoking generate-course-v3 edge function for job ${jobId}`);
    
    const { data: functionData, error: functionError } = await supabase.functions.invoke('generate-course-v3', {
      body: { 
        jobId, 
        outline, 
        request 
      }
    });

    if (functionError) {
      console.error('Edge function invocation failed:', functionError);
      throw new Error(`Failed to start edge function: ${functionError.message}`);
    }

    console.log(`✅ Edge function invoked successfully for job ${jobId}`, functionData);
    
    // The edge function will handle the orchestration and status updates

  } catch (error) {
    console.error(`❌ V2 generation process failed for job ${jobId}:`, error);
    console.error(`❌ Error details:`, {
      message: error instanceof Error ? error.message : String(error),
      stack: error instanceof Error ? error.stack : undefined,
      jobId
    });
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