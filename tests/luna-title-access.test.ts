/** @jest-environment node */
import { NextRequest } from 'next/server';
import { POST } from '../src/app/api/luna/generate-title/route';
import { createSupabaseServerClient } from '../src/lib/supabase/server';
import OpenAI from 'openai';
jest.mock('../src/lib/supabase/server', () => ({ createSupabaseServerClient: jest.fn() }));
jest.mock('openai', () => ({ __esModule: true, default: jest.fn(() => ({ chat: { completions: { create: jest.fn() } } })) }));
const completion = (OpenAI as unknown as jest.Mock).mock.results[0].value.chat.completions.create;
const body = { messages: [{ role: 'user', content: 'Explain photosynthesis' }], conversationId: 'owned' };
const send = (data: unknown) => POST(new NextRequest('http://localhost/api/luna/generate-title', { method: 'POST', body: JSON.stringify(data) }));
function setup(user: string | null = 'owner', owned = true) {
  const query: any = { select: () => query, eq: () => query, maybeSingle: async () => ({ data: owned ? { id: 'owned' } : null, error: null }) };
  (createSupabaseServerClient as jest.Mock).mockReturnValue({ auth: { getUser: async () => ({ data: { user: user ? { id: user } : null }, error: null }) }, from: () => query });
  completion.mockReset().mockResolvedValue({ choices: [{ message: { content: 'Understanding Photosynthesis' } }] });
}
it('denies anonymous title requests before paid model use', async () => {
  setup(null); expect((await send(body)).status).toBe(401); expect(completion).not.toHaveBeenCalled();
});
it('denies another user conversation before paid model use', async () => {
  setup('owner', false); expect((await send(body)).status).toBe(403); expect(completion).not.toHaveBeenCalled();
});
it('preserves signed-in titles and uses Luna with a bounded request', async () => {
  setup(); const response = await send(body); expect(response.status).toBe(200);
  expect((await response.json()).title).toBe('Understanding Photosynthesis');
  expect(completion.mock.calls[0][0]).toMatchObject({ model: 'gpt-6-luna', reasoning_effort: 'none', max_completion_tokens: 20 });
});
it('bounds supplied context before paid model use', async () => {
  setup(); expect((await send({ messages: [{ role: 'user', content: 'x'.repeat(16001) }] })).status).toBe(413);
  expect(completion).not.toHaveBeenCalled();
});
it('retains authenticated unsaved-conversation title generation', async () => {
  setup(); expect((await send({ messages: body.messages })).status).toBe(200);
});
