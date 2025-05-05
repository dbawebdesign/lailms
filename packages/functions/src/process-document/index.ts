import { serve } from 'https://deno.land/std@0.177.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { corsHeaders } from '../_shared/cors.ts'
// Import parsers (ensure these are installed in packages/functions/package.json)
import pdf from 'https://esm.sh/pdf-parse@1.1.1'; // Check compatibility with Deno/Edge Runtime
import mammoth from 'https://esm.sh/mammoth@1.6.0'; // Check compatibility
// import { getTranscript } from 'https://esm.sh/youtube-transcript@1.0.6'; // Check compatibility

console.log(`Function "process-document" up and running!`) 

type DocumentRecord = {
  id: string;
  organisation_id: string;
  storage_path: string;
  file_type: string | null;
  // Add other relevant fields from your documents table
}

// Define the status enum matching your SQL migration
 type DocumentStatus = 'queued' | 'processing' | 'completed' | 'error';

serve(async (req) => {
  // Handle CORS preflight request
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    // 1. Extract documentId from the request payload
    //    Supabase function invocation payload structure depends on how it's called.
    //    Assuming direct invocation with JSON payload: { "documentId": "..." }
    const { documentId } = await req.json()
    if (!documentId) {
      throw new Error('Missing documentId in request payload');
    }
    console.log('Processing document ID:', documentId);

    // 2. Initialize Supabase Client (use ENV variables)
    const supabaseUrl = Deno.env.get('SUPABASE_URL')
    const supabaseServiceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')

    if (!supabaseUrl || !supabaseServiceRoleKey) {
        throw new Error('Missing Supabase environment variables');
    }

    const supabase = createClient(supabaseUrl, supabaseServiceRoleKey,
        { global: { headers: { Authorization: `Bearer ${supabaseServiceRoleKey}` } } }
      );

    // 3. Fetch document record
    console.log('Fetching document record...');
    const { data: document, error: fetchError } = await supabase
      .from('documents')
      .select('id, organisation_id, storage_path, file_type') // Select necessary fields
      .eq('id', documentId)
      .single<DocumentRecord>()

    if (fetchError) {
      console.error('Error fetching document:', fetchError);
      throw new Error(`Failed to fetch document: ${fetchError.message}`);
    }
    if (!document) {
      throw new Error(`Document with ID ${documentId} not found.`);
    }
    console.log('Document record fetched:', document);

    // 4. Update status to 'processing'
    console.log('Updating status to processing...');
    const { error: statusUpdateError } = await supabase
      .from('documents')
      .update({ status: 'processing' as DocumentStatus })
      .eq('id', documentId)

    if (statusUpdateError) {
      // Log error but continue processing? Or fail here?
      console.error('Failed to update status to processing:', statusUpdateError);
      // Decide on failure strategy - for now, we'll throw
      throw new Error(`Failed to update status to processing: ${statusUpdateError.message}`);
    }
    console.log('Status updated to processing.');

    // 5. Download file from Storage
    const bucketName = `org-${document.organisation_id}-uploads`;
    const filePath = document.storage_path;
    console.log(`Downloading file from ${bucketName}/${filePath}...`);

    const { data: fileData, error: downloadError } = await supabase.storage
        .from(bucketName)
        .download(filePath);

    if (downloadError) {
      console.error('Error downloading file:', downloadError);
      throw new Error(`Failed to download file: ${downloadError.message}`);
    }
    if (!fileData) {
      throw new Error('Downloaded file data is null.');
    }
    console.log('File downloaded successfully.');

    // 6. Determine file type and parse content
    const fileType = document.file_type || 'application/octet-stream'; // Fallback if null
    let extractedText = '';
    let metadata = {}; // Placeholder for extracted metadata

    console.log(`Determining parser for file type: ${fileType}...`);

    const fileBuffer = await fileData.arrayBuffer(); // Get ArrayBuffer

    try {
      if (fileType === 'application/pdf') {
        console.log('Using pdf-parse...');
        const data = await pdf(fileBuffer);
        extractedText = data.text;
        metadata = data.info; // pdf-parse provides metadata
        console.log('PDF parsed.');
      } else if (fileType === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document') {
        console.log('Using mammoth for DOCX...');
        const result = await mammoth.extractRawText({ arrayBuffer: fileBuffer });
        extractedText = result.value;
        // mammoth might have limited metadata extraction
        console.log('DOCX parsed.');
      // TODO: Add youtube-transcript handler (if input is URL stored in document?)
      // TODO: Add handlers for PPT, CSV, Audio, Video, Web URLs
      } else {
          console.warn(`Unsupported file type: ${fileType}. Skipping parsing.`);
          // Optionally set status to 'error' or a specific 'unsupported' status?
          // For now, treat as success with no text
          extractedText = '';
      }

      console.log('Text extraction complete (first 100 chars):', extractedText.substring(0, 100));

      // 7. TODO: Store extracted text/embeddings (handled in later tasks)

      // 8. Update status to 'completed'
      console.log('Updating status to completed...');
      const { error: finalStatusError } = await supabase
        .from('documents')
        .update({
          status: 'completed' as DocumentStatus,
          processing_error: null, // Clear any previous error
          metadata: metadata // Store extracted metadata
      })
        .eq('id', documentId)

      if (finalStatusError) {
        console.error('Failed to update status to completed:', finalStatusError);
        // Don't throw here, processing technically succeeded, but log failure
      }
      console.log('Status updated to completed.');

      return new Response(JSON.stringify({ success: true, documentId: documentId, message: 'Document processed successfully' }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200,
      })

    } catch (processingError) {
        // 9. Handle processing errors (parsing, etc.)
        console.error('Error during document processing:', processingError);
        const errorMessage = processingError instanceof Error ? processingError.message : 'Unknown processing error';

        // Update status to 'error'
        console.log('Updating status to error...');
        const { error: errorStatusError } = await supabase
            .from('documents')
            .update({
                status: 'error' as DocumentStatus,
                processing_error: errorMessage,
            })
            .eq('id', documentId);

        if (errorStatusError) {
            console.error('Failed to update status to error:', errorStatusError);
        }

        // Return error response from the function itself
        return new Response(JSON.stringify({ success: false, documentId: documentId, error: `Processing failed: ${errorMessage}` }), {
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
            status: 500, // Internal Server Error status code for processing failure
        })
    }

  } catch (err) {
    // Catch setup errors (missing env vars, payload issues, initial fetch/update failures)
    console.error('Function error:', err);
    const errorMessage = err instanceof Error ? err.message : 'Unknown error';
    return new Response(JSON.stringify({ error: errorMessage }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 400, // Bad Request or 500 Internal Server Error depending on cause
    })
  }
}) 