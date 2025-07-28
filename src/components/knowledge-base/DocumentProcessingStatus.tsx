'use client'

import React, { useState, useEffect } from 'react'
import { Badge } from '@/components/ui/badge'
import { Progress } from '@/components/ui/progress'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible'
import { 
  CheckCircle, 
  XCircle, 
  Loader2, 
  Clock, 
  AlertTriangle, 
  FileText, 
  Zap,
  Database,
  Brain,
  ChevronDown,
  ChevronRight,
  RefreshCw,
  Info
} from 'lucide-react'
import { toast } from '@/components/ui/use-toast'
import { 
  DocumentStatus, 
  ProcessingStage, 
  ProcessingProgress,
  ProcessingError,
  DocumentProcessingMetadata,
  PROCESSING_ERRORS
} from '@/types/document-processing'

interface DocumentProcessingStatusProps {
  documentId: string
  fileName: string
  status: DocumentStatus
  metadata: DocumentProcessingMetadata
  onRetry?: () => void
  showDetails?: boolean
}

export function DocumentProcessingStatus({
  documentId,
  fileName,
  status,
  metadata,
  onRetry,
  showDetails = false
}: DocumentProcessingStatusProps) {
  const [isExpanded, setIsExpanded] = useState(false)
  const [showTechnicalDetails, setShowTechnicalDetails] = useState(false)

  const progress = metadata.processing_progress
  const error = metadata.processing_error

  // Get stage-specific information
  const getStageInfo = (stage: ProcessingStage) => {
    const stageMap = {
      initializing: { 
        icon: <Clock className="h-4 w-4" />, 
        label: 'Initializing', 
        description: 'Preparing document for processing'
      },
      extracting_text: { 
        icon: <FileText className="h-4 w-4" />, 
        label: 'Extracting Text', 
        description: 'Reading and extracting text from the document'
      },
      chunking_text: { 
        icon: <Zap className="h-4 w-4" />, 
        label: 'Creating Chunks', 
        description: 'Breaking text into manageable sections'
      },
      generating_embeddings: { 
        icon: <Brain className="h-4 w-4" />, 
        label: 'Generating Embeddings', 
        description: 'Creating AI embeddings for semantic search'
      },
      storing_chunks: { 
        icon: <Database className="h-4 w-4" />, 
        label: 'Storing Data', 
        description: 'Saving processed content to database'
      },
      summarizing: { 
        icon: <FileText className="h-4 w-4" />, 
        label: 'Summarizing', 
        description: 'Creating content summaries'
      },
      finalizing: { 
        icon: <CheckCircle className="h-4 w-4" />, 
        label: 'Finalizing', 
        description: 'Completing processing and cleanup'
      }
    }
    return stageMap[stage] || { icon: <Loader2 className="h-4 w-4" />, label: 'Processing', description: 'Processing document' }
  }

  // Format time remaining
  const formatTimeRemaining = (seconds?: number) => {
    if (!seconds) return 'Calculating...'
    if (seconds < 60) return `${Math.round(seconds)}s remaining`
    const minutes = Math.floor(seconds / 60)
    const remainingSeconds = Math.round(seconds % 60)
    return `${minutes}m ${remainingSeconds}s remaining`
  }

  // Format file size
  const formatFileSize = (bytes?: number) => {
    if (!bytes) return 'Unknown size'
    const mb = bytes / (1024 * 1024)
    return `${mb.toFixed(1)} MB`
  }

  // Get status badge component
  const getStatusBadge = () => {
    switch (status) {
      case 'queued':
        return (
          <Badge variant="outline" className="bg-blue-50 text-blue-700 border-blue-200 flex items-center gap-1">
            <Clock className="h-3 w-3" />
            <span>Queued</span>
          </Badge>
        )
      case 'processing':
        const stageInfo = progress ? getStageInfo(progress.stage) : null
        return (
          <Badge variant="outline" className="bg-amber-50 text-amber-700 border-amber-200 flex items-center gap-1">
            <Loader2 className="h-3 w-3 animate-spin" />
            <span>{stageInfo?.label || 'Processing'}</span>
          </Badge>
        )
      case 'completed':
        return (
          <Badge variant="outline" className="bg-green-50 text-green-700 border-green-200 flex items-center gap-1">
            <CheckCircle className="h-3 w-3" />
            <span>Completed</span>
          </Badge>
        )
      case 'error':
        return (
          <Badge variant="outline" className="bg-red-50 text-red-700 border-red-200 flex items-center gap-1">
            <XCircle className="h-3 w-3" />
            <span>Error</span>
          </Badge>
        )
      case 'cancelled':
        return (
          <Badge variant="outline" className="bg-gray-50 text-gray-700 border-gray-200 flex items-center gap-1">
            <XCircle className="h-3 w-3" />
            <span>Cancelled</span>
          </Badge>
        )
    }
  }

  if (!showDetails) {
    // Simple badge view
    return getStatusBadge()
  }

  return (
    <Card className="w-full">
      <CardHeader className="pb-2">
        <div className="flex items-center justify-between">
          <CardTitle className="text-sm font-medium flex items-center gap-2">
            <FileText className="h-4 w-4" />
            <span className="truncate" title={fileName}>{fileName}</span>
          </CardTitle>
          {getStatusBadge()}
        </div>
      </CardHeader>
      
      <CardContent className="space-y-3">
        {/* Processing Progress */}
        {status === 'processing' && progress && (
          <div className="space-y-2">
            <div className="flex items-center justify-between text-sm">
              <div className="flex items-center gap-2">
                {getStageInfo(progress.stage).icon}
                <span className="font-medium">{getStageInfo(progress.stage).label}</span>
              </div>
              <span className="text-muted-foreground">
                {progress.percentage}%
              </span>
            </div>
            
            <Progress value={progress.percentage} className="h-2" />
            
            <div className="text-xs text-muted-foreground">
              {getStageInfo(progress.stage).description}
            </div>
            
            {progress.estimatedTimeRemaining && (
              <div className="text-xs text-muted-foreground">
                {formatTimeRemaining(progress.estimatedTimeRemaining)}
              </div>
            )}

            {/* Detailed Progress Info */}
            {progress.pagesProcessed && progress.totalPages && (
              <div className="text-xs text-muted-foreground">
                Pages: {progress.pagesProcessed} / {progress.totalPages}
              </div>
            )}
            
            {progress.chunksCreated && (
              <div className="text-xs text-muted-foreground">
                Chunks created: {progress.chunksCreated}
              </div>
            )}
          </div>
        )}

        {/* Error Display */}
        {status === 'error' && error && (
          <Alert variant="destructive">
            <AlertTriangle className="h-4 w-4" />
            <AlertDescription className="space-y-2">
              <div className="font-medium">{error.userFriendlyMessage}</div>
              
              {error.suggestedActions.length > 0 && (
                <div>
                  <div className="text-sm font-medium mb-1">Suggested actions:</div>
                  <ul className="text-sm space-y-1 ml-4">
                    {error.suggestedActions.map((action, index) => (
                      <li key={index} className="list-disc">{action}</li>
                    ))}
                  </ul>
                </div>
              )}
              
              {error.retryable && onRetry && (
                <Button 
                  variant="outline" 
                  size="sm" 
                  onClick={onRetry}
                  className="mt-2"
                >
                  <RefreshCw className="h-3 w-3 mr-1" />
                  Retry Processing
                </Button>
              )}
            </AlertDescription>
          </Alert>
        )}

        {/* Success Info */}
        {status === 'completed' && (
          <div className="space-y-2">
            <div className="flex items-center gap-2 text-sm text-green-700">
              <CheckCircle className="h-4 w-4" />
              <span>Document processed successfully</span>
            </div>
            
            {metadata.chunks_created && (
              <div className="text-xs text-muted-foreground">
                Created {metadata.chunks_created} searchable chunks
              </div>
            )}
            
            {metadata.processing_time_seconds && (
              <div className="text-xs text-muted-foreground">
                Processing time: {Math.round(metadata.processing_time_seconds)}s
              </div>
            )}
          </div>
        )}

        {/* Technical Details (Collapsible) */}
        <Collapsible open={showTechnicalDetails} onOpenChange={setShowTechnicalDetails}>
          <CollapsibleTrigger asChild>
            <Button variant="ghost" size="sm" className="text-xs text-muted-foreground p-0 h-auto">
              {showTechnicalDetails ? <ChevronDown className="h-3 w-3 mr-1" /> : <ChevronRight className="h-3 w-3 mr-1" />}
              Technical Details
            </Button>
          </CollapsibleTrigger>
          <CollapsibleContent className="space-y-2 mt-2">
            <div className="text-xs text-muted-foreground space-y-1 bg-gray-50 p-2 rounded">
              <div>Document ID: {documentId}</div>
              {metadata.file_size && <div>File size: {formatFileSize(metadata.file_size)}</div>}
              {metadata.total_pages && <div>Total pages: {metadata.total_pages}</div>}
              {metadata.extracted_text_length && <div>Text length: {metadata.extracted_text_length} characters</div>}
              {error && (
                <>
                  <div>Error code: {error.code}</div>
                  <div>Error details: {error.details || error.message}</div>
                  <div>Timestamp: {new Date(error.timestamp).toLocaleString()}</div>
                </>
              )}
            </div>
          </CollapsibleContent>
        </Collapsible>
      </CardContent>
    </Card>
  )
} 