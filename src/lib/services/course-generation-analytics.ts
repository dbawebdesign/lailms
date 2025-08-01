import { createSupabaseServerClient } from '@/lib/supabase/server';
import { 
  CourseGenerationAnalytics,
  CourseGenerationAnalyticsInsert,
  CourseGenerationJob,
  CourseGenerationTask,
  CourseGenerationError,
  PerformanceMetrics
} from '@/types/course-generation';

// Performance tracking interfaces
export interface TaskPerformanceMetrics {
  taskId: string;
  taskType: string;
  executionTime: number;
  memoryUsage: number;
  apiCalls: number;
  tokensConsumed: number;
  cacheHitRate: number;
  errorCount: number;
  retryCount: number;
}

export interface SystemMetrics {
  cpuUsage: number;
  memoryUsage: number;
  networkLatency: number;
  databaseConnections: number;
  queueSize: number;
  timestamp: Date;
}

export interface QualityMetrics {
  contentCoherence: number;
  knowledgeBaseUtilization: number;
  assessmentQuality: number;
  structuralComplexity: number;
  userSatisfactionPrediction: number;
}

// Analytics collection and reporting service
export class CourseGenerationAnalytics {
  private supabase = createSupabaseServerClient();
  private performanceBuffer: TaskPerformanceMetrics[] = [];
  private systemMetricsBuffer: SystemMetrics[] = [];
  private startTime: number = Date.now();
  private baselineMetrics: Map<string, number> = new Map();

  constructor() {
    // Initialize baseline metrics for comparison
    this.initializeBaselines();
    
    // Start system monitoring
    this.startSystemMonitoring();
  }

  /**
   * Initialize baseline performance metrics
   */
  private async initializeBaselines(): Promise<void> {
    // Get historical averages for comparison
    const { data: historicalData } = await this.supabase
      .from('course_generation_analytics')
      .select('*')
      .gte('created_at', new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString()) // Last 30 days
      .order('created_at', { ascending: false })
      .limit(100);

    if (historicalData && historicalData.length > 0) {
      // Calculate baseline averages
      const avgTime = historicalData.reduce((sum, d) => sum + (d.total_generation_time_seconds || 0), 0) / historicalData.length;
      const avgSuccess = historicalData.reduce((sum, d) => sum + (d.success_rate || 0), 0) / historicalData.length;
      const avgTokens = historicalData.reduce((sum, d) => sum + (d.tokens_consumed || 0), 0) / historicalData.length;
      
      this.baselineMetrics.set('avgExecutionTime', avgTime);
      this.baselineMetrics.set('avgSuccessRate', avgSuccess);
      this.baselineMetrics.set('avgTokenConsumption', avgTokens);
    }
  }

  /**
   * Start continuous system monitoring
   */
  private startSystemMonitoring(): void {
    // Monitor system metrics every 30 seconds
    setInterval(() => {
      this.collectSystemMetrics();
    }, 30000);

    // Flush performance buffer every 5 minutes
    setInterval(() => {
      this.flushPerformanceBuffer();
    }, 300000);
  }

  /**
   * Collect current system metrics
   */
  private async collectSystemMetrics(): Promise<void> {
    try {
      const metrics: SystemMetrics = {
        cpuUsage: await this.getCPUUsage(),
        memoryUsage: process.memoryUsage().heapUsed / 1024 / 1024, // MB
        networkLatency: await this.measureNetworkLatency(),
        databaseConnections: await this.getDatabaseConnectionCount(),
        queueSize: await this.getQueueSize(),
        timestamp: new Date()
      };

      this.systemMetricsBuffer.push(metrics);

      // Keep only last 100 metrics in buffer
      if (this.systemMetricsBuffer.length > 100) {
        this.systemMetricsBuffer = this.systemMetricsBuffer.slice(-100);
      }
    } catch (error) {
      console.error('Failed to collect system metrics:', error);
    }
  }

  /**
   * Track task performance metrics
   */
  trackTaskPerformance(
    taskId: string,
    taskType: string,
    metrics: Partial<TaskPerformanceMetrics>
  ): void {
    const performanceMetric: TaskPerformanceMetrics = {
      taskId,
      taskType,
      executionTime: metrics.executionTime || 0,
      memoryUsage: metrics.memoryUsage || 0,
      apiCalls: metrics.apiCalls || 0,
      tokensConsumed: metrics.tokensConsumed || 0,
      cacheHitRate: metrics.cacheHitRate || 0,
      errorCount: metrics.errorCount || 0,
      retryCount: metrics.retryCount || 0
    };

    this.performanceBuffer.push(performanceMetric);
  }

  /**
   * Calculate comprehensive job analytics
   */
  async calculateJobAnalytics(jobId: string): Promise<CourseGenerationAnalyticsInsert> {
    // Get job data
    const { data: job } = await this.supabase
      .from('course_generation_jobs')
      .select('*')
      .eq('id', jobId)
      .single();

    // Get all tasks for this job
    const { data: tasks } = await this.supabase
      .from('course_generation_tasks')
      .select('*')
      .eq('job_id', jobId);

    // Get all errors for this job
    const { data: errors } = await this.supabase
      .from('course_generation_errors')
      .select('*')
      .eq('job_id', jobId);

    if (!job || !tasks) {
      throw new Error('Job or tasks not found');
    }

    // Calculate basic metrics
    const totalTasks = tasks.length;
    const completedTasks = tasks.filter(t => t.status === 'completed').length;
    const failedTasks = tasks.filter(t => t.status === 'failed').length;
    const skippedTasks = tasks.filter(t => t.status === 'skipped').length;

    // Calculate timing metrics
    const totalExecutionTime = tasks.reduce((sum, t) => sum + (t.actual_duration_seconds || 0), 0);
    const avgTaskTime = totalTasks > 0 ? totalExecutionTime / totalTasks : 0;

    // Calculate API and token metrics
    const apiCallsFromBuffer = this.performanceBuffer
      .filter(p => tasks.some(t => t.id === p.taskId))
      .reduce((sum, p) => sum + p.apiCalls, 0);
    
    const tokensFromBuffer = this.performanceBuffer
      .filter(p => tasks.some(t => t.id === p.taskId))
      .reduce((sum, p) => p.tokensConsumed, 0);

    // Calculate success rate
    const successRate = totalTasks > 0 ? (completedTasks / totalTasks) * 100 : 0;

    // Calculate quality metrics
    const qualityMetrics = await this.calculateQualityMetrics(jobId, tasks);

    // Calculate cost estimation
    const estimatedCost = this.calculateCostEstimate(tokensFromBuffer, apiCallsFromBuffer);

    // Compare with baseline
    const baselineComparison = this.calculateBaselineComparison(totalExecutionTime, successRate, tokensFromBuffer);

    // Calculate cache efficiency
    const cacheHitRate = this.calculateCacheHitRate();

    // Get system performance during job
    const avgSystemMetrics = this.getAverageSystemMetrics();

    const analytics: CourseGenerationAnalyticsInsert = {
      job_id: jobId,
      total_generation_time_seconds: totalExecutionTime,
      average_task_time_seconds: avgTaskTime,
      success_rate: successRate,
      api_calls_made: apiCallsFromBuffer,
      api_calls_failed: errors?.length || 0,
      tokens_consumed: tokensFromBuffer,
      estimated_cost_usd: estimatedCost,
      cache_hit_rate: cacheHitRate,
      total_sections_generated: tasks.filter(t => t.task_type === 'lesson_section' && t.status === 'completed').length,
      total_lessons_generated: this.countUniqueValues(tasks.filter(t => t.status === 'completed'), 'lesson_id'),
      total_assessments_generated: tasks.filter(t => t.task_type.includes('assessment') && t.status === 'completed').length,
      content_quality_score: qualityMetrics.overallQuality,
      user_satisfaction_score: qualityMetrics.userSatisfactionPrediction,
      peak_memory_usage_mb: Math.max(...this.systemMetricsBuffer.map(m => m.memoryUsage)),
      avg_cpu_usage_percent: avgSystemMetrics.avgCpuUsage,
      database_queries_count: this.estimateDatabaseQueries(tasks.length),
      baseline_time_comparison_percent: baselineComparison.timeComparison,
      previous_job_improvement_percent: await this.calculateImprovementRate(jobId),
      knowledge_base_size_mb: await this.getKnowledgeBaseSize(job.base_class_id)
    };

    return analytics;
  }

  /**
   * Calculate content quality metrics
   */
  private async calculateQualityMetrics(jobId: string, tasks: CourseGenerationTask[]): Promise<QualityMetrics & { overallQuality: number }> {
    // This would integrate with content analysis services
    // For now, we'll estimate based on task completion and error rates
    
    const completedTasks = tasks.filter(t => t.status === 'completed');
    const taskTypes = new Set(completedTasks.map(t => t.task_type));
    
    // Content coherence based on task variety and completion
    const contentCoherence = Math.min(100, (taskTypes.size / 9) * 100); // 9 total task types
    
    // Knowledge base utilization (would be calculated from actual usage)
    const knowledgeBaseUtilization = 75; // Placeholder
    
    // Assessment quality based on assessment task success
    const assessmentTasks = completedTasks.filter(t => t.task_type.includes('assessment'));
    const assessmentQuality = assessmentTasks.length > 0 ? 85 : 0;
    
    // Structural complexity based on lesson hierarchy
    const structuralComplexity = Math.min(100, (completedTasks.length / tasks.length) * 100);
    
    // User satisfaction prediction based on completion rate and error frequency
    const { data: errors } = await this.supabase
      .from('course_generation_errors')
      .select('error_severity')
      .eq('job_id', jobId);
    
    const criticalErrors = errors?.filter(e => e.error_severity === 'critical').length || 0;
    const userSatisfactionPrediction = Math.max(0, 100 - (criticalErrors * 20));
    
    const overallQuality = (contentCoherence + knowledgeBaseUtilization + assessmentQuality + structuralComplexity + userSatisfactionPrediction) / 5;

    return {
      contentCoherence,
      knowledgeBaseUtilization,
      assessmentQuality,
      structuralComplexity,
      userSatisfactionPrediction,
      overallQuality
    };
  }

  /**
   * Calculate cost estimate based on usage
   */
  private calculateCostEstimate(tokens: number, apiCalls: number): number {
    // Rough cost estimation (would use actual pricing)
    const tokenCost = (tokens / 1000) * 0.002; // $0.002 per 1K tokens
    const apiCallCost = apiCalls * 0.0001; // $0.0001 per API call
    return tokenCost + apiCallCost;
  }

  /**
   * Compare with baseline metrics
   */
  private calculateBaselineComparison(
    executionTime: number,
    successRate: number,
    tokens: number
  ): { timeComparison: number; successComparison: number; tokenComparison: number } {
    const baselineTime = this.baselineMetrics.get('avgExecutionTime') || executionTime;
    const baselineSuccess = this.baselineMetrics.get('avgSuccessRate') || successRate;
    const baselineTokens = this.baselineMetrics.get('avgTokenConsumption') || tokens;

    return {
      timeComparison: baselineTime > 0 ? ((executionTime - baselineTime) / baselineTime) * 100 : 0,
      successComparison: baselineSuccess > 0 ? ((successRate - baselineSuccess) / baselineSuccess) * 100 : 0,
      tokenComparison: baselineTokens > 0 ? ((tokens - baselineTokens) / baselineTokens) * 100 : 0
    };
  }

  /**
   * Calculate cache hit rate
   */
  private calculateCacheHitRate(): number {
    const totalRequests = this.performanceBuffer.reduce((sum, p) => sum + p.apiCalls, 0);
    const cacheHits = this.performanceBuffer.reduce((sum, p) => sum + (p.cacheHitRate * p.apiCalls), 0);
    
    return totalRequests > 0 ? (cacheHits / totalRequests) * 100 : 0;
  }

  /**
   * Get average system metrics during job execution
   */
  private getAverageSystemMetrics(): { avgCpuUsage: number; avgMemoryUsage: number } {
    if (this.systemMetricsBuffer.length === 0) {
      return { avgCpuUsage: 0, avgMemoryUsage: 0 };
    }

    const avgCpuUsage = this.systemMetricsBuffer.reduce((sum, m) => sum + m.cpuUsage, 0) / this.systemMetricsBuffer.length;
    const avgMemoryUsage = this.systemMetricsBuffer.reduce((sum, m) => sum + m.memoryUsage, 0) / this.systemMetricsBuffer.length;

    return { avgCpuUsage, avgMemoryUsage };
  }

  /**
   * Calculate improvement rate compared to previous job
   */
  private async calculateImprovementRate(currentJobId: string): Promise<number> {
    const { data: previousJob } = await this.supabase
      .from('course_generation_analytics')
      .select('success_rate')
      .neq('job_id', currentJobId)
      .order('created_at', { ascending: false })
      .limit(1)
      .single();

    if (!previousJob) return 0;

    const { data: currentAnalytics } = await this.supabase
      .from('course_generation_analytics')
      .select('success_rate')
      .eq('job_id', currentJobId)
      .single();

    if (!currentAnalytics) return 0;

    const improvement = ((currentAnalytics.success_rate - previousJob.success_rate) / previousJob.success_rate) * 100;
    return improvement;
  }

  /**
   * Generate comprehensive analytics report
   */
  async generateAnalyticsReport(jobId: string): Promise<{
    summary: any;
    performance: any;
    quality: any;
    recommendations: string[];
  }> {
    const analytics = await this.calculateJobAnalytics(jobId);
    
    const summary = {
      totalTime: analytics.total_generation_time_seconds,
      successRate: analytics.success_rate,
      tasksCompleted: analytics.total_sections_generated + analytics.total_assessments_generated,
      costEstimate: analytics.estimated_cost_usd,
      qualityScore: analytics.content_quality_score
    };

    const performance = {
      avgTaskTime: analytics.average_task_time_seconds,
      apiEfficiency: analytics.cache_hit_rate,
      resourceUsage: {
        cpu: analytics.avg_cpu_usage_percent,
        memory: analytics.peak_memory_usage_mb
      },
      baselineComparison: analytics.baseline_time_comparison_percent
    };

    const quality = {
      contentQuality: analytics.content_quality_score,
      userSatisfaction: analytics.user_satisfaction_score,
      knowledgeUtilization: analytics.knowledge_base_size_mb
    };

    const recommendations = this.generateRecommendations(analytics);

    return { summary, performance, quality, recommendations };
  }

  /**
   * Generate optimization recommendations
   */
  private generateRecommendations(analytics: CourseGenerationAnalyticsInsert): string[] {
    const recommendations: string[] = [];

    if (analytics.success_rate < 95) {
      recommendations.push('Consider reviewing error patterns to improve success rate');
    }

    if (analytics.cache_hit_rate < 60) {
      recommendations.push('Implement more aggressive caching to reduce API costs');
    }

    if (analytics.avg_cpu_usage_percent > 80) {
      recommendations.push('Consider scaling resources or optimizing CPU-intensive tasks');
    }

    if (analytics.baseline_time_comparison_percent > 20) {
      recommendations.push('Generation time is above baseline - review performance optimizations');
    }

    if (analytics.content_quality_score < 80) {
      recommendations.push('Content quality could be improved - consider enhancing prompts or knowledge base');
    }

    return recommendations;
  }

  // Helper methods for system metrics
  private async getCPUUsage(): Promise<number> {
    // Would integrate with system monitoring
    return Math.random() * 100; // Placeholder
  }

  private async measureNetworkLatency(): Promise<number> {
    const start = Date.now();
    try {
      await this.supabase.from('course_generation_jobs').select('id').limit(1);
      return Date.now() - start;
    } catch {
      return 1000; // Default high latency on error
    }
  }

  private async getDatabaseConnectionCount(): Promise<number> {
    // Would query database connection pool
    return 10; // Placeholder
  }

  private async getQueueSize(): Promise<number> {
    const { data } = await this.supabase
      .from('course_generation_tasks')
      .select('id')
      .eq('status', 'queued');
    
    return data?.length || 0;
  }

  private async getKnowledgeBaseSize(baseClassId: string | null): Promise<number> {
    if (!baseClassId) return 0;

    const { data } = await this.supabase
      .from('document_chunks')
      .select('token_count')
      .eq('base_class_id', baseClassId);

    return data?.reduce((sum, chunk) => sum + (chunk.token_count || 0), 0) || 0;
  }

  private countUniqueValues(array: any[], key: string): number {
    return new Set(array.map(item => item[key]).filter(Boolean)).size;
  }

  private estimateDatabaseQueries(taskCount: number): number {
    // Rough estimate: each task involves ~5-10 database operations
    return taskCount * 7;
  }

  private flushPerformanceBuffer(): void {
    // In production, this would batch insert to analytics table
    console.log(`Flushing ${this.performanceBuffer.length} performance metrics`);
    this.performanceBuffer = [];
  }

  /**
   * Store job analytics in the database
   */
  async storeJobAnalytics(jobId: string, analytics: CourseGenerationAnalyticsInsert): Promise<void> {
    try {
      const { error } = await this.supabase
        .from('course_generation_analytics')
        .insert({
          ...analytics,
          job_id: jobId,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString()
        });

      if (error) {
        console.error('Failed to store job analytics:', error);
        throw new Error(`Failed to store analytics: ${error.message}`);
      }

      console.log(`✅ Successfully stored analytics for job ${jobId}`);
    } catch (error) {
      console.error('Error storing job analytics:', error);
      throw error;
    }
  }
} 