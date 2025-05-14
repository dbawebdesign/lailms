import { createSupabaseServerClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import WelcomeCard from "@/components/dashboard/WelcomeCard";
import { ActiveClassItem } from "@/components/dashboard/teacher/ActiveClassItem";
import { RecentlyGradedItem } from "@/components/dashboard/teacher/RecentlyGradedItem";
import { UpcomingDeadlineItem } from "@/components/dashboard/teacher/UpcomingDeadlineItem";
import { StudentPerformanceItem } from "@/components/dashboard/teacher/StudentPerformanceItem";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { BookOpenCheck, ClipboardCheck, AlertTriangle, Info, CalendarClock, Users } from 'lucide-react';

interface ActiveClassData {
  id: string;
  name: string;
  baseClassName: string;
  studentCount: number;
  manageClassUrl: string;
}

async function getActiveClassesData(supabase: ReturnType<typeof createSupabaseServerClient>, userId: string): Promise<ActiveClassData[]> {
  // 1. Get class instances where the user is a teacher
  const { data: rosterEntries, error: rosterError } = await supabase
    .from('rosters')
    .select('class_instance_id')
    .eq('profile_id', userId)
    .eq('role', 'teacher');

  if (rosterError) {
    console.error("Error fetching teacher's roster entries:", rosterError);
    return [];
  }

  if (!rosterEntries || rosterEntries.length === 0) {
    return [];
  }

  const classInstanceIds = rosterEntries.map(entry => entry.class_instance_id);

  // 2. Get details for these class instances and their base classes
  const { data: classInstances, error: classInstancesError } = await supabase
    .from('class_instances')
    .select(`
      id,
      name,
      base_class_id,
      base_classes (name)
    `)
    .in('id', classInstanceIds)
    // Add a limit for the dashboard, e.g., 5 most recent or by start_date
    .order('created_at', { ascending: false })
    .limit(5);

  if (classInstancesError) {
    console.error('Error fetching class instances:', classInstancesError);
    return [];
  }

  if (!classInstances) return [];

  // 3. For each class instance, get the student count
  const activeClassesWithCounts: ActiveClassData[] = await Promise.all(
    classInstances.map(async (instance) => {
      const { count, error: countError } = await supabase
        .from('rosters')
        .select('*', { count: 'exact', head: true })
        .eq('class_instance_id', instance.id)
        .eq('role', 'STUDENT');

      if (countError) {
        console.error(`Error fetching student count for class ${instance.id}:`, countError);
      }
      
      const baseClass = instance.base_classes as { name: string } | null; // Type assertion

      return {
        id: instance.id,
        name: instance.name,
        baseClassName: baseClass?.name || 'Unknown Base Class',
        studentCount: countError ? 0 : count || 0,
        manageClassUrl: `/teach/instances/${instance.id}`,
      };
    })
  );

  return activeClassesWithCounts;
}

interface RecentlyGradedData {
  submissionId: string;
  assignmentName: string;
  studentName: string;
  studentInitials: string;
  // studentAvatarUrl?: string; // If Avatar is added later
  score: number | null;
  maxScore?: number; // Assuming quizzes might have a max score defined in questions or quiz settings
  gradedAt: string;
  viewSubmissionUrl?: string; // e.g., /teach/instances/:instanceId/quizzes/:quizId/submissions/:submissionId
}

async function getRecentlyGradedData(supabase: ReturnType<typeof createSupabaseServerClient>, userId: string): Promise<RecentlyGradedData[]> {
  // 1. Get class instances where the user is a teacher
  const { data: rosterEntries, error: rosterError } = await supabase
    .from('rosters')
    .select('class_instance_id')
    .eq('profile_id', userId)
    .eq('role', 'teacher');

  if (rosterError) {
    console.error("Error fetching teacher's roster entries for graded data:", rosterError);
    return [];
  }
  if (!rosterEntries || rosterEntries.length === 0) return [];
  const classInstanceIds = rosterEntries.map(entry => entry.class_instance_id);

  // 2. Get base_class_ids for these class instances
  const { data: classInstanceDetails, error: ciError } = await supabase
    .from('class_instances')
    .select('id, base_class_id')
    .in('id', classInstanceIds);

  if (ciError) {
    console.error("Error fetching class instance details for graded data:", ciError);
    return [];
  }
  if (!classInstanceDetails || classInstanceDetails.length === 0) return [];
  const baseClassIds = classInstanceDetails.map(ci => ci.base_class_id);

  // 3. Get lesson_ids for these base_classes
  const { data: lessons, error: lessonError } = await supabase
    .from('lessons')
    .select('id')
    .in('base_class_id', baseClassIds);

  if (lessonError) {
    console.error("Error fetching lessons for graded data:", lessonError);
    return [];
  }
  if (!lessons || lessons.length === 0) return [];
  const lessonIds = lessons.map(l => l.id);

  // 4. Get quiz_ids for these lessons
  const { data: quizzes, error: quizError } = await supabase
    .from('quizzes')
    .select('id, title, questions(points)') // Fetch quiz title and potentially sum points for maxScore
    .in('lesson_id', lessonIds);

  if (quizError) {
    console.error("Error fetching quizzes for graded data:", quizError);
    return [];
  }
  if (!quizzes || quizzes.length === 0) return [];
  const quizIdMap = new Map(quizzes.map(q => [q.id, {
    title: q.title,
    // Calculate maxScore: sum of points of all questions in the quiz
    // This assumes questions are always fetched. If not, maxScore calculation might need adjustment or be omitted.
    maxScore: q.questions ? q.questions.reduce((sum: number, qs: any) => sum + (qs.points || 0), 0) : undefined
  }]));
  const quizIds = quizzes.map(q => q.id);

  // 5. Get recent graded submissions for these quizzes
  const { data: submissions, error: submissionError } = await supabase
    .from('submissions')
    .select(`
      id,
      quiz_id,
      member_id,
      score,
      graded_at,
      members (first_name, last_name)
    `)
    .in('quiz_id', quizIds)
    .not('graded_at', 'is', null)
    .order('graded_at', { ascending: false })
    .limit(5); // Limit to 5 recent items

  if (submissionError) {
    console.error("Error fetching recent submissions:", submissionError);
    return [];
  }
  if (!submissions) return [];

  return submissions.map(sub => {
    const quizInfo = quizIdMap.get(sub.quiz_id);
    const student = sub.members as { first_name: string | null; last_name: string | null } | null;
    const studentFirstName = student?.first_name || '' ;
    const studentLastName = student?.last_name || '' ;
    const studentName = `${studentFirstName} ${studentLastName}`.trim() || 'Unknown Student';
    const studentInitials = `${studentFirstName?.[0] || ''}${studentLastName?.[0] || ''}`.toUpperCase() || 'N/A';
    
    // Try to find the classInstanceId associated with this submission for the URL
    // This is a bit complex here; a simpler URL might be better for now, or this needs more robust logic
    // For now, we don't have a direct link from submission back to one specific instance if a base_class is used in multiple instances
    // Let's omit specific instanceId in URL for now if it's too complex to derive accurately here.
    const viewUrl = quizInfo ? `/teach/quizzes/${sub.quiz_id}/submissions/${sub.id}` : undefined;

    return {
      submissionId: sub.id,
      assignmentName: quizInfo?.title || 'Unknown Assignment',
      studentName: studentName,
      studentInitials: studentInitials,
      score: sub.score,
      maxScore: quizInfo?.maxScore,
      gradedAt: sub.graded_at!, // We filtered for not null
      viewSubmissionUrl: viewUrl,
    };
  });
}

interface UpcomingDeadlineData {
  id: string;
  assignmentName: string;
  className: string; 
  dueDate: string; // ISO string
  detailsUrl?: string;
}

async function getUpcomingDeadlinesData(supabase: ReturnType<typeof createSupabaseServerClient>, userId: string): Promise<UpcomingDeadlineData[]> {
  // NOTE: This function currently returns mock data or an empty array 
  // as the database schema does not have a clear 'due_date' field for assignments/quizzes.
  // This needs to be updated if/when the schema supports queryable due dates.
  console.warn("getUpcomingDeadlinesData is returning placeholder data. Schema update needed for real data.");
  
  // To demonstrate UI, returning mock data. Replace with actual data fetching when possible.
  // const MOCK_DELAY = 100; // ms
  // await new Promise(resolve => setTimeout(resolve, MOCK_DELAY));
  
  // Example of how data might be fetched if quizzes had a due_date and were linked to class_instances:
  /*
  const { data: rosterEntries, error: rosterError } = await supabase
    .from('rosters')
    .select('class_instance_id')
    .eq('profile_id', userId)
    .eq('role', 'teacher');
  if (rosterError || !rosterEntries) return [];
  const classInstanceIds = rosterEntries.map(entry => entry.class_instance_id);

  const { data: classInstances, error: ciError } = await supabase
    .from('class_instances')
    .select('id, name, base_class_id, base_classes(name)')
    .in('id', classInstanceIds);
  if (ciError || !classInstances) return [];

  const deadlines: UpcomingDeadlineData[] = [];
  const today = new Date();
  const futureDate = new Date(today);
  futureDate.setDate(today.getDate() + 30); // Look ahead 30 days

  for (const instance of classInstances) {
    const { data: lessons, error: lessonError } = await supabase
      .from('lessons')
      .select('id')
      .eq('base_class_id', instance.base_class_id);
    if (lessonError || !lessons) continue;
    const lessonIds = lessons.map(l => l.id);

    const { data: quizzes, error: quizError } = await supabase
      .from('quizzes') // Assuming quizzes table has 'title' and 'due_date'
      .select('id, title, due_date') // Requires 'due_date' on quizzes table
      .in('lesson_id', lessonIds)
      .gte('due_date', today.toISOString().split('T')[0]) // Due date is today or in the future
      .lte('due_date', futureDate.toISOString().split('T')[0]) // Due date within the next 30 days
      .order('due_date', { ascending: true })
      .limit(3); // Limit per class instance for example
    
    if (quizzes) {
      quizzes.forEach(quiz => {
        if(quiz.due_date) { // ensure due_date is not null
            deadlines.push({
                id: quiz.id,
                assignmentName: quiz.title,
                className: instance.name || instance.base_classes?.name || 'Unknown Class',
                dueDate: quiz.due_date, 
                detailsUrl: `/teach/instances/${instance.id}/quizzes/${quiz.id}`
            });
        }
      });
    }
  }
  // Sort all found deadlines and take top N (e.g., 5)
  deadlines.sort((a, b) => new Date(a.dueDate).getTime() - new Date(b.dueDate).getTime());
  return deadlines.slice(0, 5);
  */
  return []; // Returning empty for now until schema is confirmed/updated
}

interface StudentPerformanceData {
  id: string; // class_instance_id
  name: string; // Class name
  studentCount: number;
  averageScore?: number;
  studentsAtRiskCount?: number;
  detailsUrl?: string;
}

async function getStudentPerformanceData(supabase: ReturnType<typeof createSupabaseServerClient>, userId: string): Promise<StudentPerformanceData[]> {
  // NOTE: This function currently returns an empty array.
  // Fetching and calculating student performance data (average scores, students at risk)
  // is complex and requires further definition of how scores are aggregated and thresholds are set.
  // This would likely involve querying submissions for all quizzes in a class, calculating averages,
  // and comparing against defined criteria.
  console.warn("getStudentPerformanceData is returning placeholder data. Complex data aggregation and schema review needed for real data.");

  // Example mock data structure (if we were to return some for UI demo):
  /*
  return [
    {
      id: "class_1",
      name: "Introduction to Algebra - Fall 2024",
      studentCount: 25,
      averageScore: 78,
      studentsAtRiskCount: 3,
      detailsUrl: "/teach/instances/class_1/performance"
    },
    {
      id: "class_2",
      name: "Creative Writing Workshop",
      studentCount: 18,
      averageScore: 85,
      studentsAtRiskCount: 1,
      detailsUrl: "/teach/instances/class_2/performance"
    }
  ];
  */
  return []; // Returning empty for now
}

export default async function TeacherDashboardPage() {
  const supabase = createSupabaseServerClient();
  const { data: { user }, error: authError } = await supabase.auth.getUser();

  if (authError || !user) {
    console.error('Auth error or no user:', authError);
    redirect("/login?error=auth");
  }

  const { data: profile, error: profileError } = await supabase
    .from('profiles')
    .select('user_id, first_name, last_name, role')
    .eq('user_id', user.id)
    .single();

  if (profileError || !profile) {
    console.error('TeacherDashboard: Profile fetch failed. ProfileError:', profileError, 'Profile:', profile, 'UserID:', user.id);
    redirect("/login?error=profile");
  }

  console.log(`TeacherDashboard: User ID: ${user.id}, Fetched Profile Role: ${profile?.role}`);

  if (profile.role !== 'teacher') {
    console.warn(`TeacherDashboard: Role mismatch. Actual: ${profile.role}, Expected: teacher. Redirecting to /dashboard?error=unauthorized`);
    redirect("/dashboard?error=unauthorized"); 
  }

  const userName = profile.first_name || 'Teacher';

  const [activeClasses, recentlyGraded, upcomingDeadlines, studentPerformance] = await Promise.all([
    getActiveClassesData(supabase, user.id),
    getRecentlyGradedData(supabase, user.id),
    getUpcomingDeadlinesData(supabase, user.id),
    getStudentPerformanceData(supabase, user.id)
  ]);
  // Note: Error handling for individual data fetches can be added here if needed, 
  // or keep as is if minor errors in one section shouldn't block the page.

  return (
    <div className="container mx-auto p-4 md:p-6 lg:p-8 space-y-6 md:space-y-8">
      <WelcomeCard userName={userName} userRole={profile.role} />

      {/* Bento Grid Layout */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 md:gap-8">
        
        {/* Card 1: Your Active Classes (Spans 2 columns on lg) */}
        <div className="lg:col-span-2 bg-card p-4 md:p-6 rounded-lg shadow">
          <h2 id="active-classes-heading" className="text-xl font-semibold mb-4 flex items-center">
            <BookOpenCheck className="mr-3 h-6 w-6 text-primary" />
            Your Active Classes
          </h2>
          {/* Error/Empty state handling for activeClasses can go here if activeClassesError was fetched */}
          {activeClasses.length === 0 && (
            <Alert>
              <Info className="h-4 w-4" />
              <AlertTitle>No Active Classes</AlertTitle>
              <AlertDescription>
                You are not currently teaching any active classes. Create them in 'Base Classes' and 'Class Instances'.
              </AlertDescription>
            </Alert>
          )}
          {activeClasses.length > 0 && (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {activeClasses.map((course) => (
                <ActiveClassItem
                  key={course.id}
                  id={course.id}
                  name={course.name}
                  baseClassName={course.baseClassName}
                  studentCount={course.studentCount}
                  manageClassUrl={course.manageClassUrl}
                />
              ))}
            </div>
          )}
        </div>

        {/* Card 2: Upcoming Deadlines (Spans 1 column on lg) */}
        <div className="lg:col-span-1 bg-card p-4 md:p-6 rounded-lg shadow">
          <h2 id="upcoming-deadlines-heading" className="text-xl font-semibold mb-4 flex items-center">
            <CalendarClock className="mr-3 h-6 w-6 text-primary" />
            Upcoming Deadlines
          </h2>
          {upcomingDeadlines.length === 0 && (
            <Alert>
              <Info className="h-4 w-4" />
              <AlertTitle>No Upcoming Deadlines</AlertTitle>
              <AlertDescription>
                No deadlines in the next 30 days, or schema update needed for live data.
              </AlertDescription>
            </Alert>
          )}
          {upcomingDeadlines.length > 0 && (
            <div className="space-y-3">
              {upcomingDeadlines.map((item) => (
                <UpcomingDeadlineItem
                  key={item.id}
                  id={item.id}
                  assignmentName={item.assignmentName}
                  className={item.className}
                  dueDate={item.dueDate}
                  detailsUrl={item.detailsUrl}
                />
              ))}
            </div>
          )}
          <p className="mt-2 text-xs text-muted-foreground">
            Note: Deadline data is currently illustrative.
          </p>
        </div>

        {/* Card 3: Recently Graded Assignments (Spans 2 columns on lg) */}
        <div className="lg:col-span-2 bg-card p-4 md:p-6 rounded-lg shadow">
          <h2 id="graded-assignments-heading" className="text-xl font-semibold mb-4 flex items-center">
            <ClipboardCheck className="mr-3 h-6 w-6 text-primary" />
            Recently Graded
          </h2>
          {recentlyGraded.length === 0 && (
            <Alert>
              <Info className="h-4 w-4" />
              <AlertTitle>No Recently Graded Assignments</AlertTitle>
              <AlertDescription>
                No assignments have been graded recently.
              </AlertDescription>
            </Alert>
          )}
          {recentlyGraded.length > 0 && (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {recentlyGraded.map((item) => (
                <RecentlyGradedItem
                  key={item.submissionId}
                  submissionId={item.submissionId}
                  assignmentName={item.assignmentName}
                  studentName={item.studentName}
                  studentInitials={item.studentInitials}
                  score={item.score}
                  maxScore={item.maxScore}
                  gradedAt={item.gradedAt}
                  viewSubmissionUrl={item.viewSubmissionUrl}
                />
              ))}
            </div>
          )}
        </div>
        
        {/* Card 4: Student Performance Overview (Spans 1 column on lg) */}
        <div className="lg:col-span-1 bg-card p-4 md:p-6 rounded-lg shadow">
          <h2 id="student-performance-heading" className="text-xl font-semibold mb-4 flex items-center">
            <Users className="mr-3 h-6 w-6 text-primary" />
            Student Performance
          </h2>
          {studentPerformance.length === 0 && (
            <Alert>
              <Info className="h-4 w-4" />
              <AlertTitle>Performance Data Not Available</AlertTitle>
              <AlertDescription>
                Aggregated student performance data is not yet available.
              </AlertDescription>
            </Alert>
          )}
          {studentPerformance.length > 0 && (
            <div className="space-y-3">
              {studentPerformance.map((item) => (
                <StudentPerformanceItem
                  key={item.id}
                  id={item.id}
                  name={item.name}
                  studentCount={item.studentCount}
                  averageScore={item.averageScore}
                  studentsAtRiskCount={item.studentsAtRiskCount}
                  detailsUrl={item.detailsUrl}
                />
              ))}
            </div>
          )}
           <p className="mt-2 text-xs text-muted-foreground">
            Note: Performance data is currently illustrative.
          </p>
        </div>

      </div>
    </div>
  );
} 