-- Enhanced Course Generation Tracking and Recovery System
-- This migration adds comprehensive task-level tracking, error management, and recovery capabilities

-- Create enums for better type safety
CREATE TYPE course_generation_task_type AS ENUM (
  'lesson_section', 
  'lesson_assessment', 
  'lesson_mind_map', 
  'lesson_brainbytes', 
  'path_quiz', 
  'class_exam',
  'knowledge_analysis',
  'outline_generation',
  'content_validation'
);

CREATE TYPE course_generation_task_status AS ENUM (
  'pending', 
  'queued',
  'running', 
  'completed', 
  'failed', 
  'skipped',
  'retrying',
  'cancelled'
);

CREATE TYPE course_generation_error_severity AS ENUM (
  'low',      -- Minor issues, generation can continue
  'medium',   -- Significant issues, but recoverable  
  'high',     -- Major issues, requires intervention
  'critical'  -- System-level failures, stops generation
);

-- Enhanced course_generation_jobs table with more detailed tracking
ALTER TABLE course_generation_jobs 
ADD COLUMN IF NOT EXISTS generation_config JSONB DEFAULT '{}',
ADD COLUMN IF NOT EXISTS performance_metrics JSONB DEFAULT '{}',
ADD COLUMN IF NOT EXISTS retry_configuration JSONB DEFAULT '{}',
ADD COLUMN IF NOT EXISTS user_actions JSONB DEFAULT '[]',
ADD COLUMN IF NOT EXISTS estimated_completion_time TIMESTAMPTZ,
ADD COLUMN IF NOT EXISTS actual_completion_time TIMESTAMPTZ,
ADD COLUMN IF NOT EXISTS total_tasks INTEGER DEFAULT 0,
ADD COLUMN IF NOT EXISTS completed_tasks INTEGER DEFAULT 0,
ADD COLUMN IF NOT EXISTS failed_tasks INTEGER DEFAULT 0,
ADD COLUMN IF NOT EXISTS skipped_tasks INTEGER DEFAULT 0;

-- Create detailed task tracking table
CREATE TABLE IF NOT EXISTS course_generation_tasks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  job_id UUID NOT NULL REFERENCES course_generation_jobs(id) ON DELETE CASCADE,
  task_type course_generation_task_type NOT NULL,
  task_identifier TEXT NOT NULL, -- e.g., "section-lesson-123-1", "assessment-lesson-456"
  status course_generation_task_status DEFAULT 'pending',
  
  -- Task context and metadata
  lesson_id UUID,
  path_id UUID,
  base_class_id UUID,
  section_index INTEGER,
  section_title TEXT,
  
  -- Dependencies and execution order
  dependencies TEXT[] DEFAULT '{}', -- Array of task_identifier strings
  execution_priority INTEGER DEFAULT 0,
  max_retry_count INTEGER DEFAULT 3,
  current_retry_count INTEGER DEFAULT 0,
  
  -- Timing and performance
  estimated_duration_seconds INTEGER,
  actual_duration_seconds INTEGER,
  queued_at TIMESTAMPTZ,
  started_at TIMESTAMPTZ,
  completed_at TIMESTAMPTZ,
  last_retry_at TIMESTAMPTZ,
  
  -- Results and data
  input_data JSONB DEFAULT '{}',
  output_data JSONB DEFAULT '{}',
  result_metadata JSONB DEFAULT '{}',
  
  -- Error handling
  error_message TEXT,
  error_details JSONB DEFAULT '{}',
  error_severity course_generation_error_severity,
  error_category TEXT, -- e.g., "api_timeout", "validation_failed", "resource_exhausted"
  is_recoverable BOOLEAN DEFAULT true,
  recovery_suggestions TEXT[],
  
  -- Audit trail
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  
  -- Unique constraint to prevent duplicate tasks per job
  UNIQUE(job_id, task_identifier)
);

-- Create comprehensive error logging table
CREATE TABLE IF NOT EXISTS course_generation_errors (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  job_id UUID NOT NULL REFERENCES course_generation_jobs(id) ON DELETE CASCADE,
  task_id UUID REFERENCES course_generation_tasks(id) ON DELETE SET NULL,
  
  -- Error classification
  error_type TEXT NOT NULL, -- e.g., "openai_timeout", "json_parse_failed", "db_connection_lost"
  error_severity course_generation_error_severity NOT NULL,
  error_category TEXT NOT NULL, -- e.g., "external_api", "validation", "system", "user_input"
  
  -- Error details
  error_message TEXT NOT NULL,
  error_stack TEXT,
  error_context JSONB DEFAULT '{}',
  
  -- System state when error occurred
  system_metrics JSONB DEFAULT '{}', -- memory usage, API rates, etc.
  request_metadata JSONB DEFAULT '{}',
  
  -- Recovery information
  is_retryable BOOLEAN DEFAULT false,
  retry_strategy TEXT, -- e.g., "exponential_backoff", "immediate", "manual_only"
  suggested_actions TEXT[],
  
  -- Resolution tracking
  resolved_at TIMESTAMPTZ,
  resolution_method TEXT, -- e.g., "auto_retry", "manual_fix", "user_action", "skip"
  resolution_notes TEXT,
  
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create performance analytics table
CREATE TABLE IF NOT EXISTS course_generation_analytics (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  job_id UUID NOT NULL REFERENCES course_generation_jobs(id) ON DELETE CASCADE,
  
  -- Performance metrics
  total_generation_time_seconds INTEGER,
  average_task_time_seconds DECIMAL(10,2),
  api_calls_made INTEGER DEFAULT 0,
  api_calls_failed INTEGER DEFAULT 0,
  tokens_consumed INTEGER DEFAULT 0,
  estimated_cost_usd DECIMAL(10,4),
  
  -- Quality metrics
  success_rate DECIMAL(5,2), -- percentage
  content_quality_score DECIMAL(3,2), -- 0-10 scale
  user_satisfaction_score INTEGER, -- 1-5 scale
  
  -- System resource usage
  peak_memory_usage_mb INTEGER,
  avg_cpu_usage_percent DECIMAL(5,2),
  database_queries_count INTEGER,
  cache_hit_rate DECIMAL(5,2),
  
  -- Generation characteristics
  knowledge_base_size_mb DECIMAL(10,2),
  total_lessons_generated INTEGER,
  total_sections_generated INTEGER,
  total_assessments_generated INTEGER,
  
  -- Comparative benchmarks
  previous_job_improvement_percent DECIMAL(5,2),
  baseline_time_comparison_percent DECIMAL(5,2),
  
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create user action tracking table for recovery workflows
CREATE TABLE IF NOT EXISTS course_generation_user_actions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  job_id UUID NOT NULL REFERENCES course_generation_jobs(id) ON DELETE CASCADE,
  user_id UUID NOT NULL,
  
  -- Action details
  action_type TEXT NOT NULL, -- e.g., "retry_task", "skip_task", "modify_config", "cancel_job"
  action_context JSONB DEFAULT '{}',
  affected_tasks TEXT[], -- Array of task_identifier strings
  
  -- Results
  action_successful BOOLEAN,
  action_result JSONB DEFAULT '{}',
  
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_course_generation_tasks_job_id ON course_generation_tasks(job_id);
CREATE INDEX IF NOT EXISTS idx_course_generation_tasks_status ON course_generation_tasks(status);
CREATE INDEX IF NOT EXISTS idx_course_generation_tasks_type_status ON course_generation_tasks(task_type, status);
CREATE INDEX IF NOT EXISTS idx_course_generation_tasks_lesson_id ON course_generation_tasks(lesson_id) WHERE lesson_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_course_generation_tasks_dependencies ON course_generation_tasks USING GIN(dependencies);

CREATE INDEX IF NOT EXISTS idx_course_generation_errors_job_id ON course_generation_errors(job_id);
CREATE INDEX IF NOT EXISTS idx_course_generation_errors_severity ON course_generation_errors(error_severity);
CREATE INDEX IF NOT EXISTS idx_course_generation_errors_category ON course_generation_errors(error_category);
CREATE INDEX IF NOT EXISTS idx_course_generation_errors_created_at ON course_generation_errors(created_at);

CREATE INDEX IF NOT EXISTS idx_course_generation_analytics_job_id ON course_generation_analytics(job_id);
CREATE INDEX IF NOT EXISTS idx_course_generation_analytics_created_at ON course_generation_analytics(created_at);

CREATE INDEX IF NOT EXISTS idx_course_generation_user_actions_job_id ON course_generation_user_actions(job_id);
CREATE INDEX IF NOT EXISTS idx_course_generation_user_actions_user_id ON course_generation_user_actions(user_id);

-- Create trigger to automatically update updated_at timestamp
CREATE OR REPLACE FUNCTION update_course_generation_tasks_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_update_course_generation_tasks_updated_at
  BEFORE UPDATE ON course_generation_tasks
  FOR EACH ROW
  EXECUTE FUNCTION update_course_generation_tasks_updated_at();

-- Create function to calculate job completion percentage
CREATE OR REPLACE FUNCTION calculate_job_completion_percentage(job_uuid UUID)
RETURNS DECIMAL(5,2) AS $$
DECLARE
  total_tasks INTEGER;
  completed_tasks INTEGER;
  percentage DECIMAL(5,2);
BEGIN
  SELECT COUNT(*) INTO total_tasks
  FROM course_generation_tasks
  WHERE job_id = job_uuid;
  
  IF total_tasks = 0 THEN
    RETURN 0.00;
  END IF;
  
  SELECT COUNT(*) INTO completed_tasks
  FROM course_generation_tasks
  WHERE job_id = job_uuid AND status IN ('completed', 'skipped');
  
  percentage := (completed_tasks::DECIMAL / total_tasks::DECIMAL) * 100;
  RETURN percentage;
END;
$$ LANGUAGE plpgsql;

-- Create function to get task dependency status
CREATE OR REPLACE FUNCTION check_task_dependencies_ready(task_uuid UUID)
RETURNS BOOLEAN AS $$
DECLARE
  task_record RECORD;
  dependency_identifier TEXT;
  dependency_ready BOOLEAN;
BEGIN
  -- Get the task and its dependencies
  SELECT * INTO task_record
  FROM course_generation_tasks
  WHERE id = task_uuid;
  
  IF NOT FOUND THEN
    RETURN FALSE;
  END IF;
  
  -- Check each dependency
  FOREACH dependency_identifier IN ARRAY task_record.dependencies
  LOOP
    SELECT 
      CASE 
        WHEN status IN ('completed', 'skipped') THEN TRUE
        ELSE FALSE
      END INTO dependency_ready
    FROM course_generation_tasks
    WHERE job_id = task_record.job_id 
    AND task_identifier = dependency_identifier;
    
    -- If any dependency is not ready, return false
    IF NOT dependency_ready THEN
      RETURN FALSE;
    END IF;
  END LOOP;
  
  -- All dependencies are ready
  RETURN TRUE;
END;
$$ LANGUAGE plpgsql;

-- Add Row Level Security policies
ALTER TABLE course_generation_tasks ENABLE ROW LEVEL SECURITY;
ALTER TABLE course_generation_errors ENABLE ROW LEVEL SECURITY;
ALTER TABLE course_generation_analytics ENABLE ROW LEVEL SECURITY;
ALTER TABLE course_generation_user_actions ENABLE ROW LEVEL SECURITY;

-- Tasks access policies
CREATE POLICY "Users can view tasks for their jobs" ON course_generation_tasks
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM course_generation_jobs
      WHERE course_generation_jobs.id = course_generation_tasks.job_id
      AND course_generation_jobs.user_id = auth.uid()
    )
  );

CREATE POLICY "System can manage all tasks" ON course_generation_tasks
  FOR ALL USING (auth.role() = 'service_role');

-- Error logs access policies  
CREATE POLICY "Users can view errors for their jobs" ON course_generation_errors
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM course_generation_jobs
      WHERE course_generation_jobs.id = course_generation_errors.job_id
      AND course_generation_jobs.user_id = auth.uid()
    )
  );

CREATE POLICY "System can manage all errors" ON course_generation_errors
  FOR ALL USING (auth.role() = 'service_role');

-- Analytics access policies
CREATE POLICY "Users can view analytics for their jobs" ON course_generation_analytics
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM course_generation_jobs
      WHERE course_generation_jobs.id = course_generation_analytics.job_id
      AND course_generation_jobs.user_id = auth.uid()
    )
  );

CREATE POLICY "System can manage all analytics" ON course_generation_analytics
  FOR ALL USING (auth.role() = 'service_role');

-- User actions policies
CREATE POLICY "Users can view their own actions" ON course_generation_user_actions
  FOR SELECT USING (user_id = auth.uid());

CREATE POLICY "Users can insert their own actions" ON course_generation_user_actions
  FOR INSERT WITH CHECK (user_id = auth.uid());

CREATE POLICY "System can manage all user actions" ON course_generation_user_actions
  FOR ALL USING (auth.role() = 'service_role'); 