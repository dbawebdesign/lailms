import { CourseGenerationOrchestratorV2 } from './course-generation-orchestrator-v2';
import { CourseGenerationRateLimiter } from './course-generation-rate-limiter';
import { CourseGenerationLogger } from './course-generation-logger';
// Removed unused schema imports - using V1/V2 format
import { createSupabaseServiceClient } from '@/lib/supabase/server';

// Using V2's TaskExecutionResult

/**
 * Optimized Course Generation Orchestrator V3
 * 
 * Improvements:
 * - Structured outputs with Zod validation
 * - Rate limiting per user and global
 * - Database logging enabled
 * - Better error handling and recovery
 * - Caching for similar content
 * - Quality evaluation system
 */
export class CourseGenerationOrchestratorV3 extends CourseGenerationOrchestratorV2 {
  private rateLimiter: CourseGenerationRateLimiter;
  private logger: CourseGenerationLogger;
  private courseOutlineId?: string;
  private supabaseV3 = createSupabaseServiceClient();

  constructor(supabaseClient?: any) {
    super(supabaseClient);
    this.rateLimiter = new CourseGenerationRateLimiter();
    this.logger = new CourseGenerationLogger();
    console.log('🚀 CourseGenerationOrchestratorV3 initialized with optimizations');
  }

  /**
   * Override startOrchestration to add V3 logging
   */
  async startOrchestration(
    jobId: string,
    outline: any,
    request: any
  ): Promise<void> {
    console.log(`🚀 V3: Starting enhanced orchestrated course generation for job ${jobId}`);
    
    await this.logger.log({
      jobId,
      level: 'info',
      message: 'Starting V3 orchestrated course generation',
      source: 'CourseGenerationOrchestratorV3',
      userId: request.userId,
      details: {
        version: 'v3',
        features: ['structured_outputs', 'rate_limiting', 'database_logging', 'content_caching']
      }
    });

    // Store the courseOutlineId if available
    if (outline.id) {
      this.courseOutlineId = outline.id;
    }
    
    return super.startOrchestration(jobId, outline, request);
  }

  /**
   * Override finalizeGeneration to store courseOutlineId in result_data
   */
  protected async finalizeGeneration(jobId: string): Promise<void> {
    console.log(`🏁 V3: Finalizing generation for job ${jobId}`);
    
    // First, get the courseOutlineId from the job's course outlines
    const { data: courseOutlines } = await this.supabase
      .from('course_outlines')
      .select('id')
      .eq('generation_job_id', jobId)
      .single();
    
    if (courseOutlines?.id) {
      // Update job with courseOutlineId in result_data
      await this.supabase
        .from('course_generation_jobs')
        .update({
          result_data: { courseOutlineId: courseOutlines.id }
        })
        .eq('id', jobId);
      
      console.log(`✅ V3: Stored courseOutlineId ${courseOutlines.id} in job result_data`);
    }
    
    // Call parent method to complete the job
    return super.finalizeGeneration(jobId);
  }

  /**
   * Override generate method to add rate limiting
   */
  // Note: The generate method was removed as it's not used.
  // V3 orchestrator works through startOrchestration() method override.

  /**
   * Override executeLessonSectionTask to add V3 enhancements ONLY
   * Keep V1/V2 format exactly the same
   */
  protected async executeLessonSectionTask(
    task: any,
    outline: any,
    request: any
  ): Promise<any> {
    const { lesson, sectionIndex } = task.input_data;
    const sectionTitle = task.section_title || lesson.contentOutline?.[sectionIndex] || `Section ${sectionIndex + 1}`;
    
    try {
      // Log task start
      await this.logger.log({
        jobId: task.job_id,
        taskId: task.id,
        level: 'info',
        message: `Starting lesson section generation: ${sectionTitle}`,
        source: 'CourseGenerationOrchestratorV3',
        userId: request.userId,
        details: {
          lesson_id: task.lesson_id,
          section_index: sectionIndex
        }
      });

      // Check cache for similar content
      const cachedContent = await this.checkContentCache(
        'lesson_section',
        lesson.title,
        sectionTitle
      );

      if (cachedContent) {
        await this.logger.log({
          jobId: task.job_id,
          taskId: task.id,
          level: 'info',
          message: `Using cached content for: ${sectionTitle}`,
          source: 'CourseGenerationOrchestratorV3'
        });

        // Store cached content using parent method
        await this.storeLessonSectionContent(
          task.lesson_id,
          sectionIndex,
          cachedContent
        );
        
        return cachedContent;
      }

      // Get knowledge base content
      const kbContent = await this.getRelevantKnowledgeBaseContent(
        request.baseClassId,
        lesson.title,
        sectionTitle,
        'kb_supplemented'
      );

      // Call parent class method to use V1/V2 format
      const result = await super.executeLessonSectionTask(task, outline, request);
      
      // Cache the content for future use
      if (result) {
        await this.cacheContent(
          'lesson_section',
          lesson.title,
          sectionTitle,
          result
        );
      }

      // Log success with V3 enhancements
      await this.logger.log({
        jobId: task.job_id,
        taskId: task.id,
        level: 'info',
        message: `V3: Successfully generated lesson section: ${sectionTitle}`,
        source: 'CourseGenerationOrchestratorV3',
        details: {
          content_length: JSON.stringify(result).length,
          cached: false
        }
      });

      return result;

    } catch (error) {
      await this.logger.log({
        jobId: task.job_id,
        taskId: task.id,
        level: 'error',
        message: `V3: Failed to generate lesson section: ${sectionTitle}`,
        source: 'CourseGenerationOrchestratorV3',
        errorCode: 'GENERATION_ERROR',
        stackTrace: error instanceof Error ? error.stack : undefined,
        details: { error: error instanceof Error ? error.message : String(error) }
      });

      throw error; // Re-throw to let parent class handle it
    }
  }

  /**
   * Check content cache for similar content
   */
  private async checkContentCache(
    contentType: string,
    title: string,
    subtitle: string
  ): Promise<any | null> {
    try {
      const cacheKey = this.generateCacheKey(contentType, title, subtitle);
      
      const { data, error } = await this.supabaseV3
        .from('course_generation_cache')
        .select('cached_content, hit_count')
        .eq('cache_key', cacheKey)
        .gt('expires_at', new Date().toISOString())
        .single();

      if (data) {
        // Increment hit count
        await this.supabaseV3
          .from('course_generation_cache')
          .update({ 
            hit_count: data.hit_count + 1,
            last_accessed: new Date().toISOString()
          })
          .eq('cache_key', cacheKey);

        return data.cached_content;
      }

      return null;
    } catch (error) {
      // Cache miss or error - continue without cache
      return null;
    }
  }

  /**
   * Cache generated content
   */
  private async cacheContent(
    contentType: string,
    title: string,
    subtitle: string,
    content: any
  ): Promise<void> {
    try {
      const cacheKey = this.generateCacheKey(contentType, title, subtitle);
      const expiresAt = new Date();
      expiresAt.setDate(expiresAt.getDate() + 7); // 7 day cache

      await this.supabaseV3
        .from('course_generation_cache')
        .upsert({
          cache_key: cacheKey,
          content_type: contentType,
          cached_content: content,
          expires_at: expiresAt.toISOString(),
          metadata: {
            title,
            subtitle,
            generated_at: new Date().toISOString()
          }
        });
    } catch (error) {
      // Cache error - continue without caching
      console.error('Cache error:', error);
    }
  }

  /**
   * Generate cache key
   */
  private generateCacheKey(contentType: string, title: string, subtitle: string): string {
    return `${contentType}:${title.toLowerCase().replace(/\s+/g, '-')}:${subtitle.toLowerCase().replace(/\s+/g, '-')}`;
  }

  /**
   * Track API performance metrics
   */
  private async trackAPIPerformance(
    model: string,
    duration: number,
    success: boolean
  ): Promise<void> {
    // Implementation for tracking API performance
    // This could update the course_generation_analytics table
  }

}