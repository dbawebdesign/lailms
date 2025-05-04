-- Migration to complete Task 3 missing items
-- Implements:
-- 1. Enrollment code generation trigger
-- 2. Audit logging triggers
-- 3. Enrollment_code_lookup materialized view
-- 4. Order maintenance triggers
-- 5. Vector support finalization
-- 6. Additional RLS policy fixes

-- ===== 1. Enrollment Code Generation Trigger =====

-- Function for generating enrollment codes
CREATE OR REPLACE FUNCTION public.generate_enrollment_code()
RETURNS TRIGGER AS $$
BEGIN
  -- Only generate if not provided or empty
  IF NEW.enrollment_code IS NULL OR NEW.enrollment_code = '' THEN
    -- Generate a random 8-character code
    NEW.enrollment_code := substring(md5(random()::text) FROM 1 FOR 8);
    
    -- Ensure it's unique (retry if collision)
    WHILE EXISTS(SELECT 1 FROM public.class_instances WHERE enrollment_code = NEW.enrollment_code AND id != NEW.id) LOOP
      NEW.enrollment_code := substring(md5(random()::text) FROM 1 FOR 8);
    END LOOP;
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger for enrollment code generation
DROP TRIGGER IF EXISTS generate_enrollment_code_trigger ON public.class_instances;
CREATE TRIGGER generate_enrollment_code_trigger
BEFORE INSERT OR UPDATE OF enrollment_code ON public.class_instances
FOR EACH ROW
EXECUTE FUNCTION public.generate_enrollment_code();

-- ===== 2. Audit Logging Triggers =====

-- Create audit log function
CREATE OR REPLACE FUNCTION public.log_audit_event()
RETURNS TRIGGER AS $$
DECLARE
  old_data JSONB := NULL;
  new_data JSONB := NULL;
  audit_action public.audit_action;
BEGIN
  -- Determine the audit action
  IF (TG_OP = 'INSERT') THEN
    audit_action := 'INSERT';
    new_data := to_jsonb(NEW);
  ELSIF (TG_OP = 'UPDATE') THEN
    audit_action := 'UPDATE';
    old_data := to_jsonb(OLD);
    new_data := to_jsonb(NEW);
  ELSIF (TG_OP = 'DELETE') THEN
    audit_action := 'DELETE';
    old_data := to_jsonb(OLD);
  END IF;

  -- Insert into audit_logs
  INSERT INTO public.audit_logs (
    table_name,
    record_id,
    action,
    old_data,
    new_data,
    performed_by
  ) VALUES (
    TG_TABLE_NAME,
    CASE 
      WHEN TG_OP = 'DELETE' THEN OLD.id::text
      ELSE NEW.id::text
    END,
    audit_action,
    old_data,
    new_data,
    (SELECT auth.uid()) -- Current user
  );

  RETURN NULL; -- For AFTER triggers
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create audit triggers for each table
-- Only adding for key tables, expand as needed

-- Organisations
DROP TRIGGER IF EXISTS audit_organisations_trigger ON public.organisations;
CREATE TRIGGER audit_organisations_trigger
AFTER INSERT OR UPDATE OR DELETE ON public.organisations
FOR EACH ROW EXECUTE FUNCTION public.log_audit_event();

-- Members
DROP TRIGGER IF EXISTS audit_members_trigger ON public.members;
CREATE TRIGGER audit_members_trigger
AFTER INSERT OR UPDATE OR DELETE ON public.members
FOR EACH ROW EXECUTE FUNCTION public.log_audit_event();

-- Base Classes
DROP TRIGGER IF EXISTS audit_base_classes_trigger ON public.base_classes;
CREATE TRIGGER audit_base_classes_trigger
AFTER INSERT OR UPDATE OR DELETE ON public.base_classes
FOR EACH ROW EXECUTE FUNCTION public.log_audit_event();

-- Class Instances
DROP TRIGGER IF EXISTS audit_class_instances_trigger ON public.class_instances;
CREATE TRIGGER audit_class_instances_trigger
AFTER INSERT OR UPDATE OR DELETE ON public.class_instances
FOR EACH ROW EXECUTE FUNCTION public.log_audit_event();

-- Rosters
DROP TRIGGER IF EXISTS audit_rosters_trigger ON public.rosters;
CREATE TRIGGER audit_rosters_trigger
AFTER INSERT OR UPDATE OR DELETE ON public.rosters
FOR EACH ROW EXECUTE FUNCTION public.log_audit_event();

-- Paths
DROP TRIGGER IF EXISTS audit_paths_trigger ON public.paths;
CREATE TRIGGER audit_paths_trigger
AFTER INSERT OR UPDATE OR DELETE ON public.paths
FOR EACH ROW EXECUTE FUNCTION public.log_audit_event();

-- Lessons
DROP TRIGGER IF EXISTS audit_lessons_trigger ON public.lessons;
CREATE TRIGGER audit_lessons_trigger
AFTER INSERT OR UPDATE OR DELETE ON public.lessons
FOR EACH ROW EXECUTE FUNCTION public.log_audit_event();

-- ===== 3. Enrollment Code Lookup Materialized View =====

-- Create materialized view for quick enrollment code lookup
DROP MATERIALIZED VIEW IF EXISTS public.enrollment_code_lookup;
CREATE MATERIALIZED VIEW public.enrollment_code_lookup AS
SELECT 
  ci.id AS class_instance_id,
  ci.enrollment_code,
  ci.name AS class_name,
  bc.name AS base_class_name,
  bc.organisation_id,
  o.name AS organisation_name
FROM 
  public.class_instances ci
JOIN 
  public.base_classes bc ON ci.base_class_id = bc.id
JOIN 
  public.organisations o ON bc.organisation_id = o.id
WHERE 
  ci.enrollment_code IS NOT NULL;

-- Create index on the enrollment_code for faster lookup
CREATE UNIQUE INDEX idx_enrollment_code_lookup 
ON public.enrollment_code_lookup(enrollment_code);

-- Function to refresh the materialized view when class_instances change
CREATE OR REPLACE FUNCTION public.refresh_enrollment_code_lookup()
RETURNS TRIGGER AS $$
BEGIN
  REFRESH MATERIALIZED VIEW CONCURRENTLY public.enrollment_code_lookup;
  RETURN NULL;
END;
$$ LANGUAGE plpgsql;

-- Trigger to refresh the view when class_instances are modified
DROP TRIGGER IF EXISTS refresh_enrollment_code_lookup_trigger ON public.class_instances;
CREATE TRIGGER refresh_enrollment_code_lookup_trigger
AFTER INSERT OR UPDATE OR DELETE ON public.class_instances
FOR EACH STATEMENT
EXECUTE FUNCTION public.refresh_enrollment_code_lookup();

-- ===== 4. Order Maintenance Triggers =====

-- Function to maintain order_index for lessons
CREATE OR REPLACE FUNCTION public.maintain_lesson_order()
RETURNS TRIGGER AS $$
BEGIN
  -- For new lessons, assign the next order index if not specified
  IF (TG_OP = 'INSERT' AND NEW.order_index IS NULL) THEN
    SELECT COALESCE(MAX(order_index) + 1, 1)
    INTO NEW.order_index
    FROM public.lessons
    WHERE path_id = NEW.path_id;
  
  -- For updates, reindex if order changes
  ELSIF (TG_OP = 'UPDATE' AND OLD.order_index != NEW.order_index) THEN
    -- If moving down (larger index)
    IF NEW.order_index > OLD.order_index THEN
      UPDATE public.lessons
      SET order_index = order_index - 1
      WHERE path_id = NEW.path_id
        AND order_index > OLD.order_index
        AND order_index <= NEW.order_index
        AND id != NEW.id;
    
    -- If moving up (smaller index)
    ELSIF NEW.order_index < OLD.order_index THEN
      UPDATE public.lessons
      SET order_index = order_index + 1
      WHERE path_id = NEW.path_id
        AND order_index >= NEW.order_index
        AND order_index < OLD.order_index
        AND id != NEW.id;
    END IF;
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Lesson ordering trigger
DROP TRIGGER IF EXISTS maintain_lesson_order_trigger ON public.lessons;
CREATE TRIGGER maintain_lesson_order_trigger
BEFORE INSERT OR UPDATE OF order_index ON public.lessons
FOR EACH ROW
EXECUTE FUNCTION public.maintain_lesson_order();

-- Function to handle lesson deletion
CREATE OR REPLACE FUNCTION public.reindex_lessons_after_delete()
RETURNS TRIGGER AS $$
BEGIN
  -- Reindex remaining lessons after deletion
  UPDATE public.lessons
  SET order_index = order_index - 1
  WHERE path_id = OLD.path_id
    AND order_index > OLD.order_index;
  
  RETURN OLD;
END;
$$ LANGUAGE plpgsql;

-- Lesson deletion trigger
DROP TRIGGER IF EXISTS reindex_lessons_after_delete_trigger ON public.lessons;
CREATE TRIGGER reindex_lessons_after_delete_trigger
AFTER DELETE ON public.lessons
FOR EACH ROW
EXECUTE FUNCTION public.reindex_lessons_after_delete();

-- Similar functions for lesson_sections
CREATE OR REPLACE FUNCTION public.maintain_section_order()
RETURNS TRIGGER AS $$
BEGIN
  -- For new sections, assign the next order index if not specified
  IF (TG_OP = 'INSERT' AND NEW.order_index IS NULL) THEN
    SELECT COALESCE(MAX(order_index) + 1, 1)
    INTO NEW.order_index
    FROM public.lesson_sections
    WHERE lesson_id = NEW.lesson_id;
  
  -- For updates, reindex if order changes
  ELSIF (TG_OP = 'UPDATE' AND OLD.order_index != NEW.order_index) THEN
    -- If moving down (larger index)
    IF NEW.order_index > OLD.order_index THEN
      UPDATE public.lesson_sections
      SET order_index = order_index - 1
      WHERE lesson_id = NEW.lesson_id
        AND order_index > OLD.order_index
        AND order_index <= NEW.order_index
        AND id != NEW.id;
    
    -- If moving up (smaller index)
    ELSIF NEW.order_index < OLD.order_index THEN
      UPDATE public.lesson_sections
      SET order_index = order_index + 1
      WHERE lesson_id = NEW.lesson_id
        AND order_index >= NEW.order_index
        AND order_index < OLD.order_index
        AND id != NEW.id;
    END IF;
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Section ordering trigger
DROP TRIGGER IF EXISTS maintain_section_order_trigger ON public.lesson_sections;
CREATE TRIGGER maintain_section_order_trigger
BEFORE INSERT OR UPDATE OF order_index ON public.lesson_sections
FOR EACH ROW
EXECUTE FUNCTION public.maintain_section_order();

-- Function to handle section deletion
CREATE OR REPLACE FUNCTION public.reindex_sections_after_delete()
RETURNS TRIGGER AS $$
BEGIN
  -- Reindex remaining sections after deletion
  UPDATE public.lesson_sections
  SET order_index = order_index - 1
  WHERE lesson_id = OLD.lesson_id
    AND order_index > OLD.order_index;
  
  RETURN OLD;
END;
$$ LANGUAGE plpgsql;

-- Section deletion trigger
DROP TRIGGER IF EXISTS reindex_sections_after_delete_trigger ON public.lesson_sections;
CREATE TRIGGER reindex_sections_after_delete_trigger
AFTER DELETE ON public.lesson_sections
FOR EACH ROW
EXECUTE FUNCTION public.reindex_sections_after_delete();

-- ===== 5. Vector Support Finalization =====

-- Uncomment vector columns in lesson_sections
ALTER TABLE public.lesson_sections ADD COLUMN IF NOT EXISTS content_embedding vector(1536);

-- Create vector index for efficient similarity search
CREATE INDEX IF NOT EXISTS idx_lesson_sections_embedding ON public.lesson_sections 
USING ivfflat (content_embedding vector_l2_ops) WITH (lists = 100);

-- Uncomment vector columns in ui_contexts
ALTER TABLE public.ui_contexts ADD COLUMN IF NOT EXISTS context_embedding vector(1536);

-- Create vector index for ui_contexts
CREATE INDEX IF NOT EXISTS idx_ui_contexts_embedding ON public.ui_contexts 
USING ivfflat (context_embedding vector_l2_ops) WITH (lists = 100);

-- ===== 6. Additional RLS Policy Fixes =====

-- Fix: Ensure SUPER_ADMIN can view all data across organisations
DROP POLICY IF EXISTS "Allow super admin access" ON public.organisations;
CREATE POLICY "Allow super admin access" ON public.organisations
  FOR ALL
  USING (public.get_my_role() = 'SUPER_ADMIN')
  WITH CHECK (public.get_my_role() = 'SUPER_ADMIN');

-- Expand to all tables that need super admin access
DO $$ 
DECLARE
  table_name TEXT;
BEGIN
  FOR table_name IN 
    SELECT tablename FROM pg_tables 
    WHERE schemaname = 'public' 
    AND tablename NOT LIKE 'pg_%'
  LOOP
    EXECUTE format('
      DROP POLICY IF EXISTS "Allow super admin access" ON public.%I;
      CREATE POLICY "Allow super admin access" ON public.%I
        FOR ALL
        USING (public.get_my_role() = ''SUPER_ADMIN'')
        WITH CHECK (public.get_my_role() = ''SUPER_ADMIN'')
    ', table_name, table_name);
  END LOOP;
END $$; 