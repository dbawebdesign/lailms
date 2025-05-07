-- supabase/migrations/20240615120000_create_student_enrollments.sql

BEGIN;

-- 1. Create Enum Types
CREATE TYPE public.enrollment_role_in_class_enum AS ENUM ('student', 'observer');
CREATE TYPE public.enrollment_status_enum AS ENUM ('active', 'withdrawn', 'pending_approval', 'completed');

-- 2. Create student_enrollments Table
CREATE TABLE public.student_enrollments (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    class_instance_id uuid NOT NULL REFERENCES public.class_instances(id) ON DELETE CASCADE,
    student_som_id uuid NOT NULL REFERENCES public.student_organisation_memberships(id) ON DELETE CASCADE,
    organisation_id uuid NOT NULL REFERENCES public.organisations(id) ON DELETE CASCADE,
    role_in_class public.enrollment_role_in_class_enum NOT NULL DEFAULT 'student', والغاء تثبيت 'student' لاحقا
    status public.enrollment_status_enum NOT NULL DEFAULT 'active',
    enrolled_at timestamptz NOT NULL DEFAULT now(),
    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now(),
    CONSTRAINT uq_instance_student_som UNIQUE (class_instance_id, student_som_id)
);

-- Indexes
CREATE INDEX idx_student_enrollments_class_instance_id ON public.student_enrollments(class_instance_id);
CREATE INDEX idx_student_enrollments_student_som_id ON public.student_enrollments(student_som_id);
CREATE INDEX idx_student_enrollments_organisation_id ON public.student_enrollments(organisation_id);

-- Timestamps trigger
-- Assuming trigger_set_updated_at function already exists from previous migrations
CREATE TRIGGER set_student_enrollments_updated_at
BEFORE UPDATE ON public.student_enrollments
FOR EACH ROW
EXECUTE FUNCTION public.trigger_set_updated_at();

-- 3. Row Level Security (RLS)
ALTER TABLE public.student_enrollments ENABLE ROW LEVEL SECURITY;

-- Helper function to get user's organisation_id from members table
-- This is a simplified version. Adapt if your actual function is different.
CREATE OR REPLACE FUNCTION internal_get_user_organisation_id(p_user_id uuid)
RETURNS uuid
LANGUAGE sql
SECURITY DEFINER
AS $$
  SELECT organisation_id FROM public.members WHERE user_id = p_user_id LIMIT 1;
$$;

-- SELECT Policies
CREATE POLICY "Allow organisation admins and teachers to select enrollments in their org"
ON public.student_enrollments
FOR SELECT
USING (
    organisation_id = internal_get_user_organisation_id(auth.uid()) AND 
    public.get_user_role_in_org(organisation_id, auth.uid()) IN ('admin', 'teacher')
);

CREATE POLICY "Allow students to select their own enrollments"
ON public.student_enrollments
FOR SELECT
USING (
    student_som_id IN (
        SELECT som.id FROM public.student_organisation_memberships som WHERE som.student_user_id = auth.uid()
    )
);

-- INSERT Policies
CREATE POLICY "Allow organisation admins and teachers to insert enrollments in their org"
ON public.student_enrollments
FOR INSERT
WITH CHECK (
    organisation_id = internal_get_user_organisation_id(auth.uid()) AND
    public.get_user_role_in_org(organisation_id, auth.uid()) IN ('admin', 'teacher') AND
    organisation_id = (SELECT ci.organisation_id FROM public.class_instances ci WHERE ci.id = class_instance_id LIMIT 1) AND
    organisation_id = (SELECT som.organisation_id FROM public.student_organisation_memberships som WHERE som.id = student_som_id LIMIT 1)
);


-- UPDATE Policies
CREATE POLICY "Allow organisation admins and teachers to update enrollments in their org"
ON public.student_enrollments
FOR UPDATE
USING (
    organisation_id = internal_get_user_organisation_id(auth.uid()) AND
    public.get_user_role_in_org(organisation_id, auth.uid()) IN ('admin', 'teacher')
)
WITH CHECK (
    organisation_id = internal_get_user_organisation_id(auth.uid()) AND
    public.get_user_role_in_org(organisation_id, auth.uid()) IN ('admin', 'teacher')
);

-- DELETE Policies
CREATE POLICY "Allow organisation admins and teachers to delete enrollments in their org"
ON public.student_enrollments
FOR DELETE
USING (
    organisation_id = internal_get_user_organisation_id(auth.uid()) AND
    public.get_user_role_in_org(organisation_id, auth.uid()) IN ('admin', 'teacher')
);

COMMIT; 