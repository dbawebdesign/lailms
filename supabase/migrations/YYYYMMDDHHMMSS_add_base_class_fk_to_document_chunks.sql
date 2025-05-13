-- Add a nullable foreign key column to link document chunks to base classes
ALTER TABLE public.document_chunks
ADD COLUMN base_class_id UUID REFERENCES public.base_classes(id) ON DELETE SET NULL;

-- Add an index for the new foreign key for performance
CREATE INDEX IF NOT EXISTS idx_document_chunks_base_class_id ON public.document_chunks(base_class_id);

-- Update RLS policies for document_chunks if necessary to consider base_class_id
-- We might want users to only see chunks related to base classes they are enrolled in/teach.
-- However, the current RLS is based on organisation_id, which might be sufficient for now.
-- Revisit this if more granular access control per base class is needed for chunks.

-- Example (commented out):
-- DROP POLICY IF EXISTS "Users can access chunks from their organization" ON document_chunks;
-- CREATE POLICY "Users can access chunks for their base classes and org" 
--   ON public.document_chunks 
--   FOR SELECT 
--   USING (
--     organisation_id IN (SELECT organisation_id FROM public.profiles WHERE user_id = auth.uid()) AND
--     (base_class_id IS NULL OR base_class_id IN (
--       -- Logic to determine accessible base classes for the user
--       -- e.g., SELECT base_class_id FROM class_instances JOIN rosters ON ... WHERE rosters.member_id = auth.uid()
--     ))
--   ); 