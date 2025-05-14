import { createSupabaseServerClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import type { UserRole } from "@/config/navConfig";
import WelcomeCard from "@/components/dashboard/WelcomeCard";
import NextUpCard from "@/components/dashboard/student/NextUpCard";
import ActiveCourseItem, { ActiveCourseItemProps } from "@/components/dashboard/student/ActiveCourseItem";

// Helper function to fetch Next Up data
async function getNextUpData(supabase: any, userId: string) {
  const { data: enrollments, error: enrollmentsError } = await supabase
    .from('rosters')
    .select('class_instances (id, name, base_class_id)')
    .eq('profile_id', userId)
    .eq('role', 'student')
    .limit(1);

  if (enrollmentsError || !enrollments || enrollments.length === 0 || !enrollments[0].class_instances) {
    return { lessonTitle: undefined, courseTitle: undefined, lessonHref: undefined };
  }
  const currentInstance = enrollments[0].class_instances;
  const courseTitle = currentInstance.name || "Unnamed Course";
  const baseClassId = currentInstance.base_class_id;

  const { data: path, error: pathError } = await supabase
    .from('paths')
    .select('id')
    .eq('base_class_id', baseClassId)
    .order('sort_index', { ascending: true })
    .limit(1);
  if (pathError || !path || path.length === 0) {
    return { lessonTitle: undefined, courseTitle: courseTitle, lessonHref: undefined };
  }
  const firstPathId = path[0].id;

  const { data: lesson, error: lessonError } = await supabase
    .from('lessons')
    .select('id, title')
    .eq('path_id', firstPathId)
    .order('sort_index', { ascending: true })
    .limit(1);
  if (lessonError || !lesson || lesson.length === 0) {
    return { lessonTitle: undefined, courseTitle: courseTitle, lessonHref: undefined };
  }
  const firstLesson = lesson[0];
  const lessonTitle = firstLesson.title || "Unnamed Lesson";
  const lessonHref = `/learn/courses/${currentInstance.id}/lessons/${firstLesson.id}`;
  return { lessonTitle, courseTitle, lessonHref };
}

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
          settings
        )
      )
    `)
    .eq('profile_id', userId)
    .eq('role', 'student')
    // .eq('class_instances.archived', false) // Add if you have an archived flag
    // .order('class_instances.last_accessed_at', { ascending: false }) // For most recent
    .limit(3); // Limit to 3 courses

  if (enrollmentsError || !enrollments) {
    console.error("Error fetching active courses:", enrollmentsError);
    return [];
  }

  return enrollments.map((enrollment: any) => {
    const instance = enrollment.class_instances;
    // Access subject from settings
    const subject = instance.base_classes?.settings?.subject || "General Subject"; 
    return {
      id: instance.id,
      title: instance.name || "Unnamed Course",
      description: subject, // Use the extracted subject as description
      progress: Math.floor(Math.random() * 100), // Placeholder progress
      href: `/learn/courses/${instance.id}`,
    };
  }).filter(Boolean) as ActiveCourseItemProps[];
}

export default async function StudentDashboardPage() {
  const supabase = createSupabaseServerClient();
  const { data: { user }, error: authError } = await supabase.auth.getUser();

  if (authError || !user) {
    console.error('Auth error or no user:', authError);
    redirect("/login?error=auth");
  }

  const { data: profile, error: profileError } = await supabase
    .from("profiles")
    .select("role, first_name, last_name, user_id")
    .eq("user_id", user.id)
    .single();

  if (profileError || !profile) {
    console.error("Error fetching student profile:", profileError);
    redirect("/login?error=profile");
  }
  if (profile.role !== 'student') {
    console.warn(`User role mismatch: ${profile.role}, expected student`);
    redirect("/dashboard?error=unauthorized");
  }
  
  const userName = profile.first_name || user.email || "Learner";
  const nextUpData = await getNextUpData(supabase, user.id);
  const activeCourses = await getActiveCoursesData(supabase, user.id);

  return (
    <div className="container mx-auto p-4 sm:p-6 md:p-8">
      <WelcomeCard userName={userName} userRole={profile.role as UserRole} />
      
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-6">
        <div className="md:col-span-1">
          <NextUpCard 
            lessonTitle={nextUpData.lessonTitle}
            courseTitle={nextUpData.courseTitle}
            lessonHref={nextUpData.lessonHref}
          />
        </div>
        <div className="md:col-span-2 bg-card p-6 rounded-lg shadow">
          <h2 className="text-xl font-semibold mb-4">My Active Courses</h2>
          {activeCourses.length > 0 ? (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {activeCourses.map(course => (
                <ActiveCourseItem key={course.id} {...course} />
              ))}
            </div>
          ) : (
            <p className="text-muted-foreground">You are not currently enrolled in any active courses. Explore and join a new course!</p>
          )}
        </div>
      </div>

      {/* Remaining placeholders */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div className="bg-card p-6 rounded-lg shadow">
          <h2 className="text-xl font-semibold mb-3">Achievements</h2>
          <p className="text-muted-foreground">Your recent badges and achievements.</p>
        </div>
        <div className="bg-card p-6 rounded-lg shadow">
          <h2 className="text-xl font-semibold mb-3">Join a Class</h2>
          <p className="text-muted-foreground">CTA to join a new class.</p>
        </div>
      </div>
    </div>
  );
} 