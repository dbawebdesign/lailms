import { createSupabaseServerClient } from '@/lib/supabase/server';
import { NextResponse } from 'next/server';
import { Database, Tables } from '../../../../../packages/types/db';
import { createClient } from '@supabase/supabase-js';

// Define the status enum type locally for type safety
type DocumentStatus = 'queued' | 'processing' | 'completed' | 'error';

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
    const { url, type, base_class_id } = await request.json();

    if (!url || !type) {
      return NextResponse.json({ error: 'URL and type are required' }, { status: 400 });
    }

    // Validate URL format
    try {
      new URL(url);
    } catch {
      return NextResponse.json({ error: 'Invalid URL format' }, { status: 400 });
    }

    // Get Organisation ID from user's profile
    const { data: profile, error: profileError } = await supabase
      .from('profiles')
      .select('organisation_id')
      .eq('user_id', user.id)
      .maybeSingle<Tables<'profiles'>>();

    if (profileError) {
      console.error('Error fetching profile record:', profileError);
      return NextResponse.json({ error: 'Could not verify user organisation membership.' }, { status: 500 });
    }

    if (!profile || !profile.organisation_id) {
      return NextResponse.json({ error: 'User profile not found or not associated with an organisation.' }, { status: 403 });
    }

    const userOrganisationId = profile.organisation_id;

    // Create a descriptive filename based on URL type
    let fileName: string;
    if (type === 'youtube') {
      // Extract video ID for better naming
      const videoIdMatch = url.match(/(?:youtube\.com\/watch\?v=|youtu\.be\/|youtube\.com\/embed\/|youtube\.com\/v\/)([^&\n?#]+)/);
      const videoId = videoIdMatch ? videoIdMatch[1] : 'unknown';
      fileName = `URL - ${url}`;
    } else {
      // For web pages, use the domain
      try {
        const urlObj = new URL(url);
        fileName = `URL - ${urlObj.hostname}${urlObj.pathname}`;
      } catch {
        fileName = `URL - ${url}`;
      }
    }

    // Create document metadata with URL information
    const metadata = {
      originalUrl: url,
      type: type,
      timestamp: new Date().toISOString(),
      source: 'url_submission'
    };

    // Generate a unique identifier for the storage path
    const urlIdentifier = `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    const storagePath = `urls/${type}/${urlIdentifier}.url`;
    let insertedDocumentId: string | null = null;

    // Upload URL content to storage first
    const bucketName = `org-${userOrganisationId}-uploads`;
    const { error: uploadError } = await supabase.storage
      .from(bucketName)
      .upload(storagePath, url, {
        contentType: 'text/plain',
        cacheControl: '3600',
        upsert: false
      });

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
            fileSizeLimit: 52428800 // 50MB limit
          }
        );
        
        if (createBucketError && !createBucketError.message.includes('already exists')) {
          throw new Error(`Failed to create bucket: ${createBucketError.message}`);
        }
        
        console.log(`Bucket ${bucketName} created successfully`);
        
        // Retry upload with the regular client now that bucket exists
        const { error: retryUploadError } = await supabase.storage
          .from(bucketName)
          .upload(storagePath, url, {
            contentType: 'text/plain',
            cacheControl: '3600',
            upsert: false
          });
        
        if (retryUploadError) {
          throw new Error(`Failed to upload URL after bucket creation: ${retryUploadError.message}`);
        }
      } else {
        throw new Error(`Failed to upload URL to storage: ${uploadError.message}`);
      }
    }

    // Insert document record
    const initialDocumentData: Database['public']['Tables']['documents']['Insert'] = {
      organisation_id: userOrganisationId,
      file_name: fileName,
      storage_path: storagePath,
      file_type: type === 'youtube' ? 'video/youtube' : 'text/html',
      file_size: url.length, // URL content size
      uploaded_by: user.id,
      status: 'queued' as DocumentStatus,
      base_class_id: base_class_id || null, // Set base_class_id if provided
      metadata: metadata
    };

    const { data: insertedDoc, error: insertError } = await supabase
      .from('documents')
      .insert(initialDocumentData)
      .select('id')
      .single<Tables<'documents'>>();

    if (insertError) {
      console.error('Database Insert Error:', insertError);
      throw new Error(`Failed to create document metadata: ${insertError.message}`);
    }

    if (!insertedDoc || !insertedDoc.id) {
      throw new Error('Failed to retrieve ID of inserted document record.');
    }

    insertedDocumentId = insertedDoc.id;
    console.log('URL document record created with ID:', insertedDocumentId);

    // Invoke the processing Edge Function
    console.log(`Invoking process-document function for URL document ID: ${insertedDocumentId}...`);
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

    if (!supabaseUrl || !supabaseAnonKey) {
      console.warn('Supabase URL or Anon Key not configured for function invocation. Skipping.');
    } else {
      const invokeClient = createClient(supabaseUrl, supabaseAnonKey);
      // Fire-and-forget invocation to avoid API timeout while long-running processing happens in background
      invokeClient.functions
        .invoke('process-document', {
          body: { documentId: insertedDocumentId }
        })
        .then(({ error: invokeError }) => {
          if (invokeError) {
            console.error('Failed to invoke process-document function:', invokeError);
          } else {
            console.log('process-document function invoked successfully for URL.');
          }
        })
        .catch((error) => {
          console.error('Unexpected error during process-document invocation:', error);
        });
    }

    return NextResponse.json({ 
      id: insertedDocumentId, 
      status: 'queued', 
      message: 'URL submitted successfully, processing initiated.',
      type: type,
      url: url
    }, { status: 202 });

  } catch (error) {
    console.error('URL submission API Error:', error);
    const errorMessage = error instanceof Error ? error.message : 'An unknown error occurred';
    return NextResponse.json({ error: errorMessage }, { status: 500 });
  }
} 