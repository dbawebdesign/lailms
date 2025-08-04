/**
 * Production Supabase Realtime Configuration
 * 
 * Centralized configuration for all Realtime settings based on:
 * - Supabase quotas and rate limits
 * - Production best practices
 * - Performance optimization
 */

export const REALTIME_CONFIG = {
  // Connection Management
  CONNECTION: {
    // Maximum channels per connection (Supabase limit: 100)
    MAX_CHANNELS_PER_CONNECTION: 95, // Leave some buffer
    
    // Connection timeout settings
    CONNECT_TIMEOUT: 10000, // 10 seconds
    HEARTBEAT_INTERVAL: 30000, // 30 seconds
    
    // Retry configuration
    MAX_RETRY_ATTEMPTS: 3,
    INITIAL_RETRY_DELAY: 1000, // 1 second
    MAX_RETRY_DELAY: 30000, // 30 seconds
    RETRY_BACKOFF_MULTIPLIER: 2,
    
    // Health check interval
    HEALTH_CHECK_INTERVAL: 10000, // 10 seconds
    
    // Stale connection threshold
    STALE_CONNECTION_THRESHOLD: 5 * 60 * 1000, // 5 minutes
  },

  // Rate Limiting (based on Supabase quotas)
  RATE_LIMITS: {
    // Free plan limits (conservative)
    FREE_PLAN: {
      CONCURRENT_CONNECTIONS: 180, // Buffer from 200 limit
      MESSAGES_PER_SECOND: 90, // Buffer from 100 limit
      CHANNEL_JOINS_PER_SECOND: 90, // Buffer from 100 limit
    },
    
    // Pro plan limits
    PRO_PLAN: {
      CONCURRENT_CONNECTIONS: 450, // Buffer from 500 limit
      MESSAGES_PER_SECOND: 450, // Buffer from 500 limit
      CHANNEL_JOINS_PER_SECOND: 450, // Buffer from 500 limit
    },
    
    // Team plan limits
    TEAM_PLAN: {
      CONCURRENT_CONNECTIONS: 9500, // Buffer from 10,000 limit
      MESSAGES_PER_SECOND: 2250, // Buffer from 2,500 limit
      CHANNEL_JOINS_PER_SECOND: 2250, // Buffer from 2,500 limit
    },
  },

  // Channel Configuration
  CHANNELS: {
    // Default channel configuration
    DEFAULT_CONFIG: {
      broadcast: { self: false },
      presence: { key: 'default' },
      private: false
    },
    
    // Channel naming patterns
    NAMING: {
      JOB_SUBSCRIPTION: (jobId: string) => `course-job-${jobId}`,
      TASKS_SUBSCRIPTION: (jobId: string) => `course-tasks-${jobId}`,
      USER_JOBS_SUBSCRIPTION: (userId: string) => `user-jobs-${userId}`,
    },
  },

  // Error Handling
  ERROR_HANDLING: {
    // Error types that should trigger reconnection
    RECONNECTABLE_ERRORS: [
      'CHANNEL_ERROR',
      'TIMED_OUT',
      'NETWORK_ERROR',
      'CONNECTION_LOST'
    ],
    
    // Error types that should not trigger reconnection
    NON_RECONNECTABLE_ERRORS: [
      'UNAUTHORIZED',
      'FORBIDDEN',
      'INVALID_TOKEN',
      'QUOTA_EXCEEDED'
    ],
    
    // Maximum error rate before circuit breaker
    MAX_ERROR_RATE: 0.1, // 10%
    ERROR_RATE_WINDOW: 60000, // 1 minute
  },

  // Background Resilience
  BACKGROUND: {
    // Enable background tab handling
    ENABLE_BACKGROUND_RESILIENCE: true,
    
    // Visibility change handling
    RECONNECT_ON_VISIBLE: true,
    PAUSE_ON_HIDDEN: false, // Keep connections alive in background
    
    // Background connection timeout
    BACKGROUND_TIMEOUT: 10 * 60 * 1000, // 10 minutes
  },

  // Monitoring and Metrics
  MONITORING: {
    // Enable metrics collection
    ENABLE_METRICS: true,
    
    // Metrics collection interval
    METRICS_INTERVAL: 30000, // 30 seconds
    
    // Health check thresholds
    HEALTH_THRESHOLDS: {
      MAX_ERROR_RATE: 0.05, // 5%
      MIN_UPTIME: 0.95, // 95%
      MAX_RECONNECT_RATE: 0.1, // 10%
    },
    
    // Debug logging
    ENABLE_DEBUG_LOGGING: process.env.NODE_ENV === 'development',
    LOG_LEVEL: process.env.NODE_ENV === 'development' ? 'debug' : 'info',
  },

  // Performance Optimization
  PERFORMANCE: {
    // Batch operations
    ENABLE_BATCHING: true,
    BATCH_SIZE: 10,
    BATCH_TIMEOUT: 100, // 100ms
    
    // Connection pooling
    ENABLE_CONNECTION_POOLING: true,
    POOL_SIZE: 5,
    
    // Memory management
    ENABLE_MEMORY_CLEANUP: true,
    CLEANUP_INTERVAL: 5 * 60 * 1000, // 5 minutes
    
    // Debouncing
    DEBOUNCE_UPDATES: true,
    DEBOUNCE_DELAY: 100, // 100ms
  },

  // Security
  SECURITY: {
    // JWT validation
    VALIDATE_JWT: true,
    JWT_REFRESH_THRESHOLD: 5 * 60 * 1000, // 5 minutes before expiry
    
    // Channel authorization
    REQUIRE_AUTHORIZATION: true,
    
    // Rate limiting per user
    USER_RATE_LIMITING: true,
    MAX_CHANNELS_PER_USER: 10,
  },

  // Development vs Production
  ENVIRONMENT: {
    DEVELOPMENT: {
      ENABLE_VERBOSE_LOGGING: true,
      ENABLE_DEBUG_METRICS: true,
      RELAXED_RATE_LIMITS: true,
      ENABLE_HOT_RELOAD_RECOVERY: true,
    },
    
    PRODUCTION: {
      ENABLE_VERBOSE_LOGGING: false,
      ENABLE_DEBUG_METRICS: false,
      STRICT_RATE_LIMITS: true,
      ENABLE_ERROR_REPORTING: true,
    },
  },
} as const;

// Environment-specific configuration
export function getEnvironmentConfig() {
  const isDevelopment = process.env.NODE_ENV === 'development';
  return isDevelopment ? REALTIME_CONFIG.ENVIRONMENT.DEVELOPMENT : REALTIME_CONFIG.ENVIRONMENT.PRODUCTION;
}

// Plan-specific rate limits
export function getPlanLimits(plan: 'free' | 'pro' | 'team' = 'pro') {
  switch (plan) {
    case 'free':
      return REALTIME_CONFIG.RATE_LIMITS.FREE_PLAN;
    case 'pro':
      return REALTIME_CONFIG.RATE_LIMITS.PRO_PLAN;
    case 'team':
      return REALTIME_CONFIG.RATE_LIMITS.TEAM_PLAN;
    default:
      return REALTIME_CONFIG.RATE_LIMITS.PRO_PLAN;
  }
}

// Validate configuration at runtime
export function validateRealtimeConfig() {
  const config = REALTIME_CONFIG;
  const errors: string[] = [];

  // Validate connection settings
  if (config.CONNECTION.MAX_CHANNELS_PER_CONNECTION > 100) {
    errors.push('MAX_CHANNELS_PER_CONNECTION exceeds Supabase limit of 100');
  }

  if (config.CONNECTION.HEARTBEAT_INTERVAL < 10000) {
    errors.push('HEARTBEAT_INTERVAL should be at least 10 seconds');
  }

  // Validate rate limits
  const freeLimits = config.RATE_LIMITS.FREE_PLAN;
  if (freeLimits.CONCURRENT_CONNECTIONS > 200) {
    errors.push('Free plan concurrent connections exceed Supabase limit');
  }

  if (errors.length > 0) {
    console.error('❌ Realtime configuration validation failed:', errors);
    throw new Error(`Invalid Realtime configuration: ${errors.join(', ')}`);
  }

  console.log('✅ Realtime configuration validated successfully');
  return true;
}

// Initialize configuration
if (typeof window !== 'undefined' || process.env.NODE_ENV === 'development') {
  validateRealtimeConfig();
}