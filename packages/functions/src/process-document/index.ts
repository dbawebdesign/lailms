import { serve } from 'https://deno.land/std@0.177.0/http/server.ts';
import { createClient, SupabaseClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { YoutubeTranscript } from 'npm:youtube-transcript'; // Added for YouTube
import { pdfText } from 'jsr:@pdf/pdftext@1.3.2'; // Added for PDF text extraction
// import { corsHeaders } from '../_shared/cors.ts'; // Path issue, define locally for now

// Consistent, robust CORS headers (copied from kb-process-textfile)
const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, GET, OPTIONS, PUT, DELETE',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-supabase-auth, referer, user-agent, accept',
  'Access-Control-Max-Age': '86400',
};

// Import specific parsers/libraries as we add them, e.g.:
// import { pdf } from 'https://deno.land/x/pdf@v0.4.0/mod.ts'; // Example for PDF

console.log(`Function "process-document" booting up!`);

interface ProcessRequest {
  documentId: string;
}

interface DocumentRecord {
  id: string;
  organisation_id: string;
  storage_path: string;
  file_name: string | null;
  file_type: string | null;
  metadata: Record<string, any> | null;
  base_class_id?: string | null; // For context
}

type DocumentStatus = 'queued' | 'processing' | 'summarizing_chunks' | 'summarizing_document' | 'completed' | 'error' | 'completed_with_errors';

// Helper: Update document status and metadata
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
    console.error(`Error fetching current metadata for ${documentId}:`, fetchErr);
    // Decide if we should throw or continue with empty initial metadata
  }
  
  const newMetadata = { ...(currentDoc?.metadata || {}), ...metadataUpdate };

  const { error } = await supabase
    .from('documents')
    .update({ status, metadata: newMetadata })
    .eq('id', documentId);
  if (error) {
    console.error(`Error updating document ${documentId} to status ${status}:`, error);
    // Potentially throw this error to be caught by the main handler
  }
}

// --- Text Extraction Functions ---
async function extractTextFromPdf(filePath: string, supabase: SupabaseClient, bucketName: string): Promise<string> {
  console.log(`Attempting to extract text from PDF: ${filePath} in bucket ${bucketName}`);
  try {
    const { data: pdfFileData, error: downloadError } = await supabase.storage
      .from(bucketName)
      .download(filePath);

    if (downloadError || !pdfFileData) {
      throw new Error(`Failed to download PDF file ${filePath} from storage: ${downloadError?.message}`);
    }

    const pdfBuffer = await pdfFileData.arrayBuffer();
    const pages: { [pageno: number]: string } = await pdfText(new Uint8Array(pdfBuffer));

    if (Object.keys(pages).length === 0) {
      console.warn(`No text extracted from PDF ${filePath}. It might be an image-based PDF or empty.`);
      return ""; // Return empty if no text found
    }

    // Concatenate text from all pages
    const allText = Object.values(pages).join('\n\n'); // Separate pages with double newline
    
    console.log(`Successfully extracted ~${allText.length} characters from PDF ${filePath}.`);
    return allText;
  } catch (error) {
    console.error(`Error extracting text from PDF ${filePath}:`, error instanceof Error ? error.message : String(error));
    throw new Error(`Failed to extract text from PDF ${filePath}: ${error instanceof Error ? error.message : String(error)}`);
  }
}

async function extractTextFromUrl(url: string): Promise<string> {
  console.log(`Attempting to scrape content from URL: ${url}`);
  try {
    const response = await fetch(url, {
      headers: {
        // Try to mimic a browser to avoid simple bot blocks
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36',
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,image/apng,*/*;q=0.8',
        'Accept-Language': 'en-US,en;q=0.9',
      }
    });

    if (!response.ok) {
      throw new Error(`Failed to fetch URL ${url}. Status: ${response.status}`);
    }

    const contentType = response.headers.get('content-type');
    if (!contentType || !contentType.includes('text/html')) {
      console.warn(`URL ${url} did not return HTML. Content-Type: ${contentType}. Attempting to read as text anyway.`);
      // Potentially handle other text types or throw error if binary
    }

    const html = await response.text();

    // Basic HTML to text conversion (very naive)
    // A more robust solution would use a proper HTML parsing library and content extraction (like Readability.js)
    // For Deno, one might need to find or adapt such a library.
    // This regex approach is a simple starting point and will miss a lot of nuances.
    let text = html.replace(/<style[^>]*>.*?<\/style>/gis, ''); // Remove style blocks
    text = text.replace(/<script[^>]*>.*?<\/script>/gis, ''); // Remove script blocks
    text = text.replace(/<[^>]+>/g, ' '); // Remove all other tags, replacing with space
    text = text.replace(/\s\s+/g, ' '); // Collapse multiple spaces
    text = text.trim();

    if (!text) {
      console.warn(`Extracted empty text from URL: ${url}. HTML length was ${html.length}.`);
      // Consider returning a snippet of raw HTML or a specific error message if text is critical
    }
    
    console.log(`Successfully scraped ~${text.length} characters from ${url}. (First 100: ${text.substring(0,100)}...)`);
    return text;
  } catch (error) {
    console.error(`Error scraping URL ${url}:`, error instanceof Error ? error.message : String(error));
    throw new Error(`Failed to extract text from URL ${url}: ${error instanceof Error ? error.message : String(error)}`);
  }
}

async function extractTranscriptFromYouTube(url: string): Promise<string> {
  console.log(`Attempting to fetch transcript for YouTube URL: ${url}`);
  try {
    const transcriptResponse = await YoutubeTranscript.fetchTranscript(url);
    if (!transcriptResponse || transcriptResponse.length === 0) {
      console.warn(`No transcript found or empty transcript for YouTube URL: ${url}`);
      // Consider throwing an error or returning a specific message if no transcript is a hard failure
      return ""; // Return empty string if no transcript found
    }
    const fullTranscript = transcriptResponse.map(t => t.text).join(' ');
    console.log(`Successfully fetched transcript of ~${fullTranscript.length} characters for ${url}.`);
    return fullTranscript;
  } catch (error) {
    console.error(`Error fetching YouTube transcript for ${url}:`, error instanceof Error ? error.message : String(error));
    // Check for common errors like video not found or transcripts disabled
    if (error instanceof Error && (error.message.includes('transcriptsDisabled') || error.message.includes('video not found'))) {
        throw new Error(`Could not retrieve transcript for ${url}: Transcripts may be disabled or the video is unavailable.`);
    }
    throw new Error(`Failed to fetch YouTube transcript from ${url}: ${error instanceof Error ? error.message : String(error)}`);
  }
}

async function transcribeAudio(filePath: string, supabase: SupabaseClient, bucketName: string, openaiApiKey: string): Promise<string> {
  console.log(`Attempting to transcribe audio: ${filePath} in bucket ${bucketName}`);
  try {
    const { data: audioFileData, error: downloadError } = await supabase.storage
      .from(bucketName)
      .download(filePath);

    if (downloadError || !audioFileData) {
      throw new Error(`Failed to download audio file ${filePath} from storage: ${downloadError?.message}`);
    }

    const formData = new FormData();
    // OpenAI API expects a file. The third argument to append is the filename.
    // It's good practice to pass the original filename or a relevant one.
    // We don't have the original filename here directly, so construct one.
    const fileName = filePath.split('/').pop() || 'audio.mp3'; 
    formData.append('file', audioFileData, fileName);
    formData.append('model', 'whisper-1');
    // You can add other parameters like 'language', 'prompt', 'response_format', 'temperature' if needed
    // e.g., formData.append('language', 'en');

    const whisperResponse = await fetch('https://api.openai.com/v1/audio/transcriptions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${openaiApiKey}`,
        // 'Content-Type': 'multipart/form-data' is set automatically by fetch with FormData
      },
      body: formData,
    });

    if (!whisperResponse.ok) {
      const errorBody = await whisperResponse.text();
      console.error('Whisper API error response:', errorBody);
      throw new Error(`Whisper API request failed with status ${whisperResponse.status}: ${errorBody}`);
    }

    const { text: transcript } = await whisperResponse.json();
    
    if (typeof transcript !== 'string') {
        console.error('Whisper API did not return a string transcript:', transcript);
        throw new Error('Whisper API did not return a valid text transcript.');
    }

    console.log(`Successfully transcribed audio ${filePath}. Transcript length: ${transcript.length}.`);
    return transcript;
  } catch (error) {
    console.error(`Error transcribing audio ${filePath}:`, error instanceof Error ? error.message : String(error));
    throw new Error(`Failed to transcribe audio ${filePath}: ${error instanceof Error ? error.message : String(error)}`);
  }
}

type DocumentType = 'pdf' | 'youtube' | 'url' | 'txt' | 'audio';

interface ChunkingOptions {
  chunkSize?: number;
  overlap?: number;
  strategy?: 'sentence' | 'paragraph' | 'fixed'; // Add more strategies as needed
}

interface Chunk {
  content: string;
  metadata: Record<string, any>;
  chunk_index: number;
  section_identifier?: string; // Added section_identifier
}

// Function to extract page/section context for chunking (can be expanded)
const getSectionIdentifier = (
  documentType: DocumentType,
  content: string, // Can be the full text or a segment relevant to the current chunk
  charOffset: number, // Character offset of the chunk within the full text
  chunkIndex: number, // Index of the current chunk
  pageNumber?: number, // For PDFs
  timestamp?: string // For YouTube
): string | undefined => {
  if (documentType === 'pdf' && pageNumber) {
    return `Page ${pageNumber}`;
  }
  if (documentType === 'youtube' && timestamp) {
    return `Time ${timestamp}`;
  }
  // For text, url, audio, can add more sophisticated section detection based on headings, paragraphs etc.
  // For now, using chunk index as a fallback.
  return `Part ${chunkIndex + 1}`;
};

// Helper function to generate a citation key
const generateCitationKey = (
  docId: string,
  sectionIdentifier: string | undefined,
  chunkIndex: number
): string => {
  const docIdShort = docId.substring(0, 8); // Use a shortened version of the document ID
  const sectionPart = sectionIdentifier ? sectionIdentifier.replace(/\s+/g, '_') : 'SUnknown';
  return `${docIdShort}_${sectionPart}_C${chunkIndex}`;
};

const chunkText = async (
  fullText: string,
  documentType: DocumentType,
  options: ChunkingOptions = {}
): Promise<Chunk[]> => {
  const { chunkSize = 1500, overlap = 200 } = options; // Adjusted chunkSize
  const chunks: Chunk[] = [];
  let chunkIndex = 0;

  if (documentType === 'pdf') {
    const pages = fullText.split('\f'); // Form feed often separates PDF pages in text extraction
    let charOffset = 0;
    for (let i = 0; i < pages.length; i++) {
      const pageText = pages[i];
      const pageNumber = i + 1;
      for (let j = 0; j < pageText.length; j += chunkSize - overlap) {
        const content = pageText.substring(j, j + chunkSize).trim();
        if (content) {
          chunks.push({
            content,
            metadata: { documentType, sourceCharOffset: charOffset + j },
            chunk_index: chunkIndex,
            section_identifier: getSectionIdentifier(documentType, content, charOffset + j, chunkIndex, pageNumber),
          });
          chunkIndex++;
        }
      }
      charOffset += pageText.length + 1; // +1 for the form feed char
    }
  } else if (documentType === 'youtube') {
    // Assuming transcript format: "HH:MM:SS.mmm --> HH:MM:SS.mmm\ntext\n\nHH:MM:SS.mmm..."
    // Or "timestamp\ntext"
    const segments = fullText.split(/\n\n(?=\d{1,2}:\d{2}:\d{2}\.\d{3})|(\d{1,2}:\d{2}(?:\.\d{1,3})?(?: -)?\s)/); // Split by VTT cue timing or simpler "timestamp\ntext"
    let charOffset = 0;
    for (const segment of segments) {
        if (!segment.trim()) continue;

        let timestamp: string | undefined = undefined;
        let textContent = segment;

        const vttTimestampMatch = segment.match(/^(\d{1,2}:\d{2}:\d{2}\.\d{3}) -->/);
        const simpleTimestampMatch = segment.match(/^(\d{1,2}:\d{2}(?:\.\d{1,3})?)(?: -)?\s/);

        if (vttTimestampMatch) {
            timestamp = vttTimestampMatch[1];
            textContent = segment.substring(segment.indexOf('\n') + 1).trim();
        } else if (simpleTimestampMatch) {
            timestamp = simpleTimestampMatch[1];
            textContent = segment.substring(simpleTimestampMatch[0].length).trim();
        }
        
        if (!textContent) continue;

        for (let j = 0; j < textContent.length; j += chunkSize - overlap) {
            const content = textContent.substring(j, j + chunkSize).trim();
            if (content) {
                chunks.push({
                    content,
                    metadata: { documentType, sourceCharOffset: charOffset + j, originalTimestamp: timestamp },
                    chunk_index: chunkIndex,
                    section_identifier: getSectionIdentifier(documentType, content, charOffset + j, chunkIndex, undefined, timestamp),
                });
                chunkIndex++;
            }
        }
        charOffset += segment.length + 2; // +2 for \n\n or similar
    }
  } else {
    // Generic chunking for txt, url, audio
    for (let i = 0; i < fullText.length; i += chunkSize - overlap) {
      const content = fullText.substring(i, i + chunkSize).trim();
      if (content) {
        chunks.push({
          content,
          metadata: { documentType, sourceCharOffset: i },
          chunk_index: chunkIndex,
          section_identifier: getSectionIdentifier(documentType, content, i, chunkIndex),
        });
        chunkIndex++;
      }
    }
  }

  console.log(`Chunked text into ${chunks.length} chunks for document type ${documentType}.`);
  return chunks;
};

// --- Embedding Function ---
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
  if (!data || !data[0] || !data[0].embedding) {
    throw new Error('Invalid response structure from OpenAI Embedding API');
  }
  return data[0].embedding;
}

serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  let documentId: string | null = null;
  let supabaseClient: SupabaseClient | null = null; // Use this for most operations
  
  try {
    const { documentId: reqDocumentId } = await req.json() as ProcessRequest;
    documentId = reqDocumentId;

    if (!documentId) {
      return new Response(JSON.stringify({ success: false, error: 'Missing documentId in request payload' }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 400,
      });
    }
    console.log(`PROCESS-DOCUMENT: Received request for document ID: ${documentId}`);

    const supabaseUrl = Deno.env.get('SUPABASE_URL');
    const supabaseServiceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
    const openaiApiKey = Deno.env.get('OPENAI_API_KEY');

    if (!supabaseUrl || !supabaseServiceRoleKey || !openaiApiKey) {
      console.error('PROCESS-DOCUMENT: Missing one or more environment variables.');
      return new Response(JSON.stringify({ success: false, error: 'Server configuration error: Missing environment variables.' }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 500,
      });
    }

    supabaseClient = createClient(supabaseUrl, supabaseServiceRoleKey);

    await updateDocumentStatus(supabaseClient, documentId, 'processing', { 
      processing_attempted_at: new Date().toISOString(),
      processed_by_function: 'process-document'
    });

    const { data: document, error: fetchError } = await supabaseClient
      .from('documents')
      .select('id, organisation_id, storage_path, file_name, file_type, metadata, base_class_id')
      .eq('id', documentId)
      .single<DocumentRecord>();

    if (fetchError) throw new Error(`DB fetch error for ${documentId}: ${fetchError.message}`);
    if (!document) throw new Error(`Document not found: ${documentId}`);

    let extractedText = "";
    const docMetadata = document.metadata || {};
    const fileType = document.file_type || '';
    const sourceUrl = docMetadata.originalUrl as string || '';
    const storagePath = document.storage_path;
    const bucketName = `org-${document.organisation_id}-uploads`;

    console.log(`Processing document: ${document.file_name || documentId}, Type: ${fileType}, URL: ${sourceUrl}, Path: ${storagePath}`);

    if (sourceUrl && (sourceUrl.includes('youtube.com') || sourceUrl.includes('youtu.be'))) {
      extractedText = await extractTranscriptFromYouTube(sourceUrl);
      docMetadata.source_type = 'youtube_transcript';
    } else if (sourceUrl) {
      extractedText = await extractTextFromUrl(sourceUrl);
      docMetadata.source_type = 'url_scrape';
    } else if (fileType.startsWith('audio/')) {
      extractedText = await transcribeAudio(storagePath, supabaseClient, bucketName, openaiApiKey);
      docMetadata.source_type = 'audio_transcript';
    } else if (fileType === 'application/pdf') {
      extractedText = await extractTextFromPdf(storagePath, supabaseClient, bucketName);
      docMetadata.source_type = 'pdf_extract';
    } else if (fileType === 'text/plain') {
       // This case should ideally be handled by kb-process-textfile,
       // but as a fallback or if invoked directly:
      const { data: fileData, error: downloadError } = await supabaseClient.storage
        .from(bucketName)
        .download(storagePath);
      if (downloadError || !fileData) throw new Error(`Storage download failed for ${storagePath}: ${downloadError?.message}`);
      extractedText = await fileData.text();
      docMetadata.source_type = 'text_file';
    } else {
      throw new Error(`Unsupported file type: ${fileType} or missing source URL for document ${documentId}`);
    }
    
    await updateDocumentStatus(supabaseClient, documentId, 'processing', { 
      extracted_text_length: extractedText.length,
      source_type: docMetadata.source_type 
    });

    const processedChunks: Chunk[] = await chunkText(extractedText, fileType as DocumentType, { chunkSize: 1500, overlap: 200 });

    const embeddings = await Promise.all(processedChunks.map(chunk => getEmbedding(chunk.content, openaiApiKey)));

    // Store chunks in Supabase
    const chunkUpserts = processedChunks.map((chunk, index) => {
      const citationKey = generateCitationKey(document.id, chunk.section_identifier, chunk.chunk_index);
      return {
        document_id: document.id,
        organisation_id: document.organisation_id,
        chunk_index: chunk.chunk_index, // Use chunk_index from chunk object
        content: chunk.content,
        token_count: chunk.content.split(/\s+/).length, // More robust token count
        embedding: embeddings && embeddings[index] ? embeddings[index].embedding : null,
        metadata: chunk.metadata,
        section_identifier: chunk.section_identifier,
        citation_key: citationKey, // Added citation_key
        // section_summary and section_summary_status will be populated by summarize-chunks later
      };
    });

    const { error: insertChunkError } = await supabaseClient
      .from('document_chunks')
      .insert(chunkUpserts);
    if (insertChunkError) {
      console.error(`Failed to insert chunks for document ${documentId}:`, insertChunkError);
      // Decide on error handling: continue, mark doc as completed_with_errors?
    }
    
    console.log(`Successfully chunked and embedded ${processedChunks.length} chunks for document ${documentId}.`);
    
    // Trigger chunk summarization
    await updateDocumentStatus(supabaseClient, documentId, 'summarizing_chunks', { chunks_created: processedChunks.length });
    const { error: summarizeChunksError } = await supabaseClient.functions.invoke('summarize-chunks', {
      body: { documentId: document.id, summarizeLevel: 'chunk' }
    });
    if (summarizeChunksError) {
      console.error(`Error invoking summarize-chunks (chunk level) for ${documentId}:`, summarizeChunksError);
      // Potentially update status to error or completed_with_errors
    } else {
      console.log(`Invoked summarize-chunks (chunk level) for ${documentId}.`);
    }

    // TODO: Add step to wait or check for chunk summarization completion, then trigger document-level summary
    // This might involve polling or a more sophisticated orchestration if summarize-chunks is long-running.
    // For now, let's assume it's relatively quick or we proceed without waiting for full doc summary here.
    
    // Tentatively mark as completed, actual "completed" might be after document summary
    await updateDocumentStatus(supabaseClient, documentId, 'completed', { 
      processing_completed_at: new Date().toISOString() 
    });
    console.log(`PROCESS-DOCUMENT: Successfully processed document ID: ${documentId}`);

    return new Response(JSON.stringify({ success: true, documentId, message: 'Document processing initiated.' }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 200,
    });

  } catch (error) {
    console.error(`PROCESS-DOCUMENT: Main error for doc ID ${documentId}:`, error instanceof Error ? error.message : String(error), error instanceof Error ? error.stack : '');
    if (documentId && supabaseClient) {
      try {
        await updateDocumentStatus(supabaseClient, documentId, 'error', { 
          processing_error: error instanceof Error ? error.message : String(error),
          error_stack_trace: error instanceof Error ? error.stack : undefined
        });
      } catch (dbUpdateError) {
        console.error(`PROCESS-DOCUMENT: Failed to update document status to error:`, dbUpdateError instanceof Error ? dbUpdateError.message : String(dbUpdateError));
      }
    }
    return new Response(JSON.stringify({ success: false, error: error instanceof Error ? error.message : String(error) }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 500,
    });
  }
}); 