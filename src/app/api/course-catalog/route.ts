import { NextRequest, NextResponse } from 'next/server';
import { createSupabaseServerClient } from '@/lib/supabase/server';

export async function GET(request: NextRequest) {
  try {
    const supabase = createSupabaseServerClient();

    // Check authentication
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Fetch all course catalog base classes with related counts
    const { data: courses, error } = await supabase
      .from('base_classes')
      .select(`
        id,
        name,
        description,
        created_at,
        updated_at,
        settings,
        paths!inner(id),
        lessons!inner(id),
        assessments!inner(id)
      `)
      .eq('course_catalog', true)
      .order('created_at', { ascending: false });

    if (error) {
      console.error('Error fetching course catalog:', error);
      return NextResponse.json(
        { error: 'Failed to fetch course catalog' },
        { status: 500 }
      );
    }

    // Transform the data to include counts
    const coursesWithCounts = courses.map(course => ({
      ...course,
      _count: {
        paths: course.paths?.length || 0,
        lessons: course.lessons?.length || 0,
        assessments: course.assessments?.length || 0
      }
    }));

    // Remove the nested arrays from the response
    const cleanCourses = coursesWithCounts.map(({ paths, lessons, assessments, ...course }) => course);

    return NextResponse.json({
      success: true,
      courses: cleanCourses
    });

  } catch (error) {
    console.error('Error in course catalog fetch:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
