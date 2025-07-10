import { NextRequest, NextResponse } from 'next/server';
import { createSupabaseServerClient } from '@/lib/supabase/server';

// GET /api/teach/questions - List questions
export async function GET(request: NextRequest) {
  try {
    const supabase = createSupabaseServerClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const assessmentId = searchParams.get('assessment_id');
    const baseClassId = searchParams.get('base_class_id');
    const orderBy = searchParams.get('orderBy') || 'order_index';

    if (!assessmentId && !baseClassId) {
      return NextResponse.json({ error: 'assessment_id or base_class_id is required' }, { status: 400 });
    }

    let query;

    if (assessmentId) {
      query = supabase
        .from('assessment_questions')
        .select('*')
        .eq('assessment_id', assessmentId);
    } else if (baseClassId) {
      // First get assessments for the base class, then get questions for those assessments
      const { data: assessments, error: assessmentError } = await supabase
        .from('assessments')
        .select('id')
        .eq('base_class_id', baseClassId);

      if (assessmentError) {
        console.error('Error fetching assessments:', assessmentError);
        return NextResponse.json({ error: assessmentError.message }, { status: 500 });
      }

      if (!assessments || assessments.length === 0) {
        return NextResponse.json([]);
      }

      const assessmentIds = assessments.map(a => a.id);
      query = supabase
        .from('assessment_questions')
        .select('*')
        .in('assessment_id', assessmentIds);
    }

    if (query) {
      query = query.order(orderBy);
      const { data, error } = await query;

      if (error) {
        console.error('Error fetching questions:', error);
        return NextResponse.json({ error: error.message }, { status: 500 });
      }

      return NextResponse.json(data);
    }

    return NextResponse.json([]);

  } catch (error) {
    console.error('Error in GET /api/teach/questions:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

// POST /api/teach/questions - Create a new question
export async function POST(request: NextRequest) {
  try {
    const supabase = createSupabaseServerClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    const { 
      assessment_id, 
      question_text, 
      question_type, 
      points, 
      order_index, 
      answer_key, 
      required,
      sample_response,
      grading_rubric,
      ai_grading_enabled
    } = body;

    if (!assessment_id || !question_text || !question_type) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
    }

    const { data, error } = await supabase
      .from('assessment_questions')
      .insert({
        assessment_id,
        question_text,
        question_type,
        points: points || 1,
        order_index: order_index || 0,
        answer_key: answer_key || {},
        required: required !== undefined ? required : true,
        sample_response,
        grading_rubric,
        ai_grading_enabled: ai_grading_enabled || false
      })
      .select()
      .single();

    if (error) {
      console.error('Error creating question:', error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json(data, { status: 201 });

  } catch (error) {
    console.error('Error in POST /api/teach/questions:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
} 