import { NextResponse } from 'next/server';
import { createSupabaseServerClient } from '@/lib/supabase/server';
import { getActiveProfile } from '@/lib/auth/family-helpers';
import { Tables } from 'packages/types/db';

interface EnrollmentWithClassInstance {
  id: string;
  role: string;
  joined_at: string;
  class_instances: {
    id: string;
    name: string;
    enrollment_code: string;
    start_date: string | null;
    end_date: string | null;
    status: string;
    settings: any;
    base_classes: {
      id: string;
      name: string;
      description: string | null;
    };
  };
}

export async function GET() {
  const supabase = createSupabaseServerClient();

  try {
    // Get the active profile (handles both regular users and sub-accounts)
    const activeProfileData = await getActiveProfile();
    
    if (!activeProfileData) {
      return NextResponse.json({ error: 'Authentication required' }, { status: 401 });
    }
    
    const { profile } = activeProfileData;

    // Get user's enrolled courses
    const { data: enrollments, error: enrollmentsError } = await supabase
      .from('rosters')
      .select(`
        id,
        role,
        joined_at,
        class_instances!inner (
          id,
          name,
          enrollment_code,
          start_date,
          end_date,
          status,
          settings,
          base_classes!inner (
            id,
            name,
            description
          )
        )
      `)
      .eq('profile_id', profile.user_id)
      .eq('role', 'student')
      .returns<EnrollmentWithClassInstance[]>();

    if (enrollmentsError) {
      console.error('Error fetching enrollments:', enrollmentsError);
      return NextResponse.json({ error: 'Failed to fetch enrolled courses' }, { status: 500 });
    }

    // Transform the data for the frontend
    const courses = enrollments.map(enrollment => ({
      id: enrollment.class_instances.id,
      name: enrollment.class_instances.name,
      baseClass: {
        id: enrollment.class_instances.base_classes.id,
        name: enrollment.class_instances.base_classes.name,
        description: enrollment.class_instances.base_classes.description,
      },
      enrollmentId: enrollment.id,
      enrollmentCode: enrollment.class_instances.enrollment_code,
      startDate: enrollment.class_instances.start_date,
      endDate: enrollment.class_instances.end_date,
      status: enrollment.class_instances.status,
      settings: enrollment.class_instances.settings,
      joinedAt: enrollment.joined_at,
    }));

    return NextResponse.json(courses);

  } catch (error: any) {
    console.error('Unexpected error in GET /api/learn/courses:', error);
    return NextResponse.json({ error: 'An unexpected error occurred' }, { status: 500 });
  }
} 