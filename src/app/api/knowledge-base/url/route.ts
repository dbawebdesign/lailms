import { createSupabaseServerClient } from '@/lib/supabase/server';
import { NextResponse } from 'next/server';
import { persistSource, SourceUploadError } from '@/lib/knowledge-base/persist-source';
import { dispatchDocument } from '@/lib/knowledge-base/dispatch-document';

export async function POST(request: Request) {
  const supabase = createSupabaseServerClient();
  const { data: { user }, error: authError } = await supabase.auth.getUser();
  if (authError || !user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  try {
    const { url, type, base_class_id } = await request.json();
    if (typeof url !== 'string' || !url || !['youtube', 'webpage'].includes(type)) {
      throw new SourceUploadError('URL and supported type are required', 400);
    }
    let parsed: URL;
    try { parsed = new URL(url); } catch { throw new SourceUploadError('Invalid URL format', 400); }
    if (!['http:', 'https:'].includes(parsed.protocol)) throw new SourceUploadError('Only HTTP and HTTPS URLs are supported', 400);
    const { data: profile, error } = await supabase.from('profiles').select('organisation_id').eq('user_id', user.id).maybeSingle();
    if (error) throw new SourceUploadError('Could not verify user organisation membership');
    if (!profile?.organisation_id) throw new SourceUploadError('User is not associated with an organisation', 403);
    const result = await persistSource(supabase, {
      userId: user.id, organisationId: profile.organisation_id,
      baseClassId: typeof base_class_id === 'string' && base_class_id ? base_class_id : null,
      fileName: type === 'youtube' ? `URL - ${url}` : `URL - ${parsed.hostname}${parsed.pathname}`,
      fileType: type === 'youtube' ? 'video/youtube' : 'text/html', content: url,
      metadata: { originalUrl: url, type, timestamp: new Date().toISOString(), source: 'url_submission' },
      idempotencyKey: request.headers.get('Idempotency-Key'), urlType: type,
    });
    if (!result.reused) dispatchDocument(supabase, result.id);
    return NextResponse.json({ ...result, type, url, message: result.reused ? 'Existing URL reused.' : 'URL submitted successfully, processing initiated.' }, { status: 202 });
  } catch (error) {
    console.error('URL submission error', error);
    return NextResponse.json({ error: error instanceof Error ? error.message : 'URL submission failed' }, {
      status: error instanceof SourceUploadError ? error.status : 500,
    });
  }
}
