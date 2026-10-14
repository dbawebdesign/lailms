/** @jest-environment node */
import { NextRequest } from 'next/server';
import { manualToolRequest } from '../src/lib/teaching-tools/manual-request';
import { teachingTools } from '../src/config/teachingTools';
import { createSupabaseServerClient } from '../src/lib/supabase/server';
jest.mock('../src/lib/supabase/server', () => ({ createSupabaseServerClient: jest.fn() }));

process.env.OPENAI_API_KEY = 'synthetic-test-key';
const { POST } = require('../src/app/api/tools/rubric/route');
const originalFetch = global.fetch;
const provider = jest.fn();
const inputs = { subject: 'Synthetic photosynthesis', gradeLevel: '5', assessmentType: 'Project', criteria: 'Sunlight\nInputs', performanceLevels: 4 };
const rubric = teachingTools.find(tool => tool.id === 'rubric-generator')!;
function setup(user: string | null = 'teacher', role = 'teacher') {
  const query: any = { select: () => query, eq: () => query, single: async () => ({ data: { user_id: user, role, active_role: role }, error: null }) };
  (createSupabaseServerClient as jest.Mock).mockReturnValue({ auth: { getUser: async () => ({ data: { user: user ? { id: user } : null }, error: null }) }, from: () => query });
  provider.mockReset().mockResolvedValue({ ok: true, json: async () => ({ choices: [{ message: { content: 'Synthetic photosynthesis rubric' } }] }) });
  global.fetch = provider;
}
afterAll(() => { global.fetch = originalFetch; });
const send = async () => {
  const request = manualToolRequest(rubric, inputs);
  expect(request.url).toBe('/api/tools/rubric');
  return POST(new NextRequest('http://localhost' + request.url, { method: 'POST', body: JSON.stringify(request.body) }));
};
it('routes the actual manual rubric form to its server contract and Sol', async () => {
  setup(); const response = await send(); expect(response.status).toBe(200);
  expect(await response.json()).toMatchObject({ content: 'Synthetic photosynthesis rubric', metadata: { subject: inputs.subject, criteriaCount: 2, performanceLevels: 4 } });
  const payload = JSON.parse(provider.mock.calls[0][1].body);
  expect(payload).toMatchObject({ model: 'gpt-6.1-sol', reasoning_effort: 'medium', max_completion_tokens: 8192 });
  expect(payload.messages[1].content).toContain(inputs.subject);
});
it('keeps the actual rubric handler private to authenticated teachers', async () => {
  setup(null); expect((await send()).status).toBe(401); expect(provider).not.toHaveBeenCalled();
  setup('student', 'student'); expect((await send()).status).toBe(403); expect(provider).not.toHaveBeenCalled();
});
it.each(['brain-bytes', 'mindmap-generator'])('preserves the existing flat %s payload contract', id => {
  const tool = teachingTools.find(tool => tool.id === id)!;
  const values = id === 'brain-bytes' ? { topic: 'Photosynthesis', gradeLevel: '5' } : { centralTopic: 'Photosynthesis', gradeLevel: '5', subtopics: ['Inputs'], style: 'hierarchical', complexity: 'simple' };
  const request = manualToolRequest(tool, values);
  expect(request.url).toBe(tool.apiEndpoint);
  expect(request.body).toEqual(values);
  expect(request.body).not.toHaveProperty('formData');
});
