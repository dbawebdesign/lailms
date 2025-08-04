-- Create course_generation_alerts table for tracking generation issues
CREATE TABLE IF NOT EXISTS course_generation_alerts (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    job_id UUID NOT NULL REFERENCES course_generation_jobs(id) ON DELETE CASCADE,
    alert_type VARCHAR(50) NOT NULL, -- 'stalled', 'stuck', 'failed', 'timeout', etc.
    severity VARCHAR(20) NOT NULL DEFAULT 'medium', -- 'low', 'medium', 'high', 'critical'
    title VARCHAR(255) NOT NULL,
    message TEXT NOT NULL,
    metadata JSONB DEFAULT '{}',
    resolved BOOLEAN DEFAULT FALSE,
    resolved_at TIMESTAMPTZ,
    resolved_by UUID REFERENCES auth.users(id),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_course_generation_alerts_job_id ON course_generation_alerts(job_id);
CREATE INDEX IF NOT EXISTS idx_course_generation_alerts_resolved ON course_generation_alerts(resolved);
CREATE INDEX IF NOT EXISTS idx_course_generation_alerts_severity ON course_generation_alerts(severity);
CREATE INDEX IF NOT EXISTS idx_course_generation_alerts_created_at ON course_generation_alerts(created_at);

-- Add RLS policies
ALTER TABLE course_generation_alerts ENABLE ROW LEVEL SECURITY;

-- Users can only see alerts for their own jobs
CREATE POLICY "Users can view their own generation alerts" ON course_generation_alerts
    FOR SELECT USING (
        job_id IN (
            SELECT id FROM course_generation_jobs 
            WHERE user_id = auth.uid()
        )
    );

-- Users can update alerts for their own jobs
CREATE POLICY "Users can update their own generation alerts" ON course_generation_alerts
    FOR UPDATE USING (
        job_id IN (
            SELECT id FROM course_generation_jobs 
            WHERE user_id = auth.uid()
        )
    );

-- Service role can do everything
CREATE POLICY "Service role can manage all alerts" ON course_generation_alerts
    FOR ALL USING (auth.jwt() ->> 'role' = 'service_role');