/** @jest-environment node */
import { NextRequest } from 'next/server';
import { POST } from '../src/app/api/luna/tools/route';
import { createSupabaseServerClient } from '../src/lib/supabase/server';
import OpenAI from 'openai';
jest.mock('../src/lib/supabase/server', () => ({ createSupabaseServerClient: jest.fn() }));
jest.mock('openai', () => ({ __esModule: true, default: jest.fn(() => ({ chat: { completions: { create: jest.fn() } } })) }));
const complete = (OpenAI as unknown as jest.Mock).mock.results[0].value.chat.completions.create;
beforeEach(() => {
  const query: any = { select: () => query, eq: () => query, single: async () => ({ data: { user_id: 'teacher', role: 'teacher', active_role: 'teacher' }, error: null }) };
  (createSupabaseServerClient as jest.Mock).mockReturnValue({ auth: { getUser: async () => ({ data: { user: { id: 'teacher' } }, error: null }) }, from: () => query });
  complete.mockReset().mockResolvedValue({ choices: [{ message: { content: 'Please confirm the desired grade level.' } }] });
});
it.each(['rubric-generator', 'activities-creator', 'iep-generator', 'content-leveler', 'mindmap-generator'])('uses Sol for intensive %s conversations', async toolId => {
  const response = await POST(new NextRequest('http://localhost/api/luna/tools', { method: 'POST', body: JSON.stringify({ toolId, prompt: 'Synthetic teaching material' }) }));
  expect(response.status).toBe(200);
  expect(complete.mock.calls[0][0]).toMatchObject({ model: 'gpt-6.1-sol', reasoning_effort: 'medium', max_completion_tokens: 8192 });
  expect(complete.mock.calls[0][0]).not.toHaveProperty('tools');
});
it('keeps short lesson-hook conversations on Luna', async () => {
  const response = await POST(new NextRequest('http://localhost/api/luna/tools', { method: 'POST', body: JSON.stringify({ toolId: 'lesson-hooks', prompt: 'Synthetic teaching hook' }) }));
  expect(response.status).toBe(200);
  expect(complete.mock.calls[0][0]).toMatchObject({ model: 'gpt-6-luna', reasoning_effort: 'none', max_completion_tokens: 1500 });
});
