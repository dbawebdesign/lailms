-- Create user_role type if it doesn't exist
DO $$ BEGIN
    CREATE TYPE public.user_role AS ENUM ('STUDENT', 'TEACHER', 'ADMIN', 'SUPER_ADMIN');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

-- Create members table if it doesn't exist (may already exist but not showing in UI)
CREATE TABLE IF NOT EXISTS public.members (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    auth_id UUID UNIQUE, -- Supabase Auth UUID
    organisation_id UUID REFERENCES public.organisations(id),
    email TEXT UNIQUE NOT NULL,
    role user_role NOT NULL DEFAULT 'STUDENT',
    first_name TEXT,
    last_name TEXT,
    created_at TIMESTAMPTZ DEFAULT now() NOT NULL,
    updated_at TIMESTAMPTZ DEFAULT now() NOT NULL
);

-- Create missing tables related to learning content (base_classes, class_instances, etc.)
CREATE TABLE IF NOT EXISTS public.base_classes (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    organisation_id UUID NOT NULL REFERENCES public.organisations(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    description TEXT,
    created_at TIMESTAMPTZ DEFAULT now() NOT NULL,
    updated_at TIMESTAMPTZ DEFAULT now() NOT NULL
);

CREATE TABLE IF NOT EXISTS public.class_instances (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    base_class_id UUID NOT NULL REFERENCES public.base_classes(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    start_date TIMESTAMPTZ,
    end_date TIMESTAMPTZ,
    status TEXT DEFAULT 'active',
    created_at TIMESTAMPTZ DEFAULT now() NOT NULL,
    updated_at TIMESTAMPTZ DEFAULT now() NOT NULL
);

CREATE TABLE IF NOT EXISTS public.rosters (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    class_instance_id UUID NOT NULL REFERENCES public.class_instances(id) ON DELETE CASCADE,
    member_id UUID NOT NULL REFERENCES public.members(id) ON DELETE CASCADE,
    role TEXT NOT NULL DEFAULT 'student',
    created_at TIMESTAMPTZ DEFAULT now() NOT NULL,
    updated_at TIMESTAMPTZ DEFAULT now() NOT NULL,
    UNIQUE(class_instance_id, member_id)
);

CREATE TABLE IF NOT EXISTS public.paths (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    organisation_id UUID NOT NULL REFERENCES public.organisations(id) ON DELETE CASCADE,
    title TEXT NOT NULL,
    description TEXT,
    created_at TIMESTAMPTZ DEFAULT now() NOT NULL,
    updated_at TIMESTAMPTZ DEFAULT now() NOT NULL
);

CREATE TABLE IF NOT EXISTS public.lessons (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    path_id UUID NOT NULL REFERENCES public.paths(id) ON DELETE CASCADE,
    title TEXT NOT NULL,
    description TEXT,
    order_index INTEGER NOT NULL,
    created_at TIMESTAMPTZ DEFAULT now() NOT NULL,
    updated_at TIMESTAMPTZ DEFAULT now() NOT NULL
);

CREATE TABLE IF NOT EXISTS public.quizzes (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    lesson_id UUID NOT NULL REFERENCES public.lessons(id) ON DELETE CASCADE,
    title TEXT NOT NULL,
    description TEXT,
    time_limit INTEGER, -- In minutes (NULL = no limit)
    passing_score INTEGER, -- Percentage needed to pass
    max_attempts INTEGER, -- NULL = unlimited
    created_at TIMESTAMPTZ DEFAULT now() NOT NULL,
    updated_at TIMESTAMPTZ DEFAULT now() NOT NULL
);

-- Create function to handle updated_at timestamp
CREATE OR REPLACE FUNCTION public.handle_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create triggers for updated_at if they don't exist
DO $$ 
BEGIN
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
    
    IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'on_quizzes_updated') THEN
        CREATE TRIGGER on_quizzes_updated BEFORE UPDATE ON public.quizzes 
        FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();
    END IF;
END $$;

-- Create helper functions for RLS policies
CREATE OR REPLACE FUNCTION public.get_my_claims() RETURNS jsonb
    LANGUAGE sql STABLE
    AS $$ SELECT coalesce(current_setting('request.jwt.claims', true), '{}')::jsonb; $$;

CREATE OR REPLACE FUNCTION public.get_my_role() RETURNS text
    LANGUAGE sql STABLE
    AS $$ SELECT public.get_my_claims()->>'user_role'; $$;

CREATE OR REPLACE FUNCTION public.get_my_org_id() RETURNS uuid
    LANGUAGE sql STABLE
    AS $$ SELECT (public.get_my_claims()->>'organisation_id')::uuid; $$;

-- Enable RLS on all tables
ALTER TABLE IF EXISTS public.members ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.base_classes ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.class_instances ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.rosters ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.paths ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.lessons ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.quizzes ENABLE ROW LEVEL SECURITY;

-- Fix the RLS policies for quizzes
DROP POLICY IF EXISTS "Allow enrolled members read access to quizzes" ON public.quizzes;
CREATE POLICY "Allow enrolled members read access to quizzes" ON public.quizzes
    FOR SELECT
    USING (
        EXISTS ( -- Check enrollment via lesson -> path -> class instance -> roster -> member
            SELECT 1
            FROM public.lessons l
            JOIN public.paths p ON l.path_id = p.id
            JOIN public.class_instances ci ON ci.base_class_id = p.organisation_id -- Fixed join logic
            JOIN public.rosters r ON ci.id = r.class_instance_id
            JOIN public.members m ON r.member_id = m.id -- Join members
            WHERE l.id = public.quizzes.lesson_id -- Qualify column
              AND m.id = (SELECT auth.uid()) -- Using SELECT wrapper for better performance
        ) OR
        ( -- Org Admin/Teacher can see all in their org
            EXISTS (
                SELECT 1
                FROM public.lessons l
                JOIN public.paths p ON l.path_id = p.id
                WHERE l.id = public.quizzes.lesson_id
                  AND p.organisation_id = public.get_my_org_id()
            )
            AND public.get_my_role() IN ('ADMIN', 'TEACHER')
        )
    );

DROP POLICY IF EXISTS "Allow org admin/teacher management of quizzes" ON public.quizzes;
CREATE POLICY "Allow org admin/teacher management of quizzes" ON public.quizzes
    FOR ALL 
    USING (
        EXISTS ( SELECT 1 FROM public.lessons l JOIN public.paths p ON l.path_id = p.id WHERE l.id = quizzes.lesson_id AND p.organisation_id = public.get_my_org_id())
        AND public.get_my_role() IN ('ADMIN', 'TEACHER')
    )
    WITH CHECK (
        EXISTS ( SELECT 1 FROM public.lessons l JOIN public.paths p ON l.path_id = p.id WHERE l.id = quizzes.lesson_id AND p.organisation_id = public.get_my_org_id())
        AND public.get_my_role() IN ('ADMIN', 'TEACHER')
    );
