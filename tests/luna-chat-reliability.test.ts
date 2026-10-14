/** @jest-environment node */
import { NextRequest } from 'next/server';
import { POST } from '../src/app/api/luna/chat/route';
import { createSupabaseServerClient } from '../src/lib/supabase/server';
import OpenAI from 'openai';
jest.mock('../src/lib/supabase/server', () => ({ createSupabaseServerClient: jest.fn() }));
jest.mock('openai', () => ({ __esModule: true, default: jest.fn(() => ({ chat: { completions: { create: jest.fn() } } })) }));
const createCompletion = (OpenAI as unknown as jest.Mock).mock.results[0].value.chat.completions.create;
const id = '11111111-1111-4111-a111-111111111111';
const messageId = '22222222-2222-4222-a222-222222222222';
function setup(options: { user?: string | null; conversationOwner?: string; documents?: any[]; history?: any[] } = {}) {
  const writes: any[] = [];
  const user = options.user === undefined ? 'owner' : options.user;
  const db: any = { auth: { getUser: async () => ({ data: { user: user ? { id: user } : null }, error: null }) },
    from: (table: string) => {
      const filters: any = {}; let operation = 'read'; let payload: any;
      const run = () => {
        if (operation === 'insert') { writes.push({ table, payload }); return { data: { id: 'saved-id' }, error: null }; }
        if (operation === 'update') return { data: null, error: null };
        if (table === 'luna_conversations') return { data: filters.user_id === (options.conversationOwner || 'owner') ? { id: 'conversation' } : null, error: null };
        if (table === 'documents') return { data: (options.documents || []).filter(doc => doc.uploaded_by === filters.uploaded_by), error: null };
        if (table === 'document_chunks') return { data: [{ document_id: id, content: 'Curriculum requirement: explain photosynthesis.' }], error: null };
        if (table === 'luna_messages') return { data: filters.id || filters['metadata->>reply_to'] ? null : options.history || [], error: null };
        return { data: null, error: null };
      };
      const query: any = {
        select: () => query, eq: (key: string, value: unknown) => { filters[key] = value; return query; },
        in: () => query, order: () => query, limit: () => query, range: () => query,
        insert: (data: unknown) => { operation = 'insert'; payload = data; return query; },
        update: () => { operation = 'update'; return query; },
        single: async () => run(), maybeSingle: async () => run(), then: (resolve: any) => resolve(run()),
      }; return query;
    },
  };
  (createSupabaseServerClient as jest.Mock).mockReturnValue(db);
  createCompletion.mockReset().mockResolvedValue({ choices: [{ message: { content: 'A helpful answer.' } }], usage: { total_tokens: 20 } });
  return writes;
}
const send = (body: any) => POST(new NextRequest('http://localhost/api/luna/chat', { method: 'POST', body: JSON.stringify(body) }));
it('preserves ordinary text chat and persists each message only once', async () => {
  const writes = setup();
  expect((await send({ message: 'Explain this', conversationId: 'conversation', userMessageId: messageId })).status).toBe(200);
  expect(writes.filter(row => row.table === 'luna_messages')).toHaveLength(2);
  expect(createCompletion.mock.calls[0][0].messages.at(-1).content).toBe('Explain this');
});
it('passes actual source text and saved conversation history to the model', async () => {
  setup({ documents: [{ id, uploaded_by: 'owner', status: 'completed', file_name: 'science.txt' }],
    history: [{ id: 'prior', role: 'assistant', content: 'Previous answer', metadata: {} }] });
  const response = await send({ message: 'Compare these', conversationId: 'conversation', documentIds: [id], userMessageId: messageId });
  expect(response.status).toBe(200);
  const prompt = createCompletion.mock.calls[0][0].messages;
  expect(prompt.some((msg: any) => msg.content === 'Previous answer')).toBe(true);
  expect(prompt.at(-1).content).toContain('Curriculum requirement: explain photosynthesis.');
});
it('reuses the most recent verified attachment on a follow-up question', async () => {
  setup({ documents: [{ id, uploaded_by: 'owner', status: 'completed', file_name: 'science.txt' }],
    history: [{ id: 'prior', role: 'user', content: 'Read my attachment', metadata: { documentIds: [id] } }] });
  expect((await send({ message: 'What is missing?', conversationId: 'conversation' })).status).toBe(200);
  expect(createCompletion.mock.calls[0][0].messages.at(-1).content).toContain('photosynthesis');
});
it('rejects another account conversation before message writes or AI calls', async () => {
  const writes = setup({ conversationOwner: 'other' });
  expect((await send({ message: 'Read this', conversationId: 'foreign' })).status).toBe(403);
  expect(writes).toHaveLength(0); expect(createCompletion).not.toHaveBeenCalled();
});
it('rejects attachments that are foreign or still processing before AI calls and message writes', async () => {
  const writes = setup({ documents: [{ id, uploaded_by: 'owner', status: 'queued', file_name: 'science.txt' }] });
  expect((await send({ message: 'Read this', conversationId: 'conversation', documentIds: [id] })).status).toBe(409);
  expect(writes).toHaveLength(0); expect(createCompletion).not.toHaveBeenCalled();
  setup({ documents: [{ id, uploaded_by: 'other', status: 'completed', file_name: 'science.txt' }] });
  expect((await send({ message: 'Read this', conversationId: 'conversation', documentIds: [id] })).status).toBe(403);
  expect(createCompletion).not.toHaveBeenCalled();
});
it('rejects anonymous requests before database operations', async () => {
  const writes = setup({ user: null });
  expect((await send({ message: 'Read this' })).status).toBe(401);
  expect(writes).toHaveLength(0); expect(createCompletion).not.toHaveBeenCalled();
});
