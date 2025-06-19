-- Rollback script for the assessment system changes.
-- This script will drop the new tables, types, and remove the added column.
-- It should only be run if the migration fails and a rollback is necessary.

-- Step 1: Drop the junction table
DROP TABLE IF EXISTS public.assessment_questions;

-- Step 2: Drop the main assessment and question tables
DROP TABLE IF EXISTS public.assessments;
DROP TABLE IF EXISTS public.questions;

-- Step 3: Drop the ENUM types
DROP TYPE IF EXISTS public.assessment_type;
DROP TYPE IF EXISTS public.question_type;

-- Step 4: Remove the column from base_classes
ALTER TABLE public.base_classes
DROP COLUMN IF EXISTS assessment_config;

-- Note: This script does NOT restore the data that was migrated.
-- It only reverts the schema changes. Data restoration should be
-- handled by restoring the database from the pre-migration backup. 