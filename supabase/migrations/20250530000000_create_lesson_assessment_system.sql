-- Migration: Create Lesson-Level Assessment System
-- Purpose: Restructure questions and assessments from base class level to lesson level
-- Date: 2025-05-30
-- Supports: Educational mastery learning progression

-- 1. Create assessment_type enum for different types of assessments
CREATE TYPE public.assessment_type AS ENUM (
  'practice',      -- Practice questions for formative assessment
  'lesson_quiz',   -- End-of-lesson quiz for summative assessment
  'path_exam',     -- Path-level comprehensive exam
  'final_exam',    -- Base class final comprehensive exam
  'diagnostic',    -- Pre-assessment to gauge prior knowledge
  'benchmark'      -- Periodic assessment to track progress
);

-- 2. Create lesson_assessments table
CREATE TABLE IF NOT EXISTS public.lesson_assessments (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    lesson_id UUID NOT NULL REFERENCES public.lessons(id) ON DELETE CASCADE,
    title TEXT NOT NULL,
    description TEXT,
    assessment_type public.assessment_type NOT NULL DEFAULT 'lesson_quiz',
    passing_score INTEGER DEFAULT 70, -- Percentage required to pass
    time_limit INTEGER, -- Time limit in minutes, NULL = no limit
    max_attempts INTEGER DEFAULT 3, -- Maximum attempts allowed
    randomize_questions BOOLEAN DEFAULT true,
    show_results_immediately BOOLEAN DEFAULT true,
    learning_objectives TEXT[], -- Array of learning objectives
    metadata JSONB DEFAULT '{}'::jsonb,
    is_active BOOLEAN DEFAULT true,
    created_by UUID REFERENCES public.members(id) ON DELETE SET NULL,
    created_at TIMESTAMPTZ DEFAULT now() NOT NULL,
    updated_at TIMESTAMPTZ DEFAULT now() NOT NULL
);

-- 3. Create path_assessments table
CREATE TABLE IF NOT EXISTS public.path_assessments (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    path_id UUID NOT NULL REFERENCES public.paths(id) ON DELETE CASCADE,
    title TEXT NOT NULL,
    description TEXT,
    assessment_type public.assessment_type NOT NULL DEFAULT 'path_exam',
    passing_score INTEGER DEFAULT 75, -- Higher passing score for path exams
    time_limit INTEGER, -- Time limit in minutes
    max_attempts INTEGER DEFAULT 2, -- Fewer attempts for path exams
    randomize_questions BOOLEAN DEFAULT true,
    prerequisite_lesson_completion BOOLEAN DEFAULT true, -- Must complete all lessons first
    learning_objectives TEXT[],
    metadata JSONB DEFAULT '{}'::jsonb,
    is_active BOOLEAN DEFAULT true,
    created_by UUID REFERENCES public.members(id) ON DELETE SET NULL,
    created_at TIMESTAMPTZ DEFAULT now() NOT NULL,
    updated_at TIMESTAMPTZ DEFAULT now() NOT NULL
);

-- 4. Create class_assessments table (final exams)
CREATE TABLE IF NOT EXISTS public.class_assessments (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    base_class_id UUID NOT NULL REFERENCES public.base_classes(id) ON DELETE CASCADE,
    title TEXT NOT NULL,
    description TEXT,
    assessment_type public.assessment_type NOT NULL DEFAULT 'final_exam',
    passing_score INTEGER DEFAULT 80, -- Highest passing score for final exams
    time_limit INTEGER, -- Time limit in minutes
    max_attempts INTEGER DEFAULT 1, -- Usually only one attempt for final exams
    randomize_questions BOOLEAN DEFAULT true,
    prerequisite_path_completion BOOLEAN DEFAULT true, -- Must complete all paths first
    learning_objectives TEXT[],
    metadata JSONB DEFAULT '{}'::jsonb,
    is_active BOOLEAN DEFAULT true,
    created_by UUID REFERENCES public.members(id) ON DELETE SET NULL,
    created_at TIMESTAMPTZ DEFAULT now() NOT NULL,
    updated_at TIMESTAMPTZ DEFAULT now() NOT NULL
);

-- 5. Create lesson_questions table (questions specific to lessons)
CREATE TABLE IF NOT EXISTS public.lesson_questions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    lesson_id UUID NOT NULL REFERENCES public.lessons(id) ON DELETE CASCADE,
    assessment_id UUID REFERENCES public.lesson_assessments(id) ON DELETE CASCADE, -- Optional: link to specific assessment
    question_text TEXT NOT NULL,
    question_type TEXT NOT NULL, -- 'multiple_choice', 'true_false', 'short_answer', 'essay', 'fill_in_blank'
    points INTEGER DEFAULT 1,
    difficulty_level TEXT NOT NULL DEFAULT 'medium', -- 'easy', 'medium', 'hard'
    bloom_taxonomy TEXT NOT NULL DEFAULT 'understand', -- 'remember', 'understand', 'apply', 'analyze', 'evaluate', 'create'
    learning_objectives TEXT[], -- Which objectives this question assesses
    tags TEXT[], -- Tags for categorization
    estimated_time INTEGER DEFAULT 2, -- Estimated time in minutes
    order_index INTEGER DEFAULT 0,
    metadata JSONB DEFAULT '{}'::jsonb,
    is_active BOOLEAN DEFAULT true,
    created_by UUID REFERENCES public.members(id) ON DELETE SET NULL,
    created_at TIMESTAMPTZ DEFAULT now() NOT NULL,
    updated_at TIMESTAMPTZ DEFAULT now() NOT NULL
);

-- 6. Create lesson_question_options table
CREATE TABLE IF NOT EXISTS public.lesson_question_options (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    question_id UUID NOT NULL REFERENCES public.lesson_questions(id) ON DELETE CASCADE,
    option_text TEXT NOT NULL,
    is_correct BOOLEAN NOT NULL DEFAULT false,
    explanation TEXT, -- Explanation for why this option is correct/incorrect
    order_index INTEGER DEFAULT 0,
    created_at TIMESTAMPTZ DEFAULT now() NOT NULL,
    updated_at TIMESTAMPTZ DEFAULT now() NOT NULL
);

-- 7. Create assessment_attempts table (unified for all assessment types)
CREATE TABLE IF NOT EXISTS public.assessment_attempts (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    member_id UUID NOT NULL REFERENCES public.members(id) ON DELETE CASCADE,
    assessment_type public.assessment_type NOT NULL,
    assessment_id UUID NOT NULL, -- References lesson_assessments, path_assessments, or class_assessments
    lesson_id UUID REFERENCES public.lessons(id) ON DELETE CASCADE, -- For lesson assessments
    path_id UUID REFERENCES public.paths(id) ON DELETE CASCADE, -- For path assessments
    base_class_id UUID REFERENCES public.base_classes(id) ON DELETE CASCADE, -- For class assessments
    attempt_number INTEGER NOT NULL DEFAULT 1,
    started_at TIMESTAMPTZ DEFAULT now() NOT NULL,
    completed_at TIMESTAMPTZ,
    time_spent INTEGER, -- Time spent in minutes
    total_questions INTEGER NOT NULL DEFAULT 0,
    correct_answers INTEGER DEFAULT 0,
    score DECIMAL(5,2), -- Percentage score
    passed BOOLEAN, -- NULL until completed
    feedback TEXT, -- Optional feedback from instructor
    metadata JSONB DEFAULT '{}'::jsonb,
    created_at TIMESTAMPTZ DEFAULT now() NOT NULL,
    updated_at TIMESTAMPTZ DEFAULT now() NOT NULL
);

-- 8. Create assessment_responses table (unified for all question responses)
CREATE TABLE IF NOT EXISTS public.assessment_responses (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    attempt_id UUID NOT NULL REFERENCES public.assessment_attempts(id) ON DELETE CASCADE,
    question_id UUID NOT NULL, -- References lesson_questions, or legacy questions
    question_type TEXT NOT NULL,
    selected_options UUID[], -- Array of selected option IDs
    text_response TEXT, -- For open-ended questions
    is_correct BOOLEAN,
    points_awarded DECIMAL(4,2) DEFAULT 0,
    time_spent INTEGER, -- Time spent on this question in seconds
    metadata JSONB DEFAULT '{}'::jsonb,
    created_at TIMESTAMPTZ DEFAULT now() NOT NULL,
    updated_at TIMESTAMPTZ DEFAULT now() NOT NULL
);

-- 9. Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_lesson_assessments_lesson_id ON public.lesson_assessments(lesson_id);
CREATE INDEX IF NOT EXISTS idx_lesson_assessments_type ON public.lesson_assessments(assessment_type);
CREATE INDEX IF NOT EXISTS idx_path_assessments_path_id ON public.path_assessments(path_id);
CREATE INDEX IF NOT EXISTS idx_class_assessments_base_class_id ON public.class_assessments(base_class_id);
CREATE INDEX IF NOT EXISTS idx_lesson_questions_lesson_id ON public.lesson_questions(lesson_id);
CREATE INDEX IF NOT EXISTS idx_lesson_questions_assessment_id ON public.lesson_questions(assessment_id);
CREATE INDEX IF NOT EXISTS idx_lesson_questions_difficulty ON public.lesson_questions(difficulty_level);
CREATE INDEX IF NOT EXISTS idx_lesson_questions_bloom ON public.lesson_questions(bloom_taxonomy);
CREATE INDEX IF NOT EXISTS idx_lesson_question_options_question_id ON public.lesson_question_options(question_id);
CREATE INDEX IF NOT EXISTS idx_assessment_attempts_member_id ON public.assessment_attempts(member_id);
CREATE INDEX IF NOT EXISTS idx_assessment_attempts_assessment ON public.assessment_attempts(assessment_type, assessment_id);
CREATE INDEX IF NOT EXISTS idx_assessment_responses_attempt_id ON public.assessment_responses(attempt_id);
CREATE INDEX IF NOT EXISTS idx_assessment_responses_question_id ON public.assessment_responses(question_id);

-- 10. Create unique constraints
ALTER TABLE public.lesson_questions ADD CONSTRAINT unique_lesson_question_order 
    UNIQUE (lesson_id, assessment_id, order_index);
ALTER TABLE public.lesson_question_options ADD CONSTRAINT unique_option_order 
    UNIQUE (question_id, order_index);

-- 11. Add triggers for updated_at timestamps
CREATE TRIGGER on_lesson_assessments_updated BEFORE UPDATE ON public.lesson_assessments 
    FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();
CREATE TRIGGER on_path_assessments_updated BEFORE UPDATE ON public.path_assessments 
    FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();
CREATE TRIGGER on_class_assessments_updated BEFORE UPDATE ON public.class_assessments 
    FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();
CREATE TRIGGER on_lesson_questions_updated BEFORE UPDATE ON public.lesson_questions 
    FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();
CREATE TRIGGER on_lesson_question_options_updated BEFORE UPDATE ON public.lesson_question_options 
    FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();
CREATE TRIGGER on_assessment_attempts_updated BEFORE UPDATE ON public.assessment_attempts 
    FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();
CREATE TRIGGER on_assessment_responses_updated BEFORE UPDATE ON public.assessment_responses 
    FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

-- 12. Create RLS policies (basic setup - can be refined later)
ALTER TABLE public.lesson_assessments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.path_assessments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.class_assessments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.lesson_questions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.lesson_question_options ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.assessment_attempts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.assessment_responses ENABLE ROW LEVEL SECURITY;

-- Basic RLS policies (teachers can manage, students can view/attempt)
CREATE POLICY "Teachers can manage lesson assessments" ON public.lesson_assessments
    FOR ALL USING (
        EXISTS (
            SELECT 1 FROM public.members m
            JOIN public.lessons l ON l.id = lesson_id
            JOIN public.paths p ON p.id = l.path_id
            WHERE m.id = auth.uid() 
            AND p.base_class_id IN (
                SELECT bc.id FROM public.base_classes bc
                WHERE bc.organisation_id = m.organisation_id
                AND m.role IN ('teacher', 'admin', 'super_admin')
            )
        )
    );

CREATE POLICY "Students can view active lesson assessments" ON public.lesson_assessments
    FOR SELECT USING (
        is_active = true AND
        EXISTS (
            SELECT 1 FROM public.members m
            JOIN public.rosters r ON r.member_id = m.id
            JOIN public.class_instances ci ON ci.id = r.class_instance_id
            JOIN public.lessons l ON l.id = lesson_id
            JOIN public.paths p ON p.id = l.path_id
            WHERE m.id = auth.uid() 
            AND ci.base_class_id = p.base_class_id
        )
    );

-- Similar policies for other tables (simplified for brevity)
CREATE POLICY "Assessment attempts policy" ON public.assessment_attempts
    FOR ALL USING (
        member_id = auth.uid() OR
        EXISTS (
            SELECT 1 FROM public.members m
            WHERE m.id = auth.uid() 
            AND m.role IN ('teacher', 'admin', 'super_admin')
        )
    );

-- 13. Add comments for documentation
COMMENT ON TABLE public.lesson_assessments IS 'Assessments specific to individual lessons for formative and summative evaluation';
COMMENT ON TABLE public.path_assessments IS 'Comprehensive assessments for learning paths covering multiple lessons';
COMMENT ON TABLE public.class_assessments IS 'Final comprehensive assessments for entire base classes';
COMMENT ON TABLE public.lesson_questions IS 'Questions tied to specific lessons for targeted assessment';
COMMENT ON TABLE public.assessment_attempts IS 'Student attempts at various types of assessments';
COMMENT ON TABLE public.assessment_responses IS 'Individual question responses within assessment attempts';

COMMENT ON COLUMN public.lesson_questions.bloom_taxonomy IS 'Blooms Taxonomy level: remember, understand, apply, analyze, evaluate, create';
COMMENT ON COLUMN public.lesson_questions.difficulty_level IS 'Question difficulty: easy, medium, hard';
COMMENT ON COLUMN public.assessment_attempts.assessment_id IS 'Generic reference to lesson_assessments, path_assessments, or class_assessments.id'; 