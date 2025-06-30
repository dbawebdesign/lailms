import { NextRequest, NextResponse } from 'next/server';
import { createSupabaseServerClient } from '@/lib/supabase/server';
import { Tables } from 'packages/types/db';
import { QuestionGenerationService } from '@/lib/services/question-generation-service';

type QuestionType = 'multiple_choice' | 'true_false' | 'short_answer' | 'long_answer' | 'coding';

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
    const questionType = searchParams.get('type');

    // Build query for lesson questions - use explicit typing to avoid recursion
    const baseQuery = (supabase as any)
      .from('questions')
      .select('*')
      .eq('lesson_id', lessonId);

    // Apply filters
    let filteredQuery = baseQuery;
    if (questionType) {
      filteredQuery = filteredQuery.eq('question_type', questionType);
    }

    const { data: questions, error } = await filteredQuery.order('order_index', { ascending: true });

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
      question_count = 5,
      question_types = ['multiple_choice', 'true_false', 'short_answer'],
      learning_objectives = [],
      // Manual question creation fields
      question_text,
      question_type,
      options,
      correct_answer,
      cognitive_level,
      difficulty_score = 5,
      points = 1,
      tags = []
    } = body;

    // Verify lesson exists and user has access
    const { data: lesson, error: lessonError } = await (supabase as any)
      .from('lessons')
      .select(`
        id, 
        title, 
        base_class_id, 
        description,
        created_by
      `)
      .eq('id', lessonId)
      .single();

    if (lessonError || !lesson) {
      return NextResponse.json({ error: 'Lesson not found' }, { status: 404 });
    }

    // Check if user owns the lesson
    if (lesson.created_by !== user.id) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    if (action === 'generate') {
      // AI-powered question generation for the specific lesson
      try {
        const questionService = new QuestionGenerationService();
        
        // Generate questions based on lesson content only
        const generatedQuestions = await questionService.generateQuestionsFromContent(
          lesson.description || '',
          question_count,
          question_types as QuestionType[],
          lesson.base_class_id,
          tags
        );

        // Save generated questions to database
        const questionsToInsert = generatedQuestions.map((q, index) => ({
          lesson_id: lessonId,
          base_class_id: lesson.base_class_id,
          question_text: q.question_text,
          question_type: q.question_type,
          points: points || 1,
          difficulty_score: difficulty_score,
          cognitive_level: cognitive_level || 'remember',
          learning_objectives: learning_objectives || [],
          tags: q.tags || [],
          order_index: index + 1,
          options: q.options || null,
          correct_answer: q.correct_answer,
          ai_generated: true,
          created_by: user.id,
          author_id: user.id,
          legacy_metadata: {
            generated_at: new Date().toISOString(),
            generation_context: 'lesson_content'
          }
        }));

        const { data: insertedQuestions, error: insertError } = await (supabase as any)
          .from('questions')
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
      if (!question_text || !question_type) {
        return NextResponse.json(
          { error: 'Question text and type are required for manual creation' },
          { status: 400 }
        );
      }

      const { data: question, error: createError } = await (supabase as any)
        .from('questions')
        .insert({
          lesson_id: lessonId,
          base_class_id: lesson.base_class_id,
          question_text,
          question_type,
          points,
          difficulty_score,
          cognitive_level: cognitive_level || 'remember',
          learning_objectives,
          tags,
          options: options || null,
          correct_answer,
          ai_generated: false,
          created_by: user.id,
          author_id: user.id
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