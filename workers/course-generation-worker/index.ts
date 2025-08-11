import { createClient } from '@supabase/supabase-js';
import { CourseGenerationOrchestratorV3 } from '../../src/lib/services/course-generation-orchestrator-v3';


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
    
    const { id: queueId, job_id: jobId } = queueItem[0];
    console.log(`📋 Processing job ${jobId} (queue: ${queueId})`);
    
    try {
      // Get job details
      const { data: job, error: jobError } = await supabase
        .from('course_generation_jobs')
        .select(`
          *,
          course_outlines!generation_job_id (*)
        `)
        .eq('id', jobId)
        .single();
        
      if (jobError || !job) {
        throw new Error(`Job not found: ${jobId}`);
      }
      
      // Check if job is already completed
      if (job.status === 'completed' || job.status === 'failed') {
        console.log(`Job ${jobId} already ${job.status}, marking queue item complete`);
        await supabase.rpc('complete_course_job', { queue_id_param: queueId });
        return;
      }
      
      // Get course outline
      const outline = job.course_outlines[0];
      if (!outline) {
        throw new Error(`No outline found for job ${jobId}`);
      }
      
      // Start orchestration
      console.log(`🎼 Starting orchestration for job ${jobId}`);
      await this.orchestrator.startOrchestration(
        jobId,
        outline,
        job.generation_config
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