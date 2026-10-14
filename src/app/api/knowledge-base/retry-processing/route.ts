import { createSupabaseServerClient } from '@/lib/supabase/server';
import { NextResponse } from 'next/server';
import { dispatchDocument } from '@/lib/knowledge-base/dispatch-document';

export async function POST(request: Request) {
  try {
    const { documentId } = await request.json();
    
    if (!documentId) {
      return NextResponse.json({ error: 'Document ID is required' }, { status: 400 });
    }

    const supabase = createSupabaseServerClient();
    
    // Verify user authentication
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Get document and verify ownership/access
    const { data: document, error: fetchError } = await supabase
      .from('documents')
      .select('*')
      .eq('id', documentId)
      .single();

    if (fetchError || !document) {
      return NextResponse.json({ error: 'Document not found' }, { status: 404 });
    }

    // Check if document is in error state or can be retried
    if (document.status !== 'error') {
      return NextResponse.json({ 
        error: 'Document is not in error state and cannot be retried' 
      }, { status: 400 });
    }

    // Reset document status to queued for retry
    const { data: claimed, error: updateError } = await supabase
      .from('documents')
      .update({
        status: 'queued',
        metadata: {
          ...(document.metadata as any || {}),
          retry_count: ((document.metadata as any)?.retry_count || 0) + 1,
          last_retry_at: new Date().toISOString(),
          processing_error: null, // Clear previous error
          processing_stage: 'queued'
        },
        updated_at: new Date().toISOString()
      })
      .eq('id', documentId).eq('status', 'error').select('id').maybeSingle();

    if (updateError) {
      console.error('Error updating document for retry:', updateError);
      return NextResponse.json({ error: 'Failed to reset document for retry' }, { status: 500 });
    }

    if (claimed) dispatchDocument(supabase, documentId);

    return NextResponse.json({ 
      success: true, 
      message: 'Document queued for retry processing',
      documentId 
    });

  } catch (error) {
    console.error('Error in retry-processing endpoint:', error);
    return NextResponse.json({ 
      error: 'Internal server error' 
    }, { status: 500 });
  }
} 