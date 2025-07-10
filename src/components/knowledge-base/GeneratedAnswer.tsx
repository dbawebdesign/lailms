import React from 'react';
import { SourceReferenceLink } from './SourceReferenceLink';
import { CitationInfo } from '@/lib/services/generation';

interface GeneratedAnswerProps {
  text: string;
  citations: CitationInfo[];
  onViewSource: (documentId: string, chunkId: string) => void;
}

interface TextPart {
  type: 'text' | 'citation';
  content: string;
  index?: number;
}

/**
 * Parses text to find citation markers [Source X]
 */
function parseTextWithCitations(text: string, citations: CitationInfo[]): TextPart[] {
  if (!text) return [];
  
  const parts: TextPart[] = [];
  const citationRegex = /\[Source\s+(\d+)\]/g;
  
  let lastIndex = 0;
  let match;
  
  while ((match = citationRegex.exec(text)) !== null) {
    // Add text before the citation
    if (match.index > lastIndex) {
      parts.push({
        type: 'text',
        content: text.substring(lastIndex, match.index)
      });
    }
    
    // Add the citation
    const citationIndex = parseInt(match[1], 10);
    parts.push({
      type: 'citation',
      content: match[0],
      index: citationIndex
    });
    
    lastIndex = match.index + match[0].length;
  }
  
  // Add any remaining text
  if (lastIndex < text.length) {
    parts.push({
      type: 'text',
      content: text.substring(lastIndex)
    });
  }
  
  return parts;
}

export function GeneratedAnswer({ text, citations, onViewSource }: GeneratedAnswerProps) {
  const parts = React.useMemo(() => {
    return parseTextWithCitations(text, citations);
  }, [text, citations]);
  
  if (!text) {
    return <div className="text-gray-500 italic">No response generated.</div>;
  }
  
  return (
    <div className="prose max-w-none">
      {parts.map((part, i) => (
        part.type === 'text' ? (
          <span key={i}>{part.content}</span>
        ) : (
          <SourceReferenceLink 
            key={i}
            citationIndex={part.index || 0}
            sourceInfo={citations.find(c => c.index === part.index) || {
              title: 'Unknown Source',
              document_id: '',
              chunk_id: ''
            }}
            onViewSource={onViewSource}
          />
        )
      ))}
    </div>
  );
} 