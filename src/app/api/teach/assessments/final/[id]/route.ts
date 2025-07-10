import { NextRequest, NextResponse } from 'next/server';
import { createSupabaseServerClient } from '@/lib/supabase/server';
import { QuestionGenerationService } from '@/lib/services/question-generation-service';
import { Tables } from 'packages/types/db';

// GET /api/teach/assessments/final/[id] - Get final assessments
export async function GET(
  request: NextRequest,
  context: any
) {
  try {
    const supabase = createSupabaseServerClient();
    const { id } = context.params;
    const { searchParams } = new URL(request.url);
    
    // Get query parameters
    const assessmentType = searchParams.get('type'); // final_exam, comprehensive, benchmark
    const includeQuestions = searchParams.get('includeQuestions') === 'true';
    const includePaths = searchParams.get('includePaths') === 'true';
    const page = parseInt(searchParams.get('page') || '1');
    const limit = parseInt(searchParams.get('limit') || '10');
    const offset = (page - 1) * limit;

    // Verify user authentication
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Verify base class exists and user has access
    const { data: baseClass, error: baseClassError } = await supabase
      .from('base_classes')
      .select(`
        id,
        name,
        description,
        settings,
        user_id,
        created_at
      `)
      .eq('id', id)
      .single<Tables<'base_classes'>>();

    if (baseClassError || !baseClass) {
      return NextResponse.json({ error: 'Base class not found' }, { status: 404 });
    }

    // Get paths separately if requested
    let paths = null;
    if (includePaths) {
      const { data: pathsData } = await supabase
        .from('paths')
        .select(`
          id,
          title,
          description,
          level,
          order_index,
          lessons(
            id,
            title,
            order_index
          )
        `)
        .eq('base_class_id', id)
        .order('order_index');
      
      paths = pathsData || [];
    }

    // Check if user has access to this base class
    if (baseClass.user_id !== user.id) {
      // Check if user is a member of this base class
      const { data: membership } = await supabase
        .from('members')
        .select('id, role')
        .eq('base_class_id', id)
        .eq('user_id', user.id)
        .single();

      if (!membership) {
        return NextResponse.json({ error: 'Access denied' }, { status: 403 });
      }
    }

    // For now, return a simplified response since we need to create the final_assessments table
    const response = {
      assessments: [],
      baseClass: {
        id: baseClass.id,
        name: baseClass.name,
        description: baseClass.description,
        settings: baseClass.settings,
        createdAt: baseClass.created_at,
        paths: includePaths ? paths : undefined
      },
      pagination: {
        page,
        limit,
        total: 0,
        totalPages: 0
      }
    };

    return NextResponse.json(response);

  } catch (error) {
    console.error('Error in final assessments GET:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

// POST /api/teach/assessments/final/[id] - Create new final assessment
export async function POST(
  request: NextRequest,
  context: any
) {
  try {
    const supabase = createSupabaseServerClient();
    const { id } = context.params;
    const body = await request.json();

    // Verify user authentication
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // For now, return a placeholder response
    return NextResponse.json({
      message: 'Final assessment creation endpoint - implementation in progress',
      baseClassId: id,
      requestBody: body
    }, { status: 501 });

  } catch (error) {
    console.error('Error in final assessments POST:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
} 