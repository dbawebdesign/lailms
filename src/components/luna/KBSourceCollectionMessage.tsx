"use client";

import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Separator } from '@/components/ui/separator';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { 
  Upload, 
  Link as LinkIcon, 
  FileText, 
  Plus, 
  X, 
  CheckCircle, 
  AlertCircle,
  Info,
  ArrowRight
} from 'lucide-react';

interface KBSourceCollectionMessageProps {
  baseClassId: string;
  onSourcesCollected: (sources: CollectedSources) => void;
  onSkipSources: () => void;
  isLoading?: boolean;
}

interface CollectedSources {
  documents: Array<{
    name: string;
    size: number;
    type: string;
  }>;
  urls: string[];
  skipKB: boolean;
}

export default function KBSourceCollectionMessage({ 
  baseClassId, 
  onSourcesCollected, 
  onSkipSources, 
  isLoading = false 
}: KBSourceCollectionMessageProps) {
  const [urls, setUrls] = useState<string[]>(['']);
  const [uploadedFiles, setUploadedFiles] = useState<File[]>([]);
  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [urlError, setUrlError] = useState<string | null>(null);

  const addUrlField = () => {
    setUrls([...urls, '']);
  };

  const updateUrl = (index: number, value: string) => {
    const newUrls = [...urls];
    newUrls[index] = value;
    setUrls(newUrls);
    setUrlError(null);
  };

  const removeUrl = (index: number) => {
    const newUrls = urls.filter((_, i) => i !== index);
    setUrls(newUrls.length === 0 ? [''] : newUrls);
  };

  const validateUrls = () => {
    const validUrls = urls.filter(url => url.trim());
    const invalidUrls = validUrls.filter(url => {
      try {
        new URL(url);
        return false;
      } catch {
        return true;
      }
    });

    if (invalidUrls.length > 0) {
      setUrlError(`Invalid URLs: ${invalidUrls.join(', ')}`);
      return false;
    }
    return true;
  };

  const handleFilesUploaded = (files: File[]) => {
    setUploadedFiles(prev => [...prev, ...files]);
    setUploadError(null);
  };

  // For now, we'll use a simple file input instead of the complex FileUploadDropzone
  const handleFileInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files) {
      const fileArray = Array.from(e.target.files);
      handleFilesUploaded(fileArray);
    }
  };

  const removeFile = (index: number) => {
    setUploadedFiles(prev => prev.filter((_, i) => i !== index));
  };

  const handleSubmitSources = async () => {
    if (!validateUrls()) return;

    const validUrls = urls.filter(url => url.trim());
    
    if (uploadedFiles.length === 0 && validUrls.length === 0) {
      setUploadError('Please add at least one document or URL, or choose to skip knowledge base sources.');
      return;
    }

    setUploading(true);
    setUploadError(null);

    try {
      // Upload files if any
      const uploadedDocuments = [];
      if (uploadedFiles.length > 0) {
        const formData = new FormData();
        uploadedFiles.forEach((file, index) => {
          formData.append(`files`, file);
        });
        formData.append('baseClassId', baseClassId);

        const uploadResponse = await fetch('/api/knowledge-base/upload', {
          method: 'POST',
          body: formData,
        });

        if (!uploadResponse.ok) {
          throw new Error('Failed to upload documents');
        }

        const uploadData = await uploadResponse.json();
        uploadedDocuments.push(...(uploadData.files || []));
      }

      // Process URLs if any
      if (validUrls.length > 0) {
        const urlResponse = await fetch('/api/knowledge-base/url', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            baseClassId,
            urls: validUrls
          }),
        });

        if (!urlResponse.ok) {
          throw new Error('Failed to process URLs');
        }
      }

      // Notify parent component
      onSourcesCollected({
        documents: uploadedDocuments,
        urls: validUrls,
        skipKB: false
      });

    } catch (error) {
      setUploadError(error instanceof Error ? error.message : 'Failed to process sources');
    } finally {
      setUploading(false);
    }
  };

  const handleSkip = () => {
    onSkipSources();
  };

  const hasAnySources = uploadedFiles.length > 0 || urls.some(url => url.trim());

  return (
    <Card className="w-full max-w-2xl">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Upload className="h-5 w-5" />
          Knowledge Base Sources
        </CardTitle>
        <CardDescription>
          Add documents or URLs to enhance your course with specific content, or skip to use general knowledge.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* File Upload Section */}
        <div className="space-y-3">
          <Label className="text-sm font-medium">Upload Documents</Label>
          <div className="border-2 border-dashed border-muted-foreground/25 rounded-lg p-6 text-center hover:border-muted-foreground/50 transition-colors min-h-[120px] flex flex-col items-center justify-center">
            <Upload className="h-8 w-8 text-muted-foreground mb-2" />
            <Label htmlFor="file-upload" className="text-sm text-muted-foreground mb-2 cursor-pointer">
              Drop files here or click to upload
            </Label>
            <Input
              id="file-upload"
              type="file"
              multiple
              accept=".pdf,.txt,.docx,.md"
              onChange={handleFileInputChange}
              className="hidden"
            />
            <p className="text-xs text-muted-foreground">
              Supports: PDF, TXT, DOCX, MD (Max 10 files)
            </p>
          </div>
          
          {uploadedFiles.length > 0 && (
            <div className="space-y-2">
              <Label className="text-xs text-muted-foreground">Uploaded Files:</Label>
              {uploadedFiles.map((file, index) => (
                <div key={index} className="flex items-center justify-between p-2 bg-muted rounded-md">
                  <div className="flex items-center gap-2">
                    <FileText className="h-4 w-4" />
                    <span className="text-sm truncate">{file.name}</span>
                    <Badge variant="secondary" className="text-xs">
                      {(file.size / 1024).toFixed(1)} KB
                    </Badge>
                  </div>
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={() => removeFile(index)}
                    className="h-6 w-6 p-0"
                  >
                    <X className="h-3 w-3" />
                  </Button>
                </div>
              ))}
            </div>
          )}
        </div>

        <Separator />

        {/* URL Section */}
        <div className="space-y-3">
          <Label className="text-sm font-medium">Add URLs</Label>
          <div className="space-y-2">
            {urls.map((url, index) => (
              <div key={index} className="flex items-center gap-2">
                <div className="flex-1 relative">
                  <LinkIcon className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input
                    placeholder="https://example.com/article"
                    value={url}
                    onChange={(e) => updateUrl(index, e.target.value)}
                    className="pl-10"
                  />
                </div>
                {urls.length > 1 && (
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => removeUrl(index)}
                    className="h-10 w-10 p-0"
                  >
                    <X className="h-4 w-4" />
                  </Button>
                )}
              </div>
            ))}
          </div>
          
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={addUrlField}
            className="w-full"
          >
            <Plus className="h-4 w-4 mr-2" />
            Add Another URL
          </Button>
        </div>

        {/* Error Display */}
        {(uploadError || urlError) && (
          <Alert variant="destructive">
            <AlertCircle className="h-4 w-4" />
            <AlertDescription>
              {uploadError || urlError}
            </AlertDescription>
          </Alert>
        )}

        {/* Info Alert */}
        <Alert>
          <Info className="h-4 w-4" />
          <AlertDescription>
            Adding knowledge base sources will make your course more specific and tailored to your content. 
            You can skip this step to create a general course using AI knowledge.
          </AlertDescription>
        </Alert>

        {/* Action Buttons */}
        <div className="flex flex-col gap-3">
          <Button
            onClick={handleSubmitSources}
            disabled={isLoading || uploading || !hasAnySources}
            className="w-full"
          >
            {uploading ? (
              <>
                <Upload className="h-4 w-4 mr-2 animate-pulse" />
                Processing Sources...
              </>
            ) : (
              <>
                <CheckCircle className="h-4 w-4 mr-2" />
                Use These Sources
              </>
            )}
          </Button>
          
          <Button
            variant="outline"
            onClick={handleSkip}
            disabled={isLoading || uploading}
            className="w-full"
          >
            <ArrowRight className="h-4 w-4 mr-2" />
            Skip & Use General Knowledge
          </Button>
        </div>
      </CardContent>
    </Card>
  );
} 