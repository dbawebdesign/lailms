import { createSupabaseServerClient } from '@/lib/supabase/server';
import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

interface RouteParams {
  params: {
    baseClassId: string;
    documentId: string;
  };
}

export async function DELETE(request: NextRequest, { params }: RouteParams) {
  const supabase = await createSupabaseServerClient();
  const { baseClassId, documentId } = params;

  const {
    data: { session },
  } = await supabase.auth.getSession();

  if (!session) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  if (!baseClassId) {
    return NextResponse.json({ error: 'Base Class ID is required' }, { status: 400 });
  }

  if (!documentId) {
    return NextResponse.json({ error: 'Document ID is required' }, { status: 400 });
  }

  try {
    // 1. Get the user's organisation ID
    // Use the correct table and column names
    const { data: profile, error: profileError } = await supabase
      .from('profiles')
      .select('organisation_id')
      .eq('user_id', session.user.id) // Use user_id instead of id
      .single();

    if (profileError || !profile || !profile.organisation_id) {
      console.error('Error fetching profile or organisation_id for delete:', profileError);
      return NextResponse.json({ error: 'Could not verify user organisation membership.' }, { status: 500 });
    }
    const userOrganisationId = profile.organisation_id;

    // 2. Fetch the document to verify ownership (via org and base_class_id) and get storage_path
    const { data: document, error: docFetchError } = await supabase
      .from('documents')
      .select('id, storage_path, organisation_id, base_class_id')
      .eq('id', documentId)
      .single();

    if (docFetchError) {
      console.error('Error fetching document for delete:', docFetchError);
      const status = docFetchError.code === 'PGRST116' ? 404 : 500; // PGRST116: 'Not found'
      return NextResponse.json({ error: 'Document not found or error fetching it.' }, { status });
    }

    // Verify ownership: document must belong to the user's organisation AND the specified baseClassId
    if (document.organisation_id !== userOrganisationId) {
      console.warn(`User ${session.user.id} from org ${userOrganisationId} attempted to delete document ${documentId} belonging to org ${document.organisation_id}.`);
      return NextResponse.json({ error: 'Forbidden: You do not own this document (org mismatch).' }, { status: 403 });
    }
    // Also check if the document is correctly associated with the baseClassId in the route
    // This check is important if a document could be in the correct org but wrong base class.
    if (document.base_class_id !== baseClassId) {
        console.warn(`User ${session.user.id} attempted to delete document ${documentId} (base_class_id ${document.base_class_id}) via baseClassId ${baseClassId} route.`);
        return NextResponse.json({ error: 'Forbidden: Document not associated with this base class.' }, { status: 403 });
    }


    // 3. Delete from Storage (if storage_path exists)
    // The storage path for base class documents is `${baseClassId}/${uniqueFileName}`
    // The bucket name is `org-${userOrganisationId}-uploads`
    if (document.storage_path) {
      const bucketName = `org-${userOrganisationId}-uploads`;
      console.log(`Attempting to delete from storage: ${bucketName}/${document.storage_path}`);
      const { error: storageError } = await supabase.storage
        .from(bucketName)
        .remove([document.storage_path]); // storage_path should be the full path within the bucket

      if (storageError) {
        // Log the error but proceed to delete DB record anyway.
        // The DB record is the source of truth for listing.
        console.error(`Failed to delete file from storage (${bucketName}/${document.storage_path}):`, storageError);
      } else {
        console.log(`Successfully deleted from storage: ${bucketName}/${document.storage_path}`);
      }
    } else {
        console.warn(`Document ${documentId} has no storage_path, skipping storage deletion.`);
    }

    // 4. Delete from Database
    const { error: dbDeleteError } = await supabase
      .from('documents')
      .delete()
      .eq('id', documentId);

    if (dbDeleteError) {
      console.error('Error deleting document from database:', dbDeleteError);
      return NextResponse.json({ error: 'Failed to delete document metadata.' }, { status: 500 });
    }

    return NextResponse.json({ message: 'Document deleted successfully' }, { status: 200 });

  } catch (error: any) {
    console.error('DELETE Document API Error:', error);
    const errorMessage = error instanceof Error ? error.message : 'An unknown error occurred';
    return NextResponse.json({ error: errorMessage }, { status: 500 });
  }
} 