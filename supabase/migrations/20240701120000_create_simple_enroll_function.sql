BEGIN;

CREATE OR REPLACE FUNCTION public.enroll_student_in_class(p_enrollment_code TEXT)
RETURNS TABLE (
    success BOOLEAN,
    message TEXT,
    class_instance_id uuid,
    class_instance_name TEXT,
    enrollment_id uuid
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_user_id uuid := auth.uid();
    v_profile RECORD;
    v_class_instance RECORD;
    v_existing_enrollment RECORD;
    v_new_enrollment_id uuid;
BEGIN
    -- 1. Get the user's profile
    SELECT id INTO v_profile FROM public.profiles WHERE user_id = v_user_id;
    IF NOT FOUND THEN
        RETURN QUERY SELECT FALSE, 'Student profile not found.', NULL::uuid, NULL::text, NULL::uuid;
        RETURN;
    END IF;

    -- 2. Find the class instance by enrollment code
    SELECT ci.id, ci.name, bc.organisation_id
    INTO v_class_instance
    FROM public.class_instances ci
    JOIN public.base_classes bc ON ci.base_class_id = bc.id
    WHERE ci.enrollment_code = p_enrollment_code;

    IF NOT FOUND THEN
        RETURN QUERY SELECT FALSE, 'Invalid enrollment code.', NULL::uuid, NULL::text, NULL::uuid;
        RETURN;
    END IF;

    -- 3. Check if student is already enrolled in the roster
    SELECT r.id
    INTO v_existing_enrollment
    FROM public.rosters r
    WHERE r.class_instance_id = v_class_instance.id
      AND r.profile_id = v_profile.id;

    IF FOUND THEN
        RETURN QUERY SELECT TRUE, 'You are already enrolled in this class.', v_class_instance.id, v_class_instance.name, v_existing_enrollment.id;
        RETURN;
    END IF;

    -- 4. Create enrollment record in the roster
    INSERT INTO public.rosters (class_instance_id, profile_id, role)
    VALUES (v_class_instance.id, v_profile.id, 'student')
    RETURNING id INTO v_new_enrollment_id;

    RETURN QUERY SELECT TRUE, 'Successfully enrolled in class ' || v_class_instance.name || '.', v_class_instance.id, v_class_instance.name, v_new_enrollment_id;

EXCEPTION
    WHEN OTHERS THEN
        RAISE NOTICE 'Error in enroll_student_in_class: % - %', SQLSTATE, SQLERRM;
        RETURN QUERY SELECT FALSE, 'An unexpected error occurred: ' || SQLERRM, NULL::uuid, NULL::text, NULL::uuid;
END;
$$;

GRANT EXECUTE ON FUNCTION public.enroll_student_in_class(TEXT) TO authenticated;

COMMIT; 