import { AssessmentAnalyticsService } from './assessment-analytics-service';

/**
 * Test utility for verifying analytics computation methods
 * This is a temporary file for development/testing purposes
 */
export class AnalyticsTestUtils {
  private analyticsService: AssessmentAnalyticsService;

  constructor() {
    this.analyticsService = new AssessmentAnalyticsService();
  }

  /**
   * Test basic analytics computation with a real assessment ID
   */
  async testAssessmentAnalytics(assessmentId: string) {
    try {
      console.log(`Testing analytics for assessment: ${assessmentId}`);
      
      const analytics = await this.analyticsService.getAssessmentAnalytics(assessmentId);
      
      console.log('Assessment Analytics Results:', {
        assessment_id: analytics.assessment_id,
        total_attempts: analytics.total_attempts,
        unique_users: analytics.unique_users,
        average_score: analytics.average_score,
        pass_rate: analytics.pass_rate,
        question_count: analytics.question_stats.length
      });

      // Test question-level statistics
      if (analytics.question_stats.length > 0) {
        console.log('Sample Question Stats:', analytics.question_stats[0]);
      }

      return analytics;
    } catch (error) {
      console.error('Error testing assessment analytics:', error);
      throw error;
    }
  }

  /**
   * Test student results fetching
   */
  async testStudentResults(userId: string, assessmentId?: string) {
    try {
      console.log(`Testing student results for user: ${userId}`);
      
      const results = await this.analyticsService.getStudentResults(userId, assessmentId);
      
      console.log(`Found ${results.length} assessment attempts`);
      if (results.length > 0) {
        console.log('Sample result:', {
          assessment_id: results[0].assessment_id,
          score: results[0].score,
          status: results[0].status,
          attempt_number: results[0].attempt_number
        });
      }

      return results;
    } catch (error) {
      console.error('Error testing student results:', error);
      throw error;
    }
  }

  /**
   * Test user progress analytics
   */
  async testUserProgress(userId: string, assessmentId: string) {
    try {
      console.log(`Testing user progress for user: ${userId}, assessment: ${assessmentId}`);
      
      const progress = await this.analyticsService.getUserProgress(userId, assessmentId);
      
      if (progress) {
        console.log('User Progress Results:', {
          best_score: progress.best_score,
          latest_score: progress.latest_score,
          attempts_count: progress.attempts_count,
          mastery_level: progress.mastery_level,
          avg_improvement: progress.avg_improvement
        });
      } else {
        console.log('No progress data found for this user/assessment combination');
      }

      return progress;
    } catch (error) {
      console.error('Error testing user progress:', error);
      throw error;
    }
  }

  /**
   * Test cached analytics functionality
   */
  async testCachedAnalytics(assessmentId: string) {
    try {
      console.log(`Testing cached analytics for assessment: ${assessmentId}`);
      
      // Try to get cached analytics first
      let cached = await this.analyticsService.getCachedAssessmentAnalytics(assessmentId);
      console.log('Cached analytics found:', !!cached);

      // Update cache with fresh data
      await this.analyticsService.updateCachedAnalytics(assessmentId);
      console.log('Cache updated successfully');

      // Verify cached data is now available
      cached = await this.analyticsService.getCachedAssessmentAnalytics(assessmentId);
      console.log('Cached analytics after update:', {
        total_attempts: cached?.total_attempts,
        avg_score: cached?.avg_score,
        pass_rate: cached?.pass_rate
      });

      return cached;
    } catch (error) {
      console.error('Error testing cached analytics:', error);
      throw error;
    }
  }

  /**
   * Run a comprehensive test suite
   */
  async runComprehensiveTest(assessmentId: string, userId?: string) {
    console.log('=== Starting Comprehensive Analytics Test ===');
    
    try {
      // Test 1: Assessment Analytics
      console.log('\n1. Testing Assessment Analytics...');
      const analytics = await this.testAssessmentAnalytics(assessmentId);

      // Test 2: Student Results (if userId provided)
      if (userId) {
        console.log('\n2. Testing Student Results...');
        await this.testStudentResults(userId, assessmentId);

        console.log('\n3. Testing User Progress...');
        await this.testUserProgress(userId, assessmentId);
      }

      // Test 3: Cached Analytics
      console.log('\n4. Testing Cached Analytics...');
      await this.testCachedAnalytics(assessmentId);

      console.log('\n=== All Tests Completed Successfully ===');
      return true;
    } catch (error) {
      console.error('\n=== Test Suite Failed ===', error);
      return false;
    }
  }

  /**
   * Validate analytics computation accuracy
   */
  validateAnalyticsAccuracy(analytics: any) {
    const issues = [];

    // Check for logical inconsistencies
    if (analytics.total_attempts < 0) {
      issues.push('Total attempts cannot be negative');
    }

    if (analytics.average_score !== null && (analytics.average_score < 0 || analytics.average_score > 100)) {
      issues.push('Average score should be between 0 and 100');
    }

    if (analytics.pass_rate !== null && (analytics.pass_rate < 0 || analytics.pass_rate > 100)) {
      issues.push('Pass rate should be between 0 and 100');
    }

    if (analytics.unique_users > analytics.total_attempts) {
      issues.push('Unique users cannot exceed total attempts');
    }

    // Check question stats
    analytics.question_stats?.forEach((stat: any, index: number) => {
      if (stat.correct_percentage < 0 || stat.correct_percentage > 100) {
        issues.push(`Question ${index + 1}: Correct percentage out of range`);
      }
      
      if (stat.correct_responses > stat.total_responses) {
        issues.push(`Question ${index + 1}: Correct responses exceed total responses`);
      }
    });

    return issues;
  }
}

// Export a default instance for easy testing
export const analyticsTestUtils = new AnalyticsTestUtils(); 