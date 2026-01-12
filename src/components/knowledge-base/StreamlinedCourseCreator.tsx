'use client';

import React, { useState, useCallback, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Progress } from '@/components/ui/progress';
import { Label } from '@/components/ui/label';
import { 
  Upload, 
  Plus, 
  X, 
  FileText, 
  Globe, 
  Sparkles, 
  ArrowRight,
  Loader2,
  CheckCircle,
  AlertCircle
} from 'lucide-react';
import { formatBytes } from '@/lib/utils';
import { toast } from '@/components/ui/use-toast';
import LunaContextElement from '@/components/luna/LunaContextElement';
import { supabase } from '@/utils/supabase/browser';

interface StreamlinedCourseCreatorProps {
  userId: string;
  organisationId: string;
  existingBaseClassId?: string;
}

interface QueuedItem {
  id: string;
  type: 'file' | 'url';
  name: string;
  file?: File;
  url?: string;
  status: 'queued' | 'uploading' | 'completed' | 'error';
  size?: number;
}

interface GeneratedCourseInfo {
  name: string;
  description: string;
  subject: string;
  targetAudience: string;
  learningObjectives: string[];
}

const ACCEPTED_FILE_TYPES = [
  'application/pdf',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'application/msword',
  'application/vnd.openxmlformats-officedocument.presentationml.presentation',
  'application/vnd.ms-powerpoint',
  'text/csv',
  'text/plain',
  // Image types for AI text extraction
  'image/jpeg',
  'image/jpg',
  'image/png',
  'image/gif',
  'image/webp',
];

const MAX_FILE_SIZE = 50 * 1024 * 1024; // 50MB

export default function StreamlinedCourseCreator({ 
  userId, 
  organisationId, 
  existingBaseClassId 
}: StreamlinedCourseCreatorProps) {
  const router = useRouter();
  const fileInputRef = useRef<HTMLInputElement>(null);
  
  const [creationStep, setCreationStep] = useState<'upload' | 'processing' | 'review'>('upload');
  const [queuedItems, setQueuedItems] = useState<QueuedItem[]>([]);
  const [urlInput, setUrlInput] = useState('');
  const [instructions, setInstructions] = useState('');
  
  const [isProcessing, setIsProcessing] = useState(false);
  const [progress, setProgress] = useState(0);
  const [processingMessage, setProcessingMessage] = useState('');
  
  const [isDragging, setIsDragging] = useState(false);

  const [analysisResult, setAnalysisResult] = useState<GeneratedCourseInfo | null>(null);
  const [baseClassId, setBaseClassId] = useState<string | null>(existingBaseClassId || null);
  const [isUpdating, setIsUpdating] = useState(false);

	// Function to wait for all documents associated with a base class to be processed
	// Enhanced: polls chunk-level progress so the UI shows movement during long PDFs
	const waitForDocumentProcessing = async (baseClassId: string, organisationId: string): Promise<void> => {
    const maxWaitTime = 10 * 60 * 1000; // 10 minutes max wait
    const pollInterval = 3000; // Check every 3 seconds
    const startTime = Date.now();
    while (Date.now() - startTime < maxWaitTime) {
      try {
        // Fetch documents associated with this base class
        const { data: documents, error } = await supabase
          .from('documents')
					.select('id, status, file_name, metadata')
          .eq('organisation_id', organisationId)
          .eq('base_class_id', baseClassId);

        if (error) {
          console.error('Error fetching documents:', error);
          throw new Error('Failed to check document processing status');
        }

        if (!documents || documents.length === 0) {
          throw new Error('No documents found for this course');
        }

				// Check if all documents are processed
        const processingDocuments = documents.filter((doc: any) => 
          doc.status === 'queued' || doc.status === 'processing'
        );
        const errorDocuments = documents.filter((doc: any) => doc.status === 'error');
        const completedDocuments = documents.filter((doc: any) => doc.status === 'completed');

        console.log(`Document processing status: ${completedDocuments.length} completed, ${processingDocuments.length} processing, ${errorDocuments.length} errors`);

        // If there are error documents, provide specific error information
        if (errorDocuments.length > 0) {
          const errorMessages = errorDocuments.map((doc: any) => {
            const metadata = doc.metadata as any;
            const error = metadata?.processing_error;
            const errorMsg = error?.userFriendlyMessage || error?.message || 'Processing failed';
            
            // Check for OpenAI API key errors
            if (errorMsg.includes('Incorrect API key') || errorMsg.includes('invalid_api_key')) {
              return `${doc.file_name}: OpenAI API configuration error. Please contact support.`;
            }
            
            return `${doc.file_name}: ${errorMsg}`;
          }).join('\n\n');
          
          throw new Error(`Document processing failed:\n\n${errorMessages}`);
        }

				// If all documents are completed, we're done
				if (processingDocuments.length === 0) {
					console.log('All documents processed successfully');
					setProcessingMessage(`Processing complete (${completedDocuments.length}/${documents.length})`);
					setProgress(90);
					return;
				}

				// Enhanced progress: compute chunk-level summarization progress across all documents
				let totalChunks = 0;
				let completedChunks = 0;
				for (const d of documents) {
					// Total chunks for document
					const { count: docTotalCount } = await supabase
						.from('document_chunks')
						.select('id', { count: 'exact', head: true })
						.eq('document_id', d.id);
					// Completed summarized chunks for document
					const { count: docCompletedCount } = await supabase
						.from('document_chunks')
						.select('id', { count: 'exact', head: true })
						.eq('document_id', d.id)
						.eq('summary_status', 'completed');

					totalChunks += docTotalCount || 0;
					completedChunks += docCompletedCount || 0;
				}

				if (totalChunks > 0) {
					const chunkPct = Math.floor((completedChunks / totalChunks) * 100);
					setProcessingMessage(`Summarizing chunks… ${completedChunks}/${totalChunks} (${chunkPct}%) • Documents: ${completedDocuments.length}/${documents.length} complete`);
					// Map chunk progress into progress bar range [50, 90]
					const bar = 50 + Math.floor(40 * (completedChunks / totalChunks));
					setProgress(bar);
				} else {
					// Chunking phase (no chunks yet) – show document progress
					setProcessingMessage(`Chunking and embedding… • Documents: ${completedDocuments.length}/${documents.length} complete`);
					setProgress(55);
				}

        // Wait before next check
        await new Promise(resolve => setTimeout(resolve, pollInterval));

      } catch (error) {
        console.error('Error waiting for document processing:', error);
        throw error;
      }
    }

    // Timeout reached
    throw new Error('Document processing timed out. Please try again or contact support.');
  };

  // Handle file selection
  const handleFileSelect = useCallback((files: FileList) => {
    const validFiles = Array.from(files).filter(file => {
      if (!ACCEPTED_FILE_TYPES.includes(file.type)) {
        toast({
          title: 'Unsupported file type',
          description: `"${file.name}" is not supported. Please use PDF, Word, PowerPoint, text files, or images.`,
          variant: 'destructive',
        });
        return false;
      }
      
      if (file.size > MAX_FILE_SIZE) {
        toast({
          title: 'File too large',
          description: `"${file.name}" exceeds the 50MB limit.`,
          variant: 'destructive',
        });
        return false;
      }
      
      return true;
    });

    const newItems: QueuedItem[] = validFiles.map(file => ({
      id: crypto.randomUUID(),
      type: 'file',
      name: file.name,
      file,
      status: 'queued',
      size: file.size
    }));

    setQueuedItems(prev => [...prev, ...newItems]);
  }, []);

  // Handle URL addition
  const handleAddUrl = useCallback(() => {
    if (!urlInput.trim()) return;
    
    try {
      new URL(urlInput); // Validate URL
      
      // YouTube URLs are now supported with LangChain integration!
      
      const newItem: QueuedItem = {
        id: crypto.randomUUID(),
        type: 'url',
        name: urlInput,
        url: urlInput,
        status: 'queued'
      };
      
      setQueuedItems(prev => [...prev, newItem]);
      setUrlInput('');
    } catch {
      toast({
        title: 'Invalid URL',
        description: 'Please enter a valid URL starting with http:// or https://',
        variant: 'destructive',
      });
    }
  }, [urlInput]);

  // Remove item from queue
  const removeItem = useCallback((id: string) => {
    setQueuedItems(prev => prev.filter(item => item.id !== id));
  }, []);

  // Handle drag and drop
  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  }, []);

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
  }, []);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    
    if (e.dataTransfer.files.length > 0) {
      handleFileSelect(e.dataTransfer.files);
    }
  }, [handleFileSelect]);

  // Process all items and create course
  const handleCreateCourse = useCallback(async () => {
    if (queuedItems.length === 0) {
      toast({
        title: 'No content added',
        description: 'Please add some files or URLs to create your course.',
        variant: 'destructive',
      });
      return;
    }

    setIsProcessing(true);
    setCreationStep('processing');
    setProgress(0);
    setProcessingMessage('Preparing course...');

    try {
      // Step 1: Create base class if it doesn't exist
      let newBaseClassId = baseClassId;
      if (!newBaseClassId) {
        setProcessingMessage('Creating course structure...');
        setProgress(10);
        
        const baseClassResponse = await fetch('/api/knowledge-base/create-placeholder-base-class', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ organisationId, userId }),
        });

        const baseClassData = await baseClassResponse.json();
        if (!baseClassData.success) {
          throw new Error(baseClassData.error || 'Failed to create course structure');
        }
        newBaseClassId = baseClassData.baseClassId;
        setBaseClassId(newBaseClassId);
      }

      // Step 2: Upload all content
      setProcessingMessage('Uploading content...');
      setProgress(30);

      const uploadPromises = queuedItems.map(async (item) => {
        setQueuedItems(prev => prev.map(qi => 
          qi.id === item.id ? { ...qi, status: 'uploading' } : qi
        ));

        try {
          if (item.type === 'file' && item.file) {
            const formData = new FormData();
            formData.append('file', item.file);
            formData.append('organisation_id', organisationId);
            // Pass the base class ID so document is linked immediately
            if (newBaseClassId) {
              formData.append('base_class_id', newBaseClassId);
            }

            const response = await fetch('/api/knowledge-base/upload', {
              method: 'POST',
              body: formData,
            });

            if (!response.ok) {
              const errorData = await response.json().catch(() => ({}));
              const errorMessage = errorData.error || errorData.message || `Upload failed with status ${response.status}`;
              throw new Error(errorMessage);
            }
          } else if (item.type === 'url' && item.url) {
            const urlType = item.url.includes('youtube.com') || item.url.includes('youtu.be') ? 'youtube' : 'webpage';
            
            const response = await fetch('/api/knowledge-base/url', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ 
                url: item.url, 
                type: urlType,
                // Pass the base class ID so document is linked immediately
                base_class_id: newBaseClassId
              }),
            });

            if (!response.ok) {
              const errorData = await response.json().catch(() => ({}));
              const errorMessage = errorData.error || errorData.message || `URL processing failed with status ${response.status}`;
              throw new Error(errorMessage);
            }
          }

          setQueuedItems(prev => prev.map(qi => 
            qi.id === item.id ? { ...qi, status: 'completed' } : qi
          ));
        } catch (error) {
          setQueuedItems(prev => prev.map(qi => 
            qi.id === item.id ? { ...qi, status: 'error' } : qi
          ));
          throw error;
        }
      });

      await Promise.all(uploadPromises);

      // Step 3: Wait for document processing to complete (running in background)
      setProcessingMessage('🔄 Processing documents in background... Large PDFs may take several minutes.');
      setProgress(50);

      // Wait for all documents to be processed
      if (!newBaseClassId) {
        throw new Error('Failed to create course - missing base class ID');
      }
      await waitForDocumentProcessing(newBaseClassId, organisationId);

      // Step 4: Analyze and generate course info (documents are already linked to base class)
      setProcessingMessage('Analyzing content...');
      setProgress(70);

      const analysisResponse = await fetch('/api/knowledge-base/analyze-and-generate-course-info', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          baseClassId: newBaseClassId,
          organisationId,
          instructions: instructions.trim() || undefined,
        }),
      });

      const analysisData = await analysisResponse.json();
      if (!analysisData.success) {
        throw new Error(analysisData.error || 'Failed to analyze content');
      }
      
      // NEW: Transition to review step instead of redirecting
      setAnalysisResult(analysisData.courseInfo);
      setCreationStep('review');
      setIsProcessing(false);

    } catch (error) {
      console.error('Course creation failed:', error);
      toast({
        title: 'Course creation failed',
        description: error instanceof Error ? error.message : 'An unexpected error occurred',
        variant: 'destructive',
      });
      setIsProcessing(false);
      setCreationStep('upload');
      setProgress(0);
      setProcessingMessage('');
    }
  }, [queuedItems, instructions, organisationId, userId, baseClassId]);

  const handleConfirmAndUpdate = async () => {
    if (!baseClassId || !analysisResult) return;

    setIsUpdating(true);
    try {
      const response = await fetch('/api/knowledge-base/update-base-class-info', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          baseClassId,
          courseInfo: {
            name: analysisResult.name,
            description: analysisResult.description,
            subject: analysisResult.subject,
            targetAudience: analysisResult.targetAudience,
            learningObjectives: analysisResult.learningObjectives,
          },
        }),
      });

      const data = await response.json();
      if (!data.success) {
        throw new Error(data.error || 'Failed to update course details');
      }

      toast({
        title: 'Course details confirmed!',
        description: 'Proceeding to course generation options.',
      });

      router.push(`/teach/knowledge-base/${baseClassId}`);

    } catch (error) {
      console.error('Failed to update course info:', error);
      toast({
        title: 'Update failed',
        description: error instanceof Error ? error.message : 'Could not save changes.',
        variant: 'destructive',
      });
    } finally {
      setIsUpdating(false);
    }
  };
  
  const renderUploadStep = () => (
    <div className="space-y-8">
      {/* Upload Area - Following card design from style guide */}
      <Card className="border border-border shadow-sm">
        <CardContent className="p-8">
          <div
            className={`border-2 border-dashed rounded-xl p-12 text-center transition-all duration-200 cursor-pointer ${
              isDragging 
                ? 'border-primary bg-primary/5' 
                : 'border-border hover:border-primary/50 hover:bg-muted/50'
            }`}
            onDragOver={handleDragOver}
            onDragLeave={handleDragLeave}
            onDrop={handleDrop}
            onClick={() => fileInputRef.current?.click()}
          >
            <Upload className="mx-auto h-12 w-12 text-muted-foreground mb-4" />
            <h3 className="text-xl font-medium text-foreground mb-2">
              Drop files here or click to browse
            </h3>
            <p className="text-muted-foreground">
              PDF, Word, text files, or images up to 50MB each
            </p>
            <input
              ref={fileInputRef}
              type="file"
              multiple
              accept=".pdf,.docx,.doc,.txt,.csv,.jpg,.jpeg,.png,.gif,.webp"
              className="hidden"
              onChange={(e) => e.target.files && handleFileSelect(e.target.files)}
            />
          </div>

          {/* URL Input - Following form input design */}
          <div className="mt-8 pt-8 border-t border-border">
            <div className="flex items-center gap-3">
              <div className="flex-1">
                <Input
                  placeholder="Add a URL"
                  value={urlInput}
                  onChange={(e) => setUrlInput(e.target.value)}
                  onKeyPress={(e) => e.key === 'Enter' && handleAddUrl()}
                  className="bg-background border-border focus:border-primary focus:ring-primary"
                />
                <p className="text-sm text-muted-foreground mt-2">
                  Supports website URL's (Youtube video URL coming soon)
                </p>
              </div>
              <Button
                onClick={handleAddUrl}
                disabled={!urlInput.trim()}
                variant="outline"
                className="px-6 border-primary text-primary hover:bg-primary hover:text-primary-foreground"
              >
                <Plus className="h-4 w-4 mr-2" />
                Add
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Queued Items - Following style guide card design */}
      {queuedItems.length > 0 && (
        <Card className="border border-border shadow-sm">
          <CardContent className="p-6">
            <h3 className="text-lg font-medium text-foreground mb-4">
              Content ({queuedItems.length})
            </h3>
            <div className="space-y-3">
              {queuedItems.map((item) => (
                <div
                  key={item.id}
                  className="flex items-center justify-between p-4 bg-muted/50 rounded-lg border border-border/50"
                >
                  <div className="flex items-center space-x-3">
                    {item.type === 'file' ? (
                      <FileText className="h-5 w-5 text-primary" />
                    ) : (
                      <Globe className="h-5 w-5 text-primary" />
                    )}
                    <div>
                      <p className="font-medium text-foreground truncate max-w-md">
                        {item.name}
                      </p>
                      {item.size && (
                        <p className="text-sm text-muted-foreground">
                          {formatBytes(item.size)}
                        </p>
                      )}
                    </div>
                  </div>
                  <div className="flex items-center space-x-2">
                    {item.status === 'completed' && (
                      <CheckCircle className="h-5 w-5 text-green-600" />
                    )}
                    {item.status === 'uploading' && (
                      <Loader2 className="h-5 w-5 animate-spin text-primary" />
                    )}
                    {item.status === 'error' && (
                      <AlertCircle className="h-5 w-5 text-destructive" />
                    )}
                    {item.status === 'queued' && (
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => removeItem(item.id)}
                        className="hover:bg-muted"
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

      {/* Instructions - Following style guide form design */}
      <Card className="border border-border shadow-sm">
        <CardContent className="p-6">
          <h3 className="text-lg font-medium text-foreground mb-4">
            Instructions (Optional)
          </h3>
          <Textarea
            placeholder="Tell us about your course goals, target audience, or any specific requirements..."
            value={instructions}
            onChange={(e) => setInstructions(e.target.value)}
            rows={4}
            className="bg-background border-border focus:border-primary focus:ring-primary resize-none"
          />
        </CardContent>
      </Card>

      {/* Create Button - Following style guide button design */}
      <div className="text-center">
        <Button
          onClick={handleCreateCourse}
          disabled={isProcessing || queuedItems.length === 0}
          size="lg"
          className="px-12 py-4 text-lg bg-primary hover:bg-primary/90 text-primary-foreground rounded-lg shadow-sm hover:shadow-md transition-all duration-200"
        >
          {isProcessing ? (
            <>
              <Loader2 className="mr-3 h-5 w-5 animate-spin" />
              Creating Course...
            </>
          ) : (
            <>
              <Sparkles className="mr-3 h-5 w-5" />
              Create Course
              <ArrowRight className="ml-3 h-5 w-5" />
            </>
          )}
        </Button>
      </div>
    </div>
  );

  const renderProcessingStep = () => (
    <Card className="border border-border shadow-sm">
      <CardContent className="p-8 text-center">
        <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-primary/10 mb-4">
          <Loader2 className="h-8 w-8 text-primary animate-spin" />
        </div>
        <h3 className="text-lg font-medium text-foreground mb-2">
          {processingMessage}
        </h3>
        <Progress value={progress} className="w-full max-w-md mx-auto mb-4" />
        <p className="text-muted-foreground">
          This may take a few moments...
        </p>
      </CardContent>
    </Card>
  );

  const renderReviewStep = () => {
    if (!analysisResult) return null;

    return (
      <div className="space-y-8">
        {/* Header Section with AI Badge */}
        <div className="text-center">
          <div className="inline-flex items-center gap-2 px-4 py-2 bg-primary/10 rounded-full mb-6">
            <Sparkles className="h-4 w-4 text-primary" />
            <span className="text-sm font-medium text-primary">AI-Generated</span>
          </div>
        </div>

        {/* Course Details Card */}
        <Card className="border border-border shadow-sm bg-gradient-to-br from-background to-muted/20">
          <CardContent className="p-8">
            <div className="space-y-8">
              {/* Course Name */}
              <div className="space-y-3">
                <Label 
                  htmlFor="course-name" 
                  className="text-base font-semibold text-foreground tracking-tight"
                >
                  Course Name
                </Label>
                <Input
                  id="course-name"
                  value={analysisResult?.name || ''}
                  onChange={(e) => setAnalysisResult(prev => prev ? { ...prev, name: e.target.value } : null)}
                  className="h-12 text-lg bg-background/50 border-border hover:border-primary/50 focus:border-primary focus:ring-primary/20 transition-all duration-200"
                  placeholder="Enter course name"
                />
              </div>

              {/* Course Description */}
              <div className="space-y-3">
                <Label 
                  htmlFor="course-description" 
                  className="text-base font-semibold text-foreground tracking-tight"
                >
                  Course Description
                </Label>
                <Textarea
                  id="course-description"
                  value={analysisResult?.description || ''}
                  onChange={(e) => setAnalysisResult(prev => prev ? { ...prev, description: e.target.value } : null)}
                  rows={5}
                  className="text-base bg-background/50 border-border hover:border-primary/50 focus:border-primary focus:ring-primary/20 transition-all duration-200 resize-none"
                  placeholder="Describe what students will learn in this course"
                />
              </div>

              {/* Learning Objectives */}
              <div className="space-y-4">
                <Label className="text-base font-semibold text-foreground tracking-tight">
                  Learning Objectives
                </Label>
                <div className="space-y-3">
                  {analysisResult.learningObjectives.map((obj, index) => (
                    <div key={index} className="group flex items-center gap-3">
                      <div className="flex-shrink-0 w-6 h-6 rounded-full bg-primary/10 flex items-center justify-center">
                        <span className="text-xs font-medium text-primary">{index + 1}</span>
                      </div>
                      <Input
                        value={obj}
                        onChange={(e) => {
                          const newObjectives = [...analysisResult.learningObjectives];
                          newObjectives[index] = e.target.value;
                          setAnalysisResult(prev => prev ? { ...prev, learningObjectives: newObjectives } : null);
                        }}
                        className="flex-1 bg-background/50 border-border hover:border-primary/50 focus:border-primary focus:ring-primary/20 transition-all duration-200"
                        placeholder={`Learning objective ${index + 1}`}
                      />
                      <Button 
                        variant="ghost" 
                        size="icon" 
                        onClick={() => {
                          const newObjectives = analysisResult.learningObjectives.filter((_, i) => i !== index);
                          setAnalysisResult(prev => prev ? { ...prev, learningObjectives: newObjectives } : null);
                        }}
                        className="opacity-0 group-hover:opacity-100 transition-opacity duration-200 hover:bg-destructive/10 hover:text-destructive"
                      >
                        <X className="h-4 w-4" />
                      </Button>
                    </div>
                  ))}
                  
                  <Button 
                    variant="outline" 
                    onClick={() => {
                      const newObjectives = [...analysisResult.learningObjectives, ''];
                      setAnalysisResult(prev => prev ? { ...prev, learningObjectives: newObjectives } : null);
                    }}
                    className="w-full h-12 border-dashed border-border hover:border-primary hover:bg-primary/5 transition-all duration-200"
                  >
                    <Plus className="h-4 w-4 mr-2" /> 
                    Add Learning Objective
                  </Button>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Action Button */}
        <div className="flex justify-center pt-4">
          <Button 
            onClick={handleConfirmAndUpdate} 
            disabled={isUpdating} 
            size="lg"
            className="px-12 py-4 text-lg bg-primary hover:bg-primary/90 text-primary-foreground rounded-xl shadow-lg hover:shadow-xl transition-all duration-300 transform hover:scale-[1.02] disabled:transform-none disabled:hover:scale-100"
          >
            {isUpdating ? (
              <>
                <Loader2 className="mr-3 h-5 w-5 animate-spin" />
                Updating Course...
              </>
            ) : (
              <>
                <CheckCircle className="mr-3 h-5 w-5" />
                Confirm and Continue
                <ArrowRight className="ml-3 h-5 w-5" />
              </>
            )}
          </Button>
        </div>
      </div>
    );
  };

  return (
    <LunaContextElement
      type="course-creation-interface"
      role="form"
      content={{
        title: "Create Your Course",
        description: "Upload your content and let AI transform it into a comprehensive course",
        queuedItems: queuedItems.length,
        instructions: instructions,
        isProcessing: isProcessing,
        currentStep: processingMessage,
        progress: progress
      }}
      state={{
        hasContent: queuedItems.length > 0,
        isProcessing: isProcessing,
        canCreateCourse: queuedItems.length > 0 && !isProcessing
      }}
      metadata={{
        organisationId: organisationId,
        userId: userId,
        existingBaseClassId: existingBaseClassId
      }}
      actionable={true}
    >
      <div className="min-h-screen bg-background">
        <div className="container mx-auto px-4 py-8 max-w-4xl">
          <div className="text-center mb-12">
            <h1 className="text-4xl font-bold text-foreground mb-4 tracking-tight">
              {creationStep === 'review' ? 'Review Course Details' : 'Create Your Course'}
            </h1>
            <p className="text-lg text-muted-foreground max-w-2xl mx-auto leading-relaxed">
              {creationStep === 'review' 
                ? 'Fine-tune the generated details before the next step.' 
                : 'Upload your content and let AI transform it into a comprehensive course'}
            </p>
          </div>
          
          {creationStep === 'upload' && renderUploadStep()}
          {creationStep === 'processing' && renderProcessingStep()}
          {creationStep === 'review' && renderReviewStep()}

        </div>
      </div>
    </LunaContextElement>
  );
} 