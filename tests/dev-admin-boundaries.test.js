/** @jest-environment node */
import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import ts from 'typescript';
import { NextRequest, NextResponse } from 'next/server';
import { requireGlobalAdmin, getGlobalAdminAccess } from '../src/lib/auth/require-global-admin';
import { isPlatformAdmin, PLATFORM_ADMIN_USER_ID } from '../src/lib/auth/platform-admin';
import { createSupabaseServerClient } from '../src/lib/supabase/server';
jest.mock('../src/lib/supabase/server', () => ({ createSupabaseServerClient: jest.fn() }));

const owner = { id: PLATFORM_ADMIN_USER_ID, app_metadata: { platform_admin: true } };
function auth(user, error = null) {
  createSupabaseServerClient.mockReturnValue({ auth: { getUser: async () => ({ data: { user }, error }) } });
}
function load(relativePath, service, extra = {}) {
  const exports = {};
  const source = fs.readFileSync(path.join(process.cwd(), relativePath), 'utf8');
  const compiled = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, jsx: ts.JsxEmit.ReactJSX } }).outputText;
  vm.runInNewContext(compiled, { exports, console, URL, Request, Response, process, require: id => {
    if (extra[id]) return extra[id];
    if (id === 'next/server') return { NextRequest, NextResponse };
    if (id.includes('require-global-admin')) return { requireGlobalAdmin, getGlobalAdminAccess };
    if (id.includes('platform-admin')) return { isPlatformAdmin };
    if (id.includes('supabase/server')) return { createSupabaseServiceClient: service, createSupabaseServerClient: service };
    if (id === '@supabase/supabase-js') return { createClient: service };
    return {};
  } });
  return exports;
}
const endpoints = [
  ['organisations', 'GET'], ['organisations', 'POST'], ['course-catalog', 'GET'],
  ['course-catalog/[id]', 'DELETE'], ['base-classes', 'POST'], ['course-generation', 'POST'],
  ['class-instance-status-update', 'GET'], ['class-instance-status-update', 'POST'],
  ['messaging', 'GET'], ['messaging', 'POST'],
];
describe.each(endpoints)('%s %s', (route, method) => {
  it.each([null, { id: 'another-owner', app_metadata: { platform_admin: true } }])('rejects legacy credentials and non-owner sessions before database access', async user => {
    auth(user);
    const service = jest.fn(() => { throw new Error('Database access before authorization'); });
    const handlers = load('src/app/api/dev-admin/' + route + '/route.ts', service);
    const request = new NextRequest('https://example.com/api/dev-admin/' + route, {
      method, headers: { 'x-dev-admin-password': String(1234), 'Content-Type': 'application/json' },
      ...(method === 'GET' ? {} : { body: JSON.stringify({ internal: true, isDevAdmin: true, password: String(1234) }) }),
    });
    const result = await handlers[method](request, { params: Promise.resolve({ id: 'victim' }) });
    expect(result.status).toBe(user ? 403 : 401);
    expect(service).not.toHaveBeenCalled();
  });
});
it.each(['GET', 'POST'])('protects the alternate batch grading %s entry point', async method => {
  auth({ id: 'tenant-admin', app_metadata: { role: 'super_admin' } });
  const service = jest.fn();
  const handlers = load('src/app/api/learn/assessments/grade/batch/route.ts', service);
  expect((await handlers[method](new NextRequest('https://example.com/api/learn/assessments/grade/batch', { method }))).status).toBe(403);
  expect(service).not.toHaveBeenCalled();
});
it('allows the designated owner to read organizations through the privileged API', async () => {
  auth(owner);
  const order = jest.fn(async () => ({ data: [{ id: 'org', name: 'Test organization' }], error: null }));
  const service = jest.fn(() => ({ from: () => ({ select: () => ({ order }) }) }));
  const handlers = load('src/app/api/dev-admin/organisations/route.ts', service);
  const result = await handlers.GET(new NextRequest('https://example.com/api/dev-admin/organisations'));
  expect(result.status).toBe(200);
  expect(await result.json()).toEqual([{ id: 'org', name: 'Test organization' }]);
});
it('uses the verified owner identity when sending a message, ignoring submitted authority', async () => {
  auth(owner);
  const insert = jest.fn(async () => ({ error: null }));
  const handlers = load('src/app/api/dev-admin/messaging/route.ts', () => ({ from: () => ({ insert }) }));
  const result = await handlers.POST(new NextRequest('https://example.com/api/dev-admin/messaging', {
    method: 'POST', body: JSON.stringify({ toUserId: '00000000-0000-0000-0000-000000000001', subject: ' Test ', message: ' Message ', from_admin_id: 'forged' }),
  }));
  expect(result.status).toBe(200);
  expect(insert).toHaveBeenCalledWith({ from_admin_id: owner.id, to_user_id: '00000000-0000-0000-0000-000000000001', subject: 'Test', message: 'Message' });
});
describe('page middleware', () => {
  const run = async (user, url, error = null) => {
    const client = { auth: { getSession: async () => ({ data: { session: owner } }), getUser: async () => ({ data: { user }, error }) }, from: () => ({ select: () => ({ eq: () => ({ single: async () => ({ data: { is_canceled: false } }) }) }) }) };
    const handlers = load('src/middleware.ts', jest.fn(), { '@supabase/ssr': { createServerClient: () => client } });
    return handlers.middleware(new NextRequest(url));
  };
  it('redirects an anonymous admin request to login despite a forged local session', async () => {
    const r = await run(null, 'https://example.com/dev-admin/course-catalog');
    expect(r.status).toBe(307);
    expect(r.headers.get('location')).toBe('https://example.com/login?next=/dev-admin');
  });
  it('rejects a different claim-bearing account on pages and APIs', async () => {
    const user = { id: 'other', app_metadata: { platform_admin: true } };
    expect((await run(user, 'https://example.com/dev-admin')).status).toBe(403);
    expect((await run(user, 'https://example.com/api/dev-admin/messaging')).status).toBe(403);
  });
  it('allows the verified owner and ordinary non-admin pages', async () => {
    expect((await run(owner, 'https://example.com/dev-admin')).status).toBe(200);
    expect((await run(null, 'https://example.com/login')).status).toBe(200);
  });
  it('fails closed when the auth lookup reports an error', async () => {
    expect((await run(owner, 'https://example.com/api/dev-admin/organisations', new Error('offline'))).status).toBe(401);
  });
});
