// Document Processing Status & Progress Types
export type DocumentStatus = 'queued' | 'processing' | 'completed' | 'error' | 'cancelled'

export type ProcessingStage = 
  | 'initializing'
  | 'extracting_text' 
  | 'chunking_text'
  | 'generating_embeddings'
  | 'storing_chunks'
  | 'summarizing'
  | 'finalizing'

export type ProcessingSubstage = 
  | 'downloading_file'
  | 'parsing_pdf'
  | 'validating_content'
  | 'creating_chunks'
  | 'batch_embedding_generation'
  | 'database_insertion'
  | 'cleanup'

export interface ProcessingProgress {
  stage: ProcessingStage
  substage?: ProcessingSubstage
  percentage: number
  currentStep: number
  totalSteps: number
  estimatedTimeRemaining?: number
  bytesProcessed?: number
  totalBytes?: number
  pagesProcessed?: number
  totalPages?: number
  chunksCreated?: number
  embeddings_generated?: number
}

export interface ProcessingError {
  code: string
  message: string
  details?: string
  userFriendlyMessage: string
  suggestedActions: string[]
  retryable: boolean
  timestamp: string
}

export interface DocumentProcessingMetadata {
  // Basic info
  file_size?: number
  file_type?: string
  total_pages?: number
  
  // Processing progress
  processing_progress?: ProcessingProgress
  
  // Processing results
  extracted_text_length?: number
  chunks_created?: number
  embeddings_generated?: number
  processing_time_seconds?: number
  
  // Error information
  processing_error?: ProcessingError
  retry_count?: number
  last_retry_at?: string
  
  // Performance metrics
  processing_start_time?: string
  processing_end_time?: string
  stage_durations?: Record<ProcessingStage, number>
  
  // Resource usage
  memory_usage_mb?: number
  peak_memory_mb?: number
  
  // Quality metrics
  text_quality_score?: number
  extraction_confidence?: number
}

export interface DocumentWithProcessingInfo {
  id: string
  file_name: string | null
  status: DocumentStatus
  metadata: DocumentProcessingMetadata
  created_at: string
  updated_at: string
}

// Common error codes and messages
export const PROCESSING_ERRORS = {
  FILE_TOO_LARGE: {
    code: 'FILE_TOO_LARGE',
    userFriendlyMessage: 'The file is too large to process',
    suggestedActions: [
      'Try splitting the document into smaller sections',
      'Compress the PDF if possible',
      'Contact support for assistance with large files'
    ]
  },
  PDF_ENCRYPTED: {
    code: 'PDF_ENCRYPTED', 
    userFriendlyMessage: 'This PDF is password-protected or encrypted',
    suggestedActions: [
      'Remove password protection from the PDF',
      'Export as an unencrypted version',
      'Try converting to a different format'
    ]
  },
  PDF_SCANNED: {
    code: 'PDF_SCANNED',
    userFriendlyMessage: 'This appears to be a scanned PDF without text',
    suggestedActions: [
      'Use an OCR tool to convert the scanned images to text',
      'Try uploading a text-based version of the document',
      'Contact support for OCR processing assistance'
    ]
  },
  NETWORK_TIMEOUT: {
    code: 'NETWORK_TIMEOUT',
    userFriendlyMessage: 'Processing timed out due to file size or complexity',
    suggestedActions: [
      'Try again - temporary network issues may have occurred',
      'Break the document into smaller sections',
      'Upload during off-peak hours for better performance'
    ]
  },
  MEMORY_EXCEEDED: {
    code: 'MEMORY_EXCEEDED',
    userFriendlyMessage: 'The document is too complex to process in available memory',
    suggestedActions: [
      'Try reducing the document complexity',
      'Remove embedded images or media if possible',
      'Contact support for high-memory processing'
    ]
  },
  INVALID_FORMAT: {
    code: 'INVALID_FORMAT',
    userFriendlyMessage: 'The document format is not supported or corrupted',
    suggestedActions: [
      'Verify the file is not corrupted',
      'Try converting to PDF format',
      'Check that the file format is supported'
    ]
  }
} as const

export type ProcessingErrorCode = keyof typeof PROCESSING_ERRORS 