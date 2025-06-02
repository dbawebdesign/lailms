import { NextRequest, NextResponse } from 'next/server';
import { createSupabaseServerClient } from '@/utils/supabase/server';
import { cookies } from 'next/headers';

interface RouteParams {
  params: Promise<{ baseClassId: string }>;
}

// GET handler to list documents for a specific base class
export async function GET(request: NextRequest, { params }: RouteParams) {
  const awaitedParams = await params; // Await params
  const { baseClassId } = awaitedParams; // Destructure from awaited params
  const supabase = await createSupabaseServerClient();

  try {
    if (!baseClassId) {
      return NextResponse.json({ error: 'Base Class ID is required' }, { status: 400 });
    }

    // Get user and verify organization access
    const { data: { user }, error: userError } = await supabase.auth.getUser();
    if (userError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Get user's organization
    const { data: profile, error: profileError } = await supabase
      .from('profiles')
      .select('organisation_id')
      .eq('user_id', user.id) // Use user_id instead of id
      .single();

    if (profileError || !profile || !profile.organisation_id) {
      console.error('Error fetching profile or organisation_id:', profileError);
      return NextResponse.json({ error: 'Could not verify user organisation membership.' }, { status: 500 });
    }

    const { data: documents, error } = await supabase
      .from('documents')
      .select('id, file_name, file_type, file_size, status, created_at, metadata')
      .eq('base_class_id', baseClassId)
      .eq('organisation_id', profile.organisation_id) // Filter by organization
      .order('created_at', { ascending: false });

    if (error) {
      console.error('Error fetching documents:', error);
      return NextResponse.json({ error: 'Failed to fetch documents', details: error.message }, { status: 500 });
    }

    return NextResponse.json(documents || []);

  } catch (err) {
    console.error('Unexpected error fetching documents:', err);
    return NextResponse.json({ error: 'An unexpected error occurred' }, { status: 500 });
  }
}

// POST handler to upload a new document for a specific base class
export async function POST(request: NextRequest, { params }: RouteParams) {
  const awaitedParams = await params; // Await params
  const { baseClassId } = awaitedParams; // Destructure from awaited params
  const supabase = await createSupabaseServerClient();

  try {
    if (!baseClassId) {
      return NextResponse.json({ error: 'Base Class ID is required' }, { status: 400 });
    }

    // 1. Get User and Organisation Info
    const { data: { user }, error: userError } = await supabase.auth.getUser();
    if (userError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    
    // Fetch profile to get organisation_id (assuming profiles table exists and links user_id to org_id)
    const { data: profile, error: profileError } = await supabase
        .from('profiles') // Or 'members' if that's the table name
        .select('organisation_id')
        .eq('user_id', user.id) // Use user_id instead of id
        .single();

    if (profileError || !profile || !profile.organisation_id) {
        console.error('Error fetching profile or organisation_id:', profileError);
        return NextResponse.json({ error: 'Failed to get user organisation' }, { status: 500 });
    }
    const organisationId = profile.organisation_id;


    // 2. Process FormData and Get File
    const formData = await request.formData();
    const file = formData.get('file') as File | null;

    if (!file) {
      return NextResponse.json({ error: 'File is required' }, { status: 400 });
    }

    // 3. Upload File to Supabase Storage
    const timestamp = Date.now();
    const uniqueFileName = `${timestamp}_${file.name.replace(/\s+/g, '_')}`; 
    
    // *** Construct the correct bucket name based on the organization ID ***
    const bucketName = `org-${organisationId}-uploads`;
    
    const filePath = `${baseClassId}/${uniqueFileName}`; // Path within the org bucket
    
    console.log(`Uploading to bucket: ${bucketName}, path: ${filePath}`); // Added log for debugging
    
    const { data: uploadData, error: uploadError } = await supabase.storage
      .from(bucketName) // *** Use the dynamic bucket name ***
      .upload(filePath, file);

    if (uploadError) {
      console.error(`Error uploading file to bucket ${bucketName}:`, uploadError);
      return NextResponse.json({ error: 'Failed to upload file', details: uploadError.message }, { status: 500 });
    }

    // 4. Insert Document Record into Database
    const { data: documentRecord, error: insertError } = await supabase
      .from('documents')
      .insert({
        file_name: file.name,
        storage_path: uploadData.path, 
        base_class_id: baseClassId,
        organisation_id: organisationId,
        uploaded_by: user.id,
        file_type: file.type,
        file_size: file.size,
        status: 'queued' // Set initial status to 'queued' for the processing function
      })
      .select('id') // Only select ID, as we'll return the initial record
      .single();

    if (insertError) {
      console.error('Error inserting document record:', insertError);
      console.log(`Attempting to remove orphaned file from ${bucketName}: ${filePath}`);
      await supabase.storage.from(bucketName).remove([filePath]);
      return NextResponse.json({ error: 'Failed to save document record', details: insertError.message }, { status: 500 });
    }

    // 5. Asynchronously trigger the process-document Edge Function
    if (documentRecord && documentRecord.id) {
      const processFunctionUrl = `${process.env.NEXT_PUBLIC_SUPABASE_URL}/functions/v1/process-document`;
      fetch(processFunctionUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          // Supabase Edge Functions are often protected, Authorization might be needed
          // If your function is protected, you might need to pass the service_role key
          // or a user token if the function expects user context for RLS on related tables.
          // For a service-to-service call like this, a specific auth mechanism (e.g. function secret) is best.
          // For simplicity, assuming it might be accessible or uses a service key internally already if called from backend.
          // 'Authorization': `Bearer ${process.env.SUPABASE_SERVICE_ROLE_KEY}` // Example if service key needed
        },
        body: JSON.stringify({ documentId: documentRecord.id }),
      })
      .then(async (response) => {
        if (!response.ok) {
          const errorData = await response.text();
          console.error(`Error triggering process-document function for ${documentRecord.id}: ${response.status} ${response.statusText}`, errorData);
        } else {
          console.log(`Successfully triggered process-document function for ${documentRecord.id}`);
        }
      })
      .catch((err) => {
        console.error(`Network error triggering process-document function for ${documentRecord.id}:`, err);
      });
    }

    // 6. Return Success Response (return the initially created record, processing is async)
    // Fetch the full record to return, or just the ID and path as before
    return NextResponse.json({ 
        message: "Upload successful, processing started.", 
        documentId: documentRecord?.id, 
        filePath: uploadData.path 
    });

  } catch (err) {
    console.error('Unexpected error uploading document:', err);
    // Check if err is an object with a message property before accessing it
    const errorMessage = (err instanceof Error) ? err.message : 'An unexpected error occurred';
    return NextResponse.json({ error: errorMessage }, { status: 500 });
  }
} 