import { NextRequest, NextResponse } from 'next/server';
import { createSupabaseServerClient } from '@/lib/supabase/server';

// GET /api/teach/assessments - List assessments
export async function GET(request: NextRequest) {
  try {
    const supabase = createSupabaseServerClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const baseClassId = searchParams.get('base_class_id');

    let query = supabase.from('assessments').select('*');

    if (baseClassId) {
      query = query.eq('base_class_id', baseClassId);
    }
    
    // You might want to add more filters, like filtering by created_by user ID
    // query = query.eq('created_by', user.id);

    const { data, error } = await query;

    if (error) {
      console.error('Error fetching assessments:', error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json(data);

  } catch (error) {
    console.error('Error in GET /api/teach/assessments:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

// POST /api/teach/assessments - Create a new assessment
export async function POST(request: NextRequest) {
  try {
    const supabase = createSupabaseServerClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body: any = await request.json();

    if (!body.title || !body.assessment_type || !body.base_class_id) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
    }

    // Validate assessment type
    const validAssessmentTypes = ['practice', 'lesson_quiz', 'path_exam', 'final_exam', 'diagnostic', 'benchmark'] as const;
    type ValidAssessmentType = typeof validAssessmentTypes[number];
    const assessmentType: ValidAssessmentType = validAssessmentTypes.includes(body.assessment_type as ValidAssessmentType) 
      ? body.assessment_type as ValidAssessmentType
      : 'practice';

    const { data, error } = await supabase
      .from('assessments')
      .insert({
        title: body.title,
        assessment_type: assessmentType,
        base_class_id: body.base_class_id,
        lesson_id: body.lesson_id || null,
        path_id: body.path_id || null,
        description: body.description,
        settings: body.settings ?? {},
      })
      .select()
      .single();

    if (error) {
      console.error('Error creating assessment:', error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json(data, { status: 201 });

  } catch (error) {
    console.error('Error in POST /api/teach/assessments:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
