-- Luna Agents Database Schema Migration
-- This migration adds the necessary tables and modifications for the Luna Agents system

-- Add agent tracking columns to existing tables
ALTER TABLE lesson_sections 
ADD COLUMN IF NOT EXISTS created_by_agent BOOLEAN DEFAULT FALSE,
ADD COLUMN IF NOT EXISTS agent_context JSONB,
ADD COLUMN IF NOT EXISTS updated_by_agent BOOLEAN DEFAULT FALSE;

ALTER TABLE lessons 
ADD COLUMN IF NOT EXISTS created_by_agent BOOLEAN DEFAULT FALSE,
ADD COLUMN IF NOT EXISTS agent_context JSONB,
ADD COLUMN IF NOT EXISTS updated_by_agent BOOLEAN DEFAULT FALSE;

ALTER TABLE paths 
ADD COLUMN IF NOT EXISTS created_by_agent BOOLEAN DEFAULT FALSE,
ADD COLUMN IF NOT EXISTS agent_context JSONB,
ADD COLUMN IF NOT EXISTS updated_by_agent BOOLEAN DEFAULT FALSE;

ALTER TABLE base_classes 
ADD COLUMN IF NOT EXISTS created_by_agent BOOLEAN DEFAULT FALSE,
ADD COLUMN IF NOT EXISTS agent_context JSONB,
ADD COLUMN IF NOT EXISTS updated_by_agent BOOLEAN DEFAULT FALSE;

-- Agent analytics table for tracking performance and usage
CREATE TABLE IF NOT EXISTS agent_analytics (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  agent_name TEXT NOT NULL,
  action_type TEXT NOT NULL,
  user_id UUID REFERENCES members(id),
  organisation_id UUID REFERENCES organisations(id),
  session_id TEXT,
  input_tokens INTEGER,
  output_tokens INTEGER,
  execution_time_ms INTEGER,
  success BOOLEAN DEFAULT TRUE,
  error_message TEXT,
  metadata JSONB,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Agent sessions table for tracking conversation sessions
CREATE TABLE IF NOT EXISTS agent_sessions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id TEXT UNIQUE NOT NULL,
  user_id UUID REFERENCES members(id),
  organisation_id UUID REFERENCES organisations(id),
  agent_persona TEXT NOT NULL,
  user_role TEXT NOT NULL,
  started_at TIMESTAMPTZ DEFAULT NOW(),
  ended_at TIMESTAMPTZ,
  message_count INTEGER DEFAULT 0,
  total_tokens INTEGER DEFAULT 0,
  session_metadata JSONB,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Agent messages table for storing conversation history
CREATE TABLE IF NOT EXISTS agent_messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id UUID REFERENCES agent_sessions(id) ON DELETE CASCADE,
  message_id TEXT NOT NULL,
  role TEXT NOT NULL CHECK (role IN ('user', 'assistant', 'system')),
  content TEXT NOT NULL,
  agent_name TEXT,
  agent_type TEXT CHECK (agent_type IN ('text', 'voice', 'hybrid')),
  tools_used TEXT[],
  citations JSONB,
  action_buttons JSONB,
  real_time_updates JSONB,
  execution_time_ms INTEGER,
  message_metadata JSONB,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Agent tools usage tracking
CREATE TABLE IF NOT EXISTS agent_tool_usage (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  agent_name TEXT NOT NULL,
  tool_name TEXT NOT NULL,
  user_id UUID REFERENCES members(id),
  organisation_id UUID REFERENCES organisations(id),
  session_id TEXT,
  execution_time_ms INTEGER,
  success BOOLEAN DEFAULT TRUE,
  error_message TEXT,
  input_parameters JSONB,
  output_data JSONB,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Agent performance summary view for quick analytics
CREATE TABLE IF NOT EXISTS agent_performance_summary (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  agent_name TEXT NOT NULL,
  organisation_id UUID REFERENCES organisations(id),
  date_bucket DATE NOT NULL,
  total_requests INTEGER DEFAULT 0,
  successful_requests INTEGER DEFAULT 0,
  failed_requests INTEGER DEFAULT 0,
  average_execution_time_ms NUMERIC,
  total_tokens_used INTEGER DEFAULT 0,
  unique_users INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(agent_name, organisation_id, date_bucket)
);

-- Real-time updates tracking for UI feedback
CREATE TABLE IF NOT EXISTS agent_real_time_updates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id TEXT NOT NULL,
  message_id TEXT NOT NULL,
  entity_type TEXT NOT NULL,
  entity_id TEXT NOT NULL,
  update_type TEXT NOT NULL CHECK (update_type IN ('create', 'update', 'delete')),
  status TEXT NOT NULL CHECK (status IN ('pending', 'completed', 'failed')),
  progress_percentage INTEGER DEFAULT 0 CHECK (progress_percentage >= 0 AND progress_percentage <= 100),
  started_at TIMESTAMPTZ DEFAULT NOW(),
  completed_at TIMESTAMPTZ,
  metadata JSONB,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes for performance optimization
CREATE INDEX IF NOT EXISTS idx_agent_analytics_agent_name ON agent_analytics(agent_name);
CREATE INDEX IF NOT EXISTS idx_agent_analytics_user_id ON agent_analytics(user_id);
CREATE INDEX IF NOT EXISTS idx_agent_analytics_organisation_id ON agent_analytics(organisation_id);
CREATE INDEX IF NOT EXISTS idx_agent_analytics_created_at ON agent_analytics(created_at);
CREATE INDEX IF NOT EXISTS idx_agent_analytics_action_type ON agent_analytics(action_type);

CREATE INDEX IF NOT EXISTS idx_agent_sessions_user_id ON agent_sessions(user_id);
CREATE INDEX IF NOT EXISTS idx_agent_sessions_session_id ON agent_sessions(session_id);
CREATE INDEX IF NOT EXISTS idx_agent_sessions_agent_persona ON agent_sessions(agent_persona);
CREATE INDEX IF NOT EXISTS idx_agent_sessions_started_at ON agent_sessions(started_at);

CREATE INDEX IF NOT EXISTS idx_agent_messages_session_id ON agent_messages(session_id);
CREATE INDEX IF NOT EXISTS idx_agent_messages_role ON agent_messages(role);
CREATE INDEX IF NOT EXISTS idx_agent_messages_created_at ON agent_messages(created_at);

CREATE INDEX IF NOT EXISTS idx_agent_tool_usage_agent_name ON agent_tool_usage(agent_name);
CREATE INDEX IF NOT EXISTS idx_agent_tool_usage_tool_name ON agent_tool_usage(tool_name);
CREATE INDEX IF NOT EXISTS idx_agent_tool_usage_user_id ON agent_tool_usage(user_id);
CREATE INDEX IF NOT EXISTS idx_agent_tool_usage_created_at ON agent_tool_usage(created_at);

CREATE INDEX IF NOT EXISTS idx_agent_performance_summary_agent_name ON agent_performance_summary(agent_name);
CREATE INDEX IF NOT EXISTS idx_agent_performance_summary_date_bucket ON agent_performance_summary(date_bucket);
CREATE INDEX IF NOT EXISTS idx_agent_performance_summary_organisation_id ON agent_performance_summary(organisation_id);

CREATE INDEX IF NOT EXISTS idx_agent_real_time_updates_session_id ON agent_real_time_updates(session_id);
CREATE INDEX IF NOT EXISTS idx_agent_real_time_updates_status ON agent_real_time_updates(status);
CREATE INDEX IF NOT EXISTS idx_agent_real_time_updates_entity_type ON agent_real_time_updates(entity_type);

-- Row Level Security Policies

-- Agent analytics: Users can only see their own data, admins can see org data
ALTER TABLE agent_analytics ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own agent analytics" ON agent_analytics
    FOR SELECT USING (
        auth.uid() IS NOT NULL AND (
            user_id = (SELECT id FROM members WHERE auth_id = auth.uid()) OR
            EXISTS (
                SELECT 1 FROM members 
                WHERE auth_id = auth.uid() 
                AND role IN ('admin', 'super_admin')
                AND organisation_id = agent_analytics.organisation_id
            )
        )
    );

CREATE POLICY "System can insert agent analytics" ON agent_analytics
    FOR INSERT WITH CHECK (true);

-- Agent sessions: Users can only see their own sessions
ALTER TABLE agent_sessions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own agent sessions" ON agent_sessions
    FOR SELECT USING (
        auth.uid() IS NOT NULL AND (
            user_id = (SELECT id FROM members WHERE auth_id = auth.uid()) OR
            EXISTS (
                SELECT 1 FROM members 
                WHERE auth_id = auth.uid() 
                AND role IN ('admin', 'super_admin')
                AND organisation_id = agent_sessions.organisation_id
            )
        )
    );

CREATE POLICY "Users can create their own agent sessions" ON agent_sessions
    FOR INSERT WITH CHECK (
        auth.uid() IS NOT NULL AND 
        user_id = (SELECT id FROM members WHERE auth_id = auth.uid())
    );

CREATE POLICY "Users can update their own agent sessions" ON agent_sessions
    FOR UPDATE USING (
        auth.uid() IS NOT NULL AND 
        user_id = (SELECT id FROM members WHERE auth_id = auth.uid())
    );

-- Agent messages: Users can only see messages from their sessions
ALTER TABLE agent_messages ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view messages from their sessions" ON agent_messages
    FOR SELECT USING (
        auth.uid() IS NOT NULL AND
        session_id IN (
            SELECT id FROM agent_sessions 
            WHERE user_id = (SELECT id FROM members WHERE auth_id = auth.uid())
        )
    );

CREATE POLICY "System can insert agent messages" ON agent_messages
    FOR INSERT WITH CHECK (true);

-- Agent tool usage: Same as analytics
ALTER TABLE agent_tool_usage ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own tool usage" ON agent_tool_usage
    FOR SELECT USING (
        auth.uid() IS NOT NULL AND (
            user_id = (SELECT id FROM members WHERE auth_id = auth.uid()) OR
            EXISTS (
                SELECT 1 FROM members 
                WHERE auth_id = auth.uid() 
                AND role IN ('admin', 'super_admin')
                AND organisation_id = agent_tool_usage.organisation_id
            )
        )
    );

CREATE POLICY "System can insert tool usage" ON agent_tool_usage
    FOR INSERT WITH CHECK (true);

-- Agent performance summary: Org admins and above can view
ALTER TABLE agent_performance_summary ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can view performance summary" ON agent_performance_summary
    FOR SELECT USING (
        auth.uid() IS NOT NULL AND
        EXISTS (
            SELECT 1 FROM members 
            WHERE auth_id = auth.uid() 
            AND role IN ('admin', 'super_admin')
            AND organisation_id = agent_performance_summary.organisation_id
        )
    );

-- Agent real-time updates: Users can see updates from their sessions
ALTER TABLE agent_real_time_updates ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view real-time updates from their sessions" ON agent_real_time_updates
    FOR SELECT USING (
        auth.uid() IS NOT NULL AND
        session_id IN (
            SELECT session_id FROM agent_sessions 
            WHERE user_id = (SELECT id FROM members WHERE auth_id = auth.uid())
        )
    );

CREATE POLICY "System can insert real-time updates" ON agent_real_time_updates
    FOR INSERT WITH CHECK (true);

-- Functions for automated maintenance and analytics

-- Function to update agent performance summary daily
CREATE OR REPLACE FUNCTION update_agent_performance_summary()
RETURNS void AS $$
BEGIN
    INSERT INTO agent_performance_summary (
        agent_name,
        organisation_id,
        date_bucket,
        total_requests,
        successful_requests,
        failed_requests,
        average_execution_time_ms,
        total_tokens_used,
        unique_users
    )
    SELECT 
        agent_name,
        organisation_id,
        DATE(created_at) as date_bucket,
        COUNT(*) as total_requests,
        COUNT(*) FILTER (WHERE success = true) as successful_requests,
        COUNT(*) FILTER (WHERE success = false) as failed_requests,
        AVG(execution_time_ms) as average_execution_time_ms,
        SUM(COALESCE(input_tokens, 0) + COALESCE(output_tokens, 0)) as total_tokens_used,
        COUNT(DISTINCT user_id) as unique_users
    FROM agent_analytics
    WHERE DATE(created_at) = CURRENT_DATE - INTERVAL '1 day'
    GROUP BY agent_name, organisation_id, DATE(created_at)
    ON CONFLICT (agent_name, organisation_id, date_bucket)
    DO UPDATE SET
        total_requests = EXCLUDED.total_requests,
        successful_requests = EXCLUDED.successful_requests,
        failed_requests = EXCLUDED.failed_requests,
        average_execution_time_ms = EXCLUDED.average_execution_time_ms,
        total_tokens_used = EXCLUDED.total_tokens_used,
        unique_users = EXCLUDED.unique_users,
        updated_at = NOW();
END;
$$ LANGUAGE plpgsql;

-- Function to clean up old data
CREATE OR REPLACE FUNCTION cleanup_old_agent_data()
RETURNS void AS $$
BEGIN
    -- Delete agent analytics older than 90 days
    DELETE FROM agent_analytics 
    WHERE created_at < NOW() - INTERVAL '90 days';
    
    -- Delete agent tool usage older than 90 days
    DELETE FROM agent_tool_usage 
    WHERE created_at < NOW() - INTERVAL '90 days';
    
    -- Delete agent real-time updates older than 7 days
    DELETE FROM agent_real_time_updates 
    WHERE created_at < NOW() - INTERVAL '7 days';
    
    -- Delete agent messages from sessions older than 30 days (cascade will handle messages)
    DELETE FROM agent_sessions 
    WHERE ended_at IS NOT NULL AND ended_at < NOW() - INTERVAL '30 days';
END;
$$ LANGUAGE plpgsql;

-- Function to get agent performance metrics
CREATE OR REPLACE FUNCTION get_agent_performance_metrics(
    org_id UUID,
    start_date DATE DEFAULT CURRENT_DATE - INTERVAL '7 days',
    end_date DATE DEFAULT CURRENT_DATE
)
RETURNS TABLE (
    agent_name TEXT,
    total_requests BIGINT,
    successful_requests BIGINT,
    success_rate NUMERIC,
    avg_execution_time_ms NUMERIC,
    total_tokens BIGINT,
    unique_users BIGINT
) AS $$
BEGIN
    RETURN QUERY
    SELECT 
        aps.agent_name,
        SUM(aps.total_requests) as total_requests,
        SUM(aps.successful_requests) as successful_requests,
        ROUND(
            (SUM(aps.successful_requests)::NUMERIC / NULLIF(SUM(aps.total_requests), 0)) * 100, 
            2
        ) as success_rate,
        AVG(aps.average_execution_time_ms) as avg_execution_time_ms,
        SUM(aps.total_tokens_used) as total_tokens,
        SUM(aps.unique_users) as unique_users
    FROM agent_performance_summary aps
    WHERE aps.organisation_id = org_id
    AND aps.date_bucket BETWEEN start_date AND end_date
    GROUP BY aps.agent_name
    ORDER BY total_requests DESC;
END;
$$ LANGUAGE plpgsql;

-- Triggers for automatic timestamp updates
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_agent_sessions_updated_at 
    BEFORE UPDATE ON agent_sessions
    FOR EACH ROW 
    EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_agent_performance_summary_updated_at 
    BEFORE UPDATE ON agent_performance_summary
    FOR EACH ROW 
    EXECUTE FUNCTION update_updated_at_column();

-- Comments for documentation
COMMENT ON TABLE agent_analytics IS 'Tracks performance and usage analytics for all Luna agents';
COMMENT ON TABLE agent_sessions IS 'Stores conversation sessions between users and Luna agents';
COMMENT ON TABLE agent_messages IS 'Stores individual messages within agent conversation sessions';
COMMENT ON TABLE agent_tool_usage IS 'Tracks usage of individual tools by agents';
COMMENT ON TABLE agent_performance_summary IS 'Daily aggregated performance metrics for agents';
COMMENT ON TABLE agent_real_time_updates IS 'Tracks real-time UI updates generated by agent actions';

COMMENT ON FUNCTION update_agent_performance_summary() IS 'Aggregates daily performance metrics for all agents';
COMMENT ON FUNCTION cleanup_old_agent_data() IS 'Removes old agent data to maintain database performance';
COMMENT ON FUNCTION get_agent_performance_metrics(UUID, DATE, DATE) IS 'Retrieves aggregated performance metrics for agents within date range';