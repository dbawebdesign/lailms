import { serve } from 'https://deno.land/std@0.177.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { corsHeaders } from '../_shared/cors.ts'

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
  summary_status?: string;
  section?: string | null;
  chunk_index: number;
  metadata: Record<string, any> | null;
}

/**
 * Summarizes a single text chunk using OpenAI's GPT-4.1-nano model
 */
async function summarizeChunk(content: string, apiKey: string): Promise<string> {
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
        max_tokens: 150   // Keep summaries concise
      }),
    });
    
    if (!response.ok) {
      const errorBody = await response.text();
      throw new Error(`OpenAI API error (${response.status}): ${errorBody}`);
    }
    
    const result = await response.json();
    return result.choices[0].message.content.trim();
  } catch (error) {
    console.error('Error generating summary:', error);
    throw error;
  }
}

/**
 * Creates a section summary from multiple chunk summaries
 */
async function summarizeSection(chunkSummaries: string[], sectionName: string, apiKey: string): Promise<string> {
  try {
    const combinedSummaries = chunkSummaries.join('\n\n');
    
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
            content: `These are summaries from the "${sectionName}" section of a document. Create a concise section summary that captures the key points (maximum 3-4 sentences):\n\n${combinedSummaries}`
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
  } catch (error) {
    console.error('Error generating section summary:', error);
    throw error;
  }
}

/**
 * Creates a document-level summary from section summaries
 */
async function summarizeDocument(sectionSummaries: { section: string, summary: string }[], documentId: string, apiKey: string): Promise<string> {
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
  } catch (error) {
    console.error('Error generating document summary:', error);
    throw error;
  }
}

// Main function handler
serve(async (req) => {
  // Handle CORS preflight request
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    // Parse the request body
    const { documentId, chunkId, summarizeLevel = 'chunk' } = await req.json() as SummarizeRequest;
    
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
    const supabase = createClient(supabaseUrl, supabaseServiceRoleKey, {
      global: { headers: { Authorization: `Bearer ${supabaseServiceRoleKey}` } }
    });
    
    // Process based on the requested summarization level
    let response: any = { success: true, message: '', summarized: 0 };
    
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
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          status: 200,
        });
      }
      
      console.log(`Found ${chunks.length} chunks to summarize for document ${documentId}`);
      
      // Process each chunk
      for (const chunk of chunks) {
        try {
          console.log(`Summarizing chunk ${chunk.id} (${chunk.chunk_index})`);
          const summary = await summarizeChunk(chunk.content, openaiApiKey);
          
          // Update the chunk with its summary
          const { error: updateError } = await supabase
            .from('document_chunks')
            .update({
              chunk_summary: summary,
              summary_status: 'completed'
            })
            .eq('id', chunk.id);
          
          if (updateError) {
            console.error(`Failed to update chunk ${chunk.id}:`, updateError);
          } else {
            response.summarized++;
          }
        } catch (error) {
          console.error(`Error summarizing chunk ${chunk.id}:`, error);
          
          // Mark the chunk as error
          await supabase
            .from('document_chunks')
            .update({
              summary_status: 'error'
            })
            .eq('id', chunk.id);
        }
      }
      
      response.message = `Successfully summarized ${response.summarized} of ${chunks.length} chunks.`;
      
      // Check if all chunks for this document are now summarized
      const { count: pendingCount, error: countError } = await supabase
        .from('document_chunks')
        .select('*', { count: 'exact', head: true })
        .eq('document_id', documentId)
        .eq('summary_status', 'pending');
      
      if (!countError && pendingCount === 0) {
        // All chunks are summarized, trigger section summaries
        response.nextStep = 'section';
      }
    } else if (summarizeLevel === 'section') {
      // Get all completed chunks grouped by section
      const { data: chunks, error: fetchError } = await supabase
        .from('document_chunks')
        .select('*')
        .eq('document_id', documentId)
        .eq('summary_status', 'completed')
        .order('chunk_index');
      
      if (fetchError || !chunks || chunks.length === 0) {
        throw new Error(`Failed to fetch completed chunks: ${fetchError?.message || 'No completed chunks found'}`);
      }
      
      // Group chunks by section
      const sectionMap: Record<string, ChunkRecord[]> = {};
      
      chunks.forEach(chunk => {
        const sectionKey = chunk.section || 'default';
        if (!sectionMap[sectionKey]) {
          sectionMap[sectionKey] = [];
        }
        sectionMap[sectionKey].push(chunk);
      });
      
      // Generate summary for each section
      const sectionResults = [];
      
      for (const [sectionName, sectionChunks] of Object.entries(sectionMap)) {
        try {
          const chunkSummaries = sectionChunks
            .map(chunk => chunk.chunk_summary)
            .filter(Boolean) as string[];
          
          if (chunkSummaries.length === 0) continue;
          
          const sectionSummary = await summarizeSection(chunkSummaries, sectionName, openaiApiKey);
          
          // Update all chunks in this section with the section summary
          const { error: updateError } = await supabase
            .from('document_chunks')
            .update({
              section_summary: sectionSummary
            })
            .eq('document_id', documentId)
            .eq('section', sectionName);
          
          if (updateError) {
            console.error(`Failed to update section ${sectionName}:`, updateError);
          } else {
            sectionResults.push({
              section: sectionName,
              chunks: sectionChunks.length,
              summary: sectionSummary
            });
            response.summarized++;
          }
        } catch (error) {
          console.error(`Error summarizing section ${sectionName}:`, error);
        }
      }
      
      response.message = `Successfully summarized ${response.summarized} sections.`;
      response.sections = sectionResults;
      response.nextStep = 'document';
    } else if (summarizeLevel === 'document') {
      // Get all section summaries
      const { data: chunks, error: fetchError } = await supabase
        .from('document_chunks')
        .select('section, section_summary')
        .eq('document_id', documentId)
        .not('section_summary', 'is', null)
        .order('chunk_index');
      
      if (fetchError) {
        throw new Error(`Failed to fetch section summaries: ${fetchError.message}`);
      }
      
      if (!chunks || chunks.length === 0) {
        throw new Error('No section summaries found');
      }
      
      // Deduplicate sections (we only need one summary per section)
      const sections = Array.from(
        new Map(chunks.map(c => [c.section, { section: c.section || 'Unnamed section', summary: c.section_summary }]))
        .values()
      );
      
      try {
        // Generate document summary
        const documentSummary = await summarizeDocument(sections, documentId, openaiApiKey);
        
        // Update the document with its summary
        const { error: updateError } = await supabase
          .from('documents')
          .update({
            document_summary: documentSummary,
            summary_status: 'completed'
          })
          .eq('id', documentId);
        
        if (updateError) {
          throw new Error(`Failed to update document: ${updateError.message}`);
        }
        
        response.message = 'Successfully generated document summary.';
        response.summary = documentSummary;
      } catch (error) {
        console.error('Error generating document summary:', error);
        
        // Mark the document as error
        await supabase
          .from('documents')
          .update({
            summary_status: 'error'
          })
          .eq('id', documentId);
          
        throw error;
      }
    }
    
    return new Response(JSON.stringify(response), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 200,
    });
  } catch (err) {
    console.error('Function error:', err);
    const errorMessage = err instanceof Error ? err.message : 'Unknown error';
    
    return new Response(JSON.stringify({ error: errorMessage }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 500,
    });
  }
}); 