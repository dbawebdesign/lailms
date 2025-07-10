ALTER TABLE public.organisations ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Public read access for organisation verification"
ON public.organisations
FOR SELECT
USING (true);
