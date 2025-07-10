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

// TODO: Replace with real data fetching based on quiz_attempts, progress, and rosters tables
async function getRecentStudentActivity(supabase: any, userId: string): Promise<RecentActivityData[]> {
  // Mock data for now - in real implementation, this would query:
  // - quiz_attempts with completed_at in last 24-48 hours
  // - progress table for recent lesson completions  
  // - overdue assignments based on class instance settings
  return [
    {
      type: 'quiz_submission',
      studentName: 'Alice Johnson',
      className: 'Mathematics 101',
      description: 'Completed Chapter 3 Quiz with 85%',
      timeAgo: '2 hours ago',
      actionUrl: '/teach/gradebook'
    },
    {
      type: 'lesson_completion',
      studentName: 'Bob Smith',
      className: 'Science Fundamentals',
      description: 'Finished Lesson: Introduction to Physics',
      timeAgo: '4 hours ago'
    },
    {
      type: 'late_submission',
      studentName: 'Carol Davis',
      className: 'Mathematics 101',
      description: 'Late submission for Chapter 2 Assignment',
      timeAgo: '6 hours ago',
      actionUrl: '/teach/gradebook'
    }
  ];
}

// TODO: Replace with real data fetching based on class performance analytics
async function getClassesNeedingAttention(supabase: any, userId: string): Promise<ClassAttentionData[]> {
  // Mock data for now - in real implementation, this would analyze:
  // - Students with low quiz scores or incomplete lessons
  // - Ungraded assignments based on quiz_attempts
  // - Students who haven't been active recently
  return [
    {
      id: '1',
      className: 'Mathematics 101',
      issue: '3 students falling behind',
      priority: 'High',
      actionUrl: '/teach/gradebook'
    },
    {
      id: '2', 
      className: 'Science Fundamentals',
      issue: '5 ungraded assignments',
      priority: 'Medium',
      actionUrl: '/teach/gradebook'
    }
  ];
}

// TODO: Replace with real data fetching based on aggregated class and student data
async function getTeachingProgress(supabase: any, userId: string): Promise<TeachingProgressData> {
  // Mock data for now - in real implementation, this would aggregate:
  // - Total students across all teacher's class instances
  // - Lessons created in the lessons table
  // - Average performance from quiz_attempts
  // - Pending reviews from ungraded quiz_attempts
  return {
    totalStudents: 127,
    lessonsCreated: 45,
    lessonsThisWeek: 3,
    averagePerformance: 78,
    pendingReviews: 12
  };
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