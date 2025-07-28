'use client'

import { useState, useEffect, useCallback } from 'react'
import { supabase } from '@/utils/supabase/browser'
import { 
  DocumentStatus, 
  DocumentProcessingMetadata,
  DocumentWithProcessingInfo
} from '@/types/document-processing'

interface UseDocumentProcessingStatusProps {
  documentId?: string
  organisationId?: string
  autoRefresh?: boolean
  refreshInterval?: number
}

interface UseDocumentProcessingStatusResult {
  documents: DocumentWithProcessingInfo[]
  loading: boolean
  error: string | null
  refetch: () => Promise<void>
  retryProcessing: (documentId: string) => Promise<void>
  cancelProcessing: (documentId: string) => Promise<void>
}

export function useDocumentProcessingStatus({
  documentId,
  organisationId,
  autoRefresh = true,
  refreshInterval = 2000
}: UseDocumentProcessingStatusProps = {}): UseDocumentProcessingStatusResult {
  const [documents, setDocuments] = useState<DocumentWithProcessingInfo[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  // Fetch documents
  const fetchDocuments = useCallback(async () => {
    try {
      setLoading(true)
      setError(null)

      let query = supabase
        .from('documents')
        .select('id, file_name, status, metadata, created_at, updated_at')
        .order('created_at', { ascending: false })

      // Filter by specific document if provided
      if (documentId) {
        query = query.eq('id', documentId)
      }

      // Filter by organisation if provided
      if (organisationId) {
        query = query.eq('organisation_id', organisationId)
      }

      const { data, error: fetchError } = await query

      if (fetchError) {
        throw fetchError
      }

      const documentsWithProcessingInfo: DocumentWithProcessingInfo[] = (data || []).map(doc => ({
        id: doc.id,
        file_name: doc.file_name,
        status: doc.status as DocumentStatus,
        metadata: (doc.metadata as DocumentProcessingMetadata) || {},
        created_at: doc.created_at,
        updated_at: doc.updated_at
      }))

      setDocuments(documentsWithProcessingInfo)
    } catch (err) {
      console.error('Error fetching documents:', err)
      setError(err instanceof Error ? err.message : 'Failed to fetch documents')
    } finally {
      setLoading(false)
    }
  }, [documentId, organisationId])

  // Initial fetch
  useEffect(() => {
    fetchDocuments()
  }, [fetchDocuments])

  // Set up real-time subscriptions
  useEffect(() => {
    if (!autoRefresh) return

    let subscription: any = null

    const setupRealtimeSubscription = async () => {
      try {
        // Subscribe to document table changes
        subscription = supabase
          .channel('document-processing-updates')
          .on(
            'postgres_changes',
            {
              event: '*',
              schema: 'public',
              table: 'documents',
              filter: organisationId ? `organisation_id=eq.${organisationId}` : undefined
            },
            (payload) => {
              console.log('Document update received:', payload)
              
              if (payload.eventType === 'UPDATE') {
                const updatedDoc = payload.new
                setDocuments(prev => 
                  prev.map(doc => 
                    doc.id === updatedDoc.id 
                      ? {
                          ...doc,
                          status: updatedDoc.status as DocumentStatus,
                          metadata: (updatedDoc.metadata as DocumentProcessingMetadata) || {},
                          updated_at: updatedDoc.updated_at
                        }
                      : doc
                  )
                )
              } else if (payload.eventType === 'INSERT') {
                const newDoc = payload.new
                const newDocWithProcessingInfo: DocumentWithProcessingInfo = {
                  id: newDoc.id,
                  file_name: newDoc.file_name,
                  status: newDoc.status as DocumentStatus,
                  metadata: (newDoc.metadata as DocumentProcessingMetadata) || {},
                  created_at: newDoc.created_at,
                  updated_at: newDoc.updated_at
                }
                setDocuments(prev => [newDocWithProcessingInfo, ...prev])
              } else if (payload.eventType === 'DELETE') {
                setDocuments(prev => prev.filter(doc => doc.id !== payload.old.id))
              }
            }
          )
          .subscribe()

      } catch (err) {
        console.error('Error setting up real-time subscription:', err)
      }
    }

    setupRealtimeSubscription()

    // Fallback polling for cases where real-time doesn't work
    let pollInterval: NodeJS.Timeout | null = null
    if (refreshInterval > 0) {
      pollInterval = setInterval(() => {
        // Only poll if we have processing documents
        const hasProcessingDocs = documents.some(doc => doc.status === 'processing' || doc.status === 'queued')
        if (hasProcessingDocs) {
          fetchDocuments()
        }
      }, refreshInterval)
    }

    return () => {
      if (subscription) {
        supabase.removeChannel(subscription)
      }
      if (pollInterval) {
        clearInterval(pollInterval)
      }
    }
  }, [autoRefresh, refreshInterval, organisationId, documents, fetchDocuments])

  // Retry processing for a failed document
  const retryProcessing = useCallback(async (docId: string) => {
    try {
      const response = await fetch('/api/knowledge-base/retry-processing', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ documentId: docId }),
      })

      if (!response.ok) {
        const errorData = await response.json()
        throw new Error(errorData.error || 'Failed to retry processing')
      }

      // Update local state to reflect retry
      setDocuments(prev =>
        prev.map(doc =>
          doc.id === docId
            ? {
                ...doc,
                status: 'queued' as DocumentStatus,
                metadata: {
                  ...doc.metadata,
                  retry_count: (doc.metadata.retry_count || 0) + 1,
                  last_retry_at: new Date().toISOString(),
                  processing_error: undefined // Clear previous error
                }
              }
            : doc
        )
      )

      // Refetch to get latest data
      await fetchDocuments()
      
    } catch (err) {
      console.error('Error retrying processing:', err)
      setError(err instanceof Error ? err.message : 'Failed to retry processing')
      throw err
    }
  }, [fetchDocuments])

  // Cancel processing for a document
  const cancelProcessing = useCallback(async (docId: string) => {
    try {
      const response = await fetch('/api/knowledge-base/cancel-processing', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ documentId: docId }),
      })

      if (!response.ok) {
        const errorData = await response.json()
        throw new Error(errorData.error || 'Failed to cancel processing')
      }

      // Update local state
      setDocuments(prev =>
        prev.map(doc =>
          doc.id === docId
            ? { ...doc, status: 'cancelled' as DocumentStatus }
            : doc
        )
      )

    } catch (err) {
      console.error('Error cancelling processing:', err)
      setError(err instanceof Error ? err.message : 'Failed to cancel processing')
      throw err
    }
  }, [])

  return {
    documents,
    loading,
    error,
    refetch: fetchDocuments,
    retryProcessing,
    cancelProcessing
  }
} 