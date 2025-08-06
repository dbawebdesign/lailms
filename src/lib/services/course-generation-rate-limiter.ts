import { createSupabaseServiceClient } from '@/lib/supabase/server';

export interface RateLimitConfig {
  requests_per_minute: number;
  requests_per_hour: number;
  requests_per_day: number;
  concurrent_jobs: number;
  burst_allowance: number;
}

export interface RateLimitResult {
  allowed: boolean;
  reason?: string;
  retry_after?: number;
  current_usage?: {
    minute: number;
    hour: number;
    day: number;
    active_jobs: number;
  };
}

// Default rate limits by user role
const DEFAULT_RATE_LIMITS: Record<string, RateLimitConfig> = {
  student: {
    requests_per_minute: 2,
    requests_per_hour: 10,
    requests_per_day: 50,
    concurrent_jobs: 1,
    burst_allowance: 3
  },
  teacher: {
    requests_per_minute: 5,
    requests_per_hour: 30,
    requests_per_day: 200,
    concurrent_jobs: 3,
    burst_allowance: 5
  },
  admin: {
    requests_per_minute: 10,
    requests_per_hour: 100,
    requests_per_day: 1000,
    concurrent_jobs: 10,
    burst_allowance: 10
  },
  super_admin: {
    requests_per_minute: 20,
    requests_per_hour: 500,
    requests_per_day: 5000,
    concurrent_jobs: 20,
    burst_allowance: 20
  }
};

// Global rate limits (across all users)
const GLOBAL_RATE_LIMITS = {
  max_concurrent_jobs: 100,
  max_jobs_per_minute: 50,
  max_api_calls_per_minute: 200
};

export class CourseGenerationRateLimiter {
  private supabase = createSupabaseServiceClient();

  /**
   * Check if a user can start a new course generation job
   */
  async checkRateLimit(userId: string, userRole: string = 'student'): Promise<RateLimitResult> {
    try {
      // Get user's current rate limit data
      const { data: rateLimitData, error } = await this.supabase
        .from('course_generation_rate_limits')
        .select('*')
        .eq('user_id', userId)
        .single();

      if (error && error.code !== 'PGRST116') { // Not found error
        console.error('Error fetching rate limits:', error);
        return { allowed: false, reason: 'Rate limit check failed' };
      }

      // Initialize rate limit data if not exists
      if (!rateLimitData) {
        await this.initializeUserRateLimit(userId);
        return { allowed: true }; // Allow first request
      }

      // Reset counters if time windows have passed
      const now = new Date();
      const resetData = await this.resetExpiredCounters(userId, rateLimitData, now);
      
      // Get rate limit config for user role
      const limits = DEFAULT_RATE_LIMITS[userRole] || DEFAULT_RATE_LIMITS.student;

      // Check concurrent jobs limit
      if (resetData.active_jobs >= limits.concurrent_jobs) {
        return {
          allowed: false,
          reason: `Maximum concurrent jobs (${limits.concurrent_jobs}) reached`,
          current_usage: {
            minute: resetData.minute_count,
            hour: resetData.hour_count,
            day: resetData.day_count,
            active_jobs: resetData.active_jobs
          }
        };
      }

      // Check rate limits
      if (resetData.minute_count >= limits.requests_per_minute) {
        const retryAfter = Math.ceil((new Date(resetData.last_minute_reset).getTime() + 60000 - now.getTime()) / 1000);
        return {
          allowed: false,
          reason: `Rate limit exceeded: ${limits.requests_per_minute} requests per minute`,
          retry_after: retryAfter,
          current_usage: {
            minute: resetData.minute_count,
            hour: resetData.hour_count,
            day: resetData.day_count,
            active_jobs: resetData.active_jobs
          }
        };
      }

      if (resetData.hour_count >= limits.requests_per_hour) {
        const retryAfter = Math.ceil((new Date(resetData.last_hour_reset).getTime() + 3600000 - now.getTime()) / 1000);
        return {
          allowed: false,
          reason: `Rate limit exceeded: ${limits.requests_per_hour} requests per hour`,
          retry_after: retryAfter,
          current_usage: {
            minute: resetData.minute_count,
            hour: resetData.hour_count,
            day: resetData.day_count,
            active_jobs: resetData.active_jobs
          }
        };
      }

      if (resetData.day_count >= limits.requests_per_day) {
        const retryAfter = Math.ceil((new Date(resetData.last_day_reset).getTime() + 86400000 - now.getTime()) / 1000);
        return {
          allowed: false,
          reason: `Daily limit exceeded: ${limits.requests_per_day} requests per day`,
          retry_after: retryAfter,
          current_usage: {
            minute: resetData.minute_count,
            hour: resetData.hour_count,
            day: resetData.day_count,
            active_jobs: resetData.active_jobs
          }
        };
      }

      // Check global limits
      const globalCheck = await this.checkGlobalLimits();
      if (!globalCheck.allowed) {
        return globalCheck;
      }

      // All checks passed
      return {
        allowed: true,
        current_usage: {
          minute: resetData.minute_count,
          hour: resetData.hour_count,
          day: resetData.day_count,
          active_jobs: resetData.active_jobs
        }
      };

    } catch (error) {
      console.error('Rate limit check error:', error);
      return { allowed: false, reason: 'Rate limit check failed' };
    }
  }

  /**
   * Increment rate limit counters when a job starts
   */
  async incrementUsage(userId: string): Promise<void> {
    try {
      await this.supabase.rpc('increment_rate_limit_counters', {
        p_user_id: userId
      });
    } catch (error) {
      console.error('Failed to increment rate limit counters:', error);
    }
  }

  /**
   * Decrement active jobs count when a job completes
   */
  async decrementActiveJobs(userId: string): Promise<void> {
    try {
      // Get current value and update it
      const { data } = await this.supabase
        .from('course_generation_rate_limits')
        .select('active_jobs')
        .eq('user_id', userId)
        .single();
      
      if (data && data.active_jobs && data.active_jobs > 0) {
        await this.supabase
          .from('course_generation_rate_limits')
          .update({ active_jobs: data.active_jobs - 1 })
          .eq('user_id', userId);
      }
    } catch (error) {
      console.error('Failed to decrement active jobs:', error);
    }
  }

  /**
   * Initialize rate limit data for a new user
   */
  private async initializeUserRateLimit(userId: string) {
    await this.supabase
      .from('course_generation_rate_limits')
      .insert({
        user_id: userId,
        minute_count: 0,
        hour_count: 0,
        day_count: 0,
        active_jobs: 0,
        last_minute_reset: new Date().toISOString(),
        last_hour_reset: new Date().toISOString(),
        last_day_reset: new Date().toISOString()
      });
  }

  /**
   * Reset expired time window counters
   */
  private async resetExpiredCounters(userId: string, currentData: any, now: Date) {
    const updates: any = {};
    let needsUpdate = false;

    // Check minute window
    if (now.getTime() - new Date(currentData.last_minute_reset).getTime() >= 60000) {
      updates.minute_count = 0;
      updates.last_minute_reset = now.toISOString();
      needsUpdate = true;
    }

    // Check hour window
    if (now.getTime() - new Date(currentData.last_hour_reset).getTime() >= 3600000) {
      updates.hour_count = 0;
      updates.last_hour_reset = now.toISOString();
      needsUpdate = true;
    }

    // Check day window
    if (now.getTime() - new Date(currentData.last_day_reset).getTime() >= 86400000) {
      updates.day_count = 0;
      updates.last_day_reset = now.toISOString();
      needsUpdate = true;
    }

    if (needsUpdate) {
      const { data, error } = await this.supabase
        .from('course_generation_rate_limits')
        .update(updates)
        .eq('user_id', userId)
        .select()
        .single();

      return data || currentData;
    }

    return currentData;
  }

  /**
   * Check global system-wide rate limits
   */
  private async checkGlobalLimits(): Promise<RateLimitResult> {
    try {
      // Count active jobs across all users
      const { count: activeJobs } = await this.supabase
        .from('course_generation_jobs')
        .select('*', { count: 'exact', head: true })
        .in('status', ['processing', 'pending']);

      if ((activeJobs || 0) >= GLOBAL_RATE_LIMITS.max_concurrent_jobs) {
        return {
          allowed: false,
          reason: 'System at maximum capacity. Please try again later.',
          retry_after: 60
        };
      }

      // Check jobs started in last minute
      const oneMinuteAgo = new Date(Date.now() - 60000).toISOString();
      const { count: recentJobs } = await this.supabase
        .from('course_generation_jobs')
        .select('*', { count: 'exact', head: true })
        .gte('created_at', oneMinuteAgo);

      if ((recentJobs || 0) >= GLOBAL_RATE_LIMITS.max_jobs_per_minute) {
        return {
          allowed: false,
          reason: 'System experiencing high load. Please try again in a minute.',
          retry_after: 60
        };
      }

      return { allowed: true };

    } catch (error) {
      console.error('Global rate limit check error:', error);
      // Allow on error to avoid blocking all users
      return { allowed: true };
    }
  }

  /**
   * Get current usage statistics for a user
   */
  async getUserUsageStats(userId: string) {
    try {
      const { data } = await this.supabase
        .from('course_generation_rate_limits')
        .select('*')
        .eq('user_id', userId)
        .single();

      if (!data) {
        return null;
      }

      // Get user role for limits
      const { data: profile } = await this.supabase
        .from('profiles')
        .select('role')
        .eq('user_id', userId)
        .single();

      const userRole = profile?.role || 'student';
      const limits = DEFAULT_RATE_LIMITS[userRole] || DEFAULT_RATE_LIMITS.student;

      return {
        current: {
          minute: data.minute_count || 0,
          hour: data.hour_count || 0,
          day: data.day_count || 0,
          active_jobs: data.active_jobs || 0
        },
        limits: {
          minute: limits.requests_per_minute,
          hour: limits.requests_per_hour,
          day: limits.requests_per_day,
          concurrent_jobs: limits.concurrent_jobs
        },
        percentages: {
          minute: ((data.minute_count || 0) / limits.requests_per_minute) * 100,
          hour: ((data.hour_count || 0) / limits.requests_per_hour) * 100,
          day: ((data.day_count || 0) / limits.requests_per_day) * 100,
          concurrent: ((data.active_jobs || 0) / limits.concurrent_jobs) * 100
        }
      };

    } catch (error) {
      console.error('Failed to get usage stats:', error);
      return null;
    }
  }
}

// Create RPC function for atomic increment
export const createRateLimitRPCFunction = `
CREATE OR REPLACE FUNCTION increment_rate_limit_counters(p_user_id UUID)
RETURNS void AS $$
BEGIN
  UPDATE course_generation_rate_limits
  SET 
    minute_count = minute_count + 1,
    hour_count = hour_count + 1,
    day_count = day_count + 1,
    active_jobs = active_jobs + 1,
    updated_at = NOW()
  WHERE user_id = p_user_id;
  
  -- Insert if not exists
  IF NOT FOUND THEN
    INSERT INTO course_generation_rate_limits (
      user_id, minute_count, hour_count, day_count, active_jobs
    ) VALUES (
      p_user_id, 1, 1, 1, 1
    );
  END IF;
END;
$$ LANGUAGE plpgsql;
`;