-- Create the password reset codes table
CREATE TABLE IF NOT EXISTS public.password_reset_codes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  code TEXT UNIQUE NOT NULL DEFAULT substring(md5(random()::text) FROM 1 FOR 10),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  expires_at TIMESTAMPTZ NOT NULL DEFAULT (now() + interval '24 hours'),
  used_at TIMESTAMPTZ
);

-- Create index for faster lookups
CREATE INDEX IF NOT EXISTS idx_password_reset_codes_user_id ON public.password_reset_codes(user_id);
CREATE INDEX IF NOT EXISTS idx_password_reset_codes_code ON public.password_reset_codes(code);

-- Enable RLS
ALTER TABLE public.password_reset_codes ENABLE ROW LEVEL SECURITY;

-- Define RLS policies
CREATE POLICY "Public read access for unused codes" 
  ON public.password_reset_codes 
  FOR SELECT 
  USING (used_at IS NULL AND expires_at > now());

-- Allow admins to generate codes for users in their organization
CREATE POLICY "Organization admins can create reset codes" 
  ON public.password_reset_codes 
  FOR INSERT 
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.profiles p
      WHERE p.user_id = public.password_reset_codes.user_id
      AND p.organisation_id = (
        SELECT organisation_id FROM public.profiles 
        WHERE user_id = auth.uid() AND role IN ('super_admin', 'admin')
      )
    )
  );

-- Create function to generate a reset code for a user
CREATE OR REPLACE FUNCTION public.generate_password_reset_code(username TEXT)
RETURNS TEXT
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  user_id UUID;
  reset_code TEXT;
BEGIN
  -- Find the user ID from the username
  SELECT p.user_id INTO user_id
  FROM public.profiles p
  WHERE p.username = generate_password_reset_code.username;
  
  IF user_id IS NULL THEN
    RAISE EXCEPTION 'User not found';
  END IF;
  
  -- Delete any existing unused codes for this user
  DELETE FROM public.password_reset_codes
  WHERE user_id = user_id
  AND used_at IS NULL;
  
  -- Generate a new code
  INSERT INTO public.password_reset_codes (user_id)
  VALUES (user_id)
  RETURNING code INTO reset_code;
  
  RETURN reset_code;
END;
$$; 