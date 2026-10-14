/** @jest-environment node */
import { NextRequest } from 'next/server';
import { GET } from '../src/app/auth/callback/route';
import { createSupabaseServerClient } from '../src/lib/supabase/server';
import { PLATFORM_ADMIN_USER_ID } from '../src/lib/auth/platform-admin';
jest.mock('../src/lib/supabase/server', () => ({ createSupabaseServerClient: jest.fn() }));
jest.mock('../src/lib/auth/bootstrap-profile', () => ({ ensureBootstrapProfile: jest.fn() }));

const owner = { id: PLATFORM_ADMIN_USER_ID, app_metadata: { platform_admin: true } };
it.each([
  [owner, '/dev-admin', '/dev-admin'],
  [{ id: 'other', app_metadata: { platform_admin: true } }, '/dev-admin', '/teach'],
  [owner, 'https://attacker.example', '/teach'],
  [owner, '//attacker.example', '/teach'],
  [owner, '/dev-admin/../api/dev-admin/messaging', '/teach'],
  [owner, '/', '/teach'],
])('only returns the designated owner to the fixed admin target', async (user, next, expected) => {
  (createSupabaseServerClient as jest.Mock).mockReturnValue({
    auth: { exchangeCodeForSession: async () => ({ data: { user }, error: null }) },
    from: () => ({ select: () => ({ eq: () => ({ single: async () => ({ data: { role: 'teacher', organisations: { organisation_type: 'individual_family' } } }) }) }) }),
  });
  const request = new NextRequest(`https://example.com/auth/callback?code=test-code&next=${encodeURIComponent(next)}`);
  expect((await GET(request)).headers.get('location')).toBe(`https://example.com${expected}`);
});
