// @ts-nocheck
import { NextRequest, NextResponse } from 'next/server';
import { createSupabaseServerClient } from '@/lib/supabase/server';
import { QuestionGenerationService } from '@/lib/services/question-generation-service';
import { QuestionValidationService } from '@/lib/services/question-validation-service';
import { Tables } from 'packages/types/db';

// GET /api/teach/assessments/lesson/[lessonId] - Get lesson assessments
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ lessonId: string }> }
) {
  try {
    const supabase = createSupabaseServerClient();
    const { lessonId } = await params;
    const { searchParams } = new URL(request.url);
    
    // Get query parameters
    const assessmentTypeParam = searchParams.get('type'); // practice, lesson_quiz, etc.
    const includeQuestions = searchParams.get('includeQuestions') === 'true';
    const page = parseInt(searchParams.get('page') || '1');
    const limit = parseInt(searchParams.get('limit') || '10');
    const offset = (page - 1) * limit;
    
    // Validate assessment type
    const validAssessmentTypes = ['practice', 'lesson_quiz', 'path_exam', 'final_exam', 'diagnostic', 'benchmark'] as const;
    type ValidAssessmentType = typeof validAssessmentTypes[number];
    const assessmentType: ValidAssessmentType | null = assessmentTypeParam && validAssessmentTypes.includes(assessmentTypeParam as ValidAssessmentType) 
      ? assessmentTypeParam as ValidAssessmentType
      : null;

    // Verify user authentication
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Verify lesson exists and user has access
    const { data: lesson, error: lessonError } = await supabase
      .from('lessons')
      .select(`
        id,
        title,
        description,
        path_id,
        paths!inner(
          id,
          title,
          base_class_id,
          base_classes!inner(
            id,
            name,
            created_by
          )
        )
      `)
      .eq('id', lessonId)
      .single();

    if (lessonError || !lesson) {
      return NextResponse.json({ error: 'Lesson not found' }, { status: 404 });
    }

    // Type the lesson with the joined relationships
    const typedLesson = lesson as any;

    // Check if user has access to this lesson
    const baseClass = typedLesson.paths.base_classes;
    if (baseClass.created_by !== user.id) {
      // Check if user is enrolled in any class instance for this base class
      const { data: classInstances, error: instanceError } = await supabase
        .from('class_instances')
        .select('id')
        .eq('base_class_id', baseClass.id)
        .returns<Tables<'class_instances'>[]>();

      if (instanceError || !classInstances || classInstances.length === 0) {
        return NextResponse.json({ error: 'Access denied' }, { status: 403 });
      }

      const classInstanceIds = classInstances.map(ci => ci.id);
      
      const { data: enrollment } = await supabase
        .from('rosters')
        .select('id, role')
        .in('class_instance_id', classInstanceIds)
        .eq('profile_id', user.id)
        .single();

      if (!enrollment) {
        return NextResponse.json({ error: 'Access denied' }, { status: 403 });
      }
    }

    // Build query for lesson assessments
    let query = supabase
      .from('assessments')
      .select(`
        id,
        title,
        description,
        assessment_type,
        settings,
        created_at,
        updated_at,
        ${includeQuestions ? `
        assessment_questions!inner(
          id,
          display_order,
          questions!inner(
            id,
            question_text,
            question_type,
            points,
            metadata,
            question_options(
              id,
              option_text,
              is_correct,
              order_index
            )
          )
        )
        ` : ''}
      `)
      .eq('lesson_id', lessonId)
      .range(offset, offset + limit - 1)
      .order('created_at', { ascending: false });

    // Filter by assessment type if specified
    if (assessmentType) {
      query = query.eq('assessment_type', assessmentType);
    }

    const { data: assessments, error: assessmentsError } = await query;

    if (assessmentsError) {
      console.error('Error fetching lesson assessments:', assessmentsError);
      return NextResponse.json(
        { error: 'Failed to fetch assessments' },
        { status: 500 }
      );
    }

    // Get total count for pagination
    let countQuery = supabase
      .from('assessments')
      .select('id', { count: 'exact', head: true })
      .eq('lesson_id', lessonId);

    if (assessmentType) {
      countQuery = countQuery.eq('assessment_type', assessmentType);
    }

    const { count, error: countError } = await countQuery;

    if (countError) {
      console.error('Error counting assessments:', countError);
    }

    // Format response
    const response = {
      assessments: assessments || [],
      lesson: {
        id: lesson.id,
        title: lesson.title,
        description: lesson.description,
        path: {
          id: (lesson.paths as any).id,
          title: (lesson.paths as any).title,
          baseClass: {
            id: baseClass.id,
            name: baseClass.name
          }
        }
      },
      pagination: {
        page,
        limit,
        total: count || 0,
        totalPages: Math.ceil((count || 0) / limit)
      }
    };

    return NextResponse.json(response);

  } catch (error) {
    console.error('Error in lesson assessments GET:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

// POST /api/teach/assessments/lesson/[lessonId] - Create new lesson assessment
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ lessonId: string }> }
) {
  try {
    const supabase = createSupabaseServerClient();
    const { lessonId } = await params;
    const body = await request.json();

    // Verify user authentication
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Verify lesson exists and user has permission to create assessments
    const { data: lesson, error: lessonError } = await supabase
      .from('lessons')
      .select(`
        id,
        title,
        base_class_id,
        paths!inner(
          base_class_id,
          base_classes!inner(
            id,
            created_by
          )
        )
      `)
      .eq('id', lessonId)
      .single<Tables<'lessons'>>();

    if (lessonError || !lesson) {
      return NextResponse.json({ error: 'Lesson not found' }, { status: 404 });
    }

    const baseClass = (lesson.paths as any).base_classes;
    if (baseClass.created_by !== user.id) {
      return NextResponse.json({ error: 'Access denied' }, { status: 403 });
    }

    // Validate request body
    const {
      title,
      description,
      assessmentType: rawAssessmentType = 'practice',
      difficultyLevel = 'medium',
      timeLimit,
      maxAttempts,
      passingScore,
      instructions,
      settings = {},
      generateQuestions = false,
      questionGenerationOptions
    } = body;
    
    // Validate assessment type
    const validAssessmentTypes = ['practice', 'lesson_quiz', 'path_exam', 'final_exam', 'diagnostic', 'benchmark'] as const;
    type ValidAssessmentType = typeof validAssessmentTypes[number];
    const assessmentType: ValidAssessmentType = validAssessmentTypes.includes(rawAssessmentType as ValidAssessmentType) 
      ? rawAssessmentType as ValidAssessmentType
      : 'practice';

    if (!title) {
      return NextResponse.json(
        { error: 'Title is required' },
        { status: 400 }
      );
    }

    // Create the assessment
    const { data: assessment, error: createError } = await supabase
      .from('assessments')
      .insert({
        lesson_id: lessonId,
        base_class_id: lesson.base_class_id,
        title,
        description,
        assessment_type: assessmentType,
          instructions,
        time_limit_minutes: timeLimit,
        max_attempts: maxAttempts,
        passing_score_percentage: passingScore,
        randomize_questions: settings?.randomizeQuestions || false,
        show_results_immediately: settings?.showResultsImmediately || false,
        allow_review: settings?.allowReview || true,
        ai_grading_enabled: settings?.aiGradingEnabled || false,
        ai_model: settings?.aiModel || null,
        created_by: user.id
      })
      .select()
      .single<Tables<'assessments'>>();

    if (createError) {
      console.error('Error creating assessment:', createError);
      return NextResponse.json(
        { error: 'Failed to create assessment' },
        { status: 500 }
      );
    }

    // Generate questions if requested
    let generatedQuestions = null;
    if (generateQuestions && questionGenerationOptions) {
      try {
        const questionService = new QuestionGenerationService();
        
        // Get lesson content for question generation
        const { data: lessonSections } = await supabase
          .from('lesson_sections')
          .select('title, content, section_type')
          .eq('lesson_id', lessonId)
          .order('order_index')
          .returns<Tables<'lesson_sections'>[]>();

        if (lessonSections && lessonSections.length > 0) {
          const lessonContent = lessonSections
            .map(section => `${section.title}: ${JSON.stringify(section.content)}`)
            .join('\n\n');

          const questionCount = questionGenerationOptions.questionCount || 5;
          const questionTypes = questionGenerationOptions.questionTypes || ['multiple_choice'];
          const baseClassId = baseClass.id;
          const tags = questionGenerationOptions.tags || [];

          const result = await questionService.generateQuestionsFromContent(
            lessonContent,
            questionCount,
            questionTypes,
            baseClassId,
            tags
          );
          generatedQuestions = result;
        }
      } catch (questionError) {
        console.error('Error generating questions:', questionError);
        // Don't fail the assessment creation if question generation fails
      }
    }

    const response = {
      assessment,
      generatedQuestions,
      message: 'Assessment created successfully'
    };

    return NextResponse.json(response, { status: 201 });

  } catch (error) {
    console.error('Error in lesson assessments POST:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
 