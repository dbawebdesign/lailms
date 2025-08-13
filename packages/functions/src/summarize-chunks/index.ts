import { serve } from 'https://deno.land/std@0.177.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
// import { corsHeaders } from '../_shared/cors.ts'; // This file is deleted

// Consistent, robust CORS headers (copied from process-document)
const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, GET, OPTIONS, PUT, DELETE',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-supabase-auth, referer, user-agent, accept',
  'Access-Control-Max-Age': '86400',
};

console.log(`Function "summarize-chunks" up and running!`)

// Type definitions
interface SummarizeRequest {
  documentId: string;
  chunkId?: string;  // Optional - if provided, summarize only this chunk
  summarizeLevel?: 'chunk' | 'section' | 'document'; // Default: 'chunk'
}

interface ChunkRecord {
  id: string;
  document_id: string;
  content: string;
  chunk_summary?: string | null;
  summary_status?: string; // For chunk_summary status
  section_identifier?: string | null; // Changed from section to section_identifier
  section_summary?: string | null; // Added for section_summary
  section_summary_status?: string; // Added for section_summary status
  chunk_index: number;
  metadata: Record<string, any> | null;
  organisation_id?: string; // Added to potentially fetch if needed for document_summaries
}

// Helper: robustly extract text from GPT-5-nano Responses API payloads
function extractResponseText(result: any): string {
  console.log('GPT-5-nano response structure:', JSON.stringify(result, null, 2));
  
  if (!result) return '';
  
  // Check if response is incomplete due to max_output_tokens
  if (result.status === 'incomplete' && result.incomplete_details?.reason === 'max_output_tokens') {
    console.warn('GPT-5-nano response incomplete due to max_output_tokens limit');
    // Try to extract any partial content that might exist
  }
  
  // Handle direct text response
  if (typeof result === 'string') return result.trim();
  if (typeof result.text === 'string') return result.text.trim();
  if (typeof result.output_text === 'string') return result.output_text.trim();
  
  // Handle output array format - look for message types
  if (Array.isArray(result.output)) {
    for (const item of result.output) {
      // Look for message type outputs with content
      if (item.type === 'message' && item.content) {
        if (Array.isArray(item.content)) {
          for (const contentItem of item.content) {
            if (contentItem.type === 'output_text' && contentItem.text) {
              return contentItem.text.trim();
            }
            if (contentItem.type === 'text' && contentItem.text) {
              return contentItem.text.trim();
            }
          }
        } else if (typeof item.content === 'string') {
          return item.content.trim();
        }
      }
      // Look for direct text outputs
      if (item.type === 'output_text' && item.text) {
        return item.text.trim();
      }
      if (item.type === 'text' && item.text) {
        return item.text.trim();
      }
      // Skip reasoning type outputs as they don't contain the final text
      if (item.type === 'reasoning') {
        continue;
      }
    }
  }
  
  // Handle content array format
  if (Array.isArray(result.content)) {
    for (const contentItem of result.content) {
      if (contentItem.type === 'output_text' && contentItem.text) {
        return contentItem.text.trim();
      }
      if (contentItem.type === 'text' && contentItem.text) {
        return contentItem.text.trim();
      }
    }
  }
  
  // Handle message format
  if (result.message && typeof result.message === 'string') {
    return result.message.trim();
  }
  
  console.warn('Could not extract text from GPT-5-nano response. Status:', result.status, 'Incomplete reason:', result.incomplete_details?.reason);
  return '';
}

async function callGpt5Nano(
  messages: Array<{ role: 'system' | 'user'; content: string }>,
  apiKey: string,
  maxTokens: number
): Promise<string> {
  const resp = await fetch('https://api.openai.com/v1/responses', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model: 'gpt-5-nano',
      input: messages,
      max_output_tokens: maxTokens,
      reasoning: {
        effort: 'low'  // Use low reasoning effort for simple summarization tasks
      }
    }),
  });
  if (!resp.ok) {
    const body = await resp.text();
    throw new Error(`OpenAI Responses error (${resp.status}): ${body}`);
  }
  const result = await resp.json();
  const text = extractResponseText(result);
  if (!text) {
    // If no text extracted, provide more context about the failure
    const status = result.status || 'unknown';
    const reason = result.incomplete_details?.reason || 'unknown';
    throw new Error(`Empty response text. Status: ${status}, Reason: ${reason}`);
  }
  return text;
}

/**
 * Summarizes a single text chunk using preferred model flow
 */
async function summarizeChunk(content: string, apiKey: string): Promise<string> {
  const messages = [
    { role: 'system' as const, content: 'You are a highly efficient summarizer. Create clear, concise summaries that capture the key information while being brief.' },
    { role: 'user' as const, content: `Provide a brief, factual summary of the following text (no more than 2-3 sentences):\n\n${content}` },
  ];
  return await callGpt5Nano(messages, apiKey, 400); // Increased from 150 to account for reasoning overhead
}

/**
 * Batch summarization with progressive database updates for better UI feedback
 */
async function summarizeChunksBatchWithProgressiveUpdates(
  chunks: ChunkRecord[], 
  apiKey: string, 
  supabase: any,
  onProgress?: (completedInBatch: number) => void
): Promise<Map<string, string>> {
  const batchSize = 10; // Process up to 10 chunks per API call
  const results = new Map<string, string>();
  
  console.log(`Starting batch summarization with progressive updates for ${chunks.length} chunks in batches of ${batchSize}`);
  
  for (let i = 0; i < chunks.length; i += batchSize) {
    const batch = chunks.slice(i, i + batchSize);
    console.log(`Processing batch ${Math.floor(i / batchSize) + 1}/${Math.ceil(chunks.length / batchSize)} with ${batch.length} chunks`);
    
    try {
      // Create a single prompt with multiple chunks
      const chunksText = batch.map((chunk, idx) => 
        `CHUNK ${idx + 1} (ID: ${chunk.id}):\n${chunk.content}\n`
      ).join('\n---\n\n');
      
      const messages = [
        { 
          role: 'system' as const, 
          content: 'You are a highly efficient batch summarizer. For each chunk provided, create a clear, concise summary (2-3 sentences max). Format your response as: "CHUNK 1 SUMMARY: [summary]\\nCHUNK 2 SUMMARY: [summary]" etc.' 
        },
        { 
          role: 'user' as const, 
          content: `Summarize each of the following text chunks. Provide exactly ${batch.length} summaries in the specified format:\n\n${chunksText}` 
        },
      ];
      
      const batchResponse = await callGpt5Nano(messages, apiKey, 800 + (batch.length * 100)); // Dynamic token allocation
      
      // Parse the batch response to extract individual summaries
      const summaries = parseBatchSummaryResponse(batchResponse, batch);
      
      // Immediately update database for this batch
      let batchCompletedCount = 0;
      for (const chunk of batch) {
        const summary = summaries.get(chunk.id);
        
        if (summary) {
          try {
            const { error: updateError } = await supabase
              .from('document_chunks')
              .update({
                chunk_summary: summary,
                summary_status: 'completed',
                section_summary_status: chunk.section_identifier ? 'pending' : null 
              })
              .eq('id', chunk.id);
            
            if (updateError) {
              console.error(`Failed to update chunk ${chunk.id}:`, updateError);
            } else {
              results.set(chunk.id, summary);
              batchCompletedCount++;
            }
          } catch (updateError) {
            console.error(`Error updating chunk ${chunk.id} in database:`, updateError);
            await supabase
              .from('document_chunks')
              .update({ summary_status: 'error' })
              .eq('id', chunk.id);
          }
        } else {
          console.warn(`No summary generated for chunk ${chunk.id} in batch processing`);
          await supabase
            .from('document_chunks')
            .update({ summary_status: 'error' })
            .eq('id', chunk.id);
        }
      }
      
      // Call progress callback for UI updates
      if (onProgress && batchCompletedCount > 0) {
        onProgress(batchCompletedCount);
      }
      
      console.log(`Batch ${Math.floor(i / batchSize) + 1} completed: ${batchCompletedCount}/${batch.length} chunks summarized and updated in database`);
      
    } catch (error) {
      console.error(`Error in batch ${Math.floor(i / batchSize) + 1}:`, error);
      
      // Fallback to individual processing for this batch
      console.log(`Falling back to individual processing for batch ${Math.floor(i / batchSize) + 1}`);
      let individualCompletedCount = 0;
      for (const chunk of batch) {
        try {
          const summary = await summarizeChunk(chunk.content, apiKey);
          
          const { error: updateError } = await supabase
            .from('document_chunks')
            .update({
              chunk_summary: summary,
              summary_status: 'completed',
              section_summary_status: chunk.section_identifier ? 'pending' : null 
            })
            .eq('id', chunk.id);
          
          if (updateError) {
            console.error(`Failed to update chunk ${chunk.id}:`, updateError);
          } else {
            results.set(chunk.id, summary);
            individualCompletedCount++;
          }
        } catch (individualError) {
          console.error(`Failed to summarize chunk ${chunk.id} individually:`, individualError);
          await supabase
            .from('document_chunks')
            .update({ summary_status: 'error' })
            .eq('id', chunk.id);
        }
      }
      
      // Call progress callback for fallback completions
      if (onProgress && individualCompletedCount > 0) {
        onProgress(individualCompletedCount);
      }
    }
    
    // Small delay between batches to avoid rate limiting
    if (i + batchSize < chunks.length) {
      await new Promise(resolve => setTimeout(resolve, 100));
    }
  }
  
  console.log(`Batch summarization with progressive updates completed. Successfully processed ${results.size}/${chunks.length} chunks`);
  return results;
}

/**
 * Original batch summarization function (kept for backwards compatibility)
 */
async function summarizeChunksBatch(chunks: ChunkRecord[], apiKey: string): Promise<Map<string, string>> {
  const batchSize = 10; // Process up to 10 chunks per API call
  const results = new Map<string, string>();
  
  console.log(`Starting batch summarization for ${chunks.length} chunks in batches of ${batchSize}`);
  
  for (let i = 0; i < chunks.length; i += batchSize) {
    const batch = chunks.slice(i, i + batchSize);
    console.log(`Processing batch ${Math.floor(i / batchSize) + 1}/${Math.ceil(chunks.length / batchSize)} with ${batch.length} chunks`);
    
    try {
      // Create a single prompt with multiple chunks
      const chunksText = batch.map((chunk, idx) => 
        `CHUNK ${idx + 1} (ID: ${chunk.id}):\n${chunk.content}\n`
      ).join('\n---\n\n');
      
      const messages = [
        { 
          role: 'system' as const, 
          content: 'You are a highly efficient batch summarizer. For each chunk provided, create a clear, concise summary (2-3 sentences max). Format your response as: "CHUNK 1 SUMMARY: [summary]\\nCHUNK 2 SUMMARY: [summary]" etc.' 
        },
        { 
          role: 'user' as const, 
          content: `Summarize each of the following text chunks. Provide exactly ${batch.length} summaries in the specified format:\n\n${chunksText}` 
        },
      ];
      
      const batchResponse = await callGpt5Nano(messages, apiKey, 800 + (batch.length * 100)); // Dynamic token allocation
      
      // Parse the batch response to extract individual summaries
      const summaries = parseBatchSummaryResponse(batchResponse, batch);
      
      // Add successful summaries to results
      summaries.forEach((summary, chunkId) => {
        if (summary) {
          results.set(chunkId, summary);
        }
      });
      
      console.log(`Batch ${Math.floor(i / batchSize) + 1} completed: ${summaries.size}/${batch.length} chunks summarized`);
      
    } catch (error) {
      console.error(`Error in batch ${Math.floor(i / batchSize) + 1}:`, error);
      
      // Fallback to individual processing for this batch
      console.log(`Falling back to individual processing for batch ${Math.floor(i / batchSize) + 1}`);
      for (const chunk of batch) {
        try {
          const summary = await summarizeChunk(chunk.content, apiKey);
          results.set(chunk.id, summary);
        } catch (individualError) {
          console.error(`Failed to summarize chunk ${chunk.id} individually:`, individualError);
        }
      }
    }
    
    // Small delay between batches to avoid rate limiting
    if (i + batchSize < chunks.length) {
      await new Promise(resolve => setTimeout(resolve, 100));
    }
  }
  
  console.log(`Batch summarization completed. Successfully processed ${results.size}/${chunks.length} chunks`);
  return results;
}

/**
 * Helper function to parse batch summary responses from GPT-5-nano
 */
function parseBatchSummaryResponse(response: string, chunks: ChunkRecord[]): Map<string, string> {
  const results = new Map<string, string>();
  
  try {
    // Look for patterns like "CHUNK 1 SUMMARY:", "CHUNK 2 SUMMARY:", etc.
    const summaryPattern = /CHUNK\s+(\d+)\s+SUMMARY:\s*([^\n]+(?:\n(?!CHUNK\s+\d+\s+SUMMARY:)[^\n]*)*)/gi;
    let match;
    
    while ((match = summaryPattern.exec(response)) !== null) {
      const chunkIndex = parseInt(match[1]) - 1; // Convert to 0-based index
      const summary = match[2].trim();
      
      if (chunkIndex >= 0 && chunkIndex < chunks.length && summary) {
        const chunkId = chunks[chunkIndex].id;
        results.set(chunkId, summary);
      }
    }
    
    // If pattern matching failed, try alternative parsing approaches
    if (results.size === 0) {
      console.warn('Primary parsing failed, trying alternative approaches');
      
      // Try splitting by numbers or other delimiters
      const lines = response.split('\n').filter(line => line.trim());
      let currentChunkIndex = 0;
      
      for (const line of lines) {
        if (line.trim() && currentChunkIndex < chunks.length) {
          // Clean up the line (remove numbering, colons, etc.)
          const cleanedSummary = line.replace(/^\d+[\.:)\-]?\s*/, '').replace(/^CHUNK\s*\d+[\s\-:]*/, '').trim();
          
          if (cleanedSummary && cleanedSummary.length > 10) { // Ensure it's a meaningful summary
            results.set(chunks[currentChunkIndex].id, cleanedSummary);
            currentChunkIndex++;
          }
        }
      }
    }
    
  } catch (parseError) {
    console.error('Error parsing batch summary response:', parseError);
  }
  
  return results;
}

/**
 * Creates a section summary from multiple chunk summaries
 */
async function summarizeSection(chunkContents: string[], sectionIdentifier: string, apiKey: string): Promise<string> {
  const combinedContents = chunkContents.join('\n\n');
  const messages = [
    { role: 'system' as const, content: 'You are a highly efficient summarizer. Create clear, concise summaries that capture the key information while being brief.' },
    { role: 'user' as const, content: `These are text segments from the "${sectionIdentifier}" section of a document. Create a concise section summary that captures the key points (maximum 3-4 sentences):\n\n${combinedContents}` },
  ];
  return await callGpt5Nano(messages, apiKey, 500); // Increased from 200 to account for reasoning overhead
}

/**
 * Creates a document-level summary from section summaries
 */
async function summarizeDocument(
  sectionSummaries: { section: string, summary: string }[],
  documentId: string,
  apiKey: string
): Promise<string> {
  const formattedSections = sectionSummaries.map(s => `${s.section || 'Unnamed section'}:\n${s.summary}`).join('\n\n');
  const messages = [
    { role: 'system' as const, content: 'You are a highly efficient summarizer. Create clear, concise summaries that capture the key information while being brief.' },
    { role: 'user' as const, content: `These are summaries of different sections of a document. Create a comprehensive but concise document summary (4-5 sentences maximum):\n\n${formattedSections}` },
  ];
  return await callGpt5Nano(messages, apiKey, 600); // Increased from 250 to account for reasoning overhead
}

// Main function handler
serve(async (req: Request) => {
  // Handle CORS preflight request
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  let orgId: string | null = null; // Declare orgId here to ensure it's in scope

  try {
    // Parse the request body
    const { documentId, chunkId, summarizeLevel = 'chunk' } = await req.json() as SummarizeRequest;
    
    if (!documentId) {
      throw new Error('Missing documentId in request payload');
    }
    
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

    if (!supabaseUrl || !supabaseServiceRoleKey) {
      throw new Error('Missing Supabase environment variables');
    }

    if (!openaiApiKey) {
      throw new Error('Missing OpenAI API key');
    }

    // Initialize Supabase client
    const supabase = createClient(supabaseUrl, supabaseServiceRoleKey, {
      global: { headers: { Authorization: `Bearer ${supabaseServiceRoleKey}` } }
    });

    // Fetch document details to get organisation_id
    const { data: documentData, error: docError } = await supabase
      .from('documents')
      .select('organisation_id, status')
      .eq('id', documentId)
      .single();

    if (docError || !documentData) {
      throw new Error(`Failed to fetch document details: ${docError?.message || 'Document not found'}`);
    }
    // Assign to the orgId declared in the broader scope
    orgId = documentData.organisation_id; 
    const currentDocumentStatus = documentData.status;


    if (!orgId) { // Check if orgId was successfully fetched and assigned
      throw new Error(`Organisation ID not found for document ${documentId} or was null.`);
    }
    
    // Process based on the requested summarization level
    let response: { 
      success: boolean; 
      message: string; 
      summarized: number; 
      error?: string;
      summary?: string; // Added optional summary field for document level
    } = { success: true, message: '', summarized: 0 };
    
    if (summarizeLevel === 'chunk') {
      // Summarize a single chunk or all pending chunks in a document
      let query = supabase
        .from('document_chunks')
        .select('*')
        .eq('document_id', documentId)
        .eq('summary_status', 'pending');
      
      // If a specific chunk ID is provided, filter by it
      if (chunkId) {
        query = query.eq('id', chunkId);
      }
      
      // Fetch chunks to summarize
      const { data: chunks, error: fetchError } = await query as { data: ChunkRecord[] | null, error: any };
      
      if (fetchError) {
        throw new Error(`Failed to fetch chunks: ${fetchError.message}`);
      }
      
      if (!chunks || chunks.length === 0) {
        return new Response(JSON.stringify({ 
          success: true, 
          message: 'No pending chunks found to summarize' 
        }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          status: 200,
        });
      }
      
      console.log(`Found ${chunks.length} chunks to summarize for document ${documentId}`);
      
      // Choose between batch processing (>30 chunks) or individual processing
      if (chunks.length > 30) {
        console.log(`Using batch processing for ${chunks.length} chunks (threshold: 30)`);
        
        try {
          const batchResults = await summarizeChunksBatchWithProgressiveUpdates(
            chunks as ChunkRecord[], 
            openaiApiKey, 
            supabase,
            (completed: number) => {
              response.summarized += completed;
              console.log(`Progressive update: ${response.summarized}/${chunks.length} chunks completed`);
            }
          );
          
        } catch (batchError) {
          console.error('Batch processing failed completely, falling back to individual processing:', batchError);
          
          // Fallback to individual processing for all chunks
          for (const chunk of chunks as ChunkRecord[]) {
            try {
              console.log(`Fallback: Summarizing chunk ${chunk.id} (${chunk.chunk_index}) individually`);
              const summary = await summarizeChunk(chunk.content, openaiApiKey);
              
              const { error: updateError } = await supabase
                .from('document_chunks')
                .update({
                  chunk_summary: summary,
                  summary_status: 'completed',
                  section_summary_status: chunk.section_identifier ? 'pending' : null 
                })
                .eq('id', chunk.id);
              
              if (updateError) {
                console.error(`Failed to update chunk ${chunk.id}:`, updateError);
              } else {
                response.summarized++;
              }
            } catch (error: any) {
              console.error(`Error summarizing chunk ${chunk.id}:`, error);
              await supabase
                .from('document_chunks')
                .update({ summary_status: 'error' })
                .eq('id', chunk.id);
            }
          }
        }
        
      } else {
        console.log(`Using individual processing for ${chunks.length} chunks (threshold: 30)`);
        
        // Process each chunk individually (original logic)
        for (const chunk of chunks as ChunkRecord[]) {
          try {
            console.log(`Summarizing chunk ${chunk.id} (${chunk.chunk_index}) for document ${documentId}`);
            const summary = await summarizeChunk(chunk.content, openaiApiKey);
            
            // Update the chunk with its summary
            const { error: updateError } = await supabase
              .from('document_chunks')
              .update({
                chunk_summary: summary,
                summary_status: 'completed',
                section_summary_status: chunk.section_identifier ? 'pending' : null 
              })
              .eq('id', chunk.id);
            
            if (updateError) {
              console.error(`Failed to update chunk ${chunk.id}:`, updateError);
            } else {
              response.summarized++;
            }
          } catch (error: any) { // Typed error
            console.error(`Error summarizing chunk ${chunk.id}:`, error);
            await supabase
              .from('document_chunks')
              .update({ summary_status: 'error' })
              .eq('id', chunk.id);
          }
        }
      }
      
      response.message = `Successfully summarized ${response.summarized} chunk(s).`;

      // After all selected chunks are summarized (or if no chunks were selected but we need to check sections)
      // Proceed to summarize sections if applicable
      console.log(`Checking for section summarization for document ${documentId}`);
      const { data: completedChunksForSections, error: fetchCompletedError } = await supabase
        .from('document_chunks')
        .select('id, content, chunk_summary, section_identifier, section_summary_status')
        .eq('document_id', documentId)
        .eq('summary_status', 'completed')
        .neq('section_identifier', null)
        .order('section_identifier')
        .order('chunk_index');

      if (fetchCompletedError) {
        console.error(`Error fetching completed chunks for section summarization: ${fetchCompletedError.message}`);
      } else if (completedChunksForSections && completedChunksForSections.length > 0) {
        const sections: { [key: string]: ChunkRecord[] } = {};
        for (const ch of completedChunksForSections) {
          if (ch.section_identifier) {
            if (!sections[ch.section_identifier]) {
              sections[ch.section_identifier] = [];
            }
            sections[ch.section_identifier].push(ch as ChunkRecord);
          }
        }

        let sectionsSummarizedCount = 0;
        for (const sectionId in sections) {
          const sectionChunks = sections[sectionId];
          // Check if any chunk in this section is pending section summary
          if (sectionChunks.length > 0 && sectionChunks.some(sc => sc.section_summary_status === 'pending')) {
            console.log(`Summarizing section: ${sectionId} with ${sectionChunks.length} chunks.`);
            const sectionChunkContents = sectionChunks.map(sc => sc.content);
            
            try {
              const sectionSummaryText = await summarizeSection(sectionChunkContents, sectionId, openaiApiKey);
              const chunkIdsInSection = sectionChunks.map(sc => sc.id);
              const { error: updateSectionError } = await supabase
                .from('document_chunks')
                .update({
                  section_summary: sectionSummaryText,
                  section_summary_status: 'completed'
                })
                .in('id', chunkIdsInSection);

              if (updateSectionError) {
                console.error(`Failed to update section summary for section ${sectionId}:`, updateSectionError);
                await supabase.from('document_chunks').update({ section_summary_status: 'error' }).in('id', chunkIdsInSection);
              } else {
                sectionsSummarizedCount++;
                console.log(`Successfully summarized section ${sectionId}`);
              }
            } catch (sectionSummarizeErr: any) { // Typed error
              console.error(`Error generating summary for section ${sectionId}:`, sectionSummarizeErr);
              const chunkIdsInSection = sectionChunks.map(sc => sc.id);
              await supabase.from('document_chunks').update({ section_summary_status: 'error' }).in('id', chunkIdsInSection);
            }
          }
        }
        if (sectionsSummarizedCount > 0) {
            response.message += ` ${sectionsSummarizedCount} section(s) also summarized.`;
        }
        console.log(`Completed section summarization checks. ${sectionsSummarizedCount} sections newly processed for document ${documentId}.`);
      } else {
        console.log(`No completed chunks with pending section identifiers found for section summarization for document ${documentId}.`);
      }

      // After chunk and section summaries are done for summarizeLevel 'chunk', finalize by creating document summary.
      // This assumes that a 'chunk' level request implies the full pipeline up to document summary for that document.
      console.log(`Proceeding to finalize document processing after chunk/section summarization for document ${documentId}`);
      const finalizeResult = await finalizeDocumentProcessing(documentId, orgId, supabase, openaiApiKey);
      if (!finalizeResult.success) {
         response.success = false;
         response.message = finalizeResult.message; // Overwrite or append? Let's append for more context.
         response.error = finalizeResult.message;
      } else {
         response.message += ` ${finalizeResult.message}`; // Append success message
         // If finalizeDocumentProcessing returns the summary, add it to response.
         // The finalizeDocumentProcessing current return type doesn't include the summary text itself.
         // We might want to adjust finalizeDocumentProcessing to return { success, message, summaryText? }
         // For now, the document summary is stored in document_summaries, not returned in this main response directly.
      }
      // The document status is updated within finalizeDocumentProcessing

    } else if (summarizeLevel === 'document') {
      // This level now directly triggers the full finalization, including document summary generation and storage.
      console.log(`Direct request for document level summary for ${documentId}. Finalizing document processing.`);
      const finalizeResult = await finalizeDocumentProcessing(documentId, orgId, supabase, openaiApiKey);
      
      response.success = finalizeResult.success;
      response.message = finalizeResult.message;
      if (!finalizeResult.success) {
        response.error = finalizeResult.message;
      }
      // Potentially, if finalizeDocumentProcessing returned the summary text, add it to response.summary
      // For now, the document summary is stored in document_summaries.
      // The 'summarized' count for 'document' level can be 1 if successful.
      if (finalizeResult.success) {
        response.summarized = 1; 
      }
    }
    
    return new Response(JSON.stringify(response), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: response.success ? 200 : 500,
    });
  } catch (error: any) { // Typed error
    console.error('Overall error in summarize-chunks function:', error);
    return new Response(JSON.stringify({ 
      success: false, 
      message: error instanceof Error ? error.message : String(error), 
      error: error instanceof Error ? error.stack : undefined 
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 500,
    });
  }
});

// Helper function to finalize document processing
async function finalizeDocumentProcessing(
  documentId: string,
  orgId: string,
  supabase: any,
  openaiApiKey: string
) {
  console.log(`Finalizing document processing for document ${documentId}`);
  // 1. Fetch all relevant summaries (section or chunk)
  const { data: allProcessedChunks, error: fetchProcessedError } = await supabase
    .from('document_chunks')
    .select('section_identifier, section_summary, chunk_summary, summary_status, section_summary_status')
    .eq('document_id', documentId)
    .or('summary_status.eq.completed,section_summary_status.eq.completed'); // Ensure we only get completed summaries

  if (fetchProcessedError) {
    console.error(`Failed to fetch processed chunks for document summary generation: ${fetchProcessedError.message}`);
    return { success: false, message: `Failed to fetch processed chunks: ${fetchProcessedError.message}` };
  }

  if (!allProcessedChunks || allProcessedChunks.length === 0) {
    console.log(`No completed chunk/section summaries found for document ${documentId}. Skipping document summary.`);
    // Optionally update document status to something like 'no_content_to_summarize'
    await supabase.from('documents').update({ status: 'processing_failed', updated_at: new Date().toISOString() }).eq('id', documentId);
    return { success: true, message: 'No completed summaries to generate document summary from.' };
  }
  
  const uniqueSectionSummaries: { section: string; summary: string }[] = [];
  const seenSections = new Set<string>();

  allProcessedChunks.forEach((c: { section_identifier: string | null; section_summary: string | null; chunk_summary: string | null; section_summary_status: string | null; summary_status: string | null }) => {
    if (c.section_identifier && c.section_summary && c.section_summary_status === 'completed' && !seenSections.has(c.section_identifier)) {
      uniqueSectionSummaries.push({ section: c.section_identifier, summary: c.section_summary });
      seenSections.add(c.section_identifier);
    } else if (!c.section_identifier && c.chunk_summary && c.summary_status === 'completed') {
      // Fallback for documents that might not have sections, or if section summary failed
      // To avoid too many small "sections", we can group these or handle them carefully
      // For now, let's assume if chunk_summary is present, it can contribute if no section summary exists for it
      const pseudoSectionName = `Chunk ${uniqueSectionSummaries.length + 1}`;
      if (!seenSections.has(pseudoSectionName)) { // This check might not be ideal for chunk-level
         uniqueSectionSummaries.push({ section: pseudoSectionName, summary: c.chunk_summary });
         // seenSections.add(pseudoSectionName); // Avoid adding to seenSections if we want all chunk summaries
      }
    }
  });

  if (uniqueSectionSummaries.length === 0) {
    console.log(`No valid section or chunk summaries to form a document summary for ${documentId}.`);
    await supabase.from('documents').update({ status: 'processing_failed', updated_at: new Date().toISOString() }).eq('id', documentId);
    return { success: true, message: 'No valid summaries available for document summary.' };
  }

  // 2. Generate document summary
  try {
    console.log(`Generating document summary for ${documentId} from ${uniqueSectionSummaries.length} section/chunk summaries.`);
    const documentSummaryText = await summarizeDocument(uniqueSectionSummaries, documentId, openaiApiKey);
    
    // 3. Store document summary
    const { error: summaryInsertError } = await supabase
      .from('document_summaries')
      .upsert({
        document_id: documentId,
        organisation_id: orgId,
        summary: documentSummaryText,
        summary_level: 'document',
        status: 'completed',
        model_used: 'gpt-5-nano',
        updated_at: new Date().toISOString(), 
      }, { onConflict: 'document_id, summary_level' });

    if (summaryInsertError) {
      console.error(`Failed to store document summary: ${summaryInsertError.message}`);
      await supabase.from('documents').update({ status: 'processing_failed', updated_at: new Date().toISOString() }).eq('id', documentId);
      return { success: false, message: `Failed to store document summary: ${summaryInsertError.message}` };
    }
    console.log(`Document summary stored successfully for ${documentId}.`);

    // 4. Update main document status
    const { error: docUpdateError } = await supabase
      .from('documents')
      .update({ status: 'completed', updated_at: new Date().toISOString() }) // Or a more specific status like 'summaries_completed'
      .eq('id', documentId);

    if (docUpdateError) {
      console.error(`Failed to update document status to completed: ${docUpdateError.message}`);
      // This is not ideal, as summary is stored but document status isn't updated.
      // Manual intervention might be needed or a retry mechanism.
      return { success: false, message: `Document summary stored, but failed to update main document status: ${docUpdateError.message}` };
    }
    console.log(`Document ${documentId} status updated to completed.`);
    return { success: true, message: 'Document processing and summarization finalized successfully.', summaryText: documentSummaryText };

  } catch (error: any) { // Typed error
    console.error(`Error during document summary generation or storage for ${documentId}:`, error);
    await supabase.from('documents').update({ status: 'processing_failed', updated_at: new Date().toISOString() }).eq('id', documentId);
    // Ensure message from error is passed
    return { success: false, message: `Error finalizing document processing: ${error instanceof Error ? error.message : String(error)}` };
  }
} 