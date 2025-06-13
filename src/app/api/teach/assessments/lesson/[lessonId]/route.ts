import { NextRequest, NextResponse } from 'next/server';
import { createSupabaseServerClient } from '@/lib/supabase/server';
import { QuestionGenerationService } from '@/lib/services/question-generation-service';
import { QuestionValidationService } from '@/lib/services/question-validation-service';

// GET /api/teach/assessments/lesson/[lessonId] - Get lesson assessments
export async function GET(
  request: NextRequest,
  { params }: { params: { lessonId: string } }
) {
  try {
    const supabase = createSupabaseServerClient();
    const { lessonId } = params;
    const { searchParams } = new URL(request.url);
    
    // Get query parameters
    const assessmentType = searchParams.get('type'); // practice, lesson_quiz, etc.
    const includeQuestions = searchParams.get('includeQuestions') === 'true';
    const page = parseInt(searchParams.get('page') || '1');
    const limit = parseInt(searchParams.get('limit') || '10');
    const offset = (page - 1) * limit;

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

    // Check if user has access to this lesson
    const baseClass = (lesson.paths as any).base_classes;
    if (baseClass.created_by !== user.id) {
      // Check if user is enrolled or has other permissions
      const { data: enrollment } = await supabase
        .from('enrollments')
        .select('id, role')
        .eq('base_class_id', baseClass.id)
        .eq('user_id', user.id)
        .single();

      if (!enrollment) {
        return NextResponse.json({ error: 'Access denied' }, { status: 403 });
      }
    }

    // Build query for lesson assessments
    let query = supabase
      .from('lesson_assessments')
      .select(`
        id,
        title,
        description,
        assessment_type,
        difficulty_level,
        time_limit,
        max_attempts,
        passing_score,
        instructions,
        settings,
        is_published,
        created_at,
        updated_at,
        ${includeQuestions ? `
        lesson_questions!inner(
          id,
          question_text,
          question_type,
          difficulty_level,
          bloom_taxonomy_level,
          points,
          correct_answer,
          explanation,
          learning_objectives,
          tags,
          estimated_time,
          ai_generated,
          lesson_question_options(
            id,
            option_text,
            is_correct,
            order_index
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
      .from('lesson_assessments')
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
  { params }: { params: { lessonId: string } }
) {
  try {
    const supabase = createSupabaseServerClient();
    const { lessonId } = params;
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
        paths!inner(
          base_class_id,
          base_classes!inner(
            id,
            created_by
          )
        )
      `)
      .eq('id', lessonId)
      .single();

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
      assessmentType = 'practice',
      difficultyLevel = 'medium',
      timeLimit,
      maxAttempts,
      passingScore,
      instructions,
      settings = {},
      generateQuestions = false,
      questionGenerationOptions
    } = body;

    if (!title) {
      return NextResponse.json(
        { error: 'Title is required' },
        { status: 400 }
      );
    }

    // Create the assessment
    const { data: assessment, error: createError } = await supabase
      .from('lesson_assessments')
      .insert({
        lesson_id: lessonId,
        title,
        description,
        assessment_type: assessmentType,
        difficulty_level: difficultyLevel,
        time_limit: timeLimit,
        max_attempts: maxAttempts,
        passing_score: passingScore,
        instructions,
        settings,
        created_by: user.id,
        is_published: false
      })
      .select()
      .single();

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
        const questionService = new QuestionGenerationService(supabase);
        
        // Get lesson content for question generation
        const { data: lessonSections } = await supabase
          .from('lesson_sections')
          .select('title, content, section_type')
          .eq('lesson_id', lessonId)
          .order('order_index');

        if (lessonSections && lessonSections.length > 0) {
          const lessonContent = lessonSections
            .map(section => `${section.title}: ${JSON.stringify(section.content)}`)
            .join('\n\n');

          const questionOptions = {
            lessonId,
            lessonTitle: lesson.title,
            lessonContent,
            questionCount: questionGenerationOptions.questionCount || 5,
            difficultyLevels: questionGenerationOptions.difficultyLevels || ['medium'],
            questionTypes: questionGenerationOptions.questionTypes || ['multiple_choice'],
            bloomTaxonomyLevels: questionGenerationOptions.bloomTaxonomyLevels || ['understand'],
            learningObjectives: questionGenerationOptions.learningObjectives || [],
            userId: user.id,
            saveToDatabase: true
          };

          const result = await questionService.generateLessonQuestions(questionOptions);
          generatedQuestions = result.questions;
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
