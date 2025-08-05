import { createSupabaseServiceClient } from '@/lib/supabase/server';

export interface GenerationLogEntry {
  jobId: string;
  level: 'info' | 'warning' | 'error' | 'critical';
  message: string;
  details?: any;
  timestamp: Date;
  source: string;
  userId?: string;
  taskId?: string;
  errorCode?: string;
  stackTrace?: string;
}

export interface GenerationAlert {
  jobId: string;
  alertType: 'stall' | 'failure' | 'timeout' | 'critical_error' | 'recovery_failed';
  severity: 'low' | 'medium' | 'high' | 'critical';
  message: string;
  details: any;
  timestamp: Date;
  userId?: string;
  resolved: boolean;
  resolvedAt?: Date;
  resolvedBy?: string;
}

export class CourseGenerationLogger {
  private supabase = createSupabaseServiceClient();

  private isCreatingAlert = false; // Prevent infinite loops

  /**
   * Log a generation event
   */
  async log(entry: Omit<GenerationLogEntry, 'timestamp'>): Promise<void> {
    try {
      const logEntry: GenerationLogEntry = {
        ...entry,
        timestamp: new Date()
      };

      // Log to console for immediate visibility
      const logMessage = `[${logEntry.level.toUpperCase()}] ${logEntry.source}: ${logEntry.message}`;
      
      switch (logEntry.level) {
        case 'error':
        case 'critical':
          console.error(logMessage, logEntry.details);
          break;
        case 'warning':
          console.warn(logMessage, logEntry.details);
          break;
        default:
          console.log(logMessage, logEntry.details);
      }

      // Store in database
      await (this.supabase as any)
        .from('course_generation_logs')
        .insert({
          job_id: logEntry.jobId,
          level: logEntry.level,
          message: logEntry.message,
          details: logEntry.details || {},
          timestamp: logEntry.timestamp.toISOString(),
          source: logEntry.source,
          user_id: logEntry.userId,
          task_id: logEntry.taskId,
          error_code: logEntry.errorCode,
          stack_trace: logEntry.stackTrace
        });

      // Create alert for high-severity issues (with loop prevention)
      if ((logEntry.level === 'error' || logEntry.level === 'critical') && 
          !this.isCreatingAlert && 
          logEntry.source !== 'alert_system') {
        this.isCreatingAlert = true;
        try {
          await this.createAlert({
            jobId: logEntry.jobId,
            alertType: logEntry.errorCode === 'TIMEOUT' ? 'timeout' : 'critical_error',
            severity: logEntry.level === 'critical' ? 'critical' : 'high',
            message: logEntry.message,
            details: logEntry.details || {},
            timestamp: logEntry.timestamp,
            userId: logEntry.userId,
            resolved: false
          });
        } finally {
          this.isCreatingAlert = false;
        }
      }

    } catch (error) {
      // Fallback logging - don't let logging failures break the main process
      console.error('Failed to log generation event:', error);
      console.error('Original log entry:', entry);
    }
  }

  /**
   * Log info message
   */
  async logInfo(jobId: string, message: string, source: string, details?: any): Promise<void> {
    await this.log({
      jobId,
      level: 'info',
      message,
      source,
      details
    });
  }

  /**
   * Log warning message
   */
  async logWarning(jobId: string, message: string, source: string, details?: any): Promise<void> {
    await this.log({
      jobId,
      level: 'warning',
      message,
      source,
      details
    });
  }

  /**
   * Log error message
   */
  async logError(
    jobId: string, 
    message: string, 
    source: string, 
    error?: Error | any, 
    errorCode?: string
  ): Promise<void> {
    await this.log({
      jobId,
      level: 'error',
      message,
      source,
      details: error ? {
        error: error.message || error,
        name: error.name,
        cause: error.cause
      } : undefined,
      errorCode,
      stackTrace: error?.stack
    });
  }

  /**
   * Log critical error message
   */
  async logCritical(
    jobId: string, 
    message: string, 
    source: string, 
    error?: Error | any, 
    errorCode?: string
  ): Promise<void> {
    await this.log({
      jobId,
      level: 'critical',
      message,
      source,
      details: error ? {
        error: error.message || error,
        name: error.name,
        cause: error.cause
      } : undefined,
      errorCode,
      stackTrace: error?.stack
    });
  }

  /**
   * Create an alert for monitoring
   */
  async createAlert(alert: Omit<GenerationAlert, 'timestamp'>): Promise<void> {
    try {
      const alertEntry: GenerationAlert = {
        ...alert,
        timestamp: new Date()
      };

      // For now, just log to our generation_logs table and console
      await this.logCritical(
        alertEntry.jobId,
        `ALERT: ${alertEntry.message}`,
        'alert_system',
        alertEntry.details
      );

      // For critical alerts, also log to console
      if (alertEntry.severity === 'critical') {
        console.error(`🚨 CRITICAL ALERT: ${alertEntry.message}`, alertEntry.details);
      }

    } catch (error) {
      console.error('Failed to create alert:', error);
    }
  }

  /**
   * Resolve an alert
   */
  async resolveAlert(jobId: string, alertType: string, resolvedBy?: string): Promise<void> {
    try {
      // For now, just log the resolution
      await this.logInfo(
        jobId,
        `Alert resolved: ${alertType}`,
        'alert_system',
        { resolvedBy }
      );
    } catch (error) {
      console.error('Failed to resolve alert:', error);
    }
  }

  /**
   * Get logs for a job
   */
  async getJobLogs(jobId: string, limit: number = 100): Promise<GenerationLogEntry[]> {
    try {
      // TODO: Uncomment when course_generation_logs table is created
      // const { data, error } = await this.supabase
      //   .from('course_generation_logs')
      //   .select('*')
      //   .eq('job_id', jobId)
      //   .order('timestamp', { ascending: false })
      //   .limit(limit);

      // if (error) throw error;

      // return (data || []).map(log => ({
      //   jobId: log.job_id,
      //   level: log.level,
      //   message: log.message,
      //   details: log.details,
      //   timestamp: new Date(log.timestamp),
      //   source: log.source,
      //   userId: log.user_id,
      //   taskId: log.task_id,
      //   errorCode: log.error_code,
      //   stackTrace: log.stack_trace
      // }));

      // Temporary return empty array until table is created
      return [];

    } catch (error) {
      console.error('Failed to get job logs:', error);
      return [];
    }
  }

  /**
   * Get active alerts for a job
   */
  async getJobAlerts(jobId: string): Promise<GenerationAlert[]> {
    try {
      // TODO: Uncomment when course_generation_alerts table is created
      // const { data, error } = await this.supabase
      //   .from('course_generation_alerts')
      //   .select('*')
      //   .eq('job_id', jobId)
      //   .eq('resolved', false)
      //   .order('timestamp', { ascending: false });

      // if (error) throw error;

      // return (data || []).map(alert => ({
      //   jobId: alert.job_id,
      //   alertType: alert.alert_type,
      //   severity: alert.severity,
      //   message: alert.message,
      //   details: alert.details,
      //   timestamp: new Date(alert.timestamp),
      //   userId: alert.user_id,
      //   resolved: alert.resolved,
      //   resolvedAt: alert.resolved_at ? new Date(alert.resolved_at) : undefined,
      //   resolvedBy: alert.resolved_by
      // }));

      // Temporary return empty array until table is created
      return [];

    } catch (error) {
      console.error('Failed to get job alerts:', error);
      return [];
    }
  }

  /**
   * Log task execution start
   */
  async logTaskStart(jobId: string, taskId: string, taskType: string): Promise<void> {
    await this.logInfo(
      jobId,
      `Starting task: ${taskType}`,
      'task_executor',
      { taskId, taskType, action: 'start' }
    );
  }

  /**
   * Log task execution completion
   */
  async logTaskComplete(jobId: string, taskId: string, taskType: string, duration: number): Promise<void> {
    await this.logInfo(
      jobId,
      `Completed task: ${taskType} in ${duration}ms`,
      'task_executor',
      { taskId, taskType, duration, action: 'complete' }
    );
  }

  /**
   * Log task execution failure
   */
  async logTaskFailure(
    jobId: string, 
    taskId: string, 
    taskType: string, 
    error: Error | any, 
    retryCount: number
  ): Promise<void> {
    await this.logError(
      jobId,
      `Task failed: ${taskType} (retry ${retryCount})`,
      'task_executor',
      error,
      'TASK_FAILURE'
    );
  }

  /**
   * Log recovery attempt
   */
  async logRecoveryAttempt(
    jobId: string, 
    recoveryType: string, 
    reason: string,
    details?: any
  ): Promise<void> {
    await this.logWarning(
      jobId,
      `Recovery attempt: ${recoveryType} - ${reason}`,
      'resilience_monitor',
      { recoveryType, reason, ...details }
    );
  }

  /**
   * Log recovery success
   */
  async logRecoverySuccess(
    jobId: string, 
    recoveryType: string, 
    details?: any
  ): Promise<void> {
    await this.logInfo(
      jobId,
      `Recovery successful: ${recoveryType}`,
      'resilience_monitor',
      { recoveryType, ...details }
    );

    // Resolve related alerts
    await this.resolveAlert(jobId, 'stall', 'auto_recovery');
    await this.resolveAlert(jobId, 'failure', 'auto_recovery');
  }

  /**
   * Log recovery failure
   */
  async logRecoveryFailure(
    jobId: string, 
    recoveryType: string, 
    error: Error | any,
    details?: any
  ): Promise<void> {
    await this.logCritical(
      jobId,
      `Recovery failed: ${recoveryType}`,
      'resilience_monitor',
      error,
      'RECOVERY_FAILED'
    );

    // Create high-priority alert
    await this.createAlert({
      jobId,
      alertType: 'recovery_failed',
      severity: 'critical',
      message: `Recovery failed: ${recoveryType}`,
      details: { recoveryType, error: error?.message, ...details },
      resolved: false
    });
  }
}

// Create database tables for logging if they don't exist
export const initializeLoggingTables = async () => {
  const supabase = createSupabaseServiceClient();

  // This would typically be done via migrations, but including here for reference
  const createLogsTable = `
    CREATE TABLE IF NOT EXISTS course_generation_logs (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      job_id UUID NOT NULL,
      level TEXT NOT NULL CHECK (level IN ('info', 'warning', 'error', 'critical')),
      message TEXT NOT NULL,
      details JSONB DEFAULT '{}',
      timestamp TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      source TEXT NOT NULL,
      user_id UUID,
      task_id TEXT,
      error_code TEXT,
      stack_trace TEXT,
      created_at TIMESTAMPTZ DEFAULT NOW()
    );

    CREATE INDEX IF NOT EXISTS idx_logs_job_id ON course_generation_logs(job_id);
    CREATE INDEX IF NOT EXISTS idx_logs_level ON course_generation_logs(level);
    CREATE INDEX IF NOT EXISTS idx_logs_timestamp ON course_generation_logs(timestamp);
  `;

  try {
    // TODO: Uncomment when exec_sql function is available and logging tables are needed
    // await supabase.rpc('exec_sql', { sql: createLogsTable });
  } catch (error) {
    console.error('Failed to initialize logging tables:', error);
  }
};

// Export singleton instance
export const generationLogger = new CourseGenerationLogger();