-- Create course_generation_rate_limits table for tracking user rate limits
CREATE TABLE IF NOT EXISTS course_generation_rate_limits (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  minute_count INTEGER DEFAULT 0 NOT NULL,
  hour_count INTEGER DEFAULT 0 NOT NULL,
  day_count INTEGER DEFAULT 0 NOT NULL,
  active_jobs INTEGER DEFAULT 0 NOT NULL,
  last_minute_reset TIMESTAMPTZ DEFAULT NOW() NOT NULL,
  last_hour_reset TIMESTAMPTZ DEFAULT NOW() NOT NULL,
  last_day_reset TIMESTAMPTZ DEFAULT NOW() NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
  updated_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
  
  -- Ensure one record per user
  UNIQUE(user_id)
);

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_course_generation_rate_limits_user_id 
ON course_generation_rate_limits(user_id);

CREATE INDEX IF NOT EXISTS idx_course_generation_rate_limits_active_jobs 
ON course_generation_rate_limits(active_jobs) WHERE active_jobs > 0;

-- Enable Row Level Security
ALTER TABLE course_generation_rate_limits ENABLE ROW LEVEL SECURITY;

-- Create RLS policies
-- Users can only see their own rate limit data
CREATE POLICY "Users can view own rate limits" 
ON course_generation_rate_limits 
FOR SELECT 
USING (auth.uid() = user_id);

-- Service role can manage all rate limit data
CREATE POLICY "Service role can manage all rate limits" 
ON course_generation_rate_limits 
FOR ALL 
USING (auth.jwt() ->> 'role' = 'service_role');

-- Create trigger to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_course_generation_rate_limits_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER course_generation_rate_limits_updated_at
  BEFORE UPDATE ON course_generation_rate_limits
  FOR EACH ROW
  EXECUTE FUNCTION update_course_generation_rate_limits_updated_at();

-- Create the RPC function for atomic increment operations
CREATE OR REPLACE FUNCTION increment_rate_limit_counters(p_user_id UUID)
RETURNS void AS $$
BEGIN
  UPDATE course_generation_rate_limits
  SET 
    minute_count = minute_count + 1,
    hour_count = hour_count + 1,
    day_count = day_count + 1,
    active_jobs = active_jobs + 1,
    updated_at = NOW()
  WHERE user_id = p_user_id;
  
  -- Insert if not exists
  IF NOT FOUND THEN
    INSERT INTO course_generation_rate_limits (
      user_id, minute_count, hour_count, day_count, active_jobs
    ) VALUES (
      p_user_id, 1, 1, 1, 1
    );
  END IF;
END;
$$ LANGUAGE plpgsql;

-- Grant necessary permissions
GRANT USAGE ON SCHEMA public TO authenticated;
GRANT ALL ON course_generation_rate_limits TO authenticated;
GRANT EXECUTE ON FUNCTION increment_rate_limit_counters(UUID) TO authenticated;