import 'server-only';
import type { User } from '@supabase/supabase-js';
import { createSupabaseServiceClient } from '@/lib/supabase/server';

// Call only with a user returned by getUser/exchangeCodeForSession. Metadata may
// supply a display username, never roles, tenant membership, or payment state.
export async function ensureBootstrapProfile(user: User) {
  const admin = createSupabaseServiceClient();
  const metadataUsername = user.user_metadata?.username;
  const username = typeof metadataUsername === 'string' && /^[a-zA-Z0-9][a-zA-Z0-9_.-]{1,18}[a-zA-Z0-9]$/.test(metadataUsername)
    ? metadataUsername.toLowerCase()
    : `user_${user.id.replaceAll('-', '').slice(0, 15)}`;
  return admin.from('profiles').upsert({
    user_id: user.id,
    username,
    role: 'teacher',
    active_role: 'teacher',
  }, { onConflict: 'user_id', ignoreDuplicates: true });
}
