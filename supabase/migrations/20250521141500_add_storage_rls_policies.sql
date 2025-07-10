-- Enable RLS on storage.objects if not already (usually is by default)
-- ALTER TABLE storage.objects ENABLE ROW LEVEL SECURITY; -- This might already be enabled.

-- Allow authenticated users to upload to their organization's bucket
CREATE POLICY "Authenticated users can upload to their org bucket"
ON storage.objects FOR INSERT TO authenticated
WITH CHECK (
  bucket_id = 'org-' || (
    SELECT p.organisation_id::text 
    FROM public.profiles p 
    WHERE p.user_id = auth.uid()
  ) || '-uploads'
  -- Optional: You could add further checks on object name patterns if needed
  -- e.g., AND name LIKE (auth.uid()::text || '%')
);

-- Allow authenticated users to select/view objects from their organization's bucket
CREATE POLICY "Authenticated users can view objects in their org bucket"
ON storage.objects FOR SELECT TO authenticated
USING (
  bucket_id = 'org-' || (
    SELECT p.organisation_id::text 
    FROM public.profiles p 
    WHERE p.user_id = auth.uid()
  ) || '-uploads'
);

-- Allow authenticated users to update objects they own (or based on org rules)
CREATE POLICY "Authenticated users can update objects in their org bucket"
ON storage.objects FOR UPDATE TO authenticated
USING (
  bucket_id = 'org-' || (
    SELECT p.organisation_id::text 
    FROM public.profiles p 
    WHERE p.user_id = auth.uid()
  ) || '-uploads'
  -- AND owner = auth.uid() -- If you want only owners to update
)
WITH CHECK (
  bucket_id = 'org-' || (
    SELECT p.organisation_id::text 
    FROM public.profiles p 
    WHERE p.user_id = auth.uid()
  ) || '-uploads'
  -- AND owner = auth.uid()
);


-- Allow authenticated users to delete objects they own (or based on org rules)
CREATE POLICY "Authenticated users can delete objects in their org bucket"
ON storage.objects FOR DELETE TO authenticated
USING (
  bucket_id = 'org-' || (
    SELECT p.organisation_id::text 
    FROM public.profiles p 
    WHERE p.user_id = auth.uid()
  ) || '-uploads'
  -- AND owner = auth.uid() -- If you want only owners to delete
); 