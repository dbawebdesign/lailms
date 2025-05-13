-- Add a nullable foreign key column to link documents to base classes
ALTER TABLE public.documents
ADD COLUMN base_class_id UUID REFERENCES public.base_classes(id) ON DELETE SET NULL;

-- Add an index for the new foreign key for performance
CREATE INDEX IF NOT EXISTS idx_documents_base_class_id ON public.documents(base_class_id);

-- Update RLS policies if necessary to consider base_class_id
-- (Keeping existing org-based policies for now, add base_class specific ones if needed later)

-- Example: Allow users to view documents linked to base classes they have access to 
-- (This depends on how base class access is determined, e.g., through rosters or teacher roles)
-- This is commented out as the exact access logic needs clarification.
-- CREATE POLICY "Users can view documents linked to their base classes"
-- ON public.documents
-- FOR SELECT
-- USING (
--   base_class_id IS NULL OR -- Allow access to org-level docs based on existing policies
--   base_class_id IN (
--     SELECT bc.id 
--     FROM public.base_classes bc
--     JOIN public.class_instances ci ON bc.id = ci.base_class_id
--     JOIN public.rosters r ON ci.id = r.class_instance_id
--     WHERE r.member_id = auth.uid() -- Simplified: assumes member_id corresponds to auth.uid()
--     -- Add role checks if necessary (e.g., only teachers)
--   )
-- );

-- Add corresponding policies for INSERT, UPDATE, DELETE if needed, ensuring users
-- can only modify documents linked to base classes they manage/own. 