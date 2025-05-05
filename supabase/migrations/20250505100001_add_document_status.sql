-- supabase/migrations/20250505100001_add_document_status.sql

-- Create the ENUM type for document status (if it doesn't exist from consolidated schema)
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'document_status') THEN
    CREATE TYPE public.document_status AS ENUM (
      'queued',
      'processing',
      'completed',
      'error'
    );
  END IF;
END$$;

-- Ensure the status column exists and alter its type and default
-- (Handles case where consolidated schema might have already created it with TEXT)
ALTER TABLE public.documents
  DROP CONSTRAINT IF EXISTS documents_status_check; -- Drop old check constraints if any

ALTER TABLE public.documents
  ALTER COLUMN status DROP DEFAULT;

ALTER TABLE public.documents
  ALTER COLUMN status TYPE public.document_status USING status::public.document_status;

ALTER TABLE public.documents
  ALTER COLUMN status SET DEFAULT 'queued';

-- Add the other columns ONLY IF THEY DON'T EXIST (handled by consolidated schema?)
-- Commenting these out as they likely exist from the consolidated schema run
-- ALTER TABLE public.documents
--  ADD COLUMN processing_error TEXT NULL,
--  ADD COLUMN metadata JSONB NULL;

-- RLS policies were likely created in the consolidated schema or earlier scripts

-- Comment: Consider adding an index on the status column if you frequently query by status.
-- CREATE INDEX idx_documents_status ON public.documents(status); 