import { createSupabaseServerClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import WelcomeCard from "@/components/dashboard/WelcomeCard";
import { ActiveClassItem } from "@/components/dashboard/teacher/ActiveClassItem";
import TeacherQuickActions from "@/components/dashboard/teacher/TeacherQuickActions";
import ServerPremiumProgressWidget from '@/components/dashboard/ServerPremiumProgressWidget';
import HomeschoolDashboard from "@/components/dashboard/HomeschoolDashboard";
import AutoRefreshHandler from "@/components/dashboard/AutoRefreshHandler";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { BookOpenCheck, ClipboardCheck, AlertTriangle, Info, Users, Sparkles, Activity, TrendingUp, BookOpen, CheckCircle, Target, Eye, Lightbulb, Search } from 'lucide-react';
import { Button } from "@/components/ui/button";
import Link from "next/link";
import { Tables } from "packages/types/db";
import { getEffectiveRole, hasTeacherPermissions, PROFILE_ROLE_FIELDS } from "@/lib/utils/roleUtils";

// Force dynamic rendering for auth-protected pages
export const dynamic = 'force-dynamic';

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

    // Check for ungraded assignments efficiently
    const { data: pendingGradesData, error: pendingGradesError } = await supabase
      .from('grades')
      .select('class_instance_id')
      .in('class_instance_id', classInstanceIds)
      .eq('status', 'pending');

    if (pendingGradesError) {
      console.error('Error fetching pending grades:', pendingGradesError);
    } else if (pendingGradesData) {
      const pendingCounts = pendingGradesData.reduce((acc: Record<string, number>, grade: { class_instance_id: string | null }) => {
        if (grade.class_instance_id) {
          acc[grade.class_instance_id] = (acc[grade.class_instance_id] || 0) + 1;
        }
        return acc;
      }, {} as Record<string, number>);

      Object.entries(pendingCounts).forEach(([classId, count]) => {
        const numericCount = count as number;
        const classInstance = classInstances.find((ci: any) => ci.id === classId);
        if (classInstance) {
          const className = classInstance.name || classInstance.base_classes?.name || 'Unknown Class';
          const issueText = `${numericCount} ungraded assignment${numericCount > 1 ? 's' : ''}`;

          const existingItem = attentionItems.find((item: ClassAttentionData) => item.id === classId);
          if (existingItem) {
            existingItem.issue += `, ${issueText}`;
            if (numericCount >= 10 && existingItem.priority !== 'High') {
              existingItem.priority = 'High';
            }
          } else {
            attentionItems.push({
              id: classId,
              className,
              issue: issueText,
              priority: numericCount >= 10 ? 'High' : numericCount >= 5 ? 'Medium' : 'Low',
              actionUrl: '/teach/gradebook'
            });
          }
        }
      });
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
    .select(PROFILE_ROLE_FIELDS + ', user_id, first_name, last_name, organisation_id')
    .eq('user_id', user.id)
    .single<Tables<"profiles">>();

  if (profileError || !profile) {
    console.error('TeacherDashboard: Profile fetch failed. ProfileError:', profileError, 'Profile:', profile, 'UserID:', user.id);
    redirect("/login?error=profile");
  }

  // Check if user has teacher access using centralized role checking
  const hasTeacherAccess = hasTeacherPermissions(profile);
  const currentRole = getEffectiveRole(profile) || 'student'; // fallback to student if null

  console.log(`TeacherDashboard: User ID: ${user.id}, Current Role: ${currentRole}, Has Teacher Access: ${hasTeacherAccess}`);

  if (!hasTeacherAccess) {
    console.warn(`TeacherDashboard: No teacher access. Current Role: ${currentRole}. Redirecting to /dashboard?error=unauthorized`);
    redirect("/dashboard?error=unauthorized"); 
  }

  // Get organization information
  let organization = null;
  if (profile.organisation_id) {
    const { data: orgData, error: orgError } = await supabase
      .from('organisations')
      .select('id, name, organisation_type, abbreviation')
      .eq('id', profile.organisation_id)
      .single();

    if (!orgError && orgData) {
      organization = orgData;
    }
  }

  const userName = profile.first_name || 'Teacher';

  // Check if user has created any base classes
  const { data: baseClasses } = await supabase
    .from('base_classes')
    .select('id')
    .eq('user_id', user.id)
    .limit(1);

  const hasBaseClasses = (baseClasses?.length ?? 0) > 0;

  // Check if this is a homeschool organization
  const isHomeschoolOrg = organization?.organisation_type === 'individual_family' || organization?.organisation_type === 'coop_network';

  // If it's a homeschool organization, show the HomeschoolDashboard
  if (isHomeschoolOrg && organization) {
    return (
      <div className="min-h-screen bg-background">
        {/* Auto-refresh handler for course creation redirects */}
        <AutoRefreshHandler />
        
        {/* Header Section */}
        <div className="border-b border-border/40 bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
          <div className="container mx-auto px-6 py-8">
            <WelcomeCard userName={userName} userRole={currentRole} hasBaseClasses={hasBaseClasses} />
          </div>
        </div>

        {/* Homeschool Dashboard */}
        <div className="container mx-auto px-6 py-8 space-y-8">
          {/* Course Generation Progress Widget */}
                        <ServerPremiumProgressWidget userId={user.id} />
          
          <HomeschoolDashboard 
            organizationId={organization.id}
            organizationName={organization.name}
            userRole={currentRole}
          />
        </div>
      </div>
    );
  }

  // Regular teacher dashboard for non-homeschool organizations
  const [activeClasses, recentActivity, classesNeedingAttention, teachingProgress] = await Promise.all([
    getActiveClassesData(supabase, user.id),
    getRecentStudentActivity(supabase, user.id),
    getClassesNeedingAttention(supabase, user.id),
    getTeachingProgress(supabase, user.id)
  ]);

  return (
    <div className="min-h-screen bg-background">
      {/* Auto-refresh handler for course creation redirects */}
      <AutoRefreshHandler />
      
      {/* Header Section */}
      <div className="border-b border-border/40 bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
        <div className="container mx-auto px-6 py-8">
          <WelcomeCard userName={userName} userRole={currentRole} hasBaseClasses={hasBaseClasses} />
        </div>
      </div>

      {/* Main Content */}
      <div className="container mx-auto px-6 py-8 space-y-8">
        {/* Course Generation Progress Widget */}
                      <ServerPremiumProgressWidget userId={user.id} />

        {/* Teaching Progress & Insights - Moved to top for better hierarchy */}
        <div className="bg-card/50 backdrop-blur-sm border border-border/40 rounded-2xl p-6">
          <h2 className="text-lg font-medium mb-6 text-foreground">Teaching Overview</h2>
          {teachingProgress && (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
              <div className="group p-4 bg-background/80 rounded-xl border border-border/20 hover:border-border/40 transition-all duration-200">
                <div className="flex items-center justify-between mb-3">
                  <span className="text-sm font-medium text-muted-foreground">Total Students</span>
                  <Users className="h-4 w-4 text-muted-foreground group-hover:text-foreground transition-colors" />
                </div>
                <p className="text-2xl font-semibold text-foreground">{teachingProgress.totalStudents}</p>
                <p className="text-xs text-muted-foreground mt-1">Across all classes</p>
              </div>
              
              <div className="group p-4 bg-background/80 rounded-xl border border-border/20 hover:border-border/40 transition-all duration-200">
                <div className="flex items-center justify-between mb-3">
                  <span className="text-sm font-medium text-muted-foreground">Lessons Created</span>
                  <BookOpen className="h-4 w-4 text-muted-foreground group-hover:text-foreground transition-colors" />
                </div>
                <p className="text-2xl font-semibold text-foreground">{teachingProgress.lessonsCreated}</p>
                <p className="text-xs text-success mt-1">+{teachingProgress.lessonsThisWeek} this week</p>
              </div>
              
              <div className="group p-4 bg-background/80 rounded-xl border border-border/20 hover:border-border/40 transition-all duration-200">
                <div className="flex items-center justify-between mb-3">
                  <span className="text-sm font-medium text-muted-foreground">Avg Performance</span>
                  <TrendingUp className="h-4 w-4 text-muted-foreground group-hover:text-foreground transition-colors" />
                </div>
                <p className="text-2xl font-semibold text-foreground">{teachingProgress.averagePerformance}%</p>
                <p className="text-xs text-muted-foreground mt-1">Based on quiz scores</p>
              </div>
              
              <div className="group p-4 bg-background/80 rounded-xl border border-border/20 hover:border-border/40 transition-all duration-200">
                <div className="flex items-center justify-between mb-3">
                  <span className="text-sm font-medium text-muted-foreground">Pending Reviews</span>
                  <ClipboardCheck className="h-4 w-4 text-muted-foreground group-hover:text-foreground transition-colors" />
                </div>
                <p className="text-2xl font-semibold text-foreground">{teachingProgress.pendingReviews}</p>
                <p className="text-xs text-muted-foreground mt-1">Assignments to grade</p>
              </div>
            </div>
          )}
        </div>

        {/* Main Dashboard Grid */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          
          {/* Your Active Classes - Larger focus area */}
          <div className="lg:col-span-8 bg-card/50 backdrop-blur-sm border border-border/40 rounded-2xl p-6">
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-lg font-medium text-foreground">Your Active Classes</h2>
              <Button asChild variant="outline" size="sm">
                <Link href="/teach/instances">
                  <BookOpenCheck className="mr-2 h-4 w-4" />
                  View All
                </Link>
              </Button>
            </div>
            
            {activeClasses.length === 0 && (
              <div className="text-center py-12">
                <BookOpenCheck className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
                <h3 className="text-sm font-medium text-foreground mb-2">No Active Classes</h3>
                <p className="text-sm text-muted-foreground mb-4">Create your first class to get started</p>
                <Button asChild variant="outline">
                  <Link href="/teach/base-classes">Create Class</Link>
                </Button>
              </div>
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

          {/* Right Sidebar - Quick Actions & Attention */}
          <div className="lg:col-span-4 space-y-6">
            
            {/* Quick Actions */}
            {profile.organisation_id && (
              <TeacherQuickActions organizationId={profile.organisation_id} />
            )}

            {/* Classes Needing Attention */}
            <div className="bg-card/50 backdrop-blur-sm border border-border/40 rounded-2xl p-6">
              <h3 className="text-base font-medium mb-4 text-foreground">Needs Attention</h3>
              
              {classesNeedingAttention.length === 0 && (
                <div className="text-center py-6">
                  <CheckCircle className="h-8 w-8 text-success mx-auto mb-2" />
                  <p className="text-sm text-muted-foreground">All caught up!</p>
                </div>
              )}
              
              {classesNeedingAttention.length > 0 && (
                <div className="space-y-3">
                  {classesNeedingAttention.map((item) => (
                    <div key={item.id} className="p-3 bg-background/60 rounded-lg border border-border/20">
                      <div className="flex items-start justify-between mb-2">
                        <h4 className="font-medium text-foreground text-sm">{item.className}</h4>
                        <span className={`text-xs px-2 py-1 rounded-full font-medium ${
                          item.priority === 'High' ? 'bg-destructive/10 text-destructive' :
                          item.priority === 'Medium' ? 'bg-warning/10 text-warning' :
                          'bg-muted/50 text-muted-foreground'
                        }`}>
                          {item.priority}
                        </span>
                      </div>
                      <p className="text-xs text-muted-foreground mb-3">{item.issue}</p>
                      {item.actionUrl && (
                        <Button asChild size="sm" variant="outline" className="w-full">
                          <Link href={item.actionUrl}>Review</Link>
                        </Button>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* Recent Student Activity - Full width */}
          <div className="lg:col-span-12 bg-card/50 backdrop-blur-sm border border-border/40 rounded-2xl p-6">
            <h2 className="text-lg font-medium mb-6 text-foreground">Recent Student Activity</h2>
            
            {recentActivity.length === 0 && (
              <div className="text-center py-12">
                <Activity className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
                <h3 className="text-sm font-medium text-foreground mb-2">No Recent Activity</h3>
                <p className="text-sm text-muted-foreground">No student activity in the last 24 hours</p>
              </div>
            )}
            
            {recentActivity.length > 0 && (
              <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
                {recentActivity.slice(0, 6).map((activity, index) => (
                  <div key={index} className="group p-4 bg-background/60 rounded-lg border border-border/20 hover:border-border/40 transition-all duration-200">
                    <div className="flex items-start gap-3">
                      <div className={`p-2 rounded-lg transition-colors ${
                        activity.type === 'quiz_submission' ? 'bg-success/10 text-success' :
                        activity.type === 'lesson_completion' ? 'bg-info/10 text-info' :
                        activity.type === 'late_submission' ? 'bg-warning/10 text-warning' : 'bg-muted/50 text-muted-foreground'
                      }`}>
                        {activity.type === 'quiz_submission' && <Target className="h-4 w-4" />}
                        {activity.type === 'lesson_completion' && <CheckCircle className="h-4 w-4" />}
                        {activity.type === 'late_submission' && <AlertTriangle className="h-4 w-4" />}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-foreground truncate">
                          {activity.studentName}
                        </p>
                        <p className="text-xs text-muted-foreground truncate">
                          {activity.className}
                        </p>
                        <p className="text-xs text-muted-foreground mt-1">
                          {activity.description}
                        </p>
                        <p className="text-xs text-muted-foreground mt-1 font-medium">
                          {activity.timeAgo}
                        </p>
                      </div>
                      {activity.actionUrl && (
                        <Button asChild size="sm" variant="ghost" className="opacity-0 group-hover:opacity-100 transition-opacity">
                          <Link href={activity.actionUrl}>
                            <Eye className="h-4 w-4" />
                          </Link>
                        </Button>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

        </div>
      </div>
    </div>
  );
} 