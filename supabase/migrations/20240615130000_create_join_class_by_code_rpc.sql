-- supabase/migrations/20240615130000_create_join_class_by_code_rpc.sql
BEGIN;

CREATE OR REPLACE FUNCTION public.join_class_by_code(p_enrollment_code TEXT)
RETURNS TABLE (
    success BOOLEAN,
    message TEXT,
    class_instance_id uuid,
    class_instance_name TEXT,
    enrollment_id uuid
)
LANGUAGE plpgsql
SECURITY DEFINER -- Important: To allow insertion into student_enrollments table by bypassing RLS if needed for this specific controlled action
AS $$
DECLARE
    v_user_id uuid := auth.uid();
    v_class_instance RECORD;
    v_student_som RECORD;
    v_existing_enrollment RECORD;
    v_current_enrollment_count INT;
    v_new_enrollment_id uuid;
BEGIN
    -- 1. Find the class instance by enrollment code
    SELECT ci.id, ci.name, ci.organisation_id, ci.start_date, ci.end_date, ci.settings -- Added start_date, end_date for status check, removed ci.status
    INTO v_class_instance
    FROM public.class_instances ci
    WHERE ci.enrollment_code = p_enrollment_code;

    IF NOT FOUND THEN
        RETURN QUERY SELECT FALSE, 'Invalid enrollment code.', NULL::uuid, NULL::text, NULL::uuid;
        RETURN;
    END IF;

    -- 2. Check if class instance is joinable (based on dates)
    IF v_class_instance.end_date IS NOT NULL AND v_class_instance.end_date::date < current_date THEN
        RETURN QUERY SELECT FALSE, 'This class has already ended and is no longer available for enrollment.', v_class_instance.id, v_class_instance.name, NULL::uuid;
        RETURN;
    END IF;
    -- If start_date is in the future, it's 'upcoming' and joinable.
    -- If start_date is past/today AND end_date is future/today or null, it's 'active' and joinable.
    -- This simplified check covers these: if it hasn't ended, it's considered joinable.

    -- 3. Get the student's active membership in the class instance's organisation
    SELECT som.id, som.student_user_id, som.organisation_id, som.status
    INTO v_student_som
    FROM public.student_organisation_memberships som
    WHERE som.student_user_id = v_user_id
      AND som.organisation_id = v_class_instance.organisation_id
      AND som.status = 'active';

    IF NOT FOUND THEN
        RETURN QUERY SELECT FALSE, 'You are not an active member of the organisation this class belongs to.', v_class_instance.id, v_class_instance.name, NULL::uuid;
        RETURN;
    END IF;

    -- 4. Check if student is already enrolled
    SELECT se.id
    INTO v_existing_enrollment
    FROM public.student_enrollments se
    WHERE se.class_instance_id = v_class_instance.id
      AND se.student_som_id = v_student_som.id;

    IF FOUND THEN
        RETURN QUERY SELECT TRUE, 'You are already enrolled in this class.', v_class_instance.id, v_class_instance.name, v_existing_enrollment.id;
        RETURN;
    END IF;

    -- 5. Check class capacity
    IF v_class_instance.settings->>'capacity' IS NOT NULL THEN
        SELECT COUNT(*)
        INTO v_current_enrollment_count
        FROM public.student_enrollments se
        WHERE se.class_instance_id = v_class_instance.id
          AND se.status = 'active';

        IF v_current_enrollment_count >= (v_class_instance.settings->>'capacity')::INT THEN
            RETURN QUERY SELECT FALSE, 'This class has reached its maximum capacity.', v_class_instance.id, v_class_instance.name, NULL::uuid;
            RETURN;
        END IF;
    END IF;

    -- 6. Create enrollment record
    INSERT INTO public.student_enrollments (class_instance_id, student_som_id, organisation_id)
    VALUES (v_class_instance.id, v_student_som.id, v_class_instance.organisation_id)
    RETURNING id INTO v_new_enrollment_id;

    RETURN QUERY SELECT TRUE, 'Successfully enrolled in class ' || v_class_instance.name || '.', v_class_instance.id, v_class_instance.name, v_new_enrollment_id;

EXCEPTION
    WHEN OTHERS THEN
        RAISE NOTICE 'Error in join_class_by_code: % - %', SQLSTATE, SQLERRM;
        RETURN QUERY SELECT FALSE, 'An unexpected error occurred during enrollment: ' || SQLERRM, NULL::uuid, NULL::text, NULL::uuid;
END;
$$;

GRANT EXECUTE ON FUNCTION public.join_class_by_code(TEXT) TO authenticated;

COMMIT; 