-- Add user_id column to base_classes
ALTER TABLE public.base_classes
ADD COLUMN user_id UUID;

-- Add foreign key constraint to profiles table
ALTER TABLE public.base_classes
ADD CONSTRAINT fk_user
FOREIGN KEY (user_id)
REFERENCES public.profiles(user_id)
ON DELETE SET NULL; -- Or ON DELETE CASCADE if you want to delete base classes when a user is deleted

-- Make user_id not nullable if every base_class must have a creator
-- You might need to populate existing rows before making it NOT NULL
-- ALTER TABLE public.base_classes
-- ALTER COLUMN user_id SET NOT NULL;

-- Add a comment to the column
COMMENT ON COLUMN public.base_classes.user_id IS 'ID of the user who created the base class, references profiles.user_id';

-- Enable Row Level Security for base_classes table
ALTER TABLE public.base_classes ENABLE ROW LEVEL SECURITY;

-- Drop existing policies (if any, to avoid conflicts - be cautious with this in production)
-- Consider more targeted DROP POLICY IF EXISTS commands if you have other policies you want to keep.
DROP POLICY IF EXISTS "Allow all users to read base classes" ON public.base_classes;
DROP POLICY IF EXISTS "Allow all users to create base classes" ON public.base_classes;
DROP POLICY IF EXISTS "Allow all users to update base classes" ON public.base_classes;
DROP POLICY IF EXISTS "Allow all users to delete base classes" ON public.base_classes;

-- RLS Policies for base_classes

-- 1. Allow users to read their own base classes
CREATE POLICY "Allow users to read their own base classes" 
ON public.base_classes
FOR SELECT
USING (auth.uid() = user_id);

-- 2. Allow users to create base classes for themselves
CREATE POLICY "Allow users to create base classes for themselves"
ON public.base_classes
FOR INSERT
WITH CHECK (auth.uid() = user_id);

-- 3. Allow users to update their own base classes
CREATE POLICY "Allow users to update their own base classes"
ON public.base_classes
FOR UPDATE
USING (auth.uid() = user_id)
WITH CHECK (auth.uid() = user_id);

-- 4. Allow users to delete their own base classes
CREATE POLICY "Allow users to delete their own base classes"
ON public.base_classes
FOR DELETE
USING (auth.uid() = user_id); 