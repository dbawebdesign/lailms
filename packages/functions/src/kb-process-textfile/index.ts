import { serve } from 'https://deno.land/std@0.177.0/http/server.ts';
import { createClient, SupabaseClient } from 'https://esm.sh/@supabase/supabase-js@2';

// Consistent, robust CORS headers
const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, GET, OPTIONS, PUT, DELETE',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-supabase-auth, referer, user-agent, accept',
  'Access-Control-Max-Age': '86400',
};

console.log(`New function "kb-process-textfile" is running.`);

interface DocumentRecord {
  id: string;
  organisation_id: string;
  storage_path: string;
  file_name: string | null; // Added for logging
  file_type: string | null;
  metadata: Record<string, any> | null;
  base_class_id?: string | null;
}

// Match DocumentStatus from process-document for consistency
type DocumentStatus = 'queued' | 'processing' | 'summarizing_chunks' | 'summarizing_document' | 'completed' | 'error' | 'completed_with_errors';

// --- Chunking Function (shared logic, could be in _shared) ---
interface Chunk {
  content: string;
  metadata: Record<string, any>; 
  token_count: number; 
}
function chunkText(text: string, chunkSize = 1000, overlap = 100): Chunk[] {
  const chunks: Chunk[] = [];
  if (!text) return chunks;
  for (let i = 0; i < text.length; i += (chunkSize - overlap)) {
    const content = text.substring(i, i + chunkSize);
    chunks.push({ 
      content, 
      metadata: { source_char_start: i, source_char_end: i + content.length },
      token_count: Math.ceil(content.length / 4) 
    });
  }
  console.log(`Chunked text into ${chunks.length} chunks.`);
  return chunks;
}

// --- Embedding Function (shared logic, could be in _shared) ---
async function getEmbedding(text: string, apiKey: string): Promise<number[]> {
  console.log(`Generating embedding for text snippet: ${text.substring(0,30)}...`);
  const response = await fetch('https://api.openai.com/v1/embeddings', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${apiKey}`,
    },
    body: JSON.stringify({ input: text, model: 'text-embedding-ada-002' }),
  });
  if (!response.ok) {
    const errorBody = await response.text();
    throw new Error(`OpenAI Embedding API error (${response.status}): ${errorBody}`);
  }
  const { data } = await response.json();
  return data[0].embedding;
  // return Array(1536).fill(0.1); // Placeholder for testing without API key
}

// Helper: Update document status and metadata (similar to process-document)
async function updateDocumentStatus(
  supabase: SupabaseClient,
  documentId: string,
  status: DocumentStatus,
  metadataUpdate: Record<string, any> = {}
) {
  const { data: currentDoc, error: fetchErr } = await supabase
    .from('documents')
    .select('metadata')
    .eq('id', documentId)
    .single();

  if (fetchErr) {
    console.warn(`Warn: Error fetching current metadata for ${documentId} during status update:`, fetchErr.message);
  }
  const newMetadata = { ...(currentDoc?.metadata || {}), ...metadataUpdate };

  const { error } = await supabase
    .from('documents')
    .update({ status, metadata: newMetadata })
    .eq('id', documentId);
  if (error) {
    console.error(`Error updating document ${documentId} to status ${status}:`, error.message);
  }
}

serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    console.log('kb-process-textfile: OPTIONS request received');
    return new Response(null, { status: 204, headers: corsHeaders });
  }

  let documentId: string | null = null;
  let supabaseAdminClient: SupabaseClient | null = null;

  try {
    const requestBody = await req.json();
    documentId = requestBody.documentId;

    if (!documentId) {
      throw new Error('Missing documentId in request body');
    }
    console.log(`kb-process-textfile: Processing document ID: ${documentId}`);

    const supabaseUrl = Deno.env.get('SUPABASE_URL');
    const supabaseServiceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
    const openaiApiKey = Deno.env.get('OPENAI_API_KEY');

    if (!supabaseUrl || !supabaseServiceRoleKey || !openaiApiKey) {
      throw new Error('Missing Supabase/OpenAI environment variables.');
    }

    supabaseAdminClient = createClient(supabaseUrl, supabaseServiceRoleKey);

    await updateDocumentStatus(supabaseAdminClient, documentId, 'processing', { 
      processing_attempted_at: new Date().toISOString(),
      processed_by_function: 'kb-process-textfile' 
    });

    const { data: document, error: fetchError } = await supabaseAdminClient
      .from('documents')
      .select('id, organisation_id, storage_path, file_name, file_type, metadata, base_class_id')
      .eq('id', documentId)
      .single<DocumentRecord>();

    if (fetchError) throw new Error(`DB fetch error for ${documentId}: ${fetchError.message}`);
    if (!document) throw new Error(`Document not found: ${documentId}`);

    if (!document.storage_path || !document.organisation_id) {
        throw new Error('Document record is missing storage_path or organisation_id.');
    }

    const bucketName = `org-${document.organisation_id}-uploads`;
    const { data: fileData, error: downloadError } = await supabaseAdminClient.storage
        .from(bucketName)
        .download(document.storage_path);

    if (downloadError) throw new Error(`Storage download failed for ${document.storage_path}: ${downloadError.message}`);
    if (!fileData) throw new Error('Downloaded file data is null.');

    const textContent = await fileData.text();
    console.log(`kb-process-textfile: Content of ${document.file_name || documentId} (first 200 chars):\n${textContent.substring(0, 200)}...`);

    const chunks = chunkText(textContent);
    let chunksProcessedCount = 0;

    for (let i = 0; i < chunks.length; i++) {
      const chunk = chunks[i];
      try {
        const embedding = await getEmbedding(chunk.content, openaiApiKey);
        const { error: insertChunkError } = await supabaseAdminClient
          .from('document_chunks')
          .insert({
            document_id: document.id,
            organisation_id: document.organisation_id,
            chunk_index: i,
            content: chunk.content,
            embedding: embedding,
            token_count: chunk.token_count,
            metadata: { 
              ...(chunk.metadata || {}),
              base_class_id: document.base_class_id 
            },
            summary_status: 'pending' 
          });
        if (insertChunkError) throw insertChunkError; // Throw to be caught by outer catch for this chunk
        chunksProcessedCount++;
      } catch (chunkError: any) {
          console.error(`Error processing chunk ${i} for document ${documentId}:`, chunkError.message);
          // Log error for this specific chunk but continue processing others
          // Optionally, update the chunk's status to 'error' if we had a separate chunk status field
      }
    }
    console.log(`kb-process-textfile: Successfully processed and stored ${chunksProcessedCount} of ${chunks.length} chunks for document ${documentId}.`);

    const updatedDocMetadata = {
        ...(document.metadata || {}),
        processed_by_function: 'kb-process-textfile',
        text_content_length: textContent.length,
        chunks_created: chunksProcessedCount,
        requires_summarization: chunksProcessedCount > 0,
    };

    if (chunksProcessedCount > 0) {
      await updateDocumentStatus(supabaseAdminClient, documentId, 'summarizing_chunks', updatedDocMetadata);
      console.log(`kb-process-textfile: Invoking summarize-chunks (chunk level) for ${documentId}`);
      const { error: summarizeChunksError } = await supabaseAdminClient.functions.invoke('summarize-chunks', {
        body: { documentId: document.id, summarizeLevel: 'chunk' }
      });
      if (summarizeChunksError) {
        console.error(`kb-process-textfile: Error invoking summarize-chunks (chunk level) for ${documentId}:`, summarizeChunksError.message);
        updatedDocMetadata.summarization_error = `Chunk summarization trigger failed: ${summarizeChunksError.message}`;
        // Decide if status should be error or completed_with_errors
        await updateDocumentStatus(supabaseAdminClient, documentId, 'completed_with_errors', updatedDocMetadata);
      } else {
        console.log(`kb-process-textfile: Invoked summarize-chunks (chunk level). Document currently in 'summarizing_chunks' state.`);
        // The overall document completion will be handled by the summarization flow or a separate poller.
        // For now, this function's primary job (text processing) is done.
      }
    } else {
       // No chunks processed (empty file or all chunks failed)
      updatedDocMetadata.processing_completed_at = new Date().toISOString();
      await updateDocumentStatus(supabaseAdminClient, documentId, chunks.length > 0 ? 'completed_with_errors' : 'completed', updatedDocMetadata);
    }
    
    return new Response(JSON.stringify({ 
      success: true, 
      documentId, 
      message: `Text file processing initiated. ${chunksProcessedCount}/${chunks.length} chunks stored. Chunk summarization triggered if applicable.`, 
      chunks_created: chunksProcessedCount 
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 200 
    });

  } catch (error: any) {
    console.error('kb-process-textfile: Main error:', error.message, error.stack);
    if (documentId && supabaseAdminClient) {
      try {
        const {data: docForError, error: fetchErr} = await supabaseAdminClient.from('documents').select('metadata').eq('id', documentId).single();
        await updateDocumentStatus(supabaseAdminClient, documentId, 'error', { 
          ...(docForError?.metadata || {}),
          processing_error: error.message,
          error_stack_trace: error.stack
        });
      } catch (dbUpdateError: any) {
        console.error('kb-process-textfile: Failed to update document status to error during main catch:', dbUpdateError.message);
      }
    }
    return new Response(JSON.stringify({ error: error.message }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 500 
    });
  }
}) 