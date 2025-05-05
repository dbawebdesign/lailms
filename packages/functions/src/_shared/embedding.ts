/**
 * Embedding generation service for document chunks
 * Uses OpenAI's text-embedding-3-small model for fast, high-quality embeddings
 */

import { TextChunk } from './chunking';

// Embedding parameters
const EMBEDDING_MODEL = 'text-embedding-3-small';
const EMBEDDING_DIMENSIONS = 1536;
const EMBEDDING_MAX_BATCH_SIZE = 1000; // OpenAI allows up to 2048 inputs per batch
const EMBEDDING_MAX_TOKENS = 8192; // Model's context window

// Interface for embedding request/response
interface EmbeddingInput {
  input: string[];
  model: string;
  dimensions?: number;
  encoding_format?: 'float' | 'base64';
}

interface EmbeddingResponse {
  data: {
    embedding: number[];
    index: number;
    object: string;
  }[];
  model: string;
  object: string;
  usage: {
    prompt_tokens: number;
    total_tokens: number;
  };
}

interface ChunkWithEmbedding extends TextChunk {
  embedding: number[];
}

/**
 * Generates embeddings for an array of text chunks
 * Automatically batches requests for efficiency
 */
export async function generateEmbeddings(
  chunks: TextChunk[],
  apiKey: string,
  dimensions: number = EMBEDDING_DIMENSIONS
): Promise<ChunkWithEmbedding[]> {
  if (!chunks.length) return [];
  
  // Clone chunks to avoid modifying the original objects
  const chunksToEmbed = [...chunks];
  const results: ChunkWithEmbedding[] = [];
  
  // Process in batches for efficiency
  while (chunksToEmbed.length > 0) {
    // Estimate the batch size based on token counts
    const batchChunks: TextChunk[] = [];
    let batchTokenCount = 0;
    
    // Keep adding chunks until we approach token limit or max batch size
    while (chunksToEmbed.length > 0 && 
           batchChunks.length < EMBEDDING_MAX_BATCH_SIZE &&
           batchTokenCount + chunksToEmbed[0].tokenCount < EMBEDDING_MAX_TOKENS) {
      const chunk = chunksToEmbed.shift()!;
      batchChunks.push(chunk);
      batchTokenCount += chunk.tokenCount;
    }
    
    if (batchChunks.length === 0) {
      // Handle case where a single chunk exceeds token limits
      const largeChunk = chunksToEmbed.shift()!;
      console.warn(`Chunk exceeds token limit (${largeChunk.tokenCount} tokens). Truncating.`);
      
      // Take first ~8000 tokens worth of content
      const truncatedContent = largeChunk.content.substring(0, 8000 * 4);
      batchChunks.push({
        ...largeChunk,
        content: truncatedContent,
        tokenCount: Math.min(largeChunk.tokenCount, EMBEDDING_MAX_TOKENS - 100),
        metadata: { ...largeChunk.metadata, truncated: true }
      });
    }
    
    // Process this batch
    try {
      const batchResults = await fetchEmbeddingsFromOpenAI(
        batchChunks.map(c => c.content),
        apiKey,
        dimensions
      );
      
      // Combine original chunks with their embeddings
      for (let i = 0; i < batchChunks.length; i++) {
        results.push({
          ...batchChunks[i],
          embedding: batchResults[i]
        });
      }
    } catch (error) {
      console.error('Error generating embeddings:', error);
      // Add chunks without embeddings to indicate the error
      results.push(...batchChunks.map(chunk => ({
        ...chunk,
        embedding: [],
        metadata: { ...chunk.metadata, embedding_error: String(error) }
      })));
    }
  }
  
  return results;
}

/**
 * Makes a request to OpenAI's embedding API for a batch of texts
 */
async function fetchEmbeddingsFromOpenAI(
  texts: string[],
  apiKey: string,
  dimensions: number = EMBEDDING_DIMENSIONS
): Promise<number[][]> {
  const url = 'https://api.openai.com/v1/embeddings';
  
  const requestBody: EmbeddingInput = {
    input: texts,
    model: EMBEDDING_MODEL,
    dimensions
  };
  
  const response = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${apiKey}`,
    },
    body: JSON.stringify(requestBody),
  });
  
  if (!response.ok) {
    const errorBody = await response.text();
    throw new Error(`OpenAI API error (${response.status}): ${errorBody}`);
  }
  
  const result: EmbeddingResponse = await response.json();
  
  // Sort by index to ensure correct order
  const sortedEmbeddings = result.data
    .sort((a, b) => a.index - b.index)
    .map(item => item.embedding);
  
  return sortedEmbeddings;
} 