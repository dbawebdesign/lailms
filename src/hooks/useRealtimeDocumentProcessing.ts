import { useState, useEffect, useCallback } from 'react';
import { realtimeService, DocumentProcessingUpdate } from '@/lib/services/realtime-subscriptions';
import { createClient } from '@/lib/supabase/client';

export interface DocumentProcessingState {
  status: 'uploading' | 'processing' | 'completed' | 'failed' | 'idle';
  progress: number;
  error: string | null;
  isProcessing: boolean;
  fileName?: string;
  fileSize?: number;
}

/**
 * Hook for real-time document processing monitoring
 * Replaces the existing useDocumentProcessingStatus polling hook
 */
export function useRealtimeDocumentProcessing(documentId: string | null) {
  const [state, setState] = useState<DocumentProcessingState>({
    status: 'idle',
    progress: 0,
    error: null,
    isProcessing: false
  });

  const supabase = createClient();

  // Fetch initial document state
  const fetchInitialState = useCallback(async () => {
    if (!documentId) {
      setState(prev => ({ ...prev, status: 'idle', isProcessing: false }));
      return;
    }

    try {
      const { data, error } = await supabase
        .from('knowledge_base_files')
        .select('status, processing_progress, error_message, filename, file_size')
        .eq('id', documentId)
        .single();

      if (error) throw error;

      setState({
        status: data.status || 'idle',
        progress: data.processing_progress || 0,
        error: data.error_message,
        isProcessing: ['uploading', 'processing'].includes(data.status),
        fileName: data.filename,
        fileSize: data.file_size
      });

    } catch (error) {
      console.error('Failed to fetch document processing state:', error);
      setState(prev => ({
        ...prev,
        error: error instanceof Error ? error.message : 'Failed to load document state',
        isProcessing: false
      }));
    }
  }, [documentId, supabase]);

  // Set up realtime subscription
  useEffect(() => {
    if (!documentId) return;

    const unsubscribe = realtimeService.subscribeToDocumentProcessing(documentId, (payload) => {
      const update = payload.new as any; // The actual database row structure
      
      setState(prev => ({
        ...prev,
        status: update.status || prev.status,
        progress: update.processing_progress || prev.progress,
        error: update.error_message || null,
        isProcessing: ['uploading', 'processing'].includes(update.status),
        fileName: update.filename || prev.fileName,
        fileSize: update.file_size || prev.fileSize
      }));
    });

    // Fetch initial state
    fetchInitialState();

    return unsubscribe;
  }, [documentId, fetchInitialState]);

  const resetState = useCallback(() => {
    setState({
      status: 'idle',
      progress: 0,
      error: null,
      isProcessing: false
    });
  }, []);

  return {
    ...state,
    resetState,
    refreshState: fetchInitialState
  };
}

/**
 * Hook for monitoring multiple document uploads in batch
 */
export function useRealtimeBatchDocumentProcessing(documentIds: string[]) {
  const [documents, setDocuments] = useState<Map<string, DocumentProcessingState>>(new Map());
  const [overallProgress, setOverallProgress] = useState(0);
  const [isAnyProcessing, setIsAnyProcessing] = useState(false);
  const [hasErrors, setHasErrors] = useState(false);

  const supabase = createClient();

  // Fetch initial states for all documents
  const fetchInitialStates = useCallback(async () => {
    if (documentIds.length === 0) {
      setDocuments(new Map());
      setOverallProgress(0);
      setIsAnyProcessing(false);
      setHasErrors(false);
      return;
    }

    try {
      const { data, error } = await supabase
        .from('knowledge_base_files')
        .select('id, status, processing_progress, error_message, filename, file_size')
        .in('id', documentIds);

      if (error) throw error;

      const newDocuments = new Map<string, DocumentProcessingState>();
      
      for (const doc of data || []) {
        newDocuments.set(doc.id, {
          status: doc.status || 'idle',
          progress: doc.processing_progress || 0,
          error: doc.error_message,
          isProcessing: ['uploading', 'processing'].includes(doc.status),
          fileName: doc.filename,
          fileSize: doc.file_size
        });
      }

      setDocuments(newDocuments);

      // Calculate overall progress
      const totalProgress = Array.from(newDocuments.values())
        .reduce((sum, doc) => sum + doc.progress, 0);
      const avgProgress = newDocuments.size > 0 ? totalProgress / newDocuments.size : 0;
      setOverallProgress(Math.round(avgProgress));

      // Check if any are processing or have errors
      const anyProcessing = Array.from(newDocuments.values()).some(doc => doc.isProcessing);
      const anyErrors = Array.from(newDocuments.values()).some(doc => doc.error);
      
      setIsAnyProcessing(anyProcessing);
      setHasErrors(anyErrors);

    } catch (error) {
      console.error('Failed to fetch document processing states:', error);
    }
  }, [documentIds, supabase]);

  // Set up realtime subscriptions for all documents
  useEffect(() => {
    if (documentIds.length === 0) return;

    const unsubscribeFunctions = documentIds.map(docId => 
      realtimeService.subscribeToDocumentProcessing(docId, (payload) => {
        const update = payload.new as any;
        
        setDocuments(prev => {
          const newMap = new Map(prev);
          const currentState = newMap.get(docId) || {
            status: 'idle' as const,
            progress: 0,
            error: null,
            isProcessing: false
          };

          newMap.set(docId, {
            ...currentState,
            status: update.status || currentState.status,
            progress: update.processing_progress || currentState.progress,
            error: update.error_message || null,
            isProcessing: ['uploading', 'processing'].includes(update.status),
            fileName: update.filename || currentState.fileName,
            fileSize: update.file_size || currentState.fileSize
          });

          return newMap;
        });
      })
    );

    // Fetch initial states
    fetchInitialStates();

    // Cleanup subscriptions
    return () => {
      unsubscribeFunctions.forEach(unsubscribe => unsubscribe());
    };
  }, [documentIds, fetchInitialStates]);

  // Update derived states when documents change
  useEffect(() => {
    const docStates = Array.from(documents.values());
    
    // Calculate overall progress
    const totalProgress = docStates.reduce((sum, doc) => sum + doc.progress, 0);
    const avgProgress = docStates.length > 0 ? totalProgress / docStates.length : 0;
    setOverallProgress(Math.round(avgProgress));

    // Check processing and error states
    setIsAnyProcessing(docStates.some(doc => doc.isProcessing));
    setHasErrors(docStates.some(doc => doc.error));
  }, [documents]);

  const getDocumentState = useCallback((documentId: string): DocumentProcessingState | null => {
    return documents.get(documentId) || null;
  }, [documents]);

  const resetAll = useCallback(() => {
    setDocuments(new Map());
    setOverallProgress(0);
    setIsAnyProcessing(false);
    setHasErrors(false);
  }, []);

  return {
    documents: Object.fromEntries(documents),
    overallProgress,
    isAnyProcessing,
    hasErrors,
    getDocumentState,
    resetAll,
    refreshStates: fetchInitialStates
  };
}