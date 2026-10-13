import { NextResponse } from 'next/server';
import { createSupabaseServerClient } from '@/lib/supabase/server';
import { ensureBootstrapProfile } from '@/lib/auth/bootstrap-profile';

export async function POST() {
  const { data: { user }, error: authError } = await createSupabaseServerClient().auth.getUser();
  if (authError || !user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const { error } = await ensureBootstrapProfile(user);
  if (error) return NextResponse.json({ error: 'Could not create profile' }, { status: error.code === '23505' ? 409 : 500 });
  return NextResponse.json({ success: true });
}
