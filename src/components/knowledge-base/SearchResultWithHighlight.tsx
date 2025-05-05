import React from 'react';
import { ExternalLink } from 'lucide-react';

interface SearchResultProps {
  result: {
    id: string;
    document_id: string;
    content: string;
    reference_context?: string | null;
    metadata?: Record<string, any> | null;
    section?: string | null;
    file_type?: string;
    citation_key?: string;
  };
  query: string;
  onViewDocument: (documentId: string, chunkId: string) => void;
}

/**
 * Highlights search terms in text
 */
function highlightMatches(content: string, query: string): string {
  if (!content || !query) return content;
  
  // Split the query into terms and remove common words
  const terms = query
    .toLowerCase()
    .split(/\s+/)
    .filter(term => term.length > 3 && !['the', 'and', 'that', 'with', 'for', 'from'].includes(term));
  
  if (terms.length === 0) return content;

  // Use pre-extracted context if available, otherwise use full content
  const textToHighlight = content;
  
  // Escape special regex characters in terms
  const escapedTerms = terms.map(term => 
    term.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
  );

  // Create regex to match terms (case insensitive)
  const regex = new RegExp(`(${escapedTerms.join('|')})`, 'gi');
  
  // Replace matches with marked version
  return textToHighlight.replace(regex, '<mark class="bg-yellow-200 px-0.5 rounded">$1</mark>');
}

export function SearchResultWithHighlight({ result, query, onViewDocument }: SearchResultProps) {
  // Use the reference context if available, otherwise use the full content
  const displayContent = result.reference_context || result.content;
  
  // Whether to show the "show more" option
  const isContentTruncated = (result.reference_context && result.content.length > result.reference_context.length);
  
  // Find and highlight matching text segments
  const highlightedContent = highlightMatches(displayContent, query);
  
  // Get document title from metadata
  const documentTitle = result.metadata?.documentTitle || 'Untitled Document';
  
  return (
    <div className="border rounded-lg p-4 mb-4 bg-white shadow-sm hover:shadow-md transition-shadow">
      <div className="flex justify-between items-start mb-2">
        <h3 className="text-lg font-medium text-blue-800 truncate max-w-[80%]">
          {documentTitle}
        </h3>
        <span className="text-sm text-gray-500">
          {result.file_type || 'Document'}
        </span>
      </div>
      
      {result.section && (
        <div className="text-sm text-gray-700 mb-2">
          Section: {result.section}
        </div>
      )}
      
      <div className="prose-sm mt-3">
        <div 
          dangerouslySetInnerHTML={{ __html: highlightedContent }} 
          className="text-gray-800"
        />
      </div>
      
      <div className="mt-4 flex justify-between items-center">
        <button
          onClick={() => onViewDocument(result.document_id, result.id)}
          className="text-sm text-blue-600 hover:text-blue-800"
        >
          View in context
        </button>
        
        <div className="flex items-center space-x-2 text-sm text-gray-500">
          {result.metadata?.page_number && (
            <span>Page {result.metadata.page_number}</span>
          )}
          
          {result.metadata?.video_id && result.metadata?.offset && (
            <a
              href={`https://youtube.com/watch?v=${result.metadata.video_id}&t=${result.metadata.offset}`}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center text-red-600 hover:text-red-800"
            >
              {formatTimestamp(parseFloat(result.metadata.offset))}
              <ExternalLink className="ml-1 h-3 w-3" />
            </a>
          )}
        </div>
      </div>
    </div>
  );
}

function formatTimestamp(seconds: number): string {
  const minutes = Math.floor(seconds / 60);
  const remainingSeconds = Math.floor(seconds % 60);
  return `${minutes}:${remainingSeconds.toString().padStart(2, '0')}`;
} 