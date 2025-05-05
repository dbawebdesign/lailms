import { createSupabaseServerClient } from '@/lib/supabase/server';
import { cookies } from 'next/headers';
import { NextResponse } from 'next/server';
import { Database } from 'packages/types/supabase';

export async function POST(request: Request) {
  const supabase = createSupabaseServerClient();

  const {
    data: { session },
  } = await supabase.auth.getSession();

  if (!session) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  // --- Get Organisation ID from user's membership --- 
  const { data: member, error: memberError } = await supabase
    .from('members') // Use the members table
    .select('organisation_id')
    .eq('auth_id', session.user.id) // Match using the auth_id column
    .maybeSingle();

  if (memberError) {
    console.error('Error fetching member record:', memberError);
    return NextResponse.json({ error: 'Could not verify user organisation membership.' }, { status: 500 });
  }

  if (!member || !member.organisation_id) {
    return NextResponse.json({ error: 'User membership not found or not associated with an organisation.' }, { status: 403 }); // Forbidden
  }

  const userOrganisationId = member.organisation_id;
  // --- End Get Organisation ID --- 

  const formData = await request.formData();
  const file = formData.get('file') as File | null;

  if (!file) {
    return NextResponse.json({ error: 'File is required' }, { status: 400 });
  }

  const bucketName = `org-${userOrganisationId}-uploads`;
  const filePath = `${Date.now()}-${file.name}`;

  try {
    // 1. Upload file to Supabase Storage
    const { error: uploadError } = await supabase.storage
      .from(bucketName)
      .upload(filePath, file);

    if (uploadError) {
      console.error('Storage Upload Error:', uploadError);
      // Attempt to create bucket if it doesn't exist (naive approach)
      if (uploadError.message.includes('Bucket not found')) {
        console.log(`Attempting to create bucket: ${bucketName}`);
        const { error: createBucketError } = await supabase.storage.createBucket(
          bucketName,
          {
            public: false, // Or true, depending on requirements
            // Add file size limit if needed: fileSizeLimit: '10MB'
          }
        );
        if (createBucketError && !createBucketError.message.includes('already exists')) { // Ignore if bucket already exists race condition
          console.error('Create Bucket Error:', createBucketError);
          throw new Error(`Failed to create bucket: ${createBucketError.message}`);
        }
        // Retry upload after bucket creation attempt
        const { error: retryUploadError } = await supabase.storage
          .from(bucketName)
          .upload(filePath, file);
        if (retryUploadError) {
            console.error('Retry Storage Upload Error:', retryUploadError);
            throw new Error(`Failed to upload file after bucket creation: ${retryUploadError.message}`);
        }
      } else {
        throw new Error(`Failed to upload file: ${uploadError.message}`);
      }
    }

    // 2. Insert metadata into the documents table
    const documentData: Database['public']['Tables']['documents']['Insert'] = {
      organisation_id: userOrganisationId,
      name: file.name,
      storage_path: filePath,
      file_type: file.type,
      file_size: file.size,
      uploader_id: session.user.id,
      status: 'uploaded', // Default status
      // embedding_status and metadata can be null or set later
    };

    const { data: insertedDocument, error: insertError } = await supabase
      .from('documents')
      .insert(documentData)
      .select()
      .single(); // Assuming you want the inserted record back

    if (insertError) {
      console.error('Database Insert Error:', insertError);
      // TODO: Consider deleting the uploaded file if DB insert fails (rollback)
      throw new Error(`Failed to save document metadata: ${insertError.message}`);
    }

    return NextResponse.json(insertedDocument, { status: 201 });

  } catch (error) {
    console.error('Upload API Error:', error);
    const errorMessage = error instanceof Error ? error.message : 'An unknown error occurred';
    return NextResponse.json({ error: errorMessage }, { status: 500 });
  }
} 