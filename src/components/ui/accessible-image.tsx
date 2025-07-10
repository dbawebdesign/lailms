/**
 * Accessible Image Component
 * 
 * Ensures all images have proper alt text and accessibility features.
 * Provides different modes for decorative, informative, and complex images.
 */

import * as React from "react"
import Image, { ImageProps } from "next/image"
import { cn } from "@/lib/utils"

interface AccessibleImageProps extends Omit<ImageProps, 'alt'> {
  alt: string // Make alt text required
  /** 
   * Image type affects accessibility attributes
   * - informative: Standard image with meaningful content
   * - decorative: Purely decorative image (alt="" and aria-hidden)
   * - complex: Complex image that needs additional description
   */
  imageType?: 'informative' | 'decorative' | 'complex'
  /** 
   * ID of element that provides detailed description for complex images
   */
  'aria-describedby'?: string
  /**
   * Additional context for screen readers
   */
  'aria-label'?: string
  /**
   * Loading state announcement for screen readers
   */
  loadingAnnouncement?: string
}

export const AccessibleImage = React.forwardRef<
  React.ElementRef<typeof Image>,
  AccessibleImageProps
>(({ 
  className, 
  alt, 
  imageType = 'informative',
  loadingAnnouncement = "Loading image",
  ...props 
}, ref) => {
  const [isLoading, setIsLoading] = React.useState(true)
  const [hasError, setHasError] = React.useState(false)

  // Handle image load states
  const handleLoad = () => {
    setIsLoading(false)
    setHasError(false)
  }

  const handleError = () => {
    setIsLoading(false)
    setHasError(true)
  }

  // Determine accessibility attributes based on image type
  const getAccessibilityProps = () => {
    switch (imageType) {
      case 'decorative':
        return {
          alt: "",
          'aria-hidden': true,
          role: "presentation"
        }
      case 'complex':
        return {
          alt,
          role: "img",
          'aria-describedby': props['aria-describedby']
        }
      case 'informative':
      default:
        return {
          alt,
          role: "img"
        }
    }
  }

  const accessibilityProps = getAccessibilityProps()

  if (hasError) {
    return (
      <div 
        className={cn(
          "flex items-center justify-center bg-muted text-muted-foreground border border-border rounded",
          className
        )}
        role="img"
        aria-label={`Failed to load image: ${alt}`}
        style={{ width: props.width, height: props.height }}
      >
        <span className="text-sm text-center p-2">
          Image unavailable
          {imageType !== 'decorative' && (
            <span className="sr-only">: {alt}</span>
          )}
        </span>
      </div>
    )
  }

  return (
    <>
      {isLoading && imageType !== 'decorative' && (
        <span className="sr-only" aria-live="polite">
          {loadingAnnouncement}
        </span>
      )}
      <Image
        ref={ref}
        className={cn(className)}
        onLoad={handleLoad}
        onError={handleError}
        {...props}
        {...accessibilityProps}
      />
    </>
  )
})

AccessibleImage.displayName = "AccessibleImage"

/**
 * Accessible Figure Component
 * 
 * Wraps images with captions in a semantic figure element
 */
interface AccessibleFigureProps {
  children: React.ReactNode
  caption?: string
  captionId?: string
  className?: string
}

export const AccessibleFigure: React.FC<AccessibleFigureProps> = ({
  children,
  caption,
  captionId,
  className
}) => {
  const generatedCaptionId = React.useId()
  const finalCaptionId = captionId || generatedCaptionId

  return (
    <figure className={cn("space-y-2", className)}>
      <div aria-describedby={caption ? finalCaptionId : undefined}>
        {children}
      </div>
      {caption && (
        <figcaption 
          id={finalCaptionId}
          className="text-sm text-muted-foreground text-center"
        >
          {caption}
        </figcaption>
      )}
    </figure>
  )
}

/**
 * Accessible Avatar Component
 * 
 * Specialized image component for user avatars
 */
interface AccessibleAvatarProps extends Omit<AccessibleImageProps, 'imageType' | 'alt'> {
  userName: string
  showOnlineStatus?: boolean
  isOnline?: boolean
}

export const AccessibleAvatar: React.FC<AccessibleAvatarProps> = ({
  userName,
  showOnlineStatus = false,
  isOnline = false,
  className,
  ...props
}) => {
  return (
    <div className="relative inline-block">
      <AccessibleImage
        {...props}
        alt={`${userName}'s profile picture`}
        imageType="informative"
        className={cn("rounded-full", className)}
      />
      {showOnlineStatus && (
        <div
          className={cn(
            "absolute bottom-0 right-0 w-3 h-3 rounded-full border-2 border-background",
            isOnline ? "bg-green-500" : "bg-gray-400"
          )}
          aria-label={`${userName} is ${isOnline ? 'online' : 'offline'}`}
          role="img"
        />
      )}
    </div>
  )
} 