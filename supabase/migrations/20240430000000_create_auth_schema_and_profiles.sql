-- Function to automatically update 'updated_at' timestamps
CREATE OR REPLACE FUNCTION public.set_updated_at() 
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create the organisations table FIRST
CREATE TABLE public.organisations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  abbr text UNIQUE, -- Used in invite codes, should probably be unique
  settings jsonb,
  created_at timestamptz DEFAULT now() NOT NULL,
  updated_at timestamptz DEFAULT now() NOT NULL
);

-- Add trigger for updated_at on organisations
CREATE TRIGGER set_organisations_updated_at
BEFORE UPDATE ON public.organisations
FOR EACH ROW
EXECUTE FUNCTION public.set_updated_at();

-- Create the role enum
CREATE TYPE public.role AS ENUM (
  'super_admin', 
  'admin', 
  'teacher', 
  'student', 
  'parent'
);

-- Optional: organisation_units table
CREATE TABLE public.organisation_units (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organisation_id uuid REFERENCES public.organisations(id) ON DELETE CASCADE,
  name text NOT NULL,
  created_at timestamptz DEFAULT now() NOT NULL,
  updated_at timestamptz DEFAULT now() NOT NULL
);

-- Create profiles table extending auth.users
CREATE TABLE public.profiles (
  user_id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  username text UNIQUE NOT NULL,
  first_name text, -- Added
  last_name text, -- Added
  grade_level text, -- Added
  role public.role NOT NULL,
  organisation_id uuid REFERENCES public.organisations(id),
  settings jsonb,
  created_at timestamptz DEFAULT now() NOT NULL,
  updated_at timestamptz DEFAULT now() NOT NULL
);
COMMENT ON TABLE public.profiles IS 'Extends auth.users to store user profile information including role and organisation.';

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
    -- NOTE: Using a fixed sequence here for simplicity.
    -- Replace with `nextval('invite_code_org_seq')` or similar for production
    -- if you need globally unique sequences per org or role.
    base_seq int := 1;
    parent_seq int := 1;
BEGIN
    -- Ensure abbr is not null for code generation
    IF NEW.abbr IS NULL THEN
        RAISE EXCEPTION 'Organisation abbreviation (abbr) cannot be null';
    END IF;

    -- Super-Admin, Admin, Teacher "starter" codes
    INSERT INTO public.invite_codes (code, role, organisation_id)
    VALUES
      (public.build_invite_code('super_admin', base_seq, NEW.abbr), 'super_admin', NEW.id),
      (public.build_invite_code('admin',        base_seq, NEW.abbr), 'admin',        NEW.id),
      (public.build_invite_code('teacher',      base_seq, NEW.abbr), 'teacher',      NEW.id);

    -- One starter Student + matching Parent code – adjust for bulk import later
    -- For parents, we might want to link student_id later, or generate codes differently.
    -- This example generates one placeholder student/parent pair.
    INSERT INTO public.invite_codes (code, role, organisation_id)
    VALUES
      (public.build_invite_code('student', base_seq, NEW.abbr), 'student', NEW.id),
      (public.build_invite_code('parent',  base_seq, NEW.abbr, parent_seq), 'parent', NEW.id);

    RETURN NEW;
END;
$$;

-- Create the trigger
CREATE TRIGGER trg_generate_org_codes
AFTER INSERT ON public.organisations
FOR EACH ROW EXECUTE FUNCTION public.generate_org_codes();
