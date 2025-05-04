-- Enable pgvector extension
CREATE EXTENSION IF NOT EXISTS vector WITH SCHEMA extensions;

-- Create user_role enum type
CREATE TYPE public.user_role AS ENUM ('SUPER_ADMIN', 'ADMIN', 'TEACHER', 'STUDENT', 'PARENT');

-- Create organisations table
CREATE TABLE IF NOT EXISTS public.organisations (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT NOT NULL,
    abbreviation TEXT UNIQUE, -- For pseudo-email generation
    settings JSONB,
    created_at TIMESTAMPTZ DEFAULT now() NOT NULL,
    updated_at TIMESTAMPTZ DEFAULT now() NOT NULL
);

-- Create members table (profiles)
CREATE TABLE public.members (
    id UUID PRIMARY KEY NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE, -- Link to Supabase Auth user
    organisation_id UUID REFERENCES public.organisations(id) ON DELETE SET NULL,
    email TEXT UNIQUE, -- Can differ from auth.users.email if pseudo-emails are used
    username TEXT UNIQUE,
    first_name TEXT,
    last_name TEXT,
    role user_role NOT NULL,
    grade_level TEXT, -- Example: "9", "10", etc. Consider structured type later if needed.
    settings JSONB,
    created_at TIMESTAMPTZ DEFAULT now() NOT NULL,
    updated_at TIMESTAMPTZ DEFAULT now() NOT NULL
);

-- Create invite_codes table
CREATE TABLE public.invite_codes (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    code TEXT UNIQUE NOT NULL DEFAULT substring(md5(random()::text) for 10), -- Simple random code generation
    organisation_id UUID NOT NULL REFERENCES public.organisations(id) ON DELETE CASCADE,
    role user_role NOT NULL, -- Role assigned upon redeeming the code
    expires_at TIMESTAMPTZ,
    is_redeemed BOOLEAN DEFAULT false NOT NULL,
    redeemed_by UUID REFERENCES public.members(id) ON DELETE SET NULL,
    redeemed_at TIMESTAMPTZ,
    created_by UUID REFERENCES public.members(id) ON DELETE SET NULL, -- Who generated the code
    created_at TIMESTAMPTZ DEFAULT now() NOT NULL,
    updated_at TIMESTAMPTZ DEFAULT now() NOT NULL
);

-- Create base_classes table
CREATE TABLE public.base_classes (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    organisation_id UUID NOT NULL REFERENCES public.organisations(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    description TEXT,
    settings JSONB,
    created_at TIMESTAMPTZ DEFAULT now() NOT NULL,
    updated_at TIMESTAMPTZ DEFAULT now() NOT NULL
);

-- Create class_instances table
CREATE TABLE public.class_instances (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    base_class_id UUID NOT NULL REFERENCES public.base_classes(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    enrollment_code TEXT UNIQUE NOT NULL DEFAULT substring(md5(random()::text) for 8), -- Simple random code
    start_date DATE,
    end_date DATE,
    settings JSONB,
    created_at TIMESTAMPTZ DEFAULT now() NOT NULL,
    updated_at TIMESTAMPTZ DEFAULT now() NOT NULL
);

-- Create rosters table (linking members to class instances)
CREATE TABLE public.rosters (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    class_instance_id UUID NOT NULL REFERENCES public.class_instances(id) ON DELETE CASCADE,
    member_id UUID NOT NULL REFERENCES public.members(id) ON DELETE CASCADE,
    role user_role NOT NULL, -- Role within this specific class (e.g., Teacher, Student)
    joined_at TIMESTAMPTZ DEFAULT now() NOT NULL,
    settings JSONB,
    created_at TIMESTAMPTZ DEFAULT now() NOT NULL,
    updated_at TIMESTAMPTZ DEFAULT now() NOT NULL,
    UNIQUE (class_instance_id, member_id) -- Ensure a member is only in a class once
);

-- Create audit_logs table
CREATE TYPE public.audit_action AS ENUM ('INSERT', 'UPDATE', 'DELETE');
CREATE TABLE public.audit_logs (
    id BIGSERIAL PRIMARY KEY,
    table_name TEXT NOT NULL,
    record_id TEXT, -- Use TEXT to accommodate different primary key types (UUID, INT, etc.)
    action audit_action NOT NULL,
    old_data JSONB,
    new_data JSONB,
    performed_by UUID REFERENCES public.members(id) ON DELETE SET NULL, -- Optional: Link to the user performing the action
    performed_at TIMESTAMPTZ DEFAULT now() NOT NULL
);

-- Indexes
CREATE INDEX idx_members_organisation_id ON public.members(organisation_id);
CREATE INDEX idx_members_email ON public.members(email);
CREATE INDEX idx_members_username ON public.members(username);
CREATE INDEX idx_invite_codes_organisation_id ON public.invite_codes(organisation_id);
CREATE INDEX idx_invite_codes_code ON public.invite_codes(code);
CREATE INDEX idx_invite_codes_created_by ON public.invite_codes(created_by);
CREATE INDEX idx_invite_codes_redeemed_by ON public.invite_codes(redeemed_by);
CREATE INDEX idx_base_classes_organisation_id ON public.base_classes(organisation_id);
CREATE INDEX idx_class_instances_base_class_id ON public.class_instances(base_class_id);
CREATE INDEX idx_class_instances_enrollment_code ON public.class_instances(enrollment_code);
CREATE INDEX idx_rosters_class_instance_id ON public.rosters(class_instance_id);
CREATE INDEX idx_rosters_member_id ON public.rosters(member_id);
CREATE INDEX idx_audit_logs_table_record ON public.audit_logs(table_name, record_id);
CREATE INDEX idx_audit_logs_performed_by ON public.audit_logs(performed_by);

-- Trigger function for updated_at timestamps (common Supabase pattern)
CREATE OR REPLACE FUNCTION public.handle_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Apply timestamp trigger to tables
CREATE TRIGGER on_organisations_updated BEFORE UPDATE ON public.organisations FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();
CREATE TRIGGER on_members_updated BEFORE UPDATE ON public.members FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();
CREATE TRIGGER on_invite_codes_updated BEFORE UPDATE ON public.invite_codes FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();
CREATE TRIGGER on_base_classes_updated BEFORE UPDATE ON public.base_classes FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();
CREATE TRIGGER on_class_instances_updated BEFORE UPDATE ON public.class_instances FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();
CREATE TRIGGER on_rosters_updated BEFORE UPDATE ON public.rosters FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

-- Note: Audit triggers and enrollment_code triggers are more complex and deferred for now.
-- Note: Materialized view 'enrollment_code_lookup' is also deferred. 