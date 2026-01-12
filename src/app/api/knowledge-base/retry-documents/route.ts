import { createSupabaseServerClient } from '@/lib/supabase/server';
import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

export async function POST(request: Request) {
  const supabase = createSupabaseServerClient();

  const {
    data: { user },
    error: authError
  } = await supabase.auth.getUser();

  if (authError || !user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const { documentIds } = await request.json();

    if (!documentIds || !Array.isArray(documentIds) || documentIds.length === 0) {
      return NextResponse.json({ error: 'Document IDs are required' }, { status: 400 });
    }

    // Get user's organisation
    const { data: profile, error: profileError } = await supabase
      .from('profiles')
      .select('organisation_id')
      .eq('user_id', user.id)
      .maybeSingle();

    if (profileError || !profile?.organisation_id) {
      return NextResponse.json({ error: 'User profile not found' }, { status: 403 });
    }

    // Verify all documents belong to user's organisation
    const { data: documents, error: docsError } = await supabase
      .from('documents')
      .select('id, organisation_id, status')
      .in('id', documentIds);

    if (docsError) {
      console.error('Error fetching documents:', docsError);
      return NextResponse.json({ error: 'Failed to fetch documents' }, { status: 500 });
    }

    // Verify ownership and status
    const invalidDocs = documents?.filter(
      doc => doc.organisation_id !== profile.organisation_id || doc.status !== 'error'
    );

    if (invalidDocs && invalidDocs.length > 0) {
      return NextResponse.json(
        { error: 'Some documents cannot be retried (not owned by user or not in error state)' },
        { status: 403 }
      );
    }

    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

    if (!supabaseUrl || !supabaseAnonKey) {
      return NextResponse.json(
        { error: 'Server configuration error' },
        { status: 500 }
      );
    }

    const invokeClient = createClient(supabaseUrl, supabaseAnonKey);
    const results = [];

    for (const documentId of documentIds) {
      try {
        // Reset document status to queued
        const { error: updateError } = await supabase
          .from('documents')
          .update({
            status: 'queued',
            updated_at: new Date().toISOString()
          })
          .eq('id', documentId);

        if (updateError) {
          console.error(`Failed to reset document ${documentId}:`, updateError);
          results.push({
            documentId,
            success: false,
            error: updateError.message
          });
          continue;
        }

        // Invoke process-document function (fire-and-forget)
        invokeClient.functions
          .invoke('process-document', {
            body: { documentId }
          })
          .then(({ error: invokeError }) => {
            if (invokeError) {
              console.error(`Failed to invoke process-document for ${documentId}:`, invokeError);
            } else {
              console.log(`Successfully invoked process-document for ${documentId}`);
            }
          })
          .catch((error) => {
            console.error(`Unexpected error invoking process-document for ${documentId}:`, error);
          });

        results.push({
          documentId,
          success: true
        });
      } catch (error) {
        const errorMsg = error instanceof Error ? error.message : 'Unknown error';
        console.error(`Error retrying document ${documentId}:`, errorMsg);
        results.push({
          documentId,
          success: false,
          error: errorMsg
        });
      }
    }

    const successCount = results.filter(r => r.success).length;
    const failureCount = results.filter(r => !r.success).length;

    return NextResponse.json({
      success: failureCount === 0,
      message: `Retry initiated for ${successCount} document(s)${failureCount > 0 ? `, ${failureCount} failed` : ''}`,
      results
    });

  } catch (error) {
    console.error('Retry documents API error:', error);
    const errorMessage = error instanceof Error ? error.message : 'An unknown error occurred';
    return NextResponse.json({ error: errorMessage }, { status: 500 });
  }
}
