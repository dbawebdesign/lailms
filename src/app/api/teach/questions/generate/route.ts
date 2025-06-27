import { NextRequest, NextResponse } from 'next/server';
import { createSupabaseServerClient } from '@/lib/supabase/server';
import { Tables } from "packages/types/db";
import { QuestionGenerationService } from '@/lib/services/question-generation-service';
import { ContentExtractionService } from '@/lib/services/content-extraction-service';

export async function POST(request: NextRequest) {
  try {
    const supabase = createSupabaseServerClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const {
      sourceType, // 'lesson', 'path', 'class'
      sourceId,
      questionCount,
      questionTypes,
      tags = [],
    } = await request.json();

    if (!sourceType || !sourceId || !questionCount) {
      return NextResponse.json(
        { error: 'Missing required parameters: sourceType, sourceId, and questionCount are required.' },
        { status: 400 }
      );
    }
    
    const contentExtractionService = new ContentExtractionService();
    let content = '';
    let baseClassId = '';

    // Extract content based on source type
    if (sourceType === 'lesson') {
      content = await contentExtractionService.extractLessonContent(sourceId);
      const { data: lessonData } = await supabase.from('lessons').select('base_class_id').eq('id', sourceId).single<Tables<"lessons">>();
      if (lessonData && lessonData.base_class_id) {
        baseClassId = lessonData.base_class_id;
      }
    } else if (sourceType === 'path') {
      content = await contentExtractionService.extractPathContent(sourceId);
      const { data: pathData } = await supabase.from('paths').select('base_class_id').eq('id', sourceId).single<Tables<"paths">>();
      if (pathData && pathData.base_class_id) {
        baseClassId = pathData.base_class_id;
      }
    } else if (sourceType === 'class') {
      content = await contentExtractionService.extractClassContent(sourceId);
      baseClassId = sourceId;
    } else {
      return NextResponse.json({ error: 'Invalid sourceType' }, { status: 400 });
    }

    if (!content) {
      return NextResponse.json({ error: 'Could not extract content from source.' }, { status: 404 });
    }
    if (!baseClassId) {
      return NextResponse.json({ error: 'Could not determine the base class for the source.' }, { status: 404 });
    }

    // Generate questions
    const questionGenerationService = new QuestionGenerationService();
    const questions = await questionGenerationService.generateQuestionsFromContent(
      content,
      questionCount,
      questionTypes || ['multiple_choice', 'short_answer'],
      baseClassId,
      tags.concat(`${sourceType}_${sourceId}`)
    );

    if (!questions || questions.length === 0) {
      return NextResponse.json({ error: 'AI failed to generate questions.' }, { status: 500 });
    }

    // Map generated questions to database schema
    const questionsToInsert = questions.map((q, index) => ({
      question_text: q.question_text,
      question_type: q.question_type,
      correct_answer: q.correct_answer,
      options: q.options ? JSON.stringify(q.options) : null,
      base_class_id: baseClassId,
      author_id: user.id,
      tags: q.tags || [],
      ai_generated: true,
      validation_status: 'draft',
      order_index: index + 1,
      points: 1,
      difficulty_score: 5,
      cognitive_level: 'understand',
      estimated_time: 2
    }));

    // Save questions to the database
    const { data: savedQuestions, error: saveError } = await (supabase as any)
      .from('questions')
      .insert(questionsToInsert)
      .select();

    if (saveError) {
      console.error('Error saving questions:', saveError);
      return NextResponse.json({ error: 'Failed to save generated questions.' }, { status: 500 });
    }

    return NextResponse.json({
      message: 'Questions generated successfully',
      questions: savedQuestions,
    });

  } catch (error) {
    console.error('Error generating questions:', error);
    return NextResponse.json(
      { error: 'Failed to generate questions' },
      { status: 500 }
    );
  }
} 