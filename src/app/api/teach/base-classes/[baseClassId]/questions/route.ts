import { NextRequest, NextResponse } from 'next/server';
import { createServerClient, type CookieOptions } from '@supabase/ssr';
import { cookies } from 'next/headers';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ baseClassId: string }> }
) {
  try {
    const cookieStore = await cookies();
    const { baseClassId } = await params;
    
    // Create Supabase client
    const supabase = createServerClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      {
        cookies: {
          get(name: string) {
            return cookieStore.get(name)?.value;
          },
          set(name: string, value: string, options: CookieOptions) {
            try {
              cookieStore.set({ name, value, ...options });
            } catch (error) {
              // Ignore error on Server Components
            }
          },
          remove(name: string, options: CookieOptions) {
            try {
              cookieStore.set({ name, value: '', ...options });
            } catch (error) {
              // Ignore error on Server Components
            }
          },
        },
      }
    );

    // Authenticate user
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Verify user has access to this base class
    const { data: baseClass, error: baseClassError } = await supabase
      .from('base_classes')
      .select('id, name, user_id')
      .eq('id', baseClassId)
      .single();

    if (baseClassError || !baseClass) {
      return NextResponse.json({ error: 'Base class not found' }, { status: 404 });
    }

    if (baseClass.user_id !== user.id) {
      return NextResponse.json({ error: 'Access denied' }, { status: 403 });
    }

    // Get all questions related to this base class
    // This includes:
    // 1. Questions from lessons in this base class
    // 2. Questions from quizzes in paths of this base class
    // 3. Questions from question folders created for this base class

    // First, get all lessons for this base class
    const { data: lessons, error: lessonsError } = await supabase
      .from('lessons')
      .select('id')
      .eq('base_class_id', baseClassId);

    if (lessonsError) {
      console.error('Error fetching lessons:', lessonsError);
      return NextResponse.json({ error: 'Failed to fetch lessons' }, { status: 500 });
    }

    const lessonIds = lessons?.map((l: any) => l.id) || [];

    // Get all paths for this base class
    const { data: paths, error: pathsError } = await supabase
      .from('paths')
      .select('id')
      .eq('base_class_id', baseClassId);

    if (pathsError) {
      console.error('Error fetching paths:', pathsError);
      return NextResponse.json({ error: 'Failed to fetch paths' }, { status: 500 });
    }

    const pathIds = paths?.map((p: any) => p.id) || [];

    // Get all quizzes for these paths
    const { data: quizzes, error: quizzesError } = pathIds.length > 0 
      ? await supabase
          .from('quizzes')
          .select('id')
          .in('path_id', pathIds)
      : { data: [], error: null };

    if (quizzesError) {
      console.error('Error fetching quizzes:', quizzesError);
      return NextResponse.json({ error: 'Failed to fetch quizzes' }, { status: 500 });
    }

    const quizIds = quizzes?.map((q: any) => q.id) || [];

    // Get all question folders created by this user (for this base class context)
    const { data: folders, error: foldersError } = await supabase
      .from('question_folders')
      .select('id')
      .eq('created_by', user.id);

    if (foldersError) {
      console.error('Error fetching question folders:', foldersError);
      return NextResponse.json({ error: 'Failed to fetch question folders' }, { status: 500 });
    }

    const folderIds = folders?.map((f: any) => f.id) || [];

    // Now fetch all questions that belong to any of these contexts
    let questionsQuery = supabase
      .from('questions')
      .select(`
        id,
        question_text,
        question_type,
        points,
        order_index,
        difficulty_score,
        cognitive_level,
        learning_objectives,
        tags,
        estimated_time,
        options,
        answer_key,
        lesson_id,
        quiz_id,
        folder_id,
        created_at,
        updated_at,
        created_by,
        lessons:lesson_id(title),
        quizzes:quiz_id(title),
        question_folders:folder_id(name)
      `);

    // Build the OR conditions for the query
    const conditions = [];
    if (lessonIds.length > 0) {
      conditions.push(`lesson_id.in.(${lessonIds.join(',')})`);
    }
    if (quizIds.length > 0) {
      conditions.push(`quiz_id.in.(${quizIds.join(',')})`);
    }
    if (folderIds.length > 0) {
      conditions.push(`folder_id.in.(${folderIds.join(',')})`);
    }

    if (conditions.length === 0) {
      // No questions found for this base class
      return NextResponse.json({ 
        success: true, 
        questions: [],
        baseClass: {
          id: baseClass.id,
          name: baseClass.name
        }
      });
    }

    // Use the OR conditions
    const { data: questions, error: questionsError } = await questionsQuery
      .or(conditions.join(','))
      .order('created_at', { ascending: false });

    if (questionsError) {
      console.error('Error fetching questions:', questionsError);
      return NextResponse.json({ error: 'Failed to fetch questions' }, { status: 500 });
    }

    return NextResponse.json({ 
      success: true, 
      questions: questions || [],
      baseClass: {
        id: baseClass.id,
        name: baseClass.name
      },
      stats: {
        totalQuestions: questions?.length || 0,
        lessonQuestions: questions?.filter((q: any) => q.lesson_id).length || 0,
        quizQuestions: questions?.filter((q: any) => q.quiz_id).length || 0,
        folderQuestions: questions?.filter((q: any) => q.folder_id).length || 0
      }
    });

  } catch (error) {
    console.error('Error in base-classes questions endpoint:', error);
    return NextResponse.json({ 
      error: 'Internal server error',
      details: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 });
  }
}
