-- File: supabase/migrations/20240513133000_alter_lesson_sections_content_to_jsonb.sql

-- 1. Alter lesson_sections content column from TEXT to JSONB
ALTER TABLE public.lesson_sections
ALTER COLUMN content TYPE JSONB
USING content::JSONB;

COMMENT ON COLUMN public.lesson_sections.content IS 'Rich text content for the lesson section, stored as JSONB (e.g., Tiptap output). Changed from TEXT to JSONB.';

-- Ensure 'created_by' columns in 'public.lessons' and 'public.lesson_sections' store auth.uid().
-- If they reference a different table (e.g., 'members') or a different ID from 'profiles',
-- those tables/columns and related FKs would need adjustment first.
-- This migration assumes lessons.created_by and lesson_sections.created_by hold auth.uid().

-- 2. Create the lesson_section_versions table
CREATE TABLE IF NOT EXISTS public.lesson_section_versions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    lesson_section_id UUID NOT NULL REFERENCES public.lesson_sections(id) ON DELETE CASCADE,
    content JSONB, -- Storing the Tiptap JSON content for this version
    creator_user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL, -- Stores auth.uid() of the creator
    created_at TIMESTAMPTZ DEFAULT now() NOT NULL,
    version_number INTEGER NOT NULL,
    CONSTRAINT uq_lesson_section_version UNIQUE (lesson_section_id, version_number)
);

COMMENT ON TABLE public.lesson_section_versions IS 'Stores version history for the content of each lesson section.';
COMMENT ON COLUMN public.lesson_section_versions.creator_user_id IS 'The auth.users.id of the user who created this version.';

-- 3. Enable RLS for lesson_section_versions
ALTER TABLE public.lesson_section_versions ENABLE ROW LEVEL SECURITY;

-- 4. RLS Policies for lesson_section_versions
CREATE POLICY "Allow authenticated users to select lesson section versions"
ON public.lesson_section_versions
FOR SELECT
USING (
    auth.role() = 'authenticated' AND
    EXISTS (
        SELECT 1
        FROM public.lesson_sections ls
        WHERE ls.id = lesson_section_versions.lesson_section_id -- RLS on ls controls its visibility
    )
);

-- Policy: Allow users to insert versions if they created the parent lesson AND are the ones creating the version.
-- Adjust l.created_by check if lesson edit permissions are broader.
CREATE POLICY "Allow lesson creators to insert lesson section versions"
ON public.lesson_section_versions
FOR INSERT
WITH CHECK (
    lesson_section_versions.creator_user_id = auth.uid() AND -- Must be the current user
    EXISTS (
        SELECT 1
        FROM public.lesson_sections ls
        JOIN public.lessons l ON ls.lesson_id = l.id
        WHERE ls.id = lesson_section_versions.lesson_section_id AND l.created_by = auth.uid()
    )
);

-- Trigger function to increment version_number
CREATE OR REPLACE FUNCTION public.set_lesson_section_version_number()
RETURNS TRIGGER AS $$
BEGIN
    SELECT COALESCE(MAX(v.version_number), 0) + 1
    INTO NEW.version_number
    FROM public.lesson_section_versions v
    WHERE v.lesson_section_id = NEW.lesson_section_id;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_set_lesson_section_version_number ON public.lesson_section_versions;
CREATE TRIGGER trg_set_lesson_section_version_number
BEFORE INSERT ON public.lesson_section_versions
FOR EACH ROW
EXECUTE FUNCTION public.set_lesson_section_version_number();

-- PostgreSQL function to create a lesson section and its initial version
CREATE OR REPLACE FUNCTION public.create_lesson_section_with_initial_version(
    p_lesson_id UUID,
    p_title TEXT,
    p_content JSONB,
    p_order_index INTEGER,
    p_section_type TEXT,
    p_creator_user_id UUID -- This should be auth.uid() of the creator
)
RETURNS SETOF public.lesson_sections
LANGUAGE plpgsql
AS $$
DECLARE
    new_section_record public.lesson_sections%ROWTYPE;
    v_actual_order_index INTEGER;
BEGIN
    IF p_order_index IS NULL THEN
        SELECT COALESCE(MAX(ls.order_index), 0) + 1
        INTO v_actual_order_index
        FROM public.lesson_sections ls
        WHERE ls.lesson_id = p_lesson_id;
    ELSE
        v_actual_order_index := p_order_index;
        UPDATE public.lesson_sections
        SET order_index = order_index + 1
        WHERE lesson_id = p_lesson_id AND order_index >= v_actual_order_index;
    END IF;

    -- Assuming lesson_sections.created_by column stores auth.uid()
    INSERT INTO public.lesson_sections (lesson_id, title, content, order_index, section_type, created_by)
    VALUES (p_lesson_id, p_title, p_content, v_actual_order_index, p_section_type, p_creator_user_id)
    RETURNING * INTO new_section_record;

    INSERT INTO public.lesson_section_versions (lesson_section_id, content, creator_user_id)
    VALUES (new_section_record.id, p_content, p_creator_user_id);

    RETURN QUERY SELECT * FROM public.lesson_sections WHERE id = new_section_record.id;
END;
$$;

GRANT EXECUTE ON FUNCTION public.create_lesson_section_with_initial_version(UUID, TEXT, JSONB, INTEGER, TEXT, UUID) TO authenticated; 