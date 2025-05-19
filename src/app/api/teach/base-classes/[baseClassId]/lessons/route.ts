import { NextResponse, NextRequest } from 'next/server';
import { createSupabaseServerClient } from '@/lib/supabase/server';

export async function GET(
  request: NextRequest,
  { params }: { params: { baseClassId: string } }
) {
  const { baseClassId } = params;
  console.log(`[GET /lessons-for-baseclass] Received request for baseClassId: ${baseClassId}`);

  if (!baseClassId) {
    console.error("[GET /lessons-for-baseclass] Error: BaseClass ID is required.");
    return NextResponse.json({ error: 'BaseClass ID is required' }, { status: 400 });
  }

  const supabase = createSupabaseServerClient();

  try {
    const { data: { user }, error: userError } = await supabase.auth.getUser();
    if (userError || !user) {
      console.error(`[GET /lessons-for-baseclass] Authentication error for baseClassId ${baseClassId}:`, userError || 'User not found');
      return NextResponse.json(
        { 
          error: 'Authentication required', 
          details: userError?.message || 'No user session found.' 
        }, 
        { status: 401 }
      );
    }
    console.log(`[GET /lessons-for-baseclass] User authenticated: ${user.id} for baseClassId: ${baseClassId}`);

    // Fetch lessons associated with the baseClassId
    // The select string needs to be a valid Supabase query string.
    // Note the use of paths!inner to ensure we only get lessons that have a path linked to the base_class_id.
    const selectQuery = `
      id,
      title,
      paths!inner(
        base_class_id
      )
    `;

    const { data: lessons, error: lessonsError } = await supabase
      .from('lessons')
      .select(selectQuery)
      .eq('paths.base_class_id', baseClassId);

    if (lessonsError) {
      console.error(`[GET /lessons-for-baseclass] Error fetching lessons for baseClassId ${baseClassId}:`, lessonsError);
      return NextResponse.json({ error: 'Failed to fetch lessons', details: lessonsError.message }, { status: 500 });
    }

    if (!lessons || lessons.length === 0) {
      console.log(`[GET /lessons-for-baseclass] No lessons found for baseClassId ${baseClassId}`);
      return NextResponse.json({ lessons: [] }, { status: 200 });
    }

    // Map the results to return only lesson id and title.
    const filteredLessons = lessons.map(lesson => ({
      // The type from Supabase might be broader, so ensure we access known properties
      id: (lesson as any).id,
      title: (lesson as any).title,
    }));

    console.log(`[GET /lessons-for-baseclass] Successfully fetched ${filteredLessons.length} lessons for baseClassId: ${baseClassId}`);
    return NextResponse.json({ lessons: filteredLessons }, { status: 200 });

  } catch (error: any) {
    console.error(`[GET /lessons-for-baseclass] Unexpected error for baseClassId ${baseClassId}:`, error);
    return NextResponse.json({ error: 'An unexpected error occurred', details: error.message }, { status: 500 });
  }
}