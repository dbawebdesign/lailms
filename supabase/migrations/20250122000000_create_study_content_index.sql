-- Migration: Create Study Content Index System
-- Enables unified content search and indexing for Study Spaces

-- Create study_content_index table for aggregated content
CREATE TABLE public.study_content_index (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    
    -- Organization and class context
    base_class_id UUID NOT NULL REFERENCES public.base_classes(id) ON DELETE CASCADE,
    organisation_id UUID NOT NULL REFERENCES public.organisations(id) ON DELETE CASCADE,
    
    -- Content Identity & Classification
    content_type TEXT NOT NULL CHECK (content_type IN ('course', 'module', 'lesson', 'section', 'media', 'assessment', 'document')),
    source_table TEXT NOT NULL,
    source_id UUID NOT NULL,
    
    -- Hierarchy & Relationships
    path_id UUID REFERENCES public.paths(id) ON DELETE CASCADE,
    lesson_id UUID REFERENCES public.lessons(id) ON DELETE CASCADE,
    parent_content_id UUID REFERENCES public.study_content_index(id) ON DELETE CASCADE,
    
    -- Core Content
    title TEXT NOT NULL,
    description TEXT,
    content_text TEXT NOT NULL,
    content_json JSONB,
    
    -- Search Infrastructure
    content_embedding VECTOR(1536),
    search_keywords TEXT[],
    tags TEXT[],
    content_tsvector TSVECTOR GENERATED ALWAYS AS (
        setweight(to_tsvector('english', COALESCE(title, '')), 'A') ||
        setweight(to_tsvector('english', COALESCE(description, '')), 'B') ||
        setweight(to_tsvector('english', COALESCE(content_text, '')), 'C')
    ) STORED,
    
    -- Learning Metadata
    difficulty_level TEXT,
    estimated_time INTEGER, -- in minutes
    learning_objectives TEXT[],
    prerequisites TEXT[],
    
    -- Study Space Features
    is_bookmarkable BOOLEAN DEFAULT true,
    is_notable BOOLEAN DEFAULT true,
    progress_trackable BOOLEAN DEFAULT false,
    
    -- Content Relationships
    related_content_ids UUID[],
    assessment_ids UUID[],
    media_asset_ids UUID[],
    
    -- Timestamps
    created_at TIMESTAMPTZ NOT NULL,
    updated_at TIMESTAMPTZ NOT NULL,
    indexed_at TIMESTAMPTZ DEFAULT now() NOT NULL,
    
    -- Unique constraint to prevent duplicates
    UNIQUE(source_table, source_id, base_class_id)
);

-- Create indexes for performance
CREATE INDEX idx_study_content_base_class ON study_content_index(base_class_id);
CREATE INDEX idx_study_content_organisation ON study_content_index(organisation_id);
CREATE INDEX idx_study_content_type ON study_content_index(content_type);
CREATE INDEX idx_study_content_path ON study_content_index(path_id) WHERE path_id IS NOT NULL;
CREATE INDEX idx_study_content_lesson ON study_content_index(lesson_id) WHERE lesson_id IS NOT NULL;
CREATE INDEX idx_study_content_parent ON study_content_index(parent_content_id) WHERE parent_content_id IS NOT NULL;

-- Vector search index
CREATE INDEX idx_study_content_embedding ON study_content_index 
    USING ivfflat (content_embedding vector_cosine_ops)
    WITH (lists = 100);

-- Full-text search index
CREATE INDEX idx_study_content_fts ON study_content_index USING gin(content_tsvector);

-- Tag search index
CREATE INDEX idx_study_content_tags ON study_content_index USING gin(tags);

-- Composite indexes for common queries
CREATE INDEX idx_study_content_class_type ON study_content_index(base_class_id, content_type);
CREATE INDEX idx_study_content_class_indexed ON study_content_index(base_class_id, indexed_at DESC);

-- Enable RLS
ALTER TABLE study_content_index ENABLE ROW LEVEL SECURITY;

-- RLS Policy: Users can access content from their enrolled classes
CREATE POLICY "Users can access study content from enrolled classes" ON study_content_index
    FOR SELECT USING (
        EXISTS (
            SELECT 1 
            FROM public.rosters r
            JOIN public.class_instances ci ON r.class_instance_id = ci.id
            WHERE ci.base_class_id = study_content_index.base_class_id
            AND r.profile_id = auth.uid()
            AND r.role = 'student'
        )
        OR
        EXISTS (
            SELECT 1 
            FROM public.profiles p
            WHERE p.user_id = auth.uid()
            AND p.organisation_id = study_content_index.organisation_id
            AND COALESCE(p.active_role, p.role) IN ('teacher', 'admin', 'super_admin')
        )
    );

-- RLS Policy: Only system can insert/update (content indexing service)
CREATE POLICY "System can manage study content index" ON study_content_index
    FOR ALL USING (false); -- Disable direct user access, use service role

-- Create content reindex queue table
CREATE TABLE public.content_reindex_queue (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    source_table TEXT NOT NULL,
    source_id UUID NOT NULL,
    base_class_id UUID NOT NULL,
    priority TEXT NOT NULL DEFAULT 'medium' CHECK (priority IN ('low', 'medium', 'high')),
    status TEXT NOT NULL DEFAULT 'queued' CHECK (status IN ('queued', 'processing', 'completed', 'failed')),
    error_message TEXT,
    created_at TIMESTAMPTZ DEFAULT now() NOT NULL,
    processed_at TIMESTAMPTZ,
    
    -- Prevent duplicate queue entries
    UNIQUE(source_table, source_id, base_class_id)
);

-- Index for queue processing
CREATE INDEX idx_reindex_queue_status_priority ON content_reindex_queue(status, priority, created_at);
CREATE INDEX idx_reindex_queue_base_class ON content_reindex_queue(base_class_id);

-- Enable RLS for queue table
ALTER TABLE content_reindex_queue ENABLE ROW LEVEL SECURITY;

-- Queue access policy - only system role
CREATE POLICY "System can manage reindex queue" ON content_reindex_queue
    FOR ALL USING (false); -- Service role only

-- Create content indexing jobs table
CREATE TABLE public.content_indexing_jobs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    base_class_id UUID NOT NULL REFERENCES public.base_classes(id) ON DELETE CASCADE,
    organisation_id UUID NOT NULL REFERENCES public.organisations(id) ON DELETE CASCADE,
    status TEXT NOT NULL DEFAULT 'queued' CHECK (status IN ('queued', 'processing', 'completed', 'failed')),
    progress INTEGER DEFAULT 0 CHECK (progress >= 0 AND progress <= 100),
    total_items INTEGER DEFAULT 0,
    processed_items INTEGER DEFAULT 0,
    error_message TEXT,
    stats JSONB,
    started_at TIMESTAMPTZ,
    completed_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT now() NOT NULL,
    updated_at TIMESTAMPTZ DEFAULT now() NOT NULL
);

-- Index for job monitoring
CREATE INDEX idx_indexing_jobs_status ON content_indexing_jobs(status, created_at DESC);
CREATE INDEX idx_indexing_jobs_base_class ON content_indexing_jobs(base_class_id);

-- Enable RLS for jobs table
ALTER TABLE content_indexing_jobs ENABLE ROW LEVEL SECURITY;

-- Jobs access policy - teachers and admins can view their organization's jobs
CREATE POLICY "Users can view indexing jobs for their organization" ON content_indexing_jobs
    FOR SELECT USING (
        EXISTS (
            SELECT 1 
            FROM public.profiles p
            WHERE p.user_id = auth.uid()
            AND p.organisation_id = content_indexing_jobs.organisation_id
            AND COALESCE(p.active_role, p.role) IN ('teacher', 'admin', 'super_admin')
        )
    );

-- Create trigger function for automatic reindexing
CREATE OR REPLACE FUNCTION trigger_content_reindex()
RETURNS TRIGGER AS $$
DECLARE
    target_base_class_id UUID;
BEGIN
    -- Determine base_class_id based on the table and record
    CASE TG_TABLE_NAME
        WHEN 'base_classes' THEN
            target_base_class_id := NEW.id;
        WHEN 'paths' THEN
            target_base_class_id := NEW.base_class_id;
        WHEN 'lessons' THEN
            SELECT p.base_class_id INTO target_base_class_id 
            FROM paths p WHERE p.id = NEW.path_id;
        WHEN 'lesson_sections' THEN
            SELECT p.base_class_id INTO target_base_class_id 
            FROM paths p 
            JOIN lessons l ON p.id = l.path_id 
            WHERE l.id = NEW.lesson_id;
        WHEN 'lesson_media_assets' THEN
            SELECT p.base_class_id INTO target_base_class_id 
            FROM paths p 
            JOIN lessons l ON p.id = l.path_id 
            WHERE l.id = NEW.lesson_id;
        ELSE
            RETURN NEW; -- Skip unknown tables
    END CASE;
    
    -- Only queue if we found a base_class_id
    IF target_base_class_id IS NOT NULL THEN
        INSERT INTO content_reindex_queue (source_table, source_id, base_class_id, priority)
        VALUES (TG_TABLE_NAME, NEW.id, target_base_class_id, 'medium')
        ON CONFLICT (source_table, source_id, base_class_id) DO UPDATE SET
            created_at = now(),
            status = 'queued',
            processed_at = NULL,
            error_message = NULL;
    END IF;
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Apply triggers to content tables
CREATE TRIGGER content_change_base_classes 
    AFTER INSERT OR UPDATE ON base_classes 
    FOR EACH ROW EXECUTE FUNCTION trigger_content_reindex();

CREATE TRIGGER content_change_paths 
    AFTER INSERT OR UPDATE ON paths 
    FOR EACH ROW EXECUTE FUNCTION trigger_content_reindex();

CREATE TRIGGER content_change_lessons 
    AFTER INSERT OR UPDATE ON lessons 
    FOR EACH ROW EXECUTE FUNCTION trigger_content_reindex();

CREATE TRIGGER content_change_sections 
    AFTER INSERT OR UPDATE ON lesson_sections 
    FOR EACH ROW EXECUTE FUNCTION trigger_content_reindex();

CREATE TRIGGER content_change_media_assets 
    AFTER INSERT OR UPDATE ON lesson_media_assets 
    FOR EACH ROW EXECUTE FUNCTION trigger_content_reindex();

-- Create vector search function for study content
CREATE OR REPLACE FUNCTION search_study_content(
    query_embedding VECTOR(1536),
    target_base_class_id UUID,
    target_organisation_id UUID,
    content_types TEXT[] DEFAULT NULL,
    match_threshold FLOAT DEFAULT 0.5,
    match_count INT DEFAULT 20
) RETURNS TABLE (
    id UUID,
    content_type TEXT,
    title TEXT,
    description TEXT,
    content_text TEXT,
    path_id UUID,
    lesson_id UUID,
    tags TEXT[],
    difficulty_level TEXT,
    estimated_time INTEGER,
    is_bookmarkable BOOLEAN,
    is_notable BOOLEAN,
    progress_trackable BOOLEAN,
    similarity FLOAT
) LANGUAGE plpgsql AS $$
BEGIN
    RETURN QUERY
    SELECT
        sci.id,
        sci.content_type,
        sci.title,
        sci.description,
        sci.content_text,
        sci.path_id,
        sci.lesson_id,
        sci.tags,
        sci.difficulty_level,
        sci.estimated_time,
        sci.is_bookmarkable,
        sci.is_notable,
        sci.progress_trackable,
        1 - (sci.content_embedding <=> query_embedding) AS similarity
    FROM
        public.study_content_index sci
    WHERE
        sci.base_class_id = target_base_class_id
        AND sci.organisation_id = target_organisation_id
        AND sci.content_embedding IS NOT NULL
        AND (content_types IS NULL OR sci.content_type = ANY(content_types))
        AND 1 - (sci.content_embedding <=> query_embedding) > match_threshold
    ORDER BY
        similarity DESC
    LIMIT
        match_count;
END;
$$;

-- Create full-text search function for study content
CREATE OR REPLACE FUNCTION search_study_content_text(
    search_query TEXT,
    target_base_class_id UUID,
    target_organisation_id UUID,
    content_types TEXT[] DEFAULT NULL,
    match_count INT DEFAULT 20
) RETURNS TABLE (
    id UUID,
    content_type TEXT,
    title TEXT,
    description TEXT,
    content_text TEXT,
    path_id UUID,
    lesson_id UUID,
    tags TEXT[],
    difficulty_level TEXT,
    estimated_time INTEGER,
    is_bookmarkable BOOLEAN,
    is_notable BOOLEAN,
    progress_trackable BOOLEAN,
    rank REAL
) LANGUAGE plpgsql AS $$
BEGIN
    RETURN QUERY
    SELECT
        sci.id,
        sci.content_type,
        sci.title,
        sci.description,
        sci.content_text,
        sci.path_id,
        sci.lesson_id,
        sci.tags,
        sci.difficulty_level,
        sci.estimated_time,
        sci.is_bookmarkable,
        sci.is_notable,
        sci.progress_trackable,
        ts_rank(sci.content_tsvector, plainto_tsquery('english', search_query)) AS rank
    FROM
        public.study_content_index sci
    WHERE
        sci.base_class_id = target_base_class_id
        AND sci.organisation_id = target_organisation_id
        AND (content_types IS NULL OR sci.content_type = ANY(content_types))
        AND sci.content_tsvector @@ plainto_tsquery('english', search_query)
    ORDER BY
        rank DESC,
        sci.content_type,
        sci.title
    LIMIT
        match_count;
END;
$$; 