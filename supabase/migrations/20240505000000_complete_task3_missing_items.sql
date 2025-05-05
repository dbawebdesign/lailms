-- Enable the pgvector extension if it doesn't exist
CREATE EXTENSION IF NOT EXISTS vector SCHEMA extensions;

-- Migration to complete Task 3 missing items
-- Implements:
-- 1. Enrollment code generation trigger
-- 2. Audit logging triggers
-- 3. Enrollment_code_lookup materialized view
-- 4. Order maintenance triggers
-- 5. Vector support finalization
-- 6. Additional RLS policy fixes

-- Generic function to update the updated_at timestamp
CREATE OR REPLACE FUNCTION public.update_timestamp()
RETURNS TRIGGER AS $$
BEGIN
   NEW.updated_at = timezone('utc'::text, now());
   RETURN NEW;
END;
$$ language 'plpgsql';

-- Add enrollment_code column if it doesn't exist (idempotent)
ALTER TABLE public.class_instances
ADD COLUMN IF NOT EXISTS enrollment_code TEXT NULL;

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

-- Create the audit_action ENUM type if it doesn't exist
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'audit_action' AND typnamespace = (SELECT oid FROM pg_namespace WHERE nspname = 'public')) THEN
        CREATE TYPE public.audit_action AS ENUM ('INSERT', 'UPDATE', 'DELETE');
    END IF;
END
$$;

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

-- ===== 4. Order Maintenance Triggers =====

-- Ensure paths table exists first
CREATE TABLE IF NOT EXISTS public.paths (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    organisation_id UUID REFERENCES public.organisations(id) ON DELETE CASCADE, -- Assuming organisations exists
    name TEXT NOT NULL,
    description TEXT,
    settings JSONB,
    created_at TIMESTAMPTZ DEFAULT timezone('utc'::text, now()) NOT NULL,
    updated_at TIMESTAMPTZ DEFAULT timezone('utc'::text, now()) NOT NULL
);
-- Trigger for updating updated_at timestamp on paths
DROP TRIGGER IF EXISTS handle_updated_at_paths ON public.paths;
CREATE TRIGGER handle_updated_at_paths
BEFORE UPDATE ON public.paths
FOR EACH ROW
EXECUTE FUNCTION public.update_timestamp();

-- Ensure lessons table exists before creating lesson_sections
CREATE TABLE IF NOT EXISTS public.lessons (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    path_id UUID REFERENCES public.paths(id) ON DELETE CASCADE,
    title TEXT NOT NULL,
    description TEXT,
    order_index INTEGER DEFAULT 0,
    settings JSONB,
    created_at TIMESTAMPTZ DEFAULT timezone('utc'::text, now()) NOT NULL,
    updated_at TIMESTAMPTZ DEFAULT timezone('utc'::text, now()) NOT NULL
);
-- Trigger for lessons update timestamp
DROP TRIGGER IF EXISTS handle_updated_at_lessons ON public.lessons;
CREATE TRIGGER handle_updated_at_lessons
BEFORE UPDATE ON public.lessons
FOR EACH ROW
EXECUTE FUNCTION public.update_timestamp();

-- Function to maintain order_index for lessons (Moved Earlier)
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

-- Function to handle lesson deletion (Moved Earlier)
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

-- Lesson ordering trigger (Original placement - Now after function definition)
DROP TRIGGER IF EXISTS maintain_lesson_order_trigger ON public.lessons;
CREATE TRIGGER maintain_lesson_order_trigger
BEFORE INSERT OR UPDATE OF order_index ON public.lessons
FOR EACH ROW
EXECUTE FUNCTION public.maintain_lesson_order();

-- Lesson deletion trigger (Original placement - Now after function definition)
DROP TRIGGER IF EXISTS reindex_lessons_after_delete_trigger ON public.lessons;
CREATE TRIGGER reindex_lessons_after_delete_trigger
AFTER DELETE ON public.lessons
FOR EACH ROW
EXECUTE FUNCTION public.reindex_lessons_after_delete();

-- Ensure lesson_sections table exists before creating triggers
CREATE TABLE IF NOT EXISTS public.lesson_sections (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    lesson_id UUID REFERENCES public.lessons(id) ON DELETE CASCADE,
    title TEXT NOT NULL,
    content TEXT,
    order_index INTEGER DEFAULT 0,
    settings JSONB,
    created_at TIMESTAMPTZ DEFAULT timezone('utc'::text, now()) NOT NULL,
    updated_at TIMESTAMPTZ DEFAULT timezone('utc'::text, now()) NOT NULL
);
-- Trigger for lesson_sections update timestamp
DROP TRIGGER IF EXISTS handle_updated_at_lesson_sections ON public.lesson_sections;
CREATE TRIGGER handle_updated_at_lesson_sections
BEFORE UPDATE ON public.lesson_sections
FOR EACH ROW
EXECUTE FUNCTION public.update_timestamp();

-- Similar functions for lesson_sections (maintain_section_order, reindex_sections_after_delete)
-- Function to maintain order_index for sections (Moved Earlier)
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

-- Function to handle section deletion (Moved Earlier)
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

-- Section ordering trigger (Now after function definition)
DROP TRIGGER IF EXISTS maintain_section_order_trigger ON public.lesson_sections;
CREATE TRIGGER maintain_section_order_trigger
BEFORE INSERT OR UPDATE OF order_index ON public.lesson_sections
FOR EACH ROW
EXECUTE FUNCTION public.maintain_section_order();

-- Section deletion trigger (Now after function definition)
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
-- ALTER TABLE public.ui_contexts ADD COLUMN IF NOT EXISTS context_embedding vector(1536);

-- Create vector index for ui_contexts
-- CREATE INDEX IF NOT EXISTS idx_ui_contexts_embedding ON public.ui_contexts 
-- USING ivfflat (context_embedding vector_l2_ops) WITH (lists = 100);

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