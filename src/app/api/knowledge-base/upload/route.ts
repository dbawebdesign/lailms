import { createSupabaseServerClient } from '@/lib/supabase/server';
import { NextResponse } from 'next/server';
import { persistSource, SourceUploadError } from '@/lib/knowledge-base/persist-source';
import { dispatchDocument } from '@/lib/knowledge-base/dispatch-document';

export async function POST(request: Request) {
  const supabase = createSupabaseServerClient();
  const { data: { user }, error: authError } = await supabase.auth.getUser();
  if (authError || !user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  try {
    const { data: profile, error } = await supabase.from('profiles').select('organisation_id').eq('user_id', user.id).maybeSingle();
    if (error) throw new SourceUploadError('Could not verify user organisation membership');
    if (!profile?.organisation_id) throw new SourceUploadError('User is not associated with an organisation', 403);
    const form = await request.formData();
    const file = form.get('file');
    if (!file || typeof file === 'string') throw new SourceUploadError('File is required', 400);
    if (file.size > 50 * 1024 * 1024) throw new SourceUploadError('File exceeds the 50MB limit', 413);
    const baseClass = form.get('base_class_id');
    const result = await persistSource(supabase, {
      userId: user.id, organisationId: profile.organisation_id,
      baseClassId: typeof baseClass === 'string' && baseClass ? baseClass : null,
      fileName: file.name, fileType: file.type, content: file,
      idempotencyKey: request.headers.get('Idempotency-Key'),
    });
    if (!result.reused) dispatchDocument(supabase, result.id);
    return NextResponse.json({ ...result, message: result.reused ? 'Existing upload reused.' : 'Upload successful, processing initiated.' }, { status: 202 });
  } catch (error) {
    console.error('Upload API error', error);
    return NextResponse.json({ error: error instanceof Error ? error.message : 'Upload failed' }, {
      status: error instanceof SourceUploadError ? error.status : 500,
    });
  }
}
