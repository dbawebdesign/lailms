import { Tables } from 'packages/types/db';
import OpenAI from 'openai';
import { SupabaseClient } from '@supabase/supabase-js';
import { isStudent, isTeacher, getEffectiveRole } from '@/lib/utils/roleUtils';

export interface AIInsight {
  id: string;
  type: 'tip' | 'reminder' | 'insight' | 'recommendation';
  title: string;
  message: string;
  priority: 'high' | 'medium' | 'low';
  actionable: boolean;
  action?: {
    text: string;
    href: string;
  };
  icon?: string;
}

export interface UserInsightsData {
  // Student specific data
  activeCourses?: any[];
  recentProgress?: any[];
  upcomingAssignments?: any[];
  grades?: any[];
  
  // Teacher specific data
  activeClasses?: any[];
  studentPerformance?: any[];
  gradingQueue?: any[];
  courseGeneration?: any[];
  
  // Common data
  profile: Tables<'profiles'>;
  recentActivity?: any[];
  systemUsage?: any[];
}

class AIInsightsService {
  private openai: OpenAI;

  constructor() {
    if (!process.env.OPENAI_API_KEY) {
      throw new Error('OPENAI_API_KEY is required for AI insights');
    }
    
    this.openai = new OpenAI({
      apiKey: process.env.OPENAI_API_KEY,
    });
  }

  async getUserInsights(supabase: SupabaseClient, userId: string): Promise<AIInsight[]> {
    try {
      // First check if we have recent insights
      const { data: existingInsights } = await supabase
        .from('ai_insights')
        .select('*')
        .eq('user_id', userId)
        .eq('is_dismissed', false)
        .gte('expires_at', new Date().toISOString())
        .single();

      if (existingInsights) {
        return (existingInsights.insights as unknown) as AIInsight[];
      }

      // Generate new insights
      return await this.generateInsights(supabase, userId);
    } catch (error) {
      console.error('Error getting user insights:', error);
      return this.getFallbackInsights();
    }
  }

  private async generateInsights(supabase: SupabaseClient, userId: string): Promise<AIInsight[]> {
    const startTime = Date.now();
    
    try {
      // Gather user data
      const userData = await this.gatherUserData(supabase, userId);
      
      // Generate insights using AI
      const insights = await this.generateAIInsights(userData);
      
      // Store insights in database
      await this.storeInsights(supabase, userId, insights, userData, Date.now() - startTime);
      
      return insights;
    } catch (error) {
      console.error('Error generating insights:', error);
      return this.getFallbackInsights();
    }
  }

  private async gatherUserData(supabase: SupabaseClient, userId: string): Promise<UserInsightsData> {
    const { data: profile } = await supabase
      .from('profiles')
      .select('*')
      .eq('user_id', userId)
      .single();

    if (!profile) {
      throw new Error('User profile not found');
    }

    const data: UserInsightsData = { profile };

    if (isStudent(profile)) {
      data.activeCourses = await this.getStudentActiveCourses(supabase, userId);
      data.recentProgress = await this.getStudentProgress(supabase, userId);
      data.upcomingAssignments = await this.getUpcomingAssignments(supabase, userId);
      data.grades = await this.getRecentGrades(supabase, userId);
    } else if (isTeacher(profile)) {
      data.activeClasses = await this.getTeacherActiveClasses(supabase, userId);
      data.studentPerformance = await this.getStudentPerformanceData(supabase, userId);
      data.gradingQueue = await this.getGradingQueue(supabase, userId);
      data.courseGeneration = await this.getCourseGenerationStatus(supabase, userId);
    }

    data.recentActivity = await this.getRecentActivity(supabase, userId);
    
    return data;
  }

  private async generateAIInsights(userData: UserInsightsData): Promise<AIInsight[]> {
    const prompt = this.buildInsightPrompt(userData);
    
    const response = await this.openai.chat.completions.create({
      model: 'gpt-4.1-mini',
      messages: [
        {
          role: 'system',
          content: `You are an AI educational assistant that provides personalized insights for students and teachers. 
          Generate 2-3 concise, actionable insights based on the user's data. 
          Focus on what's most important and helpful for their immediate needs.
          
          Return JSON in this exact format:
          {
            "insights": [
              {
                "id": "unique_id",
                "type": "tip|reminder|insight|recommendation",
                "title": "Short title",
                "message": "Helpful message (max 100 characters)",
                "priority": "high|medium|low",
                "actionable": true/false,
                "action": {
                  "text": "Action text",
                  "href": "/path/to/action"
                },
                "icon": "lucide-icon-name"
              }
            ]
          }`
        },
        {
          role: 'user',
          content: prompt
        }
      ],
      temperature: 0.7,
      max_tokens: 1000,
    });

    const content = response.choices[0]?.message?.content;
    if (!content) {
      throw new Error('No response from AI');
    }

    const parsed = JSON.parse(content);
    return parsed.insights || [];
  }

  private buildInsightPrompt(userData: UserInsightsData): string {
    const { profile } = userData;
    const effectiveRole = getEffectiveRole(profile);
    let prompt = `User Profile: ${effectiveRole} - ${profile.first_name} ${profile.last_name}\n\n`;

    if (isStudent(profile)) {
      prompt += `Student Data:\n`;
      prompt += `- Active Courses: ${userData.activeCourses?.length || 0}\n`;
      if (userData.activeCourses && userData.activeCourses.length > 0) {
        prompt += `- Course Details: ${userData.activeCourses.map(c => c.class_instances?.name || 'Unknown').join(', ')}\n`;
      }
      prompt += `- Recent Progress: ${userData.recentProgress?.length || 0} recent activities\n`;
      prompt += `- Upcoming Assignments: ${userData.upcomingAssignments?.length || 0}\n`;
      prompt += `- Recent Grades: ${userData.grades?.length || 0} recent grades\n`;
    } else if (isTeacher(profile)) {
      prompt += `Teacher Data:\n`;
      prompt += `- Active Class Instances: ${userData.activeClasses?.length || 0}\n`;
      if (userData.activeClasses && userData.activeClasses.length > 0) {
        const classNames = userData.activeClasses.map(c => c.class_instances?.name || 'Unknown');
        prompt += `- Class Instance Names: ${classNames.join(', ')}\n`;
        const baseClassNames = userData.activeClasses.map(c => c.class_instances?.base_classes?.name || 'Unknown');
        prompt += `- Base Class Names: ${baseClassNames.join(', ')}\n`;
      }
      prompt += `- Total Students Enrolled: ${userData.studentPerformance?.length || 0}\n`;
      prompt += `- Pending Grading Items: ${userData.gradingQueue?.length || 0} assignments to grade\n`;
      prompt += `- Course Generation Jobs: ${userData.courseGeneration?.length || 0}\n`;
    }

    prompt += `\nGenerate 2-3 personalized insights that are:
    1. Immediately actionable and helpful
    2. Based on their current situation and actual data
    3. Encouraging and supportive
    4. Specific to their role and actual class/course data
    
    Focus on productivity, learning outcomes, and next steps. If they have classes/courses, reference them specifically.`;

    return prompt;
  }

  private async storeInsights(
    supabase: SupabaseClient,
    userId: string, 
    insights: AIInsight[], 
    userData: UserInsightsData, 
    generationTime: number
  ): Promise<void> {
    await supabase
      .from('ai_insights')
      .insert({
        user_id: userId,
        user_role: userData.profile.role,
        insights: JSON.parse(JSON.stringify(insights)),
        source_data_hash: this.generateDataHash(userData),
      });
  }

  private getFallbackInsights(): AIInsight[] {
    return [
      {
        id: 'fallback-1',
        type: 'tip',
        title: 'Welcome back!',
        message: 'Ready to continue your learning journey?',
        priority: 'medium',
        actionable: false,
        icon: 'sparkles'
      }
    ];
  }

  private generateDataHash(userData: UserInsightsData): string {
    const hashData = {
      role: userData.profile.role,
      coursesCount: userData.activeCourses?.length || userData.activeClasses?.length || 0,
      progressCount: userData.recentProgress?.length || 0,
      assignmentsCount: userData.upcomingAssignments?.length || userData.gradingQueue?.length || 0,
      lastActivity: userData.recentActivity?.[0]?.updated_at || null,
    };
    
    return Buffer.from(JSON.stringify(hashData)).toString('base64');
  }

  // Data gathering methods
  private async getStudentActiveCourses(supabase: SupabaseClient, userId: string) {
    // First get the profile to get the correct profile_id
    const { data: profile } = await supabase
      .from('profiles')
      .select('user_id')
      .eq('user_id', userId)
      .single();

    if (!profile) {
      return [];
    }

    // Now get the courses where this user is a student
    const { data } = await supabase
      .from('rosters')
      .select(`
        class_instances (
          id,
          name,
          base_classes (name, description)
        )
      `)
      .eq('profile_id', profile.user_id)
      .eq('role', 'student');
    
    return data || [];
  }

  private async getStudentProgress(supabase: SupabaseClient, userId: string) {
    const { data } = await supabase
      .from('progress')
      .select('*')
      .eq('user_id', userId)
      .order('updated_at', { ascending: false })
      .limit(10);
    
    return data || [];
  }

  private async getUpcomingAssignments(supabase: SupabaseClient, userId: string) {
    const { data } = await supabase
      .from('assignments')
      .select(`
        *,
        grades!left (
          id,
          status,
          student_id
        )
      `)
      .gte('due_date', new Date().toISOString())
      .order('due_date', { ascending: true })
      .limit(10);
    
    return data?.filter((assignment: any) => 
      !assignment.grades?.some((grade: any) => grade.student_id === userId)
    ) || [];
  }

  private async getRecentGrades(supabase: SupabaseClient, userId: string) {
    const { data } = await supabase
      .from('grades')
      .select(`
        *,
        assignments (name, points_possible)
      `)
      .eq('student_id', userId)
      .order('created_at', { ascending: false })
      .limit(10);
    
    return data || [];
  }

  private async getTeacherActiveClasses(supabase: SupabaseClient, userId: string) {
    // Get the class instances where this user is the teacher (through base_classes.user_id)
    const { data } = await supabase
      .from('class_instances')
      .select(`
        id,
        name,
        base_classes!inner (
          id,
          name,
          description,
          user_id
        )
      `)
      .eq('base_classes.user_id', userId);
    
    // Transform to match expected format
    const classes = data?.map((instance: any) => ({
      class_instances: {
        id: instance.id,
        name: instance.name,
        base_classes: {
          name: instance.base_classes.name,
          description: instance.base_classes.description
        }
      }
    })) || [];
    
    return classes;
  }

  private async getStudentPerformanceData(supabase: SupabaseClient, userId: string) {
    // Get all students in teacher's class instances
    const { data } = await supabase
      .from('class_instances')
      .select(`
        id,
        name,
        base_classes!inner (user_id),
        rosters (
          role,
          profiles (user_id, first_name, last_name)
        )
      `)
      .eq('base_classes.user_id', userId);
    
    // Transform and filter to get only students
    const students = data?.flatMap((instance: any) => 
      instance.rosters?.filter((roster: any) => 
        roster.role === 'student'
      ).map((roster: any) => ({
        ...roster.profiles,
        class_instance_id: instance.id,
        class_instance_name: instance.name
      })) || []
    ) || [];
    
    return students;
  }

  private async getGradingQueue(supabase: SupabaseClient, userId: string) {
    // Get grading queue for teacher's class instances
    const { data } = await supabase
      .from('grades')
      .select(`
        *,
        assignments!inner (
          name, 
          due_date, 
          class_instance_id,
          class_instances!inner (
            base_classes!inner (user_id)
          )
        ),
        profiles (first_name, last_name)
      `)
      .eq('status', 'pending')
      .eq('assignments.class_instances.base_classes.user_id', userId)
      .order('created_at', { ascending: true });
    
    return data || [];
  }

  private async getCourseGenerationStatus(supabase: SupabaseClient, userId: string) {
    // This would connect to your course generation system
    // For now, return empty array
    return [];
  }

  private async getRecentActivity(supabase: SupabaseClient, userId: string) {
    // Get recent activity across the platform
    const { data } = await supabase
      .from('progress')
      .select('*')
      .eq('user_id', userId)
      .order('updated_at', { ascending: false })
      .limit(5);
    
    return data || [];
  }

  async dismissInsights(supabase: SupabaseClient, userId: string, insightId: string): Promise<void> {
    await supabase
      .from('ai_insights')
      .update({
        is_dismissed: true,
        dismissed_at: new Date().toISOString()
      })
      .eq('user_id', userId)
      .eq('id', insightId);
  }

  async refreshInsights(supabase: SupabaseClient, userId: string): Promise<AIInsight[]> {
    // Dismiss current insights
    await supabase
      .from('ai_insights')
      .update({
        is_dismissed: true,
        dismissed_at: new Date().toISOString()
      })
      .eq('user_id', userId)
      .eq('is_dismissed', false);

    // Generate new insights
    return await this.generateInsights(supabase, userId);
  }
}

export const aiInsightsService = new AIInsightsService(); 