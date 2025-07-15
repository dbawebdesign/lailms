'use client';

import { useEffect, useRef, useState } from 'react';
import { X, Play, Pause, Volume2, VolumeX, Maximize2, Minimize2 } from 'lucide-react';
import { Button } from './button';
import { getPublicVideoUrl } from '@/lib/supabase/getPublicVideoUrl';

interface VideoModalProps {
  isOpen: boolean;
  onClose: () => void;
  videoUrl: string;
  title: string;
  description?: string;
  autoplay?: boolean;
}

export function VideoModal({ 
  isOpen, 
  onClose, 
  videoUrl, 
  title, 
  description,
  autoplay = true 
}: VideoModalProps) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [isMuted, setIsMuted] = useState(false);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [resolvedUrl, setResolvedUrl] = useState<string>('');
  const [isLoading, setIsLoading] = useState(true);

  // Fetch the public video URL (Supabase or YouTube)
  useEffect(() => {
    if (!isOpen) return;
    setIsLoading(true);
    setResolvedUrl('');
    // Simulate async for consistency (Supabase is sync, but could be async in future)
    setTimeout(() => {
      const url = getPublicVideoUrl(videoUrl);
      setResolvedUrl(url);
      setIsLoading(false);
    }, 0);
  }, [isOpen, videoUrl]);

  // Handle video events
  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;

    const handleLoadedData = () => {
      if (autoplay) {
        video.play().then(() => setIsPlaying(true));
      }
    };
    const handlePlay = () => setIsPlaying(true);
    const handlePause = () => setIsPlaying(false);
    const handleVolumeChange = () => setIsMuted(video.muted);

    video.addEventListener('loadeddata', handleLoadedData);
    video.addEventListener('play', handlePlay);
    video.addEventListener('pause', handlePause);
    video.addEventListener('volumechange', handleVolumeChange);

    return () => {
      video.removeEventListener('loadeddata', handleLoadedData);
      video.removeEventListener('play', handlePlay);
      video.removeEventListener('pause', handlePause);
      video.removeEventListener('volumechange', handleVolumeChange);
    };
  }, [autoplay, resolvedUrl]);

  // Handle keyboard shortcuts
  useEffect(() => {
    if (!isOpen) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      switch (e.key) {
        case 'Escape':
          onClose();
          break;
        case ' ':
          e.preventDefault();
          togglePlayPause();
          break;
        case 'm':
        case 'M':
          toggleMute();
          break;
        case 'f':
        case 'F':
          toggleFullscreen();
          break;
      }
    };
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [isOpen]);

  // Prevent body scroll when modal is open
  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = 'unset';
    }
    return () => {
      document.body.style.overflow = 'unset';
    };
  }, [isOpen]);

  const togglePlayPause = () => {
    const video = videoRef.current;
    if (!video) return;
    if (isPlaying) {
      video.pause();
    } else {
      video.play();
    }
  };
  const toggleMute = () => {
    const video = videoRef.current;
    if (!video) return;
    video.muted = !video.muted;
  };
  const toggleFullscreen = () => {
    const video = videoRef.current;
    if (!video) return;
    if (!isFullscreen) {
      if (video.requestFullscreen) {
        video.requestFullscreen();
      }
    } else {
      if (document.exitFullscreen) {
        document.exitFullscreen();
      }
    }
    setIsFullscreen(!isFullscreen);
  };

  if (!isOpen) return null;

  // YouTube embed detection
  const isYouTubeUrl = resolvedUrl.includes('youtube.com') || resolvedUrl.includes('youtu.be');

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      {/* Backdrop */}
      <div 
        className="absolute inset-0 bg-black/80 backdrop-blur-sm transition-opacity duration-300"
        onClick={onClose}
      />
      {/* Modal Container */}
      <div className="relative w-full max-w-4xl mx-4 bg-black rounded-2xl overflow-hidden shadow-2xl border border-gray-800/50">
        {/* Header */}
        <div className="absolute top-0 left-0 right-0 z-10 bg-gradient-to-b from-black/60 to-transparent p-4">
          <div className="flex items-center justify-between">
            <div className="flex-1">
              <h2 className="text-white text-lg font-medium truncate">{title}</h2>
              {description && (
                <p className="text-gray-300 text-sm mt-1 truncate">{description}</p>
              )}
            </div>
            <Button
              variant="ghost"
              size="sm"
              onClick={onClose}
              className="text-white hover:bg-white/10 rounded-full h-8 w-8 p-0 ml-4"
            >
              <X className="h-4 w-4" />
            </Button>
          </div>
        </div>
        {/* Video Container */}
        <div className="relative aspect-video bg-black">
          {isLoading && (
            <div className="absolute inset-0 flex items-center justify-center">
              <div className="w-8 h-8 border-2 border-white/30 border-t-white rounded-full animate-spin" />
            </div>
          )}
          {!isLoading && resolvedUrl ? (
            isYouTubeUrl ? (
              <iframe
                src={resolvedUrl.replace('watch?v=', 'embed/')}
                title={title}
                className="w-full h-full rounded-lg"
                frameBorder="0"
                allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                allowFullScreen
              />
            ) : (
              <video
                ref={videoRef}
                src={resolvedUrl}
                className="w-full h-full object-contain"
                playsInline
                preload="metadata"
                onClick={togglePlayPause}
              />
            )
          ) : null}
          {!isLoading && !resolvedUrl && (
            <div className="absolute inset-0 flex items-center justify-center text-white text-lg">
              Video unavailable.
            </div>
          )}
          {/* Play/Pause Overlay */}
          {!isLoading && resolvedUrl && !isYouTubeUrl && (
            <div 
              className="absolute inset-0 flex items-center justify-center opacity-0 hover:opacity-100 transition-opacity duration-200 cursor-pointer"
              onClick={togglePlayPause}
            >
              <div className="bg-black/50 rounded-full p-4 backdrop-blur-sm">
                {isPlaying ? (
                  <Pause className="h-8 w-8 text-white" />
                ) : (
                  <Play className="h-8 w-8 text-white ml-1" />
                )}
              </div>
            </div>
          )}
          {/* Controls */}
          {!isLoading && resolvedUrl && !isYouTubeUrl && (
            <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/60 to-transparent p-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center space-x-3">
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={togglePlayPause}
                    className="text-white hover:bg-white/10 rounded-full h-8 w-8 p-0"
                  >
                    {isPlaying ? (
                      <Pause className="h-4 w-4" />
                    ) : (
                      <Play className="h-4 w-4 ml-0.5" />
                    )}
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={toggleMute}
                    className="text-white hover:bg-white/10 rounded-full h-8 w-8 p-0"
                  >
                    {isMuted ? (
                      <VolumeX className="h-4 w-4" />
                    ) : (
                      <Volume2 className="h-4 w-4" />
                    )}
                  </Button>
                </div>
                <div className="flex items-center space-x-3">
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={toggleFullscreen}
                    className="text-white hover:bg-white/10 rounded-full h-8 w-8 p-0"
                  >
                    {isFullscreen ? (
                      <Minimize2 className="h-4 w-4" />
                    ) : (
                      <Maximize2 className="h-4 w-4" />
                    )}
                  </Button>
                </div>
              </div>
            </div>
          )}
        </div>
        {/* Keyboard Shortcuts Hint */}
        <div className="absolute bottom-4 left-4 text-xs text-gray-400 opacity-0 hover:opacity-100 transition-opacity">
          <div className="bg-black/50 backdrop-blur-sm rounded px-2 py-1">
            Space: Play/Pause • M: Mute • F: Fullscreen • Esc: Close
          </div>
        </div>
      </div>
    </div>
  );
} 