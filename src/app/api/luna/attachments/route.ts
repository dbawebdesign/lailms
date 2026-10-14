import { NextResponse } from 'next/server';
import { createSupabaseServerClient } from '@/lib/supabase/server';
import { attachmentIds, ownedAttachments, AttachmentError } from '@/lib/luna/attachments';

export async function POST(request: Request) {
  const supabase = createSupabaseServerClient();
  const { data: { user }, error } = await supabase.auth.getUser();
  if (error || !user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  try {
    const body = await request.json();
    const documents = await ownedAttachments(supabase, user.id, attachmentIds(body.documentIds));
    return NextResponse.json({ documents: documents.map(doc => ({ id: doc.id, name: doc.file_name, status: doc.status })) });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : 'Unable to read attachments' }, {
      status: error instanceof AttachmentError ? error.status : 500,
    });
  }
}
