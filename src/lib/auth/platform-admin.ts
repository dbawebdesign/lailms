import type { User } from '@supabase/supabase-js';

// The existing, explicitly designated Learnology platform-owner account.
export const PLATFORM_ADMIN_USER_ID = 'bc7ce1a8-28e0-48b2-b7b2-7b946b73940e';

export function isPlatformAdmin(user: Pick<User, 'id' | 'app_metadata'> | null | undefined): boolean {
  return user?.id === PLATFORM_ADMIN_USER_ID && user.app_metadata?.platform_admin === true;
}
