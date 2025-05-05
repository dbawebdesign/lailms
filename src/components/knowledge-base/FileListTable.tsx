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
  MoreHorizontal
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
import type { Database } from 'packages/types/supabase'

// Document status type
export type DocumentStatus = 'queued' | 'processing' | 'completed' | 'error'

type Document = Database['public']['Tables']['documents']['Row']

interface FileListTableProps {
  organisationId: string
}

export function FileListTable({ organisationId }: FileListTableProps) {
  const [documents, setDocuments] = useState<Document[]>([])
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [deletingId, setDeletingId] = useState<string | null>(null)

  useEffect(() => {
    async function fetchDocuments() {
      if (!organisationId) return; // Redundant check now, but harmless

      setIsLoading(true);
      setError(null);
      try {
        // Fetch documents from the new API endpoint
        const response = await fetch(`/api/knowledge-base/documents`); // No need to pass orgId, API infers it
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
  }, [organisationId]); // Refetch when organisationId changes

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
  const handleDelete = async (docId: string) => {
    if (deletingId) return; // Prevent multiple deletes

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

  if (isLoading) return <p>Loading documents...</p>
  if (error) return <p className="text-red-500">{error}</p>

  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>Name</TableHead>
          <TableHead>Status</TableHead>
          <TableHead>Type</TableHead>
          <TableHead>Size</TableHead>
          <TableHead>Uploaded</TableHead>
          <TableHead>Actions</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {documents.length === 0 ? (
          <TableRow>
            <TableCell colSpan={6} className="text-center">
              No documents uploaded for this organisation yet.
            </TableCell>
          </TableRow>
        ) : (
          documents.map((doc) => (
            <TableRow key={doc.id}>
              <TableCell className="font-medium">{doc.name}</TableCell>
              <TableCell><Badge variant={doc.status === 'processed' ? 'default' : 'secondary'}>{doc.status}</Badge></TableCell>
              <TableCell>{doc.file_type}</TableCell>
              <TableCell>{formatBytes(doc.file_size ?? 0)}</TableCell>
              <TableCell>{doc.created_at ? format(new Date(doc.created_at), 'PPpp') : 'N/A'}</TableCell>
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
                    {/* <DropdownMenuItem>View Details</DropdownMenuItem> */}
                    {/* <DropdownMenuItem>Process</DropdownMenuItem> */}
                    <DropdownMenuItem 
                      onClick={() => handleDelete(doc.id)} 
                      className="text-red-600" 
                      disabled={!!deletingId}
                    >
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
  )
} 