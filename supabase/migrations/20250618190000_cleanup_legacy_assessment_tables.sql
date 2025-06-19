-- Migration script to drop the legacy assessment tables.
-- These tables are no longer needed after the new unified assessment system is in place.

DROP TABLE IF EXISTS public.lesson_questions CASCADE;
DROP TABLE IF EXISTS public.class_assessments CASCADE;
DROP TABLE IF EXISTS public.path_assessments CASCADE;
DROP TABLE IF EXISTS public.lesson_assessments CASCADE; 