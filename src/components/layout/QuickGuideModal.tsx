'use client';

import { useState, useEffect } from 'react';
import { X, Play, Clock, Sparkles, BookOpen, Users, GraduationCap, Wrench, AlertCircle, Home, Upload, MessageSquare, FileText } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogTitle, DialogOverlay, DialogPortal } from '@/components/ui/dialog';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import { createClient } from '@/lib/supabase/client';
import { toast } from 'sonner';
import { VisuallyHidden } from '@/components/ui/visually-hidden';

interface QuickGuideModalProps {
  isOpen: boolean;
  onClose: () => void;
}

interface VideoGuide {
  id: string;
  title: string;
  description: string;
  video_url: string;
  thumbnail_url: string;
  duration_seconds: number;
  category: string;
  target_roles: string[];
  order_index: number;
  is_featured: boolean;
  is_published: boolean;
  tags: string[];
  created_at: string;
  updated_at: string;
}

interface GuideCategory {
  id: string;
  name: string;
  icon: React.ElementType;
}

const categories: GuideCategory[] = [
  { id: 'getting-started', name: 'Getting Started', icon: Sparkles },
  { id: 'student-tools', name: 'Student Tools', icon: BookOpen },
  { id: 'teacher-tools', name: 'Teacher Tools', icon: Users },
  { id: 'parent-tools', name: 'Parent Tools', icon: Home },
  { id: 'advanced', name: 'Advanced Features', icon: Wrench },
  { id: 'troubleshooting', name: 'Troubleshooting', icon: AlertCircle },
];

const formatDuration = (seconds: number): string => {
  const mins = Math.floor(seconds / 60);
  const secs = seconds % 60;
  return `${mins}:${secs.toString().padStart(2, '0')}`;
};

const getYouTubeVideoId = (url: string): string | null => {
  const regex = /(?:youtube\.com\/watch\?v=|youtu\.be\/|youtube\.com\/embed\/)([^&\n?#]+)/;
  const match = url.match(regex);
  return match ? match[1] : null;
};

const getSupabaseVideoUrl = (bucketPath: string): string => {
  const supabase = createClient();
  const { data } = supabase.storage.from('guide-videos').getPublicUrl(bucketPath);
  return data.publicUrl;
};

export default function QuickGuideModal({ isOpen, onClose }: QuickGuideModalProps) {
  const [videos, setVideos] = useState<VideoGuide[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedVideo, setSelectedVideo] = useState<VideoGuide | null>(null);

  // Add custom scrollbar styles
  useEffect(() => {
    const style = document.createElement('style');
    style.textContent = `
      .quick-guide-scroll::-webkit-scrollbar {
        width: 8px;
      }
      .quick-guide-scroll::-webkit-scrollbar-track {
        background: #f1f5f9;
        border-radius: 4px;
      }
      .quick-guide-scroll::-webkit-scrollbar-thumb {
        background: #94a3b8;
        border-radius: 4px;
      }
      .quick-guide-scroll::-webkit-scrollbar-thumb:hover {
        background: #64748b;
      }
      .dark .quick-guide-scroll::-webkit-scrollbar-track {
        background: #1e293b;
      }
      .dark .quick-guide-scroll::-webkit-scrollbar-thumb {
        background: #475569;
      }
      .dark .quick-guide-scroll::-webkit-scrollbar-thumb:hover {
        background: #64748b;
      }
    `;
    document.head.appendChild(style);
    
    return () => {
      document.head.removeChild(style);
    };
  }, []);

  useEffect(() => {
    if (isOpen) {
      fetchVideos();
    }
  }, [isOpen]);

  const fetchVideos = async () => {
    try {
      const supabase = createClient();
      const { data, error } = await supabase
        .from('video_guides')
        .select('*')
        .eq('is_published', true)
        .order('category', { ascending: true })
        .order('order_index', { ascending: true });

      if (error) {
        console.error('Error fetching videos:', error);
        toast.error('Failed to load video guides');
        return;
      }

      setVideos(data || []);
      
      // Select the first video if available
      if (data && data.length > 0 && !selectedVideo) {
        setSelectedVideo(data[0]);
      }
    } catch (error) {
      console.error('Error fetching videos:', error);
      toast.error('Failed to load video guides');
    } finally {
      setLoading(false);
    }
  };

  const handleVideoClick = (video: VideoGuide) => {
    setSelectedVideo(video);
  };

  const renderVideoEmbed = () => {
    if (!selectedVideo) {
      return (
        <div className="w-full h-full flex items-center justify-center bg-muted/50 rounded-lg">
          <div className="text-center">
            <Play className="h-16 w-16 text-muted-foreground mx-auto mb-4" />
            <p className="text-muted-foreground">Select a guide to view the demo</p>
          </div>
        </div>
      );
    }

    const isYouTubeUrl = selectedVideo.video_url.includes('youtube.com') || selectedVideo.video_url.includes('youtu.be');
    let embedUrl = selectedVideo.video_url;
    
    if (isYouTubeUrl) {
      const videoId = getYouTubeVideoId(selectedVideo.video_url);
      embedUrl = videoId ? `https://www.youtube.com/embed/${videoId}` : selectedVideo.video_url;
      
      return (
        <iframe
          src={embedUrl}
          title={selectedVideo.title}
          className="w-full h-full rounded-lg"
          frameBorder="0"
          allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
          allowFullScreen
        />
      );
    } else {
      embedUrl = getSupabaseVideoUrl(selectedVideo.video_url);
      
      return (
        <video
          src={embedUrl}
          controls
          className="w-full h-full rounded-lg object-contain bg-black"
          poster={selectedVideo.thumbnail_url}
        >
          Your browser does not support the video tag.
        </video>
      );
    }
  };

  // Group videos by category
  const videosByCategory = categories.reduce((acc, category) => {
    acc[category.id] = videos.filter(video => video.category === category.id);
    return acc;
  }, {} as Record<string, VideoGuide[]>);

  // Get all videos in order for navigation
  const allVideos = videos;
  const currentVideoIndex = selectedVideo ? allVideos.findIndex(v => v.id === selectedVideo.id) : -1;

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogPortal>
        <DialogOverlay className="backdrop-blur-sm bg-black/50" />
        <DialogContent className="!max-w-[95vw] !w-[1600px] !h-[90vh] p-0 gap-0 overflow-hidden sm:!max-w-[95vw]">
        <VisuallyHidden>
          <DialogTitle>Quick Guide</DialogTitle>
        </VisuallyHidden>
        
        <div className="flex h-full min-h-0">
          {/* Left Sidebar - All videos visible in categorized list */}
          <div className="w-[400px] bg-background border-r border-border flex flex-col flex-shrink-0 h-full max-h-full min-h-0">
            {/* Header */}
            <div className="p-6 border-b border-border flex-shrink-0">
              <h2 className="text-xl font-semibold">Quick Guide</h2>
              <p className="text-sm text-muted-foreground mt-1">
                Explore {videos.length}+ features
              </p>
            </div>

            {/* All Videos Listed by Category - Scrollable */}
            <div 
              className="flex-1 overflow-y-auto quick-guide-scroll min-h-0"
              style={{
                scrollbarWidth: 'thin',
                scrollbarColor: '#9CA3AF #F3F4F6'
              }}
            >
              <div className="p-4 space-y-6">
                {loading ? (
                  <div className="flex items-center justify-center py-8">
                    <div className="text-center">
                      <Sparkles className="h-8 w-8 text-muted-foreground mx-auto mb-2 animate-pulse" />
                      <p className="text-sm text-muted-foreground">Loading guides...</p>
                    </div>
                  </div>
                ) : videos.length === 0 ? (
                  <div className="text-center py-8">
                    <AlertCircle className="h-8 w-8 text-muted-foreground mx-auto mb-2" />
                    <p className="text-sm text-muted-foreground">No video guides available</p>
                  </div>
                ) : (
                  categories.map((category) => {
                    const categoryVideos = videosByCategory[category.id] || [];
                    
                    if (categoryVideos.length === 0) return null;
                    
                    return (
                      <div key={category.id} className="space-y-2">
                        {/* Category Header */}
                        <div className="flex items-center gap-2 px-2 py-1 text-sm font-medium text-muted-foreground sticky top-0 bg-background">
                          <category.icon className="h-4 w-4" />
                          <span>{category.name}</span>
                        </div>
                        
                        {/* Videos in this category */}
                        <div className="space-y-1">
                          {categoryVideos.map((video) => (
                            <button
                              key={video.id}
                              onClick={() => handleVideoClick(video)}
                              className={cn(
                                "w-full text-left px-4 py-2.5 rounded-md text-sm transition-colors group",
                                "hover:bg-accent/50",
                                selectedVideo?.id === video.id && "bg-accent text-accent-foreground"
                              )}
                            >
                              <div className="flex items-start justify-between gap-2">
                                <div className="flex-1 min-w-0">
                                  <div className="font-medium truncate">{video.title}</div>
                                  {video.description && (
                                    <div className="text-xs text-muted-foreground mt-0.5 line-clamp-2">
                                      {video.description}
                                    </div>
                                  )}
                                </div>
                                <div className="flex items-center gap-1 text-xs text-muted-foreground flex-shrink-0">
                                  <Clock className="h-3 w-3" />
                                  <span>{formatDuration(video.duration_seconds)}</span>
                                </div>
                              </div>
                              {video.is_featured && (
                                <Badge className="mt-1 text-xs" variant="secondary">
                                  Featured
                                </Badge>
                              )}
                            </button>
                          ))}
                        </div>
                      </div>
                    );
                  })
                )}
              </div>
            </div>
          </div>

          {/* Right Content Area - Video Player */}
          <div className="flex-1 flex flex-col bg-muted/30 min-w-0">
            {/* Content Header */}
            <div className="flex items-center p-6 border-b border-border bg-background flex-shrink-0">
              <div className="flex-1 min-w-0">
                <h3 className="text-lg font-semibold truncate">
                  {selectedVideo?.title || 'Select a guide to get started'}
                </h3>
                <p className="text-sm text-muted-foreground mt-1 line-clamp-2">
                  {selectedVideo?.description || 'Choose a video guide from the list to view the walkthrough demo.'}
                </p>
              </div>
            </div>

            {/* Video Player Area */}
            <div className="flex-1 p-8 flex flex-col min-h-0">
              {/* Tags/Categories if video is selected */}
              {selectedVideo && selectedVideo.tags && selectedVideo.tags.length > 0 && (
                <div className="flex gap-2 mb-6 flex-wrap">
                  {selectedVideo.tags.map((tag, index) => (
                    <Badge key={index} variant="outline" className="text-xs">
                      {tag}
                    </Badge>
                  ))}
                </div>
              )}

              {/* Video Player Container - Takes most of the space */}
              <div className="flex-1 flex items-center justify-center min-h-0 mb-6">
                <div className="w-full h-full max-w-none">
                  <div className="aspect-video bg-black rounded-lg overflow-hidden w-full h-full max-h-[700px]">
                    {loading && !selectedVideo ? (
                      <div className="w-full h-full flex items-center justify-center bg-muted">
                        <div className="text-center">
                          <Sparkles className="h-12 w-12 text-muted-foreground mx-auto mb-4 animate-pulse" />
                          <p className="text-muted-foreground">Loading video guide...</p>
                        </div>
                      </div>
                    ) : (
                      renderVideoEmbed()
                    )}
                  </div>
                </div>
              </div>

              {/* Video Info - Bottom area */}
              {selectedVideo && (
                <div className="flex-shrink-0 space-y-4">
                  <div className="flex items-center gap-6 text-sm text-muted-foreground">
                    <div className="flex items-center gap-2">
                      <Clock className="h-4 w-4" />
                      <span>{formatDuration(selectedVideo.duration_seconds)}</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <BookOpen className="h-4 w-4" />
                      <span className="capitalize">{selectedVideo.category.replace('-', ' ')}</span>
                    </div>
                    {selectedVideo.is_featured && (
                      <Badge className="bg-gradient-to-r from-[#FF835D] to-[#E45DE5] text-white">
                        Featured
                      </Badge>
                    )}
                  </div>

                  {/* Pro Tip */}
                  <div className="p-4 bg-blue-50 dark:bg-blue-950/20 rounded-lg">
                    <h4 className="font-medium mb-2 text-sm">Pro Tip</h4>
                    <p className="text-sm text-muted-foreground">
                      Use keyboard shortcuts for faster navigation. Press "?" to see all available shortcuts.
                    </p>
                  </div>
                </div>
              )}
            </div>

            {/* Footer Navigation */}
            <div className="flex items-center justify-between p-6 border-t border-border bg-background flex-shrink-0">
              <Button
                variant="outline"
                onClick={() => {
                  if (currentVideoIndex > 0) {
                    setSelectedVideo(allVideos[currentVideoIndex - 1]);
                  }
                }}
                disabled={currentVideoIndex <= 0}
              >
                Back
              </Button>
              
              <span className="text-sm text-muted-foreground">
                {currentVideoIndex >= 0 && `${currentVideoIndex + 1} of ${allVideos.length}`}
              </span>
              
              <Button
                onClick={() => {
                  if (currentVideoIndex < allVideos.length - 1) {
                    setSelectedVideo(allVideos[currentVideoIndex + 1]);
                  } else {
                    onClose();
                  }
                }}
                disabled={!selectedVideo}
              >
                {currentVideoIndex === allVideos.length - 1 ? 'Finish' : 'Next'}
              </Button>
            </div>
          </div>
        </div>
        </DialogContent>
      </DialogPortal>
    </Dialog>
  );
}