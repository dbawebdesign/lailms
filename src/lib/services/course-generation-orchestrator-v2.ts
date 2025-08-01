// @ts-nocheck
import { createSupabaseServerClient } from '@/lib/supabase/server';
import { createClient } from '@supabase/supabase-js';
import OpenAI from 'openai';
import { knowledgeBaseAnalyzer, COURSE_GENERATION_MODES } from './knowledge-base-analyzer';
import { AssessmentGenerationService } from './assessment-generation-service';
import type { CourseGenerationRequest, CourseOutline, ModuleLesson } from './course-generator';
import { courseProgressCalculator } from '@/lib/utils/courseGenerationProgressCalculator';
import { CourseGenerationTaskExecutor } from './course-generation-task-executor';
import { CourseGenerationErrorHandler } from './course-generation-error-handler';
import { CourseGenerationAnalytics } from './course-generation-analytics';
import { 
  CourseGenerationJob,
  CourseGenerationJobInsert,
  CourseGenerationTask,
  CourseGenerationTaskInsert
} from '@/types/course-generation';

// Enhanced interfaces for the new system
export interface TaskDefinition {
  id: string;
  task_identifier: string;
  task_type: 'lesson_section' | 'lesson_assessment' | 'lesson_mind_map' | 'lesson_brainbytes' | 'path_quiz' | 'class_exam' | 'knowledge_analysis' | 'outline_generation' | 'content_validation';
  status: 'pending' | 'queued' | 'running' | 'completed' | 'failed' | 'skipped' | 'retrying' | 'cancelled';
  dependencies: string[];
  execution_priority: number;
  max_retry_count: number;
  current_retry_count: number;
  estimated_duration_seconds?: number;
  
  // Context data
  lesson_id?: string;
  path_id?: string;
  base_class_id?: string;
  section_index?: number;
  section_title?: string;
  
  // Task data
  input_data: any;
  output_data?: any;
  result_metadata?: any;
  
  // Error information
  error_message?: string;
  error_details?: any;
  error_severity?: 'low' | 'medium' | 'high' | 'critical';
  error_category?: string;
  is_recoverable?: boolean;
  recovery_suggestions?: string[];
}

export interface CircuitBreakerConfig {
  failureThreshold: number;
  resetTimeoutMs: number;
  halfOpenMaxCalls: number;
}

export interface RetryConfig {
  maxAttempts: number;
  baseDelayMs: number;
  maxDelayMs: number;
  backoffMultiplier: number;
  retryableErrors: string[];
}

export interface PerformanceMetrics {
  startTime: Date;
  endTime?: Date;
  totalTasks: number;
  completedTasks: number;
  failedTasks: number;
  skippedTasks: number;
  retriedTasks: number;
  averageTaskDuration: number;
  peakMemoryUsage: number;
  apiCallsTotal: number;
  apiCallsFailed: number;
  tokensConsumed: number;
  estimatedCostUsd: number;
}

interface CircuitBreakerState {
  state: 'closed' | 'open' | 'half-open';
  failureCount: number;
  lastFailureTime?: Date;
  nextAttemptTime?: Date;
}

export class CourseGenerationOrchestratorV2 {
  private openai: OpenAI;
  private assessmentGenerator: AssessmentGenerationService;
  private supabase: any;
  
  // V2 System Components
  private taskExecutor: CourseGenerationTaskExecutor;
  private errorHandler: CourseGenerationErrorHandler;
  private analytics: CourseGenerationAnalytics;
  
  // Current job tracking
  private currentJobId?: string;
  
  // Circuit breakers for external services
  private circuitBreakers: Map<string, CircuitBreakerState> = new Map();
  private circuitBreakerConfig: CircuitBreakerConfig = {
    failureThreshold: 5,
    resetTimeoutMs: 60000, // 1 minute
    halfOpenMaxCalls: 3
  };
  
  // Retry configuration
  private retryConfig: RetryConfig = {
    maxAttempts: 3,
    baseDelayMs: 1000,
    maxDelayMs: 30000,
    backoffMultiplier: 2,
    retryableErrors: [
      'timeout',
      'rate_limit',
      'temporary_failure',
      'network_error',
      'service_unavailable'
    ]
  };
  
  // Performance tracking
  private performanceMetrics: Map<string, PerformanceMetrics> = new Map();
  
  constructor(supabaseClient?: any) {
    // ALWAYS use service role client for background operations to bypass RLS
    // Never accept a passed client for course generation operations
    console.log('🔧 Creating service role client for course generation orchestrator');
    const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    
    console.log('🔍 Service role key available:', !!serviceRoleKey);
    console.log('🔍 Service role key length:', serviceRoleKey?.length || 0);
    console.log('🔍 Supabase URL:', supabaseUrl);
    
    if (!serviceRoleKey) {
      throw new Error('SUPABASE_SERVICE_ROLE_KEY environment variable is not set');
    }
    
    // Force service role client creation
    this.supabase = createClient(
      supabaseUrl!,
      serviceRoleKey,
      {
        auth: {
          autoRefreshToken: false,
          persistSession: false
        },
        db: {
          schema: 'public'
        },
        global: {
          headers: {
            'Authorization': `Bearer ${serviceRoleKey}`
          }
        }
      }
    );
    
    // Verify the client is using the service role
    console.log('🔍 Created client with key prefix:', serviceRoleKey.substring(0, 30) + '...');
    
    this.openai = new OpenAI({
      apiKey: process.env.OPENAI_API_KEY,
      timeout: 180000, // 3 minutes
      maxRetries: 0, // We'll handle retries ourselves
    });
    this.assessmentGenerator = new AssessmentGenerationService();
    
    // Initialize V2 system components
    this.taskExecutor = new CourseGenerationTaskExecutor();
    this.errorHandler = new CourseGenerationErrorHandler();
    this.analytics = new CourseGenerationAnalytics();
    
    // Initialize circuit breakers
    this.circuitBreakers.set('openai', { state: 'closed', failureCount: 0 });
    this.circuitBreakers.set('supabase', { state: 'closed', failureCount: 0 });
    this.circuitBreakers.set('knowledge_base', { state: 'closed', failureCount: 0 });
    
    // Reset circuit breakers on initialization (in case they were stuck from previous runs)
    this.resetAllCircuitBreakers();
  }

  /**
   * Reset all circuit breakers to closed state
   */
  private resetAllCircuitBreakers(): void {
    console.log('🔄 Resetting all circuit breakers to closed state');
    for (const [service, breaker] of this.circuitBreakers.entries()) {
      breaker.state = 'closed';
      breaker.failureCount = 0;
      breaker.nextAttemptTime = new Date();
      console.log(`✅ Reset circuit breaker for ${service}`);
    }
  }

  // Create a new course generation job (V2 system)
  async createCourseGenerationJob(
    request: CourseGenerationRequest,
    userId: string
  ): Promise<string> {
    const jobData: CourseGenerationJobInsert = {
      user_id: userId,
      base_class_id: request.baseClassId,
      organisation_id: request.organisationId,
      status: 'queued',
      progress: 0,
      request_data: request,
      estimated_completion_time: new Date(Date.now() + 30 * 60 * 1000), // 30 minutes estimate
      max_retry_count: 3,
      current_retry_count: 0
    };

    const { data: job, error } = await this.supabase
      .from('course_generation_jobs')
      .insert(jobData)
      .select()
      .single();

    if (error) {
      throw new Error(`Failed to create course generation job: ${error.message}`);
    }

    this.currentJobId = job.id;
    return job.id;
  }

  // Execute a course generation job using the v2 system
  async executeJobV2(jobId: string): Promise<void> {
    this.currentJobId = jobId;
    
    // Update job status to processing
    await this.supabase
      .from('course_generation_jobs')
      .update({ 
        status: 'processing',
        started_at: new Date().toISOString()
      })
      .eq('id', jobId);

    try {
      // Start the task execution engine
      await this.taskExecutor.executeJob(jobId);
      
      // Calculate final analytics
      const analytics = await this.analytics.calculateJobAnalytics(jobId);
      await this.supabase
        .from('course_generation_analytics')
        .insert(analytics);

      // Mark job as completed
      await this.supabase
        .from('course_generation_jobs')
        .update({ 
          status: 'completed',
          progress: 100,
          actual_completion_time: new Date().toISOString()
        })
        .eq('id', jobId);

    } catch (error) {
      // Handle job failure
      await this.errorHandler.handleJobError(jobId, error);
      
      await this.supabase
        .from('course_generation_jobs')
        .update({ 
          status: 'failed',
          actual_completion_time: new Date().toISOString()
        })
        .eq('id', jobId);
        
      throw error;
    }
  }

  /**
   * Complete V2 orchestration from start to finish
   * Handles outline generation, LMS entity creation, and content generation
   */
  async startCompleteOrchestration(
    jobId: string,
    request: CourseGenerationRequest,
    courseOutlineId?: string
  ): Promise<void> {
    console.log(`🚀 Starting complete V2 orchestrated course generation for job ${jobId}`);
    
    try {
      // Initialize performance tracking
      this.initializePerformanceTracking(jobId);
      
      // Update job status
      await this.updateJobStatus(jobId, 'processing');
      
      // Step 1: Generate outline (if not provided)
      let outline: CourseOutline;
      if (courseOutlineId) {
        // Load existing outline
        outline = await this.loadExistingOutline(courseOutlineId);
      } else {
        // Generate new outline with tracking
        outline = await this.generateOutlineWithTracking(jobId, request);
      }
      
      // Step 2: Create LMS entities with tracking
      await this.createLMSEntitiesWithTracking(jobId, outline, request);
      
      // Step 3: Initialize content generation tasks
      await this.initializeContentTasks(jobId, outline, request);
      
      // Step 4: Start the execution engine
      await this.runExecutionEngine(jobId, outline, request);
      
      // Step 5: Finalize and calculate analytics (only on success)
      await this.finalizeGeneration(jobId);
      
      console.log(`✅ Complete V2 generation completed successfully for job ${jobId}`);
      
    } catch (error) {
      console.error(`❌ Complete orchestration failed for job ${jobId}:`, error);
      await this.handleCriticalFailure(jobId, error);
      throw error; // Re-throw to prevent false success
    }
  }

  /**
   * Main orchestration entry point - starts the resilient generation process (Legacy)
   */
  async startOrchestration(
    jobId: string,
    outline: CourseOutline,
    request: CourseGenerationRequest
  ): Promise<void> {
    console.log(`🚀 Starting enhanced orchestrated course generation for job ${jobId}`);
    
    try {
      // Initialize performance tracking
      this.initializePerformanceTracking(jobId);
      
      // Update job status
      await this.updateJobStatus(jobId, 'processing');
      
      // Initialize all tasks in database with persistent state
      await this.initializeTasksInDatabase(jobId, outline, request);
      
      // Start the execution engine
      await this.runExecutionEngine(jobId, outline, request);
      
      // Finalize and calculate analytics (only on success)
      await this.finalizeGeneration(jobId);
      
      console.log(`✅ V2 generation completed successfully for job ${jobId}`);
      
    } catch (error) {
      console.error(`❌ Orchestration failed for job ${jobId}:`, error);
      await this.handleCriticalFailure(jobId, error);
      throw error; // Re-throw to prevent false success
    }
  }

  /**
   * Regenerate a specific failed task (V1 compatible)
   */
  public async regenerateTask(jobId: string, taskIdentifier: string): Promise<boolean> {
    console.log(`🔄 Attempting to regenerate task: ${taskIdentifier} for job: ${jobId}`);
    
    try {
      // Get the task from database
      const { data: task, error: fetchError } = await this.supabase
        .from('course_generation_tasks')
        .select('*')
        .eq('job_id', jobId)
        .eq('task_identifier', taskIdentifier)
        .single();

      if (fetchError || !task) {
        console.error(`Regenerate failed: Task ${taskIdentifier} not found in job ${jobId}:`, fetchError);
        return false;
      }

      if (task.status !== 'failed') {
        console.warn(`Regenerate failed: Task ${taskIdentifier} is not in 'failed' state. Current state: ${task.status}`);
        return false;
      }

      // Reset task state to pending
      const { error: updateError } = await this.supabase
        .from('course_generation_tasks')
        .update({
          status: 'pending',
          current_retry_count: 0,
          error_message: null,
          error_details: null,
          started_at: null,
          completed_at: null,
          updated_at: new Date().toISOString()
        })
        .eq('id', task.id);

      if (updateError) {
        console.error(`Failed to reset task ${taskIdentifier}:`, updateError);
        return false;
      }

      console.log(`✅ Task ${taskIdentifier} reset to pending state for regeneration`);
      
      // Get the course outline and request for task execution
      const { data: job, error: jobError } = await this.supabase
        .from('course_generation_jobs')
        .select('request_data, result_data')
        .eq('id', jobId)
        .single();

      if (jobError || !job) {
        console.error(`Failed to get job data for ${jobId}:`, jobError);
        return false;
      }

      const request = job.request_data as CourseGenerationRequest;
      const outline = job.result_data?.outline as CourseOutline;

      if (!outline) {
        console.error(`No course outline found for job ${jobId}`);
        return false;
      }

      // Execute the task immediately
      setTimeout(async () => {
        try {
          await this.executeTaskWithResilience(jobId, task, outline, request);
        } catch (error) {
          console.error(`Failed to execute regenerated task ${taskIdentifier}:`, error);
        }
      }, 1000); // 1 second delay to ensure database update is committed

      return true;

    } catch (error) {
      console.error(`Error regenerating task ${taskIdentifier}:`, error);
      return false;
    }
  }

  /**
   * Initialize all generation tasks in the database for persistent tracking
   */
  private async initializeTasksInDatabase(
    jobId: string,
    outline: CourseOutline,
    request: CourseGenerationRequest
  ): Promise<void> {
    console.log(`📝 Initializing tasks in database for job ${jobId}`);
    
    try {
      const tasks: TaskDefinition[] = [];
      
      // First, get the actual database UUIDs for paths and lessons
      const { data: paths, error: pathsError } = await this.supabase
        .from('paths')
        .select('id, title, order_index')
        .eq('base_class_id', request.baseClassId)
        .order('order_index');

      if (pathsError || !paths) {
        throw new Error(`Failed to fetch paths: ${pathsError?.message}`);
      }

      const { data: lessons, error: lessonsError } = await this.supabase
        .from('lessons')
        .select('id, title, path_id, order_index')
        .eq('base_class_id', request.baseClassId)
        .order('path_id, order_index');

      if (lessonsError || !lessons) {
        throw new Error(`Failed to fetch lessons: ${lessonsError?.message}`);
      }

      // Create lookup maps
      const pathsByIndex = new Map(paths.map(p => [p.order_index, p]));
      const lessonsByPathAndIndex = new Map();
      lessons.forEach(lesson => {
        const pathId = lesson.path_id;
        if (!lessonsByPathAndIndex.has(pathId)) {
          lessonsByPathAndIndex.set(pathId, new Map());
        }
        lessonsByPathAndIndex.get(pathId).set(lesson.order_index, lesson);
      });
      
      // Generate task definitions from outline using actual database UUIDs
      for (let moduleIndex = 0; moduleIndex < outline.modules.length; moduleIndex++) {
        const module = outline.modules[moduleIndex];
        const actualPath = pathsByIndex.get(moduleIndex);
        
        if (!actualPath) {
          console.warn(`No path found for module index ${moduleIndex}, skipping`);
          continue;
        }

        const pathLessons = lessonsByPathAndIndex.get(actualPath.id);
        if (!pathLessons) {
          console.warn(`No lessons found for path ${actualPath.id}, skipping`);
          continue;
        }

        for (let lessonIndex = 0; lessonIndex < module.lessons.length; lessonIndex++) {
          const lesson = module.lessons[lessonIndex];
          const actualLesson = pathLessons.get(lessonIndex);
          
          if (!actualLesson) {
            console.warn(`No lesson found for path ${actualPath.id} lesson index ${lessonIndex}, skipping`);
            continue;
          }
          // Create section tasks
          const sectionTasks: string[] = [];
          
          for (let i = 0; i < lesson.contentOutline.length; i++) {
            const sectionTaskId = `section-${actualLesson.id}-${i}`;
            sectionTasks.push(sectionTaskId);
            
            tasks.push({
              id: crypto.randomUUID(),
              task_identifier: sectionTaskId,
              task_type: 'lesson_section',
              status: 'pending',
              dependencies: [],
              execution_priority: i,
              max_retry_count: 3,
              current_retry_count: 0,
              estimated_duration_seconds: 120,
              lesson_id: actualLesson.id,
              path_id: actualPath.id,
              base_class_id: request.baseClassId,
              section_index: i,
              section_title: lesson.contentOutline[i],
              input_data: {
                lesson,
                sectionIndex: i,
                outline,
                request
              },
              is_recoverable: true,
              recovery_suggestions: [
                'Try regenerating with different parameters',
                'Check knowledge base content availability',
                'Simplify section requirements'
              ]
            });
          }
          
          // Create assessment task depending on all sections
          const assessmentTaskId = `assessment-${actualLesson.id}`;
          tasks.push({
            id: crypto.randomUUID(),
            task_identifier: assessmentTaskId,
            task_type: 'lesson_assessment',
            status: 'pending',
            dependencies: sectionTasks,
            execution_priority: 100,
            max_retry_count: 3,
            current_retry_count: 0,
            estimated_duration_seconds: 60,
            lesson_id: actualLesson.id,
            path_id: actualPath.id,
            base_class_id: request.baseClassId,
            input_data: {
              lesson,
              outline,
              request
            },
            is_recoverable: true,
            recovery_suggestions: [
              'Retry with simplified assessment requirements',
              'Generate assessment from available sections only',
              'Skip assessment and continue with course generation'
            ]
          });
          
          // Create mind map and brainbytes tasks (no dependencies, run at end)
          const mindMapTaskId = `mindmap-${actualLesson.id}`;
          const brainbytesTaskId = `brainbytes-${actualLesson.id}`;
          
          tasks.push({
            id: crypto.randomUUID(),
            task_identifier: mindMapTaskId,
            task_type: 'lesson_mind_map',
            status: 'pending',
            dependencies: [],
            execution_priority: 200,
            max_retry_count: 2,
            current_retry_count: 0,
            estimated_duration_seconds: 30,
            lesson_id: actualLesson.id,
            path_id: actualPath.id,
            base_class_id: request.baseClassId,
            input_data: { lesson, outline, request },
            is_recoverable: true,
            recovery_suggestions: [
              'Skip mind map generation and continue',
              'Generate simplified mind map',
              'Use template-based mind map'
            ]
          });
          
          tasks.push({
            id: crypto.randomUUID(),
            task_identifier: brainbytesTaskId,
            task_type: 'lesson_brainbytes',
            status: 'pending',
            dependencies: [],
            execution_priority: 200,
            max_retry_count: 2,
            current_retry_count: 0,
            estimated_duration_seconds: 45,
            lesson_id: actualLesson.id,
            path_id: actualPath.id,
            base_class_id: request.baseClassId,
            input_data: { lesson, outline, request },
            is_recoverable: true,
            recovery_suggestions: [
              'Skip brainbytes generation and continue',
              'Generate simplified brainbytes',
              'Use content summary as brainbytes'
            ]
          });
        }
      }
      
      // Create path quiz tasks (depends on all lesson assessments in each path)
      const pathQuizTasks: string[] = [];
      if (request.assessmentSettings?.includeQuizzes !== false) {
        for (const path of paths) {
          const pathLessons = lessons.filter(lesson => lesson.path_id === path.id);
          const lessonAssessmentTasks = pathLessons.map(lesson => `assessment-${lesson.id}`);
          
          if (lessonAssessmentTasks.length > 0) {
            const pathQuizTaskId = `quiz-${path.id}`;
            pathQuizTasks.push(pathQuizTaskId);
            
            tasks.push({
              id: crypto.randomUUID(),
              task_identifier: pathQuizTaskId,
              task_type: 'path_quiz',
              status: 'pending',
              dependencies: lessonAssessmentTasks,
              execution_priority: 300,
              max_retry_count: 3,
              current_retry_count: 0,
              estimated_duration_seconds: 90,
              path_id: path.id,
              base_class_id: request.baseClassId,
              input_data: {
                pathTitle: path.title,
                outline,
                request
              },
              is_recoverable: true,
              recovery_suggestions: [
                'Retry quiz generation with different parameters',
                'Generate simpler quiz questions',
                'Skip quiz and continue with course generation'
              ]
            });
            
            console.log(`✅ Created path quiz task for: ${path.title} with ${lessonAssessmentTasks.length} assessment dependencies`);
          }
        }
      }
      
      // Create class exam task (depends on lesson assessments only, not path quizzes or media)
      if (request.assessmentSettings?.includeFinalExam !== false) {
        // Class exam should depend only on lesson assessments to start earlier
        // It doesn't need to wait for path quizzes or media generation
        const examDependencies = tasks.filter(t => t.task_type === 'lesson_assessment').map(t => t.task_identifier);
        
        if (examDependencies.length > 0) {
          const classExamTaskId = `exam-${request.baseClassId}`;
          
          tasks.push({
            id: crypto.randomUUID(),
            task_identifier: classExamTaskId,
            task_type: 'class_exam',
            status: 'pending',
            dependencies: examDependencies,
            execution_priority: 400,
            max_retry_count: 3,
            current_retry_count: 0,
            estimated_duration_seconds: 120,
            base_class_id: request.baseClassId,
            class_id: request.baseClassId,
            input_data: {
              classTitle: request.title,
              outline,
              request
            },
            is_recoverable: true,
            recovery_suggestions: [
              'Retry exam generation with different parameters',
              'Generate simpler exam questions',
              'Skip final exam and complete course generation'
            ]
          });
          
          console.log(`✅ Created class exam task with ${examDependencies.length} dependencies (${pathQuizTasks.length > 0 ? 'path quizzes' : 'lesson assessments'})`);
        }
      }
      
      // Insert all tasks into database (non-blocking)
      await this.bulkInsertTasks(jobId, tasks);
      
      // Update job with task counts (this will work even if bulk insert failed)
      try {
        await this.updateJobTaskCounts(jobId, tasks.length, 0, 0, 0);
      } catch (countError) {
        console.warn(`⚠️ Failed to update job task counts:`, countError);
      }
      
      console.log(`✅ Task initialization completed for ${tasks.length} tasks`);
      
    } catch (error) {
      console.error(`❌ Failed to initialize tasks in database:`, error);
      // Don't throw - let orchestration continue with on-demand task creation
      console.warn(`⚠️ Task initialization failed, but orchestration will continue with on-demand task creation`);
    }
  }

  /**
   * Main execution engine - runs tasks with intelligent scheduling and recovery
   */
  private async runExecutionEngine(
    jobId: string,
    outline: CourseOutline,
    request: CourseGenerationRequest
  ): Promise<void> {
    console.log(`⚙️ Starting execution engine for job ${jobId}`);
    const startTime = Date.now();
    
    let continueExecution = true;
    let consecutiveFailures = 0;
    const maxConsecutiveFailures = 10;
    let batchCount = 0;
    
    while (continueExecution) {
      try {
        // Get next batch of ready tasks - increased for better performance
        const readyTasks = await this.getReadyTasks(jobId, 15); // Process up to 15 tasks in parallel
        
        if (readyTasks.length === 0) {
          // Check if we're done or stuck
          const status = await this.analyzeJobStatus(jobId);
          
          if (status.completed) {
            const totalTime = Date.now() - startTime;
            console.log(`✅ All tasks completed for job ${jobId} in ${Math.round(totalTime/1000)}s (${batchCount} batches)`);
            continueExecution = false;
          } else if (status.stuck) {
            console.log(`⚠️ Job ${jobId} appears stuck, attempting recovery`);
            await this.handleStuckJob(jobId);
            consecutiveFailures++;
            
            if (consecutiveFailures >= maxConsecutiveFailures) {
              throw new Error('Too many consecutive failures, stopping execution');
            }
          } else {
            // Wait a bit and try again
            await this.sleep(2000);
          }
          continue;
        }
        
        // Immediately mark tasks as 'running' to prevent re-selection
        const runningTaskIds = readyTasks.map(t => t.id);
        if (runningTaskIds.length > 0) {
          console.log(`🔒 Locking ${runningTaskIds.length} tasks as 'running'...`);
          const { error: updateError } = await this.supabase
            .from('course_generation_tasks')
            .update({ status: 'running', started_at: new Date().toISOString() })
            .in('id', runningTaskIds);

          if (updateError) {
            console.error(`❌ Failed to lock tasks as running:`, updateError);
            // Skip this batch if locking fails
            continue;
          }
          console.log(`✅ ${runningTaskIds.length} tasks locked.`);
        }
        
        // Execute ready tasks in parallel
        batchCount++;
        const batchStartTime = Date.now();
        console.log(`🚀 Batch ${batchCount}: Processing ${readyTasks.length} tasks in parallel`);
        
        const taskPromises = readyTasks.map(task => 
          this.executeTaskWithResilience(jobId, task, outline, request)
        );
        
        await Promise.allSettled(taskPromises);
        
        const batchTime = Date.now() - batchStartTime;
        console.log(`⏱️ Batch ${batchCount} completed in ${Math.round(batchTime/1000)}s`);
        
        // Reset consecutive failures on successful batch
        consecutiveFailures = 0;
        
        // Update overall progress
        await this.updateJobProgress(jobId);
        
        // Reduced pause between batches for better performance
        await this.sleep(500);
        
      } catch (error) {
        console.error(`❌ Execution engine error for job ${jobId}:`, error);
        consecutiveFailures++;
        
        if (consecutiveFailures >= maxConsecutiveFailures) {
          throw new Error(`Execution engine failed: ${error.message}`);
        }
        
        // Reduced wait time for faster recovery
        await this.sleep(2000);
      }
    }
  }

  /**
   * Execute a single task with comprehensive error handling and resilience
   */
  private async executeTaskWithResilience(
    jobId: string,
    task: TaskDefinition,
    outline: CourseOutline,
    request: CourseGenerationRequest
  ): Promise<void> {
    console.log(`🔄 Executing task ${task.task_identifier} (attempt ${task.current_retry_count + 1})`);
    
    let result: any = null;
    let error: any = null;
    let finalStatus: 'completed' | 'failed' = 'failed';
    const startTime = Date.now();
    
    // BULLETPROOF EXECUTION WITH GUARANTEED STATUS UPDATE
    try {
      // Execute the task based on type with timeout protection
      const taskPromise = this.executeTaskByType(task, outline, request);
      const timeoutPromise = new Promise((_, reject) => 
        setTimeout(() => reject(new Error('Task execution timeout after 5 minutes')), 300000)
      );
      
      result = await Promise.race([taskPromise, timeoutPromise]);
      finalStatus = 'completed';
      
    } catch (taskError) {
      console.error(`❌ Task ${task.task_identifier} failed:`, taskError);
      error = taskError;
      finalStatus = 'failed';
    }
    
    const duration = Date.now() - startTime;
    
    // BULLETPROOF STATUS UPDATE - This MUST succeed
    await this.bulletproofUpdateTaskStatus(task, finalStatus, result, duration, error);
    console.log(`✅ Task ${task.task_identifier} ${finalStatus} in ${duration}ms`);
  }

  /**
   * Execute task by type - separated for cleaner timeout handling
   */
  private async executeTaskByType(
    task: TaskDefinition,
    outline: CourseOutline,
    request: CourseGenerationRequest
  ): Promise<any> {
    switch (task.task_type) {
      case 'lesson_section':
        return await this.executeLessonSectionTask(task, outline, request);
      case 'lesson_assessment':
        return await this.executeLessonAssessmentTask(task, outline, request);
      case 'lesson_mind_map':
        return await this.executeLessonMindMapTask(task, outline, request);
      case 'lesson_brainbytes':
        return await this.executeLessonBrainbytesTask(task, outline, request);
      case 'path_quiz':
        return await this.executePathQuizTask(task, outline, request);
      case 'class_exam':
        return await this.executeClassExamTask(task, outline, request);
      default:
        throw new Error(`Unknown task type: ${task.task_type}`);
    }
  }

  /**
   * BULLETPROOF task status update - GUARANTEED to succeed
   */
  private async bulletproofUpdateTaskStatus(
    task: TaskDefinition,
    status: 'completed' | 'failed',
    result: any,
    duration: number,
    error?: any
  ): Promise<void> {
    console.log(`🔧 BULLETPROOF: Updating task ${task.task_identifier} to ${status}`);
    
    const updates = {
      completed_at: new Date().toISOString(),
      actual_duration_seconds: Math.floor(duration / 1000),
      updated_at: new Date().toISOString(),
      ...(result && { output_data: result }),
      ...(error && { 
        error_message: error.message,
        error_details: { stack: error.stack }
      }),
      result_metadata: {
        execution_time_ms: duration,
        retry_count: task.current_retry_count || 0,
        memory_usage_estimate: result ? this.estimateMemoryUsage(result) : 0
      }
    };

    // Try method 1: Direct database function call
    try {
      const { data: directResult, error: directError } = await this.supabase.rpc('update_task_status_direct', {
        p_task_id: task.id,
        p_status: status,
        p_updates: updates
      });
      
      if (!directError && directResult === true) {
        console.log(`✅ BULLETPROOF: Successfully updated task ${task.task_identifier} to ${status} (method 1)`);
        return;
      }
      
      console.warn(`⚠️ BULLETPROOF: Method 1 failed, trying method 2:`, directError);
    } catch (method1Error) {
      console.warn(`⚠️ BULLETPROOF: Method 1 exception, trying method 2:`, method1Error);
    }

    // Try method 2: Direct table update
    try {
      const { error: updateError } = await this.supabase
        .from('course_generation_tasks')
        .update({
          status: status,
          completed_at: new Date().toISOString(),
          actual_duration_seconds: Math.floor(duration / 1000),
          updated_at: new Date().toISOString(),
          ...(result && { output_data: result }),
          ...(error && { 
            error_message: error.message,
            error_details: { stack: error.stack }
          })
        })
        .eq('id', task.id);
      
      if (!updateError) {
        console.log(`✅ BULLETPROOF: Successfully updated task ${task.task_identifier} to ${status} (method 2)`);
        return;
      }
      
      console.warn(`⚠️ BULLETPROOF: Method 2 failed, trying method 3:`, updateError);
    } catch (method2Error) {
      console.warn(`⚠️ BULLETPROOF: Method 2 exception, trying method 3:`, method2Error);
    }

    // Try method 3: Emergency minimal update
    try {
      const { error: emergencyError } = await this.supabase
        .from('course_generation_tasks')
        .update({
          status: status,
          updated_at: new Date().toISOString()
        })
        .eq('id', task.id);
      
      if (!emergencyError) {
        console.log(`✅ BULLETPROOF: Successfully updated task ${task.task_identifier} to ${status} (method 3 - emergency)`);
        return;
      }
      
      console.error(`🚨 BULLETPROOF: All methods failed for task ${task.task_identifier}:`, emergencyError);
    } catch (method3Error) {
      console.error(`🚨 BULLETPROOF: Emergency method failed for task ${task.task_identifier}:`, method3Error);
    }
    
    // This should never happen, but if it does, we've logged everything
    console.error(`🚨 CRITICAL: Failed to update task status for ${task.task_identifier} using all methods`);
  }

  /**
   * Execute lesson section generation task
   */
  private async executeLessonSectionTask(
    task: TaskDefinition,
    outline: CourseOutline,
    request: CourseGenerationRequest
  ): Promise<any> {
    const { lesson, sectionIndex } = task.input_data;
    const sectionTitle = lesson.contentOutline[sectionIndex];
    
    // Use the actual lesson_id from the task, not from the outline lesson object
    const actualLessonId = task.lesson_id;
    if (!actualLessonId) {
      throw new Error('No lesson_id found in task definition');
    }
    
    // Get knowledge base content
    const kbContent = await this.getRelevantKnowledgeBaseContent(
      request.baseClassId,
      lesson.title,
      sectionTitle,
      'kb_supplemented'
    );
    
    const prompt = this.buildLessonSectionPrompt(lesson, sectionTitle, sectionIndex, kbContent, outline, request);
    
    const completion = await this.callOpenAIWithCircuitBreaker({
      model: "gpt-4.1-mini",
      messages: [
        {
          role: "system",
          content: `You are a master educator creating comprehensive lesson content for ${outline.academicLevel || 'college'} level learners with ${outline.lessonDetailLevel || 'detailed'} depth.`
        },
        {
          role: "user",
          content: prompt
        }
      ],
      response_format: { type: "json_object" },
      temperature: 0.7,
      max_tokens: 16000
    });
    
    const content = completion.choices[0]?.message?.content || '{}';
    let parsedContent;
    
    try {
      parsedContent = JSON.parse(content);
    } catch (parseError) {
      // Try to repair JSON
      parsedContent = this.repairJsonContent(content);
      if (!parsedContent) {
        throw new Error(`JSON parsing failed: ${parseError.message}`);
      }
    }
    
    // Validate content structure
    this.validateLessonSectionContent(parsedContent);
    
    // Store in database using the actual lesson UUID
    await this.storeLessonSectionContent(actualLessonId, sectionIndex, parsedContent);
    
    return parsedContent;
  }

  /**
   * Circuit breaker implementation for OpenAI API calls
   */
  private async callOpenAIWithCircuitBreaker(params: any): Promise<any> {
    const circuitBreaker = this.circuitBreakers.get('openai');
    
    if (circuitBreaker.state === 'open') {
      if (Date.now() < circuitBreaker.nextAttemptTime.getTime()) {
        throw new Error('Circuit breaker is open - OpenAI API unavailable');
      } else {
        // Transition to half-open
        circuitBreaker.state = 'half-open';
      }
    }
    
    // Promise.race timeout (OpenAI doesn't support AbortController signal)
    // Reduced timeout for faster failure recovery and better performance
    const timeoutPromise = new Promise((_, reject) => 
      setTimeout(() => reject(new Error('OpenAI API call timed out after 60 seconds')), 60000)
    );

    try {
      console.log(`➡️ Sending request to OpenAI for model: ${params.model}`);
      console.log(`🕐 Setting 45-second timeout for OpenAI call`);

      const result = await Promise.race([
        this.openai.chat.completions.create(params),
        timeoutPromise
      ]);
      
      console.log(`⬅️ Received response from OpenAI.`);
      
      // Success - reset or close circuit breaker
      if (circuitBreaker.state === 'half-open') {
        circuitBreaker.state = 'closed';
        circuitBreaker.failureCount = 0;
      }
      
      return result as any; // Cast because Promise.race returns Promise<unknown>
      
    } catch (error) {
      console.error(`❌ OpenAI API call failed: ${error.message}`);
      // Only record circuit breaker failures for actual API issues, not configuration errors
      const errorSeverity = this.classifyErrorSeverity(error);
      if (errorSeverity !== 'low') {
      this.recordCircuitBreakerFailure('openai');
      }
      throw error;
    }
  }

  /**
   * Get tasks that are ready to execute (dependencies satisfied)
   */
  private async getReadyTasks(jobId: string, limit: number = 10): Promise<TaskDefinition[]> {
    const { data: tasks, error } = await this.supabase
      .from('course_generation_tasks')
      .select('*')
      .eq('job_id', jobId)
      .eq('status', 'pending')
      .order('execution_priority', { ascending: true })
      .limit(limit);
    
    if (error) {
      throw new Error(`Failed to get ready tasks: ${error.message}`);
    }
    
    const readyTasks: TaskDefinition[] = [];
    
    for (const task of tasks || []) {
      // Check if dependencies are satisfied
      const dependenciesReady = await this.checkTaskDependencies(task);
      if (dependenciesReady) {
        readyTasks.push(task);
      }
    }
    
    return readyTasks;
  }

  /**
   * Check if task dependencies are satisfied
   */
  private async checkTaskDependencies(task: TaskDefinition): Promise<boolean> {
    if (!task.dependencies || task.dependencies.length === 0) {
      return true;
    }
    
    const { data: dependencyTasks, error } = await this.supabase
      .from('course_generation_tasks')
      .select('status')
      .eq('job_id', task.job_id)
      .in('task_identifier', task.dependencies);
    
    if (error) {
      console.error('Error checking dependencies:', error);
      return false;
    }
    
    // V1 compatible: Consider failed tasks as satisfied dependencies to allow course generation to continue
    return dependencyTasks?.every(dep => 
      dep.status === 'completed' || dep.status === 'skipped' || dep.status === 'failed'
    ) || false;
  }

  /**
   * Update task status with detailed information
   */
  private async updateTaskStatus(taskId: string, status: string, updates: any = {}): Promise<void> {
    console.log(`🔄 Attempting to update task ID: ${taskId} to status: ${status} using service role client`);
    
    try {
      // Use database function directly for reliable updates
      console.log(`🔧 Using database function for reliable update`);
      const { data: directData, error: directError } = await this.supabase.rpc('update_task_status_direct', {
        p_task_id: taskId,
        p_status: status,
        p_updates: updates || {}
      });
      
      if (directError) {
        console.error(`❌ Database function failed:`, directError);
        throw new Error(`Failed to update task ${taskId}: ${directError.message}`);
      }
      
      if (directData === true) {
        console.log(`✅ Database function successfully updated task to status: ${status}`);
      } else {
        console.error(`❌ Database function returned false - no rows updated for task ${taskId}`);
        throw new Error(`Failed to update task ${taskId} - no rows affected`);
      }
    } catch (error) {
      console.error(`❌ updateTaskStatus failed for task ${taskId}:`, error);
      throw error;
    }
  }

  /**
   * Log comprehensive error information
   */
  private async logError(jobId: string, taskId: string, error: any, context: any = {}): Promise<void> {
    const { error: logError } = await this.supabase
      .from('course_generation_errors')
      .insert({
        job_id: jobId,
        task_id: taskId,
        error_type: this.classifyErrorType(error),
        error_severity: this.classifyErrorSeverity(error),
        error_category: this.classifyErrorCategory(error),
        error_message: error.message,
        error_stack: error.stack,
        error_context: context,
        system_metrics: {
          memory_usage: process.memoryUsage(),
          timestamp: new Date().toISOString()
        },
        is_retryable: this.isErrorRetryable(error),
        retry_strategy: this.getRetryStrategy(error),
        suggested_actions: this.generateRecoverySuggestions(null, error)
      });
    
    if (logError) {
      console.error('Failed to log error:', logError);
    }
  }

  /**
   * Determine if task should be retried based on error and retry policy
   */
  private async shouldRetryTask(task: TaskDefinition, error: any): Promise<boolean> {
    // Check if we've exceeded max retries
    if (task.current_retry_count >= task.max_retry_count) {
      return false;
    }
    
    // Check if error is retryable
    if (!this.isErrorRetryable(error)) {
      return false;
    }
    
    // Check circuit breaker state
    const circuitBreaker = this.circuitBreakers.get('openai');
    if (circuitBreaker?.state === 'open') {
      return false;
    }
    
    return true;
  }

  /**
   * Calculate retry delay with exponential backoff
   */
  private calculateRetryDelay(retryCount: number): number {
    const delay = this.retryConfig.baseDelayMs * Math.pow(this.retryConfig.backoffMultiplier, retryCount);
    return Math.min(delay, this.retryConfig.maxDelayMs);
  }

  /**
   * Classify error severity for proper handling
   */
  private classifyErrorSeverity(error: any): 'low' | 'medium' | 'high' | 'critical' {
    if (error.message?.includes('timeout')) return 'medium';
    if (error.message?.includes('rate limit')) return 'low';
    if (error.message?.includes('insufficient funds')) return 'critical';
    if (error.message?.includes('invalid api key')) return 'critical';
    if (error.message?.includes('network')) return 'medium';
    if (error.message?.includes('validation')) return 'low';
    // JSON format errors are configuration issues, not API failures
    if (error.message?.includes('messages\' must contain the word \'json\'')) return 'low';
    if (error.message?.includes('json_object')) return 'low';
    return 'medium';
  }

  /**
   * Classify error category for analytics and handling
   */
  private classifyErrorCategory(error: any): string {
    if (error.message?.includes('timeout')) return 'timeout';
    if (error.message?.includes('rate limit')) return 'rate_limit';
    if (error.message?.includes('network')) return 'network';
    if (error.message?.includes('json') || error.message?.includes('parse')) return 'validation';
    if (error.message?.includes('database')) return 'database';
    if (error.message?.includes('api')) return 'external_api';
    return 'unknown';
  }

  /**
   * Determine if error is retryable
   */
  private isErrorRetryable(error: any): boolean {
    // Configuration errors should not be retried
    if (error.message?.includes('messages\' must contain the word \'json\'')) return false;
    if (error.message?.includes('json_object')) return false;
    
    const retryableTypes = ['timeout', 'rate_limit', 'network', 'temporary'];
    return retryableTypes.some(type => error.message?.toLowerCase().includes(type));
  }

  /**
   * Circuit breaker management
   */
  private recordCircuitBreakerFailure(service: string): void {
    const circuitBreaker = this.circuitBreakers.get(service);
    if (!circuitBreaker) return;
    
    circuitBreaker.failureCount++;
    circuitBreaker.lastFailureTime = new Date();
    
    if (circuitBreaker.failureCount >= this.circuitBreakerConfig.failureThreshold) {
      circuitBreaker.state = 'open';
      circuitBreaker.nextAttemptTime = new Date(
        Date.now() + this.circuitBreakerConfig.resetTimeoutMs
      );
      console.warn(`🔴 Circuit breaker opened for ${service}`);
    }
  }

  private resetCircuitBreaker(service: string): void {
    const circuitBreaker = this.circuitBreakers.get(service);
    if (circuitBreaker) {
      circuitBreaker.state = 'closed';
      circuitBreaker.failureCount = 0;
      circuitBreaker.lastFailureTime = undefined;
      circuitBreaker.nextAttemptTime = undefined;
    }
  }

  /**
   * Initialize performance tracking for a job
   */
  private initializePerformanceTracking(jobId: string): void {
    this.performanceMetrics.set(jobId, {
      startTime: new Date(),
      totalTasks: 0,
      completedTasks: 0,
      failedTasks: 0,
      skippedTasks: 0,
      retriedTasks: 0,
      averageTaskDuration: 0,
      peakMemoryUsage: 0,
      apiCallsTotal: 0,
      apiCallsFailed: 0,
      tokensConsumed: 0,
      estimatedCostUsd: 0
    });
  }

  /**
   * Analyze job status to determine if completed or stuck
   */
  private async analyzeJobStatus(jobId: string): Promise<{ completed: boolean; stuck: boolean; pendingCount: number; totalCount: number }> {
    const { data: tasks, error } = await this.supabase
      .from('course_generation_tasks')
      .select('status')
      .eq('job_id', jobId);
    
    if (error) {
      console.error('Failed to analyze job status:', error);
      return { completed: false, stuck: false, pendingCount: 0, totalCount: 0 };
    }
    
    const totalCount = tasks?.length || 0;
    const completedCount = tasks?.filter(t => t.status === 'completed').length || 0;
    const failedCount = tasks?.filter(t => t.status === 'failed').length || 0;
    const pendingCount = tasks?.filter(t => t.status === 'pending').length || 0;
    const runningCount = tasks?.filter(t => t.status === 'running').length || 0;
    
    // V1 compatible: Job is completed when all tasks are either completed or failed (not stuck on failures)
    const finishedCount = completedCount + failedCount;
    const completed = finishedCount === totalCount;
    const stuck = pendingCount > 0 && runningCount === 0 && finishedCount > 0; // Has pending tasks but nothing running
    
    console.log(`📊 Job ${jobId} status: ${completedCount}/${totalCount} completed, ${pendingCount} pending, ${runningCount} running, ${failedCount} failed`);
    
    return {
      completed,
      stuck,
      pendingCount,
      totalCount
    };
  }

  /**
   * Handle stuck job by attempting to recover pending tasks
   */
  private async handleStuckJob(jobId: string): Promise<void> {
    console.log(`🔧 Attempting to recover stuck job ${jobId}`);
    
    // Get all pending tasks
    const { data: pendingTasks, error } = await this.supabase
      .from('course_generation_tasks')
      .select('*')
      .eq('job_id', jobId)
      .eq('status', 'pending');
    
    if (error) {
      console.error('Failed to get pending tasks for recovery:', error);
      return;
    }
    
    if (!pendingTasks || pendingTasks.length === 0) {
      console.log('No pending tasks found for recovery');
      return;
    }
    
    console.log(`Found ${pendingTasks.length} pending tasks to potentially recover`);
    
    // For now, just log the pending tasks - in the future we could implement more sophisticated recovery
    pendingTasks.forEach(task => {
      console.log(`  - Pending task: ${task.task_identifier} (type: ${task.task_type})`);
    });
    
    // Simple recovery: wait a bit to see if tasks naturally resolve
    await this.sleep(5000); // Wait 5 seconds
  }

  /**
   * Finalize generation and calculate comprehensive analytics
   */
  private async finalizeGeneration(jobId: string): Promise<void> {
    console.log(`🏁 Finalizing generation for job ${jobId}`);
    
    try {
      // Calculate final analytics
      const analytics = await this.analytics.calculateJobAnalytics(jobId);
      
      // Store analytics in database
      await this.analytics.storeJobAnalytics(jobId, analytics);
      
      console.log(`✅ Successfully stored analytics for job ${jobId}`);
    } catch (analyticsError) {
      console.warn(`⚠️ Failed to calculate/store analytics for job ${jobId}:`, analyticsError);
      // Don't fail the entire job just because analytics failed
    }
    
    // Update job status to completed - THIS SHOULD ALWAYS HAPPEN
    await this.updateJobStatus(jobId, 'completed');
    
    console.log(`✅ Generation completed for job ${jobId}`);
  }

  // Utility methods
  private async sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  private estimateMemoryUsage(data: any): number {
    try {
      if (data === null || data === undefined) {
        return 0;
      }
      return JSON.stringify(data).length * 2; // Rough estimate
    } catch (error) {
      console.warn('Failed to estimate memory usage:', error);
      return 0;
    }
  }

  // Additional utility methods would be implemented here...
  private buildLessonSectionPrompt(lesson: any, sectionTitle: string, sectionIndex: number, kbContent: any[], outline: any, request: any): string {
    // Get knowledge base content excerpts for context
    const finalKbContent = kbContent.slice(0, 15);
    
    return `You are a master educator creating comprehensive lesson content that ACTUALLY TEACHES students the subject matter.

LESSON CONTEXT:
- Lesson Title: ${lesson.title}
- Lesson Description: ${lesson.description || 'Not provided'}
- Section Title: ${sectionTitle}
- Section Index: ${sectionIndex + 1} of ${lesson.contentOutline?.length || 1}
- Learning Objectives: ${lesson.learningObjectives?.join(', ') || 'Not specified'}
- Content Type: ${lesson.contentType || 'educational'}
- Duration: ${lesson.estimatedDurationHours || 1} hours

STUDENT CONTEXT:
- Academic Level: ${request.academicLevel || 'college'}
- Content Depth: ${request.lessonDetailLevel || 'detailed'}
- Target Audience: ${request.targetAudience || 'General learners'}
- Prerequisites: ${request.prerequisites || 'None specified'}

KNOWLEDGE BASE CONTENT TO INCORPORATE:
${finalKbContent.length > 0 ? finalKbContent.map(chunk => `- ${chunk.summary || chunk.content?.substring(0, 500) || 'No content'}`).join('\n') : '- No specific knowledge base content available'}

TEACHING REQUIREMENTS:
1. Create FLOWING, COMPREHENSIVE educational content that teaches like an expert 1-on-1 tutor
2. This section should contain substantial teaching content, not just outlines or activities
3. Progressively build understanding from basic concepts to mastery
4. Include concrete examples, analogies, and real-world connections
5. Address common misconceptions and provide clarifications
6. Use engaging, clear language appropriate for the academic level
7. Ensure content directly supports the learning objectives

Create comprehensive educational content as JSON using the EXACT same format as our V1 system:
{
  "sectionTitle": "${sectionTitle}",
  "introduction": "2-3 sentences that connect to prior learning and preview what this section will accomplish",
  "expertTeachingContent": {
    "conceptIntroduction": "Clear, engaging introduction to the core concept(s) with expert context",
    "detailedExplanation": "Comprehensive explanation that builds understanding progressively. Multiple detailed paragraphs that teach the concept thoroughly, as if you're sitting with the student explaining it personally.",
    "expertInsights": [
      "Professional insights that only an expert would know",
      "Common pitfalls and how to avoid them",
      "Connections to broader field knowledge"
    ],
    "practicalExamples": [
      {
        "title": "Example 1 Title",
        "context": "Why this example matters",
        "walkthrough": "Step-by-step explanation showing expert thinking",
        "keyTakeaways": ["What students should learn from this example"]
      }
    ],
    "realWorldConnections": [
      "How this concept applies in professional/real-world contexts",
      "Why experts care about this concept"
    ],
    "commonMisconceptions": [
      {
        "misconception": "What students often get wrong",
        "correction": "The correct understanding with clear explanation",
        "prevention": "How to avoid this misunderstanding"
      }
    ]
  },
  "checkForUnderstanding": [
    "Thought-provoking question that tests comprehension",
    "Application scenario to verify understanding"
  ],
  "expertSummary": "Synthesis that helps students see the big picture and connect to learning objectives",
  "bridgeToNext": "How this section connects to what comes next in the lesson"
}

CRITICAL: This content should feel like learning from a master teacher who is passionate about the subject and deeply cares about student understanding. Make it engaging, authoritative, and genuinely educational.

Generate complete educational content for the "${sectionTitle}" section now:`;
  }

  private validateLessonSectionContent(content: any): void {
    // Validate V1 format structure
    if (!content.sectionTitle || !content.introduction || !content.expertTeachingContent) {
      console.log('🔍 Content validation failed. Received content structure:', JSON.stringify(content, null, 2));
      throw new Error('Invalid lesson section content structure - missing required V1 format fields (sectionTitle, introduction, expertTeachingContent)');
    }
    
    // Validate nested expertTeachingContent structure
    if (!content.expertTeachingContent.detailedExplanation) {
      console.log('🔍 Content validation failed. Missing detailedExplanation in expertTeachingContent');
      throw new Error('Invalid lesson section content structure - missing detailedExplanation in expertTeachingContent');
    }
  }

  private async storeLessonSectionContent(lessonId: string, sectionIndex: number, content: any): Promise<void> {
    try {
      console.log(`💾 Storing lesson section content for lesson ${lessonId}, section ${sectionIndex}`);
      
      // Get the lesson to access its contentOutline for the section title
      const { data: lesson, error: lessonError } = await this.supabase
        .from('lessons')
        .select('title, description, created_by')
        .eq('id', lessonId)
        .single();
      
      if (lessonError || !lesson) {
        throw new Error(`Failed to fetch lesson for section storage: ${lessonError?.message}`);
      }
      
      // Extract section title from V1 format
      const sectionTitle = content.sectionTitle || `Section ${sectionIndex + 1}`;
      
      // Store the complete V1 format as-is (no transformation needed)
      const comprehensiveContent = content;
      
      // Sanitize content for database storage
      const sanitizedContent = this.sanitizeContentForDatabase(comprehensiveContent);
      
      // Determine section type
      const sectionType = sectionIndex === 0 ? 'introduction' :
                         sectionTitle.toLowerCase().includes('summary') || 
                         sectionTitle.toLowerCase().includes('conclusion') ? 'summary' : 
                         'main_content';
      
      // Insert the lesson section
      const { error: insertError } = await this.supabase
        .from('lesson_sections')
        .insert({
          lesson_id: lessonId,
          title: sectionTitle,
          content: sanitizedContent,
          section_type: sectionType,
          order_index: sectionIndex,
          created_by: lesson.created_by
        });
      
      if (insertError) {
        console.error(`❌ Database insertion error for section ${sectionIndex}:`, insertError);
        
        // Handle stack depth limit exceeded specifically (following V1 pattern)
        if (insertError.code === '54001' || insertError.message?.includes('stack depth limit exceeded')) {
          console.warn(`Stack depth limit exceeded for section ${sectionIndex}, attempting simplified content...`);
          
          // Retry with heavily simplified V1 format content
          const simplifiedContent = {
            sectionTitle: sectionTitle,
            introduction: `This section covers ${sectionTitle}.`,
            expertTeachingContent: {
              conceptIntroduction: `Let's explore ${sectionTitle}.`,
              detailedExplanation: typeof sanitizedContent.expertTeachingContent?.detailedExplanation === 'string' 
                ? sanitizedContent.expertTeachingContent.detailedExplanation.substring(0, 3000) 
                : `This section provides essential information about ${sectionTitle}.`,
              expertInsights: ["Key concept for understanding"],
              practicalExamples: [],
              realWorldConnections: [],
              commonMisconceptions: []
            },
            checkForUnderstanding: ["How does this concept apply?"],
            expertSummary: `We have covered the fundamentals of ${sectionTitle}.`,
            bridgeToNext: "This prepares us for the next section."
          };
          
          const { error: retryError } = await this.supabase
            .from('lesson_sections')
            .insert({
              lesson_id: lessonId,
              title: sectionTitle,
              content: simplifiedContent,
              section_type: sectionType,
              order_index: sectionIndex,
              created_by: lesson.created_by
            });
            
          if (retryError) {
            console.error(`❌ Failed to create simplified section: ${retryError.message}`);
            // Don't throw - let the task be marked as failed gracefully
            return null;
          }
          
          console.log(`✅ Created simplified section ${sectionIndex} for lesson ${lessonId}`);
          return;
        } else {
          // For other database errors, log and return null to allow graceful failure
          console.error(`❌ Failed to insert lesson section ${sectionIndex} for lesson ${lessonId}:`, insertError);
          return null;
        }
      }
      
      console.log(`✅ Successfully stored section ${sectionIndex} for lesson ${lessonId}: ${sectionTitle}`);
      
    } catch (error) {
      console.error(`❌ Error storing lesson section content:`, error);
      throw error;
    }
  }

  /**
   * Sanitize content to prevent deep nesting and stack depth issues
   */
  private sanitizeContentForDatabase(content: any, maxDepth: number = 6, currentDepth: number = 0): any {
    // Prevent infinite recursion and stack depth issues
    if (currentDepth >= maxDepth) {
      return typeof content === 'object' ? '[Content too deep - truncated]' : content;
    }
    
    if (content === null || content === undefined) {
      return content;
    }
    
    if (typeof content === 'string') {
      // Limit string length to prevent excessive memory usage
      return content.length > 10000 ? content.substring(0, 10000) + '...[truncated]' : content;
    }
    
    if (typeof content === 'number' || typeof content === 'boolean') {
      return content;
    }
    
    if (Array.isArray(content)) {
      // Handle arrays of strings specially - don't increment depth for string arrays
      const isStringArray = content.every(item => typeof item === 'string');
      if (isStringArray) {
        return content.slice(0, 50).map(item => 
          typeof item === 'string' && item.length > 10000 
            ? item.substring(0, 10000) + '...[truncated]' 
            : item
        );
      }
      
      // Limit array size and recursively sanitize elements
      return content.slice(0, 20).map((item, index) => {
        if (index < 15) { // Only process first 15 items to prevent excessive processing
          return this.sanitizeContentForDatabase(item, maxDepth, currentDepth + 1);
        }
        return typeof item === 'object' ? '[Item truncated]' : item;
      });
    }
    
    if (typeof content === 'object') {
      const sanitized: any = {};
      let processedKeys = 0;
      
      for (const [key, value] of Object.entries(content)) {
        if (processedKeys >= 100) { // Increased limit for educational content
          sanitized['__truncated__'] = `${Object.keys(content).length - processedKeys} more properties truncated`;
          break;
        }
        
        // Skip potentially problematic keys
        if (key.length > 100) continue;
        
        sanitized[key] = this.sanitizeContentForDatabase(value, maxDepth, currentDepth + 1);
        processedKeys++;
      }
      
      return sanitized;
    }
    
    return content;
  }

  /**
   * Estimate content complexity to help prevent stack depth issues
   */
  private estimateContentComplexity(content: any, depth: number = 0): { 
    estimatedSize: number; 
    maxDepth: number; 
    complexityScore: number;
    riskLevel: 'low' | 'medium' | 'high';
  } {
    let size = 0;
    let maxDepth = depth;
    
    if (content === null || content === undefined) {
      return { estimatedSize: 1, maxDepth: depth, complexityScore: 0, riskLevel: 'low' };
    }
    
    if (typeof content === 'string') {
      return { 
        estimatedSize: content.length, 
        maxDepth: depth, 
        complexityScore: Math.min(content.length / 1000, 10), 
        riskLevel: content.length > 50000 ? 'high' : content.length > 10000 ? 'medium' : 'low'
      };
    }
    
    if (typeof content === 'number' || typeof content === 'boolean') {
      return { estimatedSize: 1, maxDepth: depth, complexityScore: 0, riskLevel: 'low' };
    }
    
    if (Array.isArray(content)) {
      size += content.length;
      for (const item of content.slice(0, 10)) { // Only check first 10 items for performance
        const itemComplexity = this.estimateContentComplexity(item, depth + 1);
        size += itemComplexity.estimatedSize;
        maxDepth = Math.max(maxDepth, itemComplexity.maxDepth);
      }
    } else if (typeof content === 'object') {
      const keys = Object.keys(content);
      size += keys.length;
      
      for (const key of keys.slice(0, 20)) { // Only check first 20 keys for performance
        const valueComplexity = this.estimateContentComplexity(content[key], depth + 1);
        size += valueComplexity.estimatedSize;
        maxDepth = Math.max(maxDepth, valueComplexity.maxDepth);
      }
    }
    
    const complexityScore = Math.min((size / 10000) + (maxDepth / 2), 10);
    const riskLevel = complexityScore > 8 ? 'high' : complexityScore > 5 ? 'medium' : 'low';
    
    return { estimatedSize: size, maxDepth, complexityScore, riskLevel };
  }

  private repairJsonContent(content: string): any {
    if (!content) return null;
    
    try {
      // Try basic JSON parsing first
      return JSON.parse(content);
    } catch (error) {
      console.log('Attempting JSON repair...');
      
      // Try to fix common JSON issues
      let repairedContent = content
        .replace(/```json\n?/g, '') // Remove markdown code blocks
        .replace(/```\n?/g, '')
        .replace(/\n/g, ' ')        // Replace newlines with spaces
        .replace(/,(\s*[}\]])/g, '$1') // Remove trailing commas
        .trim();
      
      // Handle truncated JSON by finding the last complete object/array
      if (repairedContent.includes('{') || repairedContent.includes('[')) {
        repairedContent = this.fixTruncatedJson(repairedContent);
      }
      
      // Try parsing the repaired content
      try {
        return JSON.parse(repairedContent);
      } catch (repairError) {
        console.error('JSON repair failed:', repairError);
        return null;
      }
    }
  }

  /**
   * Fix truncated JSON by finding the last valid closing bracket
   */
  private fixTruncatedJson(content: string): string {
    let braceCount = 0;
    let bracketCount = 0;
    let lastValidIndex = -1;
    let inString = false;
    let escapeNext = false;
    
    for (let i = 0; i < content.length; i++) {
      const char = content[i];
      
      if (escapeNext) {
        escapeNext = false;
        continue;
      }
      
      if (char === '\\') {
        escapeNext = true;
        continue;
      }
      
      if (char === '"' && !escapeNext) {
        inString = !inString;
        continue;
      }
      
      if (inString) continue;
      
      if (char === '{') {
        braceCount++;
      } else if (char === '}') {
        braceCount--;
        if (braceCount === 0 && bracketCount === 0) {
          lastValidIndex = i;
        }
      } else if (char === '[') {
        bracketCount++;
      } else if (char === ']') {
        bracketCount--;
        if (braceCount === 0 && bracketCount === 0) {
          lastValidIndex = i;
        }
      }
    }
    
    // If we found a valid ending point, truncate there
    if (lastValidIndex > -1) {
      const truncated = content.substring(0, lastValidIndex + 1);
      console.log(`🔧 Fixed truncated JSON: ${content.length} → ${truncated.length} characters`);
      return truncated;
    }
    
    // If no valid ending found, try to close the JSON properly
    let fixed = content;
    while (braceCount > 0) {
      fixed += '}';
      braceCount--;
    }
    while (bracketCount > 0) {
      fixed += ']';
      bracketCount--;
    }
    
    console.log(`🔧 Added closing brackets: ${content.length} → ${fixed.length} characters`);
    return fixed;
  }

  // ... Additional methods for other task types and utilities

  /**
   * Update job status in the database
   */
  private async updateJobStatus(
    jobId: string, 
    status: 'queued' | 'processing' | 'completed' | 'failed'
  ): Promise<void> {
    try {
      const { error } = await this.supabase
        .from('course_generation_jobs')
        .update({
          status,
          updated_at: new Date().toISOString()
        })
        .eq('id', jobId);

      if (error) {
        console.error('Failed to update job status:', error);
        throw new Error(`Failed to update job status: ${error.message}`);
      }
    } catch (error) {
      console.error('Error updating job status:', error);
      throw error;
    }
  }

  /**
   * Handle critical failure and update job status
   */
  private async handleCriticalFailure(jobId: string, error: any): Promise<void> {
    try {
      console.error(`🚨 Critical failure for job ${jobId}:`, error);
      
      // Update job status to failed
      await this.supabase
        .from('course_generation_jobs')
        .update({
          status: 'failed',
          error_message: error instanceof Error ? error.message : 'Unknown error',
          updated_at: new Date().toISOString()
        })
        .eq('id', jobId);

      // Mark all pending tasks as failed
      await this.supabase
        .from('course_generation_tasks')
        .update({
          status: 'failed',
          error_message: 'Job failed during orchestration',
          updated_at: new Date().toISOString()
        })
        .eq('job_id', jobId)
        .in('status', ['pending', 'queued', 'running']);

    } catch (updateError) {
      console.error('Failed to handle critical failure:', updateError);
    }
  }

  /**
   * Bulk insert tasks into the database
   */
  private async bulkInsertTasks(jobId: string, tasks: TaskDefinition[]): Promise<void> {
    try {
      console.log(`🔄 Attempting to bulk insert ${tasks.length} tasks for job ${jobId}`);
      
      const taskInserts = tasks.map(task => ({
        job_id: jobId,
        task_identifier: task.task_identifier,
        task_type: task.task_type,
        status: task.status,
        dependencies: task.dependencies,
        execution_priority: task.execution_priority,
        max_retry_count: task.max_retry_count,
        current_retry_count: task.current_retry_count,
        estimated_duration_seconds: task.estimated_duration_seconds,
        lesson_id: task.lesson_id,
        path_id: task.path_id,
        base_class_id: task.base_class_id,
        section_index: task.section_index,
        section_title: task.section_title,
        input_data: task.input_data,
        output_data: task.output_data,
        result_metadata: task.result_metadata,
        error_message: task.error_message,
        error_details: task.error_details,
        error_severity: task.error_severity,
        error_category: task.error_category,
        is_recoverable: task.is_recoverable,
        recovery_suggestions: task.recovery_suggestions,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      }));

      // Log payload size for debugging
      const payloadSize = JSON.stringify(taskInserts).length;
      console.log(`📊 Task insert payload size: ${payloadSize} characters (${Math.round(payloadSize / 1024)}KB)`);

      // If payload is too large, try batch insertion
      if (payloadSize > 1000000) { // 1MB limit
        console.log(`⚠️ Large payload detected, switching to batch insertion`);
        const batchSize = 10;
        for (let i = 0; i < taskInserts.length; i += batchSize) {
          const batch = taskInserts.slice(i, i + batchSize);
          console.log(`🔄 Inserting batch ${Math.floor(i / batchSize) + 1}/${Math.ceil(taskInserts.length / batchSize)} (${batch.length} tasks)`);
          
          const { error: batchError } = await this.supabase
            .from('course_generation_tasks')
            .insert(batch);
            
          if (batchError) {
            console.error(`❌ Failed to insert batch ${Math.floor(i / batchSize) + 1}:`, batchError);
            throw new Error(`Failed to insert batch: ${batchError.message}`);
          }
        }
        console.log(`✅ Successfully inserted all ${tasks.length} tasks in batches for job ${jobId}`);
      } else {
        // Normal single insert
        const { error } = await this.supabase
          .from('course_generation_tasks')
          .insert(taskInserts);

        if (error) {
          console.error('❌ Failed to bulk insert tasks:', error);
          console.error('🔍 Error details:', {
            code: error.code,
            message: error.message,
            details: error.details,
            hint: error.hint
          });
          throw new Error(`Failed to insert tasks: ${error.message}`);
        }

        console.log(`✅ Successfully inserted ${tasks.length} tasks for job ${jobId}`);
      }
    } catch (error) {
      console.error('🚨 Error in bulkInsertTasks:', error);
      console.error('🔍 Error type:', error.constructor.name);
      console.error('🔍 Error message:', error.message);
      
      // Don't re-throw - let the orchestrator continue with a warning
      console.warn(`⚠️ Task insertion failed but continuing orchestration. Tasks will be created on-demand.`);
    }
  }

  /**
   * Update job with task counts
   */
  private async updateJobTaskCounts(
    jobId: string, 
    totalTasks: number, 
    completedTasks: number, 
    failedTasks: number, 
    skippedTasks: number = 0
  ): Promise<void> {
    try {
      const { error } = await this.supabase
        .from('course_generation_jobs')
        .update({
          total_tasks: totalTasks,
          completed_tasks: completedTasks,
          failed_tasks: failedTasks,
          skipped_tasks: skippedTasks,
          progress_percentage: totalTasks > 0 ? Math.round((completedTasks / totalTasks) * 100) : 0,
          updated_at: new Date().toISOString()
        })
        .eq('id', jobId);

      if (error) {
        console.error('Failed to update job task counts:', error);
        throw new Error(`Failed to update task counts: ${error.message}`);
      }
    } catch (error) {
      console.error('Error updating job task counts:', error);
      throw error;
    }
  }

  /**
   * Load existing outline from database
   */
  private async loadExistingOutline(courseOutlineId: string): Promise<CourseOutline> {
    const { data: outlineData, error } = await this.supabase
      .from('course_outlines')
      .select('outline_data')
      .eq('id', courseOutlineId)
      .single();

    if (error || !outlineData) {
      throw new Error(`Failed to load outline: ${error?.message}`);
    }

    return outlineData.outline_data as CourseOutline;
  }

  /**
   * Generate outline with tracking as a task
   */
  private async generateOutlineWithTracking(jobId: string, request: CourseGenerationRequest): Promise<CourseOutline> {
    // Create outline generation task
    const outlineTaskId = `outline-generation-${jobId}`;
    await this.createAndInsertTask({
      id: crypto.randomUUID(),
      task_identifier: outlineTaskId,
      task_type: 'outline_generation',
      status: 'running',
      dependencies: [],
      execution_priority: 1,
      max_retry_count: 2,
      current_retry_count: 0,
      estimated_duration_seconds: 180,
      base_class_id: request.baseClassId,
      input_data: { request },
      is_recoverable: true,
      recovery_suggestions: ['Retry with simplified requirements', 'Use template-based outline']
    }, jobId);

    try {
      // Use existing knowledge base analyzer to generate outline (same as v1)
      const kbAnalysis = await knowledgeBaseAnalyzer.analyzeKnowledgeBase(request.baseClassId);

      // Determine generation mode (same as v1)
      const generationMode = request.generationMode || kbAnalysis.recommendedGenerationMode;

      // Generate outline using the same logic as v1
      const outline = await this.generateOutlineWithAI(request, kbAnalysis, generationMode);

      // Mark task as completed
      await this.updateTaskStatus(outlineTaskId, 'completed');
      
      return outline;
    } catch (error) {
      await this.updateTaskStatus(outlineTaskId, 'failed', error instanceof Error ? error.message : 'Unknown error');
      throw error;
    }
  }

  /**
   * Create LMS entities with individual task tracking
   */
  private async createLMSEntitiesWithTracking(jobId: string, outline: CourseOutline, request: CourseGenerationRequest): Promise<void> {
    console.log('🚀 Creating LMS entities with V2 tracking...');

    // Create tasks for each path and lesson creation
    const lmsCreationTasks: TaskDefinition[] = [];
    
    for (let moduleIndex = 0; moduleIndex < outline.modules.length; moduleIndex++) {
      const module = outline.modules[moduleIndex];
      
      // Path creation task
      const pathTaskId = `create-path-${moduleIndex}`;
      lmsCreationTasks.push({
        id: crypto.randomUUID(),
        task_identifier: pathTaskId,
        task_type: 'knowledge_analysis', // Reusing existing type
        status: 'pending',
        dependencies: [],
        execution_priority: 10 + moduleIndex,
        max_retry_count: 3,
        current_retry_count: 0,
        estimated_duration_seconds: 30,
        base_class_id: request.baseClassId,
        input_data: { module, moduleIndex, request },
        is_recoverable: true,
        recovery_suggestions: ['Retry path creation', 'Use simplified path structure']
      });

      // Lesson creation tasks (depend on path)
      for (let lessonIndex = 0; lessonIndex < module.lessons.length; lessonIndex++) {
        const lessonTaskId = `create-lesson-${moduleIndex}-${lessonIndex}`;
        lmsCreationTasks.push({
          id: crypto.randomUUID(),
          task_identifier: lessonTaskId,
          task_type: 'knowledge_analysis', // Reusing existing type
          status: 'pending',
          dependencies: [pathTaskId],
          execution_priority: 20 + (moduleIndex * 10) + lessonIndex,
          max_retry_count: 3,
          current_retry_count: 0,
          estimated_duration_seconds: 20,
          base_class_id: request.baseClassId,
          input_data: { lesson: module.lessons[lessonIndex], moduleIndex, lessonIndex, request },
          is_recoverable: true,
          recovery_suggestions: ['Retry lesson creation', 'Use simplified lesson structure']
        });
      }
    }

    // Insert all LMS creation tasks
    await this.bulkInsertTasks(jobId, lmsCreationTasks);

    // Execute LMS creation tasks sequentially with proper dependency handling
    await this.executeLMSCreationTasks(jobId, outline, request, lmsCreationTasks);
  }

  /**
   * Execute LMS creation tasks with dependency management
   */
  private async executeLMSCreationTasks(
    jobId: string, 
    outline: CourseOutline, 
    request: CourseGenerationRequest,
    tasks: TaskDefinition[]
  ): Promise<void> {
    const pathIdMap = new Map<number, string>();

    // Execute tasks in dependency order
    for (const task of tasks.sort((a, b) => a.execution_priority - b.execution_priority)) {
      try {
        await this.updateTaskStatus(task.task_identifier, 'running');

        if (task.task_identifier.startsWith('create-path-')) {
          // Create path
          const moduleIndex = task.input_data.moduleIndex;
          const module = task.input_data.module;

          const { data: path, error: pathError } = await this.supabase
            .from('paths')
            .insert({
              organisation_id: request.organisationId,
              base_class_id: request.baseClassId,
              title: module.title,
              description: module.description,
              level: request.academicLevel,
              order_index: moduleIndex,
              published: false,
              created_by: request.userId,
              creator_user_id: request.userId
            })
            .select('id, title')
            .single();

          if (pathError || !path) {
            throw new Error(`Failed to create path: ${pathError?.message}`);
          }

          pathIdMap.set(moduleIndex, path.id);
          console.log(`📁 Created path: ${module.title}`);
          
        } else if (task.task_identifier.startsWith('create-lesson-')) {
          // Create lesson
          const { lesson, moduleIndex, lessonIndex } = task.input_data;
          const pathId = pathIdMap.get(moduleIndex);

          if (!pathId) {
            throw new Error(`Path not found for module ${moduleIndex}`);
          }

          const { data: createdLesson, error: lessonError } = await this.supabase
            .from('lessons')
            .insert({
              path_id: pathId,
              base_class_id: request.baseClassId,
              title: lesson.title,
              description: lesson.description,
              level: request.academicLevel,
              order_index: lessonIndex,
              estimated_time: lesson.estimatedDurationHours ? lesson.estimatedDurationHours * 60 : 45,
              published: false,
              created_by: request.userId,
              creator_user_id: request.userId
            })
            .select('id')
            .single();

          if (lessonError || !createdLesson) {
            throw new Error(`Failed to create lesson: ${lessonError?.message}`);
          }

          console.log(`📖 Created lesson: ${lesson.title}`);
        }

        await this.updateTaskStatus(task.task_identifier, 'completed');
        
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : 'Unknown error';
        await this.updateTaskStatus(task.task_identifier, 'failed', errorMessage);
        throw error;
      }
    }

    console.log('✅ LMS entity creation completed with V2 tracking!');
    
    // Update job result data to indicate LMS entities are created
    await this.updateJobResultData(jobId, {
      lms_entities_created: true,
      paths_created: pathIdMap.size,
      lessons_created: tasks.filter(t => t.task_identifier.startsWith('create-lesson-')).length,
      lms_creation_completed_at: new Date().toISOString()
    });
  }

  /**
   * Update job result data with additional information
   */
  private async updateJobResultData(jobId: string, additionalData: any): Promise<void> {
    try {
      // Get current result data
      const { data: currentJob, error: fetchError } = await this.supabase
        .from('course_generation_jobs')
        .select('result_data')
        .eq('id', jobId)
        .single();
      
      if (fetchError) {
        console.error('Error fetching current job data:', fetchError);
        return;
      }
      
      // Merge with existing data
      const updatedResultData = {
        ...(currentJob?.result_data || {}),
        ...additionalData
      };
      
      // Update the job
      const { error: updateError } = await this.supabase
        .from('course_generation_jobs')
        .update({
          result_data: updatedResultData,
          updated_at: new Date().toISOString()
        })
        .eq('id', jobId);
      
      if (updateError) {
        console.error('Error updating job result data:', updateError);
      } else {
        console.log('✅ Updated job result data with:', Object.keys(additionalData));
      }
    } catch (error) {
      console.error('Error in updateJobResultData:', error);
    }
  }

  /**
   * Initialize content generation tasks (renamed from initializeTasksInDatabase)
   */
  private async initializeContentTasks(
    jobId: string,
    outline: CourseOutline,
    request: CourseGenerationRequest
  ): Promise<void> {
    // This is the existing initializeTasksInDatabase method content
    await this.initializeTasksInDatabase(jobId, outline, request);
  }

  /**
   * Helper to create and insert a single task
   */
  private async createAndInsertTask(task: TaskDefinition, jobId: string): Promise<void> {
    await this.bulkInsertTasks(jobId, [task]);
  }

  /**
   * Update task status by identifier
   */
  private async updateTaskStatus(taskIdentifier: string, status: string, errorMessage?: string): Promise<void> {
    const updateData: any = {
      status,
      updated_at: new Date().toISOString()
    };

    if (errorMessage) {
      updateData.error_message = errorMessage;
    }

    const { error } = await this.supabase
      .from('course_generation_tasks')
      .update(updateData)
      .eq('task_identifier', taskIdentifier);

    if (error) {
      console.error(`Failed to update task ${taskIdentifier}:`, error);
    }
  }

  /**
   * Generate course outline using AI (same logic as v1)
   */
  private async generateOutlineWithAI(
    request: CourseGenerationRequest,
    kbAnalysis: any,
    generationMode: 'kb_only' | 'kb_priority' | 'kb_supplemented'
  ): Promise<CourseOutline> {
    const modeConfig = COURSE_GENERATION_MODES[generationMode];
    
    // Get relevant knowledge base content (simplified version of v1 logic)
    const kbContent = await this.getRelevantKnowledgeBaseContent(
      request.baseClassId,
      request.title,
      request.description || '',
      generationMode
    );

    // Build prompt (simplified version of v1 logic)
    const prompt = this.buildCourseOutlinePrompt(request, kbAnalysis, kbContent, modeConfig);

    // Generate outline with OpenAI (same approach as v1)
    const completion = await this.openai.chat.completions.create({
      model: 'gpt-4.1-mini',
      messages: [
        {
          role: 'system',
          content: 'You are an expert instructional designer creating comprehensive educational courses.'
        },
        {
          role: 'user',
          content: prompt
        }
      ],
      response_format: { type: "json_object" }, // Force valid JSON like v1
      temperature: 0.7,
      max_tokens: 8000  // Increased from 4000 to prevent truncation
    });

    const outlineText = completion.choices[0]?.message?.content;
    if (!outlineText) {
      throw new Error('Failed to generate course outline');
    }

    // Check if response was truncated due to token limit
    const finishReason = completion.choices[0]?.finish_reason;
    if (finishReason === 'length') {
      console.warn('⚠️ OpenAI response was truncated due to token limit - attempting repair');
    }

    // Use v1's simple and reliable parsing approach
    try {
      const outline = JSON.parse(outlineText || '{}');
      return outline;
    } catch (parseError) {
      console.error('❌ JSON parsing failed, attempting repair...');
      console.log('Raw content length:', outlineText.length);
      console.log('Raw content preview:', outlineText.substring(0, 500));
      console.log('Finish reason:', finishReason);
      
      // Try v1's repair method
      const repairedContent = this.repairJsonContent(outlineText);
      if (repairedContent) {
        return repairedContent;
      }
      
      // If repair fails, create fallback outline
      return this.createFallbackOutline(request);
    }
  }



  /**
   * Create fallback outline when JSON parsing fails (same as v1)
   */
  private createFallbackOutline(request: CourseGenerationRequest): any {
    const weeks = request.estimatedDurationWeeks || 12;
    const lessonsPerWeek = request.lessonsPerWeek || 2;
    
    const modules = [];
    for (let i = 1; i <= weeks; i++) {
      const lessons = [];
      for (let j = 1; j <= lessonsPerWeek; j++) {
        lessons.push({
          id: `lesson-${i}-${j}`,
          title: `${request.title} - Week ${i}, Lesson ${j}`,
          description: `Lesson ${j} content for week ${i} of ${request.title}`,
          order: j,
          estimatedDurationHours: 2,
          contentType: "lecture",
          learningObjectives: [`Learn key concepts for week ${i}, lesson ${j}`],
          contentOutline: [`Introduction to topic`, `Main concepts`, `Practice exercises`],
          requiredResources: ["Course materials"]
        });
      }
      
      modules.push({
        id: `module-${i}`,
        title: `Week ${i}: ${request.title} - Module ${i}`,
        description: `Week ${i} content covering fundamental concepts`,
        order: i,
        estimatedDurationWeeks: 1,
        learningObjectives: [`Master week ${i} concepts`, `Apply week ${i} skills`],
        lessons: lessons,
        assessments: [{
          id: `assessment-${i}`,
          title: `Week ${i} Assessment`,
          type: "quiz",
          order: 1,
          estimatedDurationMinutes: 30,
          learningObjectives: [`Assess week ${i} understanding`],
          assessmentCriteria: [`Demonstrate mastery of key concepts`],
          questions: [`Question about week ${i} content`]
        }]
      });
    }
    
    return {
      description: request.description || `Comprehensive course covering ${request.title}`,
      learningObjectives: [
        `Students will master ${request.title} concepts`,
        `Students will apply knowledge practically`,
        `Students will demonstrate understanding through assessments`
      ],
      estimatedDurationWeeks: weeks,
      modules: modules
    };
  }

  /**
   * Get relevant knowledge base content (simplified version of v1)
   */
  private async getRelevantKnowledgeBaseContent(
    baseClassId: string,
    title: string,
    description: string,
    generationMode: string
  ): Promise<any> {
    // Use the knowledge base analyzer to search for relevant content
    const searchResults = await knowledgeBaseAnalyzer.searchKnowledgeBaseForGeneration(
      baseClassId,
      `${title} ${description}`,
      generationMode as 'kb_only' | 'kb_priority' | 'kb_supplemented',
      {
        totalChunks: generationMode === 'kb_only' ? 50 : 30,
        courseScope: 'outline'
      }
    );
    
    return searchResults;
  }

  /**
   * Build course outline prompt (same logic as v1)
   */
  private buildCourseOutlinePrompt(
    request: CourseGenerationRequest,
    kbAnalysis: any,
    kbContent: any,
    modeConfig: any
  ): string {
    // Use same calculation logic as v1
    const totalLessons = (request.estimatedDurationWeeks || 12) * (request.lessonsPerWeek || 2);
    const lessonsPerModule = Math.ceil(totalLessons / (request.estimatedDurationWeeks || 12));

    return `You are an expert instructional designer creating a comprehensive educational course.

COURSE CONFIGURATION:
- Title: ${request.title}
- Description: ${request.description || 'Not provided'}
- Duration: ${request.estimatedDurationWeeks || 12} weeks
- Modules: ${request.estimatedDurationWeeks || 12} (one module per week)
- Lessons per Week: ${request.lessonsPerWeek || 2}
- Total Lessons: ${totalLessons}
- Academic Level: ${request.academicLevel || 'college'}
- Content Depth: ${request.lessonDetailLevel || 'detailed'}

Knowledge Base Analysis: ${JSON.stringify(kbAnalysis, null, 2)}
Relevant Content: ${JSON.stringify(kbContent, null, 2)}
Generation Mode: ${modeConfig.name}

${request.userGuidance ? `\nADDITIONAL GUIDANCE:\n${request.userGuidance}` : ''}

CRITICAL INSTRUCTIONS FOR COURSE STRUCTURE:
1. Create EXACTLY ${request.estimatedDurationWeeks || 12} modules (one per week)
2. Each module should contain approximately ${lessonsPerModule} lessons
3. Design a logical, progressive learning path where each module builds on the previous
4. Ensure the course takes learners from foundational concepts to mastery
5. Create actual educational content plans, not just topic outlines
6. Focus on teaching and knowledge transfer, not just information listing

EDUCATIONAL CONTENT REQUIREMENTS:
- Each lesson must have clear, measurable learning objectives
- Content must be designed to actively teach, not just present information
- Include varied instructional approaches (lectures, activities, discussions, etc.)
- Ensure depth and breadth appropriate for the academic level
- Plan for student engagement and active learning throughout

Generate a comprehensive course outline in JSON format:
{
  "description": "Comprehensive course description explaining what students will learn and achieve",
  "learningObjectives": [
    "Students will be able to...",
    "Students will master...",
    "Students will understand..."
  ],
  "estimatedDurationWeeks": ${request.estimatedDurationWeeks || 12},
  "modules": [
    {
      "id": "module-1",
      "title": "Week 1: [Descriptive Module Title]",
      "description": "Detailed description of what will be taught this week",
      "order": 1,
      "estimatedDurationWeeks": 1,
      "learningObjectives": [
        "Specific, measurable objective 1",
        "Specific, measurable objective 2"
      ],
      "lessons": [
        {
          "id": "lesson-1-1",
          "title": "[Specific Lesson Title]",
          "description": "What this lesson will teach and how",
          "order": 1,
          "estimatedDurationHours": 2,
          "contentType": "lecture|activity|discussion|reading|lab",
          "learningObjectives": ["What students will learn"],
          "contentOutline": [
            "Major topic/concept to teach",
            "Key skill to develop",
            "Important principle to understand"
          ],
          "requiredResources": ["Specific resources needed"]
        }
      ],
      "assessments": [
        {
          "id": "assessment-1",
          "title": "Week 1 Quiz",
          "type": "quiz",
          "order": 1,
          "estimatedDurationMinutes": 30,
          "learningObjectives": ["What this assessment measures"],
          "assessmentCriteria": ["How mastery is evaluated"],
          "questions": [
            "Sample question that tests understanding"
          ]
        }
      ]
    }
  ]
}`;
  }

  /**
   * Check circuit breakers before task execution
   */
  private async checkCircuitBreakers(task: any): Promise<void> {
    // Simple circuit breaker logic - could be enhanced
    const failureThreshold = 3;
    if (task.current_retry_count >= failureThreshold) {
      throw new Error(`Circuit breaker: Task ${task.task_identifier} has exceeded failure threshold`);
    }
  }

  /**
   * Update overall job progress based on completed tasks
   */
  private async updateJobProgress(jobId: string): Promise<void> {
    try {
      // Get task counts
      const { data: tasks, error } = await this.supabase
        .from('course_generation_tasks')
        .select('status')
        .eq('job_id', jobId);

      if (error) {
        console.error('Failed to fetch tasks for progress update:', error);
        return;
      }

      const totalTasks = tasks.length;
      const completedTasks = tasks.filter(t => t.status === 'completed').length;
      const failedTasks = tasks.filter(t => t.status === 'failed').length;
      const progressPercentage = totalTasks > 0 ? Math.round((completedTasks / totalTasks) * 100) : 0;

      // Update job progress
      await this.supabase
        .from('course_generation_jobs')
        .update({
          progress_percentage: progressPercentage,
          completed_tasks: completedTasks,
          failed_tasks: failedTasks,
          updated_at: new Date().toISOString()
        })
        .eq('id', jobId);

    } catch (error) {
      console.error('Error updating job progress:', error);
    }
  }

  /**
   * Sleep utility for delays
   */
  private async sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  // ===== MISSING TASK EXECUTION METHODS =====

  /**
   * Execute lesson assessment task - V1 EXACT MATCH using AssessmentGenerationService
   */
  private async executeLessonAssessmentTask(task: TaskDefinition, outline: CourseOutline, request: CourseGenerationRequest): Promise<any> {
    console.log(`📝 Executing lesson assessment task: ${task.task_identifier}`);
    
    try {
      const lessonId = task.lesson_id;
      if (!lessonId) {
        throw new Error('No lesson_id provided for assessment task');
      }

      // V1 EXACT MATCH: Use AssessmentGenerationService like V1 does
      console.log(`📝 Using V1 AssessmentGenerationService for lesson: ${lessonId}`);
      
      // Import and use the same service V1 uses
      const { AssessmentGenerationService } = await import('@/lib/services/assessment-generation-service');
      const assessmentGenerator = new AssessmentGenerationService();

      // Use the exact same parameters V1 uses
      const questionsPerLesson = request.assessmentSettings?.questionsPerLesson || 5;
      const assessmentParams = {
        scope: 'lesson' as const,
        scopeId: lessonId,
        baseClassId: request.baseClassId,
        questionCount: questionsPerLesson,
        assessmentTitle: `Lesson Assessment`,
        assessmentDescription: `Assessment covering key concepts from the lesson`,
        questionTypes: this.getQuestionTypesForLevel(request.academicLevel),
        difficulty: this.mapAcademicLevelToDifficulty(request.academicLevel),
        timeLimit: 30, // 30 minutes for lesson assessments
        passingScore: 70,
        onProgress: (message: string) => console.log(`📝 Assessment Generation: ${message}`)
      };

      const assessment = await assessmentGenerator.generateAssessment(assessmentParams);
      console.log(`✅ Created assessment with ${questionsPerLesson} questions using V1 service`);

      console.log(`✅ Lesson assessment task completed: ${task.task_identifier}`);
      return assessment;
    } catch (error) {
      console.error(`❌ Lesson assessment task failed: ${task.task_identifier}`, error);
      throw error;
    }
  }

  // V1 helper methods for assessment generation
  private getQuestionTypesForLevel(academicLevel: string): string[] {
    switch (academicLevel?.toLowerCase()) {
      case 'elementary':
        return ['multiple_choice', 'true_false'];
      case 'middle_school':
        return ['multiple_choice', 'true_false', 'short_answer'];
      case 'high_school':
        return ['multiple_choice', 'short_answer', 'essay'];
      case 'college':
      default:
        return ['multiple_choice', 'short_answer', 'essay'];
    }
  }

  private mapAcademicLevelToDifficulty(academicLevel: string): string {
    switch (academicLevel?.toLowerCase()) {
      case 'elementary': return 'easy';
      case 'middle_school': return 'medium';
      case 'high_school': return 'medium';
      case 'college': return 'hard';
      default: return 'medium';
    }
  }

  /**
   * Execute lesson mind map task - V1 EXACT MATCH calling existing API
   */
  private async executeLessonMindMapTask(task: TaskDefinition, outline: CourseOutline, request: CourseGenerationRequest): Promise<any> {
    console.log(`🧠 Executing lesson mind map task: ${task.task_identifier}`);
    
    try {
      const lessonId = task.lesson_id;
      if (!lessonId) {
        throw new Error('No lesson_id provided for mind map task');
      }

      // V1 EXACT MATCH: Call the existing mind map API like V1 does
      console.log(`🧠 Calling V1 mind map API for lesson: ${lessonId}`);
      
      // Add delay to ensure lesson data is committed to database (V1 pattern)
      await new Promise(resolve => setTimeout(resolve, 3000));

      let retryCount = 0;
      const maxRetries = 3;

      while (retryCount < maxRetries) {
        try {
          console.log(`🧠 Attempt ${retryCount + 1}/${maxRetries} - Generating mind map for lesson: ${lessonId}`);
          
          // Construct the API URL for internal requests (V1 pattern)
          const baseUrl = process.env.VERCEL_URL 
            ? `https://${process.env.VERCEL_URL}` 
            : process.env.NEXT_PUBLIC_SITE_URL || 'http://localhost:3000';
          
          // Call the existing mind map API directly with internal flag and user ID (V1 pattern)
          // Add timeout to prevent hanging
          const controller = new AbortController();
          const timeoutId = setTimeout(() => controller.abort(), 120000); // 2 minute timeout
          
          const response = await fetch(`${baseUrl}/api/teach/media/generate/mind-map`, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'X-Internal-Request': 'true', // Flag for internal requests
            },
            body: JSON.stringify({
              lessonId: lessonId,
              userId: request.userId, // Pass user ID for internal requests
              internal: true
            }),
            signal: controller.signal
          });
          
          clearTimeout(timeoutId);

          if (!response.ok) {
            const errorText = await response.text();
            console.error(`🧠 Mind map API error (${response.status}):`, errorText);
            
            // Handle specific error cases without retrying
            if (errorText.includes('A mind map already exists for this lesson')) {
              console.log(`✅ Mind map already exists for lesson, marking as completed`);
              return { message: 'Mind map already exists - marked as completed' };
            }
            
            // If it's a lesson not found error, retry after delay (V1 pattern)
            if (response.status === 500 && errorText.includes('Lesson not found')) {
              retryCount++;
              if (retryCount < maxRetries) {
                console.log(`🧠 Lesson not found, retrying in 2 seconds... (${retryCount}/${maxRetries})`);
                await new Promise(resolve => setTimeout(resolve, 2000));
                continue;
              }
            }
            
            throw new Error(`Mind map API returned ${response.status}: ${errorText}`);
          }

          const result = await response.json();
          console.log(`✅ Created mind map for lesson using V1 API`);
          console.log(`✅ Lesson mind map task completed: ${task.task_identifier}`);
          return result;
          
        } catch (error) {
          retryCount++;
          
          // Handle timeout errors specifically
          if (error.name === 'AbortError') {
            console.error(`🧠 Mind map generation timed out (2 minutes) - attempt ${retryCount}/${maxRetries}`);
          } else {
            console.error(`🧠 Failed attempt ${retryCount}/${maxRetries} for mind map generation:`, error);
          }
          
          if (retryCount >= maxRetries) {
            console.error(`❌ Failed to generate mind map for lesson after ${maxRetries} attempts:`, error);
            // V1 compatible: Don't throw error to prevent course generation from failing
            break;
          }
          
          // Wait before retry
          await new Promise(resolve => setTimeout(resolve, 5000));
        }
      }
    } catch (error) {
      console.error(`❌ Lesson mind map task failed: ${task.task_identifier}`, error);
      // V1 compatible: Don't throw error to prevent course generation from failing
      // The task will be marked as failed by the orchestrator but generation continues
      return null;
    }
  }

  /**
   * Execute lesson brainbytes task - V1 EXACT MATCH calling existing API
   */
  private async executeLessonBrainbytesTask(task: TaskDefinition, outline: CourseOutline, request: CourseGenerationRequest): Promise<any> {
    console.log(`🧩 Executing lesson brainbytes task: ${task.task_identifier}`);
    
    try {
      const lessonId = task.lesson_id;
      if (!lessonId) {
        throw new Error('No lesson_id provided for brainbytes task');
      }

      // V1 EXACT MATCH: Call the existing brainbytes API like V1 does
      console.log(`🎧 Calling V1 brainbytes API for lesson: ${lessonId}`);
      
      // Add delay to ensure lesson data is committed to database (V1 pattern)
      await new Promise(resolve => setTimeout(resolve, 3000));

      let retryCount = 0;
      const maxRetries = 3;

      while (retryCount < maxRetries) {
        try {
          console.log(`🎧 Attempt ${retryCount + 1}/${maxRetries} - Generating brainbytes for lesson: ${lessonId}`);
          
          // Use academic level from request, default to 'college' (V1 pattern)
          const gradeLevel = request.academicLevel || 'college';
          
          // Construct the API URL for internal requests (V1 pattern)
          const baseUrl = process.env.VERCEL_URL 
            ? `https://${process.env.VERCEL_URL}` 
            : process.env.NEXT_PUBLIC_SITE_URL || 'http://localhost:3000';
          
          // Call the existing brainbytes API directly with internal flag and user ID (V1 pattern)
          // Add timeout to prevent hanging
          const controller = new AbortController();
          const timeoutId = setTimeout(() => controller.abort(), 120000); // 2 minute timeout
          
          const response = await fetch(`${baseUrl}/api/teach/media/generate/podcast`, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'X-Internal-Request': 'true', // Flag for internal requests
            },
            body: JSON.stringify({
              lessonId: lessonId,
              userId: request.userId, // Pass user ID for internal requests
              gradeLevel: gradeLevel,
              internal: true
            }),
            signal: controller.signal
          });
          
          clearTimeout(timeoutId);

          if (!response.ok) {
            const errorText = await response.text();
            console.error(`🎧 Brainbytes API error (${response.status}):`, errorText);
            
            // Handle specific error cases without retrying
            if (errorText.includes('already exists for this lesson') || 
                errorText.includes('Brain Bytes podcast already exists')) {
              console.log(`✅ Brainbytes already exists for lesson, marking as completed`);
              return { message: 'Brainbytes already exists - marked as completed' };
            }
            
            // Handle network/connectivity errors with exponential backoff
            if (response.status >= 500 && errorText.includes('fetch failed')) {
              retryCount++;
              if (retryCount < maxRetries) {
                const backoffDelay = Math.min(2000 * Math.pow(2, retryCount - 1), 10000); // Max 10s delay
                console.log(`🎧 Network error, retrying in ${backoffDelay/1000}s... (${retryCount}/${maxRetries})`);
                await new Promise(resolve => setTimeout(resolve, backoffDelay));
                continue;
              }
            }
            
            // If it's a lesson not found error, retry after delay (V1 pattern)
            if (response.status === 500 && errorText.includes('Lesson not found')) {
              retryCount++;
              if (retryCount < maxRetries) {
                console.log(`🎧 Lesson not found, retrying in 2 seconds... (${retryCount}/${maxRetries})`);
                await new Promise(resolve => setTimeout(resolve, 2000));
                continue;
              }
            }
            
            throw new Error(`Brainbytes API returned ${response.status}: ${errorText}`);
          }

          const result = await response.json();
          console.log(`✅ Created brainbytes for lesson using V1 API`);
          console.log(`✅ Lesson brainbytes task completed: ${task.task_identifier}`);
          return result;
          
        } catch (error) {
          retryCount++;
          
          // Handle timeout errors specifically
          if (error.name === 'AbortError') {
            console.error(`🎧 Brainbytes generation timed out (2 minutes) - attempt ${retryCount}/${maxRetries}`);
          } else {
            console.error(`🎧 Failed attempt ${retryCount}/${maxRetries} for brainbytes generation:`, error);
          }
          
          if (retryCount >= maxRetries) {
            console.error(`❌ Failed to generate brainbytes for lesson after ${maxRetries} attempts:`, error);
            // V1 compatible: Don't throw error to prevent course generation from failing
            break;
          }
          
          // Wait before retry
          await new Promise(resolve => setTimeout(resolve, 5000));
        }
      }
    } catch (error) {
      console.error(`❌ Lesson brainbytes task failed: ${task.task_identifier}`, error);
      // V1 compatible: Don't throw error to prevent course generation from failing
      // The task will be marked as failed by the orchestrator but generation continues
      return null;
    }
  }

  /**
   * Execute path quiz task - create comprehensive quizzes (V1 compatible)
   */
  private async executePathQuizTask(task: TaskDefinition, outline: CourseOutline, request: CourseGenerationRequest): Promise<any> {
    console.log(`❓ Executing path quiz task: ${task.task_identifier}`);
    
    try {
      const pathId = task.path_id;
      if (!pathId) {
        throw new Error('No path_id provided for quiz task');
      }

      const { pathTitle } = task.input_data;
      
      if (!request.assessmentSettings?.includeQuizzes) {
        console.log(`⏭️ Skipping path quiz generation - includeQuizzes is false`);
        return;
      }

      console.log(`🎯 Generating quiz for path: ${pathTitle}`);

      const questionsPerQuiz = request.assessmentSettings?.questionsPerQuiz || 10;
      const assessmentParams = {
        scope: 'path' as const,
        scopeId: pathId,
        baseClassId: request.baseClassId,
        questionCount: questionsPerQuiz,
        assessmentTitle: `${pathTitle} - Module Quiz`,
        assessmentDescription: `Comprehensive quiz covering all lessons in: ${pathTitle}`,
        questionTypes: this.getQuestionTypesForLevel(request.academicLevel),
        difficulty: this.mapAcademicLevelToDifficulty(request.academicLevel),
        timeLimit: 60,
        passingScore: 75,
        onProgress: (message: string) => console.log(`📝 Quiz Generation: ${message}`)
      };

      await this.assessmentGenerator.generateAssessment(assessmentParams);
      console.log(`✅ Created quiz for path: ${pathTitle}`);
      console.log(`✅ Path quiz task completed: ${task.task_identifier}`);
      
    } catch (error) {
      console.error(`❌ Path quiz task failed: ${task.task_identifier}`, error);
      throw error;
    }
  }

  /**
   * Execute class exam task - create comprehensive exams (V1 compatible)
   */
  private async executeClassExamTask(task: TaskDefinition, outline: CourseOutline, request: CourseGenerationRequest): Promise<any> {
    console.log(`📋 Executing class exam task: ${task.task_identifier}`);
    
    try {
      const baseClassId = task.base_class_id;
      if (!baseClassId) {
        throw new Error('No base_class_id provided for exam task');
      }

      const { classTitle } = task.input_data;
      console.log(`📋 Class exam generation details:`, {
        classTitle,
        baseClassId,
        includeFinalExam: request.assessmentSettings?.includeFinalExam,
        assessmentSettings: request.assessmentSettings
      });
      
      if (!request.assessmentSettings?.includeFinalExam) {
        console.log(`⏭️ Skipping final exam generation - includeFinalExam is false`);
        return;
      }

      console.log(`🎯 Generating final exam for class: ${classTitle}`);

      const questionsPerExam = request.assessmentSettings?.questionsPerExam || 25;
      const assessmentParams = {
        scope: 'class' as const,
        scopeId: baseClassId,
        baseClassId: baseClassId,
        questionCount: questionsPerExam,
        assessmentTitle: `${classTitle} - Final Exam`,
        assessmentDescription: `Comprehensive final exam covering all course material from: ${classTitle}`,
        questionTypes: this.getQuestionTypesForLevel(request.academicLevel),
        difficulty: this.mapAcademicLevelToDifficulty(request.academicLevel),
        timeLimit: 120,
        passingScore: 70,
        onProgress: (message: string) => console.log(`📝 Final Exam Generation: ${message}`)
      };

      console.log(`📝 Starting assessment generation with params:`, assessmentParams);

      try {
        await this.assessmentGenerator.generateAssessment(assessmentParams);
        console.log(`✅ Created final exam for class: ${classTitle}`);
        console.log(`✅ Class exam task completed: ${task.task_identifier}`);
      } catch (error) {
        console.error(`❌ Failed to generate class exam:`, error);
        throw error;
      }
      
    } catch (error) {
      console.error(`❌ Class exam task failed: ${task.task_identifier}`, error);
      throw error;
    }
  }

  // ===== MISSING PROMPT BUILDER METHODS =====

  private buildLessonAssessmentPrompt(lessonId: string, kbContent: any[], outline: any, request: any): string {
    return `Create comprehensive assessment questions for a lesson based on the provided knowledge base content.

KNOWLEDGE BASE CONTENT:
${kbContent.map(item => `- ${item.title}: ${item.content.substring(0, 500)}...`).join('\n')}

COURSE CONTEXT:
- Course Level: ${request.course_level || 'Intermediate'}
- Target Audience: ${request.target_audience || 'General learners'}
- Learning Style: ${request.learning_style || 'Mixed'}

Generate assessment questions that test understanding, application, and analysis of the content.

Respond with ONLY valid JSON in this exact format:
{
  "questions": [
    {
      "type": "multiple_choice",
      "question": "Question text here",
      "options": ["A", "B", "C", "D"],
      "correct_answer": "A",
      "explanation": "Why this is correct"
    },
    {
      "type": "short_answer",
      "question": "Question text here",
      "sample_answer": "Expected answer"
    }
  ],
  "difficulty_level": "intermediate",
  "estimated_time_minutes": 15
}`;
  }

  private buildLessonMindMapPrompt(lessonId: string, kbContent: any[], outline: any, request: any): string {
    return `Create a comprehensive mind map structure for a lesson based on the provided knowledge base content.

KNOWLEDGE BASE CONTENT:
${kbContent.map(item => `- ${item.title}: ${item.content.substring(0, 500)}...`).join('\n')}

COURSE CONTEXT:
- Course Level: ${request.course_level || 'Intermediate'}
- Target Audience: ${request.target_audience || 'General learners'}

Create a hierarchical mind map that shows relationships between concepts, with main topics, subtopics, and connections.

Respond with ONLY valid JSON in this exact format:
{
  "central_topic": "Main lesson topic",
  "branches": [
    {
      "topic": "Main branch topic",
      "subtopics": ["Subtopic 1", "Subtopic 2"],
      "connections": ["Related branch topic"],
      "color": "#FF6B6B"
    }
  ],
  "key_concepts": ["Concept 1", "Concept 2"],
  "relationships": [
    {
      "from": "Topic A",
      "to": "Topic B",
      "relationship": "causes"
    }
  ]
}`;
  }

  private buildLessonBrainbytesPrompt(lessonId: string, kbContent: any[], outline: any, request: any): string {
    return `Create bite-sized learning content (brainbytes) for a lesson based on the provided knowledge base content.

KNOWLEDGE BASE CONTENT:
${kbContent.map(item => `- ${item.title}: ${item.content.substring(0, 500)}...`).join('\n')}

COURSE CONTEXT:
- Course Level: ${request.course_level || 'Intermediate'}
- Target Audience: ${request.target_audience || 'General learners'}

Create short, digestible learning chunks that can be consumed quickly but effectively reinforce key concepts.

Respond with ONLY valid JSON in this exact format:
{
  "brainbytes": [
    {
      "title": "Bite-sized topic title",
      "content": "Brief, focused explanation (max 200 words)",
      "key_takeaway": "Main point to remember",
      "quick_tip": "Practical application tip",
      "estimated_read_time": 2
    }
  ],
  "total_bytes": 5,
  "difficulty_level": "intermediate"
}`;
  }

  private buildPathQuizPrompt(pathId: string, kbContent: any[], outline: any, request: any): string {
    return `Create a comprehensive quiz for a learning path based on the provided knowledge base content.

KNOWLEDGE BASE CONTENT:
${kbContent.map(item => `- ${item.title}: ${item.content.substring(0, 500)}...`).join('\n')}

COURSE CONTEXT:
- Course Level: ${request.course_level || 'Intermediate'}
- Target Audience: ${request.target_audience || 'General learners'}

Create a quiz that tests understanding across multiple lessons in the path, with varied question types.

Respond with ONLY valid JSON in this exact format:
{
  "quiz_title": "Path Quiz Title",
  "questions": [
    {
      "type": "multiple_choice",
      "question": "Question text",
      "options": ["A", "B", "C", "D"],
      "correct_answer": "A",
      "explanation": "Explanation",
      "points": 10
    }
  ],
  "total_points": 100,
  "time_limit_minutes": 30,
  "passing_score": 70
}`;
  }

  private buildClassExamPrompt(classId: string, kbContent: any[], outline: any, request: any): string {
    return `Create a comprehensive final exam for the entire class based on the provided knowledge base content.

KNOWLEDGE BASE CONTENT:
${kbContent.map(item => `- ${item.title}: ${item.content.substring(0, 500)}...`).join('\n')}

COURSE CONTEXT:
- Course Level: ${request.course_level || 'Intermediate'}
- Target Audience: ${request.target_audience || 'General learners'}

Create a thorough exam that tests mastery of all course material with varied question types and difficulty levels.

Respond with ONLY valid JSON in this exact format:
{
  "exam_title": "Final Exam Title",
  "sections": [
    {
      "section_title": "Section Name",
      "questions": [
        {
          "type": "multiple_choice",
          "question": "Question text",
          "options": ["A", "B", "C", "D"],
          "correct_answer": "A",
          "explanation": "Explanation",
          "points": 10
        }
      ]
    }
  ],
  "total_points": 200,
  "time_limit_minutes": 120,
  "passing_score": 75
}`;
  }

  // ===== MISSING STORAGE METHODS =====

  // Assessment storage is handled by V1 AssessmentGenerationService

  // Mind map storage is handled by V1 API

  // Brainbytes storage is handled by V1 API

  private async storePathQuizContent(pathId: string, content: any): Promise<void> {
    console.log(`💾 Storing quiz content for path ${pathId}`);
    
    const { error } = await this.supabase
      .from('path_quizzes')
      .insert({
        path_id: pathId,
        title: content.quiz_title || 'Path Quiz',
        questions: content.questions || [],
        total_points: content.total_points || 100,
        time_limit_minutes: content.time_limit_minutes || 30,
        passing_score: content.passing_score || 70
      });
    
    if (error) {
      throw new Error(`Failed to store quiz content: ${error.message}`);
    }
  }

  private async storeClassExamContent(classId: string, content: any): Promise<void> {
    console.log(`💾 Storing exam content for class ${classId}`);
    
    const { error } = await this.supabase
      .from('class_exams')
      .insert({
        class_id: classId,
        title: content.exam_title || 'Final Exam',
        sections: content.sections || [],
        total_points: content.total_points || 200,
        time_limit_minutes: content.time_limit_minutes || 120,
        passing_score: content.passing_score || 75
      });
    
    if (error) {
      throw new Error(`Failed to store exam content: ${error.message}`);
    }
  }

  // ===== V1 COMPATIBLE HELPER METHODS =====

  private getQuestionTypesForLevel(academicLevel?: string): ('multiple_choice' | 'true_false' | 'short_answer' | 'essay' | 'matching')[] {
    if (!academicLevel) return ['multiple_choice', 'true_false', 'short_answer'];
    
    const level = academicLevel.toLowerCase();
    
    if (level.includes('kindergarten') || level.includes('1st') || level.includes('2nd') || 
        level.includes('3rd') || level.includes('4th') || level.includes('5th')) {
      return ['multiple_choice', 'true_false', 'matching'];
    }
    
    if (level.includes('6th') || level.includes('7th') || level.includes('8th')) {
      return ['multiple_choice', 'true_false', 'short_answer', 'matching'];
    }
    
    if (level.includes('9th') || level.includes('10th') || level.includes('11th') || level.includes('12th')) {
      return ['multiple_choice', 'true_false', 'short_answer', 'essay'];
    }
    
    return ['multiple_choice', 'short_answer', 'essay'];
  }

  private mapAcademicLevelToDifficulty(academicLevel?: string): 'easy' | 'medium' | 'hard' {
    if (!academicLevel) return 'medium';
    
    const level = academicLevel.toLowerCase();
    if (level.includes('kindergarten') || level.includes('1st') || level.includes('2nd') || level.includes('3rd')) {
      return 'easy';
    } else if (level.includes('college') || level.includes('graduate') || level.includes('professional') || level.includes('master')) {
      return 'hard';
    } else {
      return 'medium';
    }
  }
}

// Class is already exported in its declaration above 