-- Consolidated schema migration for Learnology.ai
-- Arranges all tables in proper dependency order

-- Enable pgvector extension
CREATE EXTENSION IF NOT EXISTS vector WITH SCHEMA extensions;

-- Create types first
DO $$ 
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'user_role') THEN
        CREATE TYPE public.user_role AS ENUM ('SUPER_ADMIN', 'ADMIN', 'TEACHER', 'STUDENT', 'PARENT');
    END IF;
    
    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'audit_action') THEN
        CREATE TYPE public.audit_action AS ENUM ('INSERT', 'UPDATE', 'DELETE');
    END IF;
    
    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'role') THEN
        CREATE TYPE public.role AS ENUM ('super_admin', 'admin', 'teacher', 'student', 'parent');
    END IF;
END
$$;

-- 1. Create organisations table first (core dependency)
CREATE TABLE IF NOT EXISTS public.organisations (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT NOT NULL,
    abbreviation TEXT UNIQUE, 
    abbr TEXT UNIQUE, -- Also have this alias in some code
    settings JSONB,
    created_at TIMESTAMPTZ DEFAULT now() NOT NULL,
    updated_at TIMESTAMPTZ DEFAULT now() NOT NULL
);

-- 2. Create organisation_units table
CREATE TABLE IF NOT EXISTS public.organisation_units (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organisation_id uuid REFERENCES public.organisations(id) ON DELETE CASCADE,
  name text NOT NULL,
  created_at timestamptz DEFAULT now() NOT NULL,
  updated_at timestamptz DEFAULT now() NOT NULL
);

-- 3. Create profiles/members table
CREATE TABLE IF NOT EXISTS public.members (
    id UUID PRIMARY KEY NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    organisation_id UUID REFERENCES public.organisations(id) ON DELETE SET NULL,
    email TEXT UNIQUE,
    username TEXT UNIQUE,
    first_name TEXT,
    last_name TEXT,
    role user_role NOT NULL,
    grade_level TEXT,
    settings JSONB,
    created_at TIMESTAMPTZ DEFAULT now() NOT NULL,
    updated_at TIMESTAMPTZ DEFAULT now() NOT NULL
);

-- Alternative profile table used in some code
CREATE TABLE IF NOT EXISTS public.profiles (
  user_id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  username text UNIQUE NOT NULL,
  first_name text,
  last_name text,
  grade_level text,
  role public.role NOT NULL,
  organisation_id uuid REFERENCES public.organisations(id),
  settings jsonb,
  created_at timestamptz DEFAULT now() NOT NULL,
  updated_at timestamptz DEFAULT now() NOT NULL
);

-- 4. Create invite_codes table
CREATE TABLE IF NOT EXISTS public.invite_codes (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    code TEXT UNIQUE NOT NULL DEFAULT substring(md5(random()::text) for 10),
    organisation_id UUID NOT NULL REFERENCES public.organisations(id) ON DELETE CASCADE,
    role user_role NOT NULL,
    expires_at TIMESTAMPTZ,
    created_by UUID REFERENCES public.members(id) ON DELETE SET NULL,
    created_at TIMESTAMPTZ DEFAULT now() NOT NULL,
    updated_at TIMESTAMPTZ DEFAULT now() NOT NULL
);

-- 5. Create base_classes table
CREATE TABLE IF NOT EXISTS public.base_classes (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    organisation_id UUID NOT NULL REFERENCES public.organisations(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    description TEXT,
    settings JSONB,
    created_at TIMESTAMPTZ DEFAULT now() NOT NULL,
    updated_at TIMESTAMPTZ DEFAULT now() NOT NULL
);

-- 6. Create class_instances table
CREATE TABLE IF NOT EXISTS public.class_instances (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    base_class_id UUID NOT NULL REFERENCES public.base_classes(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    enrollment_code TEXT UNIQUE NOT NULL DEFAULT substring(md5(random()::text) for 8),
    start_date DATE,
    end_date DATE,
    settings JSONB,
    created_at TIMESTAMPTZ DEFAULT now() NOT NULL,
    updated_at TIMESTAMPTZ DEFAULT now() NOT NULL
);

-- 7. Create rosters table
CREATE TABLE IF NOT EXISTS public.rosters (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    class_instance_id UUID NOT NULL REFERENCES public.class_instances(id) ON DELETE CASCADE,
    member_id UUID NOT NULL REFERENCES public.members(id) ON DELETE CASCADE,
    role user_role NOT NULL,
    joined_at TIMESTAMPTZ DEFAULT now() NOT NULL,
    settings JSONB,
    created_at TIMESTAMPTZ DEFAULT now() NOT NULL,
    updated_at TIMESTAMPTZ DEFAULT now() NOT NULL,
    UNIQUE (class_instance_id, member_id)
);

-- 8. Create audit_logs table
CREATE TABLE IF NOT EXISTS public.audit_logs (
    id BIGSERIAL PRIMARY KEY,
    table_name TEXT NOT NULL,
    record_id TEXT,
    action audit_action NOT NULL,
    old_data JSONB,
    new_data JSONB,
    performed_by UUID REFERENCES public.members(id) ON DELETE SET NULL,
    performed_at TIMESTAMPTZ DEFAULT now() NOT NULL
);

-- 9. Create paths table
CREATE TABLE IF NOT EXISTS public.paths (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    organisation_id UUID NOT NULL REFERENCES public.organisations(id) ON DELETE CASCADE,
    title TEXT NOT NULL,
    description TEXT,
    banner_image TEXT,
    level TEXT,  -- e.g. "Beginner", "Intermediate"
    published BOOLEAN DEFAULT FALSE,
    created_by UUID REFERENCES public.members(id) ON DELETE SET NULL,
    created_at TIMESTAMPTZ DEFAULT now() NOT NULL,
    updated_at TIMESTAMPTZ DEFAULT now() NOT NULL
);

-- 10. Create lessons table
CREATE TABLE IF NOT EXISTS public.lessons (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    path_id UUID NOT NULL REFERENCES public.paths(id) ON DELETE CASCADE,
    title TEXT NOT NULL,
    description TEXT,
    level TEXT,
    banner_image TEXT,
    order_index INTEGER NOT NULL,
    published BOOLEAN DEFAULT FALSE,
    estimated_time INTEGER, -- in minutes
    created_by UUID REFERENCES public.members(id) ON DELETE SET NULL,
    created_at TIMESTAMPTZ DEFAULT now() NOT NULL,
    updated_at TIMESTAMPTZ DEFAULT now() NOT NULL
);

-- 11. Create lesson_sections table
CREATE TABLE IF NOT EXISTS public.lesson_sections (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    lesson_id UUID NOT NULL REFERENCES public.lessons(id) ON DELETE CASCADE,
    title TEXT NOT NULL,
    content TEXT,
    content_embedding vector(1536),
    media_url TEXT,
    order_index INTEGER NOT NULL,
    section_type TEXT NOT NULL, -- e.g. "text", "video", "quiz"
    created_by UUID REFERENCES public.members(id) ON DELETE SET NULL,
    created_at TIMESTAMPTZ DEFAULT now() NOT NULL,
    updated_at TIMESTAMPTZ DEFAULT now() NOT NULL
);

-- 12. Create quizzes table
CREATE TABLE IF NOT EXISTS public.quizzes (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    lesson_id UUID REFERENCES public.lessons(id) ON DELETE CASCADE,
    title TEXT NOT NULL,
    description TEXT,
    time_limit INTEGER, -- in minutes, NULL for no time limit
    pass_threshold INTEGER, -- percentage needed to pass
    shuffle_questions BOOLEAN DEFAULT FALSE,
    created_by UUID REFERENCES public.members(id) ON DELETE SET NULL,
    created_at TIMESTAMPTZ DEFAULT now() NOT NULL,
    updated_at TIMESTAMPTZ DEFAULT now() NOT NULL
);

-- 13. Create questions table
CREATE TABLE IF NOT EXISTS public.questions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    quiz_id UUID NOT NULL REFERENCES public.quizzes(id) ON DELETE CASCADE,
    question_text TEXT NOT NULL,
    question_type TEXT NOT NULL, -- e.g. "multiple_choice", "true_false", "free_response"
    points INTEGER DEFAULT 1,
    order_index INTEGER,
    created_by UUID REFERENCES public.members(id) ON DELETE SET NULL,
    created_at TIMESTAMPTZ DEFAULT now() NOT NULL,
    updated_at TIMESTAMPTZ DEFAULT now() NOT NULL
);

-- 14. Create question_options table
CREATE TABLE IF NOT EXISTS public.question_options (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    question_id UUID NOT NULL REFERENCES public.questions(id) ON DELETE CASCADE,
    option_text TEXT NOT NULL,
    is_correct BOOLEAN NOT NULL,
    order_index INTEGER,
    created_at TIMESTAMPTZ DEFAULT now() NOT NULL,
    updated_at TIMESTAMPTZ DEFAULT now() NOT NULL
);

-- 15. Create quiz_attempts table
CREATE TABLE IF NOT EXISTS public.quiz_attempts (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    quiz_id UUID NOT NULL REFERENCES public.quizzes(id) ON DELETE CASCADE,
    member_id UUID NOT NULL REFERENCES public.members(id) ON DELETE CASCADE,
    started_at TIMESTAMPTZ DEFAULT now() NOT NULL,
    completed_at TIMESTAMPTZ,
    score INTEGER, -- NULL until completed
    passed BOOLEAN, -- NULL until completed
    created_at TIMESTAMPTZ DEFAULT now() NOT NULL,
    updated_at TIMESTAMPTZ DEFAULT now() NOT NULL
);

-- 16. Create quiz_responses table
CREATE TABLE IF NOT EXISTS public.quiz_responses (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    attempt_id UUID NOT NULL REFERENCES public.quiz_attempts(id) ON DELETE CASCADE,
    question_id UUID NOT NULL REFERENCES public.questions(id) ON DELETE CASCADE,
    selected_options UUID[], -- Array of chosen question_options ids
    text_response TEXT, -- For free response questions
    is_correct BOOLEAN,
    points_awarded INTEGER,
    created_at TIMESTAMPTZ DEFAULT now() NOT NULL,
    updated_at TIMESTAMPTZ DEFAULT now() NOT NULL
);

-- 17. Create progress table
CREATE TABLE IF NOT EXISTS public.progress (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    member_id UUID NOT NULL REFERENCES public.members(id) ON DELETE CASCADE,
    item_type TEXT NOT NULL, -- e.g. "path", "lesson", "section"
    item_id UUID NOT NULL,
    status TEXT NOT NULL, -- e.g. "not_started", "in_progress", "completed"
    progress_percentage INTEGER DEFAULT 0,
    last_position TEXT, -- For storing position in content
    created_at TIMESTAMPTZ DEFAULT now() NOT NULL,
    updated_at TIMESTAMPTZ DEFAULT now() NOT NULL,
    UNIQUE (member_id, item_type, item_id)
);

-- 18. Create password_reset_requests table
CREATE TABLE IF NOT EXISTS public.password_reset_requests (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    email TEXT NOT NULL,
    reset_token TEXT NOT NULL,
    expires_at TIMESTAMPTZ NOT NULL,
    fulfilled_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT now() NOT NULL
);

-- Create vector index for efficient similarity search
CREATE INDEX IF NOT EXISTS idx_lesson_sections_embedding ON public.lesson_sections 
USING ivfflat (content_embedding vector_l2_ops) WITH (lists = 100);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_members_organisation_id ON public.members(organisation_id);
CREATE INDEX IF NOT EXISTS idx_members_email ON public.members(email);
CREATE INDEX IF NOT EXISTS idx_members_username ON public.members(username);
CREATE INDEX IF NOT EXISTS idx_invite_codes_organisation_id ON public.invite_codes(organisation_id);
CREATE INDEX IF NOT EXISTS idx_invite_codes_code ON public.invite_codes(code);
CREATE INDEX IF NOT EXISTS idx_invite_codes_created_by ON public.invite_codes(created_by);
CREATE INDEX IF NOT EXISTS idx_base_classes_organisation_id ON public.base_classes(organisation_id);
CREATE INDEX IF NOT EXISTS idx_class_instances_base_class_id ON public.class_instances(base_class_id);
CREATE INDEX IF NOT EXISTS idx_class_instances_enrollment_code ON public.class_instances(enrollment_code);
CREATE INDEX IF NOT EXISTS idx_rosters_class_instance_id ON public.rosters(class_instance_id);
CREATE INDEX IF NOT EXISTS idx_rosters_member_id ON public.rosters(member_id);
CREATE INDEX IF NOT EXISTS idx_audit_logs_table_record ON public.audit_logs(table_name, record_id);
CREATE INDEX IF NOT EXISTS idx_audit_logs_performed_by ON public.audit_logs(performed_by);
CREATE INDEX IF NOT EXISTS idx_paths_organisation_id ON public.paths(organisation_id);
CREATE INDEX IF NOT EXISTS idx_lessons_path_id ON public.lessons(path_id);
CREATE INDEX IF NOT EXISTS idx_lesson_sections_lesson_id ON public.lesson_sections(lesson_id);
CREATE INDEX IF NOT EXISTS idx_quizzes_lesson_id ON public.quizzes(lesson_id);
CREATE INDEX IF NOT EXISTS idx_questions_quiz_id ON public.questions(quiz_id);
CREATE INDEX IF NOT EXISTS idx_question_options_question_id ON public.question_options(question_id);
CREATE INDEX IF NOT EXISTS idx_quiz_attempts_quiz_id ON public.quiz_attempts(quiz_id);
CREATE INDEX IF NOT EXISTS idx_quiz_attempts_member_id ON public.quiz_attempts(member_id);
CREATE INDEX IF NOT EXISTS idx_quiz_responses_attempt_id ON public.quiz_responses(attempt_id);
CREATE INDEX IF NOT EXISTS idx_quiz_responses_question_id ON public.quiz_responses(question_id);
CREATE INDEX IF NOT EXISTS idx_progress_member_id ON public.progress(member_id);
CREATE INDEX IF NOT EXISTS idx_progress_item ON public.progress(item_type, item_id);
CREATE INDEX IF NOT EXISTS idx_password_reset_requests_email ON public.password_reset_requests(email);
CREATE INDEX IF NOT EXISTS idx_password_reset_requests_token ON public.password_reset_requests(reset_token);

-- Trigger function for updated_at timestamps
CREATE OR REPLACE FUNCTION public.handle_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Apply timestamp triggers to tables
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'on_organisations_updated') THEN
        CREATE TRIGGER on_organisations_updated BEFORE UPDATE ON public.organisations 
        FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();
    END IF;

    IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'on_members_updated') THEN
        CREATE TRIGGER on_members_updated BEFORE UPDATE ON public.members 
        FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();
    END IF;

    IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'on_profiles_updated') THEN
        CREATE TRIGGER on_profiles_updated BEFORE UPDATE ON public.profiles 
        FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();
    END IF;

    IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'on_invite_codes_updated') THEN
        CREATE TRIGGER on_invite_codes_updated BEFORE UPDATE ON public.invite_codes 
        FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();
    END IF;

    IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'on_base_classes_updated') THEN
        CREATE TRIGGER on_base_classes_updated BEFORE UPDATE ON public.base_classes 
        FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();
    END IF;

    IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'on_class_instances_updated') THEN
        CREATE TRIGGER on_class_instances_updated BEFORE UPDATE ON public.class_instances 
        FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();
    END IF;

    IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'on_rosters_updated') THEN
        CREATE TRIGGER on_rosters_updated BEFORE UPDATE ON public.rosters 
        FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();
    END IF;

    IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'on_paths_updated') THEN
        CREATE TRIGGER on_paths_updated BEFORE UPDATE ON public.paths 
        FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();
    END IF;

    IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'on_lessons_updated') THEN
        CREATE TRIGGER on_lessons_updated BEFORE UPDATE ON public.lessons 
        FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();
    END IF;

    IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'on_lesson_sections_updated') THEN
        CREATE TRIGGER on_lesson_sections_updated BEFORE UPDATE ON public.lesson_sections 
        FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();
    END IF;

    IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'on_quizzes_updated') THEN
        CREATE TRIGGER on_quizzes_updated BEFORE UPDATE ON public.quizzes 
        FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();
    END IF;

    IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'on_questions_updated') THEN
        CREATE TRIGGER on_questions_updated BEFORE UPDATE ON public.questions 
        FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();
    END IF;

    IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'on_question_options_updated') THEN
        CREATE TRIGGER on_question_options_updated BEFORE UPDATE ON public.question_options 
        FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();
    END IF;

    IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'on_quiz_attempts_updated') THEN
        CREATE TRIGGER on_quiz_attempts_updated BEFORE UPDATE ON public.quiz_attempts 
        FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();
    END IF;

    IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'on_quiz_responses_updated') THEN
        CREATE TRIGGER on_quiz_responses_updated BEFORE UPDATE ON public.quiz_responses 
        FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();
    END IF;

    IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'on_progress_updated') THEN
        CREATE TRIGGER on_progress_updated BEFORE UPDATE ON public.progress 
        FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();
    END IF;
END
$$;

-- SQL helper function to build invite code strings
CREATE OR REPLACE FUNCTION public.build_invite_code(
    _role public.role,
    _seq integer,
    _abbr text,
    _student_seq integer DEFAULT NULL
) RETURNS text LANGUAGE sql AS $$
    SELECT
        CASE _role
            WHEN 'super_admin' THEN FORMAT('SAU-%03s-%s', _seq, _abbr)
            WHEN 'admin'        THEN FORMAT('AU-%03s-%s',  _seq, _abbr)
            WHEN 'teacher'      THEN FORMAT('TU-%03s-%s',  _seq, _abbr)
            WHEN 'student'      THEN FORMAT('SU-%03s-%s',  _seq, _abbr)
            WHEN 'parent'       THEN FORMAT(
                                    'PU-%03s-%s-U%03s',
                                    _seq, _abbr, COALESCE(_student_seq, 1)
                                  )
        END;
$$;

-- Trigger function to generate codes when an organisation is inserted
CREATE OR REPLACE FUNCTION public.generate_org_codes()
RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE
    base_seq int := 1;
    parent_seq int := 1;
BEGIN
    -- Ensure abbr is not null for code generation
    IF NEW.abbr IS NULL THEN
        -- Try using abbreviation field if abbr is null
        IF NEW.abbreviation IS NOT NULL THEN
            NEW.abbr := NEW.abbreviation;
        ELSE
            RAISE EXCEPTION 'Organisation abbreviation (abbr) cannot be null';
        END IF;
    END IF;

    -- Super-Admin, Admin, Teacher "starter" codes
    INSERT INTO public.invite_codes (code, role, organisation_id)
    VALUES
      (public.build_invite_code('super_admin', base_seq, NEW.abbr), 'super_admin', NEW.id),
      (public.build_invite_code('admin',        base_seq, NEW.abbr), 'admin',        NEW.id),
      (public.build_invite_code('teacher',      base_seq, NEW.abbr), 'teacher',      NEW.id);

    -- One starter Student + matching Parent code
    INSERT INTO public.invite_codes (code, role, organisation_id)
    VALUES
      (public.build_invite_code('student', base_seq, NEW.abbr), 'student', NEW.id),
      (public.build_invite_code('parent',  base_seq, NEW.abbr, parent_seq), 'parent', NEW.id);

    RETURN NEW;
END;
$$;

-- Create the trigger for org codes
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'trg_generate_org_codes') THEN
        CREATE TRIGGER trg_generate_org_codes
        AFTER INSERT ON public.organisations
        FOR EACH ROW EXECUTE FUNCTION public.generate_org_codes();
    END IF;
END
$$;

-- Lesson ordering functions
CREATE OR REPLACE FUNCTION public.update_timestamp()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Function to maintain lesson order
CREATE OR REPLACE FUNCTION public.maintain_lesson_order()
RETURNS TRIGGER AS $$
BEGIN
    -- If this is an INSERT or the path_id changed or the order_index changed
    IF TG_OP = 'INSERT' OR NEW.path_id <> OLD.path_id OR NEW.order_index <> OLD.order_index THEN
        -- If this is an INSERT and no order_index was provided, default to the end of the list
        IF TG_OP = 'INSERT' AND NEW.order_index IS NULL THEN
            SELECT COALESCE(MAX(order_index), 0) + 1 INTO NEW.order_index
            FROM public.lessons 
            WHERE path_id = NEW.path_id;
        END IF;
        
        -- If moving to a later position in the same path, adjust other lessons' positions
        IF TG_OP = 'UPDATE' AND OLD.path_id = NEW.path_id AND OLD.order_index < NEW.order_index THEN
            UPDATE public.lessons
            SET order_index = order_index - 1
            WHERE path_id = NEW.path_id
            AND order_index > OLD.order_index
            AND order_index <= NEW.order_index
            AND id <> NEW.id;
        -- If moving to an earlier position in the same path, adjust other lessons' positions
        ELSIF TG_OP = 'UPDATE' AND OLD.path_id = NEW.path_id AND OLD.order_index > NEW.order_index THEN
            UPDATE public.lessons
            SET order_index = order_index + 1
            WHERE path_id = NEW.path_id
            AND order_index < OLD.order_index
            AND order_index >= NEW.order_index
            AND id <> NEW.id;
        -- If inserting a new lesson or moving to a different path, make room at the specified position
        ELSIF TG_OP = 'INSERT' OR OLD.path_id <> NEW.path_id THEN
            UPDATE public.lessons
            SET order_index = order_index + 1
            WHERE path_id = NEW.path_id
            AND order_index >= NEW.order_index
            AND id <> NEW.id;
            
            -- If this was a move between paths, reindex the old path's lessons
            IF TG_OP = 'UPDATE' AND OLD.path_id <> NEW.path_id THEN
                WITH ordered_lessons AS (
                    SELECT id, ROW_NUMBER() OVER (ORDER BY order_index) AS new_order
                    FROM public.lessons
                    WHERE path_id = OLD.path_id AND id <> NEW.id
                )
                UPDATE public.lessons AS l
                SET order_index = ol.new_order
                FROM ordered_lessons AS ol
                WHERE l.id = ol.id;
            END IF;
        END IF;
    END IF;

    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Function to reindex lessons after delete
CREATE OR REPLACE FUNCTION public.reindex_lessons_after_delete()
RETURNS TRIGGER AS $$
BEGIN
    -- Reindex the remaining lessons in the path to ensure no gaps
    WITH ordered_lessons AS (
        SELECT id, ROW_NUMBER() OVER (ORDER BY order_index) AS new_order
        FROM public.lessons
        WHERE path_id = OLD.path_id
    )
    UPDATE public.lessons AS l
    SET order_index = ol.new_order
    FROM ordered_lessons AS ol
    WHERE l.id = ol.id;
    
    RETURN OLD;
END;
$$ LANGUAGE plpgsql;

-- Function to maintain lesson_section order
CREATE OR REPLACE FUNCTION public.maintain_section_order()
RETURNS TRIGGER AS $$
BEGIN
    -- If this is an INSERT or the lesson_id changed or the order_index changed
    IF TG_OP = 'INSERT' OR NEW.lesson_id <> OLD.lesson_id OR NEW.order_index <> OLD.order_index THEN
        -- If this is an INSERT and no order_index was provided, default to the end of the list
        IF TG_OP = 'INSERT' AND NEW.order_index IS NULL THEN
            SELECT COALESCE(MAX(order_index), 0) + 1 INTO NEW.order_index
            FROM public.lesson_sections 
            WHERE lesson_id = NEW.lesson_id;
        END IF;
        
        -- If moving to a later position in the same lesson, adjust other sections' positions
        IF TG_OP = 'UPDATE' AND OLD.lesson_id = NEW.lesson_id AND OLD.order_index < NEW.order_index THEN
            UPDATE public.lesson_sections
            SET order_index = order_index - 1
            WHERE lesson_id = NEW.lesson_id
            AND order_index > OLD.order_index
            AND order_index <= NEW.order_index
            AND id <> NEW.id;
        -- If moving to an earlier position in the same lesson, adjust other sections' positions
        ELSIF TG_OP = 'UPDATE' AND OLD.lesson_id = NEW.lesson_id AND OLD.order_index > NEW.order_index THEN
            UPDATE public.lesson_sections
            SET order_index = order_index + 1
            WHERE lesson_id = NEW.lesson_id
            AND order_index < OLD.order_index
            AND order_index >= NEW.order_index
            AND id <> NEW.id;
        -- If inserting a new section or moving to a different lesson, make room at the specified position
        ELSIF TG_OP = 'INSERT' OR OLD.lesson_id <> NEW.lesson_id THEN
            UPDATE public.lesson_sections
            SET order_index = order_index + 1
            WHERE lesson_id = NEW.lesson_id
            AND order_index >= NEW.order_index
            AND id <> NEW.id;
            
            -- If this was a move between lessons, reindex the old lesson's sections
            IF TG_OP = 'UPDATE' AND OLD.lesson_id <> NEW.lesson_id THEN
                WITH ordered_sections AS (
                    SELECT id, ROW_NUMBER() OVER (ORDER BY order_index) AS new_order
                    FROM public.lesson_sections
                    WHERE lesson_id = OLD.lesson_id AND id <> NEW.id
                )
                UPDATE public.lesson_sections AS s
                SET order_index = os.new_order
                FROM ordered_sections AS os
                WHERE s.id = os.id;
            END IF;
        END IF;
    END IF;

    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Function to reindex sections after delete
CREATE OR REPLACE FUNCTION public.reindex_sections_after_delete()
RETURNS TRIGGER AS $$
BEGIN
    -- Reindex the remaining sections in the lesson to ensure no gaps
    WITH ordered_sections AS (
        SELECT id, ROW_NUMBER() OVER (ORDER BY order_index) AS new_order
        FROM public.lesson_sections
        WHERE lesson_id = OLD.lesson_id
    )
    UPDATE public.lesson_sections AS s
    SET order_index = os.new_order
    FROM ordered_sections AS os
    WHERE s.id = os.id;
    
    RETURN OLD;
END;
$$ LANGUAGE plpgsql;

-- Create triggers for ordering
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'trg_update_lesson_timestamp') THEN
        CREATE TRIGGER trg_update_lesson_timestamp
        BEFORE UPDATE ON public.lessons
        FOR EACH ROW EXECUTE FUNCTION public.update_timestamp();
    END IF;

    IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'trg_maintain_lesson_order') THEN
        CREATE TRIGGER trg_maintain_lesson_order
        BEFORE INSERT OR UPDATE OF path_id, order_index ON public.lessons
        FOR EACH ROW EXECUTE FUNCTION public.maintain_lesson_order();
    END IF;

    IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'trg_reindex_lessons_after_delete') THEN
        CREATE TRIGGER trg_reindex_lessons_after_delete
        AFTER DELETE ON public.lessons
        FOR EACH ROW EXECUTE FUNCTION public.reindex_lessons_after_delete();
    END IF;

    IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'trg_update_section_timestamp') THEN
        CREATE TRIGGER trg_update_section_timestamp
        BEFORE UPDATE ON public.lesson_sections
        FOR EACH ROW EXECUTE FUNCTION public.update_timestamp();
    END IF;

    IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'trg_maintain_section_order') THEN
        CREATE TRIGGER trg_maintain_section_order
        BEFORE INSERT OR UPDATE OF lesson_id, order_index ON public.lesson_sections
        FOR EACH ROW EXECUTE FUNCTION public.maintain_section_order();
    END IF;

    IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'trg_reindex_sections_after_delete') THEN
        CREATE TRIGGER trg_reindex_sections_after_delete
        AFTER DELETE ON public.lesson_sections
        FOR EACH ROW EXECUTE FUNCTION public.reindex_sections_after_delete();
    END IF;
END
$$;

-- Row Level Security Policies
-- All tables should be protected when we're done

-- Create policies with proper error handling
DO $$
BEGIN
    -- Profiles Policies
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Users can update their own profile') THEN
        CREATE POLICY "Users can update their own profile"
        ON public.profiles
        FOR UPDATE
        USING (auth.uid() = user_id)
        WITH CHECK ((select auth.uid()) = user_id);
    END IF;

    -- Allow users to view their own profile
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Users can view their own profile') THEN
        CREATE POLICY "Users can view their own profile"
        ON public.profiles
        FOR SELECT
        USING (auth.uid() = user_id);
    END IF;
  
    -- Allow organization admins to view profiles in their org
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Organization admins can view profiles in their org') THEN
        CREATE POLICY "Organization admins can view profiles in their org"
        ON public.profiles
        FOR SELECT
        USING (
            EXISTS (
                SELECT 1 FROM public.profiles
                WHERE user_id = auth.uid()
                AND role IN ('super_admin', 'admin')
                AND organisation_id = profiles.organisation_id
            )
        );
    END IF;

    -- Allow organization admins to update profiles in their org
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Organization admins can update profiles in their org') THEN
        CREATE POLICY "Organization admins can update profiles in their org"
        ON public.profiles
        FOR UPDATE
        USING (
            EXISTS (
                SELECT 1 FROM public.profiles
                WHERE user_id = auth.uid()
                AND role IN ('super_admin', 'admin')
                AND organisation_id = profiles.organisation_id
            )
        );
    END IF;

    -- Allow organization admins to delete profiles in their org (excluding themselves)
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Organization admins can delete profiles in their org') THEN
        CREATE POLICY "Organization admins can delete profiles in their org"
        ON public.profiles
        FOR DELETE
        USING (
            -- User performing delete is an admin in the target profile's org
            (SELECT role FROM public.profiles WHERE user_id = auth.uid() AND organisation_id = profiles.organisation_id) IN ('super_admin', 'admin')
            -- Prevent self-deletion
            AND profiles.user_id != auth.uid()
        );
    END IF;

    -- Invite Codes Policies
    -- Allow public read access to a specific invite code (for verification)
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Public read access to a specific invite code') THEN
        CREATE POLICY "Public read access to a specific invite code"
        ON public.invite_codes
        FOR SELECT
        USING (expires_at IS NULL OR expires_at > now());
    END IF;

    -- Allow organization admins to manage invite codes for their org
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Organization admins can manage invite codes') THEN
        CREATE POLICY "Organization admins can manage invite codes"
        ON public.invite_codes
        FOR ALL
        USING (
            EXISTS (
                SELECT 1 FROM public.profiles
                WHERE user_id = auth.uid()
                AND role IN ('super_admin', 'admin')
                AND organisation_id = invite_codes.organisation_id
            )
        );
    END IF;

    -- Quiz Policies
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Quiz visibility for class members') THEN
        CREATE POLICY "Quiz visibility for class members"
        ON public.quizzes
        FOR SELECT
        USING (
            -- Simpler check - quiz is visible if the user is authenticated
            auth.uid() IS NOT NULL
        );
    END IF;
EXCEPTION
    WHEN duplicate_object THEN
        RAISE NOTICE 'A policy already exists, continuing...';
END
$$;

-- Enable RLS on all tables
ALTER TABLE IF EXISTS public.organisations ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.organisation_units ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.members ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.invite_codes ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.base_classes ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.class_instances ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.rosters ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.audit_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.paths ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.lessons ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.lesson_sections ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.quizzes ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.questions ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.question_options ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.quiz_attempts ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.quiz_responses ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.progress ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.password_reset_requests ENABLE ROW LEVEL SECURITY; 