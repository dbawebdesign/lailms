import { NextRequest, NextResponse } from 'next/server';
import { createSupabaseServerClient } from '@/lib/supabase/server';
import { QuestionGenerationService } from '@/lib/services/question-generation-service';
import { Tables } from 'packages/types/db';

// GET /api/teach/assessments/path/[pathId] - Get path assessments
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ pathId: string }> }
) {
  try {
    const supabase = createSupabaseServerClient();
    const { pathId } = await params;
    const { searchParams } = new URL(request.url);
    
    // Get query parameters
    const assessmentType = searchParams.get('type'); // path_exam, comprehensive, etc.
    const includeQuestions = searchParams.get('includeQuestions') === 'true';
    const includeLessons = searchParams.get('includeLessons') === 'true';
    const page = parseInt(searchParams.get('page') || '1');
    const limit = parseInt(searchParams.get('limit') || '10');
    const offset = (page - 1) * limit;

    // Verify user authentication
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Verify path exists and user has access
    const { data: path, error: pathError } = await supabase
      .from('paths')
      .select(`
        id,
        title,
        description,
        level,
        base_class_id,
        base_classes!inner(
          id,
          name,
          created_by
        ),
        ${includeLessons ? `
        lessons(
          id,
          title,
          description,
          order_index
        )
        ` : ''}
      `)
      .eq('id', pathId)
      .single<Tables<'paths'>>();

    if (pathError || !path) {
      return NextResponse.json({ error: 'Path not found' }, { status: 404 });
    }

    // Check if user has access to this path
    const baseClass = (path as any).base_classes;
    if (!baseClass || baseClass.created_by !== user.id) {
      // Check if user is enrolled in any class instance for this base class
      const { data: classInstances, error: instanceError } = await supabase
        .from('class_instances')
        .select('id')
        .eq('base_class_id', baseClass.id)
        .returns<Tables<'class_instances'>[]>();

      if (instanceError || !classInstances || classInstances.length === 0) {
        return NextResponse.json({ error: 'Access denied' }, { status: 403 });
      }

      const classInstanceIds = classInstances.map(ci => ci.id);
      
      const { data: enrollment } = await supabase
        .from('rosters')
        .select('id, role')
        .in('class_instance_id', classInstanceIds)
        .eq('profile_id', user.id)
        .maybeSingle<Tables<'rosters'>>();

      if (!enrollment) {
        return NextResponse.json({ error: 'Access denied' }, { status: 403 });
      }
    }

    // For now, return a simplified response since we need to create the path_assessments table
    const pathData = path as any;
    const response = {
      assessments: [],
      path: {
        id: pathData.id,
        title: pathData.title,
        description: pathData.description,
        level: pathData.level,
        baseClass: {
          id: baseClass.id,
          name: baseClass.name
        },
        lessons: includeLessons ? (pathData.lessons || []) : undefined
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
    console.error('Error in path assessments GET:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

// POST /api/teach/assessments/path/[pathId] - Create new path assessment
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ pathId: string }> }
) {
  try {
    const supabase = createSupabaseServerClient();
    const { pathId } = await params;
    const body = await request.json();

    // Verify user authentication
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // For now, return a placeholder response
    return NextResponse.json({
      message: 'Path assessment creation endpoint - implementation in progress',
      pathId,
      requestBody: body
    }, { status: 501 });

  } catch (error) {
    console.error('Error in path assessments POST:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}