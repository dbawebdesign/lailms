'use client'

import { useState } from 'react'
import { format } from 'date-fns'
import { 
  FileIcon, 
  CheckCircle, 
  Clock, 
  AlertTriangle, 
  Loader2,
  Trash2, 
  RefreshCw,
  Download,
  MoreVertical
} from 'lucide-react'
import { formatBytes } from '@/lib/utils'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { 
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuTrigger
} from '@/components/ui/dropdown-menu'
import {
  Table,
  TableBody,
  TableCaption,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { toast } from '@/components/ui/use-toast'

// Document status type
export type DocumentStatus = 'queued' | 'processing' | 'completed' | 'error'

// Document type corresponding to the database schema
export interface Document {
  id: string
  file_name: string
  storage_path: string
  status: DocumentStatus
  organisation_id: string
  uploaded_by: string
  file_type: string | null
  file_size: number | null
  metadata: any | null
  created_at: string
  updated_at: string
}

interface FileListTableProps {
  documents: Document[]
  isLoading?: boolean
  onRefresh?: () => void
  onDelete?: (documentId: string) => Promise<void>
  onRetry?: (documentId: string) => Promise<void>
  onDownload?: (documentId: string) => Promise<void>
  emptyMessage?: string
}

export function FileListTable({
  documents,
  isLoading = false,
  onRefresh,
  onDelete,
  onRetry,
  onDownload,
  emptyMessage = 'No documents uploaded yet'
}: FileListTableProps) {
  const [deletingId, setDeletingId] = useState<string | null>(null)
  const [actionInProgress, setActionInProgress] = useState<string | null>(null)

  // Get status badge based on document status
  const getStatusBadge = (status: DocumentStatus) => {
    switch (status) {
      case 'queued':
        return (
          <Badge variant="outline" className="bg-blue-50 text-blue-700 border-blue-200 flex items-center gap-1">
            <Clock className="h-3 w-3" />
            <span>Queued</span>
          </Badge>
        )
      case 'processing':
        return (
          <Badge variant="outline" className="bg-amber-50 text-amber-700 border-amber-200 flex items-center gap-1">
            <Loader2 className="h-3 w-3 animate-spin" />
            <span>Processing</span>
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
            <AlertTriangle className="h-3 w-3" />
            <span>Error</span>
          </Badge>
        )
      default:
        return (
          <Badge variant="outline">
            {status}
          </Badge>
        )
    }
  }

  // File type icon or generic file icon
  const getFileIcon = (fileType: string | null) => {
    // This could be expanded to include more file type specific icons
    return <FileIcon className="h-4 w-4 text-primary" />
  }

  // Handle document deletion
  const handleDelete = async (documentId: string) => {
    if (!onDelete) return

    try {
      setDeletingId(documentId)
      setActionInProgress(documentId)
      await onDelete(documentId)
      toast({
        title: 'Document deleted',
        description: 'The document has been successfully deleted.',
      })
    } catch (error) {
      console.error('Error deleting document:', error)
      toast({
        title: 'Deletion failed',
        description: error instanceof Error ? error.message : 'Failed to delete document',
        variant: 'destructive',
      })
    } finally {
      setDeletingId(null)
      setActionInProgress(null)
    }
  }

  // Handle retry processing for documents with error
  const handleRetry = async (documentId: string) => {
    if (!onRetry) return

    try {
      setActionInProgress(documentId)
      await onRetry(documentId)
      toast({
        title: 'Processing restarted',
        description: 'The document has been queued for processing again.',
      })
    } catch (error) {
      console.error('Error retrying document:', error)
      toast({
        title: 'Retry failed',
        description: error instanceof Error ? error.message : 'Failed to retry document processing',
        variant: 'destructive',
      })
    } finally {
      setActionInProgress(null)
    }
  }

  // Handle document download
  const handleDownload = async (documentId: string) => {
    if (!onDownload) return

    try {
      setActionInProgress(documentId)
      await onDownload(documentId)
    } catch (error) {
      console.error('Error downloading document:', error)
      toast({
        title: 'Download failed',
        description: error instanceof Error ? error.message : 'Failed to download document',
        variant: 'destructive',
      })
    } finally {
      setActionInProgress(null)
    }
  }

  if (isLoading) {
    return (
      <div className="flex justify-center items-center py-8">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    )
  }

  return (
    <div>
      <div className="flex justify-between items-center mb-4">
        <h2 className="text-xl font-semibold">Uploaded Documents</h2>
        {onRefresh && (
          <Button
            variant="outline"
            size="sm"
            onClick={onRefresh}
            className="ml-auto"
          >
            <RefreshCw className="h-4 w-4 mr-2" />
            Refresh
          </Button>
        )}
      </div>

      {documents.length === 0 ? (
        <div className="text-center py-8 border rounded-md bg-muted/20">
          <p className="text-muted-foreground">{emptyMessage}</p>
        </div>
      ) : (
        <Table>
          <TableCaption>
            List of your uploaded documents and their processing status.
          </TableCaption>
          <TableHeader>
            <TableRow>
              <TableHead className="w-[300px]">Name</TableHead>
              <TableHead>Type</TableHead>
              <TableHead>Size</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Uploaded</TableHead>
              <TableHead className="text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {documents.map((doc) => (
              <TableRow key={doc.id}>
                <TableCell className="font-medium">
                  <div className="flex items-center">
                    {getFileIcon(doc.file_type)}
                    <span className="ml-2 truncate max-w-[250px]">{doc.file_name}</span>
                  </div>
                </TableCell>
                <TableCell>{doc.file_type || 'Unknown'}</TableCell>
                <TableCell>{doc.file_size ? formatBytes(doc.file_size) : 'Unknown'}</TableCell>
                <TableCell>{getStatusBadge(doc.status)}</TableCell>
                <TableCell>{format(new Date(doc.created_at), 'MMM d, yyyy')}</TableCell>
                <TableCell className="text-right">
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button variant="ghost" size="icon" disabled={!!actionInProgress}>
                        {actionInProgress === doc.id ? (
                          <Loader2 className="h-4 w-4 animate-spin" />
                        ) : (
                          <MoreVertical className="h-4 w-4" />
                        )}
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end">
                      <DropdownMenuGroup>
                        {doc.status === 'completed' && onDownload && (
                          <DropdownMenuItem onClick={() => handleDownload(doc.id)}>
                            <Download className="h-4 w-4 mr-2" />
                            <span>Download</span>
                          </DropdownMenuItem>
                        )}
                        {doc.status === 'error' && onRetry && (
                          <DropdownMenuItem onClick={() => handleRetry(doc.id)}>
                            <RefreshCw className="h-4 w-4 mr-2" />
                            <span>Retry Processing</span>
                          </DropdownMenuItem>
                        )}
                        {onDelete && (
                          <DropdownMenuItem 
                            onClick={() => handleDelete(doc.id)}
                            className="text-destructive focus:text-destructive"
                          >
                            {deletingId === doc.id ? (
                              <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                            ) : (
                              <Trash2 className="h-4 w-4 mr-2" />
                            )}
                            <span>Delete</span>
                          </DropdownMenuItem>
                        )}
                      </DropdownMenuGroup>
                    </DropdownMenuContent>
                  </DropdownMenu>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      )}
    </div>
  )
} 