-- Create Gradebook System Migration
-- This migration creates a complete gradebook system with proper RLS policies

-- Create enums for gradebook system
CREATE TYPE assignment_type AS ENUM ('quiz', 'homework', 'project', 'exam', 'discussion', 'lab');
CREATE TYPE grade_status AS ENUM ('graded', 'missing', 'late', 'excused', 'pending');
CREATE TYPE mastery_level AS ENUM ('below', 'approaching', 'proficient', 'advanced');

-- Create assignments table
CREATE TABLE assignments (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    class_instance_id UUID REFERENCES class_instances(id) ON DELETE CASCADE,
    name VARCHAR(255) NOT NULL,
    description TEXT,
    type assignment_type NOT NULL,
    category VARCHAR(100),
    points_possible DECIMAL(10,2) NOT NULL CHECK (points_possible >= 0),
    due_date TIMESTAMPTZ,
    published BOOLEAN DEFAULT false,
    created_by UUID REFERENCES profiles(user_id) ON DELETE SET NULL,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create grades table
CREATE TABLE grades (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    assignment_id UUID REFERENCES assignments(id) ON DELETE CASCADE,
    student_id UUID REFERENCES profiles(user_id) ON DELETE CASCADE,
    class_instance_id UUID REFERENCES class_instances(id) ON DELETE CASCADE,
    points_earned DECIMAL(10,2) CHECK (points_earned >= 0),
    percentage DECIMAL(5,2) CHECK (percentage >= 0 AND percentage <= 100),
    status grade_status DEFAULT 'pending',
    feedback TEXT,
    submitted_at TIMESTAMPTZ,
    graded_at TIMESTAMPTZ,
    graded_by UUID REFERENCES profiles(user_id) ON DELETE SET NULL,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create standards table
CREATE TABLE standards (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    organisation_id UUID REFERENCES organisations(id) ON DELETE CASCADE,
    name VARCHAR(255) NOT NULL,
    description TEXT,
    category VARCHAR(100),
    created_by UUID REFERENCES profiles(user_id) ON DELETE SET NULL,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create assignment_standards junction table
CREATE TABLE assignment_standards (
    assignment_id UUID REFERENCES assignments(id) ON DELETE CASCADE,
    standard_id UUID REFERENCES standards(id) ON DELETE CASCADE,
    PRIMARY KEY (assignment_id, standard_id)
);

-- Create gradebook_settings table
CREATE TABLE gradebook_settings (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    class_instance_id UUID REFERENCES class_instances(id) ON DELETE CASCADE UNIQUE,
    settings JSONB NOT NULL DEFAULT '{}',
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Enable RLS on all tables
ALTER TABLE assignments ENABLE ROW LEVEL SECURITY;
ALTER TABLE grades ENABLE ROW LEVEL SECURITY;
ALTER TABLE standards ENABLE ROW LEVEL SECURITY;
ALTER TABLE assignment_standards ENABLE ROW LEVEL SECURITY;
ALTER TABLE gradebook_settings ENABLE ROW LEVEL SECURITY;

-- RLS Policies for assignments table
-- Teachers can manage all assignments for their classes
CREATE POLICY "Teachers can manage assignments for their classes" ON assignments
    FOR ALL USING (
        EXISTS (
            SELECT 1 FROM class_instances ci
            JOIN base_classes bc ON ci.base_class_id = bc.id
            WHERE ci.id = assignments.class_instance_id
            AND bc.user_id = auth.uid()
        )
    );

-- Students can view published assignments for their enrolled classes
CREATE POLICY "Students can view published assignments for enrolled classes" ON assignments
    FOR SELECT USING (
        published = true
        AND EXISTS (
            SELECT 1 FROM rosters r
            WHERE r.class_instance_id = assignments.class_instance_id
            AND r.user_id = auth.uid()
        )
    );

-- RLS Policies for grades table
-- Teachers can manage all grades for their classes
CREATE POLICY "Teachers can manage grades for their classes" ON grades
    FOR ALL USING (
        EXISTS (
            SELECT 1 FROM class_instances ci
            JOIN base_classes bc ON ci.base_class_id = bc.id
            WHERE ci.id = grades.class_instance_id
            AND bc.user_id = auth.uid()
        )
    );

-- Students can view only their own grades
CREATE POLICY "Students can view their own grades" ON grades
    FOR SELECT USING (
        student_id = auth.uid()
    );

-- RLS Policies for standards table
-- Teachers can manage standards for their organization
CREATE POLICY "Teachers can manage standards for their organization" ON standards
    FOR ALL USING (
        EXISTS (
            SELECT 1 FROM profiles p
            WHERE p.user_id = auth.uid()
            AND p.organisation_id = standards.organisation_id
        )
    );

-- RLS Policies for assignment_standards table
-- Teachers can manage assignment standards for their assignments
CREATE POLICY "Teachers can manage assignment standards" ON assignment_standards
    FOR ALL USING (
        EXISTS (
            SELECT 1 FROM assignments a
            JOIN class_instances ci ON a.class_instance_id = ci.id
            JOIN base_classes bc ON ci.base_class_id = bc.id
            WHERE a.id = assignment_standards.assignment_id
            AND bc.user_id = auth.uid()
        )
    );

-- Students can view assignment standards for their enrolled classes
CREATE POLICY "Students can view assignment standards for enrolled classes" ON assignment_standards
    FOR SELECT USING (
        EXISTS (
            SELECT 1 FROM assignments a
            JOIN rosters r ON a.class_instance_id = r.class_instance_id
            WHERE a.id = assignment_standards.assignment_id
            AND r.user_id = auth.uid()
            AND a.published = true
        )
    );

-- RLS Policies for gradebook_settings table
-- Teachers can manage gradebook settings for their classes
CREATE POLICY "Teachers can manage gradebook settings for their classes" ON gradebook_settings
    FOR ALL USING (
        EXISTS (
            SELECT 1 FROM class_instances ci
            JOIN base_classes bc ON ci.base_class_id = bc.id
            WHERE ci.id = gradebook_settings.class_instance_id
            AND bc.user_id = auth.uid()
        )
    );

-- Create indexes for performance
CREATE INDEX idx_assignments_class_instance_id ON assignments(class_instance_id);
CREATE INDEX idx_assignments_type ON assignments(type);
CREATE INDEX idx_assignments_due_date ON assignments(due_date);
CREATE INDEX idx_assignments_published ON assignments(published);

CREATE INDEX idx_grades_assignment_id ON grades(assignment_id);
CREATE INDEX idx_grades_student_id ON grades(student_id);
CREATE INDEX idx_grades_class_instance_id ON grades(class_instance_id);
CREATE INDEX idx_grades_status ON grades(status);
CREATE INDEX idx_grades_graded_at ON grades(graded_at);

CREATE INDEX idx_standards_organisation_id ON standards(organisation_id);
CREATE INDEX idx_standards_category ON standards(category);

CREATE INDEX idx_gradebook_settings_class_instance_id ON gradebook_settings(class_instance_id);

-- Create triggers for updated_at timestamps
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

CREATE TRIGGER update_assignments_updated_at BEFORE UPDATE ON assignments
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_grades_updated_at BEFORE UPDATE ON grades
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_standards_updated_at BEFORE UPDATE ON standards
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_gradebook_settings_updated_at BEFORE UPDATE ON gradebook_settings
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Create audit triggers if audit_logs table exists
DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'audit_logs') THEN
        -- Create audit trigger function
        CREATE OR REPLACE FUNCTION audit_trigger_function()
        RETURNS TRIGGER AS $audit$
        BEGIN
            IF TG_OP = 'DELETE' THEN
                INSERT INTO audit_logs (table_name, record_id, action, old_data, performed_by)
                VALUES (TG_TABLE_NAME, OLD.id::text, TG_OP::audit_action, row_to_json(OLD), auth.uid());
                RETURN OLD;
            ELSIF TG_OP = 'UPDATE' THEN
                INSERT INTO audit_logs (table_name, record_id, action, old_data, new_data, performed_by)
                VALUES (TG_TABLE_NAME, NEW.id::text, TG_OP::audit_action, row_to_json(OLD), row_to_json(NEW), auth.uid());
                RETURN NEW;
            ELSIF TG_OP = 'INSERT' THEN
                INSERT INTO audit_logs (table_name, record_id, action, new_data, performed_by)
                VALUES (TG_TABLE_NAME, NEW.id::text, TG_OP::audit_action, row_to_json(NEW), auth.uid());
                RETURN NEW;
            END IF;
            RETURN NULL;
        END;
        $audit$ LANGUAGE plpgsql;

        -- Create audit triggers
        CREATE TRIGGER assignments_audit_trigger
            AFTER INSERT OR UPDATE OR DELETE ON assignments
            FOR EACH ROW EXECUTE FUNCTION audit_trigger_function();

        CREATE TRIGGER grades_audit_trigger
            AFTER INSERT OR UPDATE OR DELETE ON grades
            FOR EACH ROW EXECUTE FUNCTION audit_trigger_function();

        CREATE TRIGGER standards_audit_trigger
            AFTER INSERT OR UPDATE OR DELETE ON standards
            FOR EACH ROW EXECUTE FUNCTION audit_trigger_function();

        CREATE TRIGGER gradebook_settings_audit_trigger
            AFTER INSERT OR UPDATE OR DELETE ON gradebook_settings
            FOR EACH ROW EXECUTE FUNCTION audit_trigger_function();
    END IF;
END $$;

-- Grant necessary permissions
GRANT USAGE ON SCHEMA public TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON assignments TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON grades TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON standards TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON assignment_standards TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON gradebook_settings TO authenticated;

-- Create helper functions for gradebook calculations
CREATE OR REPLACE FUNCTION calculate_assignment_statistics(assignment_uuid UUID)
RETURNS JSONB AS $$
DECLARE
    stats JSONB;
BEGIN
    SELECT jsonb_build_object(
        'total_submissions', COUNT(*),
        'graded_submissions', COUNT(*) FILTER (WHERE status = 'graded'),
        'average_score', ROUND(AVG(percentage), 2),
        'highest_score', MAX(percentage),
        'lowest_score', MIN(percentage),
        'missing_submissions', COUNT(*) FILTER (WHERE status = 'missing'),
        'late_submissions', COUNT(*) FILTER (WHERE status = 'late')
    ) INTO stats
    FROM grades
    WHERE assignment_id = assignment_uuid;
    
    RETURN stats;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE OR REPLACE FUNCTION calculate_student_grade_summary(student_uuid UUID, class_instance_uuid UUID)
RETURNS JSONB AS $$
DECLARE
    summary JSONB;
BEGIN
    SELECT jsonb_build_object(
        'total_points_possible', SUM(a.points_possible),
        'total_points_earned', SUM(g.points_earned),
        'overall_percentage', ROUND(
            CASE 
                WHEN SUM(a.points_possible) > 0 THEN (SUM(g.points_earned) / SUM(a.points_possible)) * 100
                ELSE 0
            END, 2
        ),
        'assignment_count', COUNT(DISTINCT a.id),
        'graded_count', COUNT(*) FILTER (WHERE g.status = 'graded'),
        'missing_count', COUNT(*) FILTER (WHERE g.status = 'missing'),
        'late_count', COUNT(*) FILTER (WHERE g.status = 'late')
    ) INTO summary
    FROM assignments a
    LEFT JOIN grades g ON a.id = g.assignment_id AND g.student_id = student_uuid
    WHERE a.class_instance_id = class_instance_uuid
    AND a.published = true;
    
    RETURN summary;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Grant execute permissions on functions
GRANT EXECUTE ON FUNCTION calculate_assignment_statistics(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION calculate_student_grade_summary(UUID, UUID) TO authenticated;

-- Add comments for documentation
COMMENT ON TABLE assignments IS 'Stores assignment information for gradebook system';
COMMENT ON TABLE grades IS 'Stores individual student grades for assignments';
COMMENT ON TABLE standards IS 'Stores academic standards that can be linked to assignments';
COMMENT ON TABLE assignment_standards IS 'Junction table linking assignments to standards';
COMMENT ON TABLE gradebook_settings IS 'Stores class-specific gradebook configuration';

COMMENT ON FUNCTION calculate_assignment_statistics(UUID) IS 'Calculates statistics for a specific assignment';
COMMENT ON FUNCTION calculate_student_grade_summary(UUID, UUID) IS 'Calculates grade summary for a student in a specific class'; 