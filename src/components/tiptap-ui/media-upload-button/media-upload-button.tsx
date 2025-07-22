import React, { useCallback, useRef, useState } from 'react'
import { Editor } from '@tiptap/react'
import { 
  Image, 
  Video, 
  Music, 
  FileText, 
  Smile, 
  Upload,
  X,
  Check,
  AlertCircle,
  Loader2
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { Progress } from '@/components/ui/progress'
import { mediaUploadService, MediaType, SUPPORTED_MIME_TYPES } from '@/lib/media-upload-service'
import { cn } from '@/lib/utils'

interface MediaUploadButtonProps {
  editor: Editor
  className?: string
  variant?: 'default' | 'ghost' | 'outline'
  size?: 'default' | 'sm' | 'lg'
}

interface UploadState {
  isUploading: boolean
  progress: number
  status: string
  error?: string
}

const MEDIA_TYPES = [
  {
    type: 'IMAGE' as MediaType,
    label: 'Image',
    icon: Image,
    description: 'Upload images (JPG, PNG, GIF, WebP)',
    command: 'setImage'
  },
  {
    type: 'VIDEO' as MediaType,
    label: 'Video',
    icon: Video,
    description: 'Upload videos (MP4, WebM, MOV)',
    command: 'setVideo'
  },
  {
    type: 'AUDIO' as MediaType,
    label: 'Audio',
    icon: Music,
    description: 'Upload audio files (MP3, WAV, OGG)',
    command: 'setAudio'
  },
  {
    type: 'DOCUMENT' as MediaType,
    label: 'File',
    icon: FileText,
    description: 'Upload documents (PDF, DOC, TXT)',
    command: 'setFile'
  }
] as const

export const MediaUploadButton: React.FC<MediaUploadButtonProps> = ({
  editor,
  className,
  variant = 'ghost',
  size = 'sm'
}) => {
  const [uploadState, setUploadState] = useState<UploadState>({
    isUploading: false,
    progress: 0,
    status: ''
  })
  const [isOpen, setIsOpen] = useState(false)
  const fileInputRefs = useRef<{ [key in MediaType]?: HTMLInputElement }>({})

  const handleUpload = useCallback(async (files: File[], mediaType: MediaType) => {
    if (files.length === 0) return

    setUploadState({
      isUploading: true,
      progress: 0,
      status: 'Starting upload...'
    })

    try {
      const uploadPromises = files.map(file => 
        mediaUploadService.uploadMedia(file, {
          onProgress: (event) => {
            setUploadState(prev => ({
              ...prev,
              progress: event.progress,
              status: event.status
            }))
          }
        })
      )

      const results = await Promise.all(uploadPromises)

      // Insert media into editor based on type
      results.forEach(result => {
        switch (result.mediaType) {
          case 'IMAGE':
            editor.chain().focus().setImage({ 
              src: result.url,
              alt: result.metadata?.alt || result.fileName,
              title: result.metadata?.caption
            }).run()
            break
          
          case 'VIDEO':
            editor.chain().focus().setVideo({ 
              src: result.url,
              title: result.metadata?.caption || result.fileName
            }).run()
            break
          
          case 'AUDIO':
            // Insert as a custom audio block
            editor.chain().focus().insertContent(`
              <div class="audio-embed">
                <audio controls>
                  <source src="${result.url}" type="${result.mimeType}">
                  Your browser does not support the audio element.
                </audio>
                <p class="audio-caption">${result.metadata?.caption || result.fileName}</p>
              </div>
            `).run()
            break
          
          case 'DOCUMENT':
            // Insert as a file link
            const fileSize = mediaUploadService.formatFileSize(result.fileSize)
            const icon = mediaUploadService.getMediaIcon(result.mediaType)
            editor.chain().focus().insertContent(`
              <div class="file-embed">
                <a href="${result.url}" target="_blank" rel="noopener noreferrer" class="file-link">
                  <span class="file-icon">${icon}</span>
                  <div class="file-info">
                    <span class="file-name">${result.fileName}</span>
                    <span class="file-size">${fileSize}</span>
                  </div>
                </a>
              </div>
            `).run()
            break
        }
      })

      setUploadState({
        isUploading: false,
        progress: 100,
        status: `Successfully uploaded ${results.length} file(s)!`
      })

      // Clear success message after 2 seconds
      setTimeout(() => {
        setUploadState(prev => ({ ...prev, status: '', progress: 0 }))
      }, 2000)

    } catch (error) {
      console.error('Upload failed:', error)
      setUploadState({
        isUploading: false,
        progress: 0,
        status: '',
        error: error instanceof Error ? error.message : 'Upload failed'
      })

      // Clear error after 5 seconds
      setTimeout(() => {
        setUploadState(prev => ({ ...prev, error: undefined }))
      }, 5000)
    }
  }, [editor])

  const triggerFileInput = (mediaType: MediaType) => {
    const input = fileInputRefs.current[mediaType]
    if (input) {
      input.click()
    }
    setIsOpen(false)
  }

  const handleEmojiInsert = () => {
    // Simple emoji picker - you could integrate a more sophisticated one
    const commonEmojis = ['😀', '😂', '😍', '🤔', '👍', '👎', '❤️', '🔥', '✨', '🎉']
    const randomEmoji = commonEmojis[Math.floor(Math.random() * commonEmojis.length)]
    editor.chain().focus().insertContent(randomEmoji).run()
    setIsOpen(false)
  }

  return (
    <div className="relative">
      <DropdownMenu open={isOpen} onOpenChange={setIsOpen}>
        <DropdownMenuTrigger asChild>
          <Button
            variant={variant}
            size={size}
            className={cn(
              "gap-2",
              uploadState.isUploading && "cursor-not-allowed opacity-50",
              className
            )}
            disabled={uploadState.isUploading}
          >
            {uploadState.isUploading ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Upload className="h-4 w-4" />
            )}
            Media
          </Button>
        </DropdownMenuTrigger>

        <DropdownMenuContent align="start" className="w-64">
          {MEDIA_TYPES.map(({ type, label, icon: Icon, description }) => (
            <DropdownMenuItem
              key={type}
              onClick={() => triggerFileInput(type)}
              className="flex items-center gap-3 p-3 cursor-pointer"
            >
              <Icon className="h-5 w-5 text-gray-600" />
              <div className="flex-1">
                <div className="font-medium">{label}</div>
                <div className="text-xs text-gray-500">{description}</div>
              </div>
            </DropdownMenuItem>
          ))}
          
          <DropdownMenuSeparator />
          
          <DropdownMenuItem
            onClick={handleEmojiInsert}
            className="flex items-center gap-3 p-3 cursor-pointer"
          >
            <Smile className="h-5 w-5 text-gray-600" />
            <div className="flex-1">
              <div className="font-medium">Emoji</div>
              <div className="text-xs text-gray-500">Insert random emoji</div>
            </div>
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>

      {/* Hidden file inputs */}
      {MEDIA_TYPES.map(({ type }) => (
        <input
          key={type}
          ref={(el) => {
            if (el) fileInputRefs.current[type] = el
          }}
          type="file"
          accept={SUPPORTED_MIME_TYPES[type].join(',')}
          multiple
          className="hidden"
          onChange={(e) => {
            const files = Array.from(e.target.files || [])
            if (files.length > 0) {
              handleUpload(files, type)
            }
            e.target.value = '' // Reset input
          }}
        />
      ))}

      {/* Upload progress indicator */}
      {(uploadState.isUploading || uploadState.status || uploadState.error) && (
        <div className="absolute top-full left-0 mt-2 w-64 bg-white dark:bg-gray-800 border rounded-lg shadow-lg p-3 z-50">
          {uploadState.isUploading && (
            <div className="space-y-2">
              <div className="flex items-center gap-2">
                <Loader2 className="h-4 w-4 animate-spin" />
                <span className="text-sm">{uploadState.status}</span>
              </div>
              <Progress value={uploadState.progress} className="w-full" />
            </div>
          )}

          {uploadState.status && !uploadState.isUploading && (
            <div className="flex items-center gap-2 text-green-600">
              <Check className="h-4 w-4" />
              <span className="text-sm">{uploadState.status}</span>
            </div>
          )}

          {uploadState.error && (
            <div className="flex items-center gap-2 text-red-600">
              <AlertCircle className="h-4 w-4" />
              <span className="text-sm">{uploadState.error}</span>
              <button
                onClick={() => setUploadState(prev => ({ ...prev, error: undefined }))}
                className="ml-auto text-gray-400 hover:text-gray-600"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  )
}

export default MediaUploadButton 