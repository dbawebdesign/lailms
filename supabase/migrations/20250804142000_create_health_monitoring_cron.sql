-- Create a function to check and update job health status
CREATE OR REPLACE FUNCTION check_job_health()
RETURNS void AS $$
DECLARE
    job_record RECORD;
    task_count INTEGER;
    completed_count INTEGER;
    running_count INTEGER;
    failed_count INTEGER;
    stuck_threshold INTERVAL := '10 minutes';
    stalled_threshold INTERVAL := '5 minutes';
    current_time TIMESTAMPTZ := NOW();
BEGIN
    -- Check all processing jobs
    FOR job_record IN 
        SELECT id, status, created_at, updated_at, current_task, progress
        FROM course_generation_jobs 
        WHERE status = 'processing'
    LOOP
        -- Get task statistics
        SELECT 
            COUNT(*) as total,
            COUNT(*) FILTER (WHERE status = 'completed') as completed,
            COUNT(*) FILTER (WHERE status = 'running') as running,
            COUNT(*) FILTER (WHERE status = 'failed') as failed
        INTO task_count, completed_count, running_count, failed_count
        FROM course_generation_tasks 
        WHERE job_id = job_record.id;

        -- Check for stuck jobs (no updates for 10+ minutes)
        IF current_time - job_record.updated_at > stuck_threshold THEN
            -- Log critical health issue
            INSERT INTO generation_logs (job_id, level, message, details, source, timestamp)
            VALUES (
                job_record.id,
                'critical',
                'Job appears stuck - no updates for over 10 minutes',
                jsonb_build_object(
                    'last_update', job_record.updated_at,
                    'minutes_since_update', EXTRACT(EPOCH FROM (current_time - job_record.updated_at)) / 60,
                    'task_stats', jsonb_build_object(
                        'total', task_count,
                        'completed', completed_count,
                        'running', running_count,
                        'failed', failed_count
                    )
                ),
                'health_monitor',
                current_time
            );

            -- Reset running tasks to pending to allow recovery
            UPDATE course_generation_tasks 
            SET status = 'pending', started_at = NULL, updated_at = current_time
            WHERE job_id = job_record.id 
              AND status = 'running' 
              AND started_at < current_time - stalled_threshold;

        -- Check for stalled jobs (running tasks with no progress for 5+ minutes)
        ELSIF running_count > 0 THEN
            -- Check if any running tasks are stalled
            IF EXISTS (
                SELECT 1 FROM course_generation_tasks 
                WHERE job_id = job_record.id 
                  AND status = 'running' 
                  AND started_at < current_time - stalled_threshold
            ) THEN
                INSERT INTO generation_logs (job_id, level, message, details, source, timestamp)
                VALUES (
                    job_record.id,
                    'warning',
                    'Job has stalled tasks - some tasks running for over 5 minutes',
                    jsonb_build_object(
                        'running_tasks', running_count,
                        'stalled_threshold_minutes', 5
                    ),
                    'health_monitor',
                    current_time
                );
            END IF;

        -- Check if job should be marked as completed
        ELSIF task_count > 0 AND completed_count = task_count THEN
            UPDATE course_generation_jobs 
            SET status = 'completed', updated_at = current_time
            WHERE id = job_record.id;

            INSERT INTO generation_logs (job_id, level, message, details, source, timestamp)
            VALUES (
                job_record.id,
                'info',
                'Job automatically marked as completed',
                jsonb_build_object(
                    'total_tasks', task_count,
                    'completed_tasks', completed_count
                ),
                'health_monitor',
                current_time
            );

        -- Check if job should be marked as failed
        ELSIF failed_count > 0 AND (completed_count + failed_count) = task_count THEN
            UPDATE course_generation_jobs 
            SET status = 'failed', updated_at = current_time,
                error_message = 'Job failed due to task failures'
            WHERE id = job_record.id;

            INSERT INTO generation_logs (job_id, level, message, details, source, timestamp)
            VALUES (
                job_record.id,
                'error',
                'Job automatically marked as failed',
                jsonb_build_object(
                    'total_tasks', task_count,
                    'failed_tasks', failed_count,
                    'completed_tasks', completed_count
                ),
                'health_monitor',
                current_time
            );
        END IF;
    END LOOP;
END;
$$ LANGUAGE plpgsql;

-- Create a cron job to run health checks every 2 minutes
-- This requires the pg_cron extension to be enabled
SELECT cron.schedule(
    'course-generation-health-check',
    '*/2 * * * *', -- Every 2 minutes
    'SELECT check_job_health();'
);

-- Grant necessary permissions
GRANT EXECUTE ON FUNCTION check_job_health() TO service_role;

-- Create indexes to optimize the health check queries
CREATE INDEX IF NOT EXISTS idx_course_generation_jobs_processing 
ON course_generation_jobs(status, updated_at) 
WHERE status = 'processing';

CREATE INDEX IF NOT EXISTS idx_course_generation_tasks_job_status 
ON course_generation_tasks(job_id, status);

CREATE INDEX IF NOT EXISTS idx_course_generation_tasks_running_started 
ON course_generation_tasks(job_id, status, started_at) 
WHERE status = 'running';