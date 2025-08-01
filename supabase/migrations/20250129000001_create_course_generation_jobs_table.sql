-- Create course_generation_jobs table
-- This is the main table for tracking course generation requests

CREATE TABLE IF NOT EXISTS course_generation_jobs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  base_class_id UUID NOT NULL REFERENCES base_classes(id) ON DELETE CASCADE,
  organisation_id UUID NOT NULL REFERENCES organisations(id) ON DELETE CASCADE,
  
  -- Job metadata
  status TEXT NOT NULL DEFAULT 'queued' CHECK (status IN ('queued', 'processing', 'completed', 'failed', 'cancelled', 'paused')),
  progress INTEGER DEFAULT 0 CHECK (progress >= 0 AND progress <= 100),
  
  -- Request data
  request_data JSONB NOT NULL, -- Full CourseGenerationRequest
  result_data JSONB DEFAULT '{}', -- Results, progress messages, etc.
  
  -- Course outline reference (when created)
  course_outline_id UUID,
  
  -- Timing
  created_at TIMESTAMPTZ DEFAULT NOW(),
  started_at TIMESTAMPTZ,
  completed_at TIMESTAMPTZ,
  
  -- Error tracking
  error TEXT,
  error_details JSONB,
  
  -- Versioning for compatibility
  generator_version TEXT DEFAULT 'v1',
  
  -- Performance tracking
  total_api_calls INTEGER DEFAULT 0,
  total_tokens_used INTEGER DEFAULT 0,
  estimated_cost_usd DECIMAL(10,4) DEFAULT 0
);

-- Create indexes
CREATE INDEX idx_course_generation_jobs_user_id ON course_generation_jobs(user_id);
CREATE INDEX idx_course_generation_jobs_base_class_id ON course_generation_jobs(base_class_id);
CREATE INDEX idx_course_generation_jobs_status ON course_generation_jobs(status);
CREATE INDEX idx_course_generation_jobs_created_at ON course_generation_jobs(created_at DESC);

-- Enable RLS
ALTER TABLE course_generation_jobs ENABLE ROW LEVEL SECURITY;

-- RLS Policies
CREATE POLICY "Users can view their own jobs" ON course_generation_jobs
  FOR SELECT USING (user_id = auth.uid());

CREATE POLICY "Users can create their own jobs" ON course_generation_jobs
  FOR INSERT WITH CHECK (user_id = auth.uid());

CREATE POLICY "System can manage all jobs" ON course_generation_jobs
  FOR ALL USING (auth.role() = 'service_role');

-- Add trigger for updated_at
ALTER TABLE course_generation_jobs ADD COLUMN updated_at TIMESTAMPTZ DEFAULT NOW();

CREATE TRIGGER trigger_update_course_generation_jobs_updated_at
  BEFORE UPDATE ON course_generation_jobs
  FOR EACH ROW
  EXECUTE FUNCTION update_course_generation_tasks_updated_at(); 