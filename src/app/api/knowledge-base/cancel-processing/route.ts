import { createSupabaseServerClient } from '@/lib/supabase/server';
import { NextResponse } from 'next/server';

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

    // Check if document can be cancelled (queued or processing)
    if (!['queued', 'processing'].includes(document.status)) {
      return NextResponse.json({ 
        error: `Document cannot be cancelled from status: ${document.status}` 
      }, { status: 400 });
    }

    // Update document status to cancelled
    const { error: updateError } = await supabase
      .from('documents')
      .update({
        status: 'cancelled',
        metadata: {
          ...(document.metadata as any || {}),
          cancelled_at: new Date().toISOString(),
          processing_stage: 'cancelled',
          processing_error: {
            code: 'USER_CANCELLED',
            message: 'Document processing was cancelled by user',
            userFriendlyMessage: 'Processing was cancelled',
            suggestedActions: ['Upload the document again if needed'],
            retryable: true,
            timestamp: new Date().toISOString()
          }
        },
        updated_at: new Date().toISOString()
      })
      .eq('id', documentId);

    if (updateError) {
      console.error('Error updating document to cancelled:', updateError);
      return NextResponse.json({ error: 'Failed to cancel document processing' }, { status: 500 });
    }

    return NextResponse.json({ 
      success: true, 
      message: 'Document processing cancelled successfully',
      documentId 
    });

  } catch (error) {
    console.error('Error in cancel-processing endpoint:', error);
    return NextResponse.json({ 
      error: 'Internal server error' 
    }, { status: 500 });
  }
} 