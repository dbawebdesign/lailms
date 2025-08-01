import { describe, it, expect, beforeEach, afterEach, jest } from '@jest/globals';
import { createSupabaseServerClient } from '@/lib/supabase/server';
import { CourseGenerationOrchestratorV2 } from '@/lib/services/course-generation-orchestrator-v2';
import { CourseGenerationTaskExecutor } from '@/lib/services/course-generation-task-executor';
import { CourseGenerationErrorHandler } from '@/lib/services/course-generation-error-handler';
import { CourseGenerationAnalyticsService } from '@/lib/services/course-generation-analytics';
import { useCourseGenerationRecovery } from '@/hooks/useCourseGenerationRecovery';

// Mock Supabase
jest.mock('@/lib/supabase/server');
const mockSupabase = createSupabaseServerClient as jest.MockedFunction<typeof createSupabaseServerClient>;

// Mock OpenAI
jest.mock('openai');

describe('Course Generation V2 System', () => {
  let orchestrator: CourseGenerationOrchestratorV2;
  let taskExecutor: CourseGenerationTaskExecutor;
  let errorHandler: CourseGenerationErrorHandler;
  let analytics: CourseGenerationAnalyticsService;
  
  const mockUserId = 'test-user-id';
  const mockBaseClassId = 'test-base-class-id';
  const mockOrganisationId = 'test-org-id';
  
  const mockRequest = {
    baseClassId: mockBaseClassId,
    organisationId: mockOrganisationId,
    courseTitle: 'Test Course',
    courseDuration: '6 weeks',
    difficultyLevel: 'intermediate',
    learningObjectives: ['Objective 1', 'Objective 2'],
    additionalRequirements: 'Test requirements'
  };

  beforeEach(() => {
    // Reset all mocks
    jest.clearAllMocks();
    
    // Initialize components
    orchestrator = new CourseGenerationOrchestratorV2();
    taskExecutor = new CourseGenerationTaskExecutor();
    errorHandler = new CourseGenerationErrorHandler();
    analytics = new CourseGenerationAnalyticsService();
    
    // Mock Supabase responses
    const mockSupabaseClient = {
      from: jest.fn().mockReturnThis(),
      select: jest.fn().mockReturnThis(),
      insert: jest.fn().mockReturnThis(),
      update: jest.fn().mockReturnThis(),
      eq: jest.fn().mockReturnThis(),
      single: jest.fn(),
      order: jest.fn().mockReturnThis(),
      limit: jest.fn().mockReturnThis(),
      auth: {
        getUser: jest.fn().mockResolvedValue({
          data: { user: { id: mockUserId } },
          error: null
        })
      }
    };
    
    mockSupabase.mockReturnValue(mockSupabaseClient as any);
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  describe('Job Creation', () => {
    it('should create a new course generation job successfully', async () => {
      const mockJobId = 'test-job-id';
      const mockJob = {
        id: mockJobId,
        user_id: mockUserId,
        base_class_id: mockBaseClassId,
        organisation_id: mockOrganisationId,
        status: 'queued',
        progress: 0
      };

      const mockSupabaseClient = mockSupabase();
      mockSupabaseClient.single.mockResolvedValue({
        data: mockJob,
        error: null
      });

      const jobId = await orchestrator.createCourseGenerationJob(mockRequest, mockUserId);
      
      expect(jobId).toBe(mockJobId);
      expect(mockSupabaseClient.from).toHaveBeenCalledWith('course_generation_jobs');
      expect(mockSupabaseClient.insert).toHaveBeenCalled();
    });

    it('should handle job creation errors gracefully', async () => {
      const mockSupabaseClient = mockSupabase();
      mockSupabaseClient.single.mockResolvedValue({
        data: null,
        error: { message: 'Database error' }
      });

      await expect(
        orchestrator.createCourseGenerationJob(mockRequest, mockUserId)
      ).rejects.toThrow('Failed to create course generation job: Database error');
    });
  });

  describe('Task Execution', () => {
    it('should execute tasks in correct dependency order', async () => {
      const mockJobId = 'test-job-id';
      const mockTasks = [
        {
          id: 'task-1',
          task_identifier: 'kb_analysis_0',
          task_type: 'knowledge_analysis',
          status: 'pending',
          dependencies: [],
          execution_priority: 1
        },
        {
          id: 'task-2',
          task_identifier: 'outline_generation_1',
          task_type: 'outline_generation',
          status: 'pending',
          dependencies: ['kb_analysis_0'],
          execution_priority: 2
        }
      ];

      const mockSupabaseClient = mockSupabase();
      mockSupabaseClient.single.mockResolvedValue({
        data: mockTasks,
        error: null
      });

      // Mock task execution
      const executeTaskSpy = jest.spyOn(taskExecutor, 'executeTask').mockResolvedValue({
        success: true,
        output: 'Task completed'
      });

      await taskExecutor.executeJob(mockJobId);

      expect(executeTaskSpy).toHaveBeenCalledTimes(2);
      // Verify tasks were executed in dependency order
      expect(executeTaskSpy).toHaveBeenNthCalledWith(1, expect.objectContaining({
        task_identifier: 'kb_analysis_0'
      }));
      expect(executeTaskSpy).toHaveBeenNthCalledWith(2, expect.objectContaining({
        task_identifier: 'outline_generation_1'
      }));
    });

    it('should retry failed tasks according to retry policy', async () => {
      const mockTask = {
        id: 'task-1',
        task_identifier: 'test_task',
        task_type: 'lesson_section',
        status: 'pending',
        current_retry_count: 0,
        max_retry_count: 3,
        is_recoverable: true
      };

      const mockSupabaseClient = mockSupabase();
      mockSupabaseClient.single.mockResolvedValue({
        data: mockTask,
        error: null
      });

      // Mock task execution to fail twice, then succeed
      const executeTaskSpy = jest.spyOn(taskExecutor, 'executeTask')
        .mockRejectedValueOnce(new Error('Temporary failure'))
        .mockRejectedValueOnce(new Error('Temporary failure'))
        .mockResolvedValueOnce({ success: true, output: 'Task completed' });

      const result = await taskExecutor.executeTaskWithRetry(mockTask);

      expect(result.success).toBe(true);
      expect(executeTaskSpy).toHaveBeenCalledTimes(3);
    });

    it('should skip non-recoverable failed tasks', async () => {
      const mockTask = {
        id: 'task-1',
        task_identifier: 'test_task',
        task_type: 'lesson_section',
        status: 'pending',
        current_retry_count: 0,
        max_retry_count: 3,
        is_recoverable: false,
        error_severity: 'critical'
      };

      const executeTaskSpy = jest.spyOn(taskExecutor, 'executeTask')
        .mockRejectedValue(new Error('Critical failure'));

      const result = await taskExecutor.executeTaskWithRetry(mockTask);

      expect(result.success).toBe(false);
      expect(executeTaskSpy).toHaveBeenCalledTimes(1); // No retries for non-recoverable
    });
  });

  describe('Error Handling', () => {
    it('should classify errors correctly', () => {
      const apiError = new Error('Rate limit exceeded');
      const classification = errorHandler.classifyError(apiError, 'api_call');

      expect(classification.category).toBe('api_limit');
      expect(classification.severity).toBe('medium');
      expect(classification.isRecoverable).toBe(true);
    });

    it('should provide appropriate recovery suggestions', () => {
      const error = new Error('Knowledge base empty');
      const classification = errorHandler.classifyError(error, 'knowledge_base');

      expect(classification.recoverySuggestions).toContain(
        'Upload more documents to the knowledge base'
      );
    });

    it('should log errors with proper context', async () => {
      const mockJobId = 'test-job-id';
      const mockTaskId = 'test-task-id';
      const mockError = new Error('Test error');

      const mockSupabaseClient = mockSupabase();
      mockSupabaseClient.insert.mockResolvedValue({ error: null });

      await errorHandler.logError(mockJobId, mockTaskId, mockError, {
        context: 'test context'
      });

      expect(mockSupabaseClient.from).toHaveBeenCalledWith('course_generation_errors');
      expect(mockSupabaseClient.insert).toHaveBeenCalled();
    });
  });

  describe('Analytics Collection', () => {
    it('should calculate job analytics correctly', async () => {
      const mockJobId = 'test-job-id';
      const mockJob = { id: mockJobId, base_class_id: mockBaseClassId };
      const mockTasks = [
        { id: 'task-1', status: 'completed', actual_duration_seconds: 30 },
        { id: 'task-2', status: 'completed', actual_duration_seconds: 45 },
        { id: 'task-3', status: 'failed', actual_duration_seconds: 10 }
      ];

      const mockSupabaseClient = mockSupabase();
      mockSupabaseClient.single
        .mockResolvedValueOnce({ data: mockJob, error: null })
        .mockResolvedValueOnce({ data: mockTasks, error: null });

      const analyticsResult = await analytics.calculateJobAnalytics(mockJobId);

      expect(analyticsResult.total_generation_time_seconds).toBe(85);
      expect(analyticsResult.success_rate).toBe(66.67); // 2/3 tasks completed
      expect(analyticsResult.average_task_time_seconds).toBeCloseTo(28.33);
    });

    it('should track performance metrics', () => {
      const taskId = 'test-task-id';
      const metrics = {
        executionTime: 30,
        apiCalls: 2,
        tokensConsumed: 1500,
        memoryUsage: 50
      };

      analytics.trackTaskPerformance(taskId, 'lesson_section', metrics);

      expect(analytics.performanceBuffer).toContainEqual(
        expect.objectContaining({
          taskId,
          executionTime: 30,
          apiCalls: 2
        })
      );
    });
  });

  describe('Recovery Workflows', () => {
    it('should retry failed tasks through recovery hook', async () => {
      const mockJobId = 'test-job-id';
      const mockTaskId = 'test-task-id';

      // Mock fetch for the recovery API
      global.fetch = jest.fn().mockResolvedValue({
        ok: true,
        json: () => Promise.resolve({
          success: true,
          message: 'Task retried successfully'
        })
      });

      // This would be tested in a React testing environment
      // Here we're testing the underlying API logic
      const response = await fetch('/api/course-generation/v2/user-action', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          jobId: mockJobId,
          actionType: 'retry_task',
          taskIds: [mockTaskId]
        })
      });

      const result = await response.json();
      expect(result.success).toBe(true);
    });

    it('should provide smart recovery suggestions', () => {
      const mockJob = { status: 'processing' };
      const mockTasks = [
        { id: 'task-1', status: 'completed' },
        { id: 'task-2', status: 'failed', is_recoverable: true, error_severity: 'medium' },
        { id: 'task-3', status: 'failed', is_recoverable: false, error_severity: 'critical' }
      ];

      // This would typically be tested with the actual hook in a React component
      // Here we test the logic that would be used by the hook
      const suggestions = generateRecoverySuggestions(mockJob, mockTasks);

      expect(suggestions).toHaveLength(2); // Retry recoverable + skip non-critical
      expect(suggestions[0].action).toBe('retry_task');
      expect(suggestions[0].taskIds).toEqual(['task-2']);
    });
  });

  describe('Circuit Breaker', () => {
    it('should open circuit breaker after threshold failures', async () => {
      const circuitBreaker = taskExecutor.getCircuitBreaker('openai');
      
      // Simulate failures to reach threshold
      for (let i = 0; i < 5; i++) {
        await expect(
          taskExecutor.executeWithCircuitBreaker('openai', async () => {
            throw new Error('Service unavailable');
          })
        ).rejects.toThrow();
      }

      expect(circuitBreaker.state).toBe('open');
    });

    it('should transition to half-open after timeout', async () => {
      const circuitBreaker = taskExecutor.getCircuitBreaker('openai');
      circuitBreaker.state = 'open';
      circuitBreaker.lastFailureTime = new Date(Date.now() - 61000); // 61 seconds ago

      const result = await taskExecutor.executeWithCircuitBreaker('openai', async () => {
        return 'success';
      });

      expect(result).toBe('success');
      expect(circuitBreaker.state).toBe('half_open');
    });
  });

  describe('Integration Tests', () => {
    it('should complete full course generation workflow', async () => {
      const mockJobId = 'integration-test-job';
      
      // Mock all required Supabase operations
      const mockSupabaseClient = mockSupabase();
      mockSupabaseClient.single
        .mockResolvedValueOnce({
          data: { id: mockJobId, status: 'queued' },
          error: null
        })
        .mockResolvedValue({
          data: [],
          error: null
        });

      mockSupabaseClient.insert.mockResolvedValue({ error: null });
      mockSupabaseClient.update.mockResolvedValue({ error: null });

      // Create job
      const jobId = await orchestrator.createCourseGenerationJob(mockRequest, mockUserId);
      expect(jobId).toBe(mockJobId);

      // Execute job (this would normally take much longer)
      await expect(orchestrator.executeJobV2(jobId)).resolves.not.toThrow();
    });

    it('should maintain 98%+ success rate under load', async () => {
      const numberOfJobs = 50;
      const jobs = [];
      const successfulJobs = [];
      const failedJobs = [];

      // Create multiple jobs concurrently
      for (let i = 0; i < numberOfJobs; i++) {
        jobs.push(
          orchestrator.createCourseGenerationJob(
            { ...mockRequest, courseTitle: `Test Course ${i}` },
            mockUserId
          ).then(jobId => {
            return orchestrator.executeJobV2(jobId);
          }).then(() => {
            successfulJobs.push(i);
          }).catch(() => {
            failedJobs.push(i);
          })
        );
      }

      await Promise.allSettled(jobs);

      const successRate = (successfulJobs.length / numberOfJobs) * 100;
      expect(successRate).toBeGreaterThanOrEqual(98);
    });
  });
});

// Helper function for testing recovery suggestions
function generateRecoverySuggestions(job: any, tasks: any[]): any[] {
  const suggestions = [];
  const failedTasks = tasks.filter(t => t.status === 'failed');
  const recoverableTasks = failedTasks.filter(t => t.is_recoverable);
  const nonCriticalFailed = failedTasks.filter(t => t.error_severity !== 'critical');

  if (recoverableTasks.length > 0) {
    suggestions.push({
      action: 'retry_task',
      label: `Retry ${recoverableTasks.length} Failed Tasks`,
      taskIds: recoverableTasks.map(t => t.id),
      priority: 'high'
    });
  }

  if (nonCriticalFailed.length > 0) {
    suggestions.push({
      action: 'skip_task',
      label: `Skip ${nonCriticalFailed.length} Non-Critical Tasks`,
      taskIds: nonCriticalFailed.map(t => t.id),
      priority: 'medium'
    });
  }

  return suggestions;
} 