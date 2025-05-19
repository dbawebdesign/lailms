-- Add base_class_id to documents table
ALTER TABLE public.documents
ADD COLUMN base_class_id UUID NULL REFERENCES public.base_classes(id) ON DELETE SET NULL;

-- Add an index for the new base_class_id column
CREATE INDEX IF NOT EXISTS idx_documents_base_class_id ON public.documents(base_class_id);

-- Optionally, update RLS policies if needed to consider base_class_id for authorization
-- For now, existing organisation-level policies might be sufficient.
-- If specific base_class level access is needed for viewing/editing documents directly tied to a base_class,
-- new or modified policies would be required.

COMMENT ON COLUMN public.documents.base_class_id IS 'Reference to the base class this document is specifically associated with, if any.'; 