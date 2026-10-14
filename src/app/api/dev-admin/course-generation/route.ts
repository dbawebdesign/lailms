import { getGlobalAdminAccess } from '@/lib/auth/require-global-admin';
import { NextRequest, NextResponse } from 'next/server';
import { createSupabaseServiceClient } from '@/lib/supabase/server';
import { CourseGenerationOrchestratorV2 } from '@/lib/services/course-generation-orchestrator-v2';
import { knowledgeBaseAnalyzer } from '@/lib/services/knowledge-base-analyzer';
import type { CourseGenerationRequest } from '@/lib/services/course-generator';

export async function POST(request: NextRequest) {
  const { user, status } = await getGlobalAdminAccess();
  if (status || !user) return NextResponse.json({ error: status === 401 ? 'Authentication required' : 'Administrator access required' }, { status: status || 403 });

  try {
    const supabase = createSupabaseServiceClient();
    const body = await request.json();
    
    const { 
      baseClassId,
      title,
      description,
      generationMode = 'general',
      estimatedDurationWeeks,
      academicLevel,
      lessonDetailLevel,
      targetAudience,
      prerequisites,
      lessonsPerWeek,
      learningObjectives,
      assessmentSettings,
      userGuidance,
      isDevAdmin = true
    } = body;

    // Validate required fields
    if (!baseClassId || !title) {
      return NextResponse.json(
        { error: 'Base class ID and title are required' }, 
        { status: 400 }
      );
    }

    // Verify the base class exists
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

    // Create the course generation request
    const generationRequest: CourseGenerationRequest = {
      baseClassId,
      organisationId: baseClass.organisation_id,
      userId: user.id,
      title,
      description,
      generationMode: generationMode as any,
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
        job_type: 'generate_course_v2_teach',
        status: 'queued',
        job_data: generationRequest as any,
        user_id: user.id,
        generation_config: {
          isDevAdmin: true,
          courseCatalog: true
        } as any
      })
      .select()
      .single();

    if (jobError) {
      console.error('Error creating course generation job:', jobError);
      return NextResponse.json(
        { error: 'Failed to create generation job' },
        { status: 500 }
      );
    }

    // Start the orchestration process
    const orchestrator = new CourseGenerationOrchestratorV2();
    
    // Don't await this - let it run in the background
    orchestrator.startOrchestration(jobData.id, {
      title,
      description,
      estimatedDurationWeeks,
      academicLevel,
      lessonDetailLevel,
      targetAudience,
      prerequisites,
      lessonsPerWeek,
      learningObjectives,
      assessmentSettings
    } as any, generationRequest).catch(error => {
      console.error('Error in course generation orchestration:', error);
    });

    return NextResponse.json({
      success: true,
      jobId: jobData.id,
      status: jobData.status,
      message: 'Course catalog generation started successfully'
    });

  } catch (error) {
    console.error('Error in dev-admin course generation:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
