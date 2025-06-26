import { createSupabaseServerClient } from '@/lib/supabase/server';
import { NextResponse } from 'next/server';
import { Database, Tables } from '@learnologyai/types';
import { createClient } from '@supabase/supabase-js';

// Define the status enum type locally for type safety
type DocumentStatus = 'queued' | 'processing' | 'completed' | 'error';

export async function POST(request: Request) {
  const supabase = createSupabaseServerClient();

  const {
    data: { session },
  } = await supabase.auth.getSession();

  if (!session) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const { url, type } = await request.json();

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
      .eq('user_id', session.user.id)
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
      throw new Error(`Failed to upload URL to storage: ${uploadError.message}`);
    }

    // Insert document record
    const initialDocumentData: Database['public']['Tables']['documents']['Insert'] = {
      organisation_id: userOrganisationId,
      file_name: fileName,
      storage_path: storagePath,
      file_type: type === 'youtube' ? 'video/youtube' : 'text/html',
      file_size: url.length, // URL content size
      uploaded_by: session.user.id,
      status: 'queued' as DocumentStatus,
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
      const { error: invokeError } = await invokeClient.functions.invoke(
        'process-document',
        {
          body: { documentId: insertedDocumentId }
        }
      );

      if (invokeError) {
        console.error('Failed to invoke process-document function:', invokeError);
      } else {
        console.log('process-document function invoked successfully for URL.');
      }
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