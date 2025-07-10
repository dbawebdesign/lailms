import React from 'react';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger
} from "../ui/tooltip";

interface SourceReferenceLinkProps {
  citationIndex: number;
  sourceInfo: {
    title: string;
    section?: string | null;
    document_id: string;
    chunk_id: string;
  };
  onViewSource: (documentId: string, chunkId: string) => void;
}

export function SourceReferenceLink({ 
  citationIndex, 
  sourceInfo, 
  onViewSource 
}: SourceReferenceLinkProps) {
  return (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger asChild>
          <button 
            className="inline-flex items-center px-1 py-0.5 ml-1 bg-blue-100 text-blue-800 text-xs font-medium rounded hover:bg-blue-200"
            onClick={() => onViewSource(sourceInfo.document_id, sourceInfo.chunk_id)}
            aria-label={`View source ${citationIndex}`}
          >
            [{citationIndex}]
          </button>
        </TooltipTrigger>
        <TooltipContent className="max-w-md p-2">
          <div className="text-sm">
            <p className="font-medium">{sourceInfo.title}</p>
            {sourceInfo.section && (
              <p className="text-gray-500 text-xs mt-1">Section: {sourceInfo.section}</p>
            )}
            <p className="text-xs text-blue-500 mt-1">Click to view source</p>
          </div>
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
} 