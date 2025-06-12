import { NextRequest, NextResponse } from 'next/server';
import { createSupabaseServerClient } from '@/lib/supabase/server';

export async function GET(
  request: NextRequest,
  { params }: { params: { baseClassId: string } }
) {
  try {
    const supabase = createSupabaseServerClient();
    const { baseClassId } = params;

    // Fetch real questions from the database through question folders
    const { data: questions, error } = await supabase
      .from('questions')
      .select(`
        id,
        question_text,
        question_type,
        points,
        difficulty_score,
        cognitive_level,
        tags,
        learning_objectives,
        estimated_time,
        metadata,
        created_at,
        updated_at,
        question_folders!inner (
          id,
          name,
          base_class_id
        )
      `)
      .eq('question_folders.base_class_id', baseClassId)
      .order('created_at', { ascending: false });

    if (error) {
      console.error('Error fetching questions:', error);
      return NextResponse.json(
        { error: 'Failed to fetch questions' },
        { status: 500 }
      );
    }

    // Transform the data to match the expected format
    const transformedQuestions = questions?.map((question: any) => ({
      id: question.id,
      question_text: question.question_text,
      question_type: question.question_type,
      points: question.points || 1,
      difficulty_score: question.difficulty_score || 1,
      cognitive_level: question.cognitive_level || 'remember',
      tags: question.tags || [],
      learning_objectives: question.learning_objectives || [],
      estimated_time: question.estimated_time || 1,
      metadata: question.metadata || {},
      created_at: question.created_at,
      updated_at: question.updated_at,
      folder: {
        id: question.question_folders?.id,
        name: question.question_folders?.name
      }
    })) || [];

    return NextResponse.json({
      questions: transformedQuestions,
      total: transformedQuestions.length
    });

  } catch (error) {
    console.error('Unexpected error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

export async function POST(
  request: NextRequest,
  { params }: { params: { baseClassId: string } }
) {
  try {
    const supabase = createSupabaseServerClient();
    const { baseClassId } = params;
    const body = await request.json();

    // TODO: Implement question creation logic
    // This would involve creating questions and associating them with the base class
    
    return NextResponse.json(
      { message: 'Question creation not yet implemented' },
      { status: 501 }
    );

  } catch (error) {
    console.error('Error creating question:', error);
    return NextResponse.json(
      { error: 'Failed to create question' },
      { status: 500 }
    );
  }
} 