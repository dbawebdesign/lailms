import { NextRequest, NextResponse } from 'next/server';
import { createSupabaseServerClient } from '@/lib/supabase/server';
import { courseGenerator, CourseGenerationRequest } from '@/lib/services/course-generator';
import { knowledgeBaseAnalyzer } from '@/lib/services/knowledge-base-analyzer';
import { Tables } from '../../../../../packages/types/db';

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
      generationMode = 'general', // 'kb_only', 'kb_priority', 'kb_supplemented', 'general'
      estimatedDurationWeeks,
      academicLevel,
      lessonDetailLevel,
      targetAudience,
      prerequisites,
      lessonsPerWeek,
      learningObjectives,
      assessmentSettings,
      userGuidance,
      // For general course generation (backward compatibility)
      prompt,
      gradeLevel,
      lengthInWeeks,
      subject
    } = body;

    // Handle backward compatibility with old generate-course-outline format
    let courseTitle = title;
    let courseDescription = description;
    let courseDuration = estimatedDurationWeeks;
    let courseLevel = academicLevel;
    let courseMode = generationMode;

    if (prompt && !title) {
      // This is likely a legacy request from Luna or old base class creation
      courseTitle = extractTitleFromPrompt(prompt) || 'Generated Course';
      courseDescription = prompt;
      courseDuration = lengthInWeeks || estimatedDurationWeeks || 12;
      courseLevel = gradeLevel || academicLevel;
      courseMode = 'general'; // Default to general mode for legacy requests
    }

    // Validate required fields
    if (!courseTitle) {
      return NextResponse.json(
        { error: 'Course title is required' }, 
        { status: 400 }
      );
    }

    // If baseClassId is provided, verify access and get KB context
    let baseClass = null;
    let kbAnalysis = null;
    
    if (baseClassId) {
      const { data: baseClassData, error: baseClassError } = await supabase
        .from('base_classes')
        .select('*')
        .eq('id', baseClassId)
        .eq('user_id', user.id)
        .single<Tables<'base_classes'>>();

      if (baseClassError || !baseClassData) {
        return NextResponse.json(
          { error: 'Base class not found or access denied' }, 
          { status: 404 }
        );
      }

      baseClass = baseClassData;

      // Get knowledge base analysis if using KB modes
      if (courseMode !== 'general') {
        kbAnalysis = await knowledgeBaseAnalyzer.analyzeKnowledgeBase(baseClassId);
        
        // Validate KB mode is suitable
        if (courseMode === 'kb_only' && (!kbAnalysis || kbAnalysis.totalDocuments === 0)) {
          return NextResponse.json(
            { error: 'Knowledge base only mode requires uploaded documents' }, 
            { status: 400 }
          );
        }
      }
    }

    // For general mode or when no baseClassId, generate a simple course outline
    if (courseMode === 'general' || !baseClassId) {
      const generatedOutline = await generateSimpleCourseOutline({
        title: courseTitle,
        description: courseDescription,
        duration: courseDuration,
        level: courseLevel,
        subject: subject
      });

      return NextResponse.json({
        success: true,
        ...generatedOutline,
        generationMode: 'general'
      });
    }

    // For KB-based modes, use the advanced course generator
    if (!baseClass) {
      return NextResponse.json(
        { error: 'Base class is required for knowledge base generation modes' }, 
        { status: 400 }
      );
    }

    const generationRequest: CourseGenerationRequest = {
      baseClassId,
      organisationId: baseClass.organisation_id,
      userId: user.id,
      title: courseTitle,
      description: courseDescription,
      generationMode: courseMode as any,
      estimatedDurationWeeks: courseDuration,
      academicLevel: courseLevel,
      lessonDetailLevel,
      targetAudience,
      prerequisites,
      lessonsPerWeek,
      learningObjectives,
      assessmentSettings,
      userGuidance
    };

    // Start course generation job
    const job = await courseGenerator.generateCourse(generationRequest);

    return NextResponse.json({ 
      success: true, 
      jobId: job.id,
      status: job.status,
      generationMode: courseMode,
      message: 'Advanced course generation started. Check job status for progress.',
      // For immediate response, also return a basic outline
      basicOutline: await generateSimpleCourseOutline({
        title: courseTitle,
        description: courseDescription,
        duration: courseDuration,
        level: courseLevel,
        subject: subject
      })
    });

  } catch (error) {
    console.error('Unified course generation error:', error);
    return NextResponse.json(
      { error: 'Failed to generate course' }, 
      { status: 500 }
    );
  }
}

// Helper function to extract title from prompt (for backward compatibility)
function extractTitleFromPrompt(prompt: string): string | null {
  // Look for patterns like "titled 'X'" or "course title: X" etc.
  const patterns = [
    /titled\s+['""]([^'""]+)['"]/i,
    /course\s+titled\s+['""]([^'""]+)['"]/i,
    /title:\s*['""]([^'""]+)['"]/i,
    /course\s+title:\s*['""]([^'""]+)['"]/i,
    /for\s+a\s+[^"]*course\s+titled\s+['""]([^'""]+)['"]/i
  ];

  for (const pattern of patterns) {
    const match = prompt.match(pattern);
    if (match && match[1]) {
      return match[1].trim();
    }
  }

  return null;
}

// Helper function to generate simple course outline (for general mode and immediate responses)
async function generateSimpleCourseOutline(params: {
  title: string;
  description?: string;
  duration?: number;
  level?: string;
  subject?: string;
}) {
  const { title, description, duration = 12, level, subject } = params;
  
  // Create a basic course structure
  const weeksPerPath = Math.ceil(duration / 4); // Divide into 4 main paths
  
  return {
    title,
    description: description || `A comprehensive course covering ${title}`,
    gradeLevel: level || 'Not specified',
    subject: subject || 'General',
    lengthInWeeks: duration,
    paths: [
      {
        title: "Introduction and Foundations",
        description: "Course overview and fundamental concepts",
        lessons: Array.from({ length: Math.max(1, Math.ceil(weeksPerPath * 0.8)) }, (_, i) => ({
          title: `Lesson ${i + 1}: Foundation Topic ${i + 1}`,
          description: `Introduction to key concept ${i + 1}`
        }))
      },
      {
        title: "Core Concepts and Skills",
        description: "Essential knowledge and practical skills",
        lessons: Array.from({ length: Math.max(1, weeksPerPath) }, (_, i) => ({
          title: `Lesson ${i + 1}: Core Skill ${i + 1}`,
          description: `Development of essential skill ${i + 1}`
        }))
      },
      {
        title: "Advanced Applications",
        description: "Complex scenarios and real-world applications",
        lessons: Array.from({ length: Math.max(1, weeksPerPath) }, (_, i) => ({
          title: `Lesson ${i + 1}: Advanced Topic ${i + 1}`,
          description: `Advanced application ${i + 1}`
        }))
      },
      {
        title: "Assessment and Integration",
        description: "Evaluation, projects, and course integration",
        lessons: Array.from({ length: Math.max(1, Math.ceil(weeksPerPath * 0.6)) }, (_, i) => ({
          title: `Assessment ${i + 1}`,
          description: `Evaluation and integration activity ${i + 1}`
        }))
      }
    ]
  };
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
      return NextResponse.json({
        success: true,
        availableModes: {
          general: {
            title: 'General Course Generation',
            description: 'Generate courses using AI general knowledge',
            suitable: true
          }
        },
        recommendedMode: 'general'
      });
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

    // Get knowledge base analysis
    const kbAnalysis = await knowledgeBaseAnalyzer.analyzeKnowledgeBase(baseClassId);

    return NextResponse.json({
      success: true,
      baseClass,
      knowledgeBaseAnalysis: kbAnalysis,
      availableModes: {
        general: {
          title: 'General Course Generation',
          description: 'Generate courses using AI general knowledge',
          suitable: true
        },
        kb_supplemented: {
          title: 'Knowledge Base Supplemented',
          description: 'Use knowledge base as foundation, supplement with general knowledge',
          suitable: kbAnalysis.totalDocuments > 0
        },
        kb_priority: {
          title: 'Knowledge Base Priority', 
          description: 'Prioritize knowledge base content, fill gaps with general knowledge',
          suitable: kbAnalysis.totalDocuments > 0 && kbAnalysis.contentDepth !== 'minimal'
        },
        kb_only: {
          title: 'Knowledge Base Only',
          description: 'Generate content exclusively from uploaded sources',
          suitable: kbAnalysis.contentDepth === 'comprehensive' && 
                   kbAnalysis.totalDocuments >= 3
        }
      },
      recommendedMode: kbAnalysis.totalDocuments > 0 ? kbAnalysis.recommendedGenerationMode : 'general'
    });

  } catch (error) {
    console.error('Course generation options error:', error);
    return NextResponse.json(
      { error: 'Failed to get course generation options' }, 
      { status: 500 }
    );
  }
} 