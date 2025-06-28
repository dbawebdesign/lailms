import { NextRequest, NextResponse } from 'next/server';
import { createSupabaseServerClient } from '@/lib/supabase/server';
import { courseGenerator, CourseGenerationRequest } from '@/lib/services/course-generator';
import { knowledgeBaseAnalyzer } from '@/lib/services/knowledge-base-analyzer';
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
      generationMode: generationMode || undefined, // Let system determine if not specified
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

    // Start course generation
    const job = await courseGenerator.generateCourse(generationRequest);

    return NextResponse.json({ 
      success: true, 
      jobId: job.id,
      status: job.status,
      message: 'Course generation started. Check job status for progress.' 
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
                   kbAnalysis.totalDocuments >= 3 &&
                   kbAnalysis.analysisDetails.contentQuality === 'high'
        },
        kb_priority: {
          title: 'Knowledge Base Priority', 
          description: 'Prioritize knowledge base content, fill minor gaps with general knowledge',
          suitable: kbAnalysis.contentDepth !== 'minimal' && 
                   kbAnalysis.totalDocuments >= 1
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