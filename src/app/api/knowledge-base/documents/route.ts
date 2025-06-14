import { createSupabaseServerClient } from '@/lib/supabase/server';
import { NextResponse } from 'next/server';
import { Database } from '@learnologyai/types';

export async function GET(request: Request) {
  const supabase = createSupabaseServerClient();
  
  const { searchParams } = new URL(request.url);
  const baseClassId = searchParams.get('base_class_id');
  const summaryParam = searchParams.get('summary');
  const isRequestingSummary = summaryParam === 'true';

  const {
    data: { session },
  } = await supabase.auth.getSession();

  if (!session) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    // 1. Get the user's organisation ID from their profile record
    const { data: profile, error: profileError } = await supabase
      .from('profiles')
      .select('organisation_id')
      .eq('user_id', session.user.id)
      .single();

    if (profileError) {
      console.error('Error fetching profile record:', profileError);
      if (profileError.code === 'PGRST116') {
         return NextResponse.json({ error: 'User profile not found.' }, { status: 404 });
      }
      return NextResponse.json({ error: 'Could not verify user organisation membership.' }, { status: 500 });
    }

    if (!profile || !profile.organisation_id) {
      return NextResponse.json({ error: 'User is not associated with an organisation.' }, { status: 403 });
    }

    const userOrganisationId = profile.organisation_id;

    // 2. Build query with filters
    let query = supabase
      .from('documents')
      .select('*')
      .eq('organisation_id', userOrganisationId);

    // Filter by base class if provided
    if (baseClassId) {
      query = query.eq('base_class_id', baseClassId);
    }

    query = query.order('created_at', { ascending: false });

    const { data: documents, error: documentsError } = await query;

    if (documentsError) {
      console.error('Error fetching documents:', documentsError);
      return NextResponse.json({ error: 'Failed to fetch documents.' }, { status: 500 });
    }

    // 3. Return summary if requested
    if (isRequestingSummary) {
      const completedDocs = documents?.filter(doc => doc.status === 'completed') || [];
      const fileTypes = [...new Set(completedDocs.map(doc => {
        if (doc.file_name?.startsWith('URL -')) {
          return doc.file_name.includes('youtube') ? 'YouTube Video' : 'Web Page';
        }
        switch (doc.file_type) {
          case 'application/pdf': return 'PDF';
          case 'text/plain': return 'Text';
          case 'audio/mp3':
          case 'audio/mpeg':
          case 'audio/wav': return 'Audio';
          case 'video/mp4': return 'Video';
          default: return doc.file_type?.split('/')[1]?.toUpperCase() || 'File';
        }
      }))];

      return NextResponse.json({
        total: documents?.length || 0,
        completed: completedDocs.length,
        types: fileTypes
      }, { status: 200 });
    }

    // 4. Return full document list
    return NextResponse.json(documents || [], { status: 200 });

  } catch (error) {
    console.error('GET Documents API Error:', error);
    const errorMessage = error instanceof Error ? error.message : 'An unknown error occurred';
    return NextResponse.json({ error: errorMessage }, { status: 500 });
  }
}

export async function DELETE(request: Request) {
  const supabase = createSupabaseServerClient();

  const {
    data: { session },
  } = await supabase.auth.getSession();

  if (!session) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  // Get docId from query parameters
  const { searchParams } = new URL(request.url);
  const docId = searchParams.get('docId');

  if (!docId) {
    return NextResponse.json({ error: 'Document ID (docId) is required' }, { status: 400 });
  }

  try {
    // 1. Get the user's organisation ID (reuse logic from GET or fetch again)
    const { data: profile, error: profileError } = await supabase
      .from('profiles')
      .select('organisation_id')
      .eq('user_id', session.user.id)
      .single();

    if (profileError || !profile || !profile.organisation_id) {
      // Handle errors similar to GET
      console.error('Error fetching profile for delete:', profileError);
      return NextResponse.json({ error: 'Could not verify user organisation membership for deletion.' }, { status: profileError?.code === 'PGRST116' ? 404 : 500 });
    }
    const userOrganisationId = profile.organisation_id;

    // 2. Fetch the document to verify ownership and get storage_path
    const { data: document, error: docFetchError } = await supabase
      .from('documents')
      .select('id, storage_path, organisation_id')
      .eq('id', docId)
      .single();

    if (docFetchError) {
        console.error('Error fetching document for delete:', docFetchError);
        return NextResponse.json({ error: 'Document not found or error fetching it.' }, { status: docFetchError.code === 'PGRST116' ? 404 : 500 });
    }

    if (document.organisation_id !== userOrganisationId) {
        console.warn(`User ${session.user.id} attempted to delete document ${docId} belonging to org ${document.organisation_id}`);
        return NextResponse.json({ error: 'Forbidden: You do not own this document.' }, { status: 403 });
    }

    // 3. Delete from Storage (if storage_path exists)
    if (document.storage_path) {
        const bucketName = `org-${userOrganisationId}-uploads`; // Reconstruct bucket name
        const { error: storageError } = await supabase.storage
            .from(bucketName)
            .remove([document.storage_path]);

        if (storageError) {
            // Log the error but proceed to delete DB record anyway? Or return error?
            // Let's log and proceed for now, as the DB record is the source of truth.
            console.error(`Failed to delete file from storage (${bucketName}/${document.storage_path}):`, storageError);
        }
    }

    // 4. Delete from Database
    const { error: dbDeleteError } = await supabase
        .from('documents')
        .delete()
        .eq('id', docId);

    if (dbDeleteError) {
        console.error('Error deleting document from database:', dbDeleteError);
        // Maybe the document was already deleted? Check error code if needed.
        return NextResponse.json({ error: 'Failed to delete document metadata.' }, { status: 500 });
    }

    return NextResponse.json({ message: 'Document deleted successfully' }, { status: 200 });

  } catch (error) {
    console.error('DELETE Document API Error:', error);
    const errorMessage = error instanceof Error ? error.message : 'An unknown error occurred';
    return NextResponse.json({ error: errorMessage }, { status: 500 });
  }
} 