-- Update existing profiles to set active_role to 'teacher' for non-student users
-- and 'student' for student users where active_role is currently NULL

UPDATE public.profiles 
SET active_role = CASE 
  WHEN role = 'student' THEN 'student'::role
  ELSE 'teacher'::role
END
WHERE active_role IS NULL;

-- Ensure ALL non-student users have active_role set to 'teacher'
-- This handles cases where active_role was previously set to other values
UPDATE public.profiles 
SET active_role = 'teacher'::role
WHERE role != 'student' AND active_role != 'teacher';

-- Add a comment to document this change
COMMENT ON COLUMN public.profiles.active_role IS 'The currently active role if user has multiple roles. Non-students default to teacher, students default to student.';
