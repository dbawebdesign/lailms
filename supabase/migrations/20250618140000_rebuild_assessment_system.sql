-- Migration script for rebuilding the assessment system
-- This script creates new unified tables for questions and assessments,
-- and modifies the base_classes table.

-- Step 1: Create ENUM types for question and assessment types
-- This ensures data consistency for these fields.

DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'question_type') THEN
        CREATE TYPE public.question_type AS ENUM (
            'multiple_choice', 
            'true_false', 
            'short_answer', 
            'long_answer', 
            'coding'
        );
    END IF;
END$$;

DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'assessment_type') THEN
        CREATE TYPE public.assessment_type AS ENUM (
            'quiz', 
            'exam', 
            'assignment', 
            'practice'
        );
    END IF;
END$$;

-- Step 2: Create the new unified 'questions' table
-- This table will serve as the central repository for all questions.

CREATE TABLE IF NOT EXISTS public.questions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    base_class_id UUID NOT NULL REFERENCES public.base_classes(id) ON DELETE CASCADE,
    author_id UUID REFERENCES public.profiles(user_id) ON DELETE SET NULL,

    question_text TEXT NOT NULL,
    question_type public.question_type NOT NULL,
    
    -- Flexible JSONB for storing question options (e.g., for multiple choice)
    options JSONB,

    -- Flexible JSONB for the answer key to support various question types
    answer_key JSONB,

    -- JSONB for storing detailed grading rubrics, especially for free-text answers
    rubric JSONB,

    -- Points, difficulty, and metadata
    points INTEGER DEFAULT 10,
    difficulty_level INTEGER,
    tags TEXT[],
    learning_objectives TEXT[],

    -- Timestamps
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_questions_base_class_id ON public.questions(base_class_id);
CREATE INDEX IF NOT EXISTS idx_questions_author_id ON public.questions(author_id);
CREATE INDEX IF NOT EXISTS idx_questions_tags ON public.questions USING GIN(tags);


-- Step 3: Create the new unified 'assessments' table
-- This table defines an assessment instance.

CREATE TABLE IF NOT EXISTS public.assessments (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    base_class_id UUID NOT NULL REFERENCES public.base_classes(id) ON DELETE CASCADE,
    lesson_id UUID REFERENCES public.lessons(id) ON DELETE SET NULL,
    path_id UUID REFERENCES public.paths(id) ON DELETE SET NULL,
    
    title TEXT NOT NULL,
    description TEXT,
    assessment_type public.assessment_type NOT NULL,
    
    -- JSONB for settings like time limits, attempts, etc.
    settings JSONB,

    -- Timestamps
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_assessments_base_class_id ON public.assessments(base_class_id);
CREATE INDEX IF NOT EXISTS idx_assessments_lesson_id ON public.assessments(lesson_id);
CREATE INDEX IF NOT EXISTS idx_assessments_path_id ON public.assessments(path_id);


-- Step 4: Create the junction table for assessments and questions
-- This table creates the many-to-many relationship.

CREATE TABLE IF NOT EXISTS public.assessment_questions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    assessment_id UUID,
    question_id UUID,
    display_order INTEGER,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE public.assessment_questions 
  ADD CONSTRAINT fk_assessment_id FOREIGN KEY (assessment_id) REFERENCES public.assessments(id) ON DELETE CASCADE,
  ADD CONSTRAINT fk_question_id FOREIGN KEY (question_id) REFERENCES public.questions(id) ON DELETE CASCADE;


-- Step 5: Modify the 'base_classes' table
-- Add a JSONB column for course-level assessment configurations.

ALTER TABLE public.base_classes
ADD COLUMN IF NOT EXISTS assessment_config JSONB;

-- End of migration script 