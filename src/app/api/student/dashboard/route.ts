import { createSupabaseServerClient } from "@/lib/supabase/server";
import { NextResponse } from "next/server";
import type { UserRole } from "@/lib/utils/roleUtils";
import { ActiveCourseItemProps } from "@/components/dashboard/student/ActiveCourseItem";
import { Tables } from "packages/types/db";
import { calculateOverallProgress } from "@/lib/student/progress.server";
import { isStudent, getEffectiveRole, PROFILE_ROLE_FIELDS } from '@/lib/utils/roleUtils';

// Helper function to fetch Active Courses data
async function getActiveCoursesData(supabase: any, userId: string): Promise<ActiveCourseItemProps[]> {
  const { data: enrollments, error: enrollmentsError } = await supabase
    .from('rosters')
    .select(`
      class_instances (
        id,
        name,
        base_classes (
          id,
          description
        )
      )
    `)
    .eq('profile_id', userId)
    .eq('role', 'student')
    // .eq('class_instances.archived', false) // Add if you have an archived flag
    .order('created_at', { ascending: false }); // Show most recently enrolled first

  if (enrollmentsError || !enrollments) {
    console.error("Error fetching active courses:", enrollmentsError);
    return [];
  }

  const coursePromises = enrollments.map(async (enrollment: any) => {
    const instance = enrollment.class_instances;
    if (!instance) return null;

    const description = instance.base_classes?.description || "No description available."; 
    
    // Get stored progress from progress table, fallback to calculation
    const { data: progressData } = await supabase
      .from('progress')
      .select('progress_percentage')
      .eq('user_id', userId)
      .eq('item_type', 'class_instance')
      .eq('item_id', instance.id)
      .single();

    let progress = 0;
    if (progressData?.progress_percentage !== null && progressData?.progress_percentage !== undefined) {
      progress = progressData.progress_percentage;
    } else {
      // Fallback: calculate and store progress
      progress = await calculateOverallProgress(instance.base_classes.id, userId);
      
      // Store the calculated progress
      await supabase.rpc('upsert_progress', {
        p_user_id: userId,
        p_item_type: 'class_instance',
        p_item_id: instance.id,
        p_status: progress >= 100 ? 'completed' : progress > 0 ? 'in_progress' : 'not_started',
        p_progress_percentage: Math.round(progress),
        p_last_position: null
      });
    }

    return {
      id: instance.id,
      title: instance.name || "Unnamed Course",
      description: description,
      progress: Math.round(progress),
      href: `/learn/courses/${instance.id}`,
    };
  });

  const courses = await Promise.all(coursePromises);
  return courses.filter(Boolean) as ActiveCourseItemProps[];
}

export async function GET() {
  try {
    const supabase = createSupabaseServerClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();

    if (authError || !user) {
      console.error('Auth error or no user:', authError);
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { data: profile, error: profileError } = await supabase
      .from("profiles")
      .select(PROFILE_ROLE_FIELDS)
      .eq("user_id", user.id)
      .single<Tables<"profiles">>();

    if (profileError || !profile) {
      console.error("Error fetching student profile:", profileError);
      return NextResponse.json({ error: 'Profile not found' }, { status: 404 });
    }
    
    if (!isStudent(profile)) {
      const currentRole = getEffectiveRole(profile);
      console.warn(`User role mismatch: ${currentRole}, expected student`);
      return NextResponse.json({ error: 'Unauthorized - not a student' }, { status: 403 });
    }
    
    const userName = profile.first_name || user.email || "Learner";
    const activeCourses = await getActiveCoursesData(supabase, user.id);
    const currentRole = getEffectiveRole(profile);

    return NextResponse.json({
      userName,
      userRole: currentRole as UserRole,
      activeCourses,
    });

  } catch (error: any) {
    console.error('Error fetching dashboard data:', error);
    return NextResponse.json({ 
      error: 'Failed to fetch dashboard data', 
      details: error.message 
    }, { status: 500 });
  }
} 