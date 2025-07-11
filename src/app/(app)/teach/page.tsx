import { createSupabaseServerClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import WelcomeCard from "@/components/dashboard/WelcomeCard";
import { ActiveClassItem } from "@/components/dashboard/teacher/ActiveClassItem";
import CourseGenerationProgressWidget from "@/components/dashboard/CourseGenerationProgressWidget";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { BookOpenCheck, ClipboardCheck, AlertTriangle, Info, Users, Sparkles, Activity, TrendingUp, BookOpen, CheckCircle, Target, Eye, Lightbulb, Search } from 'lucide-react';
import { Button } from "@/components/ui/button";
import Link from "next/link";
import { Tables } from "packages/types/db";

interface ActiveClassData {
  id: string;
  name: string;
  baseClassName: string;
  studentCount: number;
  manageClassUrl: string;
}

interface RecentActivityData {
  type: 'quiz_submission' | 'lesson_completion' | 'late_submission';
  studentName: string;
  className: string;
  description: string;
  timeAgo: string;
  actionUrl?: string;
}

interface ClassAttentionData {
  id: string;
  className: string;
  issue: string;
  priority: 'High' | 'Medium' | 'Low';
  actionUrl?: string;
}

interface TeachingProgressData {
  totalStudents: number;
  lessonsCreated: number;
  lessonsThisWeek: number;
  averagePerformance: number;
  pendingReviews: number;
}

async function getActiveClassesData(supabase: ReturnType<typeof createSupabaseServerClient>, userId: string): Promise<ActiveClassData[]> {
  try {
    const { data, error } = await supabase.rpc('get_teacher_active_classes' as any, { p_user_id: userId });

    if (error) {
      console.error('Error fetching active classes:', error);
      return [];
    }

    // Map the database fields (snake_case) to the expected interface fields (camelCase)
    if (!Array.isArray(data)) {
      console.error('Expected array from get_teacher_active_classes but got:', typeof data);
      return [];
    }

    return data.map((item: any) => ({
      id: item.id,
      name: item.name,
      baseClassName: item.base_class_name,
      studentCount: item.student_count,
      manageClassUrl: item.manage_class_url
    }));
  } catch (error) {
    console.error('Error in getActiveClassesData:', error);
    return [];
  }
}

// Fetch real recent student activity data from Supabase
async function getRecentStudentActivity(supabase: any, userId: string): Promise<RecentActivityData[]> {
  try {
    // Get teacher's class instances
    const { data: classInstances } = await supabase
      .from('class_instances')
      .select(`
        id,
        name,
        base_classes!inner (
          id,
          name,
          user_id
        )
      `)
      .eq('base_classes.user_id', userId);

    if (!classInstances || classInstances.length === 0) {
      return [];
    }

    const classInstanceIds = classInstances.map((ci: any) => ci.id);
    const activities: RecentActivityData[] = [];

    // Get recent quiz attempts (last 48 hours)
    const twoDaysAgo = new Date();
    twoDaysAgo.setHours(twoDaysAgo.getHours() - 48);

    const { data: quizAttempts } = await supabase
      .from('quiz_attempts')
      .select(`
        id,
        score,
        max_score,
        completed_at,
        created_at,
        quiz_id,
        user_id,
        quizzes (
          title,
          lesson_sections (
            lessons (
              title,
              class_instance_id
            )
          )
        ),
        profiles (
          first_name,
          last_name
        )
      `)
      .gte('completed_at', twoDaysAgo.toISOString())
      .not('completed_at', 'is', null)
      .order('completed_at', { ascending: false })
      .limit(20);

    // Process quiz attempts
    if (quizAttempts) {
      for (const attempt of quizAttempts) {
        const classInstance = classInstances.find((ci: any) => 
          ci.id === attempt.quizzes?.lesson_sections?.lessons?.class_instance_id
        );
        
        if (classInstance) {
          const studentName = `${attempt.profiles?.first_name || ''} ${attempt.profiles?.last_name || ''}`.trim() || 'Unknown Student';
          const className = classInstance.name || classInstance.base_classes?.name || 'Unknown Class';
          const score = attempt.score && attempt.max_score ? Math.round((attempt.score / attempt.max_score) * 100) : 0;
          const timeAgo = getTimeAgo(attempt.completed_at);

          activities.push({
            type: 'quiz_submission',
            studentName,
            className,
            description: `Completed ${attempt.quizzes?.title || 'Quiz'} with ${score}%`,
            timeAgo,
            actionUrl: '/teach/gradebook'
          });
        }
      }
    }

    // Get recent lesson progress (last 48 hours)
    const { data: recentProgress } = await supabase
      .from('progress')
      .select(`
        id,
        updated_at,
        lesson_id,
        user_id,
        completion_percentage,
        lessons (
          title,
          class_instance_id
        ),
        profiles (
          first_name,
          last_name
        )
      `)
      .gte('updated_at', twoDaysAgo.toISOString())
      .eq('completion_percentage', 100)
      .in('lessons.class_instance_id', classInstanceIds)
      .order('updated_at', { ascending: false })
      .limit(15);

    // Process lesson completions
    if (recentProgress) {
      for (const progress of recentProgress) {
        const classInstance = classInstances.find((ci: any) => 
          ci.id === progress.lessons?.class_instance_id
        );
        
        if (classInstance) {
          const studentName = `${progress.profiles?.first_name || ''} ${progress.profiles?.last_name || ''}`.trim() || 'Unknown Student';
          const className = classInstance.name || classInstance.base_classes?.name || 'Unknown Class';
          const timeAgo = getTimeAgo(progress.updated_at);

          activities.push({
            type: 'lesson_completion',
            studentName,
            className,
            description: `Completed lesson: ${progress.lessons?.title || 'Unknown Lesson'}`,
            timeAgo
          });
        }
      }
    }

    // Get recent late submissions (assignments past due date)
    const { data: lateSubmissions } = await supabase
      .from('grades')
      .select(`
        id,
        created_at,
        assignment_id,
        user_id,
        assignments (
          name,
          due_date,
          class_instance_id
        ),
        profiles (
          first_name,
          last_name
        )
      `)
      .in('assignments.class_instance_id', classInstanceIds)
      .gte('created_at', twoDaysAgo.toISOString())
      .order('created_at', { ascending: false })
      .limit(10);

    // Process late submissions
    if (lateSubmissions) {
      for (const submission of lateSubmissions) {
        if (submission.assignments?.due_date) {
          const dueDate = new Date(submission.assignments.due_date);
          const submissionDate = new Date(submission.created_at);
          
          if (submissionDate > dueDate) {
            const classInstance = classInstances.find((ci: any) => 
              ci.id === submission.assignments?.class_instance_id
            );
            
            if (classInstance) {
              const studentName = `${submission.profiles?.first_name || ''} ${submission.profiles?.last_name || ''}`.trim() || 'Unknown Student';
              const className = classInstance.name || classInstance.base_classes?.name || 'Unknown Class';
              const timeAgo = getTimeAgo(submission.created_at);

              activities.push({
                type: 'late_submission',
                studentName,
                className,
                description: `Late submission for ${submission.assignments?.name || 'Assignment'}`,
                timeAgo,
                actionUrl: '/teach/gradebook'
              });
            }
          }
        }
      }
    }

    // Sort all activities by time and return the most recent ones
    return activities
      .sort((a, b) => {
        // Simple time comparison - in a real app you'd want to parse the timeAgo properly
        const timeOrder = ['minutes ago', 'hour ago', 'hours ago', 'day ago', 'days ago'];
        const aIndex = timeOrder.findIndex(t => a.timeAgo.includes(t));
        const bIndex = timeOrder.findIndex(t => b.timeAgo.includes(t));
        return aIndex - bIndex;
      })
      .slice(0, 10);

  } catch (error) {
    console.error('Error fetching recent student activity:', error);
    return [];
  }
}

// Helper function to calculate time ago
function getTimeAgo(dateString: string): string {
  const now = new Date();
  const date = new Date(dateString);
  const diffInMs = now.getTime() - date.getTime();
  const diffInMinutes = Math.floor(diffInMs / (1000 * 60));
  const diffInHours = Math.floor(diffInMinutes / 60);
  const diffInDays = Math.floor(diffInHours / 24);

  if (diffInMinutes < 60) {
    return `${diffInMinutes} minutes ago`;
  } else if (diffInHours < 24) {
    return diffInHours === 1 ? '1 hour ago' : `${diffInHours} hours ago`;
  } else {
    return diffInDays === 1 ? '1 day ago' : `${diffInDays} days ago`;
  }
}

// Fetch real data about classes needing attention
async function getClassesNeedingAttention(supabase: any, userId: string): Promise<ClassAttentionData[]> {
  try {
    // Get teacher's class instances
    const { data: classInstances } = await supabase
      .from('class_instances')
      .select(`
        id,
        name,
        base_classes!inner (
          id,
          name,
          user_id
        )
      `)
      .eq('base_classes.user_id', userId);

    if (!classInstances || classInstances.length === 0) {
      return [];
    }

    const classInstanceIds = classInstances.map((ci: any) => ci.id);
    const attentionItems: ClassAttentionData[] = [];

    // Check for students with low performance (average quiz score < 60%)
    for (const classInstance of classInstances) {
      // Get students in this class
      const { data: students } = await supabase
        .from('rosters')
        .select('profile_id')
        .eq('class_instance_id', classInstance.id)
        .eq('role', 'student');

      if (students && students.length > 0) {
        const studentIds = students.map((s: any) => s.profile_id);

        // Get quiz attempts for students in this class
        const { data: quizAttempts } = await supabase
          .from('quiz_attempts')
          .select('user_id, score, max_score')
          .in('user_id', studentIds);

        // Calculate students with low performance
        const studentPerformance = new Map();
        if (quizAttempts) {
          for (const attempt of quizAttempts) {
            if (!studentPerformance.has(attempt.user_id)) {
              studentPerformance.set(attempt.user_id, { totalScore: 0, totalMaxScore: 0 });
            }
            const perf = studentPerformance.get(attempt.user_id);
            perf.totalScore += attempt.score || 0;
            perf.totalMaxScore += attempt.max_score || 0;
          }
        }

        let lowPerformingStudents = 0;
        for (const [userId, perf] of studentPerformance) {
          const avgScore = perf.totalMaxScore > 0 ? (perf.totalScore / perf.totalMaxScore) * 100 : 0;
          if (avgScore < 60) {
            lowPerformingStudents++;
          }
        }

        if (lowPerformingStudents > 0) {
          const className = classInstance.name || classInstance.base_classes?.name || 'Unknown Class';
          attentionItems.push({
            id: classInstance.id,
            className,
            issue: `${lowPerformingStudents} student${lowPerformingStudents > 1 ? 's' : ''} falling behind`,
            priority: lowPerformingStudents >= 3 ? 'High' : 'Medium',
            actionUrl: `/teach/instances/${classInstance.id}`
          });
        }
      }
    }

    // Check for ungraded assignments
    const { data: assignments } = await supabase
      .from('assignments')
      .select(`
        id,
        name,
        class_instance_id,
        class_instances (
          name,
          base_classes (name)
        )
      `)
      .in('class_instance_id', classInstanceIds);

    if (assignments) {
      for (const assignment of assignments) {
        // Count pending grades for this assignment
        const { count: pendingGrades } = await supabase
          .from('grades')
          .select('id', { count: 'exact' })
          .eq('assignment_id', assignment.id)
          .eq('status', 'pending');

        if (pendingGrades && pendingGrades > 0) {
          const className = assignment.class_instances?.name || assignment.class_instances?.base_classes?.name || 'Unknown Class';
          
          // Check if we already have an item for this class
          const existingItem = attentionItems.find(item => item.className === className);
          if (existingItem) {
            // Update existing item to include ungraded assignments
            existingItem.issue += `, ${pendingGrades} ungraded assignment${pendingGrades > 1 ? 's' : ''}`;
            if (pendingGrades >= 10) {
              existingItem.priority = 'High';
            }
          } else {
            attentionItems.push({
              id: assignment.class_instance_id,
              className,
              issue: `${pendingGrades} ungraded assignment${pendingGrades > 1 ? 's' : ''}`,
              priority: pendingGrades >= 10 ? 'High' : pendingGrades >= 5 ? 'Medium' : 'Low',
              actionUrl: '/teach/gradebook'
            });
          }
        }
      }
    }

    // Check for students who haven't been active recently (no quiz attempts in last 7 days)
    const weekAgo = new Date();
    weekAgo.setDate(weekAgo.getDate() - 7);

    for (const classInstance of classInstances) {
      const { data: students } = await supabase
        .from('rosters')
        .select('profile_id')
        .eq('class_instance_id', classInstance.id)
        .eq('role', 'student');

      if (students && students.length > 0) {
        const studentIds = students.map((s: any) => s.profile_id);

        // Get students who have been active recently
        const { data: activeStudents } = await supabase
          .from('quiz_attempts')
          .select('user_id')
          .in('user_id', studentIds)
          .gte('created_at', weekAgo.toISOString());

        const activeStudentIds = new Set(activeStudents?.map((s: any) => s.user_id) || []);
                 const inactiveStudents = studentIds.filter((id: any) => !activeStudentIds.has(id));

        if (inactiveStudents.length > 0) {
          const className = classInstance.name || classInstance.base_classes?.name || 'Unknown Class';
          
          // Check if we already have an item for this class
          const existingItem = attentionItems.find(item => item.className === className);
          if (existingItem) {
            existingItem.issue += `, ${inactiveStudents.length} inactive student${inactiveStudents.length > 1 ? 's' : ''}`;
          } else {
            attentionItems.push({
              id: classInstance.id,
              className,
              issue: `${inactiveStudents.length} student${inactiveStudents.length > 1 ? 's' : ''} inactive for 7+ days`,
              priority: inactiveStudents.length >= 5 ? 'High' : 'Medium',
              actionUrl: `/teach/instances/${classInstance.id}`
            });
          }
        }
      }
    }

    // Sort by priority (High first, then Medium, then Low)
    return attentionItems.sort((a, b) => {
      const priorityOrder = { 'High': 0, 'Medium': 1, 'Low': 2 };
      return priorityOrder[a.priority] - priorityOrder[b.priority];
    });

  } catch (error) {
    console.error('Error fetching classes needing attention:', error);
    return [];
  }
}

// Fetch real teaching progress data from Supabase
async function getTeachingProgress(supabase: any, userId: string): Promise<TeachingProgressData> {
  try {
    // Get teacher's class instances through base_classes
    const { data: classInstances, error: classError } = await supabase
      .from('class_instances')
      .select(`
        id,
        name,
        base_classes!inner (
          id,
          name,
          user_id
        )
      `)
      .eq('base_classes.user_id', userId);

    if (classError) {
      console.error('Error fetching class instances:', classError);
      return { totalStudents: 0, lessonsCreated: 0, lessonsThisWeek: 0, averagePerformance: 0, pendingReviews: 0 };
    }

    const classInstanceIds = classInstances?.map((ci: any) => ci.id) || [];

    // Get total students across all teacher's class instances
    const { count: totalStudents } = await supabase
      .from('rosters')
      .select('id', { count: 'exact' })
      .in('class_instance_id', classInstanceIds)
      .eq('role', 'student');

    // Get lessons created by this teacher
    const { count: lessonsCreated } = await supabase
      .from('lessons')
      .select('id', { count: 'exact' })
      .eq('user_id', userId);

    // Get lessons created this week
    const weekAgo = new Date();
    weekAgo.setDate(weekAgo.getDate() - 7);
    const { count: lessonsThisWeek } = await supabase
      .from('lessons')
      .select('id', { count: 'exact' })
      .eq('user_id', userId)
      .gte('created_at', weekAgo.toISOString());

    // Get average performance from quiz attempts of students in teacher's classes
    let averagePerformance = 0;
    if (classInstanceIds.length > 0) {
      // First get all student IDs in teacher's classes
      const { data: studentRosters } = await supabase
        .from('rosters')
        .select('profile_id')
        .in('class_instance_id', classInstanceIds)
        .eq('role', 'student');

      const studentIds = studentRosters?.map((r: any) => r.profile_id) || [];

      if (studentIds.length > 0) {
        // Get quiz attempts for these students
        const { data: quizAttempts } = await supabase
          .from('quiz_attempts')
          .select('score, max_score')
          .in('user_id', studentIds);

        if (quizAttempts && quizAttempts.length > 0) {
          const totalScore = quizAttempts.reduce((sum: number, attempt: any) => sum + (attempt.score || 0), 0);
          const totalMaxScore = quizAttempts.reduce((sum: number, attempt: any) => sum + (attempt.max_score || 0), 0);
          averagePerformance = totalMaxScore > 0 ? Math.round((totalScore / totalMaxScore) * 100) : 0;
        }
      }
    }

    // Get pending reviews (ungraded quiz attempts)
    let pendingReviews = 0;
    if (classInstanceIds.length > 0) {
      // Get assignments for teacher's classes
      const { data: assignments } = await supabase
        .from('assignments')
        .select('id')
        .in('class_instance_id', classInstanceIds);

      const assignmentIds = assignments?.map((a: any) => a.id) || [];

      if (assignmentIds.length > 0) {
        // Count ungraded submissions
        const { count: ungraded } = await supabase
          .from('grades')
          .select('id', { count: 'exact' })
          .in('assignment_id', assignmentIds)
          .eq('status', 'pending');

        pendingReviews = ungraded || 0;
      }
    }

    return {
      totalStudents: totalStudents || 0,
      lessonsCreated: lessonsCreated || 0,
      lessonsThisWeek: lessonsThisWeek || 0,
      averagePerformance,
      pendingReviews
    };
  } catch (error) {
    console.error('Error fetching teaching progress:', error);
    return { totalStudents: 0, lessonsCreated: 0, lessonsThisWeek: 0, averagePerformance: 0, pendingReviews: 0 };
  }
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
    .single<Tables<"profiles">>();

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

  const [activeClasses, recentActivity, classesNeedingAttention, teachingProgress] = await Promise.all([
    getActiveClassesData(supabase, user.id),
    getRecentStudentActivity(supabase, user.id),
    getClassesNeedingAttention(supabase, user.id),
    getTeachingProgress(supabase, user.id)
  ]);

  return (
    <div className="container mx-auto p-4 md:p-6 lg:p-8 space-y-6 md:space-y-8">
      <WelcomeCard userName={userName} userRole={profile.role} />

      {/* Course Generation Progress Widget */}
      <CourseGenerationProgressWidget userId={user.id} />

      {/* Bento Grid Layout */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 md:gap-8">
        
        {/* Card 1: Your Active Classes (Spans 2 columns on lg) */}
        <div className="lg:col-span-2 bg-card p-4 md:p-6 rounded-lg shadow">
          <h2 id="active-classes-heading" className="text-xl font-semibold mb-4 flex items-center">
            <BookOpenCheck className="mr-3 h-6 w-6 text-primary" />
            Your Active Classes
          </h2>
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

        {/* Card 2: Quick Actions (Spans 1 column on lg) */}
        <div className="bg-card p-4 md:p-6 rounded-lg shadow">
          <h2 id="quick-actions-heading" className="text-xl font-semibold mb-4 flex items-center">
            <Sparkles className="mr-3 h-6 w-6 text-primary" />
            Quick Actions
          </h2>
            <div className="space-y-3">
            <Button asChild className="w-full justify-start" variant="outline">
              <Link href="/teach/knowledge-base/create">
                <BookOpen className="mr-2 h-4 w-4" />
                Create New Course
              </Link>
            </Button>
            <Button asChild className="w-full justify-start" variant="outline">
              <Link href="/teach/gradebook">
                <ClipboardCheck className="mr-2 h-4 w-4" />
                Grade Assignments
              </Link>
            </Button>
            <Button asChild className="w-full justify-start" variant="outline">
              <Link href="/teach/knowledge">
                <Search className="mr-2 h-4 w-4" />
                Search Knowledge
              </Link>
            </Button>
            </div>
        </div>

        {/* Card 3: Recent Student Activity (Spans 2 columns on lg) */}
        <div className="lg:col-span-2 bg-card p-4 md:p-6 rounded-lg shadow">
          <h2 id="recent-activity-heading" className="text-xl font-semibold mb-4 flex items-center">
            <Activity className="mr-3 h-6 w-6 text-primary" />
            Recent Student Activity
          </h2>
          {recentActivity.length === 0 && (
            <Alert>
              <Info className="h-4 w-4" />
              <AlertTitle>No Recent Activity</AlertTitle>
              <AlertDescription>
                No student submissions or quiz attempts in the last 24 hours.
              </AlertDescription>
            </Alert>
          )}
          {recentActivity.length > 0 && (
            <div className="space-y-3 max-h-64 overflow-y-auto">
              {recentActivity.map((activity, index) => (
                <div key={index} className="flex items-center gap-3 p-3 bg-background rounded-lg border border-muted">
                  <div className={`p-2 rounded-lg ${
                    activity.type === 'quiz_submission' ? 'bg-success/10' :
                    activity.type === 'lesson_completion' ? 'bg-info/10' :
                    activity.type === 'late_submission' ? 'bg-warning/10' : 'bg-muted/50'
                  }`}>
                    {activity.type === 'quiz_submission' && <Target className="h-4 w-4 text-success" />}
                    {activity.type === 'lesson_completion' && <CheckCircle className="h-4 w-4 text-info" />}
                    {activity.type === 'late_submission' && <AlertTriangle className="h-4 w-4 text-warning" />}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-foreground truncate">
                      {activity.studentName} - {activity.className}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {activity.description} • {activity.timeAgo}
                    </p>
                  </div>
                  {activity.actionUrl && (
                    <Button asChild size="sm" variant="ghost">
                      <Link href={activity.actionUrl}>
                        <Eye className="h-4 w-4" />
                      </Link>
                    </Button>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
        
        {/* Card 4: Classes Needing Attention (Spans 1 column on lg) */}
        <div className="bg-card p-4 md:p-6 rounded-lg shadow">
          <h2 id="attention-needed-heading" className="text-xl font-semibold mb-4 flex items-center">
            <AlertTriangle className="mr-3 h-6 w-6 text-warning" />
            Needs Attention
          </h2>
          {classesNeedingAttention.length === 0 && (
            <Alert>
              <CheckCircle className="h-4 w-4" />
              <AlertTitle>All Caught Up!</AlertTitle>
              <AlertDescription>
                No classes require immediate attention.
              </AlertDescription>
            </Alert>
          )}
          {classesNeedingAttention.length > 0 && (
            <div className="space-y-3">
              {classesNeedingAttention.map((item) => (
                <div key={item.id} className="p-3 bg-background rounded-lg border border-muted">
                  <h4 className="font-medium text-foreground text-sm">{item.className}</h4>
                  <p className="text-xs text-muted-foreground mt-1">{item.issue}</p>
                  <div className="flex items-center justify-between mt-2">
                    <span className="text-xs font-medium text-warning">{item.priority}</span>
                    {item.actionUrl && (
                      <Button asChild size="sm" variant="outline">
                        <Link href={item.actionUrl}>Review</Link>
                      </Button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Card 5: Teaching Progress & Insights (Spans 3 columns on lg) */}
        <div className="lg:col-span-3 bg-card p-4 md:p-6 rounded-lg shadow">
          <h2 id="teaching-progress-heading" className="text-xl font-semibold mb-4 flex items-center">
            <TrendingUp className="mr-3 h-6 w-6 text-primary" />
            Teaching Progress & Insights
          </h2>
          {teachingProgress && (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
              <div className="p-4 bg-background rounded-lg border border-muted">
                <div className="flex items-center justify-between">
                  <span className="text-sm text-muted-foreground">Total Students</span>
                  <Users className="h-4 w-4 text-muted-foreground" />
                </div>
                <p className="text-2xl font-bold text-foreground mt-1">{teachingProgress.totalStudents}</p>
                <p className="text-xs text-muted-foreground">Across all classes</p>
              </div>
              
              <div className="p-4 bg-background rounded-lg border border-muted">
                <div className="flex items-center justify-between">
                  <span className="text-sm text-muted-foreground">Lessons Created</span>
                  <BookOpen className="h-4 w-4 text-muted-foreground" />
                </div>
                <p className="text-2xl font-bold text-foreground mt-1">{teachingProgress.lessonsCreated}</p>
                <p className="text-xs text-success">+{teachingProgress.lessonsThisWeek} this week</p>
              </div>
              
              <div className="p-4 bg-background rounded-lg border border-muted">
                <div className="flex items-center justify-between">
                  <span className="text-sm text-muted-foreground">Avg Class Performance</span>
                  <TrendingUp className="h-4 w-4 text-muted-foreground" />
                </div>
                <p className="text-2xl font-bold text-foreground mt-1">{teachingProgress.averagePerformance}%</p>
                <p className="text-xs text-muted-foreground">Based on quiz scores</p>
              </div>
              
              <div className="p-4 bg-background rounded-lg border border-muted">
                <div className="flex items-center justify-between">
                  <span className="text-sm text-muted-foreground">Pending Reviews</span>
                  <ClipboardCheck className="h-4 w-4 text-muted-foreground" />
                </div>
                <p className="text-2xl font-bold text-foreground mt-1">{teachingProgress.pendingReviews}</p>
                <p className="text-xs text-muted-foreground">Assignments to grade</p>
              </div>
            </div>
          )}
        </div>

      </div>
    </div>
  );
} 