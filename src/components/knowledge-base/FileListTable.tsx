'use client'

import { useState, useEffect } from 'react'
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
  MoreVertical,
  MoreHorizontal,
  Eye,
  ExternalLink
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
import { toast } from 'sonner'
import type { Database } from '../../../packages/types/db'

// Document status type - updated to match database enum
export type DocumentStatus = 'queued' | 'processing' | 'completed' | 'error'

type Document = Database['public']['Tables']['documents']['Row']

interface FileListTableProps {
  organisationId: string;
  baseClassId?: string;
  userOnly?: boolean; // New prop to filter by user instead of organization
}

export function FileListTable({ organisationId, baseClassId, userOnly = false }: FileListTableProps) {
  const [documents, setDocuments] = useState<Document[]>([])
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [deletingId, setDeletingId] = useState<string | null>(null)

  useEffect(() => {
    async function fetchDocuments() {
      if (!organisationId) return;
      
      setIsLoading(true);
      setError(null);
      try {
        let url = `/api/knowledge-base/documents?organisation_id=${organisationId}`;
        if (baseClassId) {
          url += `&base_class_id=${baseClassId}`;
        }
        if (userOnly) {
          url += `&user_only=${userOnly}`;
        }
        
        const response = await fetch(url);
        if (!response.ok) {
          const errorData = await response.json();
          throw new Error(errorData.error || `HTTP error! status: ${response.status}`);
        }
        const data: Document[] = await response.json();
        setDocuments(data);

      } catch (err) {
        console.error("Failed to fetch documents:", err);
        const message = err instanceof Error ? err.message : "An unknown error occurred";
        setError(`Failed to load documents: ${message}`);
        toast.error(`Failed to load documents: ${message}`);
      } finally {
        setIsLoading(false);
      }
    }

    fetchDocuments();
  }, [organisationId, baseClassId, userOnly]);

  // Get status badge based on document status and processing stage
  const getStatusBadge = (status: DocumentStatus, metadata: any) => {
    const processingStage = metadata?.processing_stage;
    
    switch (status) {
      case 'queued':
        return (
          <Badge variant="outline" className="bg-blue-50 text-blue-700 border-blue-200 flex items-center gap-1">
            <Clock className="h-3 w-3" />
            <span>Queued</span>
          </Badge>
        )
      case 'processing':
        // Check processing stage for more specific status
        if (processingStage === 'summarizing_chunks') {
          return (
            <Badge variant="outline" className="bg-yellow-50 text-yellow-700 border-yellow-200 flex items-center gap-1">
              <Loader2 className="h-3 w-3 animate-spin" />
              <span>Summarizing</span>
            </Badge>
          )
        } else if (processingStage === 'chunking') {
          return (
            <Badge variant="outline" className="bg-amber-50 text-amber-700 border-amber-200 flex items-center gap-1">
              <Loader2 className="h-3 w-3 animate-spin" />
              <span>Chunking</span>
            </Badge>
          )
        } else if (processingStage === 'transcript_extraction') {
          return (
            <Badge variant="outline" className="bg-amber-50 text-amber-700 border-amber-200 flex items-center gap-1">
              <Loader2 className="h-3 w-3 animate-spin" />
              <span>Extracting</span>
            </Badge>
          )
        } else {
          return (
            <Badge variant="outline" className="bg-amber-50 text-amber-700 border-amber-200 flex items-center gap-1">
              <Loader2 className="h-3 w-3 animate-spin" />
              <span>Processing</span>
            </Badge>
          )
        }
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

  // Get file type display name
  const getFileTypeDisplay = (fileType: string | null, fileName: string | null) => {
    if (!fileType) return 'Unknown';
    
    // Special handling for URLs
    if (fileName?.startsWith('URL -')) {
      if (fileName.includes('youtube.com') || fileName.includes('youtu.be')) {
        return 'YouTube Video';
      }
      return 'Web Page';
    }
    
    // Handle common file types
    switch (fileType) {
      case 'application/pdf':
        return 'PDF';
      case 'text/plain':
        return 'Text';
      case 'audio/wav':
      case 'audio/mp3':
      case 'audio/mpeg':
        return 'Audio';
      case 'video/mp4':
      case 'video/quicktime':
        return 'Video';
      default:
        return fileType.split('/')[1]?.toUpperCase() || 'File';
    }
  }

  // Handle document deletion with confirmation
  const handleDelete = async (docId: string, fileName: string | null) => {
    if (deletingId) return; // Prevent multiple deletes
    
    // Show confirmation dialog
    if (!confirm(`Are you sure you want to delete "${fileName || 'this document'}"? This action cannot be undone.`)) {
      return;
    }

    setDeletingId(docId);
    try {
      const response = await fetch(`/api/knowledge-base/documents?docId=${docId}`, {
        method: 'DELETE',
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || `HTTP error! status: ${response.status}`);
      }

      // Remove the document from the local state on successful deletion
      setDocuments((prevDocs) => prevDocs.filter((doc) => doc.id !== docId));
      toast.success('Document deleted successfully');

    } catch (err) {
      console.error('Failed to delete document:', err);
      const message = err instanceof Error ? err.message : 'An unknown error occurred';
      toast.error(`Failed to delete document: ${message}`);
    } finally {
      setDeletingId(null);
    }
  }

  // Handle document viewing
  const handleView = async (docId: string, fileName: string | null, status: DocumentStatus) => {
    // For URL-type documents, we can view them even if not fully processed
    // For file documents, we should wait until they're completed
    const document = documents.find(doc => doc.id === docId);
    const metadata = document?.metadata as any;
    const isUrl = metadata?.originalUrl;
    
    if (!isUrl && status !== 'completed') {
      toast.error('Please wait for the document to finish processing before viewing.');
      return;
    }
    
    try {
      const response = await fetch(`/api/knowledge-base/documents/${docId}/view`);
      
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || `HTTP error! status: ${response.status}`);
      }

      const data = await response.json();
      
      // Open the URL in a new tab
      window.open(data.url, '_blank', 'noopener,noreferrer');
      
      // Show success message based on type
      const viewType = data.type === 'url' ? 'original source' : 'document';
      toast.success(`Opening ${viewType}...`);

    } catch (err) {
      console.error('Failed to view document:', err);
      const message = err instanceof Error ? err.message : 'An unknown error occurred';
      toast.error(`Failed to view document: ${message}`);
    }
  }

  // Format file size
  const formatFileSize = (bytes: number | null) => {
    if (!bytes) return '0 B';
    return formatBytes(bytes);
  }

  if (isLoading) return <div className="p-4 text-center">Loading documents...</div>
  if (error) return <div className="p-4 text-center text-red-500">{error}</div>

  return (
    <div className="space-y-4">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Name</TableHead>
            <TableHead>Status</TableHead>
            <TableHead>Type</TableHead>
            <TableHead>Size</TableHead>
            <TableHead>Uploaded</TableHead>
            <TableHead className="w-[50px]">Actions</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {documents.length === 0 ? (
            <TableRow>
              <TableCell colSpan={6} className="text-center py-8 text-muted-foreground">
                No documents uploaded yet. Upload your first document above.
              </TableCell>
            </TableRow>
          ) : (
            documents.map((doc) => (
              <TableRow key={doc.id}>
                <TableCell className="font-medium max-w-[300px]">
                  <div className="flex items-center gap-2">
                    <FileIcon className="h-4 w-4 text-muted-foreground flex-shrink-0" />
                    <span className="truncate" title={doc.file_name || 'Unnamed document'}>
                      {doc.file_name || 'Unnamed document'}
                    </span>
                  </div>
                </TableCell>
                <TableCell>
                  {getStatusBadge(doc.status as DocumentStatus, doc.metadata)}
                </TableCell>
                <TableCell>
                  {getFileTypeDisplay(doc.file_type, doc.file_name)}
                </TableCell>
                <TableCell>
                  {formatFileSize(doc.file_size)}
                </TableCell>
                <TableCell>
                  {doc.created_at ? format(new Date(doc.created_at), 'MMM d, yyyy') : 'Unknown'}
                </TableCell>
                <TableCell>
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button variant="ghost" className="h-8 w-8 p-0" disabled={!!deletingId}>
                        <span className="sr-only">Open menu</span>
                        {deletingId === doc.id ? (
                          <Loader2 className="h-4 w-4 animate-spin" />
                        ) : (
                          <MoreHorizontal className="h-4 w-4" />
                        )}
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end">
                      <DropdownMenuItem 
                        onClick={() => handleView(doc.id, doc.file_name, doc.status as DocumentStatus)}
                        disabled={!!deletingId}
                      >
                        {(doc.metadata as any)?.originalUrl ? (
                          <ExternalLink className="h-4 w-4 mr-2" />
                        ) : (
                          <Eye className="h-4 w-4 mr-2" />
                        )}
                        View
                      </DropdownMenuItem>
                      <DropdownMenuItem 
                        onClick={() => handleDelete(doc.id, doc.file_name)} 
                        className="text-red-600 focus:text-red-600" 
                        disabled={!!deletingId}
                      >
                        <Trash2 className="h-4 w-4 mr-2" />
                        {deletingId === doc.id ? 'Deleting...' : 'Delete'}
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                </TableCell>
              </TableRow>
            ))
          )}
        </TableBody>
      </Table>
    </div>
  )
} 