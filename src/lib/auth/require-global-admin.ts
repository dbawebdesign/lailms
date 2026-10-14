import { NextResponse } from 'next/server';
import { createSupabaseServerClient } from '@/lib/supabase/server';
import { isPlatformAdmin } from './platform-admin';

export async function getGlobalAdminAccess() {
  const supabase = createSupabaseServerClient();
  const { data: { user }, error } = await supabase.auth.getUser();
  if (error || !user) return { user: null, status: 401 as const };
  // Organisation roles and user_metadata are not platform authority.
  if (!isPlatformAdmin(user)) return { user: null, status: 403 as const };
  return { user, status: null };
}

export async function requireGlobalAdmin(): Promise<NextResponse | null> {
  const { status } = await getGlobalAdminAccess();
  if (!status) return null;
  return NextResponse.json({ error: status === 401 ? 'Authentication required' : 'Administrator access required' }, { status });
}
