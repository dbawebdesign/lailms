-- supabase/migrations/YYYYMMDDHHMMSS_update_paths_lessons_for_baseclass_linking.sql
-- Adjust YYYYMMDDHHMMSS to current timestamp when running

BEGIN;

-- Alter public.paths table
ALTER TABLE public.paths
ADD COLUMN IF NOT EXISTS base_class_id UUID REFERENCES public.base_classes(id) ON DELETE CASCADE,
ADD COLUMN IF NOT EXISTS order_index INTEGER;

-- Handle created_by for paths: drop if exists and references members, then add creator_user_id
DO $$
BEGIN
    IF EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_schema = 'public' AND table_name = 'paths' AND column_name = 'created_by'
    ) AND EXISTS (
        SELECT 1 FROM information_schema.constraint_column_usage ccu
        JOIN information_schema.referential_constraints rc ON ccu.constraint_name = rc.constraint_name
        JOIN information_schema.table_constraints tc ON rc.unique_constraint_name = tc.constraint_name
        WHERE ccu.table_schema = 'public' AND ccu.table_name = 'paths' AND ccu.column_name = 'created_by'
        AND tc.table_schema = 'public' AND tc.table_name = 'members' -- Check if FK references members table
    ) THEN
        ALTER TABLE public.paths DROP COLUMN created_by;
    END IF;
END$$;
ALTER TABLE public.paths ADD COLUMN IF NOT EXISTS creator_user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL;

-- Rename name to title in paths if necessary
DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'paths' AND column_name = 'name')
    AND NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'paths' AND column_name = 'title') THEN
        ALTER TABLE public.paths RENAME COLUMN name TO title;
    ELSIF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'paths' AND column_name = 'title') THEN
        ALTER TABLE public.paths ADD COLUMN title TEXT NOT NULL;
    END IF;
END$$;

-- Alter public.lessons table
ALTER TABLE public.lessons
ADD COLUMN IF NOT EXISTS base_class_id UUID REFERENCES public.base_classes(id) ON DELETE SET NULL; 
-- (order_index should already exist as NOT NULL based on previous migrations)

-- Handle created_by for lessons: drop if exists and references members, then add creator_user_id
DO $$
BEGIN
    IF EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_schema = 'public' AND table_name = 'lessons' AND column_name = 'created_by'
    ) AND EXISTS (
        SELECT 1 FROM information_schema.constraint_column_usage ccu
        JOIN information_schema.referential_constraints rc ON ccu.constraint_name = rc.constraint_name
        JOIN information_schema.table_constraints tc ON rc.unique_constraint_name = tc.constraint_name
        WHERE ccu.table_schema = 'public' AND ccu.table_name = 'lessons' AND ccu.column_name = 'created_by'
        AND tc.table_schema = 'public' AND tc.table_name = 'members' -- Check if FK references members table
    ) THEN
        ALTER TABLE public.lessons DROP COLUMN created_by;
    END IF;
END$$;
ALTER TABLE public.lessons ADD COLUMN IF NOT EXISTS creator_user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL;

-- Add comments for new columns
COMMENT ON COLUMN public.paths.base_class_id IS 'Link to the BaseClass that defines this path structure.';
COMMENT ON COLUMN public.paths.order_index IS 'Order of this path within its BaseClass curriculum outline.';
COMMENT ON COLUMN public.paths.creator_user_id IS 'User ID of the path creator (references auth.users).';
COMMENT ON COLUMN public.lessons.base_class_id IS 'Denormalized link to the BaseClass for easier querying (can also be derived via path).';
COMMENT ON COLUMN public.lessons.creator_user_id IS 'User ID of the lesson creator (references auth.users).';

COMMIT; 