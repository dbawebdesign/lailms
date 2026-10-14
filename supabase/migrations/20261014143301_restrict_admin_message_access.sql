BEGIN;

-- Platform administration now uses owner-verified service operations. Preserve
-- the separate recipient policies used to read messages and submit responses.
DROP POLICY IF EXISTS "Admins can create messages" ON public.admin_messages;
DROP POLICY IF EXISTS "Admins can view all messages" ON public.admin_messages;
DROP POLICY IF EXISTS "Admins can view all responses" ON public.admin_message_responses;
REVOKE INSERT ON public.admin_messages FROM PUBLIC, anon, authenticated;
GRANT INSERT ON public.admin_messages TO service_role;

COMMIT;
