-- Create paths table
CREATE TABLE public.paths (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    organisation_id UUID NOT NULL REFERENCES public.organisations(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    description TEXT,
    settings JSONB,
    created_at TIMESTAMPTZ DEFAULT now() NOT NULL,
    updated_at TIMESTAMPTZ DEFAULT now() NOT NULL
);
CREATE TRIGGER on_paths_updated BEFORE UPDATE ON public.paths FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();
CREATE INDEX idx_paths_organisation_id ON public.paths(organisation_id);

-- Create lessons table
CREATE TABLE public.lessons (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    path_id UUID NOT NULL REFERENCES public.paths(id) ON DELETE CASCADE,
    title TEXT NOT NULL,
    description TEXT,
    order_index INTEGER, -- For ordering lessons within a path
    settings JSONB,
    created_at TIMESTAMPTZ DEFAULT now() NOT NULL,
    updated_at TIMESTAMPTZ DEFAULT now() NOT NULL
);
CREATE TRIGGER on_lessons_updated BEFORE UPDATE ON public.lessons FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();
CREATE INDEX idx_lessons_path_id ON public.lessons(path_id);

-- Create lesson_sections table
CREATE TABLE public.lesson_sections (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    lesson_id UUID NOT NULL REFERENCES public.lessons(id) ON DELETE CASCADE,
    title TEXT NOT NULL,
    content JSONB, -- Using JSONB to store rich text content structure (e.g., from a block editor)
    -- content_embedding vector(1536), -- Example: For OpenAI embeddings. Enable if needed.
    order_index INTEGER, -- For ordering sections within a lesson
    settings JSONB,
    created_at TIMESTAMPTZ DEFAULT now() NOT NULL,
    updated_at TIMESTAMPTZ DEFAULT now() NOT NULL
);
CREATE TRIGGER on_lesson_sections_updated BEFORE UPDATE ON public.lesson_sections FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();
CREATE INDEX idx_lesson_sections_lesson_id ON public.lesson_sections(lesson_id);
-- CREATE INDEX idx_lesson_sections_embedding ON public.lesson_sections USING ivfflat (content_embedding vector_l2_ops) WITH (lists = 100); -- Example index if using vectors

-- Create quizzes table
CREATE TABLE public.quizzes (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    lesson_id UUID REFERENCES public.lessons(id) ON DELETE SET NULL, -- Quizzes might not belong to a specific lesson
    organisation_id UUID NOT NULL REFERENCES public.organisations(id) ON DELETE CASCADE, -- Or link to organisation
    title TEXT NOT NULL,
    description TEXT,
    settings JSONB,
    created_at TIMESTAMPTZ DEFAULT now() NOT NULL,
    updated_at TIMESTAMPTZ DEFAULT now() NOT NULL
);
CREATE TRIGGER on_quizzes_updated BEFORE UPDATE ON public.quizzes FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();
CREATE INDEX idx_quizzes_lesson_id ON public.quizzes(lesson_id);
CREATE INDEX idx_quizzes_organisation_id ON public.quizzes(organisation_id);

-- Create question_type enum
CREATE TYPE public.question_type AS ENUM ('MCQ', 'SHORT_ANSWER', 'ESSAY', 'CODING', 'MATCHING', 'FILL_IN_BLANK');

-- Create questions table
CREATE TABLE public.questions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    quiz_id UUID REFERENCES public.quizzes(id) ON DELETE CASCADE, -- Questions typically belong to a quiz
    question_bank_id UUID, -- Optional: Link to a question bank later
    organisation_id UUID NOT NULL REFERENCES public.organisations(id) ON DELETE CASCADE,
    question_text TEXT NOT NULL,
    question_type question_type NOT NULL,
    options JSONB, -- For MCQ, Matching options
    correct_answer TEXT, -- Can be simple text or JSONB for complex answers
    points NUMERIC DEFAULT 1 NOT NULL,
    settings JSONB,
    created_at TIMESTAMPTZ DEFAULT now() NOT NULL,
    updated_at TIMESTAMPTZ DEFAULT now() NOT NULL
);
CREATE TRIGGER on_questions_updated BEFORE UPDATE ON public.questions FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();
CREATE INDEX idx_questions_quiz_id ON public.questions(quiz_id);
CREATE INDEX idx_questions_organisation_id ON public.questions(organisation_id);

-- Create submissions table
CREATE TABLE public.submissions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    quiz_id UUID NOT NULL REFERENCES public.quizzes(id) ON DELETE CASCADE,
    member_id UUID NOT NULL REFERENCES public.members(id) ON DELETE CASCADE,
    answers JSONB NOT NULL, -- Store submitted answers (e.g., {"question_id": "answer"})
    score NUMERIC,
    submitted_at TIMESTAMPTZ DEFAULT now() NOT NULL,
    graded_at TIMESTAMPTZ,
    feedback TEXT, -- Or JSONB for structured feedback
    settings JSONB,
    created_at TIMESTAMPTZ DEFAULT now() NOT NULL,
    updated_at TIMESTAMPTZ DEFAULT now() NOT NULL,
    UNIQUE (quiz_id, member_id) -- Allow only one submission per member per quiz (adjust if multiple attempts allowed)
);
CREATE TRIGGER on_submissions_updated BEFORE UPDATE ON public.submissions FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();
CREATE INDEX idx_submissions_quiz_id ON public.submissions(quiz_id);
CREATE INDEX idx_submissions_member_id ON public.submissions(member_id);

-- Note: Triggers for maintaining order_index are deferred.
-- Note: Vector embedding columns/indexes are commented out, enable if needed. 