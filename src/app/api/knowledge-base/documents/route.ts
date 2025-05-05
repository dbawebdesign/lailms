import { createSupabaseServerClient } from '@/lib/supabase/server';
import { NextResponse } from 'next/server';
import { Database } from '@learnologyai/types';

export async function GET(request: Request) {
  const supabase = createSupabaseServerClient();

  const {
    data: { session },
  } = await supabase.auth.getSession();

  if (!session) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    // 1. Get the user's organisation ID from their membership record
    const { data: member, error: memberError } = await supabase
      .from('members')
      .select('organisation_id')
      .eq('auth_id', session.user.id)
      .single(); // Use single() as a user should belong to exactly one org in this context

    if (memberError) {
      console.error('Error fetching member record:', memberError);
      // If memberError indicates "Row level security violation", it might mean the user exists but has no org
      // or RLS prevents access. If it indicates "JSON object requested, multiple (or no) rows returned", 
      // it means the user has multiple/no member records.
      if (memberError.code === 'PGRST116') { // Check for specific error code for no rows
         return NextResponse.json({ error: 'User membership not found.' }, { status: 404 });
      }
      return NextResponse.json({ error: 'Could not verify user organisation membership.' }, { status: 500 });
    }

    if (!member || !member.organisation_id) {
      // This case might be redundant if single() throws an error for no rows, but good for clarity
      return NextResponse.json({ error: 'User is not associated with an organisation.' }, { status: 403 });
    }

    const userOrganisationId = member.organisation_id;

    // 2. Fetch documents for that organisation
    const { data: documents, error: documentsError } = await supabase
      .from('documents')
      .select('*') // Select all columns for now, adjust as needed for FileListTable
      .eq('organisation_id', userOrganisationId)
      .order('created_at', { ascending: false }); // Order by creation date, newest first

    if (documentsError) {
      console.error('Error fetching documents:', documentsError);
      return NextResponse.json({ error: 'Failed to fetch documents.' }, { status: 500 });
    }

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
    const { data: member, error: memberError } = await supabase
      .from('members')
      .select('organisation_id')
      .eq('auth_id', session.user.id)
      .single();

    if (memberError || !member || !member.organisation_id) {
      // Handle errors similar to GET
      console.error('Error fetching member for delete:', memberError);
      return NextResponse.json({ error: 'Could not verify user organisation membership for deletion.' }, { status: memberError?.code === 'PGRST116' ? 404 : 500 });
    }
    const userOrganisationId = member.organisation_id;

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