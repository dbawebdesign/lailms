import { NextRequest, NextResponse } from 'next/server';
import { createSupabaseServiceClient } from '@/lib/supabase/server';

const DEV_ADMIN_PASSWORD = 'TerroirLAI';

function validateDevAdminPassword(request: NextRequest): boolean {
  const authHeader = request.headers.get('x-dev-admin-password');
  return authHeader === DEV_ADMIN_PASSWORD;
}

export async function GET(request: NextRequest) {
  // Check dev admin password
  if (!validateDevAdminPassword(request)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const supabase = createSupabaseServiceClient();

    // Fetch all course catalog base classes with related counts
    const { data: courses, error } = await supabase
      .from('base_classes')
      .select(`
        id,
        name,
        description,
        created_at,
        updated_at,
        user_id,
        organisation_id,
        settings,
        assessment_config,
        paths!inner(id),
        lessons!inner(id),
        assessments!inner(id)
      `)
      .order('created_at', { ascending: false });

    if (error) {
      console.error('Error fetching course catalog:', error);
      return NextResponse.json(
        { error: 'Failed to fetch course catalog' },
        { status: 500 }
      );
    }

    // Transform the data to include counts
    const coursesWithCounts = courses?.map(course => ({
      id: course.id,
      name: course.name,
      description: course.description,
      created_at: course.created_at,
      updated_at: course.updated_at,
      user_id: course.user_id,
      organisation_id: course.organisation_id,
      settings: course.settings,
      assessment_config: course.assessment_config,
      _count: {
        paths: course.paths?.length || 0,
        lessons: course.lessons?.length || 0,
        assessments: course.assessments?.length || 0
      }
    })) || [];

    return NextResponse.json({
      success: true,
      courses: coursesWithCounts
    });

  } catch (error) {
    console.error('Error in course catalog fetch:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
