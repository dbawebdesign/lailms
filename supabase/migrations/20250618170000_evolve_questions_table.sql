-- Migration script to evolve the existing 'questions' table to the new standard.

-- Step 1: Add new columns to the 'questions' table
ALTER TABLE public.questions
  ADD COLUMN IF NOT EXISTS base_class_id UUID,
  ADD COLUMN IF NOT EXISTS author_id UUID,
  ADD COLUMN IF NOT EXISTS options JSONB,
  ADD COLUMN IF NOT EXISTS answer_key JSONB,
  ADD COLUMN IF NOT EXISTS rubric JSONB;

-- Step 2: Add foreign key constraints
ALTER TABLE public.questions
  ADD CONSTRAINT fk_questions_base_class FOREIGN KEY (base_class_id) REFERENCES public.base_classes(id) ON DELETE CASCADE,
  ADD CONSTRAINT fk_questions_author FOREIGN KEY (author_id) REFERENCES public.profiles(user_id) ON DELETE SET NULL;

-- Step 3: Drop old, legacy columns that are no longer needed
ALTER TABLE public.questions
  DROP COLUMN IF EXISTS quiz_id,
  DROP COLUMN IF EXISTS question_bank_id,
  DROP COLUMN IF EXISTS points,
  DROP COLUMN IF EXISTS metadata,
  DROP COLUMN IF EXISTS difficulty_score,
  DROP COLUMN IF EXISTS cognitive_level,
  DROP COLUMN IF EXISTS ai_generated,
  DROP COLUMN IF EXISTS validation_status,
  DROP COLUMN IF EXISTS estimated_time,
  DROP COLUMN IF EXISTS lesson_content_refs,
  DROP COLUMN IF EXISTS source_content,
  DROP COLUMN IF EXISTS folder_id,
  DROP COLUMN IF EXISTS lesson_id,
  DROP COLUMN IF EXISTS correct_answer;

-- Step 4: Ensure the new question_text column is NOT NULL
-- (The old one should have been dropped in the previous step)
ALTER TABLE public.questions
  ALTER COLUMN question_text SET NOT NULL; 