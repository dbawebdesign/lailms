'use client';

import { useEffect, useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Progress } from '@/components/ui/progress';
import { Separator } from '@/components/ui/separator';
import { createClient } from '@/lib/supabase/client';
import { useToast } from '@/components/ui/use-toast';
import { useClipboard } from '@/hooks/useClipboard';
import { 
  Users, 
  BookOpen, 
  TrendingUp, 
  Calendar,
  Search,
  RefreshCw,
  Settings,
  Bell,
  BarChart3,
  GraduationCap,
  Clock,
  CheckCircle,
  AlertCircle,
  UserPlus,
  Home,
  Shield
} from 'lucide-react';

interface Student {
  user_id: string;
  username: string;
  first_name: string;
  last_name: string;
  grade_level: string;
  role: string;
  created_at: string;
}

interface Course {
  id: string;
  name: string;
  base_class_name: string;
  start_date: string;
  end_date: string;
  status: string;
  enrolled_count: number;
}

interface ProgressData {
  user_id: string;
  item_type: string;
  item_id: string;
  status: string;
  progress_percentage: number;
  updated_at: string;
}

interface FamilyStats {
  totalStudents: number;
  activeCourses: number;
  completedLessons: number;
  averageProgress: number;
}

export default function HomeschoolFamilyAdminDashboard() {
  const [students, setStudents] = useState<Student[]>([]);
  const [courses, setCourses] = useState<Course[]>([]);
  const [progressData, setProgressData] = useState<ProgressData[]>([]);
  const [familyStats, setFamilyStats] = useState<FamilyStats>({
    totalStudents: 0,
    activeCourses: 0,
    completedLessons: 0,
    averageProgress: 0
  });
  const [searchTerm, setSearchTerm] = useState('');
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const { toast } = useToast();
  const { copy: copyToClipboard } = useClipboard();

  const supabase = createClient();

  const fetchData = async () => {
    try {
      setLoading(true);
      
      // Get current user
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        toast({
          title: "Authentication Error",
          description: "Please log in to access the dashboard.",
          variant: "destructive",
        });
        return;
      }

      // Get user's profile and organization info
      const { data: profile } = await supabase
        .from('profiles')
        .select(`
          *,
          organisation_units!inner(
            id,
            name,
            organisation_id,
            organisations!inner(
              id,
              name,
              organisation_type
            )
          )
        `)
        .eq('user_id', user.id)
        .single();

      if (!profile) {
        toast({
          title: "Profile Error",
          description: "Could not load profile information.",
          variant: "destructive",
        });
        return;
      }

      // Get students in the same family (organisation_unit)
      const { data: studentsData, error: studentsError } = await supabase
        .from('profiles')
        .select('*')
        .eq('organisation_unit_id', profile.organisation_unit_id)
        .eq('role', 'student')
        .order('first_name');

      if (studentsError) {
        console.error('Error fetching students:', studentsError);
        toast({
          title: "Error",
          description: "Failed to load students.",
          variant: "destructive",
        });
      } else {
        setStudents(studentsData || []);
      }

      // Get courses where this admin is the instructor
      const { data: coursesData, error: coursesError } = await supabase
        .from('class_instances')
        .select(`
          id,
          name,
          start_date,
          end_date,
          status,
          base_classes!inner(
            id,
            name,
            user_id
          )
        `)
        .eq('base_classes.user_id', user.id)
        .order('start_date', { ascending: false });

      if (coursesError) {
        console.error('Error fetching courses:', coursesError);
        toast({
          title: "Error",
          description: "Failed to load courses.",
          variant: "destructive",
        });
      } else {
        // Transform the data and get enrollment counts
        const transformedCourses = await Promise.all(
          (coursesData || []).map(async (course: any) => {
            // Get enrollment count by counting progress records for this class instance
            const { count: enrolledCount } = await supabase
              .from('progress')
              .select('*', { count: 'exact', head: true })
              .eq('item_type', 'class_instance')
              .eq('item_id', course.id);

            return {
              id: course.id,
              name: course.name,
              base_class_name: course.base_classes.name,
              start_date: course.start_date,
              end_date: course.end_date,
              status: course.status || 'active',
              enrolled_count: enrolledCount || 0
            };
          })
        );
        setCourses(transformedCourses);
      }

      // Get progress data for family students
      const studentIds = studentsData?.map(s => s.user_id) || [];
      if (studentIds.length > 0) {
        const { data: progressData, error: progressError } = await supabase
          .from('progress')
          .select('*')
          .in('user_id', studentIds)
          .order('updated_at', { ascending: false });

        if (progressError) {
          console.error('Error fetching progress:', progressError);
        } else {
          setProgressData(progressData || []);
        }
      }

      // Calculate family stats
      const totalStudents = studentsData?.length || 0;
      const activeCourses = coursesData?.filter(c => c.status !== 'completed').length || 0;
      const completedLessons = progressData?.filter(p => p.status === 'completed').length || 0;
      const averageProgress = progressData?.length > 0 
        ? Math.round(progressData.reduce((sum, p) => sum + (p.progress_percentage || 0), 0) / progressData.length)
        : 0;

      setFamilyStats({
        totalStudents,
        activeCourses,
        completedLessons,
        averageProgress
      });

    } catch (error) {
      console.error('Error fetching data:', error);
      toast({
        title: "Error",
        description: "Failed to load dashboard data.",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  const handleRefresh = async () => {
    setRefreshing(true);
    await fetchData();
  };

  const filteredStudents = students.filter(student =>
    `${student.first_name} ${student.last_name}`.toLowerCase().includes(searchTerm.toLowerCase()) ||
    student.username.toLowerCase().includes(searchTerm.toLowerCase()) ||
    student.grade_level?.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const filteredCourses = courses.filter(course =>
    course.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    course.base_class_name.toLowerCase().includes(searchTerm.toLowerCase())
  );

  if (loading) {
    return (
      <div className="container mx-auto px-6 py-8 space-y-8">
        <div className="flex items-center justify-center h-64">
          <RefreshCw className="h-8 w-8 animate-spin text-muted-foreground" />
        </div>
      </div>
    );
  }

  return (
    <div className="container mx-auto px-6 py-8 space-y-8">
      {/* Header */}
      <div className="flex justify-between items-start">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Family Dashboard</h1>
          <p className="text-muted-foreground">Manage your homeschool family's learning journey</p>
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={handleRefresh}
            disabled={refreshing}
          >
            <RefreshCw className={`h-4 w-4 mr-2 ${refreshing ? 'animate-spin' : ''}`} />
            Refresh
          </Button>
        </div>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <Card className="transition-all hover:shadow-lg">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Students</CardTitle>
            <Users className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{familyStats.totalStudents}</div>
            <p className="text-xs text-muted-foreground">
              Family members learning
            </p>
          </CardContent>
        </Card>

        <Card className="transition-all hover:shadow-lg">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Active Courses</CardTitle>
            <BookOpen className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{familyStats.activeCourses}</div>
            <p className="text-xs text-muted-foreground">
              Courses you're teaching
            </p>
          </CardContent>
        </Card>

        <Card className="transition-all hover:shadow-lg">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Completed Lessons</CardTitle>
            <CheckCircle className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{familyStats.completedLessons}</div>
            <p className="text-xs text-muted-foreground">
              Lessons finished
            </p>
          </CardContent>
        </Card>

        <Card className="transition-all hover:shadow-lg">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Average Progress</CardTitle>
            <TrendingUp className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{familyStats.averageProgress}%</div>
            <p className="text-xs text-muted-foreground">
              Overall completion rate
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Search */}
      <div className="flex items-center space-x-2">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search students, courses..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="pl-8"
          />
        </div>
      </div>

      {/* Main Content Tabs */}
      <Tabs defaultValue="overview" className="space-y-6">
        <TabsList className="grid w-full grid-cols-4">
          <TabsTrigger value="overview">Overview</TabsTrigger>
          <TabsTrigger value="students">Students</TabsTrigger>
          <TabsTrigger value="courses">Courses</TabsTrigger>
          <TabsTrigger value="settings">Settings</TabsTrigger>
        </TabsList>

        <TabsContent value="overview" className="space-y-6">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Recent Activity */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Clock className="h-5 w-5" />
                  Recent Activity
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  {progressData.slice(0, 5).map((progress) => {
                    const student = students.find(s => s.user_id === progress.user_id);
                    return (
                      <div key={`${progress.user_id}-${progress.item_id}`} className="flex items-center justify-between p-3 rounded-lg bg-muted/50">
                                                 <div className="flex items-center gap-3">
                           <div className="h-8 w-8 rounded-full bg-primary/10 flex items-center justify-center text-sm font-medium">
                             {student?.first_name?.[0]}{student?.last_name?.[0]}
                           </div>
                          <div>
                            <p className="text-sm font-medium">
                              {student?.first_name} {student?.last_name}
                            </p>
                            <p className="text-xs text-muted-foreground">
                              {progress.status === 'completed' ? 'Completed' : 'In Progress'}
                            </p>
                          </div>
                        </div>
                        <Badge variant={progress.status === 'completed' ? 'default' : 'secondary'}>
                          {progress.progress_percentage || 0}%
                        </Badge>
                      </div>
                    );
                  })}
                  {progressData.length === 0 && (
                    <p className="text-center text-muted-foreground py-8">
                      No recent activity to display
                    </p>
                  )}
                </div>
              </CardContent>
            </Card>

            {/* Quick Actions */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Settings className="h-5 w-5" />
                  Quick Actions
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-1 gap-3">
                  <Button variant="outline" className="justify-start h-auto p-4">
                    <GraduationCap className="h-5 w-5 mr-3" />
                    <div className="text-left">
                      <div className="font-medium">View Student Progress</div>
                      <div className="text-sm text-muted-foreground">Track learning milestones</div>
                    </div>
                  </Button>
                  <Button variant="outline" className="justify-start h-auto p-4">
                    <BookOpen className="h-5 w-5 mr-3" />
                    <div className="text-left">
                      <div className="font-medium">Manage Courses</div>
                      <div className="text-sm text-muted-foreground">Create and organize lessons</div>
                    </div>
                  </Button>
                  <Button variant="outline" className="justify-start h-auto p-4">
                    <BarChart3 className="h-5 w-5 mr-3" />
                    <div className="text-left">
                      <div className="font-medium">View Analytics</div>
                      <div className="text-sm text-muted-foreground">Detailed progress reports</div>
                    </div>
                  </Button>
                  <Button variant="outline" className="justify-start h-auto p-4">
                    <Shield className="h-5 w-5 mr-3" />
                    <div className="text-left">
                      <div className="font-medium">Privacy Settings</div>
                      <div className="text-sm text-muted-foreground">Manage family data</div>
                    </div>
                  </Button>
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        <TabsContent value="students" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Family Students</CardTitle>
              <CardDescription>
                Manage your children's learning progress and assignments
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {filteredStudents.map((student) => {
                  const studentProgress = progressData.filter(p => p.user_id === student.user_id);
                  const avgProgress = studentProgress.length > 0 
                    ? Math.round(studentProgress.reduce((sum, p) => sum + (p.progress_percentage || 0), 0) / studentProgress.length)
                    : 0;
                  
                  return (
                    <div key={student.user_id} className="flex items-center justify-between p-4 rounded-lg border bg-card hover:bg-accent/50 transition-colors">
                                             <div className="flex items-center gap-4">
                         <div className="h-12 w-12 rounded-full bg-primary/10 flex items-center justify-center text-lg font-medium">
                           {student.first_name?.[0]}{student.last_name?.[0]}
                         </div>
                        <div>
                          <h3 className="font-semibold">{student.first_name} {student.last_name}</h3>
                          <p className="text-sm text-muted-foreground">
                            Grade {student.grade_level} • @{student.username}
                          </p>
                        </div>
                      </div>
                      <div className="flex items-center gap-4">
                        <div className="text-right">
                          <div className="text-sm font-medium">{avgProgress}% Complete</div>
                          <div className="text-xs text-muted-foreground">
                            {studentProgress.length} activities
                          </div>
                        </div>
                        <Progress value={avgProgress} className="w-24" />
                        <Button variant="outline" size="sm">
                          View Details
                        </Button>
                      </div>
                    </div>
                  );
                })}
                {filteredStudents.length === 0 && (
                  <p className="text-center text-muted-foreground py-8">
                    No students found matching your search
                  </p>
                )}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="courses" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Your Courses</CardTitle>
              <CardDescription>
                Courses you're teaching to your family
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {filteredCourses.map((course) => (
                  <div key={course.id} className="flex items-center justify-between p-4 rounded-lg border bg-card hover:bg-accent/50 transition-colors">
                    <div className="flex items-center gap-4">
                      <div className="h-12 w-12 rounded-lg bg-primary/10 flex items-center justify-center">
                        <BookOpen className="h-6 w-6 text-primary" />
                      </div>
                      <div>
                        <h3 className="font-semibold">{course.name}</h3>
                        <p className="text-sm text-muted-foreground">{course.base_class_name}</p>
                        <div className="flex items-center gap-2 mt-1">
                          <Badge variant={course.status === 'active' ? 'default' : 'secondary'}>
                            {course.status}
                          </Badge>
                          <span className="text-xs text-muted-foreground">
                            {course.enrolled_count} enrolled
                          </span>
                        </div>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <Button variant="outline" size="sm">
                        Manage
                      </Button>
                    </div>
                  </div>
                ))}
                {filteredCourses.length === 0 && (
                  <p className="text-center text-muted-foreground py-8">
                    No courses found matching your search
                  </p>
                )}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="settings" className="space-y-6">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <Card>
              <CardHeader>
                <CardTitle>Family Settings</CardTitle>
                <CardDescription>
                  Configure your family's learning environment
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-2">
                  <label className="text-sm font-medium">Family Name</label>
                  <Input placeholder="The Smith Family" />
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-medium">Learning Schedule</label>
                  <Input placeholder="Monday - Friday, 9:00 AM - 3:00 PM" />
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-medium">Notification Preferences</label>
                  <div className="space-y-2">
                    <label className="flex items-center space-x-2">
                      <input type="checkbox" className="rounded" />
                      <span className="text-sm">Daily progress summaries</span>
                    </label>
                    <label className="flex items-center space-x-2">
                      <input type="checkbox" className="rounded" />
                      <span className="text-sm">Assignment reminders</span>
                    </label>
                    <label className="flex items-center space-x-2">
                      <input type="checkbox" className="rounded" />
                      <span className="text-sm">Achievement notifications</span>
                    </label>
                  </div>
                </div>
                <Button>Save Settings</Button>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Privacy & Security</CardTitle>
                <CardDescription>
                  Manage your family's data and privacy settings
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-2">
                  <label className="text-sm font-medium">Data Sharing</label>
                  <div className="space-y-2">
                    <label className="flex items-center space-x-2">
                      <input type="checkbox" className="rounded" />
                      <span className="text-sm">Share progress with co-op</span>
                    </label>
                    <label className="flex items-center space-x-2">
                      <input type="checkbox" className="rounded" />
                      <span className="text-sm">Allow anonymous analytics</span>
                    </label>
                  </div>
                </div>
                <Separator />
                <div className="space-y-2">
                  <label className="text-sm font-medium">Account Security</label>
                  <div className="space-y-2">
                    <Button variant="outline" size="sm">
                      Change Password
                    </Button>
                    <Button variant="outline" size="sm">
                      Enable Two-Factor Auth
                    </Button>
                  </div>
                </div>
                <Separator />
                <div className="space-y-2">
                  <label className="text-sm font-medium">Data Export</label>
                  <p className="text-xs text-muted-foreground">
                    Download your family's learning data and progress reports
                  </p>
                  <Button variant="outline" size="sm">
                    Export Data
                  </Button>
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
} 