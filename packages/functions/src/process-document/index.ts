import { serve } from 'https://deno.land/std@0.177.0/http/server.ts';
import { createClient, SupabaseClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { YoutubeTranscript } from 'npm:youtube-transcript'; // Added for YouTube
import { getDocument } from 'https://esm.sh/pdf.mjs'; // PDF text extraction compatible with edge runtime
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

type DocumentStatus = 'queued' | 'processing' | 'completed' | 'error';

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
    const uint8 = new Uint8Array(pdfBuffer);

    const loadingTask = getDocument({ data: uint8 });
    const pdfDoc = await loadingTask.promise;

    let allText = '';
    for (let pageNum = 1; pageNum <= pdfDoc.numPages; pageNum++) {
      const page = await pdfDoc.getPage(pageNum);
      const textContent = await page.getTextContent();
      const pageStrings = textContent.items.map((itm: any) => itm.str || '').join(' ');
      allText += pageStrings + '\n\n';
    }

    console.log(`Successfully extracted ~${allText.length} characters from PDF ${filePath}.`);
    return allText;
  } catch (error) {
    console.error(`Error extracting text from PDF ${filePath}:`, error instanceof Error ? error.message : String(error));
    throw new Error(`Failed to extract text from PDF ${filePath}: ${error instanceof Error ? error.message : String(error)}`);
  }
}

async function extractTextFromUrl(url: string): Promise<string> {
  console.log(`Attempting to scrape content from URL: ${url}`);
  
  // Try multiple strategies to fetch the URL
  interface FetchStrategy {
    name: string;
    options: RequestInit;
  }

  const strategies: FetchStrategy[] = [
    // Strategy 1: Standard fetch with browser-like headers
    {
      name: 'Standard Browser Headers',
      options: {
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
          'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,image/apng,*/*;q=0.8',
          'Accept-Language': 'en-US,en;q=0.9',
          'Accept-Encoding': 'gzip, deflate, br',
          'DNT': '1',
          'Connection': 'keep-alive',
          'Upgrade-Insecure-Requests': '1',
        } as Record<string, string>
      }
    },
    // Strategy 2: Simplified headers
    {
      name: 'Simplified Headers',
      options: {
        headers: {
          'User-Agent': 'Mozilla/5.0 (compatible; LearnologyAI/1.0; +https://learnologyai.com)',
          'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
        } as Record<string, string>
      }
    },
    // Strategy 3: Minimal headers
    {
      name: 'Minimal headers',
      options: {
        headers: {
          'User-Agent': 'LearnologyAI-Bot/1.0',
        } as Record<string, string>
      }
    }
  ];

  let lastError: Error | null = null;

  for (const strategy of strategies) {
    try {
      console.log(`Trying strategy: ${strategy.name} for URL: ${url}`);
      
      // Add timeout to prevent hanging
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 30000); // 30 second timeout
      
      const response = await fetch(url, {
        ...strategy.options,
        signal: controller.signal
      });
      
      clearTimeout(timeoutId);

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      const contentType = response.headers.get('content-type');
      console.log(`Content-Type: ${contentType}`);
      
      if (!contentType || !contentType.includes('text/html')) {
        console.warn(`URL ${url} did not return HTML. Content-Type: ${contentType}. Attempting to read as text anyway.`);
      }

      const html = await response.text();
      console.log(`Successfully fetched ${html.length} characters of HTML from ${url}`);

      // Enhanced HTML to text conversion
      let text = html;
      
      // Remove script and style blocks
      text = text.replace(/<script[^>]*>.*?<\/script>/gi, '');
      text = text.replace(/<style[^>]*>.*?<\/style>/gi, '');
      text = text.replace(/<noscript[^>]*>.*?<\/noscript>/gi, '');
      
      // Remove comments
      text = text.replace(/<!--.*?-->/g, '');
      
      // Convert common HTML entities
      text = text.replace(/&nbsp;/g, ' ');
      text = text.replace(/&amp;/g, '&');
      text = text.replace(/&lt;/g, '<');
      text = text.replace(/&gt;/g, '>');
      text = text.replace(/&quot;/g, '"');
      text = text.replace(/&#39;/g, "'");
      
      // Remove all HTML tags, replacing with space
      text = text.replace(/<[^>]+>/g, ' ');
      
      // Clean up whitespace
      text = text.replace(/\s+/g, ' ');
      text = text.trim();

      if (!text || text.length < 50) {
        console.warn(`Extracted very little text from URL: ${url}. Text length: ${text.length}. HTML length was ${html.length}.`);
        if (text.length === 0) {
          throw new Error('No readable text content found on the page');
        }
      }
      
      console.log(`Successfully scraped ~${text.length} characters from ${url} using strategy: ${strategy.name}`);
      console.log(`First 200 characters: ${text.substring(0, 200)}...`);
      return text;
      
    } catch (error) {
      lastError = error instanceof Error ? error : new Error(String(error));
      console.warn(`Strategy "${strategy.name}" failed for ${url}:`, lastError.message);
      
      // If this is an abort error, it was a timeout
      if (lastError.name === 'AbortError') {
        console.warn(`Request timed out after 30 seconds for ${url}`);
      }
      
      // Continue to next strategy
      continue;
    }
  }

  // All strategies failed
  const errorMessage = `Failed to extract text from URL ${url} after trying ${strategies.length} different approaches. Last error: ${lastError?.message || 'Unknown error'}`;
  console.error(errorMessage);
  
  // Provide helpful error message based on the type of error
  let userFriendlyMessage = `Unable to access the website at ${url}. `;
  
  if (lastError?.message.includes('timeout') || lastError?.name === 'AbortError') {
    userFriendlyMessage += 'The website took too long to respond (timeout after 30 seconds).';
  } else if (lastError?.message.includes('HTTP 403') || lastError?.message.includes('HTTP 401')) {
    userFriendlyMessage += 'The website is blocking automated access (403/401 error).';
  } else if (lastError?.message.includes('HTTP 404')) {
    userFriendlyMessage += 'The page was not found (404 error). Please check the URL.';
  } else if (lastError?.message.includes('HTTP 500') || lastError?.message.includes('HTTP 502') || lastError?.message.includes('HTTP 503')) {
    userFriendlyMessage += 'The website is experiencing server issues. Please try again later.';
  } else if (lastError?.message.includes('SSL') || lastError?.message.includes('TLS') || lastError?.message.includes('certificate')) {
    userFriendlyMessage += 'There was an SSL/security certificate issue with the website.';
  } else if (lastError?.message.includes('network') || lastError?.message.includes('connection')) {
    userFriendlyMessage += 'There was a network connectivity issue.';
  } else {
    userFriendlyMessage += 'The website may be blocking automated access or experiencing technical issues.';
  }
  
  userFriendlyMessage += '\n\nSuggestions:\n• Verify the URL is correct and publicly accessible\n• Try again in a few minutes\n• Contact the website owner if the issue persists\n• Consider copying and pasting the content manually as a text file';
  
  throw new Error(userFriendlyMessage);
}

async function extractTranscriptFromYouTube(url: string): Promise<{ transcript?: string; error?: boolean; message?: string }> {
  console.log(`Attempting to fetch transcript for YouTube URL: ${url}`);
  
  // Strategy 1: Try to get existing YouTube transcripts first
  try {
    console.log(`Strategy 1: Attempting to fetch existing YouTube transcripts for ${url}`);
    
    // First attempt: Default language
    let transcriptResponse = await YoutubeTranscript.fetchTranscript(url);

    // If default fails or is empty, try explicitly with English
    if (!transcriptResponse || transcriptResponse.length === 0) {
      console.warn(`No transcript found with default language for ${url}. Retrying with lang: 'en'.`);
      try {
        transcriptResponse = await YoutubeTranscript.fetchTranscript(url, { lang: 'en' });
      } catch (langErr) {
        console.warn(`Fetching with lang: 'en' also failed for ${url}:`, langErr instanceof Error ? langErr.message : String(langErr));
      }
    }

    // Try additional languages that commonly have transcripts
    if (!transcriptResponse || transcriptResponse.length === 0) {
      const languagesToTry = ['es', 'fr', 'de', 'pt', 'it', 'ja', 'ko', 'zh', 'ru'];
      for (const lang of languagesToTry) {
        try {
          console.log(`Trying language: ${lang} for ${url}`);
          transcriptResponse = await YoutubeTranscript.fetchTranscript(url, { lang });
          if (transcriptResponse && transcriptResponse.length > 0) {
            console.log(`Found transcript in language: ${lang}`);
            break;
          }
        } catch (err) {
          // Continue to next language
          continue;
        }
      }
    }

    if (transcriptResponse && transcriptResponse.length > 0) {
    const fullTranscript = transcriptResponse.map(t => t.text).join(' ');
      console.log(`Strategy 1 SUCCESS: Fetched transcript of ~${fullTranscript.length} characters for ${url}.`);
    return { transcript: fullTranscript, error: false };
    }
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    console.warn(`Strategy 1 FAILED for ${url}: ${errorMessage}`);
    
    // If it's not a "transcript disabled" error, return early with the error
    if (!errorMessage.includes('Transcript is disabled on this video') && 
        !errorMessage.includes('transcriptsDisabled') && 
        !errorMessage.includes('video not found') &&
        !errorMessage.includes('No transcript found') &&
        !errorMessage.includes('subtitles are disabled') &&
        !errorMessage.includes('Subtitles are disabled')) {
      return { error: true, message: `Failed to fetch YouTube transcript from ${url}: ${errorMessage}` };
    }
  }

  // Strategy 2: Try to fetch video info and download audio for transcription
  console.log(`Strategy 2: Attempting to extract audio and transcribe for ${url}`);
  
  try {
    // Extract video ID from URL
    const videoIdMatch = url.match(/(?:youtube\.com\/watch\?v=|youtu\.be\/|youtube\.com\/embed\/|youtube\.com\/v\/)([^&\n?#]+)/);
    if (!videoIdMatch) {
      throw new Error('Could not extract video ID from YouTube URL');
    }
    const videoId = videoIdMatch[1];
    
    // Try to get basic video info first to check if it's accessible
    const videoInfoResponse = await fetch(`https://www.youtube.com/oembed?url=${encodeURIComponent(url)}&format=json`);
    
    if (!videoInfoResponse.ok) {
      throw new Error(`Video not accessible or may be private/deleted (HTTP ${videoInfoResponse.status})`);
    }
    
    const videoInfo = await videoInfoResponse.json();
    console.log(`Video accessible: ${videoInfo.title}`);
    
    // For now, we'll log that we would attempt audio extraction here
    // In a full implementation, this would use yt-dlp or similar to download audio
    console.log(`Strategy 2: Would attempt audio download for video: ${videoInfo.title} (${videoId})`);
    console.log(`Strategy 2: Audio transcription with Whisper not implemented in edge function environment`);
    
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    console.warn(`Strategy 2 FAILED for ${url}: ${errorMessage}`);
  }

  // Strategy 3: Try alternative approaches with different user agents
  console.log(`Strategy 3: Attempting alternative transcript extraction methods for ${url}`);
  
  try {
    const alternativeResult = await tryAlternativeTranscriptMethods(url);
    if (alternativeResult) {
      console.log(`Strategy 3 SUCCESS: Alternative method found transcript for ${url}, length: ${alternativeResult.length}`);
      return { transcript: alternativeResult, error: false };
    }
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    console.warn(`Strategy 3 FAILED for ${url}: ${errorMessage}`);
  }

  // All strategies failed - provide helpful error message
  const finalMessage = `Unable to extract transcript for this YouTube video. This can happen when:
• The video has transcripts/captions disabled by the creator
• The video is private, unlisted, or restricted
• The video is too new and auto-generated captions haven't been created yet
• Regional restrictions prevent access
• The video has been deleted or made unavailable

URL: ${url}

To successfully add YouTube videos to your knowledge base, try:
• Using videos that have captions enabled
• Checking if the video is publicly accessible
• Waiting if the video was recently uploaded (auto-captions take time)
• Contacting the video creator to enable captions`;

  console.error(`All transcript extraction strategies failed for ${url}`);
  return { error: true, message: finalMessage };
}

// Helper function to try alternative transcript extraction methods
async function tryAlternativeTranscriptMethods(url: string): Promise<string | null> {
  try {
    console.log(`Trying alternative transcript methods for ${url}`);
    
    // Try with different approaches to the youtube-transcript library
    // Sometimes different configurations or timing can work
    
    // Method 1: Try with explicit country codes
    const countryCodes = ['US', 'GB', 'CA', 'AU'];
    for (const country of countryCodes) {
      try {
        console.log(`Trying with country code: ${country}`);
        // Note: The youtube-transcript library might not support country codes directly
        // but we can try different approaches
        const transcriptResponse = await YoutubeTranscript.fetchTranscript(url, { 
          lang: 'en',
          // We'd add country parameter if supported
        });
        
        if (transcriptResponse && transcriptResponse.length > 0) {
          const fullTranscript = transcriptResponse.map(t => t.text).join(' ');
          console.log(`Alternative method success with country ${country}`);
          return fullTranscript;
        }
      } catch (err) {
        // Continue to next country
        continue;
      }
    }

    // Method 2: Try to extract from video page HTML
    try {
      console.log(`Attempting to parse video page HTML for transcript data`);
      
      const response = await fetch(url, {
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
          'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
          'Accept-Language': 'en-US,en;q=0.9',
        }
      });
      
      if (response.ok) {
        const html = await response.text();
        
        // Look for caption track URLs in the page
        const captionMatches = html.match(/"captionTracks":\s*(\[.*?\])/);
        if (captionMatches) {
          console.log('Found caption tracks in page HTML');
          // In a full implementation, we'd parse these URLs and fetch the caption files
          // For now, just log that we found them
        }
        
        // Look for transcript data
        const transcriptMatches = html.match(/"transcriptRenderer".*?"cueGroups":\s*(\[.*?\])/);
        if (transcriptMatches) {
          console.log('Found transcript renderer data in page HTML');
          // In a full implementation, we'd parse this data
        }
      }
    } catch (htmlError) {
      console.warn('HTML parsing approach failed:', htmlError);
    }
    
    return null;
    
  } catch (error) {
    console.error('All alternative methods failed:', error);
    return null;
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
    body: JSON.stringify({ input: text, model: 'text-embedding-3-small' }),
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

    // Safe environment variable access for both Deno and Node.js
    const getEnvVar = (key: string): string | undefined => {
      if (typeof globalThis.Deno !== 'undefined' && globalThis.Deno?.env) {
        return globalThis.Deno.env.get(key);
      }
      if (typeof process !== 'undefined' && process.env) {
        return process.env[key];
      }
      return undefined;
    };

    const supabaseUrl = getEnvVar('SUPABASE_URL');
    const supabaseServiceRoleKey = getEnvVar('SUPABASE_SERVICE_ROLE_KEY');
    const openaiApiKey = getEnvVar('OPENAI_API_KEY');

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
      // Enhanced YouTube processing with metadata tracking
      console.log(`PROCESS-DOCUMENT: Starting YouTube processing for ${documentId}, URL: ${sourceUrl}`);
      
      // Extract video ID for metadata
      const videoIdMatch = sourceUrl.match(/(?:youtube\.com\/watch\?v=|youtu\.be\/|youtube\.com\/embed\/|youtube\.com\/v\/)([^&\n?#]+)/);
      const videoId = videoIdMatch ? videoIdMatch[1] : null;
      
      // Get video info first for metadata
      let videoInfo: any = null;
      try {
        const videoInfoResponse = await fetch(`https://www.youtube.com/oembed?url=${encodeURIComponent(sourceUrl)}&format=json`);
        if (videoInfoResponse.ok) {
          videoInfo = await videoInfoResponse.json();
          console.log(`Video info retrieved: ${videoInfo.title}`);
        }
      } catch (error) {
        console.warn(`Could not fetch video info for ${sourceUrl}:`, error);
      }
      
      // Update metadata with video information
      const videoMetadata = {
        video_id: videoId,
        video_title: videoInfo?.title || 'Unknown',
        video_duration: videoInfo?.duration || null,
        channel_name: videoInfo?.author_name || null,
        processing_attempts: 1,
        strategies_tried: [],
        processing_start_time: new Date().toISOString()
      };
      
      await updateDocumentStatus(supabaseClient, documentId, 'processing', { 
        ...videoMetadata,
        processing_stage: 'transcript_extraction'
      });

      const transcriptResult = await extractTranscriptFromYouTube(sourceUrl);
      
      if (transcriptResult.error) {
        console.error(`PROCESS-DOCUMENT: YouTube transcript error for doc ${documentId}: ${transcriptResult.message}`);
        
        // Determine specific error type for better tracking
        let errorType = 'unknown_error';
        const errorMsg = transcriptResult.message || '';
        
        if (errorMsg.includes('transcripts/captions disabled') || errorMsg.includes('Transcript is disabled')) {
          errorType = 'transcript_disabled';
        } else if (errorMsg.includes('private') || errorMsg.includes('restricted') || errorMsg.includes('deleted')) {
          errorType = 'access_denied';
        } else if (errorMsg.includes('not found')) {
          errorType = 'video_not_found';
        } else if (errorMsg.includes('Regional restrictions')) {
          errorType = 'regional_restriction';
        }
        
        const errorMetadata = {
          ...videoMetadata,
          error_type: errorType,
          error_message: transcriptResult.message,
          processing_completed_at: new Date().toISOString(),
          user_guidance: transcriptResult.message,
          final_strategy_used: 'none',
          processing_outcome: 'error'
        };
        
        await updateDocumentStatus(supabaseClient, documentId, 'error', errorMetadata);
        
        return new Response(JSON.stringify({ 
          success: false, 
          errorType: 'youtube_processing_failed',
          errorDetail: transcriptResult.message,
          userGuidance: "This video cannot be processed. Please try a different video or check that captions are enabled.",
          documentId
        }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          status: 200, // Return 200 but with error details for better UX
        });
      } else {
        extractedText = transcriptResult.transcript || '';
        
        // Update metadata with success information
        const successMetadata = {
          ...videoMetadata,
          final_strategy_used: 'transcript_fetch_multilang', // We could track which strategy actually worked
          processing_outcome: 'success',
          transcript_length: extractedText.length,
          processing_stage: 'chunking'
        };
        
        await updateDocumentStatus(supabaseClient, documentId, 'processing', successMetadata);
        docMetadata.source_type = 'youtube_transcript';
        console.log(`PROCESS-DOCUMENT: Successfully extracted ${extractedText.length} characters from YouTube video ${documentId}`);
      }
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
      source_type: docMetadata.source_type,
      processing_stage: 'chunking'
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
        embedding: embeddings && embeddings[index] ? embeddings[index] : null,
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
    await updateDocumentStatus(supabaseClient, documentId, 'processing', { 
      chunks_created: processedChunks.length,
      processing_stage: 'summarizing_chunks'
    });
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
      processing_completed_at: new Date().toISOString(),
      processing_stage: 'completed'
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