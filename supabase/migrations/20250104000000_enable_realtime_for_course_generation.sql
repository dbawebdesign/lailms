-- Enable Realtime for course generation tables
-- This allows Supabase Realtime to broadcast changes to these tables

-- Enable Realtime for course_generation_jobs
ALTER PUBLICATION supabase_realtime ADD TABLE course_generation_jobs;

-- Enable Realtime for course_generation_tasks  
ALTER PUBLICATION supabase_realtime ADD TABLE course_generation_tasks;

-- Enable Realtime for generation_logs (for debugging/monitoring)
ALTER PUBLICATION supabase_realtime ADD TABLE generation_logs;

-- Ensure RLS is properly configured for Realtime
-- Users can only see their own jobs
CREATE POLICY IF NOT EXISTS "Users can view own course generation jobs via realtime" 
ON course_generation_jobs FOR SELECT 
USING (auth.uid() = user_id);

-- Users can only see tasks for their own jobs
CREATE POLICY IF NOT EXISTS "Users can view own course generation tasks via realtime" 
ON course_generation_tasks FOR SELECT 
USING (
  EXISTS (
    SELECT 1 FROM course_generation_jobs 
    WHERE course_generation_jobs.id = course_generation_tasks.job_id 
    AND course_generation_jobs.user_id = auth.uid()
  )
);

-- Users can only see logs for their own jobs
CREATE POLICY IF NOT EXISTS "Users can view own generation logs via realtime" 
ON generation_logs FOR SELECT 
USING (
  EXISTS (
    SELECT 1 FROM course_generation_jobs 
    WHERE course_generation_jobs.id = generation_logs.job_id 
    AND course_generation_jobs.user_id = auth.uid()
  )
);