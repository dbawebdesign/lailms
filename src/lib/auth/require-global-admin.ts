import { NextResponse } from 'next/server';
import { createSupabaseServerClient } from '@/lib/supabase/server';

/** These analytics contain responses from every organisation. */
export async function requireGlobalAdmin(): Promise<NextResponse | null> {
  const supabase = createSupabaseServerClient();
  const { data: { user }, error } = await supabase.auth.getUser();
  if (error || !user) return NextResponse.json({ error: 'Authentication required' }, { status: 401 });
  // Organisation roles and user_metadata are not platform authority.
  // app_metadata can only be assigned by a trusted Supabase admin operation.
  if (user.app_metadata?.platform_admin !== true) {
    return NextResponse.json({ error: 'Administrator access required' }, { status: 403 });
  }
  return null;
}
