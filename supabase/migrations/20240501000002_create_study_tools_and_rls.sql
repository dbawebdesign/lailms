-- Create notebooks table
CREATE TABLE public.notebooks (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    member_id UUID NOT NULL REFERENCES public.members(id) ON DELETE CASCADE,
    class_instance_id UUID REFERENCES public.class_instances(id) ON DELETE SET NULL, -- Optional link to a class
    title TEXT NOT NULL,
    content JSONB, -- For rich text or structured notes
    settings JSONB,
    created_at TIMESTAMPTZ DEFAULT now() NOT NULL,
    updated_at TIMESTAMPTZ DEFAULT now() NOT NULL
);
CREATE TRIGGER on_notebooks_updated BEFORE UPDATE ON public.notebooks FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();
CREATE INDEX idx_notebooks_member_id ON public.notebooks(member_id);
CREATE INDEX idx_notebooks_class_instance_id ON public.notebooks(class_instance_id);

-- Create mind_maps table
CREATE TABLE public.mind_maps (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    member_id UUID NOT NULL REFERENCES public.members(id) ON DELETE CASCADE,
    class_instance_id UUID REFERENCES public.class_instances(id) ON DELETE SET NULL, -- Optional link to a class
    title TEXT NOT NULL,
    nodes JSONB, -- Store node data (position, label, etc.)
    edges JSONB, -- Store edge data (source, target, etc.)
    settings JSONB,
    created_at TIMESTAMPTZ DEFAULT now() NOT NULL,
    updated_at TIMESTAMPTZ DEFAULT now() NOT NULL
);
CREATE TRIGGER on_mind_maps_updated BEFORE UPDATE ON public.mind_maps FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();
CREATE INDEX idx_mind_maps_member_id ON public.mind_maps(member_id);
CREATE INDEX idx_mind_maps_class_instance_id ON public.mind_maps(class_instance_id);

-- Create achievements table
CREATE TABLE public.achievements (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    organisation_id UUID NOT NULL REFERENCES public.organisations(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    description TEXT,
    criteria JSONB, -- Define conditions for earning the achievement
    icon_url TEXT,
    settings JSONB,
    created_at TIMESTAMPTZ DEFAULT now() NOT NULL,
    updated_at TIMESTAMPTZ DEFAULT now() NOT NULL
);
CREATE TRIGGER on_achievements_updated BEFORE UPDATE ON public.achievements FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();
CREATE INDEX idx_achievements_organisation_id ON public.achievements(organisation_id);

-- Create certificates table (linking achievements to members)
CREATE TABLE public.certificates (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    member_id UUID NOT NULL REFERENCES public.members(id) ON DELETE CASCADE,
    achievement_id UUID NOT NULL REFERENCES public.achievements(id) ON DELETE CASCADE,
    issued_at TIMESTAMPTZ DEFAULT now() NOT NULL,
    expires_at TIMESTAMPTZ,
    credential_url TEXT, -- Link to verifiable credential if applicable
    settings JSONB,
    created_at TIMESTAMPTZ DEFAULT now() NOT NULL,
    updated_at TIMESTAMPTZ DEFAULT now() NOT NULL,
    UNIQUE (member_id, achievement_id) -- Ensure only one certificate per member per achievement
);
CREATE TRIGGER on_certificates_updated BEFORE UPDATE ON public.certificates FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();
CREATE INDEX idx_certificates_member_id ON public.certificates(member_id);
CREATE INDEX idx_certificates_achievement_id ON public.certificates(achievement_id);

-- Create ui_contexts table
CREATE TABLE public.ui_contexts (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    member_id UUID NOT NULL REFERENCES public.members(id) ON DELETE CASCADE,
    context_type TEXT NOT NULL, -- E.g., 'dashboard', 'lesson_view', 'quiz_attempt'
    context_data JSONB NOT NULL, -- Snapshot of UI state, props, etc.
    -- context_embedding vector(1536), -- Optional embedding for similarity search
    settings JSONB,
    created_at TIMESTAMPTZ DEFAULT now() NOT NULL,
    updated_at TIMESTAMPTZ DEFAULT now() NOT NULL -- Note: May not need updated_at if contexts are immutable snapshots
);
-- CREATE TRIGGER on_ui_contexts_updated BEFORE UPDATE ON public.ui_contexts FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();
CREATE INDEX idx_ui_contexts_member_id ON public.ui_contexts(member_id);
CREATE INDEX idx_ui_contexts_context_type ON public.ui_contexts(context_type);
-- CREATE INDEX idx_ui_contexts_embedding ON public.ui_contexts USING ivfflat (context_embedding vector_l2_ops) WITH (lists = 100);

-- ========= Row-Level Security (RLS) Policies =========

-- Helper functions (Example - adjust based on actual JWT claims/metadata)
CREATE OR REPLACE FUNCTION public.get_my_claims() RETURNS jsonb
    LANGUAGE sql STABLE
    AS $$ SELECT coalesce(current_setting('request.jwt.claims', true), '{}')::jsonb; $$;

CREATE OR REPLACE FUNCTION public.get_my_role() RETURNS text
    LANGUAGE sql STABLE
    AS $$ SELECT public.get_my_claims()->>'user_role'; $$; -- Assumes role is in JWT claims

CREATE OR REPLACE FUNCTION public.get_my_org_id() RETURNS uuid
    LANGUAGE sql STABLE
    AS $$ SELECT (public.get_my_claims()->>'organisation_id')::uuid; $$; -- Assumes org ID is in JWT claims

-- Enable RLS for all tables (Add all tables created in previous migrations too)
ALTER TABLE public.organisations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.members ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.invite_codes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.base_classes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.class_instances ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.rosters ENABLE ROW LEVEL SECURITY;
-- ALTER TABLE public.audit_logs ENABLE ROW LEVEL SECURITY; -- Consider if needed, might be admin only
ALTER TABLE public.paths ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.lessons ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.lesson_sections ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.quizzes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.questions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.submissions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.notebooks ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.mind_maps ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.achievements ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.certificates ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ui_contexts ENABLE ROW LEVEL SECURITY;

-- Default Deny Policy (Good practice)
-- Apply to all tables, example for members:
-- DROP POLICY IF EXISTS "Allow public read access" ON public.members;
-- CREATE POLICY "Deny ALL" ON public.members FOR ALL USING (false);

-- Policy Examples (Implement specific policies for EACH table)

-- Example: members table
DROP POLICY IF EXISTS "Allow individual access" ON public.members;
CREATE POLICY "Allow individual access" ON public.members
    FOR ALL -- Or specify SELECT, INSERT, UPDATE, DELETE
    USING ((SELECT auth.uid()) = id)
    WITH CHECK ((SELECT auth.uid()) = id);

DROP POLICY IF EXISTS "Allow organisation admin access" ON public.members;
CREATE POLICY "Allow organisation admin access" ON public.members
    FOR SELECT -- Admins can read members in their org
    USING (organisation_id = public.get_my_org_id() AND public.get_my_role() = 'ADMIN');
    -- Add INSERT/UPDATE/DELETE policies for admins as needed

-- Example: organisations table
DROP POLICY IF EXISTS "Allow org member read access" ON public.organisations;
CREATE POLICY "Allow org member read access" ON public.organisations
    FOR SELECT
    USING (id = public.get_my_org_id()); -- Assumes users belong to one org from JWT
    -- Add INSERT/UPDATE policies for ADMINs/SUPER_ADMINs

-- Example: notebooks table
DROP POLICY IF EXISTS "Allow owner access" ON public.notebooks;
CREATE POLICY "Allow owner access" ON public.notebooks
    FOR ALL
    USING ((SELECT auth.uid()) = member_id)
    WITH CHECK ((SELECT auth.uid()) = member_id);
    -- Add policies for shared access (e.g., teachers viewing student notebooks in a class) later

-- Policies for invite_codes
DROP POLICY IF EXISTS "Allow org admin access to invite codes" ON public.invite_codes;
CREATE POLICY "Allow org admin access to invite codes" ON public.invite_codes
    FOR ALL
    USING (organisation_id = public.get_my_org_id() AND public.get_my_role() = 'ADMIN')
    WITH CHECK (organisation_id = public.get_my_org_id() AND public.get_my_role() = 'ADMIN');
-- Add policy for TEACHER role if needed

-- Policies for base_classes
DROP POLICY IF EXISTS "Allow org members read access to base classes" ON public.base_classes;
CREATE POLICY "Allow org members read access to base classes" ON public.base_classes
    FOR SELECT
    USING (organisation_id = public.get_my_org_id());

DROP POLICY IF EXISTS "Allow org admin/teacher management of base classes" ON public.base_classes;
CREATE POLICY "Allow org admin/teacher management of base classes" ON public.base_classes
    FOR ALL -- Changed from INSERT UPDATE DELETE as conditions are the same
    USING (organisation_id = public.get_my_org_id() AND public.get_my_role() IN ('ADMIN', 'TEACHER'))
    WITH CHECK (organisation_id = public.get_my_org_id() AND public.get_my_role() IN ('ADMIN', 'TEACHER'));

-- Policies for class_instances
DROP POLICY IF EXISTS "Allow enrolled members read access to class instances" ON public.class_instances;
CREATE POLICY "Allow enrolled members read access to class instances" ON public.class_instances
    FOR SELECT
    USING (
        EXISTS (
            SELECT 1
            FROM public.rosters r
            JOIN public.members m ON r.member_id = m.id
            WHERE r.class_instance_id = public.class_instances.id
              AND m.id = (SELECT auth.uid())
        ) OR
        ( -- Org Admin/Teacher check requires joining base_classes
            EXISTS (
                SELECT 1 FROM public.base_classes bc
                WHERE bc.id = public.class_instances.base_class_id
                  AND bc.organisation_id = public.get_my_org_id()
            )
            AND public.get_my_role() IN ('ADMIN', 'TEACHER')
        )
    );

DROP POLICY IF EXISTS "Allow org admin/teacher management of class instances" ON public.class_instances;
CREATE POLICY "Allow org admin/teacher management of class instances" ON public.class_instances
    FOR ALL
    USING ( -- Join base_classes to check organisation_id
        EXISTS (
            SELECT 1 FROM public.base_classes bc
            WHERE bc.id = public.class_instances.base_class_id
              AND bc.organisation_id = public.get_my_org_id()
        )
        AND public.get_my_role() IN ('ADMIN', 'TEACHER')
    )
    WITH CHECK ( -- Join base_classes to check organisation_id
        EXISTS (
            SELECT 1 FROM public.base_classes bc
            WHERE bc.id = public.class_instances.base_class_id
              AND bc.organisation_id = public.get_my_org_id()
        )
        AND public.get_my_role() IN ('ADMIN', 'TEACHER')
    );

-- Policies for rosters
DROP POLICY IF EXISTS "Allow roster members read access" ON public.rosters;
CREATE POLICY "Allow roster members read access" ON public.rosters
    FOR SELECT
    USING (
        member_id = (SELECT auth.uid()) -- Simpler check: Directly compare member_id to auth.uid()
        OR
        EXISTS ( -- Teacher/Admin check requires joining class_instances -> base_classes
            SELECT 1 FROM public.class_instances ci
            JOIN public.base_classes bc ON ci.base_class_id = bc.id
            WHERE ci.id = public.rosters.class_instance_id
              AND bc.organisation_id = public.get_my_org_id()
              AND public.get_my_role() IN ('ADMIN', 'TEACHER')
        )
    );

DROP POLICY IF EXISTS "Allow class admin/teacher management of rosters" ON public.rosters;
CREATE POLICY "Allow class admin/teacher management of rosters" ON public.rosters
    FOR ALL
    USING ( -- Join class_instances -> base_classes to check organisation_id
        EXISTS (
            SELECT 1 FROM public.class_instances ci
            JOIN public.base_classes bc ON ci.base_class_id = bc.id
            WHERE ci.id = public.rosters.class_instance_id
              AND bc.organisation_id = public.get_my_org_id()
              AND public.get_my_role() IN ('ADMIN', 'TEACHER')
        )
    )
    WITH CHECK ( -- Join class_instances -> base_classes to check organisation_id
        EXISTS (
            SELECT 1 FROM public.class_instances ci
            JOIN public.base_classes bc ON ci.base_class_id = bc.id
            WHERE ci.id = public.rosters.class_instance_id
              AND bc.organisation_id = public.get_my_org_id()
              AND public.get_my_role() IN ('ADMIN', 'TEACHER')
        )
    );

-- Policies for paths, lessons, lesson_sections (assuming content is org-level, access tied to enrollment)
DROP POLICY IF EXISTS "Allow enrolled members read access to learning content" ON public.paths;
CREATE POLICY "Allow enrolled members read access to learning content" ON public.paths
    FOR SELECT
    USING (
        EXISTS ( -- Check if member is enrolled in a class instance that uses this path
            SELECT 1 FROM public.class_instances ci
            JOIN public.rosters r ON ci.id = r.class_instance_id
            -- Assuming a link table or logic exists linking class_instances to paths
            -- WHERE ci.path_id = paths.id -- Placeholder for actual link
            WHERE r.member_id = (SELECT auth.uid())
        ) OR
        ( -- Org Admin/Teacher can see all in their org
            organisation_id = public.get_my_org_id() AND public.get_my_role() IN ('ADMIN', 'TEACHER')
        )
    );
-- Apply similar SELECT policy logic to lessons and lesson_sections based on path_id/lesson_id

DROP POLICY IF EXISTS "Allow org admin/teacher management of learning content" ON public.paths;
CREATE POLICY "Allow org admin/teacher management of learning content" ON public.paths
    FOR ALL -- Changed from INSERT UPDATE DELETE as conditions are the same
    USING (organisation_id = public.get_my_org_id() AND public.get_my_role() IN ('ADMIN', 'TEACHER'))
    WITH CHECK (organisation_id = public.get_my_org_id() AND public.get_my_role() IN ('ADMIN', 'TEACHER'));
-- Apply similar INSERT/UPDATE/DELETE policies to lessons and lesson_sections

-- Policies for quizzes, questions (similar logic to lessons)
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
              AND m.id = (SELECT auth.uid()) -- Check member ID directly
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
-- Apply similar SELECT policy logic to questions based on quiz_id

DROP POLICY IF EXISTS "Allow org admin/teacher management of quizzes" ON public.quizzes;
CREATE POLICY "Allow org admin/teacher management of quizzes" ON public.quizzes
    FOR ALL -- Changed from INSERT UPDATE DELETE as conditions are the same
    USING (
        EXISTS ( SELECT 1 FROM public.lessons l JOIN public.paths p ON l.path_id = p.id WHERE l.id = quizzes.lesson_id AND p.organisation_id = public.get_my_org_id())
        AND public.get_my_role() IN ('ADMIN', 'TEACHER')
    )
    WITH CHECK (
        EXISTS ( SELECT 1 FROM public.lessons l JOIN public.paths p ON l.path_id = p.id WHERE l.id = quizzes.lesson_id AND p.organisation_id = public.get_my_org_id())
        AND public.get_my_role() IN ('ADMIN', 'TEACHER')
    );
-- Apply similar INSERT/UPDATE/DELETE policies to questions

-- Policies for submissions
DROP POLICY IF EXISTS "Allow student access to own submissions" ON public.submissions;
CREATE POLICY "Allow student access to own submissions" ON public.submissions
    FOR ALL
    USING (member_id = (SELECT auth.uid()))
    WITH CHECK (member_id = (SELECT auth.uid()));

DROP POLICY IF EXISTS "Allow teacher/admin access to submissions in their classes/org" ON public.submissions;
-- Split into SELECT and UPDATE policies as conditions are read-only vs potentially modifying
CREATE POLICY "Allow teacher/admin read access to submissions in their classes/org" ON public.submissions
    FOR SELECT
    USING (
        EXISTS ( -- Check if teacher/admin manages the org where the submission's quiz resides
            SELECT 1
            FROM public.submissions s
            JOIN public.quizzes q ON s.quiz_id = q.id
            JOIN public.lessons l ON q.lesson_id = l.id
            JOIN public.paths p ON l.path_id = p.id
            -- No direct link needed to class_instances here, just check path's org
            WHERE s.id = public.submissions.id -- Ensure we are checking the current row
              AND p.organisation_id = public.get_my_org_id()
              AND public.get_my_role() IN ('ADMIN', 'TEACHER')
        )
    );
-- Add a separate policy for UPDATE if needed, potentially with different conditions

-- Policies for mind_maps (similar to notebooks)
DROP POLICY IF EXISTS "Allow owner access to mind maps" ON public.mind_maps;
CREATE POLICY "Allow owner access to mind maps" ON public.mind_maps
    FOR ALL
    USING (member_id = (SELECT auth.uid()))
    WITH CHECK (member_id = (SELECT auth.uid()));

-- Policies for achievements
DROP POLICY IF EXISTS "Allow org members read access to achievements" ON public.achievements;
CREATE POLICY "Allow org members read access to achievements" ON public.achievements
    FOR SELECT
    USING (organisation_id = public.get_my_org_id());

DROP POLICY IF EXISTS "Allow org admin management of achievements" ON public.achievements;
CREATE POLICY "Allow org admin management of achievements" ON public.achievements
    FOR ALL -- Changed from INSERT UPDATE DELETE as conditions are the same
    USING (organisation_id = public.get_my_org_id() AND public.get_my_role() = 'ADMIN')
    WITH CHECK (organisation_id = public.get_my_org_id() AND public.get_my_role() = 'ADMIN');

-- Policies for certificates
DROP POLICY IF EXISTS "Allow member access to own certificates" ON public.certificates;
CREATE POLICY "Allow member access to own certificates" ON public.certificates
    FOR SELECT
    USING (member_id = (SELECT auth.uid()));

DROP POLICY IF EXISTS "Allow org admin read access to certificates" ON public.certificates;
CREATE POLICY "Allow org admin read access to certificates" ON public.certificates
    FOR SELECT
    USING (
        EXISTS (SELECT 1 FROM public.members m WHERE m.id = certificates.member_id AND m.organisation_id = public.get_my_org_id())
        AND public.get_my_role() = 'ADMIN'
    );
-- Add INSERT/UPDATE/DELETE for admins if they manage certificates

-- Policies for ui_contexts (similar to notebooks - owner only)
DROP POLICY IF EXISTS "Allow owner access to ui_contexts" ON public.ui_contexts;
CREATE POLICY "Allow owner access to ui_contexts" ON public.ui_contexts
    FOR ALL
    USING (member_id = (SELECT auth.uid()))
    WITH CHECK (member_id = (SELECT auth.uid()));

-- Policies for audit_logs (Assuming Org Admin only access for now)
-- Note: This assumes audit_logs table has an organisation_id or can be joined. Needs verification.
-- DROP POLICY IF EXISTS "Allow org admin read access to audit logs" ON public.audit_logs;
-- CREATE POLICY "Allow org admin read access to audit logs" ON public.audit_logs
--     FOR SELECT
--     USING ( -- Filter based on related record's org_id if possible, or just role check
--            public.get_my_role() = 'ADMIN'
--            -- AND EXISTS ( SELECT 1 FROM related_table rt WHERE rt.id = audit_logs.record_id AND rt.organisation_id = public.get_my_org_id())
--     );

-- *** IMPORTANT: Add specific, granular policies for ALL other tables ***
-- *** based on roles (ADMIN, TEACHER, STUDENT) and relationships     ***
-- *** (e.g., teachers access their classes/rosters/submissions)      ***

