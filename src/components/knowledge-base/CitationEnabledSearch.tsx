import React from 'react';
import { useState } from 'react';
import { SearchResultWithHighlight } from './SearchResultWithHighlight';
import { GeneratedAnswer } from './GeneratedAnswer';
import { SourceViewerModal } from './SourceViewerModal';
import { CitationInfo, generateWithCitations } from '@/lib/services/generation';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Loader2 } from 'lucide-react';

interface SearchResult {
  id: string;
  document_id: string;
  content: string;
  reference_context?: string | null;
  metadata?: Record<string, any> | null;
  section?: string | null;
  file_type?: string;
  citation_key?: string;
  similarity?: number;
}

interface CitationEnabledSearchProps {
  organisationId: string;
}

export function CitationEnabledSearch({ organisationId }: CitationEnabledSearchProps) {
  const [query, setQuery] = useState('');
  const [searchResults, setSearchResults] = useState<SearchResult[]>([]);
  const [queryId, setQueryId] = useState<string | null>(null);
  const [isSearching, setIsSearching] = useState(false);
  const [isGenerating, setIsGenerating] = useState(false);
  const [generatedAnswer, setGeneratedAnswer] = useState<string | null>(null);
  const [citations, setCitations] = useState<CitationInfo[]>([]);
  const [viewingSource, setViewingSource] = useState<{
    isOpen: boolean;
    documentId?: string;
    chunkId?: string;
  }>({ isOpen: false });
  const [error, setError] = useState<string | null>(null);
  
  const handleSearch = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!query.trim()) return;
    
    setIsSearching(true);
    setError(null);
    setSearchResults([]);
    setGeneratedAnswer(null);
    setCitations([]);
    
    try {
      const response = await fetch('/api/knowledge-base/search', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ query }),
      });
      
      if (!response.ok) {
        throw new Error(`Search failed: ${response.status}`);
      }
      
      const data = await response.json();
      
      setSearchResults(data.results || []);
      setQueryId(data.queryId || null);
      
      // Auto-generate answer if we have results
      if (data.results && data.results.length > 0) {
        handleGenerateAnswer(data.results, data.queryId);
      }
    } catch (err) {
      console.error('Search error:', err);
      setError('Failed to perform search. Please try again.');
    } finally {
      setIsSearching(false);
    }
  };
  
  const handleGenerateAnswer = async (results: SearchResult[] = searchResults, qId: string = queryId || '') => {
    if (results.length === 0) {
      setError('No search results available to generate an answer.');
      return;
    }
    
    setIsGenerating(true);
    setError(null);
    
    try {
      // Convert SearchResult to ChunkWithMetadata
      const chunks = results.slice(0, 5).map(result => ({
        id: result.id,
        document_id: result.document_id,
        content: result.content,
        citation_key: result.citation_key,
        metadata: result.metadata || undefined,
        section: result.section || undefined,
        similarity: result.similarity
      }));
      
      const generationResult = await generateWithCitations({
        prompt: query,
        retrievedChunks: chunks,
        queryId: qId,
        organisationId
      });
      
      setGeneratedAnswer(generationResult.response);
      setCitations(generationResult.citations);
    } catch (err) {
      console.error('Generation error:', err);
      setError('Failed to generate answer. Please try again.');
    } finally {
      setIsGenerating(false);
    }
  };
  
  const handleViewSource = (documentId: string, chunkId: string) => {
    setViewingSource({
      isOpen: true,
      documentId,
      chunkId
    });
  };
  
  const closeSourceViewer = () => {
    setViewingSource({ isOpen: false });
  };
  
  return (
    <div>
      <form onSubmit={handleSearch} className="mb-8">
        <div className="flex gap-2">
          <Input
            type="text"
            placeholder="Search your knowledge base"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            className="flex-grow"
            disabled={isSearching}
          />
          <Button type="submit" disabled={isSearching || !query.trim()}>
            {isSearching ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : 'Search'}
          </Button>
        </div>
      </form>
      
      {error && (
        <div className="bg-red-100 text-red-800 p-3 rounded mb-6">
          {error}
        </div>
      )}
      
      {/* Generated Answer Section */}
      {(generatedAnswer || isGenerating) && (
        <div className="mb-8 bg-blue-50 p-4 rounded-lg border border-blue-200">
          <h2 className="text-xl font-semibold mb-3">Answer</h2>
          
          {isGenerating ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="mr-2 h-5 w-5 animate-spin text-blue-600" />
              <span className="text-blue-600">Generating answer...</span>
            </div>
          ) : (
            <GeneratedAnswer 
              text={generatedAnswer || ''} 
              citations={citations}
              onViewSource={handleViewSource}
            />
          )}
        </div>
      )}
      
      {/* Search Results Section */}
      {searchResults.length > 0 && (
        <div>
          <h2 className="text-xl font-semibold mb-3">Search Results</h2>
          <div className="space-y-4">
            {searchResults.map((result) => (
              <SearchResultWithHighlight
                key={result.id}
                result={result}
                query={query}
                onViewDocument={handleViewSource}
              />
            ))}
          </div>
        </div>
      )}
      
      {/* Source Viewer Modal */}
      <SourceViewerModal
        isOpen={viewingSource.isOpen}
        onClose={closeSourceViewer}
        documentId={viewingSource.documentId}
        chunkId={viewingSource.chunkId}
      />
    </div>
  );
} 