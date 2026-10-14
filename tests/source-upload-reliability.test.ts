/** @jest-environment node */
import { persistSource, sourceDocumentId } from '../src/lib/knowledge-base/persist-source';
const { bytesToBase64 } = require('../packages/functions/src/process-document/bytes-to-base64') as { bytesToBase64(bytes: Uint8Array): string };
jest.mock('../src/lib/supabase/server', () => ({ createSupabaseServiceClient: jest.fn() }));

function client() {
  const rows = new Map<string, any>();
  const files = new Map<string, unknown>();
  let failInsert = false;
  const upload = jest.fn(async (path, body) => {
    if (files.has(path)) return { error: { statusCode: '409', message: 'Already exists' } };
    files.set(path, body); return { error: null };
  });
  const from = (table: string) => {
    const filters: Record<string, unknown> = {};
    let payload: any;
    const query: any = {
      select: () => query,
      eq: (key: string, value: unknown) => { filters[key] = value; return query; },
      insert: (value: unknown) => { payload = value; return query; },
      maybeSingle: async () => {
        if (table === 'base_classes') return { data: filters.organisation_id === 'org' ? { id: filters.id } : null, error: null };
        return { data: [...rows.values()].find(row => Object.entries(filters).every(([key, value]) => row[key] === value)) || null, error: null };
      },
      single: async () => {
        if (failInsert) { failInsert = false; return { data: null, error: { code: '08006' } }; }
        if (rows.has(payload.id)) return { data: null, error: { code: '23505' } };
        rows.set(payload.id, payload); return { data: payload, error: null };
      },
    };
    return query;
  };
  return { client: { from, storage: { from: () => ({ upload, remove: jest.fn() }) } } as any,
    rows, files, upload, failNextInsert: () => { failInsert = true; } };
}
const input = { userId: 'owner', organisationId: 'org', baseClassId: null, fileName: 'source.txt', fileType: 'text/plain', content: 'actual source', idempotencyKey: 'request-1' };

it('reuses the document without another storage upload or document insertion', async () => {
  const db = client();
  const first = await persistSource(db.client, input);
  const second = await persistSource(db.client, input);
  expect(second).toEqual({ ...first, reused: true });
  expect(db.rows.size).toBe(1); expect(db.upload).toHaveBeenCalledTimes(1);
});
it('deduplicates concurrent submissions at the primary key boundary', async () => {
  const db = client();
  const results = await Promise.all(Array.from({ length: 5 }, () => persistSource(db.client, input)));
  expect(new Set(results.map(result => result.id)).size).toBe(1);
  expect(results.filter(result => !result.reused)).toHaveLength(1);
  expect(db.rows.size).toBe(1); expect(db.files.size).toBe(1);
});
it('recovers after storage succeeds but metadata insertion fails', async () => {
  const db = client(); db.failNextInsert();
  await expect(persistSource(db.client, input)).rejects.toThrow('save upload metadata');
  await expect(persistSource(db.client, input)).resolves.toMatchObject({ reused: false });
  expect(db.rows.size).toBe(1); expect(db.files.size).toBe(1);
});
it('rejects reuse of a key for changed content without overwriting the original', async () => {
  const db = client(); await persistSource(db.client, input);
  await expect(persistSource(db.client, { ...input, content: 'different' })).rejects.toMatchObject({ status: 409 });
  expect(db.files.size).toBe(1); expect(db.rows.size).toBe(1);
});
it('scopes identity to account, organisation, and course while preserving legacy unkeyed uploads', async () => {
  const db = client();
  expect(sourceDocumentId(input)).not.toBe(sourceDocumentId({ ...input, userId: 'other' }));
  expect(sourceDocumentId(input)).not.toBe(sourceDocumentId({ ...input, organisationId: 'other' }));
  expect(sourceDocumentId(input)).not.toBe(sourceDocumentId({ ...input, baseClassId: 'course' }));
  const first = await persistSource(db.client, { ...input, idempotencyKey: null });
  const second = await persistSource(db.client, { ...input, idempotencyKey: null });
  expect(first.id).not.toBe(second.id); expect(db.rows.size).toBe(2);
});
it('rejects a course in another organisation before storage or insertion', async () => {
  const db = client();
  await expect(persistSource(db.client, { ...input, organisationId: 'other', baseClassId: 'foreign-course' })).rejects.toMatchObject({ status: 403 });
  expect(db.upload).not.toHaveBeenCalled(); expect(db.rows.size).toBe(0);
});
it.each([0, 1, 8191, 8192, 8193, 1048576, 4445348, 50 * 1024 * 1024])('encodes every byte at size %i without a stack overflow', size => {
  const bytes = Uint8Array.from({ length: size }, (_, index) => index % 256);
  expect(bytesToBase64(bytes)).toBe(Buffer.from(bytes).toString('base64'));
});
