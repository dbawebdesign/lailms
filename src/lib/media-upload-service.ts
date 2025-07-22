import { createClient } from '@/lib/supabase/client'

// File size limits (in bytes)
export const FILE_SIZE_LIMITS = {
  IMAGE: 10 * 1024 * 1024, // 10MB
  VIDEO: 100 * 1024 * 1024, // 100MB
  AUDIO: 50 * 1024 * 1024, // 50MB
  DOCUMENT: 25 * 1024 * 1024, // 25MB
  ARCHIVE: 50 * 1024 * 1024, // 50MB
} as const

// Supported MIME types
export const SUPPORTED_MIME_TYPES = {
  IMAGE: [
    'image/jpeg', 'image/jpg', 'image/png', 'image/gif', 'image/webp', 
    'image/svg+xml', 'image/bmp', 'image/tiff'
  ],
  VIDEO: [
    'video/mp4', 'video/webm', 'video/ogg', 'video/avi', 'video/mov', 
    'video/wmv', 'video/flv', 'video/mkv'
  ],
  AUDIO: [
    'audio/mp3', 'audio/mpeg', 'audio/wav', 'audio/ogg', 'audio/aac', 
    'audio/flac', 'audio/m4a'
  ],
  DOCUMENT: [
    'application/pdf', 'application/msword', 
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    'application/vnd.ms-excel', 
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    'application/vnd.ms-powerpoint', 
    'application/vnd.openxmlformats-officedocument.presentationml.presentation',
    'text/plain', 'text/csv', 'text/rtf'
  ],
  ARCHIVE: [
    'application/zip', 'application/x-rar-compressed', 'application/x-7z-compressed'
  ]
} as const

export type MediaType = keyof typeof SUPPORTED_MIME_TYPES
export type UploadProgress = { progress: number; status: string }

interface MediaUploadResult {
  url: string
  fileName: string
  fileSize: number
  mimeType: string
  mediaType: MediaType
  metadata?: Record<string, any>
}

interface UploadOptions {
  onProgress?: (event: UploadProgress) => void
  abortSignal?: AbortSignal
  caption?: string
  alt?: string
}

export class MediaUploadService {
  private supabase = createClient()
  private bucketName = 'user-notes-content'

  /**
   * Determines the media type from MIME type
   */
  private getMediaType(mimeType: string): MediaType {
    for (const [type, mimeTypes] of Object.entries(SUPPORTED_MIME_TYPES)) {
      if ((mimeTypes as readonly string[]).includes(mimeType)) {
        return type as MediaType
      }
    }
    throw new Error(`Unsupported file type: ${mimeType}`)
  }

  /**
   * Validates file before upload
   */
  private validateFile(file: File): { isValid: boolean; error?: string; mediaType?: MediaType } {
    if (!file) {
      return { isValid: false, error: 'No file provided' }
    }

    let mediaType: MediaType
    try {
      mediaType = this.getMediaType(file.type)
    } catch (error) {
      return { isValid: false, error: `Unsupported file type: ${file.type}` }
    }

    const sizeLimit = FILE_SIZE_LIMITS[mediaType]
    if (file.size > sizeLimit) {
      const sizeMB = Math.round(sizeLimit / (1024 * 1024))
      return { 
        isValid: false, 
        error: `File size exceeds ${sizeMB}MB limit for ${mediaType.toLowerCase()} files` 
      }
    }

    return { isValid: true, mediaType }
  }

  /**
   * Generates a unique file path
   */
  private generateFilePath(userId: string, file: File, mediaType: MediaType): string {
    const timestamp = Date.now()
    const randomString = Math.random().toString(36).substring(2, 15)
    const fileExtension = file.name.split('.').pop()?.toLowerCase() || 'bin'
    const fileName = `${timestamp}_${randomString}.${fileExtension}`
    
    return `notes-media/${userId}/${mediaType.toLowerCase()}/${fileName}`
  }

  /**
   * Uploads any type of media file
   */
  async uploadMedia(file: File, options: UploadOptions = {}): Promise<MediaUploadResult> {
    const { onProgress, abortSignal, caption, alt } = options

    // Validate file
    const validation = this.validateFile(file)
    if (!validation.isValid) {
      throw new Error(validation.error)
    }

    const mediaType = validation.mediaType!

    try {
      // Get current user
      const { data: { user }, error: authError } = await this.supabase.auth.getUser()
      if (authError || !user) {
        throw new Error('User not authenticated')
      }

      onProgress?.({ progress: 10, status: 'Preparing upload...' })

      // Generate file path
      const filePath = this.generateFilePath(user.id, file, mediaType)

      onProgress?.({ progress: 20, status: 'Uploading file...' })

      // Upload to Supabase Storage
      const { data: uploadData, error: uploadError } = await this.supabase.storage
        .from(this.bucketName)
        .upload(filePath, file, {
          cacheControl: '3600',
          upsert: false,
          metadata: {
            originalName: file.name,
            mediaType,
            uploadedBy: user.id,
            caption: caption || null,
            alt: alt || null
          }
        })

      if (uploadError) {
        throw new Error(`Upload failed: ${uploadError.message}`)
      }

      onProgress?.({ progress: 80, status: 'Getting public URL...' })

      // Get public URL
      const { data: urlData } = this.supabase.storage
        .from(this.bucketName)
        .getPublicUrl(filePath)

      if (!urlData?.publicUrl) {
        throw new Error('Failed to get public URL for uploaded file')
      }

      onProgress?.({ progress: 100, status: 'Upload complete!' })

      return {
        url: urlData.publicUrl,
        fileName: file.name,
        fileSize: file.size,
        mimeType: file.type,
        mediaType,
        metadata: {
          caption,
          alt,
          uploadedAt: new Date().toISOString(),
          originalName: file.name
        }
      }

    } catch (error) {
      console.error('Media upload error:', error)
      
      // Fallback to base64 for development
      if (process.env.NODE_ENV === 'development' && mediaType === 'IMAGE') {
        console.warn('Falling back to base64 encoding for development')
        onProgress?.({ progress: 50, status: 'Converting to base64...' })
        const base64Result = await this.convertFileToBase64(file, abortSignal)
        onProgress?.({ progress: 100, status: 'Conversion complete!' })
        
        return {
          url: base64Result,
          fileName: file.name,
          fileSize: file.size,
          mimeType: file.type,
          mediaType,
          metadata: { caption, alt, fallback: true }
        }
      }
      
      throw error
    }
  }

  /**
   * Uploads multiple files
   */
  async uploadMultipleFiles(
    files: File[], 
    options: UploadOptions = {}
  ): Promise<MediaUploadResult[]> {
    const results: MediaUploadResult[] = []
    const totalFiles = files.length

    for (let i = 0; i < files.length; i++) {
      const file = files[i]
      const fileProgress = (i / totalFiles) * 100

      try {
        const result = await this.uploadMedia(file, {
          ...options,
          onProgress: (event) => {
            const overallProgress = fileProgress + (event.progress / totalFiles)
            options.onProgress?.({
              progress: overallProgress,
              status: `Uploading ${i + 1}/${totalFiles}: ${event.status}`
            })
          }
        })
        results.push(result)
      } catch (error) {
        console.error(`Failed to upload ${file.name}:`, error)
        // Continue with other files
      }
    }

    return results
  }

  /**
   * Converts file to base64 (fallback)
   */
  private convertFileToBase64(file: File, abortSignal?: AbortSignal): Promise<string> {
    return new Promise((resolve, reject) => {
      const reader = new FileReader()

      const abortHandler = () => {
        reader.abort()
        reject(new Error('Upload cancelled'))
      }

      if (abortSignal) {
        abortSignal.addEventListener('abort', abortHandler)
      }

      reader.onload = () => {
        if (abortSignal) {
          abortSignal.removeEventListener('abort', abortHandler)
        }
        resolve(reader.result as string)
      }

      reader.onerror = () => {
        if (abortSignal) {
          abortSignal.removeEventListener('abort', abortHandler)
        }
        reject(new Error('Failed to read file'))
      }

      reader.readAsDataURL(file)
    })
  }

  /**
   * Get supported file types for file picker
   */
  getAcceptString(mediaTypes: MediaType[] = ['IMAGE', 'VIDEO', 'AUDIO', 'DOCUMENT']): string {
    const mimeTypes = mediaTypes.flatMap(type => SUPPORTED_MIME_TYPES[type])
    return mimeTypes.join(',')
  }

  /**
   * Format file size for display
   */
  formatFileSize(bytes: number): string {
    if (bytes === 0) return '0 Bytes'
    const k = 1024
    const sizes = ['Bytes', 'KB', 'MB', 'GB']
    const i = Math.floor(Math.log(bytes) / Math.log(k))
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i]
  }

  /**
   * Get media type icon/emoji
   */
  getMediaIcon(mediaType: MediaType): string {
    const icons = {
      IMAGE: '🖼️',
      VIDEO: '🎥',
      AUDIO: '🎵',
      DOCUMENT: '📄',
      ARCHIVE: '📦'
    }
    return icons[mediaType] || '📎'
  }
}

// Export singleton instance
export const mediaUploadService = new MediaUploadService()

// Legacy compatibility - update the existing handleImageUpload to use the new service
export const handleImageUpload = async (
  file: File,
  onProgress?: (event: { progress: number }) => void,
  abortSignal?: AbortSignal
): Promise<string> => {
  const result = await mediaUploadService.uploadMedia(file, {
    onProgress: onProgress ? (event) => onProgress({ progress: event.progress }) : undefined,
    abortSignal
  })
  return result.url
} 