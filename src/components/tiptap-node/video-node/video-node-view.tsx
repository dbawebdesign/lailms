import React, { useState } from 'react'
import { NodeViewWrapper, ReactNodeViewProps } from '@tiptap/react'
import { Play, Pause, Volume2, VolumeX, Maximize } from 'lucide-react'
import { cn } from '@/lib/utils'

interface VideoAttrs {
  src: string
  alt?: string
  title?: string
  width?: number
  height?: number
  controls?: boolean
  autoplay?: boolean
  loop?: boolean
  muted?: boolean
}

export const VideoNodeView: React.FC<ReactNodeViewProps> = ({
  node,
  updateAttributes,
  selected,
}) => {
  // Type assertion for video node attributes
  const attrs = node.attrs as VideoAttrs
  
  const [isPlaying, setIsPlaying] = useState(false)
  const [isMuted, setIsMuted] = useState(attrs.muted || false)
  const [showControls, setShowControls] = useState(false)
  const videoRef = React.useRef<HTMLVideoElement>(null)

  const { src, alt, title, width, height, controls = true } = attrs

  const handlePlay = () => {
    if (videoRef.current) {
      if (isPlaying) {
        videoRef.current.pause()
      } else {
        videoRef.current.play()
      }
      setIsPlaying(!isPlaying)
    }
  }

  const handleMute = () => {
    if (videoRef.current) {
      videoRef.current.muted = !isMuted
      setIsMuted(!isMuted)
      updateAttributes({ muted: !isMuted })
    }
  }

  const handleFullscreen = () => {
    if (videoRef.current && videoRef.current.requestFullscreen) {
      videoRef.current.requestFullscreen()
    }
  }

  if (!src) {
    return (
      <NodeViewWrapper className="video-node-view">
        <div className="flex items-center justify-center w-full h-32 bg-gray-100 dark:bg-gray-800 border-2 border-dashed border-gray-300 dark:border-gray-600 rounded-lg">
          <div className="text-center">
            <Play className="mx-auto h-8 w-8 text-gray-400 mb-2" />
            <p className="text-sm text-gray-500 dark:text-gray-400">No video source</p>
          </div>
        </div>
      </NodeViewWrapper>
    )
  }

  return (
    <NodeViewWrapper className="video-node-view">
      <div 
        className={cn(
          "relative inline-block max-w-full group",
          selected && "ring-2 ring-blue-500 ring-offset-2"
        )}
        onMouseEnter={() => setShowControls(true)}
        onMouseLeave={() => setShowControls(false)}
      >
        <video
          ref={videoRef}
          src={src}
          title={title}
          width={width}
          height={height}
          controls={controls}
          autoPlay={attrs.autoplay}
          loop={attrs.loop}
          muted={isMuted}
          aria-label={alt || title || 'Video content'}
          className="max-w-full h-auto rounded-lg shadow-md"
          onPlay={() => setIsPlaying(true)}
          onPause={() => setIsPlaying(false)}
          onLoadedMetadata={() => {
            // Auto-size video if no dimensions provided
            if (videoRef.current && !width && !height) {
              const video = videoRef.current
              updateAttributes({
                width: Math.min(video.videoWidth, 800),
                height: Math.min(video.videoHeight, 600)
              })
            }
          }}
        />

        {/* Custom controls overlay */}
        {!controls && (
          <div 
            className={cn(
              "absolute inset-0 flex items-center justify-center bg-black bg-opacity-0 hover:bg-opacity-20 transition-all duration-200",
              (showControls || selected) && "bg-opacity-20"
            )}
          >
            <div 
              className={cn(
                "flex items-center space-x-2 bg-black bg-opacity-60 rounded-full px-3 py-2 transition-opacity duration-200",
                (showControls || selected) ? "opacity-100" : "opacity-0"
              )}
            >
              <button
                onClick={handlePlay}
                className="text-white hover:text-gray-300 transition-colors"
                aria-label={isPlaying ? "Pause" : "Play"}
              >
                {isPlaying ? (
                  <Pause className="h-4 w-4" />
                ) : (
                  <Play className="h-4 w-4" />
                )}
              </button>

              <button
                onClick={handleMute}
                className="text-white hover:text-gray-300 transition-colors"
                aria-label={isMuted ? "Unmute" : "Mute"}
              >
                {isMuted ? (
                  <VolumeX className="h-4 w-4" />
                ) : (
                  <Volume2 className="h-4 w-4" />
                )}
              </button>

              <button
                onClick={handleFullscreen}
                className="text-white hover:text-gray-300 transition-colors"
                aria-label="Fullscreen"
              >
                <Maximize className="h-4 w-4" />
              </button>
            </div>
          </div>
        )}

        {/* Caption */}
        {title && (
          <div className="mt-2 text-sm text-gray-600 dark:text-gray-400 text-center">
            {title}
          </div>
        )}
      </div>
    </NodeViewWrapper>
  )
}

export default VideoNodeView 