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
  Plus,
  AlertCircle,
  TrendingUp,
  Clock,
  CheckCircle,
  UserPlus,
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
        ),
        rosters(id)
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
      enrolledStudents: instance.rosters?.length || 0,
      pathsCount,
      lessonsCount,
      quizzesCount: 0, // TODO: Calculate from lessons
    };
  } catch (error) {
    console.error('Error fetching class instance data:', error);
    return null;
  }
}

async function getStudentPerformance(instanceId: string, supabase: any): Promise<StudentPerformance[]> {
  // Mock data for now - replace with real queries
  return [
    {
      id: "1",
      name: "Alice Johnson",
      email: "alice.johnson@school.edu",
      enrolledAt: "2024-01-15T09:00:00Z",
      lastActivity: "2024-01-20T14:30:00Z",
      overallProgress: 85,
      quizAverage: 92,
      status: "active"
    },
    {
      id: "2", 
      name: "Bob Smith",
      email: "bob.smith@school.edu",
      enrolledAt: "2024-01-15T09:00:00Z",
      lastActivity: "2024-01-18T10:15:00Z",
      overallProgress: 45,
      quizAverage: 78,
      status: "falling_behind"
    },
    {
      id: "3",
      name: "Carol Davis", 
      email: "carol.davis@school.edu",
      enrolledAt: "2024-01-15T09:00:00Z",
      lastActivity: "2024-01-16T16:45:00Z",
      overallProgress: 15,
      status: "inactive"
    }
  ];
}

async function getRecentActivity(instanceId: string, supabase: any): Promise<RecentActivity[]> {
  // Mock data for now - replace with real queries
  return [
    {
      id: "1",
      type: "quiz_submission",
      description: "Completed 'Chapter 3 Quiz' with 95%",
      studentName: "Alice Johnson",
      timestamp: "2024-01-20T14:30:00Z"
    },
    {
      id: "2",
      type: "lesson_completion", 
      description: "Finished 'Introduction to Variables'",
      studentName: "Bob Smith",
      timestamp: "2024-01-20T11:15:00Z"
    },
    {
      id: "3",
      type: "student_joined",
      description: "New student enrolled in class",
      studentName: "David Wilson",
      timestamp: "2024-01-20T09:45:00Z"
    }
  ];
}

async function getClassStats(instanceId: string, supabase: any): Promise<ClassStats> {
  // Mock data for now - replace with real calculations
  return {
    totalStudents: 15,
    averageProgress: 67,
    lessonsCompleted: 234,
    pendingQuizzes: 8,
    activeToday: 12
  };
}

export default async function ClassInstancePage({ 
  params 
}: { 
  params: { instanceId: string } 
}) {
  const supabase = createSupabaseServerClient();
  const { data: { user }, error: authError } = await supabase.auth.getUser();

  if (authError || !user) {
    redirect("/login?error=auth");
  }

  const { data: profile, error: profileError } = await supabase
    .from('profiles')
    .select('user_id, first_name, last_name, role')
    .eq('user_id', user.id)
    .single();

  if (profileError || !profile || profile.role !== 'teacher') {
    redirect("/dashboard?error=unauthorized");
  }

  const classInstance = await getClassInstanceData(params.instanceId, supabase);
  
  if (!classInstance) {
    notFound();
  }

  const [studentPerformance, recentActivity, classStats] = await Promise.all([
    getStudentPerformance(params.instanceId, supabase),
    getRecentActivity(params.instanceId, supabase),
    getClassStats(params.instanceId, supabase)
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
                  <Link href={`/teach/instances/${classInstance.id}/students/add`}>
                    <UserPlus className="w-4 h-4 mr-2" />
                    Add Students
                  </Link>
                </Button>
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
                        {activity.type === 'student_joined' && <UserPlus className="h-4 w-4 text-primary" />}
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
              <p className="text-muted-foreground">Monitor and manage your enrolled students</p>
            </div>
            <Button asChild>
              <Link href={`/teach/instances/${classInstance.id}/students/add`}>
                <Plus className="w-4 h-4 mr-2" />
                Add Student
              </Link>
            </Button>
          </div>

          <Card>
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
        </TabsContent>

        <TabsContent value="progress" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Class Progress Analytics</CardTitle>
              <CardDescription>
                Detailed insights into student performance and engagement
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="text-center py-12 text-muted-foreground">
                <BarChart3 className="h-12 w-12 mx-auto mb-4 opacity-50" />
                <p>Progress analytics coming soon</p>
                <p className="text-sm">Detailed charts and insights will be available here</p>
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
                      {activity.type === 'student_joined' && <UserPlus className="h-4 w-4 text-primary" />}
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