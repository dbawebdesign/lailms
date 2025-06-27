import { Database, Tables } from '../../../packages/types/db';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

// Type definitions based on actual database schema
type AssessmentAttempt = Database['public']['Tables']['assessment_attempts']['Row'];
type AssessmentResponse = Database['public']['Tables']['assessment_responses']['Row'];
type Assessment = Database['public']['Tables']['assessments']['Row'];
type Question = Database['public']['Tables']['questions']['Row'];
// Note: These analytics tables will be available after the migration is applied
// type AssessmentAnalytics = Database['public']['Tables']['assessment_analytics']['Row'];
// type QuestionAnalytics = Database['public']['Tables']['question_analytics']['Row'];
// type UserAnalytics = Database['public']['Tables']['user_analytics']['Row'];

// Response interfaces for analytics results
export interface StudentResultsResponse {
  id: string;
  assessment_id: string;
  assessment_type: Database['public']['Enums']['assessment_type'];
  started_at: string;
  completed_at: string | null;
  score: number | null;
  status: string;
  time_spent: number | null;
  passed: boolean | null;
  attempt_number: number;
  assessment_title?: string;
}

export interface AssessmentAnalyticsResponse {
  assessment_id: string;
  total_attempts: number;
  unique_users: number;
  average_score: number | null;
  highest_score: number | null;
  lowest_score: number | null;
  pass_rate: number | null;
  average_completion_time: number | null;
  question_stats: QuestionStatsResponse[];
}

export interface QuestionStatsResponse {
  question_id: string;
  question_text: string;
  total_responses: number;
  correct_responses: number;
  correct_percentage: number;
  average_time_spent: number | null;
  difficulty_score: number | null;
}

export interface UserProgressResponse {
  user_id: string;
  assessment_id: string;
  best_score: number | null;
  latest_score: number | null;
  attempts_count: number;
  avg_improvement: number | null;
  mastery_level: number | null;
  time_to_mastery: number | null;
  last_activity_at: string | null;
}

export class AssessmentAnalyticsService {
  
  /**
   * Fetch student assessment results with optional filtering
   */
  async getStudentResults(
    userId: string, 
    assessmentId?: string,
    assessmentType?: Database['public']['Enums']['assessment_type']
  ): Promise<StudentResultsResponse[]> {
    try {
      let query = supabase
        .from('assessment_attempts')
        .select(`
          id,
          assessment_id,
          assessment_type,
          started_at,
          completed_at,
          score,
          status,
          time_spent,
          passed,
          attempt_number,
          assessments!inner(title)
        `)
        .eq('user_id', userId)
        .order('started_at', { ascending: false });

      if (assessmentId) {
        query = query.eq('assessment_id', assessmentId);
      }

      if (assessmentType) {
        query = query.eq('assessment_type', assessmentType);
      }

      const { data, error } = await query;

      if (error) {
        throw new Error(`Failed to fetch student results: ${error.message}`);
      }

      return (data || []).map(attempt => ({
        id: attempt.id,
        assessment_id: attempt.assessment_id,
        assessment_type: attempt.assessment_type,
        started_at: attempt.started_at,
        completed_at: attempt.completed_at,
        score: attempt.score,
        status: attempt.status,
        time_spent: attempt.time_spent,
        passed: attempt.passed,
        attempt_number: attempt.attempt_number,
        assessment_title: (attempt.assessments as any)?.title
      }));
      
    } catch (error) {
      console.error('Error fetching student results:', error);
      throw error;
    }
  }

  /**
   * Get comprehensive analytics for a specific assessment
   */
  async getAssessmentAnalytics(assessmentId: string): Promise<AssessmentAnalyticsResponse> {
    try {
      // Fetch all completed attempts for this assessment
      const { data: attempts, error: attemptsError } = await supabase
        .from('assessment_attempts')
        .select(`
          id,
          user_id,
          score,
          started_at,
          completed_at,
          status,
          time_spent,
          passed
        `)
        .eq('assessment_id', assessmentId)
        .eq('status', 'completed');

      if (attemptsError) {
        throw new Error(`Failed to fetch assessment attempts: ${attemptsError.message}`);
      }

      if (!attempts || attempts.length === 0) {
        return {
          assessment_id: assessmentId,
          total_attempts: 0,
          unique_users: 0,
          average_score: null,
          highest_score: null,
          lowest_score: null,
          pass_rate: null,
          average_completion_time: null,
          question_stats: []
        };
      }

      // Calculate basic statistics
      const scores = attempts.map(a => a.score || 0).filter(s => s > 0);
      const completionTimes = attempts
        .filter(a => a.completed_at && a.started_at && a.time_spent)
        .map(a => a.time_spent!);
      
      const passedAttempts = attempts.filter(a => a.passed === true);
      const uniqueUsers = new Set(attempts.map(a => a.user_id)).size;

      // Get question-level statistics
      const questionStats = await this.calculateQuestionStats(assessmentId);

      return {
        assessment_id: assessmentId,
        total_attempts: attempts.length,
        unique_users: uniqueUsers,
        average_score: scores.length > 0 ? scores.reduce((sum, score) => sum + score, 0) / scores.length : null,
        highest_score: scores.length > 0 ? Math.max(...scores) : null,
        lowest_score: scores.length > 0 ? Math.min(...scores) : null,
        pass_rate: attempts.length > 0 ? (passedAttempts.length / attempts.length) * 100 : null,
        average_completion_time: completionTimes.length > 0 ? 
          completionTimes.reduce((sum, time) => sum + time, 0) / completionTimes.length : null,
        question_stats: questionStats
      };

    } catch (error) {
      console.error('Error calculating assessment analytics:', error);
      throw error;
    }
  }

  /**
   * Calculate question-level statistics for an assessment
   */
  private async calculateQuestionStats(assessmentId: string): Promise<QuestionStatsResponse[]> {
    try {
      // Get all responses for this assessment through attempts
      const { data: responses, error } = await supabase
        .from('assessment_responses')
        .select(`
          question_id,
          is_correct,
          time_spent,
          attempt_id,
          assessment_attempts!inner(assessment_id),
          questions!inner(question_text)
        `)
        .eq('assessment_attempts.assessment_id', assessmentId);

      if (error) {
        throw new Error(`Failed to fetch assessment responses: ${error.message}`);
      }

      if (!responses || responses.length === 0) {
        return [];
      }

      // Group responses by question
      const questionGroups = responses.reduce((acc, response) => {
        const questionId = response.question_id;
        if (!acc[questionId]) {
          acc[questionId] = {
            question_id: questionId,
            question_text: (response.questions as any)?.question_text || '',
            responses: []
          };
        }
        acc[questionId].responses.push(response);
        return acc;
      }, {} as Record<string, { question_id: string; question_text: string; responses: any[] }>);

      // Calculate statistics for each question
      return Object.values(questionGroups).map(group => {
        const totalResponses = group.responses.length;
        const correctResponses = group.responses.filter(r => r.is_correct === true).length;
        const timesSpent = group.responses
          .filter(r => r.time_spent && r.time_spent > 0)
          .map(r => r.time_spent);
        
        return {
          question_id: group.question_id,
          question_text: group.question_text,
          total_responses: totalResponses,
          correct_responses: correctResponses,
          correct_percentage: totalResponses > 0 ? (correctResponses / totalResponses) * 100 : 0,
          average_time_spent: timesSpent.length > 0 ? 
            timesSpent.reduce((sum, time) => sum + time, 0) / timesSpent.length : null,
          difficulty_score: totalResponses > 0 ? 
            Math.max(1, Math.min(5, 5 - (correctResponses / totalResponses) * 4)) : null
        };
      });

    } catch (error) {
      console.error('Error calculating question stats:', error);
      throw error;
    }
  }

  /**
   * Get user progress analytics for a specific user and assessment
   */
  async getUserProgress(userId: string, assessmentId: string): Promise<UserProgressResponse | null> {
    try {
      // Get all attempts for this user and assessment
      const { data: attempts, error } = await supabase
        .from('assessment_attempts')
        .select('score, completed_at, started_at')
        .eq('user_id', userId)
        .eq('assessment_id', assessmentId)
        .eq('status', 'completed')
        .order('started_at', { ascending: true });

      if (error) {
        throw new Error(`Failed to fetch user attempts: ${error.message}`);
      }

      if (!attempts || attempts.length === 0) {
        return null;
      }

      const scores = attempts.map(a => a.score || 0).filter(s => s > 0);
      const bestScore = scores.length > 0 ? Math.max(...scores) : null;
      const latestScore = scores.length > 0 ? scores[scores.length - 1] : null;
      
      // Calculate improvement rate
      let avgImprovement = null;
      if (scores.length > 1) {
        const improvements = [];
        for (let i = 1; i < scores.length; i++) {
          improvements.push(scores[i] - scores[i - 1]);
        }
        avgImprovement = improvements.reduce((sum, imp) => sum + imp, 0) / improvements.length;
      }

      // Calculate mastery level (based on consistency of high scores)
      const highScoreThreshold = 80; // 80% or above considered mastery level
      const recentAttempts = attempts.slice(-3); // Last 3 attempts
      const masteryLevel = recentAttempts.length > 0 ? 
        recentAttempts.filter(a => (a.score || 0) >= highScoreThreshold).length / recentAttempts.length : 0;

      // Calculate time to mastery (time from first attempt to first high score)
      let timeToMastery = null;
      const firstHighScoreAttempt = attempts.find(a => (a.score || 0) >= highScoreThreshold);
      if (firstHighScoreAttempt && attempts[0]) {
        const firstAttemptTime = new Date(attempts[0].started_at).getTime();
        const masteryTime = new Date(firstHighScoreAttempt.completed_at || firstHighScoreAttempt.started_at).getTime();
        timeToMastery = Math.round((masteryTime - firstAttemptTime) / (1000 * 60)); // minutes
      }

      return {
        user_id: userId,
        assessment_id: assessmentId,
        best_score: bestScore,
        latest_score: latestScore,
        attempts_count: attempts.length,
        avg_improvement: avgImprovement,
        mastery_level: masteryLevel,
        time_to_mastery: timeToMastery,
        last_activity_at: attempts[attempts.length - 1]?.completed_at || null
      };

    } catch (error) {
      console.error('Error calculating user progress:', error);
      throw error;
    }
  }

  /**
   * Get assessment analytics from cached analytics table (if available)
   */
  async getCachedAssessmentAnalytics(assessmentId: string): Promise<any | null> {
    try {
      const { data, error } = await supabase
        .from('assessment_analytics')
        .select('*')
        .eq('assessment_id', assessmentId)
        .single<Tables<'assessment_analytics'>>();

      if (error && error.code !== 'PGRST116') { // PGRST116 = no rows returned
        throw new Error(`Failed to fetch cached analytics: ${error.message}`);
      }

      return data;
    } catch (error) {
      console.error('Error fetching cached analytics:', error);
      return null;
    }
  }

  /**
   * Update or create cached analytics for an assessment
   */
  async updateCachedAnalytics(assessmentId: string): Promise<void> {
    try {
      const analytics = await this.getAssessmentAnalytics(assessmentId);
      
      const { error } = await supabase
        .from('assessment_analytics')
        .upsert({
          assessment_id: assessmentId,
          assessment_type: 'lesson_quiz', // Default, should be fetched from assessment
          total_attempts: analytics.total_attempts,
          unique_users: analytics.unique_users,
          avg_score: analytics.average_score,
          avg_completion_time: analytics.average_completion_time,
          pass_rate: analytics.pass_rate,
          question_count: analytics.question_stats.length,
          last_calculated_at: new Date().toISOString()
        });

      if (error) {
        throw new Error(`Failed to update cached analytics: ${error.message}`);
      }
    } catch (error) {
      console.error('Error updating cached analytics:', error);
      throw error;
    }
  }

  /**
   * Get question analytics from cached table (if available)
   */
  async getCachedQuestionAnalytics(questionId: string): Promise<any | null> {
    try {
      const { data, error } = await supabase
        .from('question_analytics')
        .select('*')
        .eq('question_id', questionId)
        .single<Tables<'question_analytics'>>();

      if (error && error.code !== 'PGRST116') {
        throw new Error(`Failed to fetch cached question analytics: ${error.message}`);
      }

      return data;
    } catch (error) {
      console.error('Error fetching cached question analytics:', error);
      return null;
    }
  }

  /**
   * Batch update analytics for multiple assessments
   */
  async batchUpdateAnalytics(assessmentIds: string[]): Promise<void> {
    try {
      const promises = assessmentIds.map(id => this.updateCachedAnalytics(id));
      await Promise.all(promises);
    } catch (error) {
      console.error('Error in batch analytics update:', error);
      throw error;
    }
  }

  // ===== ADVANCED ANALYTICS FEATURES =====

  /**
   * Get time-based performance trends for a user across multiple assessments
   */
  async getUserPerformanceTrends(
    userId: string, 
    assessmentType?: Database['public']['Enums']['assessment_type'],
    daysPeriod: number = 30
  ): Promise<{
    trends: Array<{
      date: string;
      score: number;
      assessment_id: string;
      assessment_title?: string;
    }>;
    overall_trend: 'improving' | 'declining' | 'stable';
    trend_percentage: number;
  }> {
    try {
      const cutoffDate = new Date();
      cutoffDate.setDate(cutoffDate.getDate() - daysPeriod);

      let query = supabase
        .from('assessment_attempts')
        .select(`
          score,
          completed_at,
          assessment_id,
          assessments!inner(title)
        `)
        .eq('user_id', userId)
        .eq('status', 'completed')
        .gte('completed_at', cutoffDate.toISOString())
        .not('score', 'is', null)
        .order('completed_at', { ascending: true });

      if (assessmentType) {
        query = query.eq('assessment_type', assessmentType);
      }

      const { data, error } = await query;

      if (error) {
        throw new Error(`Failed to fetch performance trends: ${error.message}`);
      }

      if (!data || data.length === 0) {
        return {
          trends: [],
          overall_trend: 'stable',
          trend_percentage: 0
        };
      }

      const trends = data.map(attempt => ({
        date: attempt.completed_at!.split('T')[0], // Extract date part
        score: attempt.score!,
        assessment_id: attempt.assessment_id,
        assessment_title: (attempt.assessments as any)?.title
      }));

      // Calculate overall trend
      const scores = trends.map(t => t.score);
      const firstHalf = scores.slice(0, Math.floor(scores.length / 2));
      const secondHalf = scores.slice(Math.ceil(scores.length / 2));

      const firstHalfAvg = firstHalf.reduce((sum, score) => sum + score, 0) / firstHalf.length;
      const secondHalfAvg = secondHalf.reduce((sum, score) => sum + score, 0) / secondHalf.length;
      
      const trendPercentage = ((secondHalfAvg - firstHalfAvg) / firstHalfAvg) * 100;
      
      let overallTrend: 'improving' | 'declining' | 'stable' = 'stable';
      if (Math.abs(trendPercentage) > 5) { // 5% threshold for significant change
        overallTrend = trendPercentage > 0 ? 'improving' : 'declining';
      }

      return {
        trends,
        overall_trend: overallTrend,
        trend_percentage: Math.round(trendPercentage * 100) / 100
      };

    } catch (error) {
      console.error('Error calculating performance trends:', error);
      throw error;
    }
  }

  /**
   * Compare performance between multiple users for a specific assessment
   */
  async compareUserPerformance(
    userIds: string[],
    assessmentId: string
  ): Promise<{
    comparison: Array<{
      user_id: string;
      best_score: number | null;
      attempts_count: number;
      average_score: number | null;
      completion_time_avg: number | null;
      rank: number;
    }>;
    assessment_average: number;
  }> {
    try {
      const { data, error } = await supabase
        .from('assessment_attempts')
        .select('user_id, score, time_spent')
        .eq('assessment_id', assessmentId)
        .eq('status', 'completed')
        .in('user_id', userIds);

      if (error) {
        throw new Error(`Failed to fetch user comparison data: ${error.message}`);
      }

      if (!data || data.length === 0) {
        return {
          comparison: userIds.map(userId => ({
            user_id: userId,
            best_score: null,
            attempts_count: 0,
            average_score: null,
            completion_time_avg: null,
            rank: 0
          })),
          assessment_average: 0
        };
      }

      // Group by user
      const userStats = userIds.map(userId => {
        const userAttempts = data.filter(attempt => attempt.user_id === userId);
        const scores = userAttempts.map(a => a.score || 0).filter(s => s > 0);
        const times = userAttempts.map(a => a.time_spent || 0).filter(t => t > 0);

        return {
          user_id: userId,
          best_score: scores.length > 0 ? Math.max(...scores) : null,
          attempts_count: userAttempts.length,
          average_score: scores.length > 0 ? scores.reduce((sum, score) => sum + score, 0) / scores.length : null,
          completion_time_avg: times.length > 0 ? times.reduce((sum, time) => sum + time, 0) / times.length : null,
          rank: 0 // Will be calculated below
        };
      });

      // Calculate ranks based on best score
      const sortedByScore = [...userStats].sort((a, b) => (b.best_score || 0) - (a.best_score || 0));
      sortedByScore.forEach((user, index) => {
        const originalUser = userStats.find(u => u.user_id === user.user_id);
        if (originalUser) originalUser.rank = index + 1;
      });

      // Calculate assessment average
      const allScores = data.map(a => a.score || 0).filter(s => s > 0);
      const assessmentAverage = allScores.length > 0 ? 
        allScores.reduce((sum, score) => sum + score, 0) / allScores.length : 0;

      return {
        comparison: userStats,
        assessment_average: Math.round(assessmentAverage * 100) / 100
      };

    } catch (error) {
      console.error('Error comparing user performance:', error);
      throw error;
    }
  }

  /**
   * Identify learning strengths and weaknesses based on question topics/tags
   */
  async getTopicAnalysis(
    userId: string,
    assessmentIds?: string[]
  ): Promise<{
    strengths: Array<{
      topic: string;
      success_rate: number;
      question_count: number;
      avg_time_spent: number;
    }>;
    weaknesses: Array<{
      topic: string;
      success_rate: number;
      question_count: number;
      avg_time_spent: number;
    }>;
  }> {
    try {
      let query = supabase
        .from('assessment_responses')
        .select(`
          is_correct,
          time_spent,
          assessment_attempts!inner(user_id, assessment_id),
          questions!inner(tags, cognitive_level)
        `)
        .eq('assessment_attempts.user_id', userId);

      if (assessmentIds && assessmentIds.length > 0) {
        query = query.in('assessment_attempts.assessment_id', assessmentIds);
      }

      const { data, error } = await query;

      if (error) {
        throw new Error(`Failed to fetch topic analysis data: ${error.message}`);
      }

      if (!data || data.length === 0) {
        return { strengths: [], weaknesses: [] };
      }

      // Group by topics (using tags and cognitive levels)
      const topicStats: Record<string, {
        correct: number;
        total: number;
        total_time: number;
        time_count: number;
      }> = {};

      data.forEach(response => {
        const question = response.questions as any;
        const topics = [
          ...(question?.tags || []),
          question?.cognitive_level
        ].filter(Boolean);

        topics.forEach((topic: string) => {
          if (!topicStats[topic]) {
            topicStats[topic] = { correct: 0, total: 0, total_time: 0, time_count: 0 };
          }

          topicStats[topic].total++;
          if (response.is_correct) {
            topicStats[topic].correct++;
          }
          if (response.time_spent) {
            topicStats[topic].total_time += response.time_spent;
            topicStats[topic].time_count++;
          }
        });
      });

      // Calculate success rates and categorize
      const topicAnalysis = Object.entries(topicStats).map(([topic, stats]) => ({
        topic,
        success_rate: (stats.correct / stats.total) * 100,
        question_count: stats.total,
        avg_time_spent: stats.time_count > 0 ? stats.total_time / stats.time_count : 0
      }));

      // Filter for topics with at least 3 questions for statistical significance
      const significantTopics = topicAnalysis.filter(t => t.question_count >= 3);

      // Sort by success rate
      const sortedTopics = significantTopics.sort((a, b) => b.success_rate - a.success_rate);

      // Top 30% are strengths, bottom 30% are weaknesses
      const strengthsCount = Math.max(1, Math.floor(sortedTopics.length * 0.3));
      const weaknessesCount = Math.max(1, Math.floor(sortedTopics.length * 0.3));

      return {
        strengths: sortedTopics.slice(0, strengthsCount),
        weaknesses: sortedTopics.slice(-weaknessesCount).reverse()
      };

    } catch (error) {
      console.error('Error analyzing topics:', error);
      throw error;
    }
  }

  /**
   * Generate actionable insights based on analytics data
   */
  async generateInsights(
    userId: string,
    assessmentId?: string
  ): Promise<{
    insights: Array<{
      type: 'strength' | 'weakness' | 'recommendation' | 'achievement';
      title: string;
      description: string;
      priority: 'high' | 'medium' | 'low';
      actionable_steps?: string[];
    }>;
    overall_score: number;
  }> {
    try {
      const insights: Array<{
        type: 'strength' | 'weakness' | 'recommendation' | 'achievement';
        title: string;
        description: string;
        priority: 'high' | 'medium' | 'low';
        actionable_steps?: string[];
      }> = [];
      let overallScore = 0;

      // Get user progress data
      if (assessmentId) {
        const progress = await this.getUserProgress(userId, assessmentId);
        if (progress) {
          overallScore = progress.latest_score || 0;

                     // Mastery insights
           if (progress.mastery_level && progress.mastery_level >= 0.8) {
             insights.push({
               type: 'achievement',
               title: 'Mastery Achieved!',
               description: `You've demonstrated consistent high performance with ${Math.round(progress.mastery_level * 100)}% mastery level.`,
               priority: 'high'
             });
           } else if (progress.mastery_level && progress.mastery_level < 0.5) {
             insights.push({
               type: 'weakness',
               title: 'Inconsistent Performance',
               description: 'Your scores vary significantly between attempts. Focus on consistent practice.',
               priority: 'high',
               actionable_steps: [
                 'Review fundamental concepts before attempting assessments',
                 'Practice similar questions regularly',
                 'Take more time to read questions carefully'
               ]
             });
           }

          // Improvement insights
          if (progress.avg_improvement && progress.avg_improvement > 5) {
            insights.push({
              type: 'strength',
              title: 'Strong Learning Trajectory',
              description: `Your scores are improving by an average of ${Math.round(progress.avg_improvement)}% per attempt.`,
              priority: 'medium'
            });
          } else if (progress.avg_improvement && progress.avg_improvement < -5) {
            insights.push({
              type: 'weakness',
              title: 'Declining Performance',
              description: 'Your recent scores are lower than earlier attempts. Consider reviewing the material.',
              priority: 'high',
              actionable_steps: [
                'Review previous incorrect answers',
                'Seek help from instructor or peers',
                'Focus on areas where you struggled most'
              ]
            });
          }
        }
      }

      // Get topic analysis
      const topicAnalysis = await this.getTopicAnalysis(userId, assessmentId ? [assessmentId] : undefined);
      
      // Add strength insights
      topicAnalysis.strengths.slice(0, 2).forEach(strength => {
        insights.push({
          type: 'strength',
          title: `Strong in ${strength.topic}`,
          description: `You excel in ${strength.topic} with ${Math.round(strength.success_rate)}% success rate.`,
          priority: 'low'
        });
      });

      // Add weakness insights with recommendations
      topicAnalysis.weaknesses.slice(0, 2).forEach(weakness => {
        insights.push({
          type: 'recommendation',
          title: `Focus on ${weakness.topic}`,
          description: `Your success rate in ${weakness.topic} is ${Math.round(weakness.success_rate)}%. This area needs attention.`,
          priority: weakness.success_rate < 50 ? 'high' : 'medium',
          actionable_steps: [
            `Review ${weakness.topic} concepts and examples`,
            `Practice additional questions in ${weakness.topic}`,
            'Consider seeking additional resources or help'
          ]
        });
      });

      // Get performance trends
      const trends = await this.getUserPerformanceTrends(userId, undefined, 30);
      if (trends.overall_trend === 'improving') {
        insights.push({
          type: 'achievement',
          title: 'Improving Performance',
          description: `Your performance has improved by ${Math.abs(trends.trend_percentage)}% over the last 30 days.`,
          priority: 'medium'
        });
      }

      return {
        insights: insights.slice(0, 6), // Limit to 6 most important insights
        overall_score: Math.round(overallScore)
      };

    } catch (error) {
      console.error('Error generating insights:', error);
      throw error;
    }
  }

  /**
   * Get assessment difficulty analysis across multiple assessments
   */
  async getAssessmentDifficultyAnalysis(
    assessmentIds: string[]
  ): Promise<{
    assessments: Array<{
      assessment_id: string;
      difficulty_score: number;
      average_score: number;
      completion_rate: number;
      time_pressure_indicator: number;
    }>;
    overall_difficulty_distribution: {
      easy: number;
      medium: number;
      hard: number;
    };
  }> {
    try {
      const assessmentAnalytics = await Promise.all(
        assessmentIds.map(async (id) => {
          const analytics = await this.getAssessmentAnalytics(id);
          
          // Calculate difficulty metrics
          const difficultyScore = analytics.average_score ? 
            Math.max(1, Math.min(5, 5 - (analytics.average_score / 20))) : 3; // Inverse relationship with average score
          
          const completionRate = analytics.total_attempts > 0 ? 
            (analytics.pass_rate || 0) : 0;
          
          const timePressureIndicator = analytics.average_completion_time ? 
            Math.min(5, (analytics.average_completion_time / 60000) / 10) : 2.5; // Convert ms to minutes, normalize

          return {
            assessment_id: id,
            difficulty_score: Math.round(difficultyScore * 100) / 100,
            average_score: analytics.average_score || 0,
            completion_rate: completionRate,
            time_pressure_indicator: Math.round(timePressureIndicator * 100) / 100
          };
        })
      );

      // Calculate difficulty distribution
      const distribution = { easy: 0, medium: 0, hard: 0 };
      assessmentAnalytics.forEach(assessment => {
        if (assessment.difficulty_score <= 2) {
          distribution.easy++;
        } else if (assessment.difficulty_score <= 3.5) {
          distribution.medium++;
        } else {
          distribution.hard++;
        }
      });

      return {
        assessments: assessmentAnalytics,
        overall_difficulty_distribution: distribution
      };

    } catch (error) {
      console.error('Error analyzing assessment difficulty:', error);
      throw error;
    }
  }
} 