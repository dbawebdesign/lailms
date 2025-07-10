'use client';

import { useState, ChangeEvent, FormEvent } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { useToast } from "@/components/ui/use-toast"

interface BaseClassDocumentUploadProps {
  baseClassId: string;
  onUploadSuccess: () => void; // Callback to refresh the list
}

export default function BaseClassDocumentUpload({ baseClassId, onUploadSuccess }: BaseClassDocumentUploadProps) {
  const [file, setFile] = useState<File | null>(null);
  const [isUploading, setIsUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const { toast } = useToast();

  const handleFileChange = (event: ChangeEvent<HTMLInputElement>) => {
    if (event.target.files && event.target.files[0]) {
      setFile(event.target.files[0]);
      setError(null); // Clear previous errors
    } else {
      setFile(null);
    }
  };

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!file) {
      setError('Please select a file to upload.');
      return;
    }
    if (!baseClassId) {
        setError('Base Class ID is missing. Cannot upload.');
        return;
    }

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
        throw new Error(errorData.error || 'Failed to upload document');
      }

      // const newDocument = await response.json(); // Optionally use the response
      toast({
        title: "Upload Successful",
        description: `${file.name} has been uploaded.`,
      })
      setFile(null); // Clear the file input
      onUploadSuccess(); // Trigger list refresh
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'An unknown error occurred';
      setError(errorMessage);
      toast({
        title: "Upload Failed",
        description: errorMessage,
        variant: "destructive",
      })
      console.error(err);
    } finally {
      setIsUploading(false);
    }
  };

  return (
    <Card className="mb-6">
      <CardHeader>
        <CardTitle>Upload New Document</CardTitle>
        <CardDescription>
          Upload documents to the knowledge base for this base class.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <Label htmlFor="document-upload">Select Document</Label>
            <Input 
              id="document-upload" 
              type="file" 
              onChange={handleFileChange} 
              disabled={isUploading} 
              className="mt-1"
            />
            {file && <p className="text-sm text-muted-foreground mt-1">Selected: {file.name}</p>}
          </div>
          
          {error && <p className="text-sm text-red-600">{error}</p>}
          
          <Button type="submit" disabled={isUploading || !file}>
            {isUploading ? 'Uploading...' : 'Upload Document'}
          </Button>
        </form>
      </CardContent>
    </Card>
  );
} 