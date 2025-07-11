-- Create AI Insights System Migration
-- This migration creates the infrastructure for AI-powered dashboard insights

-- Create insights table
CREATE TABLE IF NOT EXISTS public.ai_insights (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    user_role public.role NOT NULL,
    
    -- Insight content
    insights JSONB NOT NULL, -- Array of 2-3 insight objects
    
    -- Generation metadata
    generated_at TIMESTAMPTZ DEFAULT NOW(),
    expires_at TIMESTAMPTZ DEFAULT (NOW() + INTERVAL '24 hours'),
    
    -- User interaction
    dismissed_at TIMESTAMPTZ,
    is_dismissed BOOLEAN DEFAULT false,
    
    -- Data used for generation (for debugging/improvement)
    source_data_summary JSONB,
    
    -- AI generation details
    ai_model TEXT DEFAULT 'gpt-4',
    generation_duration_ms INTEGER,
    
    -- Timestamps
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    
    -- Ensure only one active insight per user
    UNIQUE(user_id, is_dismissed) WHERE is_dismissed = false
);

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_ai_insights_user_id ON public.ai_insights(user_id);
CREATE INDEX IF NOT EXISTS idx_ai_insights_user_role ON public.ai_insights(user_role);
CREATE INDEX IF NOT EXISTS idx_ai_insights_expires_at ON public.ai_insights(expires_at);
CREATE INDEX IF NOT EXISTS idx_ai_insights_dismissed ON public.ai_insights(is_dismissed);
CREATE INDEX IF NOT EXISTS idx_ai_insights_generated_at ON public.ai_insights(generated_at);

-- Create function to clean up expired insights
CREATE OR REPLACE FUNCTION public.cleanup_expired_insights()
RETURNS INTEGER AS $$
DECLARE
    deleted_count INTEGER;
BEGIN
    DELETE FROM public.ai_insights 
    WHERE expires_at < NOW() 
    OR (is_dismissed = true AND dismissed_at < NOW() - INTERVAL '7 days');
    
    GET DIAGNOSTICS deleted_count = ROW_COUNT;
    RETURN deleted_count;
END;
$$ LANGUAGE plpgsql;

-- Create trigger to update updated_at timestamp
CREATE OR REPLACE FUNCTION public.update_ai_insights_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_ai_insights_updated_at
    BEFORE UPDATE ON public.ai_insights
    FOR EACH ROW
    EXECUTE FUNCTION public.update_ai_insights_updated_at();

-- Enable RLS
ALTER TABLE public.ai_insights ENABLE ROW LEVEL SECURITY;

-- RLS Policies
CREATE POLICY "Users can view their own insights" ON public.ai_insights
    FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own insights" ON public.ai_insights
    FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own insights" ON public.ai_insights
    FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own insights" ON public.ai_insights
    FOR DELETE USING (auth.uid() = user_id);

-- Create function to get or generate insights for a user
CREATE OR REPLACE FUNCTION public.get_user_insights(p_user_id UUID)
RETURNS TABLE (
    id UUID,
    insights JSONB,
    generated_at TIMESTAMPTZ,
    expires_at TIMESTAMPTZ,
    needs_refresh BOOLEAN
) AS $$
BEGIN
    RETURN QUERY
    SELECT 
        ai.id,
        ai.insights,
        ai.generated_at,
        ai.expires_at,
        (ai.expires_at < NOW() OR ai.generated_at < NOW() - INTERVAL '20 hours') as needs_refresh
    FROM public.ai_insights ai
    WHERE ai.user_id = p_user_id 
    AND ai.is_dismissed = false
    ORDER BY ai.generated_at DESC
    LIMIT 1;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Grant necessary permissions
GRANT USAGE ON SCHEMA public TO authenticated;
GRANT ALL ON public.ai_insights TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_user_insights(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION public.cleanup_expired_insights() TO authenticated; 