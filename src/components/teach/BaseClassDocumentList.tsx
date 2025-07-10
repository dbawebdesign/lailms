'use client';

import { useEffect, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { format } from 'date-fns'; // For date formatting
// Import Accordion components
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion"

interface Document {
  id: string;
  file_name: string;
  file_type: string;
  file_size: number;
  status: string;
  created_at: string;
}

interface BaseClassDocumentListProps {
  baseClassId: string;
  // Added refreshCounter to trigger re-fetch when upload completes
  refreshCounter: number; 
}

export default function BaseClassDocumentList({ baseClassId, refreshCounter }: BaseClassDocumentListProps) {
  const [documents, setDocuments] = useState<Document[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchDocuments = async () => {
      setIsLoading(true);
      setError(null);
      try {
        const response = await fetch(`/api/teach/base-classes/${baseClassId}/documents`);
        if (!response.ok) {
          const errorData = await response.json();
          throw new Error(errorData.error || 'Failed to fetch documents');
        }
        const data = await response.json();
        setDocuments(data);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'An unknown error occurred');
        setDocuments([]); // Clear documents on error
      } finally {
        setIsLoading(false);
      }
    };

    fetchDocuments();
  // Re-fetch when refreshCounter changes
  }, [baseClassId, refreshCounter]); 

  const formatFileSize = (bytes: number) => {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB', 'TB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  };

  if (isLoading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Knowledge Base Documents</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-2">
            <Skeleton className="h-4 w-full" />
            <Skeleton className="h-4 w-full" />
            <Skeleton className="h-4 w-3/4" />
          </div>
        </CardContent>
      </Card>
    );
  }

  if (error) {
    return (
      <Card className="border-destructive">
        <CardHeader>
          <CardTitle>Knowledge Base Documents</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-destructive">Error loading documents: {error}</p>
        </CardContent>
      </Card>
    );
  }

  // Only render Accordion if there are documents
  if (documents.length > 0) {
    return (
      <Accordion type="single" collapsible className="w-full">
        <AccordionItem value="item-1">
          <Card className="border-none"> {/* Remove card border as accordion adds its own separation */}
             <AccordionTrigger className="hover:no-underline">
              <CardHeader className="flex-1 text-left p-4">
                <CardTitle>Knowledge Base Documents ({documents.length})</CardTitle>
              </CardHeader>
             </AccordionTrigger>
             <AccordionContent>
              <CardContent className="p-0">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Name</TableHead>
                      <TableHead>Type</TableHead>
                      <TableHead>Size</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>Uploaded</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {documents.map((doc) => (
                      <TableRow key={doc.id}>
                        <TableCell className="font-medium">{doc.file_name}</TableCell>
                        <TableCell>{doc.file_type}</TableCell>
                        <TableCell>{formatFileSize(doc.file_size)}</TableCell>
                        <TableCell><Badge variant={doc.status === 'error' ? 'destructive' : doc.status === 'completed' ? 'default' : 'secondary'}>{doc.status}</Badge></TableCell>
                        <TableCell>{format(new Date(doc.created_at), 'PPp')}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </CardContent>
            </AccordionContent>
          </Card>
        </AccordionItem>
      </Accordion>
    );
  }

  // Render nothing or a placeholder if no documents and not loading/error
  // The parent component currently shows the upload component always,
  // and this will render nothing if docs are empty.
  return null; 
} 