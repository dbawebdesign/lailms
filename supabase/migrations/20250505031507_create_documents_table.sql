-- Create document_status enum for tracking the status of documents
CREATE TYPE public.document_status AS ENUM (
  'queued',
  'processing',
  'completed',
  'error'
);

-- Create the documents table for knowledge base ingestion
CREATE TABLE IF NOT EXISTS public.documents (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  file_name TEXT NOT NULL,
  storage_path TEXT NOT NULL UNIQUE,
  status public.document_status NOT NULL DEFAULT 'queued'::public.document_status,
  organisation_id UUID NOT NULL REFERENCES public.organisations(id) ON DELETE CASCADE,
  uploaded_by UUID NOT NULL REFERENCES auth.users(id) ON DELETE SET NULL,
  file_type TEXT,
  file_size INTEGER,
  metadata JSONB,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
);

-- Add indexes for better query performance
CREATE INDEX IF NOT EXISTS idx_documents_organisation_id ON public.documents(organisation_id);
CREATE INDEX IF NOT EXISTS idx_documents_uploaded_by ON public.documents(uploaded_by);
CREATE INDEX IF NOT EXISTS idx_documents_status ON public.documents(status);
CREATE INDEX IF NOT EXISTS idx_documents_file_type ON public.documents(file_type);

-- Update the updated_at timestamp automatically
CREATE TRIGGER set_documents_updated_at
BEFORE UPDATE ON public.documents
FOR EACH ROW
EXECUTE FUNCTION public.set_updated_at();

-- Row Level Security (RLS) policies
-- Enable RLS on the documents table
ALTER TABLE public.documents ENABLE ROW LEVEL SECURITY;

-- Policy for document selection - users can only see documents from their organization
CREATE POLICY "Users can view documents from their organization"
ON public.documents
FOR SELECT
USING (
  organisation_id IN (
    SELECT organisation_id FROM public.profiles
    WHERE user_id = auth.uid()
  )
);

-- Policy for document insertion - users can only insert documents into their organization
CREATE POLICY "Users can insert documents into their organization"
ON public.documents
FOR INSERT
WITH CHECK (
  organisation_id IN (
    SELECT organisation_id FROM public.profiles
    WHERE user_id = auth.uid()
  )
);

-- Policy for document updates - users can only update documents from their organization
CREATE POLICY "Users can update documents in their organization"
ON public.documents
FOR UPDATE
USING (
  organisation_id IN (
    SELECT organisation_id FROM public.profiles
    WHERE user_id = auth.uid()
  )
);

-- Policy for document deletion - users can only delete documents from their organization
CREATE POLICY "Users can delete documents from their organization"
ON public.documents
FOR DELETE
USING (
  organisation_id IN (
    SELECT organisation_id FROM public.profiles
    WHERE user_id = auth.uid()
  )
);
