import { serve } from 'https://deno.land/std@0.177.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { corsHeaders } from '../_shared/cors.ts'
// Import parsers (ensure these are installed in packages/functions/package.json)
import pdf from 'https://esm.sh/pdf-parse@1.1.1'; // Check compatibility with Deno/Edge Runtime
import mammoth from 'https://esm.sh/mammoth@1.6.0'; // Check compatibility
// YouTube transcript API helper
import { YoutubeTranscript } from 'https://esm.sh/youtube-transcript@1.0.6';
// Import chunking and embedding utilities
import { chunkText, TextChunk } from '../_shared/chunking.ts';
import { generateEmbeddings } from '../_shared/embedding.ts';

console.log(`Function "process-document" up and running!`) 

type DocumentRecord = {
  id: string;
  organisation_id: string;
  storage_path: string;
  file_type: string | null;
  metadata: Record<string, any> | null;
  // Add other relevant fields from your documents table
}

// Define the status enum matching your SQL migration
 type DocumentStatus = 'queued' | 'processing' | 'completed' | 'error';

// Helper function to extract YouTube video ID from various URL formats
function extractYouTubeVideoId(url: string): string | null {
  const regExp = /^.*((youtu.be\/)|(v\/)|(\/u\/\w\/)|(embed\/)|(watch\?))\??v?=?([^#&?]*).*/;
  const match = url.match(regExp);
  return (match && match[7].length === 11) ? match[7] : null;
}

// Helper function to fetch YouTube video metadata and transcript
async function processYouTubeUrl(url: string): Promise<{text: string, metadata: Record<string, any>}> {
  const videoId = extractYouTubeVideoId(url);
  if (!videoId) {
    throw new Error('Invalid YouTube URL or could not extract video ID');
  }

  // Fetch basic video info through YouTube's oEmbed API (public, no API key required)
  const oEmbedUrl = `https://www.youtube.com/oembed?url=https://www.youtube.com/watch?v=${videoId}&format=json`;
  const oEmbedResponse = await fetch(oEmbedUrl);
  
  if (!oEmbedResponse.ok) {
    throw new Error(`Failed to fetch video metadata: ${oEmbedResponse.statusText}`);
  }
  
  const videoInfo = await oEmbedResponse.json();
  
  let transcriptText = '';
  try {
    // Try to get the transcript using the YouTube Transcript API
    // This API attempts to fetch captions/transcripts from the video
    console.log(`Attempting to fetch transcript for video ID: ${videoId}`);
    const transcriptResponse = await YoutubeTranscript.fetchTranscript(videoId);
    
    if (transcriptResponse && Array.isArray(transcriptResponse) && transcriptResponse.length > 0) {
      // Format the transcript as text with timestamps
      transcriptText = transcriptResponse.map(entry => {
        // Convert duration to timestamp string (MM:SS)
        const startTime = entry.offset / 1000; // Convert to seconds
        const minutes = Math.floor(startTime / 60);
        const seconds = Math.floor(startTime % 60);
        const timestamp = `${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
        
        return `[${timestamp}] ${entry.text}`;
      }).join('\n\n');
    } else {
      throw new Error('No transcript data returned');
    }
  } catch (transcriptError) {
    console.error('Failed to fetch transcript:', transcriptError);
    // Fallback to basic information if transcript isn't available
    transcriptText = `Video Title: ${videoInfo.title}
Author: ${videoInfo.author_name}
Note: No transcript was available for this video. This content includes only basic metadata.`;
  }

  // Add video title and basic info at the beginning of the transcript
  const fullText = `# ${videoInfo.title}
By: ${videoInfo.author_name}
Channel: ${videoInfo.author_url}
Video URL: ${url}

## Transcript:

${transcriptText}`;

  return {
    text: fullText,
    metadata: {
      title: videoInfo.title,
      author: videoInfo.author_name,
      author_url: videoInfo.author_url,
      type: 'youtube_video',
      video_id: videoId,
      thumbnail_url: videoInfo.thumbnail_url,
      source_url: url,
      has_transcript: transcriptText.length > 0,
      processed_date: new Date().toISOString()
    }
  };
}

// Helper function to process web URLs
async function processWebUrl(url: string): Promise<{text: string, metadata: Record<string, any>}> {
  try {
    // Fetch the webpage
    const response = await fetch(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Supabase Edge Function) LearnologyAI Knowledge Base Ingestion Bot'
      }
    });
    
    if (!response.ok) {
      throw new Error(`Failed to fetch webpage: ${response.statusText}`);
    }
    
    const html = await response.text();
    
    // More robust metadata extraction
    const titleMatch = html.match(/<title>(.*?)<\/title>/i);
    const title = titleMatch ? titleMatch[1] : 'Unknown Title';
    
    // Extract description
    const descriptionMatch = html.match(/<meta\s+name=["']description["']\s+content=["'](.*?)["']\s*\/?>/i);
    const description = descriptionMatch ? descriptionMatch[1] : '';
    
    // Extract canonical URL if available
    const canonicalMatch = html.match(/<link\s+rel=["']canonical["']\s+href=["'](.*?)["']\s*\/?>/i);
    const canonicalUrl = canonicalMatch ? canonicalMatch[1] : url;
    
    // Extract open graph metadata
    const ogTitle = html.match(/<meta\s+property=["']og:title["']\s+content=["'](.*?)["']\s*\/?>/i);
    const ogDescription = html.match(/<meta\s+property=["']og:description["']\s+content=["'](.*?)["']\s*\/?>/i);
    const ogImage = html.match(/<meta\s+property=["']og:image["']\s+content=["'](.*?)["']\s*\/?>/i);
    
    // More robust content extraction - removing scripts, styles, and HTML comments first
    let processedHtml = html
      // Remove HTML comments
      .replace(/<!--[\s\S]*?-->/g, '')
      // Remove script tags and content
      .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '')
      // Remove style tags and content
      .replace(/<style\b[^<]*(?:(?!<\/style>)<[^<]*)*<\/style>/gi, '')
      // Remove head section
      .replace(/<head\b[^<]*(?:(?!<\/head>)<[^<]*)*<\/head>/gi, '');
    
    // Extract main content from article, main, or content elements if they exist
    let mainContent = '';
    
    // Try to find article or main content elements
    const articleMatch = processedHtml.match(/<article[^>]*>([\s\S]*?)<\/article>/i);
    const mainMatch = processedHtml.match(/<main[^>]*>([\s\S]*?)<\/main>/i);
    const contentMatch = processedHtml.match(/id=["']content["'][^>]*>([\s\S]*?)<\/[^>]*>/i) || 
                        processedHtml.match(/class=["']content["'][^>]*>([\s\S]*?)<\/[^>]*>/i);
    
    if (articleMatch) {
      mainContent = articleMatch[1];
    } else if (mainMatch) {
      mainContent = mainMatch[1];
    } else if (contentMatch) {
      mainContent = contentMatch[1];
    } else {
      // Fallback to body content
      const bodyMatch = processedHtml.match(/<body[^>]*>([\s\S]*?)<\/body>/i);
      mainContent = bodyMatch ? bodyMatch[1] : processedHtml;
    }
    
    // Remove navigation, header, footer, sidebar elements
    mainContent = mainContent
      .replace(/<nav\b[^<]*(?:(?!<\/nav>)<[^<]*)*<\/nav>/gi, '')
      .replace(/<header\b[^<]*(?:(?!<\/header>)<[^<]*)*<\/header>/gi, '')
      .replace(/<footer\b[^<]*(?:(?!<\/footer>)<[^<]*)*<\/footer>/gi, '')
      .replace(/<aside\b[^<]*(?:(?!<\/aside>)<[^<]*)*<\/aside>/gi, '');
    
    // Extract text content, preserving paragraphs
    const paragraphs: string[] = [];
    
    // Extract paragraph content
    const pMatches = mainContent.match(/<p[^>]*>([\s\S]*?)<\/p>/gi);
    if (pMatches) {
      pMatches.forEach(p => {
        // Strip remaining HTML tags from paragraph content
        const textContent = p.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();
        if (textContent.length > 0) {
          paragraphs.push(textContent);
        }
      });
    }
    
    // If no paragraphs found, fall back to stripping all tags
    if (paragraphs.length === 0) {
      const strippedText = mainContent
        .replace(/<[^>]+>/g, ' ')
        .replace(/\s+/g, ' ')
        .trim();
      
      // Break into artificial paragraphs based on length
      for (let i = 0; i < strippedText.length; i += 500) {
        const paragraph = strippedText.substr(i, 500).trim();
        if (paragraph.length > 0) {
          paragraphs.push(paragraph);
        }
      }
    }
    
    // Extract any headings for structure
    const headings: { level: number, text: string }[] = [];
    for (let i = 1; i <= 6; i++) {
      const regex = new RegExp(`<h${i}[^>]*>(.*?)<\/h${i}>`, 'gi');
      let match;
      while ((match = regex.exec(mainContent)) !== null) {
        const headingText = match[1].replace(/<[^>]+>/g, '').trim();
        if (headingText.length > 0) {
          headings.push({ level: i, text: headingText });
        }
      }
    }
    
    // Format all extracted content into a structured document
    let formattedContent = `# ${title}\n\n`;
    
    if (description) {
      formattedContent += `${description}\n\n`;
    }
    
    formattedContent += `Source: ${canonicalUrl || url}\n\n`;
    
    // Add headings and paragraphs in a structured way
    // Combine headings and paragraphs in order
    let contentItems: {type: 'heading' | 'paragraph', level?: number, text: string, index: number}[] = [
      ...headings.map((h, i) => ({type: 'heading' as const, level: h.level, text: h.text, index: i})),
      ...paragraphs.map((p, i) => ({type: 'paragraph' as const, text: p, index: paragraphs.length + i}))
    ];
    
    // Sort them to approximate their original order
    contentItems.sort((a, b) => a.index - b.index);
    
    // Format each item
    contentItems.forEach(item => {
      if (item.type === 'heading') {
        // Add appropriate markdown heading level
        const prefix = '#'.repeat(item.level || 1);
        formattedContent += `${prefix} ${item.text}\n\n`;
      } else {
        formattedContent += `${item.text}\n\n`;
      }
    });
    
    // Build a more comprehensive metadata object
    const enhancedMetadata = {
      title: ogTitle ? ogTitle[1] : title,
      description: ogDescription ? ogDescription[1] : description,
      canonical_url: canonicalUrl,
      image: ogImage ? ogImage[1] : null,
      type: 'webpage',
      source_url: url,
      content_length: formattedContent.length,
      paragraphs_count: paragraphs.length,
      headings_count: headings.length,
      processed_date: new Date().toISOString()
    };
    
    return {
      text: formattedContent,
      metadata: enhancedMetadata
    };
  } catch (error) {
    console.error('Error processing web URL:', error);
    throw new Error(`Failed to process webpage: ${error instanceof Error ? error.message : String(error)}`);
  }
}

// Main processing function
serve(async (req) => {
  // Handle CORS preflight request
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    // 1. Extract documentId from the request payload
    const { documentId } = await req.json()
    if (!documentId) {
      throw new Error('Missing documentId in request payload');
    }
    console.log('Processing document ID:', documentId);

    // 2. Initialize Supabase Client (use ENV variables)
    const supabaseUrl = Deno.env.get('SUPABASE_URL')
    const supabaseServiceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')
    const openaiApiKey = Deno.env.get('OPENAI_API_KEY')

    if (!supabaseUrl || !supabaseServiceRoleKey) {
        throw new Error('Missing Supabase environment variables');
    }

    if (!openaiApiKey) {
        throw new Error('Missing OpenAI API key');
    }

    const supabase = createClient(supabaseUrl, supabaseServiceRoleKey,
        { global: { headers: { Authorization: `Bearer ${supabaseServiceRoleKey}` } } }
      );

    // 3. Fetch document record
    console.log('Fetching document record...');
    const { data: document, error: fetchError } = await supabase
      .from('documents')
      .select('id, organisation_id, storage_path, file_type, metadata') // Select necessary fields
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
      console.error('Failed to update status to processing:', statusUpdateError);
      throw new Error(`Failed to update status to processing: ${statusUpdateError.message}`);
    }
    console.log('Status updated to processing.');

    // 5. Process based on type to extract text
    let extractedText = '';
    let metadata = document.metadata || {}; // Use existing metadata or empty object

    // Check if this is a URL document (YouTube or Web)
    if (document.file_type === 'application/json' && document.metadata && document.metadata.originalUrl) {
      const url = document.metadata.originalUrl;
      console.log(`Processing URL: ${url}`);
      
      if (/youtube\.com|youtu\.be/.test(url)) {
        console.log('Detected YouTube URL, processing...');
        const result = await processYouTubeUrl(url);
        extractedText = result.text;
        metadata = { ...metadata, ...result.metadata };
        console.log('YouTube processing complete');
      } else {
        console.log('Processing as general web URL...');
        const result = await processWebUrl(url);
        extractedText = result.text;
        metadata = { ...metadata, ...result.metadata };
        console.log('Web URL processing complete');
      }
    } else {
      // Regular file processing
      // 5.1 Download file from Storage
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

      // 5.2 Determine file type and parse content
      const fileType = document.file_type || 'application/octet-stream'; // Fallback if null
      console.log(`Determining parser for file type: ${fileType}...`);

      const fileBuffer = await fileData.arrayBuffer(); // Get ArrayBuffer

      try {
        if (fileType === 'application/pdf') {
          console.log('Using pdf-parse...');
          const data = await pdf(fileBuffer);
          extractedText = data.text;
          metadata = { ...metadata, ...data.info }; // pdf-parse provides metadata
          console.log('PDF parsed.');
        } else if (fileType === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document') {
          console.log('Using mammoth for DOCX...');
          const result = await mammoth.extractRawText({ arrayBuffer: fileBuffer });
          extractedText = result.value;
          // mammoth might have limited metadata extraction
          console.log('DOCX parsed.');
        // TODO: Add handlers for PPT, CSV, Audio, Video
        } else {
            console.warn(`Unsupported file type: ${fileType}. Skipping parsing.`);
            // Optionally set status to 'error' or a specific 'unsupported' status?
            // For now, treat as success with no text
            extractedText = '';
        }
      } catch (processingError) {
        console.error('Error processing file:', processingError);
        throw processingError;
      }
    }

    console.log('Text extraction complete (first 100 chars):', extractedText.substring(0, 100));

    // 6. NEW: Chunk the extracted text
    console.log('Chunking extracted text...');
    if (!extractedText.trim()) {
      throw new Error('No text was extracted from the document.');
    }
    
    const documentTitle = metadata.title || document.storage_path.split('/').pop() || 'Untitled';
    
    // Chunk text with document title as context
    const chunks = chunkText(extractedText, {
      maxTokensPerChunk: 1000,
      overlapTokens: 50,
      preserveParagraphs: true,
      preserveSections: true
    });
    
    console.log(`Text chunked into ${chunks.length} segments.`);

    // 7. NEW: Generate embeddings for chunks
    console.log('Generating embeddings...');
    const chunksWithEmbeddings = await generateEmbeddings(chunks, openaiApiKey);
    
    // 8. NEW: Store chunks and embeddings in database
    console.log('Storing chunks in database...');
    const chunkInsertPromises = chunksWithEmbeddings.map((chunk, index) => {
      // Prepare chunk data for insertion
      const chunkData = {
        document_id: documentId,
        organisation_id: document.organisation_id,
        chunk_index: index,
        content: chunk.content,
        embedding: chunk.embedding,
        token_count: chunk.tokenCount,
        metadata: {
          ...chunk.metadata,
          documentTitle,
          document_type: document.file_type,
          position: index / chunks.length // Normalized position in document (0-1)
        }
      };
      
      return supabase
        .from('document_chunks')
        .insert(chunkData)
        .then(({ error }) => {
          if (error) {
            console.error(`Error storing chunk ${index}:`, error);
            return false;
          }
          return true;
        });
    });
    
    // Wait for all chunks to be inserted
    const chunkInsertResults = await Promise.all(chunkInsertPromises);
    const successfulInserts = chunkInsertResults.filter(result => result).length;
    
    console.log(`Successfully stored ${successfulInserts} of ${chunks.length} chunks.`);
    
    // 9. Update document metadata with chunking info
    const updatedMetadata = {
      ...metadata,
      chunk_count: chunks.length,
      processed_date: new Date().toISOString(),
      embedding_model: 'text-embedding-3-small'
    };

    // 10. Update status to 'completed'
    console.log('Updating status to completed...');
    const { error: finalStatusError } = await supabase
      .from('documents')
      .update({
        status: 'completed' as DocumentStatus,
        processing_error: null, // Clear any previous error
        metadata: updatedMetadata, // Store updated metadata
        summary_status: 'pending'  // Mark for summarization
    })
      .eq('id', documentId)

    if (finalStatusError) {
      console.error('Failed to update status to completed:', finalStatusError);
      // Don't throw here, processing technically succeeded, but log failure
    }
    console.log('Status updated to completed.');

    // 11. NEW: Trigger the summarization function
    try {
      console.log('Triggering summarization process...');
      
      // Call the summarize-chunks function to start the chunk-level summarization
      const summarizeResponse = await fetch(`${supabaseUrl}/functions/v1/summarize-chunks`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${supabaseServiceRoleKey}`
        },
        body: JSON.stringify({
          documentId,
          summarizeLevel: 'chunk'  // Start with chunk-level summarization
        })
      });
      
      if (!summarizeResponse.ok) {
        console.warn('Failed to trigger summarization function, but document processing was successful.');
        console.warn('Summarization status:', await summarizeResponse.text());
      } else {
        console.log('Summarization process started successfully.');
      }
    } catch (summarizeError) {
      console.error('Error triggering summarization:', summarizeError);
      // Don't fail the whole process if summarization trigger fails
    }

    return new Response(JSON.stringify({ 
      success: true, 
      documentId: documentId, 
      message: 'Document processed successfully',
      chunks: chunks.length,
      stored_chunks: successfulInserts
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 200,
    })

  } catch (err) {
    // Catch setup errors (missing env vars, payload issues, initial fetch/update failures)
    console.error('Function error:', err);
    const errorMessage = err instanceof Error ? err.message : 'Unknown error';
    
    // Try to update document status to error if documentId is available
    try {
      const { documentId } = await req.json();
      if (documentId) {
        const supabaseUrl = Deno.env.get('SUPABASE_URL');
        const supabaseServiceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
        
        if (supabaseUrl && supabaseServiceRoleKey) {
          const supabase = createClient(supabaseUrl, supabaseServiceRoleKey);
          await supabase
            .from('documents')
            .update({
              status: 'error' as DocumentStatus,
              processing_error: errorMessage
            })
            .eq('id', documentId);
          console.log(`Updated document ${documentId} status to error`);
        }
      }
    } catch (updateError) {
      console.error('Failed to update document status to error:', updateError);
    }
    
    return new Response(JSON.stringify({ error: errorMessage }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 400, // Bad Request or 500 Internal Server Error depending on cause
    })
  }
}) 