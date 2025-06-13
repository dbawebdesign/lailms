import { NextRequest, NextResponse } from 'next/server';
import { createSupabaseServerClient } from '@/lib/supabase/server';
import { QuestionGenerationService } from '@/lib/services/question-generation-service';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ lessonId: string }> }
) {
  try {
    const supabase = createSupabaseServerClient();
    const { lessonId } = await params;

    // Get user session
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const assessmentId = searchParams.get('assessment_id');
    const questionType = searchParams.get('type');
    const difficultyLevel = searchParams.get('difficulty');

    // Build query for lesson questions
    let query = supabase
      .from('lesson_questions')
      .select(`
        *,
        lesson:lessons(id, title, base_class_id),
        assessment:lesson_assessments(id, title, assessment_type)
      `)
      .eq('lesson_id', lessonId)
      .eq('is_active', true);

    // Filter by assessment if provided
    if (assessmentId) {
      query = query.eq('assessment_id', assessmentId);
    }

    // Filter by question type if provided
    if (questionType) {
      query = query.eq('question_type', questionType);
    }

    // Filter by difficulty level if provided
    if (difficultyLevel) {
      query = query.eq('difficulty_level', difficultyLevel);
    }

    const { data: questions, error } = await query.order('order_index', { ascending: true });

    if (error) {
      console.error('Error fetching lesson questions:', error);
      return NextResponse.json({ error: 'Failed to fetch questions' }, { status: 500 });
    }

    return NextResponse.json({ questions });
  } catch (error) {
    console.error('Error in lesson questions GET:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ lessonId: string }> }
) {
  try {
    const supabase = createSupabaseServerClient();

    // Get user session
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { lessonId } = await params;
    const body = await request.json();

    const {
      action,
      assessment_id,
      question_count = 5,
      difficulty_levels = ['easy', 'medium', 'hard'],
      question_types = ['multiple_choice', 'true_false', 'short_answer'],
      bloom_taxonomy_levels = ['remember', 'understand', 'apply'],
      learning_objectives = [],
      // Manual question creation fields
      question_text,
      question_type,
      options,
      correct_answer,
      explanation,
      difficulty_level,
      bloom_taxonomy,
      points = 1,
      tags = []
    } = body;

    // Verify lesson exists and user has access
    const { data: lesson, error: lessonError } = await supabase
      .from('lessons')
      .select(`
        id, 
        title, 
        base_class_id, 
        content,
        base_classes(created_by)
      `)
      .eq('id', lessonId)
      .single();

    if (lessonError || !lesson) {
      return NextResponse.json({ error: 'Lesson not found' }, { status: 404 });
    }

    // Check if user owns the base class
    if (lesson.base_classes?.created_by !== user.id) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    if (action === 'generate') {
      // AI-powered question generation for the specific lesson
      try {
        const questionService = new QuestionGenerationService();
        
        // Generate questions based on lesson content only
        const generatedQuestions = await questionService.generateLessonQuestions({
          lessonId,
          lessonTitle: lesson.title,
          lessonContent: lesson.content || '',
          questionCount,
          difficultyLevels: difficulty_levels,
          questionTypes: question_types,
          bloomTaxonomyLevels: bloom_taxonomy_levels,
          learningObjectives: learning_objectives
        });

        // Save generated questions to database
        const questionsToInsert = generatedQuestions.map((q, index) => ({
          lesson_id: lessonId,
          assessment_id: assessment_id || null,
          question_text: q.question,
          question_type: q.type,
          points: q.points || 1,
          difficulty_level: q.difficulty,
          bloom_taxonomy: q.bloomLevel,
          learning_objectives: q.learningObjectives || [],
          tags: q.tags || [],
          order_index: index + 1,
          metadata: {
            options: q.options,
            correct_answer: q.correctAnswer,
            explanation: q.explanation,
            generated_at: new Date().toISOString(),
            generation_context: 'lesson_content'
          },
          created_by: user.id
        }));

        const { data: insertedQuestions, error: insertError } = await supabase
          .from('lesson_questions')
          .insert(questionsToInsert)
          .select();

        if (insertError) {
          console.error('Error inserting generated questions:', insertError);
          return NextResponse.json({ error: 'Failed to save generated questions' }, { status: 500 });
        }

        return NextResponse.json({ 
          questions: insertedQuestions,
          generated_count: insertedQuestions.length 
        }, { status: 201 });

      } catch (generationError) {
        console.error('Error generating questions:', generationError);
        return NextResponse.json({ 
          error: 'Failed to generate questions',
          details: generationError instanceof Error ? generationError.message : 'Unknown error'
        }, { status: 500 });
      }

    } else if (action === 'create') {
      // Manual question creation
      if (!question_text || !question_type || !difficulty_level) {
        return NextResponse.json(
          { error: 'Question text, type, and difficulty level are required for manual creation' },
          { status: 400 }
        );
      }

      const { data: question, error: createError } = await supabase
        .from('lesson_questions')
        .insert({
          lesson_id: lessonId,
          assessment_id: assessment_id || null,
          question_text,
          question_type,
          points,
          difficulty_level,
          bloom_taxonomy: bloom_taxonomy || 'remember',
          learning_objectives,
          tags,
          metadata: {
            options,
            correct_answer,
            explanation,
            created_manually: true
          },
          created_by: user.id
        })
        .select()
        .single();

      if (createError) {
        console.error('Error creating question:', createError);
        return NextResponse.json({ error: 'Failed to create question' }, { status: 500 });
      }

      return NextResponse.json({ question }, { status: 201 });

    } else {
      return NextResponse.json({ error: 'Invalid action. Use "generate" or "create"' }, { status: 400 });
    }

  } catch (error) {
    console.error('Error in lesson questions POST:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
} 