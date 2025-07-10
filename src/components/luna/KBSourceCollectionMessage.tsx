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
    <Card className="w-full">
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-2 text-sm">
          <Upload className="h-4 w-4" />
          Knowledge Base Sources
        </CardTitle>
        <CardDescription className="text-xs">
          Add documents or URLs to enhance your course, or skip to use general knowledge.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4 pt-0">
        {/* File Upload Section - Compact */}
        <div className="space-y-2">
          <Label className="text-xs font-medium">Upload Documents</Label>
          <div className="border border-dashed border-muted-foreground/25 rounded p-3 text-center hover:border-muted-foreground/50 transition-colors">
            <Label htmlFor="file-upload" className="text-xs text-muted-foreground cursor-pointer flex flex-col items-center gap-1">
              <Upload className="h-4 w-4" />
              Click to upload files
            </Label>
            <Input
              id="file-upload"
              type="file"
              multiple
              accept=".pdf,.txt,.docx,.md"
              onChange={handleFileInputChange}
              className="hidden"
            />
            <p className="text-[10px] text-muted-foreground mt-1">
              PDF, TXT, DOCX, MD
            </p>
          </div>
          
          {uploadedFiles.length > 0 && (
            <div className="space-y-1">
              {uploadedFiles.map((file, index) => (
                <div key={index} className="flex items-center justify-between p-1.5 bg-muted rounded text-xs">
                  <div className="flex items-center gap-1 min-w-0 flex-1">
                    <FileText className="h-3 w-3 flex-shrink-0" />
                    <span className="truncate">{file.name}</span>
                  </div>
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={() => removeFile(index)}
                    className="h-4 w-4 p-0 ml-1"
                  >
                    <X className="h-2 w-2" />
                  </Button>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* URL Section - Compact */}
        <div className="space-y-2">
          <Label className="text-xs font-medium">Add URLs</Label>
          <div className="space-y-1">
            {urls.map((url, index) => (
              <div key={index} className="flex items-center gap-1">
                <div className="flex-1 relative">
                  <LinkIcon className="absolute left-2 top-1/2 transform -translate-y-1/2 h-3 w-3 text-muted-foreground" />
                  <Input
                    placeholder="https://example.com"
                    value={url}
                    onChange={(e) => updateUrl(index, e.target.value)}
                    className="pl-7 h-8 text-xs"
                  />
                </div>
                {urls.length > 1 && (
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => removeUrl(index)}
                    className="h-8 w-8 p-0"
                  >
                    <X className="h-3 w-3" />
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
            className="w-full h-7 text-xs"
          >
            <Plus className="h-3 w-3 mr-1" />
            Add URL
          </Button>
        </div>

        {/* Error Display */}
        {(uploadError || urlError) && (
          <Alert variant="destructive" className="py-2">
            <AlertCircle className="h-3 w-3" />
            <AlertDescription className="text-xs">
              {uploadError || urlError}
            </AlertDescription>
          </Alert>
        )}

        {/* Compact Info */}
        <div className="text-[10px] text-muted-foreground bg-muted/50 rounded p-2">
          💡 Knowledge base sources make courses more specific. Skip to use general AI knowledge.
        </div>

        {/* Action Buttons - Compact */}
        <div className="flex gap-2">
          <Button
            onClick={handleSubmitSources}
            disabled={isLoading || uploading || !hasAnySources}
            className="flex-1 h-8 text-xs"
            size="sm"
          >
            {uploading ? (
              <>
                <Upload className="h-3 w-3 mr-1 animate-pulse" />
                Processing...
              </>
            ) : (
              <>
                <CheckCircle className="h-3 w-3 mr-1" />
                Use Sources
              </>
            )}
          </Button>
          
          <Button
            variant="outline"
            onClick={handleSkip}
            disabled={isLoading || uploading}
            className="flex-1 h-8 text-xs"
            size="sm"
          >
            <ArrowRight className="h-3 w-3 mr-1" />
            Skip
          </Button>
        </div>
      </CardContent>
    </Card>
  );
} 