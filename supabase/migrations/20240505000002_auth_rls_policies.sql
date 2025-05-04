-- Make sure RLS is enabled on these tables
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.invite_codes ENABLE ROW LEVEL SECURITY;

-- Profiles table policies
-- Allow users to read their own profile
CREATE POLICY "Users can read their own profile"
  ON public.profiles
  FOR SELECT
  USING (auth.uid() = user_id);

-- Allow users to update their own profile
CREATE POLICY "Users can update their own profile"
  ON public.profiles
  FOR UPDATE
  USING (auth.uid() = user_id)
  WITH CHECK (
    auth.uid() = user_id 
    AND (
      -- Can't update role or organisation_id
      coalesce(NEW.role = OLD.role, true) 
      AND coalesce(NEW.organisation_id = OLD.organisation_id, true)
    )
  );

-- Allow organization admins to read all profiles in their org
CREATE POLICY "Organization admins can read all profiles in their org"
  ON public.profiles
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles 
      WHERE user_id = auth.uid() 
      AND role IN ('super_admin', 'admin')
      AND organisation_id = profiles.organisation_id
    )
  );

-- Allow organization admins to update profiles in their org
CREATE POLICY "Organization admins can update profiles in their org"
  ON public.profiles
  FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles 
      WHERE user_id = auth.uid() 
      AND role IN ('super_admin', 'admin')
      AND organisation_id = profiles.organisation_id
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.profiles 
      WHERE user_id = auth.uid() 
      AND role IN ('super_admin', 'admin')
      AND organisation_id = NEW.organisation_id
    )
  );

-- Allow super admins to read all profiles
CREATE POLICY "Super admins can read all profiles"
  ON public.profiles
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles 
      WHERE user_id = auth.uid() 
      AND role = 'super_admin'
    )
  );

-- Allow super admins to update all profiles
CREATE POLICY "Super admins can update all profiles"
  ON public.profiles
  FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles 
      WHERE user_id = auth.uid() 
      AND role = 'super_admin'
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.profiles 
      WHERE user_id = auth.uid() 
      AND role = 'super_admin'
    )
  );

-- Invite Codes table policies
-- Allow public read access to a specific invite code (for verification)
CREATE POLICY "Public read access to a specific invite code"
  ON public.invite_codes
  FOR SELECT
  USING (NOT is_redeemed AND (expires_at IS NULL OR expires_at > now()));

-- Allow organization admins to manage invite codes for their org
CREATE POLICY "Organization admins can manage invite codes for their org"
  ON public.invite_codes
  FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles 
      WHERE user_id = auth.uid() 
      AND role IN ('super_admin', 'admin')
      AND organisation_id = invite_codes.organisation_id
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.profiles 
      WHERE user_id = auth.uid() 
      AND role IN ('super_admin', 'admin')
      AND organisation_id = invite_codes.organisation_id
    )
  );

-- Allow super admins to manage all invite codes
CREATE POLICY "Super admins can manage all invite codes"
  ON public.invite_codes
  FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles 
      WHERE user_id = auth.uid() 
      AND role = 'super_admin'
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.profiles 
      WHERE user_id = auth.uid() 
      AND role = 'super_admin'
    )
  );

-- Allow teachers to view unused invite codes for their organization
CREATE POLICY "Teachers can view unused invite codes for their org"
  ON public.invite_codes
  FOR SELECT
  USING (
    NOT is_redeemed
    AND EXISTS (
      SELECT 1 FROM public.profiles 
      WHERE user_id = auth.uid() 
      AND role = 'teacher'
      AND organisation_id = invite_codes.organisation_id
    )
  ); 