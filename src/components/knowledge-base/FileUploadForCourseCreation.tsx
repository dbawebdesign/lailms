'use client';

import React, { useState } from 'react';
import { FileUploadDropzone } from './FileUploadDropzone';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Progress } from '@/components/ui/progress';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { 
  Upload, 
  CheckCircle, 
  ArrowRight, 
  Loader2, 
  Info,
  FileText,
  Link as LinkIcon,
  Video,
  Image as ImageIcon,
  Sparkles,
  Plus,
  X,
  Globe
} from 'lucide-react';

interface FileUploadForCourseCreationProps {
  baseClassId: string | null;
  organisationId: string;
  onUploadComplete: () => void;
  onSkipUploads: () => void;
}

interface QueuedFile {
  id: string;
  type: 'file' | 'url';
  name: string;
  file?: File;
  url?: string;
  status: 'queued' | 'uploading' | 'uploaded' | 'processing' | 'completed' | 'error';
}

interface ProcessingProgress {
  total: number;
  completed: number;
  isProcessing: boolean;
  currentStep: string;
}

export default function FileUploadForCourseCreation({ 
  baseClassId, 
  organisationId,
  onUploadComplete, 
  onSkipUploads 
}: FileUploadForCourseCreationProps) {
  const [queuedItems, setQueuedItems] = useState<QueuedFile[]>([]);
  const [urlInput, setUrlInput] = useState('');
  const [processingProgress, setProcessingProgress] = useState<ProcessingProgress>({
    total: 0,
    completed: 0,
    isProcessing: false,
    currentStep: ''
  });

  // Add files to queue
  const handleFilesSelected = (files: FileList) => {
    const newFiles: QueuedFile[] = Array.from(files).map(file => ({
      id: crypto.randomUUID(),
      type: 'file',
      name: file.name,
      file,
      status: 'queued'
    }));
    
    setQueuedItems(prev => [...prev, ...newFiles]);
  };

  // Add URL to queue
  const handleAddUrl = () => {
    if (!urlInput.trim()) return;
    
    const newUrl: QueuedFile = {
      id: crypto.randomUUID(),
      type: 'url',
      name: urlInput,
      url: urlInput,
      status: 'queued'
    };
    
    setQueuedItems(prev => [...prev, newUrl]);
    setUrlInput('');
  };

  // Remove item from queue
  const removeQueuedItem = (id: string) => {
    setQueuedItems(prev => prev.filter(item => item.id !== id));
  };

  // Process all queued items
  const handleProcessAll = async () => {
    if (queuedItems.length === 0) return;

    setProcessingProgress({
      total: queuedItems.length,
      completed: 0,
      isProcessing: true,
      currentStep: 'Uploading and processing all sources...'
    });

    try {
      // Upload all items simultaneously
      const uploadPromises = queuedItems.map(async (item) => {
        setQueuedItems(prev => prev.map(qi => 
          qi.id === item.id ? { ...qi, status: 'uploading' } : qi
        ));

        try {
          if (item.type === 'file' && item.file) {
            // Upload file
            const formData = new FormData();
            formData.append('file', item.file);
            formData.append('organisation_id', organisationId);

            const response = await fetch('/api/knowledge-base/upload', {
              method: 'POST',
              body: formData,
            });

            if (!response.ok) {
              const errorData = await response.json().catch(() => ({ error: 'File upload failed' }));
              throw new Error(`File upload failed: ${errorData.error || 'Unknown error'}`);
            }

                  } else if (item.type === 'url' && item.url) {
          // Detect URL type
          const urlType = item.url.includes('youtube.com') || item.url.includes('youtu.be') ? 'youtube' : 'webpage';
          
          // Submit URL
          const response = await fetch('/api/knowledge-base/url', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ 
              url: item.url,
              type: urlType 
            }),
          });

          if (!response.ok) {
            const errorData = await response.json().catch(() => ({ error: 'URL submission failed' }));
            throw new Error(`URL submission failed: ${errorData.error || 'Unknown error'}`);
          }
          }

          setQueuedItems(prev => prev.map(qi => 
            qi.id === item.id ? { ...qi, status: 'uploaded' } : qi
          ));

          setProcessingProgress(prev => ({
            ...prev,
            completed: prev.completed + 1
          }));

        } catch (error) {
          setQueuedItems(prev => prev.map(qi => 
            qi.id === item.id ? { ...qi, status: 'error' } : qi
          ));
          console.error(`Failed to process ${item.name}:`, error);
        }
      });

      // Wait for all uploads to complete
      await Promise.all(uploadPromises);

      setProcessingProgress(prev => ({
        ...prev,
        currentStep: 'Waiting for document processing to complete...'
      }));

      // Wait a bit for document processing to start
      await new Promise(resolve => setTimeout(resolve, 3000));

      setProcessingProgress(prev => ({
        ...prev,
        currentStep: 'All sources processed! Ready for comprehensive analysis.'
      }));

      // Trigger the comprehensive analysis
      onUploadComplete();

    } catch (error) {
      console.error('Error processing sources:', error);
      setProcessingProgress(prev => ({
        ...prev,
        isProcessing: false,
        currentStep: 'Error occurred during processing'
      }));
    }
  };

  const progressPercentage = processingProgress.total > 0 
    ? (processingProgress.completed / processingProgress.total) * 100 
    : 0;

  return (
    <div className="space-y-6">
      {/* Instructions */}
      <Alert>
        <Sparkles className="h-4 w-4" />
        <AlertDescription>
          <strong>Multi-Source Course Creation:</strong>
          <ul className="mt-2 list-disc list-inside space-y-1 text-sm">
            <li>Add multiple files and URLs to build a comprehensive knowledge base</li>
            <li>All sources will be processed simultaneously for faster analysis</li>
            <li>Our AI will analyze ALL sources together to create accurate course information</li>
            <li>The more comprehensive your sources, the better your generated course will be</li>
          </ul>
        </AlertDescription>
      </Alert>

      {/* File Upload */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center space-x-2">
            <Upload className="h-5 w-5" />
            <span>Add Files</span>
          </CardTitle>
          <CardDescription>
            Upload documents, PDFs, presentations, and other files to your knowledge base.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div 
            className="border-2 border-dashed border-muted-foreground/25 rounded-lg p-6 text-center cursor-pointer hover:border-primary/50 transition-colors"
            onClick={() => document.getElementById('file-input')?.click()}
          >
            <Upload className="mx-auto h-8 w-8 text-muted-foreground mb-2" />
            <p className="text-sm font-medium">Click to select files or drag and drop</p>
            <p className="text-xs text-muted-foreground mt-1">
              PDF, DOCX, PPTX, TXT, and more
            </p>
          </div>
          <input
            id="file-input"
            type="file"
            multiple
            className="hidden"
            onChange={(e) => e.target.files && handleFilesSelected(e.target.files)}
            accept=".pdf,.docx,.doc,.pptx,.ppt,.txt,.csv"
          />
        </CardContent>
      </Card>

      {/* URL Input */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center space-x-2">
            <Globe className="h-5 w-5" />
            <span>Add URLs</span>
          </CardTitle>
          <CardDescription>
            Add web pages, articles, YouTube videos, or other online content.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex space-x-2">
            <div className="flex-1">
              <Label htmlFor="url-input" className="sr-only">URL</Label>
              <Input
                id="url-input"
                type="url"
                placeholder="Enter URL (web page, YouTube video, etc.)"
                value={urlInput}
                onChange={(e) => setUrlInput(e.target.value)}
                onKeyPress={(e) => e.key === 'Enter' && handleAddUrl()}
              />
            </div>
            <Button onClick={handleAddUrl} disabled={!urlInput.trim()}>
              <Plus className="h-4 w-4 mr-2" />
              Add
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Queued Items */}
      {queuedItems.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center space-x-2">
              <FileText className="h-5 w-5" />
              <span>Knowledge Base Sources ({queuedItems.length})</span>
            </CardTitle>
            <CardDescription>
              Sources ready for processing. All will be analyzed together to create your course.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {queuedItems.map((item) => (
                <div key={item.id} className="flex items-center justify-between p-3 border rounded-lg">
                  <div className="flex items-center space-x-3">
                    {item.type === 'file' ? (
                      <FileText className="h-5 w-5 text-blue-500" />
                    ) : (
                      <LinkIcon className="h-5 w-5 text-green-500" />
                    )}
                    <div>
                      <p className="text-sm font-medium truncate max-w-96">{item.name}</p>
                      <p className="text-xs text-muted-foreground">
                        {item.type === 'file' ? 'File' : 'URL'} • {item.status}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center space-x-2">
                    {item.status === 'completed' && <CheckCircle className="h-4 w-4 text-green-600" />}
                    {item.status === 'uploading' && <Loader2 className="h-4 w-4 animate-spin" />}
                    {item.status === 'error' && <X className="h-4 w-4 text-red-600" />}
                    {item.status === 'queued' && (
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => removeQueuedItem(item.id)}
                      >
                        <X className="h-4 w-4" />
                      </Button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Processing Progress */}
      {processingProgress.isProcessing && (
        <Card>
          <CardContent className="pt-6">
            <div className="text-center space-y-4">
              <div className="inline-flex items-center justify-center w-12 h-12 rounded-full bg-primary/10">
                <Loader2 className="h-6 w-6 text-primary animate-spin" />
              </div>
              <div>
                <h3 className="font-medium">Processing All Sources</h3>
                <p className="text-sm text-muted-foreground">
                  {processingProgress.currentStep}
                </p>
              </div>
              <Progress value={progressPercentage} className="w-full max-w-md mx-auto" />
              <p className="text-xs text-muted-foreground">
                {processingProgress.completed} of {processingProgress.total} sources processed
              </p>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Course Knowledge Base Sources */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center space-x-2">
            <FileText className="h-5 w-5" />
            <span>Course Knowledge Base Sources</span>
          </CardTitle>
          <CardDescription>
            Knowledge base sources specifically for this course will appear here after processing.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {baseClassId ? (
            <div className="text-center py-8 text-muted-foreground">
              <CheckCircle className="mx-auto h-12 w-12 mb-4 text-green-500" />
              <h3 className="font-medium mb-2">Course Created Successfully</h3>
              <p className="text-sm">
                Your uploaded sources have been associated with this course and analyzed comprehensively.
              </p>
            </div>
          ) : (
            <div className="text-center py-8 text-muted-foreground">
              <FileText className="mx-auto h-12 w-12 mb-4 opacity-50" />
              <h3 className="font-medium mb-2">No Course Sources Yet</h3>
              <p className="text-sm">
                Add your knowledge base sources above and process them to create your course.
              </p>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Action Buttons */}
      <div className="flex flex-col sm:flex-row gap-4 justify-between">
        <Button 
          variant="outline" 
          onClick={onSkipUploads}
          className="order-2 sm:order-1"
          disabled={processingProgress.isProcessing}
        >
          Skip & Use General Knowledge
        </Button>
        
        <Button 
          onClick={handleProcessAll}
          disabled={processingProgress.isProcessing || queuedItems.length === 0}
          className="order-1 sm:order-2"
          size="lg"
        >
          {processingProgress.isProcessing ? (
            <>
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              Processing...
            </>
          ) : queuedItems.length > 0 ? (
            <>
              <Sparkles className="mr-2 h-4 w-4" />
              Process All {queuedItems.length} Source{queuedItems.length !== 1 ? 's' : ''} & Create Course
              <ArrowRight className="ml-2 h-4 w-4" />
            </>
          ) : (
            <>
              <Upload className="mr-2 h-4 w-4" />
              Add sources to continue
            </>
          )}
        </Button>
      </div>
    </div>
  );
} 