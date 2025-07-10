"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const server_ts_1 = require("https://deno.land/std@0.177.0/http/server.ts");
const supabase_js_2_1 = require("https://esm.sh/@supabase/supabase-js@2");
// import { corsHeaders } from '../_shared/cors.ts'; // This file is deleted
// Consistent, robust CORS headers (copied from process-document)
const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'POST, GET, OPTIONS, PUT, DELETE',
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-supabase-auth, referer, user-agent, accept',
    'Access-Control-Max-Age': '86400',
};
console.log(`Function "summarize-chunks" up and running!`);
/**
 * Summarizes a single text chunk using OpenAI's GPT-4.1-nano model
 */
async function summarizeChunk(content, apiKey) {
    try {
        const url = 'https://api.openai.com/v1/chat/completions';
        const response = await fetch(url, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${apiKey}`,
            },
            body: JSON.stringify({
                model: 'gpt-4.1-nano',
                messages: [
                    {
                        role: 'system',
                        content: 'You are a highly efficient summarizer. Create clear, concise summaries that capture the key information while being brief.'
                    },
                    {
                        role: 'user',
                        content: `Provide a brief, factual summary of the following text (no more than 2-3 sentences):\n\n${content}`
                    }
                ],
                temperature: 0.3, // Lower temperature for more factual/deterministic outputs
                max_tokens: 150 // Keep summaries concise
            }),
        });
        if (!response.ok) {
            const errorBody = await response.text();
            throw new Error(`OpenAI API error (${response.status}): ${errorBody}`);
        }
        const result = await response.json();
        return result.choices[0].message.content.trim();
    }
    catch (error) {
        console.error('Error generating summary:', error);
        throw error;
    }
}
/**
 * Creates a section summary from multiple chunk summaries
 */
async function summarizeSection(chunkContents, sectionIdentifier, apiKey) {
    try {
        const combinedContents = chunkContents.join('\n\n'); // Combine original chunk contents for section summary
        const url = 'https://api.openai.com/v1/chat/completions';
        const response = await fetch(url, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${apiKey}`,
            },
            body: JSON.stringify({
                model: 'gpt-4.1-nano',
                messages: [
                    {
                        role: 'system',
                        content: 'You are a highly efficient summarizer. Create clear, concise summaries that capture the key information while being brief.'
                    },
                    {
                        role: 'user',
                        content: `These are text segments from the "${sectionIdentifier}" section of a document. Create a concise section summary that captures the key points (maximum 3-4 sentences):\n\n${combinedContents}`
                    }
                ],
                temperature: 0.3,
                max_tokens: 200
            }),
        });
        if (!response.ok) {
            const errorBody = await response.text();
            throw new Error(`OpenAI API error (${response.status}): ${errorBody}`);
        }
        const result = await response.json();
        return result.choices[0].message.content.trim();
    }
    catch (error) {
        console.error('Error generating section summary:', error);
        throw error;
    }
}
/**
 * Creates a document-level summary from section summaries
 */
async function summarizeDocument(sectionSummaries, documentId, apiKey) {
    try {
        const formattedSections = sectionSummaries.map(s => `${s.section || 'Unnamed section'}:\n${s.summary}`).join('\n\n');
        const url = 'https://api.openai.com/v1/chat/completions';
        const response = await fetch(url, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${apiKey}`,
            },
            body: JSON.stringify({
                model: 'gpt-4.1-nano',
                messages: [
                    {
                        role: 'system',
                        content: 'You are a highly efficient summarizer. Create clear, concise summaries that capture the key information while being brief.'
                    },
                    {
                        role: 'user',
                        content: `These are summaries of different sections of a document. Create a comprehensive but concise document summary (4-5 sentences maximum):\n\n${formattedSections}`
                    }
                ],
                temperature: 0.3,
                max_tokens: 250
            }),
        });
        if (!response.ok) {
            const errorBody = await response.text();
            throw new Error(`OpenAI API error (${response.status}): ${errorBody}`);
        }
        const result = await response.json();
        return result.choices[0].message.content.trim();
    }
    catch (error) {
        console.error('Error generating document summary:', error);
        throw error;
    }
}
// Main function handler
(0, server_ts_1.serve)(async (req) => {
    // Handle CORS preflight request
    if (req.method === 'OPTIONS') {
        return new Response('ok', { headers: corsHeaders });
    }
    let orgId = null; // Declare orgId here to ensure it's in scope
    try {
        // Parse the request body
        const { documentId, chunkId, summarizeLevel = 'chunk' } = await req.json();
        if (!documentId) {
            throw new Error('Missing documentId in request payload');
        }
        // Initialize environment variables
        const supabaseUrl = Deno.env.get('SUPABASE_URL');
        const supabaseServiceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
        const openaiApiKey = Deno.env.get('OPENAI_API_KEY');
        if (!supabaseUrl || !supabaseServiceRoleKey) {
            throw new Error('Missing Supabase environment variables');
        }
        if (!openaiApiKey) {
            throw new Error('Missing OpenAI API key');
        }
        // Initialize Supabase client
        const supabase = (0, supabase_js_2_1.createClient)(supabaseUrl, supabaseServiceRoleKey, {
            global: { headers: { Authorization: `Bearer ${supabaseServiceRoleKey}` } }
        });
        // Fetch document details to get organisation_id
        const { data: documentData, error: docError } = await supabase
            .from('documents')
            .select('organisation_id, status')
            .eq('id', documentId)
            .single();
        if (docError || !documentData) {
            throw new Error(`Failed to fetch document details: ${(docError === null || docError === void 0 ? void 0 : docError.message) || 'Document not found'}`);
        }
        // Assign to the orgId declared in the broader scope
        orgId = documentData.organisation_id;
        const currentDocumentStatus = documentData.status;
        if (!orgId) { // Check if orgId was successfully fetched and assigned
            throw new Error(`Organisation ID not found for document ${documentId} or was null.`);
        }
        // Process based on the requested summarization level
        let response = { success: true, message: '', summarized: 0 };
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
            const { data: chunks, error: fetchError } = await query;
            if (fetchError) {
                throw new Error(`Failed to fetch chunks: ${fetchError.message}`);
            }
            if (!chunks || chunks.length === 0) {
                return new Response(JSON.stringify({
                    success: true,
                    message: 'No pending chunks found to summarize'
                }), {
                    headers: Object.assign(Object.assign({}, corsHeaders), { 'Content-Type': 'application/json' }),
                    status: 200,
                });
            }
            console.log(`Found ${chunks.length} chunks to summarize for document ${documentId}`);
            // Process each chunk
            for (const chunk of chunks) {
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
                    }
                    else {
                        response.summarized++;
                    }
                }
                catch (error) { // Typed error
                    console.error(`Error summarizing chunk ${chunk.id}:`, error);
                    await supabase
                        .from('document_chunks')
                        .update({ summary_status: 'error' })
                        .eq('id', chunk.id);
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
            }
            else if (completedChunksForSections && completedChunksForSections.length > 0) {
                const sections = {};
                for (const ch of completedChunksForSections) {
                    if (ch.section_identifier) {
                        if (!sections[ch.section_identifier]) {
                            sections[ch.section_identifier] = [];
                        }
                        sections[ch.section_identifier].push(ch);
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
                            }
                            else {
                                sectionsSummarizedCount++;
                                console.log(`Successfully summarized section ${sectionId}`);
                            }
                        }
                        catch (sectionSummarizeErr) { // Typed error
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
            }
            else {
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
            }
            else {
                response.message += ` ${finalizeResult.message}`; // Append success message
                // If finalizeDocumentProcessing returns the summary, add it to response.
                // The finalizeDocumentProcessing current return type doesn't include the summary text itself.
                // We might want to adjust finalizeDocumentProcessing to return { success, message, summaryText? }
                // For now, the document summary is stored in document_summaries, not returned in this main response directly.
            }
            // The document status is updated within finalizeDocumentProcessing
        }
        else if (summarizeLevel === 'document') {
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
            headers: Object.assign(Object.assign({}, corsHeaders), { 'Content-Type': 'application/json' }),
            status: response.success ? 200 : 500,
        });
    }
    catch (error) { // Typed error
        console.error('Overall error in summarize-chunks function:', error);
        return new Response(JSON.stringify({
            success: false,
            message: error instanceof Error ? error.message : String(error),
            error: error instanceof Error ? error.stack : undefined
        }), {
            headers: Object.assign(Object.assign({}, corsHeaders), { 'Content-Type': 'application/json' }),
            status: 500,
        });
    }
});
// Helper function to finalize document processing
async function finalizeDocumentProcessing(documentId, orgId, supabase, openaiApiKey) {
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
    const uniqueSectionSummaries = [];
    const seenSections = new Set();
    allProcessedChunks.forEach((c) => {
        if (c.section_identifier && c.section_summary && c.section_summary_status === 'completed' && !seenSections.has(c.section_identifier)) {
            uniqueSectionSummaries.push({ section: c.section_identifier, summary: c.section_summary });
            seenSections.add(c.section_identifier);
        }
        else if (!c.section_identifier && c.chunk_summary && c.summary_status === 'completed') {
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
            model_used: 'gpt-4.1-nano', // Assuming this model is used by summarizeDocument
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
    }
    catch (error) { // Typed error
        console.error(`Error during document summary generation or storage for ${documentId}:`, error);
        await supabase.from('documents').update({ status: 'processing_failed', updated_at: new Date().toISOString() }).eq('id', documentId);
        // Ensure message from error is passed
        return { success: false, message: `Error finalizing document processing: ${error instanceof Error ? error.message : String(error)}` };
    }
}
