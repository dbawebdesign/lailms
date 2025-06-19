import { NextRequest, NextResponse } from 'next/server';
import { createSupabaseServerClient } from '@/lib/supabase/server';

export async function GET(request: NextRequest) {
  try {
    const supabase = createSupabaseServerClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const baseClassId = searchParams.get('base_class_id');

    if (!baseClassId) {
      return NextResponse.json({ error: 'base_class_id is required' }, { status: 400 });
    }

    let query = supabase.from('question_folders').select('*').eq('base_class_id', baseClassId);

    const { data, error } = await query;

    if (error) {
      console.error('Error fetching question folders:', error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json(data);

  } catch (error) {
    console.error('Error in GET /api/teach/question-folders:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
} 