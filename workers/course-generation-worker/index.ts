import { createClient } from '@supabase/supabase-js';
import { CourseGenerationOrchestratorV3 } from '../../src/lib/services/course-generation-orchestrator-v3';
import { knowledgeBaseAnalyzer } from '../../src/lib/services/knowledge-base-analyzer';
import { CourseGenerator } from '../../src/lib/services/course-generator';


const WORKER_ID = process.env.WORKER_ID || `worker-${Date.now()}`;
const POLL_INTERVAL = parseInt(process.env.POLL_INTERVAL || '5000');
const MAX_RETRIES = parseInt(process.env.MAX_RETRIES || '3');

// Initialize Supabase client
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

/**
 * Course Generation Worker
 * Polls the queue and processes course generation jobs
 */
class CourseGenerationWorker {
  private isRunning = false;
  private orchestrator: CourseGenerationOrchestratorV3;

  constructor() {
    this.orchestrator = new CourseGenerationOrchestratorV3(supabase);
  }

  async start() {
    console.log(`🚀 Course Generation Worker ${WORKER_ID} starting...`);
    this.isRunning = true;
    
    // Set up graceful shutdown
    process.on('SIGTERM', () => this.shutdown());
    process.on('SIGINT', () => this.shutdown());
    
    // Start processing loop
    while (this.isRunning) {
      try {
        await this.processNextJob();
      } catch (error) {
        console.error('Worker error:', error);
        await this.sleep(POLL_INTERVAL * 2); // Back off on error
      }
      
      await this.sleep(POLL_INTERVAL);
    }
  }

  private async processNextJob() {
    // Dequeue next job atomically
    const { data: queueItem, error: dequeueError } = await supabase
      .rpc('dequeue_course_job', { worker_id_param: WORKER_ID });
      
    if (dequeueError) {
      console.error('Dequeue error:', dequeueError);
      return;
    }
    
    if (!queueItem || queueItem.length === 0) {
      // No jobs available
      return;
    }
    
    const { id: queueId, job_id: jobId, job: jobPayload } = queueItem[0];
    console.log(`📋 Processing job ${jobId} (queue: ${queueId})`);
    
    try {
      // Use atomic payload returned by RPC to avoid a second read
      const job = jobPayload as any;
      if (!job || job.id !== jobId) {
        throw new Error(`Job payload missing or mismatched for ${jobId}`);
      }
      
      // Check if job is already completed
      if (job.status === 'completed' || job.status === 'failed') {
        console.log(`Job ${jobId} already ${job.status}, marking queue item complete`);
        await supabase.rpc('complete_course_job', { queue_id_param: queueId });
        return;
      }
      
      // Try to load an existing outline for this job
      let outline: any = null;
      {
        const { data: outlines } = await supabase
          .from('course_outlines')
          .select('*')
          .eq('generation_job_id', jobId)
          .limit(1);
        outline = outlines?.[0] || null;
      }

      // If no outline exists, perform pre-orchestration steps end-to-end here
      if (!outline) {
        console.log(`🧭 No outline found for job ${jobId}. Generating outline and LMS entities in worker...`);

        // Construct request from stored job_data
        const request = job.job_data as any;

        // 1) Analyze knowledge base (if baseClassId present)
        let kbAnalysis: any = null;
        if (request?.baseClassId) {
          kbAnalysis = await knowledgeBaseAnalyzer.analyzeKnowledgeBase(request.baseClassId);
        }

        // 2) Determine generation mode
        const generationMode = request?.generationMode || kbAnalysis?.recommendedGenerationMode || 'general';

        // 3) Generate course outline
        const generator = new CourseGenerator();
        const generatedOutline = await (generator as any).generateCourseOutline(request, kbAnalysis, generationMode);

        // 4) Save course outline
        const courseOutlineId = await (generator as any).saveCourseOutline(generatedOutline, request);
        console.log(`💾 Saved course outline ${courseOutlineId} for job ${jobId}`);

        // 5) Create basic LMS entities (paths, lessons)
        await (generator as any).createBasicLMSEntities(courseOutlineId, generatedOutline, request);
        console.log(`🏗️ Created basic LMS entities for job ${jobId}`);

        outline = generatedOutline;
      }
      
      // Start orchestration with the available outline and original request config
      console.log(`🎼 Starting orchestration for job ${jobId}`);
      await this.orchestrator.startOrchestration(
        jobId,
        outline,
        job.generation_config || job.job_data
      );
      
      // Mark queue item as completed
      await supabase.rpc('complete_course_job', { queue_id_param: queueId });
      console.log(`✅ Job ${jobId} completed successfully`);
      
    } catch (error) {
      console.error(`❌ Job ${jobId} failed:`, error);
      
      // Check retry count
      const { data: queueData } = await supabase
        .from('course_generation_queue')
        .select('retry_count, max_retries')
        .eq('id', queueId)
        .single();
        
      if (queueData && queueData.retry_count < (queueData.max_retries || MAX_RETRIES)) {
        // Release job for retry
        console.log(`🔄 Releasing job ${jobId} for retry (attempt ${queueData.retry_count + 1})`);
        await supabase.rpc('release_course_job', { queue_id_param: queueId });
      } else {
        // Max retries exceeded, mark as failed
        console.error(`💀 Job ${jobId} exceeded max retries`);
        await supabase
          .from('course_generation_jobs')
          .update({
            status: 'failed',
            error_message: error instanceof Error ? error.message : 'Unknown error',
            failed_at: new Date().toISOString()
          })
          .eq('id', jobId);
          
        await supabase.rpc('complete_course_job', { queue_id_param: queueId });
      }
    }
  }

  private async shutdown() {
    console.log('🛑 Shutting down worker...');
    this.isRunning = false;
    
    // Clean up any resources
    // Note: Current jobs will continue running
    
    process.exit(0);
  }

  private sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}

// Periodic cleanup of stale jobs
async function cleanupStaleJobs() {
  try {
    const { data: cleanedCount } = await supabase
      .rpc('cleanup_stale_course_jobs');
      
    if (cleanedCount && cleanedCount > 0) {
      console.log(`🧹 Cleaned up ${cleanedCount} stale jobs`);
    }
  } catch (error) {
    console.error('Cleanup error:', error);
  }
}

// Start cleanup interval
setInterval(cleanupStaleJobs, 60000); // Every minute

// Start worker
const worker = new CourseGenerationWorker();
worker.start().catch(error => {
  console.error('Fatal worker error:', error);
  process.exit(1);
});