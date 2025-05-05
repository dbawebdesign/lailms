import React from 'react';
import { 
  Dialog, 
  DialogContent, 
  DialogHeader, 
  DialogTitle,
  DialogDescription,
  DialogFooter
} from "../ui/dialog";
import { Button } from "../ui/button";
import { Skeleton } from "../ui/skeleton";
import { ExternalLink } from 'lucide-react';

interface SourceData {
  chunk: {
    id: string;
    content: string;
    section?: string | null;
    sectionSummary?: string | null;
    chunkSummary?: string | null;
    citationKey?: string | null;
    metadata?: Record<string, any> | null;
  };
  documentId: string;
  documentTitle: string;
  documentType?: string;
  previousChunk?: {
    id: string;
    content: string;
    section?: string | null;
  } | null;
  nextChunk?: {
    id: string;
    content: string;
    section?: string | null;
  } | null;
  timestamp?: {
    videoId: string;
    timestamp: number;
    formattedTime: string;
  } | null;
}

interface SourceViewerModalProps {
  isOpen: boolean;
  onClose: () => void;
  documentId?: string;
  chunkId?: string;
}

function LoadingSpinner() {
  return (
    <div className="flex flex-col items-center justify-center p-8">
      <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500"></div>
      <p className="mt-2 text-sm text-gray-500">Loading source content...</p>
    </div>
  );
}

function SkeletonLoading() {
  return (
    <div className="space-y-4 p-4">
      <Skeleton className="h-6 w-3/4" />
      <Skeleton className="h-4 w-full" />
      <Skeleton className="h-4 w-full" />
      <Skeleton className="h-4 w-2/3" />
    </div>
  );
}

function formatTimestamp(seconds: number): string {
  const minutes = Math.floor(seconds / 60);
  const remainingSeconds = Math.floor(seconds % 60);
  return `${minutes}:${remainingSeconds.toString().padStart(2, '0')}`;
}

export function SourceViewerModal({ 
  isOpen, 
  onClose, 
  documentId, 
  chunkId 
}: SourceViewerModalProps) {
  const [sourceData, setSourceData] = React.useState<SourceData | null>(null);
  const [loading, setLoading] = React.useState<boolean>(true);
  const [error, setError] = React.useState<string | null>(null);
  
  React.useEffect(() => {
    if (isOpen && documentId && chunkId) {
      setLoading(true);
      setError(null);
      
      fetch(`/api/knowledge-base/source-context?documentId=${documentId}&chunkId=${chunkId}`)
        .then(res => {
          if (!res.ok) {
            throw new Error(`Failed to fetch source data: ${res.status}`);
          }
          return res.json();
        })
        .then(data => {
          setSourceData(data);
          setLoading(false);
        })
        .catch(err => {
          console.error('Error fetching source data:', err);
          setError('Failed to load source data. Please try again.');
          setLoading(false);
        });
    } else {
      // Reset when modal closes
      if (!isOpen) {
        setSourceData(null);
      }
    }
  }, [isOpen, documentId, chunkId]);
  
  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-4xl max-h-[90vh] flex flex-col">
        <DialogHeader>
          <DialogTitle className="text-xl flex items-center justify-between">
            <span className="truncate">
              {loading ? 'Loading source...' : sourceData?.documentTitle || 'Source Document'}
            </span>
            {!loading && sourceData?.documentType && (
              <span className="text-sm font-normal bg-gray-100 px-2 py-1 rounded">
                {sourceData.documentType}
              </span>
            )}
          </DialogTitle>
          {!loading && sourceData?.chunk?.section && (
            <DialogDescription className="text-sm text-blue-600">
              Section: {sourceData.chunk.section}
            </DialogDescription>
          )}
        </DialogHeader>
        
        {loading ? (
          <SkeletonLoading />
        ) : error ? (
          <div className="text-center p-4 text-red-500">
            {error}
            <Button 
              variant="outline" 
              onClick={onClose} 
              className="mt-4"
            >
              Close
            </Button>
          </div>
        ) : (
          <div className="overflow-auto flex-grow p-4 bg-gray-50 rounded">
            {sourceData?.chunk?.chunkSummary && (
              <div className="bg-blue-50 p-3 border-l-4 border-blue-300 mb-6 text-sm">
                <h4 className="font-medium text-blue-800 mb-1">Summary</h4>
                <p>{sourceData.chunk.chunkSummary}</p>
              </div>
            )}
            
            <div className="prose max-w-none">
              {/* Show previous chunk for context */}
              {sourceData?.previousChunk && (
                <div className="text-gray-500 mb-4 border-l-2 border-gray-300 pl-4 text-sm">
                  {sourceData.previousChunk.content}
                </div>
              )}
              
              {/* Highlight the cited chunk */}
              <div className="bg-yellow-50 p-4 border-l-4 border-yellow-400 my-4">
                {sourceData?.chunk?.content}
              </div>
              
              {/* Show following context */}
              {sourceData?.nextChunk && (
                <div className="text-gray-500 mt-4 border-l-2 border-gray-300 pl-4 text-sm">
                  {sourceData.nextChunk.content}
                </div>
              )}
            </div>
          </div>
        )}
        
        <DialogFooter className="flex items-center justify-between">
          {/* YouTube-specific timestamp link if applicable */}
          {!loading && sourceData?.timestamp && (
            <a 
              href={`https://youtube.com/watch?v=${sourceData.timestamp.videoId}&t=${sourceData.timestamp.timestamp}`}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-1 text-red-600 hover:text-red-800 text-sm"
            >
              Watch on YouTube at {sourceData.timestamp.formattedTime}
              <ExternalLink className="h-3 w-3" />
            </a>
          )}
          
          <Button 
            variant="outline" 
            onClick={onClose} 
            className="ml-auto"
          >
            Close
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
} 