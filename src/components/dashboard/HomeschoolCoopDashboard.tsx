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
  Shield,
  Building
} from 'lucide-react';

interface Family {
  id: string;
  name: string;
  admin_name: string;
  admin_email: string;
  student_count: number;
  created_at: string;
  status: string;
}

interface Member {
  user_id: string;
  username: string;
  first_name: string;
  last_name: string;
  role: string;
  grade_level: string;
  family_name: string;
  created_at: string;
}

interface Course {
  id: string;
  name: string;
  base_class_name: string;
  instructor_name: string;
  start_date: string;
  end_date: string;
  status: string;
  enrolled_count: number;
}

interface CoopStats {
  totalFamilies: number;
  totalMembers: number;
  totalCourses: number;
  totalStudents: number;
  totalTeachers: number;
  growthRate: number;
}

interface HomeschoolCoopDashboardProps {
  organizationId: string;
  organizationName: string;
  userRole: string;
}

export default function HomeschoolCoopDashboard({ 
  organizationId, 
  organizationName, 
  userRole 
}: HomeschoolCoopDashboardProps) {
  const [families, setFamilies] = useState<Family[]>([]);
  const [members, setMembers] = useState<Member[]>([]);
  const [courses, setCourses] = useState<Course[]>([]);
  const [coopStats, setCoopStats] = useState<CoopStats>({
    totalFamilies: 0,
    totalMembers: 0,
    totalCourses: 0,
    totalStudents: 0,
    totalTeachers: 0,
    growthRate: 0
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

      // const organizationId = profile.organisation_units.organisation_id; // This line is now passed as a prop

      // Get all families (organisation_units) in this coop
      const { data: familiesData, error: familiesError } = await supabase
        .from('organisation_units')
        .select(`
          id,
          name,
          created_at,
          profiles!inner(
            user_id,
            first_name,
            last_name,
            role
          )
        `)
        .eq('organisation_id', organizationId)
        .order('created_at', { ascending: false });

      if (familiesError) {
        console.error('Error fetching families:', familiesError);
        toast({
          title: "Error",
          description: "Failed to load families.",
          variant: "destructive",
        });
      } else {
        // Transform families data
        const transformedFamilies = await Promise.all(
          (familiesData || []).map(async (family: any) => {
            // Get student count for this family
            const { count: studentCount } = await supabase
              .from('profiles')
              .select('*', { count: 'exact', head: true })
              .eq('organisation_unit_id', family.id)
              .eq('role', 'student');

            // Find the admin for this family
            const admin = family.profiles.find((p: any) => p.role === 'admin');
            
            return {
              id: family.id,
              name: family.name,
              admin_name: admin ? `${admin.first_name} ${admin.last_name}` : 'No admin',
              admin_email: admin?.user_id || '',
              student_count: studentCount || 0,
              created_at: family.created_at,
              status: 'active'
            };
          })
        );
        setFamilies(transformedFamilies);
      }

      // Get all members in this organization
      const { data: membersData, error: membersError } = await supabase
        .from('profiles')
        .select(`
          user_id,
          username,
          first_name,
          last_name,
          role,
          grade_level,
          created_at,
          organisation_units!inner(
            name,
            organisation_id
          )
        `)
        .eq('organisation_units.organisation_id', organizationId)
        .order('created_at', { ascending: false });

      if (membersError) {
        console.error('Error fetching members:', membersError);
        toast({
          title: "Error",
          description: "Failed to load members.",
          variant: "destructive",
        });
      } else {
        const transformedMembers = (membersData || []).map((member: any) => ({
          user_id: member.user_id,
          username: member.username,
          first_name: member.first_name,
          last_name: member.last_name,
          role: member.role,
          grade_level: member.grade_level,
          family_name: member.organisation_units.name,
          created_at: member.created_at
        }));
        setMembers(transformedMembers);
      }

      // Get all courses in this organization
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
            organisation_id,
            profiles!inner(
              first_name,
              last_name
            )
          )
        `)
        .eq('base_classes.organisation_id', organizationId)
        .order('start_date', { ascending: false });

      if (coursesError) {
        console.error('Error fetching courses:', coursesError);
        toast({
          title: "Error",
          description: "Failed to load courses.",
          variant: "destructive",
        });
      } else {
        // Transform courses data and get enrollment counts
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
              instructor_name: `${course.base_classes.profiles.first_name} ${course.base_classes.profiles.last_name}`,
              start_date: course.start_date,
              end_date: course.end_date,
              status: course.status || 'active',
              enrolled_count: enrolledCount || 0
            };
          })
        );
        setCourses(transformedCourses);
      }

      // Calculate coop stats
      const totalFamilies = familiesData?.length || 0;
      const totalMembers = membersData?.length || 0;
      const totalCourses = coursesData?.length || 0;
      const totalStudents = membersData?.filter(m => m.role === 'student').length || 0;
      const totalTeachers = membersData?.filter(m => m.role === 'admin').length || 0;
      
      // Calculate growth rate (mock for now - would need historical data)
      const growthRate = Math.floor(Math.random() * 15) + 5; // 5-20% mock growth

      setCoopStats({
        totalFamilies,
        totalMembers,
        totalCourses,
        totalStudents,
        totalTeachers,
        growthRate
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

  const filteredFamilies = families.filter(family =>
    family.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    family.admin_name.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const filteredMembers = members.filter(member =>
    `${member.first_name} ${member.last_name}`.toLowerCase().includes(searchTerm.toLowerCase()) ||
    member.username.toLowerCase().includes(searchTerm.toLowerCase()) ||
    member.family_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    member.role.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const filteredCourses = courses.filter(course =>
    course.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    course.base_class_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    course.instructor_name.toLowerCase().includes(searchTerm.toLowerCase())
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
          <h1 className="text-3xl font-bold tracking-tight">Co-op Administration</h1>
          <p className="text-muted-foreground">Manage your homeschool co-op community</p>
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
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-6 gap-6">
        <Card className="glass-card glass-card-hover animate-scale-in delay-100 card-hover-gradient transition-all hover:shadow-lg"
              style={{"--hover-gradient": "linear-gradient(135deg, rgba(16, 185, 129, 0.1) 0%, rgba(6, 182, 212, 0.05) 100%)"} as React.CSSProperties}>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Families</CardTitle>
            <Home className="h-4 w-4 text-muted-foreground icon-hover" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold animate-counter number-digit">{coopStats.totalFamilies}</div>
            <p className="text-xs text-muted-foreground">
              Active families
            </p>
          </CardContent>
        </Card>

        <Card className="glass-card glass-card-hover animate-scale-in delay-200 card-hover-gradient transition-all hover:shadow-lg"
              style={{"--hover-gradient": "linear-gradient(135deg, rgba(59, 130, 246, 0.1) 0%, rgba(139, 92, 246, 0.05) 100%)"} as React.CSSProperties}>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Students</CardTitle>
            <GraduationCap className="h-4 w-4 text-muted-foreground icon-hover" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold animate-counter number-digit">{coopStats.totalStudents}</div>
            <p className="text-xs text-muted-foreground">
              Learning together
            </p>
          </CardContent>
        </Card>

        <Card className="transition-all hover:shadow-lg">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Teachers</CardTitle>
            <Users className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{coopStats.totalTeachers}</div>
            <p className="text-xs text-muted-foreground">
              Family admins
            </p>
          </CardContent>
        </Card>

        <Card className="transition-all hover:shadow-lg">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Courses</CardTitle>
            <BookOpen className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{coopStats.totalCourses}</div>
            <p className="text-xs text-muted-foreground">
              Active classes
            </p>
          </CardContent>
        </Card>

        <Card className="transition-all hover:shadow-lg">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Members</CardTitle>
            <Building className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{coopStats.totalMembers}</div>
            <p className="text-xs text-muted-foreground">
              All participants
            </p>
          </CardContent>
        </Card>

        <Card className="transition-all hover:shadow-lg">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Growth</CardTitle>
            <TrendingUp className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{coopStats.growthRate}%</div>
            <p className="text-xs text-muted-foreground">
              This quarter
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Search */}
      <div className="flex items-center space-x-2">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search families, members, courses..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="pl-8"
          />
        </div>
      </div>

      {/* Main Content Tabs */}
      <Tabs defaultValue="overview" className="space-y-6">
        <TabsList className="grid w-full grid-cols-5">
          <TabsTrigger value="overview">Overview</TabsTrigger>
          <TabsTrigger value="families">Families</TabsTrigger>
          <TabsTrigger value="members">Members</TabsTrigger>
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
                  {members.slice(0, 5).map((member) => (
                    <div key={member.user_id} className="flex items-center justify-between p-3 rounded-lg bg-muted/50">
                      <div className="flex items-center gap-3">
                        <div className="h-8 w-8 rounded-full bg-primary/10 flex items-center justify-center text-sm font-medium">
                          {member.first_name?.[0]}{member.last_name?.[0]}
                        </div>
                        <div>
                          <p className="text-sm font-medium">
                            {member.first_name} {member.last_name}
                          </p>
                          <p className="text-xs text-muted-foreground">
                            {member.family_name} • {member.role}
                          </p>
                        </div>
                      </div>
                      <Badge variant="secondary">
                        {member.role}
                      </Badge>
                    </div>
                  ))}
                  {members.length === 0 && (
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
                    <Home className="h-5 w-5 mr-3" />
                    <div className="text-left">
                      <div className="font-medium">Manage Families</div>
                      <div className="text-sm text-muted-foreground">Oversee family units</div>
                    </div>
                  </Button>
                  <Button variant="outline" className="justify-start h-auto p-4">
                    <Users className="h-5 w-5 mr-3" />
                    <div className="text-left">
                      <div className="font-medium">Member Directory</div>
                      <div className="text-sm text-muted-foreground">View all participants</div>
                    </div>
                  </Button>
                  <Button variant="outline" className="justify-start h-auto p-4">
                    <BookOpen className="h-5 w-5 mr-3" />
                    <div className="text-left">
                      <div className="font-medium">Course Oversight</div>
                      <div className="text-sm text-muted-foreground">Monitor all classes</div>
                    </div>
                  </Button>
                  <Button variant="outline" className="justify-start h-auto p-4">
                    <BarChart3 className="h-5 w-5 mr-3" />
                    <div className="text-left">
                      <div className="font-medium">Analytics</div>
                      <div className="text-sm text-muted-foreground">Community insights</div>
                    </div>
                  </Button>
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        <TabsContent value="families" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Family Units</CardTitle>
              <CardDescription>
                Manage the families in your homeschool co-op
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {filteredFamilies.map((family) => (
                  <div key={family.id} className="flex items-center justify-between p-4 rounded-lg border bg-card hover:bg-accent/50 transition-colors">
                    <div className="flex items-center gap-4">
                      <div className="h-12 w-12 rounded-lg bg-primary/10 flex items-center justify-center">
                        <Home className="h-6 w-6 text-primary" />
                      </div>
                      <div>
                        <h3 className="font-semibold">{family.name}</h3>
                        <p className="text-sm text-muted-foreground">
                          Admin: {family.admin_name}
                        </p>
                        <div className="flex items-center gap-2 mt-1">
                          <Badge variant="secondary">
                            {family.student_count} students
                          </Badge>
                          <span className="text-xs text-muted-foreground">
                            Since {new Date(family.created_at).toLocaleDateString()}
                          </span>
                        </div>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <Button variant="outline" size="sm">
                        View Details
                      </Button>
                    </div>
                  </div>
                ))}
                {filteredFamilies.length === 0 && (
                  <p className="text-center text-muted-foreground py-8">
                    No families found matching your search
                  </p>
                )}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="members" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>All Members</CardTitle>
              <CardDescription>
                View and manage all co-op participants
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {filteredMembers.map((member) => (
                  <div key={member.user_id} className="flex items-center justify-between p-4 rounded-lg border bg-card hover:bg-accent/50 transition-colors">
                    <div className="flex items-center gap-4">
                      <div className="h-12 w-12 rounded-full bg-primary/10 flex items-center justify-center text-lg font-medium">
                        {member.first_name?.[0]}{member.last_name?.[0]}
                      </div>
                      <div>
                        <h3 className="font-semibold">{member.first_name} {member.last_name}</h3>
                        <p className="text-sm text-muted-foreground">
                          @{member.username} • {member.family_name}
                        </p>
                        <div className="flex items-center gap-2 mt-1">
                          <Badge variant={member.role === 'admin' ? 'default' : 'secondary'}>
                            {member.role}
                          </Badge>
                          {member.grade_level && (
                            <Badge variant="outline">
                              Grade {member.grade_level}
                            </Badge>
                          )}
                        </div>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <Button variant="outline" size="sm">
                        View Profile
                      </Button>
                    </div>
                  </div>
                ))}
                {filteredMembers.length === 0 && (
                  <p className="text-center text-muted-foreground py-8">
                    No members found matching your search
                  </p>
                )}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="courses" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>All Courses</CardTitle>
              <CardDescription>
                Monitor all classes across the co-op
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
                            {course.enrolled_count} enrolled • {course.instructor_name}
                          </span>
                        </div>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <Button variant="outline" size="sm">
                        View Course
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
                <CardTitle>Co-op Settings</CardTitle>
                <CardDescription>
                  Configure your homeschool co-op
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-2">
                  <label className="text-sm font-medium">Co-op Name</label>
                  <Input placeholder="Sunrise Homeschool Co-op" />
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-medium">Meeting Schedule</label>
                  <Input placeholder="Tuesdays & Thursdays, 9:00 AM - 2:00 PM" />
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-medium">Governance</label>
                  <div className="space-y-2">
                    <label className="flex items-center space-x-2">
                      <input type="checkbox" className="rounded" />
                      <span className="text-sm">Require admin approval for new families</span>
                    </label>
                    <label className="flex items-center space-x-2">
                      <input type="checkbox" className="rounded" />
                      <span className="text-sm">Allow families to create courses</span>
                    </label>
                    <label className="flex items-center space-x-2">
                      <input type="checkbox" className="rounded" />
                      <span className="text-sm">Enable community announcements</span>
                    </label>
                  </div>
                </div>
                <Button>Save Settings</Button>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Community Management</CardTitle>
                <CardDescription>
                  Manage co-op policies and guidelines
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-2">
                  <label className="text-sm font-medium">Communication</label>
                  <div className="space-y-2">
                    <label className="flex items-center space-x-2">
                      <input type="checkbox" className="rounded" />
                      <span className="text-sm">Weekly progress reports</span>
                    </label>
                    <label className="flex items-center space-x-2">
                      <input type="checkbox" className="rounded" />
                      <span className="text-sm">Event notifications</span>
                    </label>
                  </div>
                </div>
                <Separator />
                <div className="space-y-2">
                  <label className="text-sm font-medium">Data & Privacy</label>
                  <div className="space-y-2">
                    <Button variant="outline" size="sm">
                      Privacy Policy
                    </Button>
                    <Button variant="outline" size="sm">
                      Data Export
                    </Button>
                  </div>
                </div>
                <Separator />
                <div className="space-y-2">
                  <label className="text-sm font-medium">Support</label>
                  <p className="text-xs text-muted-foreground">
                    Get help with managing your co-op
                  </p>
                  <Button variant="outline" size="sm">
                    Contact Support
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