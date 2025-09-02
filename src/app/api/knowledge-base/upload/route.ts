import { createSupabaseServerClient } from '@/lib/supabase/server';
import { cookies } from 'next/headers';
import { NextResponse } from 'next/server';
import { Database, Tables } from '../../../../../packages/types/db';
import { createClient } from '@supabase/supabase-js'; // Import standard client for function invocation

// Define the status enum type locally for type safety
type DocumentStatus = 'queued' | 'processing' | 'completed' | 'error';

export async function POST(request: Request) {
  const supabase = createSupabaseServerClient(); // Server client for auth and initial actions

  const {
    data: { user },
    error: authError
  } = await supabase.auth.getUser();

  if (authError || !user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  // --- Get Organisation ID from user's profile --- 
  const { data: profile, error: profileError } = await supabase
    .from('profiles') // Use the profiles table
    .select('organisation_id')
    .eq('user_id', user.id) // Match using the user_id column
    .maybeSingle<Tables<'profiles'>>();

  if (profileError) {
    console.error('Error fetching profile record:', profileError);
    return NextResponse.json({ error: 'Could not verify user organisation membership.' }, { status: 500 });
  }

  if (!profile || !profile.organisation_id) {
    return NextResponse.json({ error: 'User profile not found or not associated with an organisation.' }, { status: 403 }); // Forbidden
  }

  const userOrganisationId = profile.organisation_id;
  // --- End Get Organisation ID --- 

  const formData = await request.formData();
  const file = formData.get('file') as File | null;
  const baseClassId = formData.get('base_class_id') as string | null; // Get base_class_id from form data

  if (!file) {
    return NextResponse.json({ error: 'File is required' }, { status: 400 });
  }

  const bucketName = `org-${userOrganisationId}-uploads`;
  // Generate a unique path, maybe user ID + timestamp + filename?
  const uniqueFileName = `${user.id}-${Date.now()}-${file.name.replace(/[^a-zA-Z0-9_.-]/g, '_')}`;
  const filePath = `${uniqueFileName}`;
  let insertedDocumentId: string | null = null; // To store the ID for cleanup/invocation

  try {
    // 1. Insert initial document metadata with 'queued' status
    console.log('Inserting initial document record...');
    const initialDocumentData: Database['public']['Tables']['documents']['Insert'] = {
      organisation_id: userOrganisationId,
      file_name: file.name,
      storage_path: filePath, // Store the planned path
      file_type: file.type,
      file_size: file.size,
      uploaded_by: user.id,
      status: 'queued' as DocumentStatus, // Use the defined enum type
      base_class_id: baseClassId || null, // Set base_class_id if provided
      // processing_error and metadata are initially null
    };

    const { data: insertedDoc, error: insertError } = await supabase
      .from('documents')
      .insert(initialDocumentData)
      .select('id') // Only select the ID we need
      .single<Tables<'documents'>>();

    if (insertError) {
      console.error('Database Insert Error:', insertError);
      throw new Error(`Failed to create initial document metadata: ${insertError.message}`);
    }
    if (!insertedDoc || !insertedDoc.id) {
        throw new Error('Failed to retrieve ID of inserted document record.');
    }
    insertedDocumentId = insertedDoc.id;
    console.log('Document record created with ID:', insertedDocumentId);


    // 2. Upload file to Supabase Storage
    console.log(`Uploading file to ${bucketName}/${filePath}...`);
    const { error: uploadError } = await supabase.storage
      .from(bucketName)
      .upload(filePath, file);

    if (uploadError) {
      console.error('Storage Upload Error:', uploadError);
      // Attempt to create bucket if it doesn't exist
      if (uploadError.message.includes('Bucket not found')) {
        console.log(`Attempting to create bucket: ${bucketName}`);
        
        // Use service role client for bucket creation
        const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
        const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
        
        if (!supabaseUrl || !serviceRoleKey) {
          throw new Error('Service role key not configured for bucket creation');
        }
        
        const adminSupabase = createClient(supabaseUrl, serviceRoleKey);
        
        const { error: createBucketError } = await adminSupabase.storage.createBucket(
          bucketName,
          { 
            public: false,
            allowedMimeTypes: [
              'application/pdf', 
              'text/plain', 
              'application/msword', 
              'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
              'application/vnd.openxmlformats-officedocument.presentationml.presentation',
              'application/vnd.ms-powerpoint',
              'text/csv',
              // Image types for AI text extraction
              'image/jpeg',
              'image/jpg', 
              'image/png',
              'image/gif',
              'image/webp'
            ],
            fileSizeLimit: 52428800 // 50MB limit (increased from 10MB)
          }
        );
        
        if (createBucketError && !createBucketError.message.includes('already exists')) {
          throw new Error(`Failed to create bucket: ${createBucketError.message}`);
        }
        
        console.log(`Bucket ${bucketName} created successfully`);
        
        // Retry upload with the regular client now that bucket exists
        const { error: retryUploadError } = await supabase.storage
          .from(bucketName)
          .upload(filePath, file);
        if (retryUploadError) {
            throw new Error(`Failed to upload file after bucket creation: ${retryUploadError.message}`);
        }
      } else {
        throw uploadError; // Re-throw original error if not 'Bucket not found'
      }
    }
    console.log('File uploaded successfully.');

    // 3. Invoke the processing Edge Function (asynchronously)
    console.log(`Invoking process-document function for document ID: ${insertedDocumentId}...`);
    // Use environment variables for URL and Anon Key for function invocation
    // Service Role Key might be needed if function requires elevated privileges beyond RLS
    // but invoking usually uses Anon key.
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

    if (!supabaseUrl || !supabaseAnonKey) {
        console.warn('Supabase URL or Anon Key not configured for function invocation. Skipping.');
        // Decide how to handle this - maybe update status to error?
    } else {
        // Create a temporary client for function invocation
        const invokeClient = createClient(supabaseUrl, supabaseAnonKey);
        
        // 🚀 ASYNC PROCESSING: Fire-and-forget invocation to prevent HTTP timeout
        // Don't await - let the edge function run in background while we return immediately
        invokeClient.functions.invoke(
            'process-document', // Name of your deployed Edge Function
            {
                body: { documentId: insertedDocumentId }
            }
        ).then(({ error: invokeError }) => {
            if (invokeError) {
                console.error('Failed to invoke process-document function:', invokeError);
                
                // Update document status to error since invocation failed
                const adminSupabase = createClient(
                    process.env.NEXT_PUBLIC_SUPABASE_URL || '',
                    process.env.SUPABASE_SERVICE_ROLE_KEY || ''
                );
                
                adminSupabase.from('documents')
                    .update({ 
                        status: 'error',
                        metadata: {
                            processing_error: {
                                code: 'INVOCATION_FAILED',
                                message: `Failed to start processing: ${invokeError.message}`,
                                userFriendlyMessage: 'Failed to start document processing',
                                suggestedActions: [
                                    'Try uploading the document again',
                                    'Contact support if the issue persists'
                                ],
                                retryable: true,
                                timestamp: new Date().toISOString()
                            },
                            error_timestamp: new Date().toISOString()
                        }
                    })
                    .eq('id', insertedDocumentId);
            } else {
                console.log('✅ Process-document function invoked successfully - processing started in background.');
            }
        }).catch((error) => {
            console.error('Unexpected error during process-document invocation:', error);
        });
        
        console.log('🔥 ASYNC PROCESSING STARTED: Function invoked, returning immediately while processing continues in background...');
    }

    // Return the initially inserted document ID and status
    return NextResponse.json({ id: insertedDocumentId, status: 'queued', message: 'Upload successful, processing initiated.' }, { status: 202 }); // 202 Accepted

  } catch (error) {
    console.error('Upload API Error:', error);

    // Clean up: If DB record was created but upload/invoke failed, delete the record?
    if (insertedDocumentId) {
        console.log(`Rolling back: Deleting document record ${insertedDocumentId} due to error.`);
        // Use service role key for potential cleanup if needed
        const adminSupabase = createClient(
            process.env.NEXT_PUBLIC_SUPABASE_URL || '',
            process.env.SUPABASE_SERVICE_ROLE_KEY || ''
        );
        await adminSupabase.from('documents').delete().eq('id', insertedDocumentId);
        // Also consider deleting the file from storage if upload succeeded but invoke failed
    }

    const errorMessage = error instanceof Error ? error.message : 'An unknown error occurred';
    return NextResponse.json({ error: errorMessage }, { status: 500 });
  }
} 