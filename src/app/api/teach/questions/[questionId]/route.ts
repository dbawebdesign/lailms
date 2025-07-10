import { NextRequest, NextResponse } from 'next/server';
import { createSupabaseServerClient } from '@/lib/supabase/server';

// GET /api/teach/questions/[questionId] - Get a single question
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ questionId: string }> }
) {
  try {
    const supabase = createSupabaseServerClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { questionId } = await params;

    const { data, error } = await supabase
      .from('assessment_questions')
      .select('*')
      .eq('id', questionId)
      .single();

    if (error) {
      return NextResponse.json({ error: 'Question not found' }, { status: 404 });
    }

    return NextResponse.json(data);

  } catch (error) {
    console.error('Error in GET /api/teach/questions/[questionId]:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

// PUT /api/teach/questions/[questionId] - Update a question
export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ questionId: string }> }
) {
  try {
    const supabase = createSupabaseServerClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { questionId } = await params;
    const body = await request.json();

    const { data, error } = await supabase
      .from('assessment_questions')
      .update(body)
      .eq('id', questionId)
      .select()
      .single();

    if (error) {
      console.error('Error updating question:', error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json(data);

  } catch (error) {
    console.error('Error in PUT /api/teach/questions/[questionId]:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

// PATCH /api/teach/questions/[questionId] - Partially update a question
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ questionId: string }> }
) {
  try {
    const supabase = createSupabaseServerClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { questionId } = await params;
    const body = await request.json();

    // Filter out undefined values and id field
    const updates = Object.fromEntries(
      Object.entries(body).filter(([key, value]) => value !== undefined && key !== 'id')
    );

    const { data, error } = await supabase
      .from('assessment_questions')
      .update(updates)
      .eq('id', questionId)
      .select()
      .single();

    if (error) {
      console.error('Error updating question:', error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json(data);

  } catch (error) {
    console.error('Error in PATCH /api/teach/questions/[questionId]:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

// DELETE /api/teach/questions/[questionId] - Delete a question
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ questionId: string }> }
) {
  try {
    const supabase = createSupabaseServerClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { questionId } = await params;

    const { error } = await supabase
      .from('assessment_questions')
      .delete()
      .eq('id', questionId);

    if (error) {
      console.error('Error deleting question:', error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return new NextResponse(null, { status: 204 });

  } catch (error) {
    console.error('Error in DELETE /api/teach/questions/[questionId]:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
} 