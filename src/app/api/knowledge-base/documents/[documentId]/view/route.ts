import { createSupabaseServerClient } from '@/lib/supabase/server';
import { NextResponse } from 'next/server';

export async function GET(
  request: Request,
  { params }: { params: Promise<{ documentId: string }> }
) {
  const supabase = createSupabaseServerClient();
  const { documentId } = await params;

  const {
    data: { session },
  } = await supabase.auth.getSession();

  if (!session) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    // Get user's organisation
    const { data: profile, error: profileError } = await supabase
      .from('profiles')
      .select('organisation_id')
      .eq('user_id', session.user.id)
      .maybeSingle();

    if (profileError || !profile?.organisation_id) {
      return NextResponse.json({ error: 'Could not verify user organisation membership.' }, { status: 403 });
    }

    // Fetch the document with organisation verification
    const { data: document, error: docError } = await supabase
      .from('documents')
      .select('id, file_name, storage_path, file_type, metadata, organisation_id')
      .eq('id', documentId)
      .eq('organisation_id', profile.organisation_id)
      .single();

    if (docError || !document) {
      return NextResponse.json({ error: 'Document not found or access denied' }, { status: 404 });
    }

    // Check if this is a URL-type document
    const metadata = document.metadata as any;
    if (metadata?.originalUrl) {
      // For URLs, return the original URL
      return NextResponse.json({
        type: 'url',
        url: metadata.originalUrl,
        fileName: document.file_name
      });
    }

    // For files, generate a signed URL
    if (document.storage_path) {
      const bucketName = 'documents';
      const { data: signedUrlData, error: signedUrlError } = await supabase.storage
        .from(bucketName)
        .createSignedUrl(document.storage_path, 3600); // 1 hour expiry

      if (signedUrlError) {
        console.error('Error creating signed URL:', signedUrlError);
        return NextResponse.json({ error: 'Could not generate view URL' }, { status: 500 });
      }

      return NextResponse.json({
        type: 'file',
        url: signedUrlData.signedUrl,
        fileName: document.file_name,
        fileType: document.file_type
      });
    }

    return NextResponse.json({ error: 'Document has no viewable content' }, { status: 400 });

  } catch (error) {
    console.error('View document API error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
} 