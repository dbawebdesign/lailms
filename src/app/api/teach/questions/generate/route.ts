import { NextRequest, NextResponse } from 'next/server';
import { createSupabaseServerClient } from '@/lib/supabase/server';
import { Tables } from "packages/types/db";
import { AssessmentGenerationService } from '@/lib/services/assessment-generation-service';
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
      questionTypes = ['multiple_choice', 'short_answer'],
      difficulty = 'medium',
      assessmentId // Required - questions will be added to this assessment
    } = await request.json();

    if (!sourceType || !sourceId || !questionCount || !assessmentId) {
      return NextResponse.json(
        { error: 'Missing required parameters: sourceType, sourceId, questionCount, and assessmentId are required.' },
        { status: 400 }
      );
    }

    // Verify assessment exists and user has access
    const { data: assessment, error: assessmentError } = await supabase
      .from('assessments')
      .select('id, base_class_id, title')
      .eq('id', assessmentId)
      .single();

    if (assessmentError || !assessment) {
      return NextResponse.json({ error: 'Assessment not found or access denied.' }, { status: 404 });
    }
    
    const contentExtractionService = new ContentExtractionService();
    let content = '';
    let baseClassId = assessment.base_class_id; // Use the assessment's base class

    // Extract content based on source type
    if (sourceType === 'lesson') {
      content = await contentExtractionService.extractLessonContent(sourceId);
      const { data: lessonData } = await supabase.from('lessons').select('base_class_id').eq('id', sourceId).single<Tables<"lessons">>();
      if (lessonData && lessonData.base_class_id !== baseClassId) {
        return NextResponse.json({ error: 'Lesson does not belong to the same class as the assessment.' }, { status: 400 });
      }
    } else if (sourceType === 'path') {
      content = await contentExtractionService.extractPathContent(sourceId);
      const { data: pathData } = await supabase.from('paths').select('base_class_id').eq('id', sourceId).single<Tables<"paths">>();
      if (pathData && pathData.base_class_id !== baseClassId) {
        return NextResponse.json({ error: 'Path does not belong to the same class as the assessment.' }, { status: 400 });
      }
    } else if (sourceType === 'class') {
      content = await contentExtractionService.extractClassContent(sourceId);
      if (sourceId !== baseClassId) {
        return NextResponse.json({ error: 'Class ID does not match the assessment\'s base class.' }, { status: 400 });
      }
    } else {
      return NextResponse.json({ error: 'Invalid sourceType' }, { status: 400 });
    }

    if (!content) {
      return NextResponse.json({ error: 'Could not extract content from source.' }, { status: 404 });
    }

    // Generate individual questions using the assessment generation service
    const assessmentGenerationService = new AssessmentGenerationService();
    
    // Use the internal method to generate questions from content
    const questions = await (assessmentGenerationService as any).generateQuestionsFromContent(
      content,
      questionCount,
      questionTypes,
      difficulty
    );

    if (!questions || questions.length === 0) {
      return NextResponse.json({ error: 'Failed to generate questions.' }, { status: 500 });
    }

    // Get the current highest order_index for this assessment
    const { data: existingQuestions } = await supabase
      .from('assessment_questions')
      .select('order_index')
      .eq('assessment_id', assessmentId)
      .order('order_index', { ascending: false })
      .limit(1);

    const startingOrderIndex = existingQuestions && existingQuestions.length > 0 
      ? existingQuestions[0].order_index + 1 
      : 1;

    // Map generated questions to database schema for assessment_questions table
    const questionsToInsert = questions.map((q: any, index: number) => ({
      assessment_id: assessmentId, // Always link to the specified assessment
      question_text: q.question_text,
      question_type: q.question_type,
      options: q.options || null, // JSONB field for question options
      correct_answer: q.correct_answer || null, // JSONB field for correct answer
      answer_key: q.answer_key, // JSONB field for grading information
      sample_response: q.sample_response || null,
      grading_rubric: q.grading_rubric || null,
      points: q.points || 1,
      order_index: startingOrderIndex + index, // Continue from existing questions
      required: true,
      ai_grading_enabled: ['short_answer', 'essay'].includes(q.question_type),
      explanation: q.explanation || null
    }));

    // Save questions to the assessment_questions table
    const { data: savedQuestions, error: saveError } = await supabase
      .from('assessment_questions')
      .insert(questionsToInsert)
      .select(`
        id,
        question_text,
        question_type,
        options,
        correct_answer,
        answer_key,
        sample_response,
        grading_rubric,
        points,
        order_index,
        explanation,
        assessment_id
      `);

    if (saveError) {
      console.error('Error saving questions:', saveError);
      return NextResponse.json({ error: 'Failed to save generated questions.' }, { status: 500 });
    }

    return NextResponse.json({
      message: `${savedQuestions?.length || 0} questions generated and added to assessment "${assessment.title}"`,
      questions: savedQuestions,
      questionCount: savedQuestions?.length || 0,
      assessmentId: assessmentId,
      assessmentTitle: assessment.title
    });

  } catch (error) {
    console.error('Error generating questions:', error);
    return NextResponse.json(
      { error: 'Failed to generate questions' },
      { status: 500 }
    );
  }
} 