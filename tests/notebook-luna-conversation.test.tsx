import React from 'react';
import { act, fireEvent, render, waitFor } from '@testing-library/react';
import { LunaChat, LunaChatRef } from '../src/components/study-space/LunaChat';
jest.mock('react-markdown', () => ({ __esModule: true, default: ({ children }: { children: React.ReactNode }) => <div>{children}</div> }));
jest.mock('../src/lib/supabase/client', () => ({ createClient: jest.fn() }));

beforeAll(() => { Element.prototype.scrollIntoView = jest.fn(); });
beforeEach(() => { localStorage.clear(); global.fetch = jest.fn(); });

it('creates a server conversation before reusing it and saves its ID alongside local history', async () => {
  const serverId = '11111111-1111-4111-a111-111111111111';
  (fetch as jest.Mock).mockResolvedValue({ ok: true, json: async () => ({ conversationId: serverId, messageId: 'saved-reply', response: 'Photosynthesis uses sunlight.' }) });
  const ref = React.createRef<LunaChatRef>();
  render(<LunaChat ref={ref} userId="synthetic-owner" studySpaceId="synthetic-notebook" />);
  // The component delays enabling history persistence on its first mount.
  await act(async () => { await new Promise(resolve => setTimeout(resolve, 110)); });
  await act(async () => { await ref.current!.sendMessage('Explain photosynthesis'); });
  const first = JSON.parse((fetch as jest.Mock).mock.calls[0][1].body);
  expect(first.conversationId).toBeNull();
  expect(first.userMessageId).toMatch(/^[0-9a-f-]{36}$/);
  await waitFor(() => {
    const saved = JSON.parse(localStorage.getItem('study-tools-luna-history-synthetic-owner-synthetic-notebook')!);
    expect(saved[0].serverConversationId).toBe(serverId);
    expect(saved[0].messages[1].id).toBe('saved-reply');
  });
  await act(async () => { await ref.current!.sendMessage('Explain it again'); });
  expect(JSON.parse((fetch as jest.Mock).mock.calls[1][1].body).conversationId).toBe(serverId);
});

it.each([
  ['legacy local history', null],
  ['saved server history', '11111111-1111-4111-a111-111111111111'],
])('reopens %s without treating its timestamp as a server ID', async (_label, serverId) => {
  localStorage.setItem('study-tools-luna-history-synthetic-owner', JSON.stringify([{
    id: '1750000000000', title: 'Photosynthesis history', serverConversationId: serverId,
    messages: [{ id: 'local-message', role: 'user', content: 'Earlier question', created_at: new Date().toISOString() }],
    lastUpdated: new Date().toISOString(),
  }]));
  (fetch as jest.Mock).mockResolvedValue({ ok: true, json: async () => ({ conversationId: '22222222-2222-4222-a222-222222222222', response: 'A new answer.' }) });
  const ref = React.createRef<LunaChatRef>();
  const screen = render(<LunaChat ref={ref} userId="synthetic-owner" />);
  fireEvent.click(screen.getByText('Photosynthesis history'));
  await act(async () => { await ref.current!.sendMessage('Continue'); });
  expect(JSON.parse((fetch as jest.Mock).mock.calls[0][1].body).conversationId).toBe(serverId);
});
