'use client'

import { useState, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { FileIcon, UploadIcon, XIcon, LinkIcon, YoutubeIcon } from 'lucide-react'
import { formatBytes } from '@/lib/utils'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Card, CardContent } from '@/components/ui/card'
import { toast } from '@/components/ui/use-toast'
import { Badge } from '@/components/ui/badge'
import { Alert, AlertDescription } from '@/components/ui/alert'
import Image from 'next/image'

// Define accepted file types
const ACCEPTED_FILE_TYPES = {
  document: [
    'application/pdf', // PDF
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document', // DOCX
    'application/msword', // DOC
    'application/vnd.openxmlformats-officedocument.presentationml.presentation', // PPTX
    'application/vnd.ms-powerpoint', // PPT
    'text/csv', // CSV
    'text/plain', // TXT
  ],
  media: [
    'audio/mpeg', // MP3
    'audio/wav', // WAV
    'audio/ogg', // OGG
    'video/mp4', // MP4
    'video/webm', // WEBM
    'video/ogg', // OGV
  ],
  image: [
    'image/jpeg',
    'image/png',
    'image/gif',
    'image/webp',
  ],
}

// All accepted types flattened
const ALL_ACCEPTED_TYPES = [
  ...ACCEPTED_FILE_TYPES.document,
  ...ACCEPTED_FILE_TYPES.media,
  ...ACCEPTED_FILE_TYPES.image,
]

// File extensions for displaying in the UI
const ACCEPTED_EXTENSIONS = [
  '.pdf', '.docx', '.doc', '.pptx', '.ppt', '.csv', '.txt',
  '.mp3', '.wav', '.ogg', '.mp4', '.webm', '.ogv',
  '.jpg', '.jpeg', '.png', '.gif', '.webp',
]

interface UploadedFile {
  file: File
  id: string
  previewUrl?: string
}

interface FileUploadDropzoneProps {
  organisationId: string
  onUrlSubmit?: (url: string) => Promise<void>
  maxFiles?: number
  maxSize?: number // in bytes
  className?: string
}

// Helper function to detect URL type with better pattern matching
function detectUrlType(url: string): 'youtube' | 'webpage' | null {
  // Try to ensure it's a valid URL first
  try {
    new URL(url);
  } catch {
    return null; // Not a valid URL
  }
  
  // Check for YouTube patterns
  const youtubePatterns = [
    /^(https?:\/\/)?(www\.)?(youtube\.com\/watch\?v=|youtu\.be\/|youtube\.com\/embed\/|youtube\.com\/v\/|youtube\.com\/user\/[^\/]+\/[^\/]+\/|youtube\.com\/[^\/]+#[^\/]+\/[^\/]+\/|youtube\.com\/channel\/[^\/]+\/[^\/]+\/)([^&?\/\s]{11})/i,
    /^(https?:\/\/)?(www\.)?(youtube\.com\/shorts\/|youtube\.com\/clip\/)([^&?\/\s]+)/i
  ];
  
  for (const pattern of youtubePatterns) {
    if (pattern.test(url)) {
      return 'youtube';
    }
  }
  
  // It's a valid URL but not YouTube
  return 'webpage';
}

export function FileUploadDropzone({
  organisationId,
  onUrlSubmit,
  maxFiles = 10,
  maxSize = 50 * 1024 * 1024, // 50MB default
  className,
}: FileUploadDropzoneProps) {
  const [files, setFiles] = useState<UploadedFile[]>([])
  const [isDragging, setIsDragging] = useState(false)
  const [url, setUrl] = useState('')
  const [urlType, setUrlType] = useState<'youtube' | 'webpage' | null>(null)
  const [isUploading, setIsUploading] = useState(false)
  const [urlValidationMessage, setUrlValidationMessage] = useState('')
  const router = useRouter()
  
  // Handle drag events
  const handleDragEnter = (e: React.DragEvent) => {
    e.preventDefault()
    e.stopPropagation()
    setIsDragging(true)
  }
  
  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault()
    e.stopPropagation()
    setIsDragging(false)
  }
  
  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault()
    e.stopPropagation()
    setIsDragging(true)
  }
  
  // Process dropped or selected files
  const processFiles = (fileList: FileList) => {
    // Convert FileList to array
    const fileArray = Array.from(fileList)
    
    // Check if adding new files would exceed the max limit
    if (files.length + fileArray.length > maxFiles) {
      toast({
        title: 'Too many files',
        description: `You can only upload a maximum of ${maxFiles} files at a time.`,
        variant: 'destructive',
      })
      return
    }
    
    // Validate and process files
    const validFiles = fileArray
      .filter(file => {
        // Validate file type
        if (!ALL_ACCEPTED_TYPES.includes(file.type)) {
          toast({
            title: 'Unsupported file type',
            description: `"${file.name}" is not a supported file type. Supported formats: ${ACCEPTED_EXTENSIONS.join(', ')}`,
            variant: 'destructive',
          })
          return false
        }
        
        // Validate file size
        if (file.size > maxSize) {
          toast({
            title: 'File too large',
            description: `"${file.name}" exceeds the maximum size of ${formatBytes(maxSize)}.`,
            variant: 'destructive',
          })
          return false
        }
        
        return true
      })
      .map(file => ({
        file,
        id: crypto.randomUUID(),
        previewUrl: file.type.startsWith('image/') ? URL.createObjectURL(file) : undefined,
      }))
    
    setFiles(prevFiles => [...prevFiles, ...validFiles])
  }
  
  // Handle file drop event
  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault()
    e.stopPropagation()
    setIsDragging(false)
    
    if (e.dataTransfer.files.length > 0) {
      processFiles(e.dataTransfer.files)
    }
  }
  
  // Handle manual file selection via file input
  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      processFiles(e.target.files)
      
      // Reset the input to allow selecting the same file again
      e.target.value = ''
    }
  }
  
  // Remove a file from the selection
  const removeFile = (id: string) => {
    setFiles(prevFiles => {
      const updatedFiles = prevFiles.filter(file => file.id !== id)
      return updatedFiles
    })
  }
  
  // Validate URL on change
  const handleUrlChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const newUrl = e.target.value;
    setUrl(newUrl);
    
    if (!newUrl.trim()) {
      setUrlType(null);
      setUrlValidationMessage('');
      return;
    }
    
    // Detect URL type
    const detectedType = detectUrlType(newUrl);
    setUrlType(detectedType);
    
    if (!detectedType) {
      setUrlValidationMessage('Please enter a valid URL starting with http:// or https://');
    } else if (detectedType === 'youtube') {
      setUrlValidationMessage('');
    } else {
      setUrlValidationMessage('');
    }
  };
  
  // Handle URL submission
  const handleUrlSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    const trimmedUrl = url.trim();
    if (!trimmedUrl) return;
    
    // Final validation check
    const detectedType = detectUrlType(trimmedUrl);
    if (!detectedType) {
      toast({
        title: 'Invalid URL',
        description: 'Please enter a valid URL starting with http:// or https://',
        variant: 'destructive',
      });
      return;
    }
    
    try {
      setIsUploading(true);
      
      // Create a document record directly via API with URL in metadata
      const response = await fetch('/api/knowledge-base/url', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          url: trimmedUrl,
          type: detectedType,
        }),
      });
      
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || `HTTP error! status: ${response.status}`);
      }
      
      // Clear URL input
      setUrl('');
      setUrlType(null);
      
      toast({
        title: 'URL submitted successfully',
        description: `The ${detectedType === 'youtube' ? 'YouTube video' : 'webpage'} has been submitted for processing.`,
      });
      
      // Refresh the file list
      router.refresh();
    } catch (error) {
      console.error('Error submitting URL:', error);
      toast({
        title: 'URL submission failed',
        description: error instanceof Error ? error.message : 'Failed to submit URL for processing',
        variant: 'destructive',
      });
    } finally {
      setIsUploading(false);
    }
  };
  
  // Handle uploading all files
  const handleUploadAll = async () => {
    if (files.length === 0) {
      toast({
        title: 'No files selected',
        description: 'Please select at least one file to upload.',
        variant: 'destructive',
      })
      return
    }
    
    try {
      setIsUploading(true)

      // Prepare form data
      const formData = new FormData()
      files.forEach((uploadedFile) => {
        formData.append('file', uploadedFile.file)
      })
      formData.append('organisation_id', organisationId)

      // Replace direct onUpload call with fetch to API endpoint
      const response = await fetch('/api/knowledge-base/upload', {
        method: 'POST',
        body: formData,
        // Headers might not be needed as FormData sets Content-Type
      })

      if (!response.ok) {
        const errorData = await response.json()
        throw new Error(errorData.error || `HTTP error! status: ${response.status}`)
      }

      // Assuming the API returns the details of the uploaded document(s)
      // const result = await response.json()

      // Clear files after successful upload
      setFiles([])
      
      toast({
        title: 'Upload successful',
        description: `${files.length} file${files.length !== 1 ? 's' : ''} uploaded successfully.`,
      })
      
      // Refresh the file list
      router.refresh()
    } catch (error) {
      console.error('Upload error:', error)
      toast({
        title: 'Upload failed',
        description: error instanceof Error ? error.message : 'Files failed to upload',
        variant: 'destructive',
      })
    } finally {
      setIsUploading(false)
    }
  }
  
  return (
    <div className={`space-y-4 ${className}`}>
      {/* Drag and drop area */}
      <div
        className={`border-2 border-dashed rounded-lg p-6 text-center cursor-pointer transition-colors ${
          isDragging ? 'border-primary bg-primary/5' : 'border-gray-300 hover:border-primary/50'
        }`}
        onDragEnter={handleDragEnter}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
        onClick={() => document.getElementById('file-upload')?.click()}
      >
        <div className="flex flex-col items-center justify-center space-y-2">
          <UploadIcon className="h-8 w-8 text-muted-foreground mb-2" />
          <h3 className="font-medium text-lg">Drag and drop files here</h3>
          <p className="text-sm text-muted-foreground">
            or click to browse <span className="underline">your device</span>
          </p>
          <p className="text-xs text-muted-foreground mt-2">
            Supported formats: {ACCEPTED_EXTENSIONS.join(', ')}
          </p>
          <p className="text-xs text-muted-foreground">
            Maximum file size: {formatBytes(maxSize)}
          </p>
        </div>
        <input
          id="file-upload"
          type="file"
          multiple
          accept={ACCEPTED_EXTENSIONS.join(',')}
          className="hidden"
          onChange={handleFileChange}
        />
      </div>
      
      {/* URL input for web pages */}
      {onUrlSubmit && (
        <div className="mt-4">
          <form onSubmit={handleUrlSubmit} className="space-y-2">
            <Label htmlFor="url-input" className="block mb-1 text-sm font-medium">
              Add Content from URL (YouTube videos or web pages)
            </Label>
            
            <div className="flex space-x-2">
              <div className="relative flex-grow">
                <Input
                  id="url-input"
                  type="url"
                  placeholder="Enter a URL (e.g., https://example.com/article or YouTube link)"
                  value={url}
                  onChange={handleUrlChange}
                  disabled={isUploading}
                  className="w-full pl-10" // Added left padding for icon
                />
                <div className="absolute inset-y-0 left-0 flex items-center pl-3 pointer-events-none">
                  {urlType === 'youtube' ? (
                    <YoutubeIcon className="h-4 w-4 text-red-500" />
                  ) : (
                    <LinkIcon className="h-4 w-4 text-muted-foreground" />
                  )}
                </div>
              </div>
              <Button 
                type="submit" 
                disabled={isUploading || !url.trim() || !urlType}
                className="flex-shrink-0"
              >
                {isUploading ? 'Adding...' : 'Add URL'}
              </Button>
            </div>
            
            {url.trim() && urlType && (
              <div className="text-xs mt-1 flex items-center space-x-2">
                <Badge variant={urlType === 'youtube' ? 'destructive' : 'secondary'}>
                  {urlType === 'youtube' ? 'YouTube Video' : 'Web Page'}
                </Badge>
                <span className="text-muted-foreground">
                  {urlType === 'youtube' 
                    ? 'Video transcript will be extracted for processing' 
                    : 'Page content will be extracted for processing'}
                </span>
              </div>
            )}
            
            {urlValidationMessage && (
              <Alert variant="destructive" className="mt-2 py-2">
                <AlertDescription className="text-xs">
                  {urlValidationMessage}
                </AlertDescription>
              </Alert>
            )}
          </form>
        </div>
      )}
      
      {/* File list preview */}
      {files.length > 0 && (
        <div className="mt-4">
          <h4 className="text-sm font-medium mb-2">Selected Files ({files.length})</h4>
          <div className="space-y-2">
            {files.map((file) => (
              <Card key={file.id} className="overflow-hidden">
                <CardContent className="p-3">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center space-x-3">
                      {file.previewUrl ? (
                        <div className="h-10 w-10 rounded overflow-hidden flex-shrink-0">
                          <Image
                            src={file.previewUrl}
                            alt={file.file.name}
                            width={40} 
                            height={40}
                            className="h-full w-full object-cover"
                          />
                        </div>
                      ) : (
                        <FileIcon className="h-10 w-10 text-primary flex-shrink-0" />
                      )}
                      <div className="truncate">
                        <p className="text-sm font-medium truncate">{file.file.name}</p>
                        <p className="text-xs text-muted-foreground">
                          {formatBytes(file.file.size)}
                        </p>
                      </div>
                    </div>
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => removeFile(file.id)}
                      className="flex-shrink-0"
                    >
                      <XIcon className="h-4 w-4" />
                    </Button>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
          
          <div className="mt-4 flex justify-end">
            <Button
              onClick={handleUploadAll}
              disabled={isUploading}
              className="w-full sm:w-auto"
            >
              {isUploading ? 'Uploading...' : `Upload ${files.length} file${files.length !== 1 ? 's' : ''}`}
            </Button>
          </div>
        </div>
      )}
    </div>
  )
} 