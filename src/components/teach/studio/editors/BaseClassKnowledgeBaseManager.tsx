import React, { useState, useEffect, useCallback, FormEvent } from 'react';
import { supabase } from '@/utils/supabase/browser'; // Assuming browser client is appropriate here
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Trash2, UploadCloud, FileText, Loader2 } from 'lucide-react';
import { formatBytes } from '@/lib/utils'; // Assuming you have this utility

interface Document {
  id: string;
  file_name: string;
  file_type: string | null;
  file_size: number | null;
  status: string;
  created_at: string;
  // Add any other relevant fields you fetch, e.g., base_class_id if needed client-side
}

interface BaseClassKnowledgeBaseManagerProps {
  baseClassId: string;
}

const BaseClassKnowledgeBaseManager: React.FC<BaseClassKnowledgeBaseManagerProps> = ({ baseClassId }) => {
  const [documents, setDocuments] = useState<Document[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [file, setFile] = useState<File | null>(null);
  const [isUploading, setIsUploading] = useState(false);

  const fetchDocuments = useCallback(async () => {
    if (!baseClassId) return;
    setIsLoading(true);
    setError(null);
    try {
      const response = await fetch(`/api/teach/base-classes/${baseClassId}/documents`);
      if (!response.ok) {
        const errData = await response.json();
        throw new Error(errData.error || 'Failed to fetch documents');
      }
      const data = await response.json();
      setDocuments(data);
    } catch (e: any) {
      setError(e.message);
      setDocuments([]); // Clear documents on error
    } finally {
      setIsLoading(false);
    }
  }, [baseClassId]);

  useEffect(() => {
    fetchDocuments();
  }, [fetchDocuments]);

  const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    if (event.target.files && event.target.files[0]) {
      setFile(event.target.files[0]);
    }
  };

  const handleUpload = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!file || !baseClassId) return;

    setIsUploading(true);
    setError(null);
    const formData = new FormData();
    formData.append('file', file);

    try {
      const response = await fetch(`/api/teach/base-classes/${baseClassId}/documents`, {
        method: 'POST',
        body: formData,
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.details || errorData.error || 'Upload failed');
      }
      // const result = await response.json(); // Contains documentId, filePath
      setFile(null); // Reset file input
      // Show a success toast or message
      alert('File uploaded successfully! Processing has started.'); // Replace with toast
      fetchDocuments(); // Refresh the list
    } catch (e: any) {
      setError(e.message);
      alert(`Upload Error: ${e.message}`); // Replace with toast
    } finally {
      setIsUploading(false);
    }
  };

  const handleDelete = async (documentId: string) => {
    if (!baseClassId || !documentId) return;
    // Optional: Add a confirmation dialog here
    if (!confirm('Are you sure you want to delete this document?')) return;

    // Optimistically update UI or use a loading state for the specific item
    // setDocuments(prevDocs => prevDocs.filter(doc => doc.id !== documentId));

    setError(null);
    try {
      const response = await fetch(`/api/teach/base-classes/${baseClassId}/documents/${documentId}`, {
        method: 'DELETE',
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to delete document');
      }
      alert('Document deleted successfully!'); // Replace with toast
      fetchDocuments(); // Refresh the list
    } catch (e: any) {
      setError(e.message);
      alert(`Deletion Error: ${e.message}`); // Replace with toast
      // fetchDocuments(); // Re-fetch to revert optimistic update if it failed
    }
  };

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>Upload New Document</CardTitle>
          <CardDescription>
            Upload documents to the knowledge base for this base class.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleUpload} className="space-y-4">
            <div>
              <Label htmlFor={`doc-upload-${baseClassId}`}>Select Document</Label>
              <Input 
                id={`doc-upload-${baseClassId}`}
                type="file" 
                onChange={handleFileChange} 
                disabled={isUploading} 
                className="mt-1"
              />
              {file && <p className="text-sm text-muted-foreground mt-1">Selected: {file.name} ({formatBytes(file.size)})</p>}
            </div>
            
            {error && !isUploading && <Alert variant="destructive"><AlertDescription>{error}</AlertDescription></Alert>}
            
            <Button type="submit" disabled={isUploading || !file} className="w-full sm:w-auto">
              {isUploading ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" /> Uploading...</> : <><UploadCloud className="mr-2 h-4 w-4" /> Upload Document</>}
            </Button>
          </form>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Existing Documents</CardTitle>
          <CardDescription>
            Documents currently associated with this base class.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {isLoading && (
            <div className="flex items-center justify-center py-6">
              <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
              <p className="ml-2 text-muted-foreground">Loading documents...</p>
            </div>
          )}
          {!isLoading && error && !documents.length && (
            <Alert variant="destructive">
              <AlertDescription>{error || 'Could not load documents.'}</AlertDescription>
            </Alert>
          )}
          {!isLoading && !error && documents.length === 0 && (
            <p className="text-center text-muted-foreground py-6">No documents found for this base class.</p>
          )}
          {!isLoading && !error && documents.length > 0 && (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Name</TableHead>
                  <TableHead className="hidden sm:table-cell">Type</TableHead>
                  <TableHead className="hidden md:table-cell">Size</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="hidden md:table-cell">Uploaded</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {documents.map((doc) => (
                  <TableRow key={doc.id}>
                    <TableCell className="font-medium">
                        <div className="flex items-center">
                            <FileText size={16} className="mr-2 text-muted-foreground flex-shrink-0" />
                            <span className="truncate" title={doc.file_name}>{doc.file_name}</span>
                        </div>
                    </TableCell>
                    <TableCell className="hidden sm:table-cell">{doc.file_type || 'N/A'}</TableCell>
                    <TableCell className="hidden md:table-cell">{doc.file_size ? formatBytes(doc.file_size) : 'N/A'}</TableCell>
                    <TableCell>
                        <span className={`px-2 py-0.5 text-xs rounded-full 
                            ${doc.status === 'completed' ? 'bg-green-100 text-green-700' : 
                              doc.status === 'processing' || doc.status === 'queued' ? 'bg-blue-100 text-blue-700' : 
                              doc.status === 'error' ? 'bg-red-100 text-red-700' : 'bg-gray-100 text-gray-700'}
                        `}>
                            {doc.status}
                        </span>
                    </TableCell>
                    <TableCell className="hidden md:table-cell">{new Date(doc.created_at).toLocaleDateString()}</TableCell>
                    <TableCell className="text-right">
                      <Button 
                        variant="ghost" 
                        size="icon" 
                        onClick={() => handleDelete(doc.id)}
                        title="Delete document"
                      >
                        <Trash2 className="h-4 w-4 text-destructive" />
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
};

export default BaseClassKnowledgeBaseManager; 