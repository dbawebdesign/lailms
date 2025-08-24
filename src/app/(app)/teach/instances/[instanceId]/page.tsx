import { createSupabaseServerClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import { notFound } from "next/navigation";
import { 
  BookOpen, 
  Users, 
  Settings, 
  Calendar, 
  BarChart3, 
  Copy, 
  ExternalLink,
  AlertCircle,
  TrendingUp,
  Clock,
  CheckCircle,
  MessageSquare,
  Target,
  Award
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Progress } from "@/components/ui/progress";
import Link from "next/link";
import { format } from "date-fns";
import { ClassInstanceHeader } from "@/components/teach/ClassInstanceHeader";
import { ClassInstanceStudentManager } from "@/components/teach/ClassInstanceStudentManager";
import { Tables } from "packages/types/db";
import { PROFILE_ROLE_FIELDS, hasTeacherPermissions } from "@/lib/utils/roleUtils";

interface ClassInstanceData {
  id: string;
  name: string;
  enrollmentCode: string;
  startDate?: string;
  endDate?: string;
  status: "active" | "archived" | "upcoming" | "completed";
  capacity?: number;
  period?: string;
  baseClass: {
    id: string;
    name: string;
    description?: string;
  };
  enrolledStudents: number;
  pathsCount: number;
  lessonsCount: number;
  quizzesCount: number;
}

interface StudentPerformance {
  id: string;
  name: string;
  email: string;
  enrolledAt: string;
  lastActivity?: string;
  overallProgress: number;
  quizAverage?: number;
  status: "active" | "falling_behind" | "inactive";
}

interface RecentActivity {
  id: string;
  type: "quiz_submission" | "lesson_completion" | "student_joined" | "assignment_due";
  description: string;
  studentName?: string;
  timestamp: string;
}

interface ClassStats {
  totalStudents: number;
  averageProgress: number;
  lessonsCompleted: number;
  pendingQuizzes: number;
  activeToday: number;
}

// Mock data functions - to be replaced with real API calls
async function getClassInstanceData(instanceId: string, supabase: any): Promise<ClassInstanceData | null> {
  try {
    const { data: instance, error } = await supabase
      .from('class_instances')
      .select(`
        id,
        name,
        enrollment_code,
        start_date,
        end_date,
        status,
        settings,
        base_classes!inner(
          id,
          name,
          description
        )
      `)
      .eq('id', instanceId)
      .single();

    if (error || !instance) {
      return null;
    }

    // Count paths and lessons for this base class
    const { data: paths } = await supabase
      .from('paths')
      .select('id, lessons(id)')
      .eq('base_class_id', instance.base_classes.id);

    const pathsCount = paths?.length || 0;
    const lessonsCount = paths?.reduce((total: number, path: any) => total + (path.lessons?.length || 0), 0) || 0;

    // Count assessments/quizzes for this base class
    const { count: quizzesCount } = await supabase
      .from('lesson_assessments')
      .select('id', { count: 'exact' })
      .in('lesson_id', paths?.flatMap((path: any) => path.lessons?.map((lesson: any) => lesson.id) || []) || []);

    // Count enrolled students from rosters table
    const { count: enrolledStudents, error: rosterError } = await supabase
      .from('rosters')
      .select('id', { count: 'exact' })
      .eq('class_instance_id', instanceId);

    if (rosterError) {
      console.error('Error fetching roster count:', rosterError);
    }

    return {
      id: instance.id,
      name: instance.name,
      enrollmentCode: instance.enrollment_code,
      startDate: instance.start_date,
      endDate: instance.end_date,
      status: instance.status,
      capacity: instance.settings?.capacity,
      period: instance.settings?.period,
      baseClass: {
        id: instance.base_classes.id,
        name: instance.base_classes.name,
        description: instance.base_classes.description,
      },
      enrolledStudents: enrolledStudents || 0,
      pathsCount,
      lessonsCount,
      quizzesCount: quizzesCount || 0,
    };
  } catch (error) {
    console.error('Error fetching class instance data:', error);
    return null;
  }
}

async function getStudentPerformance(instanceId: string, supabase: any): Promise<StudentPerformance[]> {
  try {
    // Get students enrolled in this class instance with email addresses using RPC
    const { data: studentsData, error: studentsError } = await supabase
      .rpc('get_class_instance_student_data', { p_class_instance_id: instanceId });

    if (studentsError || !studentsData) {
      console.error('Error fetching students:', studentsError);
      return [];
    }

    // Parse the JSON response
    const students = Array.isArray(studentsData) ? studentsData : [];

    // For each student, calculate their performance metrics
    const studentPerformance: StudentPerformance[] = [];

    for (const student of students) {
      const studentName = `${student.first_name || ''} ${student.last_name || ''}`.trim() || 'Unknown Student';
      const studentEmail = student.email || 'No email';

      // Get quiz attempts for this student
      const { data: quizAttempts } = await supabase
        .from('quiz_attempts')
        .select('score, max_score, created_at')
        .eq('user_id', student.id)
        .order('created_at', { ascending: false });

      // Calculate quiz average
      let quizAverage = 0;
      if (quizAttempts && quizAttempts.length > 0) {
        const totalScore = quizAttempts.reduce((sum: number, attempt: any) => sum + (attempt.score || 0), 0);
        const totalMaxScore = quizAttempts.reduce((sum: number, attempt: any) => sum + (attempt.max_score || 0), 0);
        quizAverage = totalMaxScore > 0 ? Math.round((totalScore / totalMaxScore) * 100) : 0;
      }

      // Get last activity (most recent quiz attempt or lesson progress)
      const lastActivity = quizAttempts?.[0]?.created_at || student.joined_at;

      // Calculate overall progress (this is a simplified calculation)
      // In a real implementation, you'd want to calculate based on completed lessons/paths
      const overallProgress = quizAverage; // Simplified for now

      // Determine status based on activity and performance
      let status: 'active' | 'falling_behind' | 'inactive' = 'active';
      const daysSinceLastActivity = Math.floor((Date.now() - new Date(lastActivity).getTime()) / (1000 * 60 * 60 * 24));
      
      if (daysSinceLastActivity > 7) {
        status = 'inactive';
      } else if (overallProgress < 60) {
        status = 'falling_behind';
      }

      studentPerformance.push({
        id: student.id,
        name: studentName,
        email: studentEmail,
        enrolledAt: student.joined_at,
        lastActivity,
        overallProgress,
        quizAverage,
        status
      });
    }

    return studentPerformance;
  } catch (error) {
    console.error('Error fetching student performance:', error);
    return [];
  }
}

async function getRecentActivity(instanceId: string, supabase: any): Promise<RecentActivity[]> {
  try {
    const activities: RecentActivity[] = [];

    // Get recent quiz submissions
    const { data: quizAttempts } = await supabase
      .from('quiz_attempts')
      .select(`
        id,
        score,
        max_score,
        created_at,
        profiles!inner(first_name, last_name),
        lesson_questions!inner(
          lessons!inner(title)
        )
      `)
      .eq('lesson_questions.lessons.class_instance_id', instanceId)
      .order('created_at', { ascending: false })
      .limit(10);

    if (quizAttempts) {
      for (const attempt of quizAttempts) {
        const user = attempt.profiles;
        const studentName = `${user.first_name || ''} ${user.last_name || ''}`.trim() || 'Unknown Student';
        const lessonTitle = attempt.lesson_questions?.lessons?.title || 'Unknown Lesson';
        const percentage = attempt.max_score > 0 ? Math.round((attempt.score / attempt.max_score) * 100) : 0;

        activities.push({
          id: `quiz-${attempt.id}`,
          type: "quiz_submission",
          description: `Completed '${lessonTitle}' with ${percentage}%`,
          studentName,
          timestamp: attempt.created_at
        });
      }
    }

    // Get recent enrollments
    const { data: recentEnrollments } = await supabase
      .from('rosters')
      .select(`
        id,
        joined_at,
        profiles!inner(first_name, last_name)
      `)
      .eq('class_instance_id', instanceId)
      .order('joined_at', { ascending: false })
      .limit(5);

    if (recentEnrollments) {
      for (const enrollment of recentEnrollments) {
        const user = enrollment.profiles;
        const studentName = `${user.first_name || ''} ${user.last_name || ''}`.trim() || 'Unknown Student';

        activities.push({
          id: `enrollment-${enrollment.id}`,
          type: "student_joined",
          description: "New student enrolled in class",
          studentName,
          timestamp: enrollment.joined_at
        });
      }
    }

    // Sort all activities by timestamp (most recent first)
    activities.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());

    return activities.slice(0, 10); // Return top 10 most recent activities
  } catch (error) {
    console.error('Error fetching recent activity:', error);
    return [];
  }
}

async function getClassStats(instanceId: string, supabase: any): Promise<ClassStats> {
  try {
    // Get total students enrolled with their user_ids
    const { data: rosters, count: totalStudents } = await supabase
      .from('rosters')
      .select(`
        id,
        profiles!inner(user_id)
      `, { count: 'exact' })
      .eq('class_instance_id', instanceId);

    // Extract user_ids from the rosters data
    const userIds = rosters?.map((r: any) => r.profiles.user_id) || [];

    // Get students active today (who have quiz attempts today)
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const { count: activeTodayCount } = await supabase
      .from('quiz_attempts')
      .select('user_id', { count: 'exact' })
      .gte('created_at', today.toISOString())
      .in('user_id', userIds);

    // Get all quiz attempts for students in this class to calculate average progress
    const { data: allQuizAttempts } = await supabase
      .from('quiz_attempts')
      .select('score, max_score, user_id')
      .in('user_id', userIds);

    // Calculate average progress
    let averageProgress = 0;
    if (allQuizAttempts && allQuizAttempts.length > 0) {
      const totalScore = allQuizAttempts.reduce((sum: number, attempt: any) => sum + (attempt.score || 0), 0);
      const totalMaxScore = allQuizAttempts.reduce((sum: number, attempt: any) => sum + (attempt.max_score || 0), 0);
      averageProgress = totalMaxScore > 0 ? Math.round((totalScore / totalMaxScore) * 100) : 0;
    }

    // Get lessons completed count (simplified - count of quiz attempts)
    const { count: lessonsCompleted } = await supabase
      .from('quiz_attempts')
      .select('id', { count: 'exact' })
      .in('user_id', userIds);

    // Get pending quizzes (this is a simplified calculation)
    // In a real implementation, you'd want to calculate based on assigned vs completed assessments
    const pendingQuizzes = Math.max(0, (totalStudents || 0) * 2 - (lessonsCompleted || 0));

    return {
      totalStudents: totalStudents || 0,
      averageProgress,
      lessonsCompleted: lessonsCompleted || 0,
      pendingQuizzes,
      activeToday: activeTodayCount || 0
    };
  } catch (error) {
    console.error('Error fetching class stats:', error);
    return {
      totalStudents: 0,
      averageProgress: 0,
      lessonsCompleted: 0,
      pendingQuizzes: 0,
      activeToday: 0
    };
  }
}

export default async function ClassInstancePage({ 
  params 
}: { 
  params: Promise<{ instanceId: string }> 
}) {
  const { instanceId } = await params;
  const supabase = createSupabaseServerClient();
  const { data: { user }, error: authError } = await supabase.auth.getUser();

  if (authError || !user) {
    redirect("/login?error=auth");
  }

  const { data: profile, error: profileError } = await supabase
    .from('profiles')
    .select(`${PROFILE_ROLE_FIELDS}, user_id, first_name, last_name`)
    .eq('user_id', user.id)
    .single<Tables<"profiles">>();

  if (profileError || !profile) {
    redirect("/dashboard?error=unauthorized");
  }

  // Check if user has teacher permissions using centralized role checking
  if (!hasTeacherPermissions(profile)) {
    redirect("/dashboard?error=unauthorized");
  }

  const classInstance = await getClassInstanceData(instanceId, supabase);
  
  if (!classInstance) {
    notFound();
  }

  const [studentPerformance, recentActivity, classStats] = await Promise.all([
    getStudentPerformance(instanceId, supabase),
    getRecentActivity(instanceId, supabase),
    getClassStats(instanceId, supabase)
  ]);

  const getStudentStatusColor = (status: string) => {
    switch (status) {
      case "active": return "bg-success/10 text-success";
      case "falling_behind": return "bg-warning/10 text-warning";
      case "inactive": return "bg-destructive/10 text-destructive";
      default: return "bg-muted/10 text-muted-foreground";
    }
  };

  return (
    <div className="container mx-auto p-4 md:p-6 lg:p-8 space-y-6 md:space-y-8">
      {/* Header Section */}
      <ClassInstanceHeader classInstance={classInstance} />

      {/* Quick Stats Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 md:gap-6">
        <Card>
          <CardContent className="p-4 md:p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Total Students</p>
                <p className="text-2xl font-bold text-foreground">{classStats.totalStudents}</p>
                <p className="text-xs text-muted-foreground">
                  {classInstance.capacity ? `of ${classInstance.capacity} capacity` : 'No limit set'}
                </p>
              </div>
              <Users className="h-8 w-8 text-muted-foreground" />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4 md:p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Avg Progress</p>
                <p className="text-2xl font-bold text-foreground">{classStats.averageProgress}%</p>
                <p className="text-xs text-success">Across all lessons</p>
              </div>
              <TrendingUp className="h-8 w-8 text-muted-foreground" />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4 md:p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Active Today</p>
                <p className="text-2xl font-bold text-foreground">{classStats.activeToday}</p>
                <p className="text-xs text-muted-foreground">Students online</p>
              </div>
              <CheckCircle className="h-8 w-8 text-muted-foreground" />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4 md:p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Pending Reviews</p>
                <p className="text-2xl font-bold text-foreground">{classStats.pendingQuizzes}</p>
                <p className="text-xs text-warning">Assignments to grade</p>
              </div>
              <Target className="h-8 w-8 text-muted-foreground" />
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Main Content Tabs */}
      <Tabs defaultValue="overview" className="space-y-6">
        <TabsList className="grid w-full grid-cols-4">
          <TabsTrigger value="overview">Overview</TabsTrigger>
          <TabsTrigger value="students">Students</TabsTrigger>
          <TabsTrigger value="progress">Progress</TabsTrigger>
          <TabsTrigger value="activity">Activity</TabsTrigger>
        </TabsList>

        <TabsContent value="overview" className="space-y-6">
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* Class Information */}
            <Card className="lg:col-span-2">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <BookOpen className="h-5 w-5" />
                  Class Information
                </CardTitle>
                <CardDescription>
                  Overview of your class structure and timeline
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="text-sm font-medium text-muted-foreground">Course</label>
                    <p className="font-semibold">{classInstance.baseClass.name}</p>
                    {classInstance.baseClass.description && (
                      <p className="text-sm text-muted-foreground mt-1">
                        {classInstance.baseClass.description}
                      </p>
                    )}
                  </div>
                  
                  <div>
                    <label className="text-sm font-medium text-muted-foreground">Duration</label>
                    <p className="font-semibold">
                      {classInstance.startDate && classInstance.endDate ? (
                        <>
                          {format(new Date(classInstance.startDate), 'MMM d')} - {format(new Date(classInstance.endDate), 'MMM d, yyyy')}
                        </>
                      ) : (
                        'No dates set'
                      )}
                    </p>
                  </div>
                </div>

                <div className="pt-4 border-t">
                  <div className="grid grid-cols-3 gap-4 text-center">
                    <div>
                      <p className="text-2xl font-bold text-primary">{classInstance.pathsCount}</p>
                      <p className="text-sm text-muted-foreground">Learning Paths</p>
                    </div>
                    <div>
                      <p className="text-2xl font-bold text-primary">{classInstance.lessonsCount}</p>
                      <p className="text-sm text-muted-foreground">Lessons</p>
                    </div>
                    <div>
                      <p className="text-2xl font-bold text-primary">{classInstance.quizzesCount}</p>
                      <p className="text-sm text-muted-foreground">Assessments</p>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Quick Actions */}
            <Card>
              <CardHeader>
                <CardTitle>Quick Actions</CardTitle>
                <CardDescription>
                  Common management tasks
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-3">
                <Button asChild className="w-full justify-start" variant="outline">
                  <Link href={`/teach/gradebook?instance=${classInstance.id}`}>
                    <BarChart3 className="w-4 h-4 mr-2" />
                    View Gradebook
                  </Link>
                </Button>
                <Button asChild className="w-full justify-start" variant="outline">
                  <Link href={`/teach/instances/${classInstance.id}/announcements`}>
                    <MessageSquare className="w-4 h-4 mr-2" />
                    Send Announcement
                  </Link>
                </Button>
                <Button asChild className="w-full justify-start" variant="outline">
                  <Link href={`/teach/instances/${classInstance.id}/reports`}>
                    <Award className="w-4 h-4 mr-2" />
                    View Reports
                  </Link>
                </Button>
              </CardContent>
            </Card>
          </div>

          {/* Recent Activity */}
          <Card>
            <CardHeader>
              <CardTitle>Recent Activity</CardTitle>
              <CardDescription>
                Latest student interactions and submissions
              </CardDescription>
            </CardHeader>
            <CardContent>
              {recentActivity.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground">
                  No recent activity to display
                </div>
              ) : (
                <div className="space-y-4">
                  {recentActivity.slice(0, 5).map((activity) => (
                    <div key={activity.id} className="flex items-center gap-3 p-3 bg-muted/30 rounded-lg">
                      <div className={`p-2 rounded-lg ${
                        activity.type === 'quiz_submission' ? 'bg-success/10' :
                        activity.type === 'lesson_completion' ? 'bg-info/10' :
                        activity.type === 'student_joined' ? 'bg-primary/10' :
                        'bg-muted/50'
                      }`}>
                        {activity.type === 'quiz_submission' && <Target className="h-4 w-4 text-success" />}
                        {activity.type === 'lesson_completion' && <CheckCircle className="h-4 w-4 text-info" />}
                        {activity.type === 'student_joined' && <MessageSquare className="h-4 w-4 text-primary" />}
                        {activity.type === 'assignment_due' && <AlertCircle className="h-4 w-4 text-warning" />}
                      </div>
                      <div className="flex-1">
                        <p className="font-medium text-sm">
                          {activity.studentName && `${activity.studentName} - `}{activity.description}
                        </p>
                        <p className="text-xs text-muted-foreground">
                          {format(new Date(activity.timestamp), 'MMM d, h:mm a')}
                        </p>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="students" className="space-y-6">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-lg font-semibold">Student Management</h3>
              <p className="text-muted-foreground">Add family students or monitor enrolled students</p>
            </div>
            <div className="flex items-center gap-2 p-3 bg-muted/30 rounded-lg border">
              <span className="text-sm text-muted-foreground">Legacy enrollment code:</span>
              <code className="font-mono text-sm font-semibold">{classInstance.enrollmentCode}</code>
            </div>
          </div>

          {/* Family Student Management */}
          <ClassInstanceStudentManager classInstanceId={classInstance.id} />

          {/* Student Performance Overview */}
          {studentPerformance.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle>Student Performance Overview</CardTitle>
                <CardDescription>
                  Monitor progress and activity for enrolled students
                </CardDescription>
              </CardHeader>
              <CardContent className="p-0">
                <div className="divide-y">
                  {studentPerformance.map((student) => (
                    <div key={student.id} className="p-4 md:p-6 space-y-3">
                      <div className="flex items-center justify-between">
                        <div className="space-y-1">
                          <h4 className="font-semibold">{student.name}</h4>
                          <p className="text-sm text-muted-foreground">{student.email}</p>
                          <div className="flex items-center gap-2">
                            <Badge 
                              variant="secondary" 
                              className={`text-xs ${getStudentStatusColor(student.status)}`}
                            >
                              {student.status.replace('_', ' ')}
                            </Badge>
                            {student.lastActivity && (
                              <span className="text-xs text-muted-foreground">
                                Last active: {format(new Date(student.lastActivity), 'MMM d')}
                              </span>
                            )}
                          </div>
                        </div>
                        <div className="text-right space-y-2">
                          <div>
                            <p className="text-sm text-muted-foreground">Overall Progress</p>
                            <div className="flex items-center gap-2">
                              <Progress value={student.overallProgress} className="w-20" />
                              <span className="text-sm font-medium">{student.overallProgress}%</span>
                            </div>
                          </div>
                          {student.quizAverage && (
                            <div>
                              <p className="text-sm text-muted-foreground">Quiz Average</p>
                              <p className="text-sm font-medium">{student.quizAverage}%</p>
                            </div>
                          )}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}
        </TabsContent>

        <TabsContent value="progress" className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* Overall Class Performance */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <TrendingUp className="h-5 w-5" />
                  Class Performance
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-2">
                  <div className="flex justify-between text-sm">
                    <span>Average Progress</span>
                    <span className="font-medium">{classStats.averageProgress}%</span>
                  </div>
                  <Progress value={classStats.averageProgress} className="h-2" />
                </div>
                <div className="grid grid-cols-2 gap-4 text-center">
                  <div>
                    <p className="text-2xl font-bold text-success">{studentPerformance.filter(s => s.status === 'active').length}</p>
                    <p className="text-sm text-muted-foreground">Active Students</p>
                  </div>
                  <div>
                    <p className="text-2xl font-bold text-warning">{studentPerformance.filter(s => s.status === 'falling_behind').length}</p>
                    <p className="text-sm text-muted-foreground">Need Support</p>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Activity Summary */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Clock className="h-5 w-5" />
                  Activity Summary
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-2 gap-4 text-center">
                  <div>
                    <p className="text-2xl font-bold text-primary">{classStats.activeToday}</p>
                    <p className="text-sm text-muted-foreground">Active Today</p>
                  </div>
                  <div>
                    <p className="text-2xl font-bold text-info">{classStats.lessonsCompleted}</p>
                    <p className="text-sm text-muted-foreground">Lessons Completed</p>
                  </div>
                </div>
                <div className="pt-4 border-t">
                  <p className="text-sm text-muted-foreground mb-2">Recent Activity</p>
                  <div className="space-y-2">
                    {recentActivity.slice(0, 3).map((activity) => (
                      <div key={activity.id} className="flex items-center gap-2 text-sm">
                        <div className="w-2 h-2 bg-primary rounded-full"></div>
                        <span className="text-muted-foreground">{activity.description}</span>
                      </div>
                    ))}
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Student Progress Details */}
          <Card>
            <CardHeader>
              <CardTitle>Individual Student Progress</CardTitle>
              <CardDescription>
                Detailed view of each student's performance and engagement
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {studentPerformance.map((student) => (
                  <div key={student.id} className="flex items-center justify-between p-4 bg-muted/30 rounded-lg">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 bg-primary/10 rounded-full flex items-center justify-center">
                        <span className="text-sm font-medium text-primary">
                          {student.name.split(' ').map(n => n[0]).join('').toUpperCase()}
                        </span>
                      </div>
                      <div>
                        <p className="font-medium">{student.name}</p>
                        <p className="text-sm text-muted-foreground">
                          {student.lastActivity ? `Last active: ${format(new Date(student.lastActivity), 'MMM d')}` : 'No recent activity'}
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center gap-4">
                      <div className="text-right">
                        <p className="text-sm text-muted-foreground">Progress</p>
                        <div className="flex items-center gap-2">
                          <Progress value={student.overallProgress} className="w-20" />
                          <span className="text-sm font-medium">{student.overallProgress}%</span>
                        </div>
                      </div>
                      <Badge 
                        variant="secondary" 
                        className={`${getStudentStatusColor(student.status)}`}
                      >
                        {student.status.replace('_', ' ')}
                      </Badge>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="activity" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Activity Feed</CardTitle>
              <CardDescription>
                Complete history of student interactions and submissions
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {recentActivity.map((activity) => (
                  <div key={activity.id} className="flex items-start gap-3 p-4 bg-muted/30 rounded-lg">
                    <div className={`p-2 rounded-lg ${
                      activity.type === 'quiz_submission' ? 'bg-success/10' :
                      activity.type === 'lesson_completion' ? 'bg-info/10' :
                      activity.type === 'student_joined' ? 'bg-primary/10' :
                      'bg-muted/50'
                    }`}>
                      {activity.type === 'quiz_submission' && <Target className="h-4 w-4 text-success" />}
                      {activity.type === 'lesson_completion' && <CheckCircle className="h-4 w-4 text-info" />}
                      {activity.type === 'student_joined' && <MessageSquare className="h-4 w-4 text-primary" />}
                      {activity.type === 'assignment_due' && <AlertCircle className="h-4 w-4 text-warning" />}
                    </div>
                    <div className="flex-1 space-y-1">
                      <p className="font-medium">
                        {activity.studentName && <span className="text-primary">{activity.studentName}</span>}
                        {activity.studentName && ' - '}
                        {activity.description}
                      </p>
                      <p className="text-sm text-muted-foreground">
                        {format(new Date(activity.timestamp), 'EEEE, MMMM d, yyyy \'at\' h:mm a')}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
} 