-- Function to atomically dequeue a course generation job
CREATE OR REPLACE FUNCTION dequeue_course_job(worker_id_param TEXT)
RETURNS TABLE (
  id UUID,
  job_id UUID,
  priority INTEGER,
  scheduled_for TIMESTAMPTZ
) 
LANGUAGE plpgsql
AS $$
DECLARE
  dequeued_record RECORD;
BEGIN
  -- Lock and get the next available job
  SELECT cq.* INTO dequeued_record
  FROM course_generation_queue cq
  WHERE cq.status = 'pending'
    AND (cq.scheduled_for IS NULL OR cq.scheduled_for <= NOW())
    AND cq.locked_at IS NULL
  ORDER BY cq.priority DESC, cq.created_at ASC
  LIMIT 1
  FOR UPDATE SKIP LOCKED;
  
  -- If we found a job, mark it as locked
  IF dequeued_record.id IS NOT NULL THEN
    UPDATE course_generation_queue
    SET 
      status = 'processing',
      worker_id = worker_id_param,
      locked_at = NOW(),
      updated_at = NOW()
    WHERE course_generation_queue.id = dequeued_record.id;
    
    -- Return the job
    RETURN QUERY 
    SELECT 
      dequeued_record.id,
      dequeued_record.job_id,
      dequeued_record.priority,
      dequeued_record.scheduled_for;
  END IF;
  
  -- Return empty if no jobs available
  RETURN;
END;
$$;

-- Function to release a locked job (for worker failures)
CREATE OR REPLACE FUNCTION release_course_job(queue_id_param UUID)
RETURNS VOID
LANGUAGE plpgsql
AS $$
BEGIN
  UPDATE course_generation_queue
  SET 
    status = 'pending',
    worker_id = NULL,
    locked_at = NULL,
    retry_count = retry_count + 1,
    updated_at = NOW()
  WHERE id = queue_id_param
    AND status = 'processing';
END;
$$;

-- Function to mark job as completed
CREATE OR REPLACE FUNCTION complete_course_job(queue_id_param UUID)
RETURNS VOID
LANGUAGE plpgsql
AS $$
BEGIN
  UPDATE course_generation_queue
  SET 
    status = 'completed',
    completed_at = NOW(),
    updated_at = NOW()
  WHERE id = queue_id_param;
END;
$$;

-- Clean up stale locks (jobs locked for more than 10 minutes)
CREATE OR REPLACE FUNCTION cleanup_stale_course_jobs()
RETURNS INTEGER
LANGUAGE plpgsql
AS $$
DECLARE
  cleaned_count INTEGER;
BEGIN
  WITH stale_jobs AS (
    UPDATE course_generation_queue
    SET 
      status = 'pending',
      worker_id = NULL,
      locked_at = NULL,
      retry_count = retry_count + 1,
      updated_at = NOW()
    WHERE status = 'processing'
      AND locked_at < NOW() - INTERVAL '10 minutes'
    RETURNING 1
  )
  SELECT COUNT(*) INTO cleaned_count FROM stale_jobs;
  
  RETURN cleaned_count;
END;
$$;

-- Add index for efficient queue queries
CREATE INDEX IF NOT EXISTS idx_course_generation_queue_status_scheduled 
ON course_generation_queue(status, scheduled_for) 
WHERE status = 'pending';

-- Add index for finding stale jobs
CREATE INDEX IF NOT EXISTS idx_course_generation_queue_locked_at 
ON course_generation_queue(locked_at) 
WHERE status = 'processing';