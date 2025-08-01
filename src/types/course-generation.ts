// Course Generation Type Definitions
// Based on Supabase schema

import { Tables, TablesInsert, TablesUpdate } from '@/lib/database.types';

// Database table types
export type CourseGenerationJob = Tables<'course_generation_jobs'>;
export type CourseGenerationTask = Tables<'course_generation_tasks'>;
export type CourseGenerationError = Tables<'course_generation_errors'>;
export type CourseGenerationAnalytics = Tables<'course_generation_analytics'>;
export type CourseGenerationUserAction = Tables<'course_generation_user_actions'>;

// Insert types
export type CourseGenerationJobInsert = TablesInsert<'course_generation_jobs'>;
export type CourseGenerationTaskInsert = TablesInsert<'course_generation_tasks'>;
export type CourseGenerationErrorInsert = TablesInsert<'course_generation_errors'>;
export type CourseGenerationAnalyticsInsert = TablesInsert<'course_generation_analytics'>;
export type CourseGenerationUserActionInsert = TablesInsert<'course_generation_user_actions'>;

// Update types
export type CourseGenerationJobUpdate = TablesUpdate<'course_generation_jobs'>;
export type CourseGenerationTaskUpdate = TablesUpdate<'course_generation_tasks'>;

// Enums from database
export type CourseGenerationTaskType = 
  | 'lesson_section'
  | 'lesson_assessment'
  | 'lesson_mind_map'
  | 'lesson_brainbytes'
  | 'path_quiz'
  | 'class_exam'
  | 'knowledge_analysis'
  | 'outline_generation'
  | 'content_validation';

export type CourseGenerationTaskStatus = 
  | 'pending'
  | 'queued'
  | 'running'
  | 'completed'
  | 'failed'
  | 'skipped'
  | 'retrying'
  | 'cancelled';

export type CourseGenerationErrorSeverity = 
  | 'low'
  | 'medium'
  | 'high'
  | 'critical';

// API Response Types
export interface CourseGenerationJobDetails extends CourseGenerationJob {
  base_classes?: {
    id: string;
    name: string;
    subject?: string | null;
    grade_level?: string | null;
  };
}

export interface CourseGenerationTaskWithDetails extends CourseGenerationTask {
  error_count?: number;
}

export interface CourseGenerationAnalyticsDetails extends CourseGenerationAnalytics {
  job?: CourseGenerationJob;
}

// User Action Types
export type UserActionType = 
  | 'retry_task'
  | 'skip_task'
  | 'pause_job'
  | 'resume_job'
  | 'cancel_job'
  | 'export_report'
  | 'view_details';

// Analytics Summary Types
export interface TaskAnalytics {
  totalTasks: number;
  completedTasks: number;
  failedTasks: number;
  skippedTasks: number;
  pendingTasks: number;
  avgExecutionTime: number;
  tasksByType: Record<CourseGenerationTaskType, number>;
  tasksByStatus: Record<CourseGenerationTaskStatus, number>;
}

export interface ErrorAnalytics {
  totalErrors: number;
  errorsBySeverity: Record<CourseGenerationErrorSeverity, number>;
  errorsByCategory: Record<string, number>;
  errorsByTask: Record<string, number>;
  recoveryRate: number;
  criticalErrors: CourseGenerationError[];
}

// API Request/Response Types
export interface CreateUserActionRequest {
  jobId: string;
  actionType: UserActionType;
  taskIds?: string[];
  actionContext?: any;
}

export interface CreateUserActionResponse {
  success: boolean;
  action: CourseGenerationUserAction;
  affectedTasks?: CourseGenerationTask[];
}

export interface TaskRecoveryRequest {
  taskId: string;
  strategy?: 'retry' | 'skip' | 'manual';
  maxRetries?: number;
}

export interface TaskRecoveryResponse {
  success: boolean;
  task: CourseGenerationTask;
  message: string;
}

// Performance Metrics Types
export interface PerformanceMetrics {
  totalExecutionTime: number;
  apiCallsCount: number;
  tokensConsumed: number;
  estimatedCost: number;
  cacheHitRate: number;
  parallelizationEfficiency: number;
  resourceUtilization: {
    cpuUsage: number;
    memoryUsage: number;
    networkBandwidth: number;
  };
}

// Export Report Types
export interface ExportReportOptions {
  includeAnalytics: boolean;
  includeTasks: boolean;
  includeErrors: boolean;
  includePerformance: boolean;
  format: 'json' | 'csv' | 'pdf';
}

export interface CourseGenerationReport {
  job: CourseGenerationJob;
  tasks: CourseGenerationTask[];
  errors: CourseGenerationError[];
  analytics: CourseGenerationAnalytics;
  userActions: CourseGenerationUserAction[];
  summary: {
    duration: number;
    successRate: number;
    totalCost: number;
    recommendations: string[];
  };
}

// Component Props Types
export interface EnhancedCourseGenerationMonitorProps {
  jobId: string;
  onComplete?: (job: CourseGenerationJob) => void;
  onError?: (error: Error) => void;
  autoRefresh?: boolean;
  refreshInterval?: number;
}

export interface TaskCardProps {
  task: CourseGenerationTaskWithDetails;
  onRetry?: (taskId: string) => Promise<void>;
  onSkip?: (taskId: string) => Promise<void>;
  onViewDetails?: (taskId: string) => void;
}

export interface ErrorDetailsProps {
  error: CourseGenerationError;
  onResolve?: (errorId: string) => Promise<void>;
  onIgnore?: (errorId: string) => Promise<void>;
}

// Utility Types
export type TaskGroupedByStatus = Record<CourseGenerationTaskStatus, CourseGenerationTask[]>;
export type ErrorGroupedBySeverity = Record<CourseGenerationErrorSeverity, CourseGenerationError[]>;

// Real-time Update Types
export interface CourseGenerationRealtimeUpdate {
  type: 'job_update' | 'task_update' | 'error_update' | 'analytics_update';
  jobId: string;
  payload: any;
  timestamp: string;
}

// Configuration Types
export interface CourseGenerationConfig {
  maxRetries: number;
  retryDelay: number;
  timeout: number;
  parallelTasks: number;
  enableAnalytics: boolean;
  enableRealtimeUpdates: boolean;
  notificationSettings: {
    onComplete: boolean;
    onError: boolean;
    onWarning: boolean;
  };
} 