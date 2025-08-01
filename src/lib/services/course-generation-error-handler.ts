import { createSupabaseServerClient } from '@/lib/supabase/server';
import { 
  CourseGenerationError,
  CourseGenerationErrorInsert,
  CourseGenerationErrorSeverity,
  CourseGenerationTask
} from '@/types/course-generation';

// Error Categories with descriptions
export enum ErrorCategory {
  API_LIMIT = 'api_limit',
  API_TIMEOUT = 'api_timeout',
  API_INVALID_RESPONSE = 'api_invalid_response',
  KNOWLEDGE_BASE_EMPTY = 'knowledge_base_empty',
  KNOWLEDGE_BASE_INSUFFICIENT = 'knowledge_base_insufficient',
  DATABASE_CONNECTION = 'database_connection',
  DATABASE_CONSTRAINT = 'database_constraint',
  FILE_SYSTEM_ACCESS = 'file_system_access',
  FILE_SYSTEM_STORAGE = 'file_system_storage',
  CONTENT_VALIDATION = 'content_validation',
  CONTENT_GENERATION = 'content_generation',
  PERMISSION_DENIED = 'permission_denied',
  RESOURCE_NOT_FOUND = 'resource_not_found',
  MEMORY_EXCEEDED = 'memory_exceeded',
  TASK_DEPENDENCY = 'task_dependency',
  UNKNOWN = 'unknown'
}

// Error classification interface
export interface ClassifiedError {
  category: ErrorCategory;
  severity: CourseGenerationErrorSeverity;
  isRetryable: boolean;
  suggestedActions: string[];
  retryStrategy: RetryStrategy;
  userMessage: string;
  technicalDetails: any;
}

// Retry strategies
export interface RetryStrategy {
  type: 'exponential' | 'linear' | 'immediate' | 'none';
  maxRetries: number;
  initialDelay: number;
  maxDelay: number;
  backoffFactor: number;
}

// Error patterns for classification
const ERROR_PATTERNS = [
  {
    pattern: /rate limit|too many requests|429/i,
    category: ErrorCategory.API_LIMIT,
    severity: 'medium' as CourseGenerationErrorSeverity,
    isRetryable: true,
    retryStrategy: {
      type: 'exponential' as const,
      maxRetries: 5,
      initialDelay: 5000,
      maxDelay: 60000,
      backoffFactor: 2
    },
    suggestedActions: [
      'Wait for rate limit to reset',
      'Reduce parallel API calls',
      'Implement request queuing'
    ],
    userMessage: 'The AI service is temporarily busy. We\'ll automatically retry in a few moments.'
  },
  {
    pattern: /timeout|timed out|ETIMEDOUT|ECONNABORTED/i,
    category: ErrorCategory.API_TIMEOUT,
    severity: 'low' as CourseGenerationErrorSeverity,
    isRetryable: true,
    retryStrategy: {
      type: 'linear' as const,
      maxRetries: 3,
      initialDelay: 2000,
      maxDelay: 10000,
      backoffFactor: 1
    },
    suggestedActions: [
      'Check network connectivity',
      'Reduce request payload size',
      'Increase timeout threshold'
    ],
    userMessage: 'The request took longer than expected. Retrying with optimized settings.'
  },
  {
    pattern: /no documents found|empty knowledge base|no chunks available/i,
    category: ErrorCategory.KNOWLEDGE_BASE_EMPTY,
    severity: 'critical' as CourseGenerationErrorSeverity,
    isRetryable: false,
    retryStrategy: {
      type: 'none' as const,
      maxRetries: 0,
      initialDelay: 0,
      maxDelay: 0,
      backoffFactor: 0
    },
    suggestedActions: [
      'Upload documents to knowledge base',
      'Verify document processing completed',
      'Check knowledge base permissions'
    ],
    userMessage: 'No learning materials found. Please upload documents before generating the course.'
  },
  {
    pattern: /insufficient content|not enough material|minimal chunks/i,
    category: ErrorCategory.KNOWLEDGE_BASE_INSUFFICIENT,
    severity: 'high' as CourseGenerationErrorSeverity,
    isRetryable: false,
    retryStrategy: {
      type: 'none' as const,
      maxRetries: 0,
      initialDelay: 0,
      maxDelay: 0,
      backoffFactor: 0
    },
    suggestedActions: [
      'Upload additional learning materials',
      'Reduce course scope or duration',
      'Switch to standard generation mode'
    ],
    userMessage: 'Limited learning materials available. Upload more documents for better course quality.'
  },
  {
    pattern: /database.*connect|ECONNREFUSED.*5432|connection refused/i,
    category: ErrorCategory.DATABASE_CONNECTION,
    severity: 'critical' as CourseGenerationErrorSeverity,
    isRetryable: true,
    retryStrategy: {
      type: 'exponential' as const,
      maxRetries: 3,
      initialDelay: 1000,
      maxDelay: 5000,
      backoffFactor: 2
    },
    suggestedActions: [
      'Check database server status',
      'Verify connection credentials',
      'Review firewall settings'
    ],
    userMessage: 'Temporary database connection issue. Automatically retrying...'
  },
  {
    pattern: /unique constraint|duplicate key|foreign key violation/i,
    category: ErrorCategory.DATABASE_CONSTRAINT,
    severity: 'medium' as CourseGenerationErrorSeverity,
    isRetryable: false,
    retryStrategy: {
      type: 'none' as const,
      maxRetries: 0,
      initialDelay: 0,
      maxDelay: 0,
      backoffFactor: 0
    },
    suggestedActions: [
      'Check for duplicate content',
      'Verify data integrity',
      'Clean up orphaned records'
    ],
    userMessage: 'Data conflict detected. Our team has been notified to resolve this.'
  },
  {
    pattern: /EACCES|permission denied|access denied/i,
    category: ErrorCategory.PERMISSION_DENIED,
    severity: 'high' as CourseGenerationErrorSeverity,
    isRetryable: false,
    retryStrategy: {
      type: 'none' as const,
      maxRetries: 0,
      initialDelay: 0,
      maxDelay: 0,
      backoffFactor: 0
    },
    suggestedActions: [
      'Verify user permissions',
      'Check resource ownership',
      'Review access policies'
    ],
    userMessage: 'Permission issue encountered. Please contact support if this persists.'
  },
  {
    pattern: /out of memory|heap out of memory|ENOMEM/i,
    category: ErrorCategory.MEMORY_EXCEEDED,
    severity: 'critical' as CourseGenerationErrorSeverity,
    isRetryable: true,
    retryStrategy: {
      type: 'immediate' as const,
      maxRetries: 1,
      initialDelay: 0,
      maxDelay: 0,
      backoffFactor: 0
    },
    suggestedActions: [
      'Reduce batch size',
      'Process in smaller chunks',
      'Increase memory allocation'
    ],
    userMessage: 'Resource limit reached. Adjusting settings and retrying...'
  }
];

export class CourseGenerationErrorHandler {
  private supabase = createSupabaseServerClient();

  /**
   * Classify an error based on its message and context
   */
  classifyError(error: Error | any, context?: any): ClassifiedError {
    const errorMessage = error?.message || error?.toString() || 'Unknown error';
    
    // Try to match against known patterns
    for (const pattern of ERROR_PATTERNS) {
      if (pattern.pattern.test(errorMessage)) {
        return {
          category: pattern.category,
          severity: pattern.severity,
          isRetryable: pattern.isRetryable,
          suggestedActions: pattern.suggestedActions,
          retryStrategy: pattern.retryStrategy,
          userMessage: pattern.userMessage,
          technicalDetails: {
            originalError: errorMessage,
            stack: error?.stack,
            context
          }
        };
      }
    }

    // Default classification for unknown errors
    return {
      category: ErrorCategory.UNKNOWN,
      severity: 'medium',
      isRetryable: true,
      suggestedActions: [
        'Review error logs',
        'Contact technical support',
        'Retry with default settings'
      ],
      retryStrategy: {
        type: 'exponential',
        maxRetries: 2,
        initialDelay: 1000,
        maxDelay: 5000,
        backoffFactor: 2
      },
      userMessage: 'An unexpected error occurred. We\'re working to resolve it.',
      technicalDetails: {
        originalError: errorMessage,
        stack: error?.stack,
        context
      }
    };
  }

  /**
   * Log error to database with classification
   */
  async logError(
    jobId: string,
    taskId: string | null,
    error: Error | any,
    context?: any
  ): Promise<CourseGenerationError | null> {
    try {
      const classified = this.classifyError(error, context);
      
      const errorRecord: CourseGenerationErrorInsert = {
        job_id: jobId,
        task_id: taskId,
        error_type: error?.name || 'Error',
        error_category: classified.category,
        error_severity: classified.severity,
        error_message: error?.message || 'Unknown error',
        error_stack: error?.stack,
        is_retryable: classified.isRetryable,
        retry_strategy: classified.retryStrategy.type,
        suggested_actions: classified.suggestedActions,
        error_context: {
          ...context,
          classification: classified
        },
        request_metadata: {
          timestamp: new Date().toISOString(),
          environment: process.env.NODE_ENV
        }
      };

      const { data, error: dbError } = await this.supabase
        .from('course_generation_errors')
        .insert(errorRecord)
        .select()
        .single();

      if (dbError) {
        console.error('Failed to log error to database:', dbError);
        return null;
      }

      return data;
    } catch (e) {
      console.error('Error in error handler:', e);
      return null;
    }
  }

  /**
   * Check if task should be retried based on error history
   */
  async shouldRetryTask(
    task: CourseGenerationTask,
    latestError: ClassifiedError
  ): Promise<boolean> {
    // Check if error is retryable
    if (!latestError.isRetryable) {
      return false;
    }

    // Check retry count against max retries
    const currentRetries = task.current_retry_count || 0;
    if (currentRetries >= latestError.retryStrategy.maxRetries) {
      return false;
    }

    // Check for repeated failures
    const { data: recentErrors } = await this.supabase
      .from('course_generation_errors')
      .select('*')
      .eq('task_id', task.id)
      .eq('error_category', latestError.category)
      .gte('created_at', new Date(Date.now() - 3600000).toISOString()) // Last hour
      .order('created_at', { ascending: false });

    if (recentErrors && recentErrors.length >= 3) {
      // Too many similar errors recently
      return false;
    }

    return true;
  }

  /**
   * Calculate retry delay based on strategy
   */
  calculateRetryDelay(
    retryCount: number,
    strategy: RetryStrategy
  ): number {
    switch (strategy.type) {
      case 'immediate':
        return 0;
      
      case 'linear':
        return Math.min(
          strategy.initialDelay + (retryCount * strategy.initialDelay),
          strategy.maxDelay
        );
      
      case 'exponential':
        return Math.min(
          strategy.initialDelay * Math.pow(strategy.backoffFactor, retryCount),
          strategy.maxDelay
        );
      
      default:
        return 0;
    }
  }

  /**
   * Get recovery suggestions for a specific error
   */
  getRecoverySuggestions(error: ClassifiedError): string[] {
    const suggestions = [...error.suggestedActions];

    // Add context-specific suggestions
    if (error.severity === 'critical') {
      suggestions.unshift('⚠️ Critical error - manual intervention may be required');
    }

    if (error.isRetryable) {
      suggestions.push(`✓ This error is recoverable - automatic retry available`);
    } else {
      suggestions.push('❌ This error requires manual resolution');
    }

    return suggestions;
  }

  /**
   * Analyze error patterns for a job
   */
  async analyzeErrorPatterns(jobId: string) {
    const { data: errors } = await this.supabase
      .from('course_generation_errors')
      .select('*')
      .eq('job_id', jobId)
      .order('created_at', { ascending: false });

    if (!errors || errors.length === 0) {
      return null;
    }

    // Group errors by category
    const errorsByCategory = errors.reduce((acc, error) => {
      const category = error.error_category;
      if (!acc[category]) {
        acc[category] = [];
      }
      acc[category].push(error);
      return acc;
    }, {} as Record<string, CourseGenerationError[]>);

    // Find patterns
    const patterns = {
      mostCommonCategory: Object.entries(errorsByCategory)
        .sort(([, a], [, b]) => b.length - a.length)[0]?.[0],
      criticalErrorCount: errors.filter(e => e.error_severity === 'critical').length,
      retryableErrorCount: errors.filter(e => e.is_retryable).length,
      averageTimeToResolve: this.calculateAverageResolutionTime(errors),
      suggestions: this.generatePatternBasedSuggestions(errorsByCategory)
    };

    return patterns;
  }

  private calculateAverageResolutionTime(errors: CourseGenerationError[]): number {
    const resolvedErrors = errors.filter(e => e.resolved_at);
    if (resolvedErrors.length === 0) return 0;

    const totalTime = resolvedErrors.reduce((sum, error) => {
      const created = new Date(error.created_at!).getTime();
      const resolved = new Date(error.resolved_at!).getTime();
      return sum + (resolved - created);
    }, 0);

    return totalTime / resolvedErrors.length;
  }

  private generatePatternBasedSuggestions(
    errorsByCategory: Record<string, CourseGenerationError[]>
  ): string[] {
    const suggestions: string[] = [];

    // Check for API limit issues
    if (errorsByCategory[ErrorCategory.API_LIMIT]?.length > 3) {
      suggestions.push('Consider implementing request throttling or upgrading API plan');
    }

    // Check for knowledge base issues
    if (errorsByCategory[ErrorCategory.KNOWLEDGE_BASE_EMPTY] || 
        errorsByCategory[ErrorCategory.KNOWLEDGE_BASE_INSUFFICIENT]) {
      suggestions.push('Ensure sufficient documents are uploaded before generation');
    }

    // Check for persistent database issues
    if (errorsByCategory[ErrorCategory.DATABASE_CONNECTION]?.length > 2) {
      suggestions.push('Database connectivity issues detected - check connection pool settings');
    }

    return suggestions;
  }
} 