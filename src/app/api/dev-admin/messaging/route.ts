import { NextRequest, NextResponse } from 'next/server';
import { getGlobalAdminAccess, requireGlobalAdmin } from '@/lib/auth/require-global-admin';
import { createSupabaseServiceClient } from '@/lib/supabase/server';
import type { SupabaseClient } from '@supabase/supabase-js';

export async function GET(request: NextRequest) {
  const denied = await requireGlobalAdmin();
  if (denied) return denied;
  // The generated declaration used by the service helper predates messaging.
  const supabase: SupabaseClient = createSupabaseServiceClient();
  if (request.nextUrl.searchParams.get('view') === 'users') {
    const { data, error } = await supabase.from('profiles')
      .select('user_id, first_name, last_name, username, role')
      .neq('role', 'super_admin').order('first_name');
    if (error) return NextResponse.json({ error: 'Failed to load users' }, { status: 500 });
    return NextResponse.json({ users: data || [] });
  }
  const { data, error } = await supabase.from('admin_messages').select(`
    id, from_admin_id, subject, message, created_at, updated_at, to_user_id,
    profiles!admin_messages_to_user_id_fkey (user_id, first_name, last_name, username, role),
    admin_message_responses (id, message_id, response, responded_at)
  `).order('created_at', { ascending: false });
  if (error) return NextResponse.json({ error: 'Failed to load messages' }, { status: 500 });
  return NextResponse.json({ messages: data || [] });
}

export async function POST(request: NextRequest) {
  const { user, status } = await getGlobalAdminAccess();
  if (status || !user) return NextResponse.json({ error: status === 401 ? 'Authentication required' : 'Administrator access required' }, { status: status || 403 });
  const body = await request.json();
  const { toUserId, subject, message } = body;
  if (typeof toUserId !== 'string' || !/^[0-9a-f]{8}(?:-[0-9a-f]{4}){3}-[0-9a-f]{12}$/i.test(toUserId)
      || typeof subject !== 'string' || !subject.trim() || subject.length > 200
      || typeof message !== 'string' || !message.trim() || message.length > 5000) {
    return NextResponse.json({ error: 'A recipient, subject, and message are required' }, { status: 400 });
  }
  const supabase: SupabaseClient = createSupabaseServiceClient();
  const { error } = await supabase.from('admin_messages').insert({
    from_admin_id: user.id, to_user_id: toUserId, subject: subject.trim(), message: message.trim(),
  });
  if (error) return NextResponse.json({ error: 'Failed to send message' }, { status: 500 });
  return NextResponse.json({ success: true });
}
