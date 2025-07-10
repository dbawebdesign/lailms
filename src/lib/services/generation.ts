// @ts-nocheck
import OpenAI from 'openai';
import { v4 as uuidv4 } from 'uuid';
import { createBrowserClient } from '@supabase/ssr';
import { Database } from '../../../packages/types/db';

// Initialize OpenAI client
const openai = new OpenAI({
  apiKey: process.env.NEXT_PUBLIC_OPENAI_API_KEY, // Client-side key for browser usage
});

interface ChunkWithMetadata {
  id: string;
  document_id: string;
  content: string;
  citation_key?: string;
  metadata?: Record<string, any>;
  section?: string;
  similarity?: number;
}

interface GenerationRequest {
  prompt: string;
  retrievedChunks: ChunkWithMetadata[];
  queryId: string;
  organisationId: string;
}

export interface CitationInfo {
  index: number;
  citation_key: string;
  document_id: string;
  chunk_id: string;
  title: string;
  section: string | null;
}

/**
 * Generates a response with citations from retrieved chunks
 */
export async function generateWithCitations(request: GenerationRequest) {
  const { prompt, retrievedChunks, queryId, organisationId } = request;
  
  // Format chunks with citation information
  const formattedContext = retrievedChunks.map((chunk, idx) => 
    `[Source ${idx+1}: ${chunk.citation_key || `Document ${chunk.document_id}`}]\n${chunk.content}\n`
  ).join('\n');
  
  // Instruct the model to cite sources
  const systemPrompt = `
    You are a helpful assistant that answers questions based on the provided context.
    When answering, cite your sources using the format [Source X] where X is the source number.
    Always include citations for specific facts, quotes, or information drawn from the sources.
    If the answer cannot be found in the provided sources, clearly state that you don't have that information
    and avoid making up facts. Relevant sources are numbered [Source 1], [Source 2], etc.
    
    Be clear, concise, and helpful. Your goal is to provide accurate information with proper attribution.
  `;
  
  try {
    // Get generation from OpenAI
    const completion = await openai.chat.completions.create({
      model: "gpt-4-turbo",
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: `Context information:\n${formattedContext}\n\nQuestion: ${prompt}` }
      ],
      temperature: 0.3,
    });
    
    const response = completion.choices[0].message.content || "Sorry, I couldn't generate a response.";
    
    // Store generation and citations
    const generationId = await storeGeneration(
      prompt, 
      response, 
      queryId, 
      organisationId,
      "cited_response"
    );
    
    // Store citations
    if (generationId) {
      await Promise.all(retrievedChunks.map((chunk, idx) => 
        storeCitation(generationId, chunk.id, idx, chunk.similarity || 0)
      ));
    }
    
    return {
      response,
      generationId,
      citations: retrievedChunks.map((chunk, idx) => ({
        index: idx + 1,
        citation_key: chunk.citation_key || `Source ${idx+1}`,
        document_id: chunk.document_id,
        chunk_id: chunk.id,
        title: chunk.metadata?.documentTitle || 'Unknown Document',
        section: chunk.section || null,
      }))
    };
  } catch (error) {
    console.error('Error generating content with citations:', error);
    throw new Error('Failed to generate content');
  }
}

/**
 * Stores a generation record in the database
 */
async function storeGeneration(
  prompt: string, 
  response: string, 
  queryId: string, 
  organisationId: string,
  asset_type: string
): Promise<string | null> {
  try {
    const supabase = createBrowserClient<Database>(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
    );
    
    // Get current user
    const { data: { user } } = await supabase.auth.getUser();
    
    if (!user) {
      console.error('User not authenticated');
      return null;
    }
    
    // Create generation record
    const { data: newGeneration, error } = await supabase
      .from('generations')
      .insert({
        user_id: user.id,
        organisation_id: organisationId,
        query: prompt,
        response: response,
        asset_type: asset_type,
      })
      .select('id')
      .single();
    
    if (error) {
      console.error('Error storing generation:', error);
      return null;
    }

    if (!newGeneration?.id) {
      console.error('Failed to retrieve generated ID after storing generation.');
      return null;
    }
    
    return newGeneration.id;
  } catch (error) {
    console.error('Error in storeGeneration:', error);
    return null;
  }
}

/**
 * Stores a citation relationship between a generation and a chunk
 */
async function storeCitation(
  generationId: string, 
  chunkId: string, 
  position: number,
  relevanceScore: number
): Promise<boolean> {
  try {
    const supabase = createBrowserClient<Database>(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
    );
    
    const { error } = await supabase
      .from('generation_citations')
      .insert({
        generation_id: generationId,
        chunk_id: chunkId,
        context_position: position,
        relevance_score: relevanceScore
      });
    
    if (error) {
      console.error('Error storing citation:', error);
      return false;
    }
    
    return true;
  } catch (error) {
    console.error('Error in storeCitation:', error);
    return false;
  }
} 