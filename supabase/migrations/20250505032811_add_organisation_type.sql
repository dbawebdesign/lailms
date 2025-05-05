-- Create the organisation_type enum
DO $$ BEGIN
  CREATE TYPE public.organisation_type AS ENUM ('Education', 'Business', 'Government', 'Homeschool');
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

-- Add the organisation_type column to the organisations table
ALTER TABLE public.organisations
ADD COLUMN IF NOT EXISTS organisation_type public.organisation_type;

-- Optional: You might want to set a default value or make it NOT NULL depending on requirements
-- Example: ALTER TABLE public.organisations ALTER COLUMN organisation_type SET DEFAULT 'Business';
-- Example: ALTER TABLE public.organisations ALTER COLUMN organisation_type SET NOT NULL;
