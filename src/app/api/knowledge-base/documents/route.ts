import { createSupabaseServerClient } from '@/lib/supabase/server';
import { NextResponse } from 'next/server';
import { Tables } from 'packages/types/db';

export async function GET(request: Request) {
  const supabase = createSupabaseServerClient();
  
  const { searchParams } = new URL(request.url);
  const baseClassId = searchParams.get('base_class_id');
  const summaryParam = searchParams.get('summary');
  const userOnlyParam = searchParams.get('user_only');
  const isRequestingSummary = summaryParam === 'true';
  const isUserOnly = userOnlyParam === 'true';

  const {
    data: { user },
    error: authError
  } = await supabase.auth.getUser();

  if (authError || !user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    // Get user's profile to get organization info (needed for organization-based filtering)
    const { data: profile, error: profileError } = await supabase
      .from('profiles')
      .select('organisation_id')
      .eq('user_id', user.id)
      .single<Tables<'profiles'>>();

    if (profileError) {
      console.error('Error fetching profile record:', profileError);
      if (profileError.code === 'PGRST116') {
         return NextResponse.json({ error: 'User profile not found.' }, { status: 404 });
      }
      return NextResponse.json({ error: 'Could not verify user organisation membership.' }, { status: 500 });
    }

    if (!profile || (!profile.organisation_id && !isUserOnly)) {
      return NextResponse.json({ error: 'User is not associated with an organisation.' }, { status: 403 });
    }

    // Build query with appropriate filtering
    let query = supabase
      .from('documents')
      .select('*');

    // Apply filtering based on user_only parameter
    if (isUserOnly) {
      // Filter by user for /teach/knowledge page
      query = query.eq('uploaded_by', user.id);
    } else {
      // Filter by organization for other pages
      if (!profile.organisation_id) {
        return NextResponse.json({ error: 'User is not associated with an organisation.' }, { status: 403 });
      }
      query = query.eq('organisation_id', profile.organisation_id);
    }

    // Filter by base class if provided
    if (baseClassId) {
      // Verify the base class belongs to the user (for user-only) or organization
      const baseClassQuery = supabase
        .from('base_classes')
        .select('id')
        .eq('id', baseClassId);
      
      if (isUserOnly) {
        baseClassQuery.eq('user_id', user.id);
      } else {
        if (!profile.organisation_id) {
          return NextResponse.json({ error: 'User is not associated with an organisation.' }, { status: 403 });
        }
        baseClassQuery.eq('organisation_id', profile.organisation_id);
      }
      
      const { data: baseClass } = await baseClassQuery.single();
      
      if (!baseClass) {
        return NextResponse.json({ error: 'Base class not found or access denied' }, { status: 404 });
      }
      
      query = query.eq('base_class_id', baseClassId);
    }

    query = query.order('created_at', { ascending: false });

    const { data: documents, error: documentsError } = await query.returns<Tables<'documents'>[]>();

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
    data: { user },
    error: authError
  } = await supabase.auth.getUser();

  if (authError || !user) {
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
      .eq('user_id', user.id)
      .single<Tables<'profiles'>>();

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
      .single<Tables<'documents'>>();

    if (docFetchError) {
        console.error('Error fetching document for delete:', docFetchError);
        return NextResponse.json({ error: 'Document not found or error fetching it.' }, { status: docFetchError.code === 'PGRST116' ? 404 : 500 });
    }

    if (document.organisation_id !== userOrganisationId) {
        console.warn(`User ${user.id} attempted to delete document ${docId} belonging to org ${document.organisation_id}`);
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