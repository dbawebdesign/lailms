-- Migration to add gradebook automation
-- This migration creates functions and triggers to automatically:
-- 1. Populate assignments when class instances are created
-- 2. Sync grades when students complete assessments

-- Function to populate assignments from assessments for a class instance
CREATE OR REPLACE FUNCTION populate_assignments_from_assessments(p_class_instance_id UUID)
RETURNS VOID AS $$
DECLARE
    v_base_class_id UUID;
    v_assessment RECORD;
    v_assignment_type assignment_type;
    v_assignment_name TEXT;
    v_assignment_description TEXT;
    v_points_possible DECIMAL(10,2);
    v_due_date TIMESTAMPTZ;
BEGIN
    -- Get the base class ID for this instance
    SELECT base_class_id INTO v_base_class_id
    FROM class_instances
    WHERE id = p_class_instance_id;

    IF v_base_class_id IS NULL THEN
        RETURN;
    END IF;

    -- Loop through all assessments for this base class
    FOR v_assessment IN
        SELECT 
            a.id,
            a.title,
            a.description,
            a.assessment_type,
            a.passing_score_percentage,
            a.time_limit_minutes,
            a.lesson_id,
            a.path_id,
            l.title as lesson_title,
            p.title as path_title,
            -- Calculate points based on questions
            COALESCE(
                (SELECT SUM(aq.points) FROM assessment_questions aq WHERE aq.assessment_id = a.id),
                100
            ) as total_points
        FROM assessments a
        LEFT JOIN lessons l ON a.lesson_id = l.id
        LEFT JOIN paths p ON a.path_id = p.id
        WHERE a.base_class_id = v_base_class_id
        AND a.is_published = true
        ORDER BY 
            CASE 
                WHEN a.assessment_type = 'lesson' THEN 1
                WHEN a.assessment_type = 'path' THEN 2 
                WHEN a.assessment_type = 'class' THEN 3
                ELSE 4
            END,
            a.created_at
    LOOP
        -- Determine assignment type mapping
        v_assignment_type := CASE 
            WHEN v_assessment.assessment_type = 'lesson' THEN 'quiz'::assignment_type
            WHEN v_assessment.assessment_type = 'path' THEN 'exam'::assignment_type
            WHEN v_assessment.assessment_type = 'class' THEN 'exam'::assignment_type
            ELSE 'quiz'::assignment_type
        END;

        -- Build assignment name
        v_assignment_name := CASE 
            WHEN v_assessment.assessment_type = 'lesson' THEN 
                COALESCE(v_assessment.lesson_title, 'Lesson') || ' - ' || v_assessment.title
            WHEN v_assessment.assessment_type = 'path' THEN 
                COALESCE(v_assessment.path_title, 'Path') || ' - ' || v_assessment.title
            ELSE 
                v_assessment.title
        END;

        -- Build assignment description
        v_assignment_description := COALESCE(v_assessment.description, '');
        
        -- Set points possible
        v_points_possible := COALESCE(v_assessment.total_points, 100);

        -- Set due date (optional, could be based on time limit or null)
        v_due_date := NULL;

        -- Insert assignment if it doesn't already exist
        INSERT INTO assignments (
            class_instance_id,
            name,
            description,
            type,
            category,
            points_possible,
            due_date,
            published,
            created_at,
            updated_at
        ) 
        SELECT 
            p_class_instance_id,
            v_assignment_name,
            v_assignment_description,
            v_assignment_type,
            CASE 
                WHEN v_assessment.assessment_type = 'lesson' THEN 'Lesson Assessments'
                WHEN v_assessment.assessment_type = 'path' THEN 'Path Quizzes'
                WHEN v_assessment.assessment_type = 'class' THEN 'Class Exams'
                ELSE 'Assessments'
            END,
            v_points_possible,
            v_due_date,
            true, -- Published by default
            NOW(),
            NOW()
        WHERE NOT EXISTS (
            -- Check if assignment already exists for this assessment
            SELECT 1 FROM assignments 
            WHERE class_instance_id = p_class_instance_id 
            AND name = v_assignment_name
        );

        -- Create grade records for all enrolled students
        INSERT INTO grades (
            assignment_id,
            student_id,
            class_instance_id,
            points_earned,
            percentage,
            status,
            created_at,
            updated_at
        )
        SELECT 
            a.id,
            r.member_id,
            p_class_instance_id,
            NULL, -- No points earned yet
            NULL, -- No percentage yet
            'pending'::grade_status,
            NOW(),
            NOW()
        FROM assignments a
        CROSS JOIN rosters r
        WHERE a.class_instance_id = p_class_instance_id
        AND a.name = v_assignment_name
        AND r.class_instance_id = p_class_instance_id
        AND NOT EXISTS (
            -- Don't create duplicate grade records
            SELECT 1 FROM grades g
            WHERE g.assignment_id = a.id
            AND g.student_id = r.member_id
        );

    END LOOP;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to sync grades from assessment attempts
CREATE OR REPLACE FUNCTION sync_grade_from_assessment_attempt(p_attempt_id UUID)
RETURNS VOID AS $$
DECLARE
    v_attempt RECORD;
    v_assignment_id UUID;
    v_points_earned DECIMAL(10,2);
    v_percentage DECIMAL(5,2);
    v_class_instance_id UUID;
    v_assignment_name TEXT;
BEGIN
    -- Get the attempt details
    SELECT 
        sa.id,
        sa.student_id,
        sa.assessment_id,
        sa.total_points_earned,
        sa.percentage_score,
        sa.completed_at,
        sa.is_passing,
        a.title as assessment_title,
        a.assessment_type,
        a.base_class_id,
        a.lesson_id,
        a.path_id,
        l.title as lesson_title,
        p.title as path_title
    INTO v_attempt
    FROM student_attempts sa
    JOIN assessments a ON sa.assessment_id = a.id
    LEFT JOIN lessons l ON a.lesson_id = l.id
    LEFT JOIN paths p ON a.path_id = p.id
    WHERE sa.id = p_attempt_id
    AND sa.status = 'completed';

    IF v_attempt.id IS NULL THEN
        RETURN; -- Attempt not found or not completed
    END IF;

    -- Build assignment name to match what was created
    v_assignment_name := CASE 
        WHEN v_attempt.assessment_type = 'lesson' THEN 
            COALESCE(v_attempt.lesson_title, 'Lesson') || ' - ' || v_attempt.assessment_title
        WHEN v_attempt.assessment_type = 'path' THEN 
            COALESCE(v_attempt.path_title, 'Path') || ' - ' || v_attempt.assessment_title
        ELSE 
            v_attempt.assessment_title
    END;

    -- Find the corresponding assignment and class instance
    SELECT 
        a.id,
        a.class_instance_id,
        a.points_possible
    INTO v_assignment_id, v_class_instance_id, v_points_earned
    FROM assignments a
    JOIN class_instances ci ON a.class_instance_id = ci.id
    WHERE ci.base_class_id = v_attempt.base_class_id
    AND a.name = v_assignment_name;

    IF v_assignment_id IS NULL THEN
        RETURN; -- No matching assignment found
    END IF;

    -- Calculate points and percentage
    v_points_earned := COALESCE(v_attempt.total_points_earned, 0);
    v_percentage := COALESCE(v_attempt.percentage_score, 0);

    -- Update or insert the grade
    INSERT INTO grades (
        assignment_id,
        student_id,
        class_instance_id,
        points_earned,
        percentage,
        status,
        submitted_at,
        graded_at,
        created_at,
        updated_at
    ) VALUES (
        v_assignment_id,
        v_attempt.student_id,
        v_class_instance_id,
        v_points_earned,
        v_percentage,
        'graded'::grade_status,
        v_attempt.completed_at,
        v_attempt.completed_at,
        NOW(),
        NOW()
    )
    ON CONFLICT (assignment_id, student_id)
    DO UPDATE SET
        points_earned = EXCLUDED.points_earned,
        percentage = EXCLUDED.percentage,
        status = EXCLUDED.status,
        submitted_at = EXCLUDED.submitted_at,
        graded_at = EXCLUDED.graded_at,
        updated_at = NOW();

END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to add assignments for new students when they join a class
CREATE OR REPLACE FUNCTION create_grades_for_new_student(p_class_instance_id UUID, p_student_id UUID)
RETURNS VOID AS $$
BEGIN
    -- Create grade records for all assignments in this class
    INSERT INTO grades (
        assignment_id,
        student_id,
        class_instance_id,
        points_earned,
        percentage,
        status,
        created_at,
        updated_at
    )
    SELECT 
        a.id,
        p_student_id,
        p_class_instance_id,
        NULL, -- No points earned yet
        NULL, -- No percentage yet
        'pending'::grade_status,
        NOW(),
        NOW()
    FROM assignments a
    WHERE a.class_instance_id = p_class_instance_id
    AND a.published = true
    AND NOT EXISTS (
        -- Don't create duplicate grade records
        SELECT 1 FROM grades g
        WHERE g.assignment_id = a.id
        AND g.student_id = p_student_id
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Trigger function to populate assignments when class instance is created
CREATE OR REPLACE FUNCTION trigger_populate_assignments_on_class_creation()
RETURNS TRIGGER AS $$
BEGIN
    -- Populate assignments from assessments for the new class instance
    PERFORM populate_assignments_from_assessments(NEW.id);
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger function to sync grades when student completes assessment
CREATE OR REPLACE FUNCTION trigger_sync_grade_on_assessment_completion()
RETURNS TRIGGER AS $$
BEGIN
    -- Only sync if the attempt was just completed
    IF NEW.status = 'completed' AND (OLD.status IS NULL OR OLD.status != 'completed') THEN
        PERFORM sync_grade_from_assessment_attempt(NEW.id);
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger function to create grades when student joins class
CREATE OR REPLACE FUNCTION trigger_create_grades_on_student_enrollment()
RETURNS TRIGGER AS $$
BEGIN
    -- Create grade records for the new student
    PERFORM create_grades_for_new_student(NEW.class_instance_id, NEW.member_id);
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger function to populate assignments when new assessments are created
CREATE OR REPLACE FUNCTION trigger_populate_assignments_on_assessment_creation()
RETURNS TRIGGER AS $$
DECLARE
    v_class_instance RECORD;
BEGIN
    -- Only proceed if the assessment is published
    IF NEW.is_published = true THEN
        -- Find all class instances for this base class and populate assignments
        FOR v_class_instance IN
            SELECT id FROM class_instances 
            WHERE base_class_id = NEW.base_class_id
        LOOP
            PERFORM populate_assignments_from_assessments(v_class_instance.id);
        END LOOP;
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create triggers

-- Trigger to populate assignments when class instance is created
CREATE TRIGGER populate_assignments_on_class_creation
    AFTER INSERT ON class_instances
    FOR EACH ROW
    EXECUTE FUNCTION trigger_populate_assignments_on_class_creation();

-- Trigger to sync grades when student completes assessment
CREATE TRIGGER sync_grade_on_assessment_completion
    AFTER UPDATE ON student_attempts
    FOR EACH ROW
    EXECUTE FUNCTION trigger_sync_grade_on_assessment_completion();

-- Trigger to create grades when student joins class
CREATE TRIGGER create_grades_on_student_enrollment
    AFTER INSERT ON rosters
    FOR EACH ROW
    EXECUTE FUNCTION trigger_create_grades_on_student_enrollment();

-- Trigger to populate assignments when new assessments are created/published
CREATE TRIGGER populate_assignments_on_assessment_creation
    AFTER INSERT OR UPDATE ON assessments
    FOR EACH ROW
    EXECUTE FUNCTION trigger_populate_assignments_on_assessment_creation();

-- Grant execute permissions
GRANT EXECUTE ON FUNCTION populate_assignments_from_assessments(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION sync_grade_from_assessment_attempt(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION create_grades_for_new_student(UUID, UUID) TO authenticated;

-- Add unique constraint to prevent duplicate grades
ALTER TABLE grades 
ADD CONSTRAINT IF NOT EXISTS unique_student_assignment_grade 
UNIQUE (student_id, assignment_id);

-- Add comments for documentation
COMMENT ON FUNCTION populate_assignments_from_assessments(UUID) IS 'Automatically populates gradebook assignments from assessments for a class instance';
COMMENT ON FUNCTION sync_grade_from_assessment_attempt(UUID) IS 'Syncs gradebook grades when students complete assessments';
COMMENT ON FUNCTION create_grades_for_new_student(UUID, UUID) IS 'Creates grade records for new students joining a class'; 