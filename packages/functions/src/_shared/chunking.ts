/**
 * Chunking utility for document processing
 * Splits text into semantically meaningful chunks while respecting token limits
 */

// Approximation of token count based on GPT tokenization patterns
// More accurate than character counting, close enough for chunking purposes
function estimateTokenCount(text: string): number {
  // GPT models tokenize roughly at ~4 chars per token on average English text
  // This is an approximation - we add a 10% buffer to be safe
  return Math.ceil(text.length / 4 * 1.1);
}

// Interface for chunk objects
export interface TextChunk {
  content: string;
  tokenCount: number;
  metadata?: Record<string, any>;
}

// Main chunking options interface
export interface ChunkingOptions {
  maxTokensPerChunk: number;
  overlapTokens?: number;
  preserveParagraphs?: boolean;
  preserveSections?: boolean;
}

/**
 * Splits text into chunks optimized for embedding and retrieval
 * Uses a recursive approach to preserve semantic units
 */
export function chunkText(
  text: string,
  options: ChunkingOptions = { maxTokensPerChunk: 1000, overlapTokens: 50, preserveParagraphs: true, preserveSections: true }
): TextChunk[] {
  // Default options
  const maxTokens = options.maxTokensPerChunk || 1000;
  const overlapTokens = options.overlapTokens || 50;
  const preserveParagraphs = options.preserveParagraphs !== false;
  const preserveSections = options.preserveSections !== false;

  // Normalize line endings
  const normalizedText = text.replace(/\r\n/g, '\n');
  
  const chunks: TextChunk[] = [];
  
  // Try to split by sections first (if option enabled)
  if (preserveSections) {
    // Pattern to identify section headers (markdown and other common formats)
    const sectionPattern = /(?:^|\n)(?:#{1,6}|\*\*|\[\d+\])\s+.+\n/g;
    const sections = normalizedText.split(sectionPattern);
    const headers = normalizedText.match(sectionPattern) || [];
    
    if (sections.length > 1) {
      // Process each section, attaching the section header to its content
      for (let i = 0; i < sections.length; i++) {
        const header = i === 0 ? '' : headers[i - 1];
        const sectionText = header + sections[i];
        
        // Only process non-empty sections
        if (sectionText.trim()) {
          const sectionTokenCount = estimateTokenCount(sectionText);
          
          if (sectionTokenCount <= maxTokens) {
            // Section fits in a single chunk
            chunks.push({
              content: sectionText.trim(),
              tokenCount: sectionTokenCount,
              metadata: { isSection: true, sectionIndex: i }
            });
          } else {
            // Section is too large, recursively chunk it (without section preservation)
            const sectionOptions = { ...options, preserveSections: false };
            const sectionChunks = chunkText(sectionText, sectionOptions);
            chunks.push(...sectionChunks);
          }
        }
      }
      return chunks;
    }
  }
  
  // Split by paragraphs if section splitting didn't apply or produce chunks
  if (preserveParagraphs) {
    // Split text into paragraphs (double newlines)
    const paragraphs = normalizedText.split(/\n\s*\n/);
    
    if (paragraphs.length > 1) {
      let currentChunk = '';
      let currentTokenCount = 0;
      
      for (let i = 0; i < paragraphs.length; i++) {
        const paragraph = paragraphs[i].trim();
        if (!paragraph) continue;
        
        const paragraphTokens = estimateTokenCount(paragraph);
        
        // If paragraph is too large to fit even on its own, we'll chunk it further later
        if (paragraphTokens > maxTokens) {
          // Save the current chunk if it's not empty
          if (currentChunk) {
            chunks.push({
              content: currentChunk.trim(),
              tokenCount: currentTokenCount,
              metadata: { containsParagraphs: true }
            });
            currentChunk = '';
            currentTokenCount = 0;
          }
          
          // Process this large paragraph separately
          const subChunks = splitTextIntoChunks(paragraph, maxTokens, overlapTokens);
          chunks.push(...subChunks);
          continue;
        }
        
        // Check if adding this paragraph would exceed the limit
        if (currentTokenCount + paragraphTokens > maxTokens) {
          // Save current chunk and start a new one
          chunks.push({
            content: currentChunk.trim(),
            tokenCount: currentTokenCount,
            metadata: { containsParagraphs: true }
          });
          currentChunk = paragraph;
          currentTokenCount = paragraphTokens;
        } else {
          // Add paragraph to current chunk
          const separator = currentChunk ? '\n\n' : '';
          currentChunk += separator + paragraph;
          currentTokenCount += paragraphTokens;
        }
      }
      
      // Add the last chunk if there's content
      if (currentChunk) {
        chunks.push({
          content: currentChunk.trim(),
          tokenCount: currentTokenCount,
          metadata: { containsParagraphs: true }
        });
      }
      
      return chunks;
    }
  }
  
  // If we get here, either the text has no clear structure or 
  // we didn't enable structure preservation - split by tokens directly
  return splitTextIntoChunks(normalizedText, maxTokens, overlapTokens);
}

/**
 * Fallback chunking method that splits text based solely on token limits
 * This is used when more semantic approaches aren't applicable
 */
function splitTextIntoChunks(
  text: string, 
  maxTokens: number, 
  overlapTokens: number
): TextChunk[] {
  const chunks: TextChunk[] = [];
  const textLength = text.length;
  
  // Simple approximation: ~4 chars per token for English text
  // This is imprecise but good enough for chunking purposes
  const charsPerChunk = Math.floor(maxTokens * 4 * 0.9); // 10% margin for safety
  const overlapChars = Math.floor(overlapTokens * 4);
  
  // Short text fits in one chunk
  if (textLength <= charsPerChunk) {
    const tokenCount = estimateTokenCount(text);
    return [{
      content: text.trim(),
      tokenCount: tokenCount,
      metadata: { method: 'single' }
    }];
  }
  
  let startPos = 0;
  
  while (startPos < textLength) {
    let endPos = Math.min(startPos + charsPerChunk, textLength);
    
    // Try to end at a sentence boundary if possible
    if (endPos < textLength) {
      // Look for sentence boundaries (., !, ?) followed by space or newline
      const sentenceEndMatch = text.substring(endPos - 100, endPos + 100).match(/[.!?]\s+/);
      if (sentenceEndMatch && sentenceEndMatch.index !== undefined) {
        const matchPosition = endPos - 100 + sentenceEndMatch.index + 1; // +1 to include the punctuation
        // Only adjust if the sentence boundary is not too far back or forward
        if (matchPosition > startPos + charsPerChunk / 2 && matchPosition < endPos + 100) {
          endPos = matchPosition + 1; // Include the space after punctuation
        }
      } else {
        // If no sentence boundary, try to end at a word boundary
        const lastSpace = text.lastIndexOf(' ', endPos);
        if (lastSpace > startPos + charsPerChunk / 2) {
          endPos = lastSpace + 1; // Include the space
        }
      }
    }
    
    const chunk = text.substring(startPos, endPos).trim();
    const tokenCount = estimateTokenCount(chunk);
    
    chunks.push({
      content: chunk,
      tokenCount,
      metadata: { 
        method: 'sliding', 
        startPosition: startPos, 
        endPosition: endPos 
      }
    });
    
    // Move start position forward, accounting for overlap
    startPos = endPos - overlapChars;
    
    // Avoid tiny chunks at the end
    if (textLength - startPos < charsPerChunk / 4) {
      const finalChunk = text.substring(startPos).trim();
      const finalTokenCount = estimateTokenCount(finalChunk);
      
      if (finalChunk) {
        chunks.push({
          content: finalChunk,
          tokenCount: finalTokenCount,
          metadata: { 
            method: 'final', 
            startPosition: startPos, 
            endPosition: textLength 
          }
        });
      }
      break;
    }
  }
  
  return chunks;
} 