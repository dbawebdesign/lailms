BEGIN;

-- Profile affiliations and entitlements are authority, not editable preferences.
-- Deploy the companion server provisioning changes before this migration.
CREATE SCHEMA IF NOT EXISTS private;
REVOKE ALL ON SCHEMA private FROM PUBLIC;
GRANT USAGE ON SCHEMA private TO authenticated, service_role;

CREATE OR REPLACE FUNCTION private.can_read_profile(target_user_id uuid)
RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = ''
AS $$
  SELECT auth.uid() IS NOT NULL AND EXISTS (
    SELECT 1
    FROM public.profiles viewer
    JOIN public.profiles target ON target.user_id = target_user_id
    WHERE viewer.user_id = auth.uid()
      AND (
        target.user_id = viewer.user_id
        OR target.parent_account_id = viewer.user_id
        OR (
          viewer.is_primary_parent IS TRUE AND viewer.is_sub_account IS NOT TRUE
          AND viewer.family_id IS NOT NULL AND target.family_id = viewer.family_id
        )
        OR (
          viewer.organisation_id IS NOT NULL
          AND target.organisation_id = viewer.organisation_id
          AND viewer.is_sub_account IS NOT TRUE
          AND coalesce(viewer.active_role, viewer.role)::text IN ('teacher', 'admin', 'super_admin')
        )
      )
  );
$$;

CREATE OR REPLACE FUNCTION private.can_manage_child_profile(target_user_id uuid)
RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = ''
AS $$
  SELECT auth.uid() IS NOT NULL AND EXISTS (
    SELECT 1 FROM public.profiles viewer
    JOIN public.profiles child ON child.user_id = target_user_id
    WHERE viewer.user_id = auth.uid()
      AND viewer.is_sub_account IS NOT TRUE
      AND child.is_sub_account IS TRUE AND child.role::text = 'student'
      AND (
        child.parent_account_id = viewer.user_id
        OR (viewer.is_primary_parent IS TRUE AND viewer.family_id IS NOT NULL
            AND child.family_id = viewer.family_id)
      )
  );
$$;

REVOKE ALL ON FUNCTION private.can_read_profile(uuid) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION private.can_manage_child_profile(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION private.can_read_profile(uuid), private.can_manage_child_profile(uuid)
  TO authenticated, service_role;

ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
-- Replace the complete effective policy set: permissive policies combine with OR.
DO $$ DECLARE policy_record record;
BEGIN
  FOR policy_record IN SELECT policyname FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'profiles'
  LOOP
    EXECUTE format('DROP POLICY %I ON public.profiles', policy_record.policyname);
  END LOOP;
END $$;

REVOKE ALL ON public.profiles FROM PUBLIC, anon;
REVOKE INSERT, DELETE, TRUNCATE, REFERENCES, TRIGGER ON public.profiles FROM authenticated;
GRANT SELECT, UPDATE ON public.profiles TO authenticated;
GRANT ALL ON public.profiles TO service_role;

CREATE POLICY profiles_authorized_read ON public.profiles FOR SELECT TO authenticated
  USING (private.can_read_profile(user_id));
CREATE POLICY profiles_safe_update ON public.profiles FOR UPDATE TO authenticated
  USING (user_id = (SELECT auth.uid()) OR private.can_manage_child_profile(user_id))
  WITH CHECK (user_id = (SELECT auth.uid()) OR private.can_manage_child_profile(user_id));

CREATE OR REPLACE FUNCTION private.guard_profile_authority()
RETURNS trigger LANGUAGE plpgsql SET search_path = ''
AS $$
BEGIN
  -- Check the request role as well as current_user so an exposed definer RPC
  -- cannot bypass this boundary by changing the SQL execution role.
  IF current_user IN ('anon', 'authenticated')
     OR coalesce(auth.jwt()->>'role', '') IN ('anon', 'authenticated') THEN
    IF (to_jsonb(NEW) - ARRAY['username','first_name','last_name','grade_level',
          'settings','updated_at','survey_completed','onboarding_completed','onboarding_step','active_role'])
       IS DISTINCT FROM
       (to_jsonb(OLD) - ARRAY['username','first_name','last_name','grade_level',
          'settings','updated_at','survey_completed','onboarding_completed','onboarding_step','active_role']) THEN
      RAISE EXCEPTION 'Profile authority and billing fields require a trusted server operation'
        USING ERRCODE = '42501';
    END IF;
    IF NEW.active_role IS DISTINCT FROM OLD.active_role THEN
      IF OLD.user_id IS DISTINCT FROM auth.uid()
         OR NEW.active_role IS NULL
         OR NOT coalesce((
           NEW.active_role = OLD.role
           OR (jsonb_typeof(OLD.additional_roles) = 'array'
               AND OLD.additional_roles @> jsonb_build_array(NEW.active_role::text))
         ), false) THEN
        RAISE EXCEPTION 'Requested role is not assigned to this account' USING ERRCODE = '42501';
      END IF;
    END IF;
  END IF;
  RETURN NEW;
END;
$$;
REVOKE ALL ON FUNCTION private.guard_profile_authority() FROM PUBLIC, anon, authenticated;
DROP TRIGGER IF EXISTS zz_guard_profile_authority ON public.profiles;
CREATE TRIGGER zz_guard_profile_authority BEFORE UPDATE ON public.profiles
  FOR EACH ROW EXECUTE FUNCTION private.guard_profile_authority();

DROP POLICY IF EXISTS "System can manage generation queue" ON public.course_generation_queue;
DROP POLICY IF EXISTS "System can manage generation cache" ON public.course_generation_cache;
DROP POLICY IF EXISTS "System can manage user analytics" ON public.user_analytics;
REVOKE ALL ON public.course_generation_cache FROM PUBLIC, anon, authenticated;
REVOKE ALL ON public.course_generation_queue, public.user_analytics FROM PUBLIC, anon;
REVOKE INSERT, UPDATE, DELETE, TRUNCATE, REFERENCES, TRIGGER
  ON public.course_generation_queue, public.user_analytics FROM authenticated;
GRANT SELECT ON public.course_generation_queue, public.user_analytics TO authenticated;
GRANT ALL ON public.course_generation_queue, public.course_generation_cache, public.user_analytics TO service_role;

-- Invites grant organisation membership and roles through the signup API.
-- Every app caller uses a server operation; clients must not enumerate or forge them.
REVOKE ALL ON public.invite_codes FROM PUBLIC, anon, authenticated;
GRANT ALL ON public.invite_codes TO service_role;

-- Internal functions must not remain an alternate public mutation path.
REVOKE ALL ON FUNCTION public.dequeue_course_job(text), public.release_course_job(uuid),
  public.complete_course_job(uuid), public.cleanup_stale_course_jobs(),
  public.restart_stuck_job(uuid), public.update_task_status_direct(uuid,text,jsonb),
  public.check_job_health(), public.generate_password_reset_code(text)
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.dequeue_course_job(text), public.release_course_job(uuid),
  public.complete_course_job(uuid), public.cleanup_stale_course_jobs(),
  public.restart_stuck_job(uuid), public.update_task_status_direct(uuid,text,jsonb),
  public.check_job_health(), public.generate_password_reset_code(text) TO service_role;

-- Role switching remains available only for an authenticated caller, and the
-- profile trigger checks assignments even when this SECURITY DEFINER RPC runs.
REVOKE ALL ON FUNCTION public.switch_user_role(public.role) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.switch_user_role(public.role) TO authenticated, service_role;

COMMIT;
