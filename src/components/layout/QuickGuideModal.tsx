'use client';

import { useState, useEffect } from 'react';
import { X, Play, Sparkles, BookOpen, Users, GraduationCap, Wrench, AlertCircle, Home, Upload, MessageSquare, FileText, ArrowLeft } from 'lucide-react';
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
  { id: 'teacher-tools', name: 'Teachers', icon: Users },
  { id: 'student-tools', name: 'Students', icon: BookOpen },
  { id: 'general', name: 'General', icon: FileText },
  // Keep existing categories for compatibility; they'll be hidden if empty
  { id: 'getting-started', name: 'Getting Started', icon: Sparkles },
  { id: 'parent-tools', name: 'Parent Tools', icon: Home },
  { id: 'advanced', name: 'Advanced Features', icon: Wrench },
  { id: 'troubleshooting', name: 'Troubleshooting', icon: AlertCircle },
];

// Duration formatting removed from UI; keeping function unnecessary, so removed to avoid unused lint

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
  const [touchStart, setTouchStart] = useState<number | null>(null);
  const [touchEnd, setTouchEnd] = useState<number | null>(null);

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

      const deriveTitle = (fileName: string): string => {
        const withoutExt = fileName.replace(/\.[^/.]+$/, '');
        const withoutClipchamp = withoutExt.replace(/\s*-\s*Made with Clipchamp.*$/i, '');
        const normalized = withoutClipchamp.replace(/[_]+/g, ' ');
        return normalized.replace(/\s+/g, ' ').trim();
      };

      const deriveCategory = (title: string): string => {
        const t = title.toLowerCase();
        if (t.includes('study space') || t.startsWith('student ') || t.includes('student')) return 'student-tools';
        if (t.includes('switching users') || t.includes('feedback') || t.includes('support')) return 'general';
        if (t.includes('base class') || t.includes('class instance') || t.startsWith('create ') || t.startsWith('edit ')) return 'teacher-tools';
        return 'general';
      };

      const { data, error } = await supabase.storage
        .from('guide-videos')
        .list('', { limit: 100, offset: 0, sortBy: { column: 'name', order: 'asc' } });

      if (error) {
        console.error('Error listing guide videos:', error);
        toast.error('Failed to load video guides');
        return;
      }

      // Ensure specific videos appear in desired order within their categories
      const priority = (title: string, category: string) => {
        const t = title.toLowerCase();
        if (category === 'teacher-tools') {
          if (t.startsWith('base class creation')) return 0;
          if (t.startsWith('edit base class')) return 1;
          return 2;
        }
        if (category === 'student-tools') {
          if (t.startsWith('student my courses')) return 0;
          if (t.startsWith('study space get started')) return 1;
          return 2;
        }
        return 50; // general and others
      };

      const mappedFromStorage: VideoGuide[] = (data || [])
        .filter((f) => f.name.toLowerCase().endsWith('.mp4'))
        .sort((a, b) => {
          const ta = deriveTitle(a.name);
          const tb = deriveTitle(b.name);
          const ca = deriveCategory(ta);
          const cb = deriveCategory(tb);
          const pa = priority(ta, ca);
          const pb = priority(tb, cb);
          return pa - pb || ta.localeCompare(tb);
        })
        .map((f, index) => {
          const title = deriveTitle(f.name);
          const category = deriveCategory(title);
          return {
            id: f.id || `${f.name}-${index}`,
            title,
            description: '',
            video_url: f.name,
            thumbnail_url: '',
            duration_seconds: 0,
            category,
            target_roles: category === 'teacher-tools' ? ['teacher'] : category === 'student-tools' ? ['student'] : ['teacher', 'student'],
            order_index: index,
            is_featured: false,
            is_published: true,
            tags: [category.replace('-', ' ')],
            created_at: '',
            updated_at: ''
          };
        })
        // Prefer a logical grouping order inside each category by title
        .sort((a, b) => a.category.localeCompare(b.category) || a.title.localeCompare(b.title));

      let finalVideos = mappedFromStorage;

      // Fallback to curated list if storage listing returned nothing (or only non-mp4s)
      if (!finalVideos || finalVideos.length === 0) {
        const curatedNames: { name: string; category: string }[] = [
          // General
          { name: 'Switching Users Quick Guide - Made with Clipchamp_1756443802615.mp4', category: 'general' },
          { name: 'Feedback_Support - Made with Clipchamp_1756444117444.mp4', category: 'general' },
          // Teachers
          { name: 'Base Class Creation Quick Guide - Made with Clipchamp_1756441294024.mp4', category: 'teacher-tools' },
          { name: 'Edit Base Class Quick Guide - Made with Clipchamp_1756443201538.mp4', category: 'teacher-tools' },
          { name: 'Create Class Instance Quick Guide - Made with Clipchamp_1756443504070.mp4', category: 'teacher-tools' },
          // Students (Study Space)
          { name: 'Study Space Get Started - Made with Clipchamp_1756523607137.mp4', category: 'student-tools' },
          { name: 'Study Space Brain Bytes - Made with Clipchamp_1756524965968.mp4', category: 'student-tools' },
          { name: 'Study Space Chat and Tools - Made with Clipchamp_1756523956335.mp4', category: 'student-tools' },
          { name: 'Study Space Mind Map - Made with Clipchamp_1756524614830.mp4', category: 'student-tools' },
          { name: 'Student My Courses Quick Guide - Made with Clipchamp_1756444588758.mp4', category: 'student-tools' },
        ];

        // Apply same priority ordering to curated list
        curatedNames.sort((a, b) => {
          const ta = deriveTitle(a.name);
          const tb = deriveTitle(b.name);
          const pa = priority(ta, a.category);
          const pb = priority(tb, b.category);
          return pa - pb || ta.localeCompare(tb);
        });

        finalVideos = curatedNames.map((f, index) => {
          const title = deriveTitle(f.name);
          return {
            id: `${f.name}-${index}`,
            title,
            description: '',
            video_url: f.name,
            thumbnail_url: '',
            duration_seconds: 0,
            category: f.category,
            target_roles: f.category === 'teacher-tools' ? ['teacher'] : f.category === 'student-tools' ? ['student'] : ['teacher', 'student'],
            order_index: index,
            is_featured: false,
            is_published: true,
            tags: [f.category.replace('-', ' ')],
            created_at: '',
            updated_at: ''
          } as VideoGuide;
        })
        .sort((a, b) => a.category.localeCompare(b.category) || a.title.localeCompare(b.title));
      }

      setVideos(finalVideos);

      if (finalVideos.length > 0) {
        // Ensure selection starts on Base Class Creation when present
        const preferredIndex = finalVideos.findIndex(v => v.title.toLowerCase().startsWith('base class creation'));
        setSelectedVideo(finalVideos[preferredIndex >= 0 ? preferredIndex : 0]);
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

  // Touch gesture handlers for mobile swiping
  const minSwipeDistance = 50;

  const onTouchStart = (e: React.TouchEvent) => {
    setTouchEnd(null);
    setTouchStart(e.targetTouches[0].clientX);
  };

  const onTouchMove = (e: React.TouchEvent) => {
    setTouchEnd(e.targetTouches[0].clientX);
  };

  const onTouchEnd = () => {
    if (!touchStart || !touchEnd) return;
    
    const distance = touchStart - touchEnd;
    const isLeftSwipe = distance > minSwipeDistance;
    const isRightSwipe = distance < -minSwipeDistance;

    if (isLeftSwipe && currentVideoIndex < allVideos.length - 1) {
      // Swipe left - next video
      setSelectedVideo(allVideos[currentVideoIndex + 1]);
    }
    if (isRightSwipe && currentVideoIndex > 0) {
      // Swipe right - previous video
      setSelectedVideo(allVideos[currentVideoIndex - 1]);
    }
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

  // Sort helper for left list to enforce requested ordering per category
  const sortWithinCategoryList = (a: VideoGuide, b: VideoGuide) => {
    const ta = a.title.toLowerCase();
    const tb = b.title.toLowerCase();
    if (a.category === 'teacher-tools' && b.category === 'teacher-tools') {
      const pa = ta.startsWith('base class creation') ? 0 : ta.startsWith('edit base class') ? 1 : 2;
      const pb = tb.startsWith('base class creation') ? 0 : tb.startsWith('edit base class') ? 1 : 2;
      if (pa !== pb) return pa - pb;
      return ta.localeCompare(tb);
    }
    if (a.category === 'student-tools' && b.category === 'student-tools') {
      const pa = ta.startsWith('student my courses') ? 0 : ta.startsWith('study space get started') ? 1 : 2;
      const pb = tb.startsWith('student my courses') ? 0 : tb.startsWith('study space get started') ? 1 : 2;
      if (pa !== pb) return pa - pb;
      return ta.localeCompare(tb);
    }
    return ta.localeCompare(tb);
  };

  // Group and sort videos by category for the left list
  const videosByCategory = categories.reduce((acc, category) => {
    acc[category.id] = videos
      .filter((video) => video.category === category.id)
      .sort(sortWithinCategoryList);
    return acc;
  }, {} as Record<string, VideoGuide[]>);

  // Get all videos in the SAME order as the left list (by category order),
  // ensuring Base Class Creation appears first in Teachers.
  const sortWithinCategory = (a: VideoGuide, b: VideoGuide) => {
    const ta = a.title.toLowerCase();
    const tb = b.title.toLowerCase();
    if (a.category === 'teacher-tools' && b.category === 'teacher-tools') {
      const pa = ta.startsWith('base class creation') ? 0 : ta.startsWith('edit base class') ? 1 : 2;
      const pb = tb.startsWith('base class creation') ? 0 : tb.startsWith('edit base class') ? 1 : 2;
      if (pa !== pb) return pa - pb;
      return ta.localeCompare(tb);
    }
    if (a.category === 'student-tools' && b.category === 'student-tools') {
      const pa = ta.startsWith('student my courses') ? 0 : ta.startsWith('study space get started') ? 1 : 2;
      const pb = tb.startsWith('student my courses') ? 0 : tb.startsWith('study space get started') ? 1 : 2;
      if (pa !== pb) return pa - pb;
      return ta.localeCompare(tb);
    }
    return ta.localeCompare(tb);
  };

  const allVideos = categories
    .map((c) => videos.filter((v) => v.category === c.id).sort(sortWithinCategory))
    .flat();

  const currentVideoIndex = selectedVideo ? allVideos.findIndex((v) => v.id === selectedVideo.id) : -1;

  // Keyboard navigation
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (!isOpen) return;

      switch (e.key) {
        case 'ArrowLeft':
          e.preventDefault();
          if (currentVideoIndex > 0) {
            setSelectedVideo(allVideos[currentVideoIndex - 1]);
          }
          break;
        case 'ArrowRight':
          e.preventDefault();
          if (currentVideoIndex < allVideos.length - 1) {
            setSelectedVideo(allVideos[currentVideoIndex + 1]);
          }
          break;
        case 'Escape':
          e.preventDefault();
          onClose();
          break;
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, currentVideoIndex, allVideos, onClose, selectedVideo]);

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogPortal>
        <DialogOverlay className="backdrop-blur-sm bg-black/50" />
        <DialogContent className="!max-w-[95vw] !w-full !h-[95vh] md:!w-[1600px] md:!h-[90vh] p-0 gap-0 overflow-hidden [&>button]:hidden">
          <VisuallyHidden>
            <DialogTitle>Quick Guide</DialogTitle>
          </VisuallyHidden>
          
          {/* Mobile Layout */}
          <div className="flex flex-col md:flex-row h-full min-h-0">
            {/* Mobile Header */}
            <div className="md:hidden flex flex-col gap-2 p-4 border-b border-border bg-background flex-shrink-0">
              <div className="flex items-center justify-between">
                <h2 className="text-lg font-semibold">Quick Guide</h2>
                <Button variant="ghost" size="sm" onClick={onClose}>
                  <X className="h-4 w-4" />
                </Button>
              </div>
              {selectedVideo && (
                <div className="flex flex-col gap-1">
                  <h3 className="text-sm font-medium truncate">
                    {selectedVideo.title}
                  </h3>
                  <div className="flex items-center justify-between">
                    <div className="text-xs text-muted-foreground">
                      {currentVideoIndex + 1} of {allVideos.length}
                    </div>
                    {selectedVideo.description && (
                      <div className="text-xs text-muted-foreground truncate max-w-[200px]">
                        {selectedVideo.description}
                      </div>
                    )}
                  </div>
                </div>
              )}
            </div>

            {/* Video List Sidebar - Desktop only */}
            <div className="hidden md:flex md:w-[400px] bg-background border-r border-border flex-col flex-shrink-0 h-full max-h-full min-h-0">
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

            {/* Main Content Area - Video Player */}
            <div className="flex-1 flex flex-col bg-muted/30 min-w-0">
              {/* Content Header */}
              <div className="hidden md:flex items-center p-6 border-b border-border bg-background flex-shrink-0">
                <div className="flex-1 min-w-0">
                  <h3 className="text-lg font-semibold truncate">
                    {selectedVideo?.title || 'Select a guide to get started'}
                  </h3>
                  <p className="text-sm text-muted-foreground mt-1 line-clamp-2">
                    {selectedVideo?.description || 'Choose a video guide from the list to view the walkthrough demo.'}
                  </p>
                </div>
                <Button variant="ghost" size="sm" onClick={onClose} className="ml-4">
                  <X className="h-4 w-4" />
                </Button>
              </div>

              {/* Video Player Area */}
              <div className="flex-1 p-2 md:p-8 flex flex-col min-h-0">
                {/* Video Player Container */}
                <div className="flex-1 flex items-center justify-center min-h-0 mb-0">
                  <div className="w-full h-full max-w-none">
                    {/* Mobile: Use more flexible aspect ratio, Desktop: Fixed aspect-video */}
                    <div 
                      className="w-full h-full md:aspect-video bg-black rounded-lg overflow-hidden"
                      onTouchStart={onTouchStart}
                      onTouchMove={onTouchMove}
                      onTouchEnd={onTouchEnd}
                    >
                      {loading && !selectedVideo ? (
                        <div className="w-full h-full flex items-center justify-center bg-muted">
                          <div className="text-center px-4">
                            <Sparkles className="h-8 md:h-12 w-8 md:w-12 text-muted-foreground mx-auto mb-4 animate-pulse" />
                            <p className="text-sm md:text-base text-muted-foreground">Loading video guide...</p>
                          </div>
                        </div>
                      ) : !selectedVideo ? (
                        <div className="w-full h-full flex items-center justify-center bg-muted/50 rounded-lg">
                          <div className="text-center px-4">
                            <Play className="h-12 md:h-16 w-12 md:w-16 text-muted-foreground mx-auto mb-4" />
                            <p className="text-sm md:text-base text-muted-foreground">Select a guide to view the demo</p>
                          </div>
                        </div>
                      ) : (
                        renderVideoEmbed()
                      )}
                    </div>
                  </div>
                </div>
              </div>

              {/* Footer Navigation */}
              <div className="flex flex-col gap-2 p-4 md:p-6 border-t border-border bg-background flex-shrink-0">
                {/* Mobile swipe hint */}
                {selectedVideo && (
                  <div className="text-center md:hidden">
                    <p className="text-xs text-muted-foreground">
                      Swipe left/right on video to navigate
                    </p>
                  </div>
                )}
                
                {/* Navigation buttons */}
                <div className="flex items-center justify-between">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => {
                      if (currentVideoIndex > 0) {
                        setSelectedVideo(allVideos[currentVideoIndex - 1]);
                      }
                    }}
                    disabled={currentVideoIndex <= 0}
                    className="flex items-center gap-2"
                  >
                    <ArrowLeft className="h-3 w-3 md:hidden" />
                    <span className="hidden md:inline">Back</span>
                    <span className="md:hidden">Previous</span>
                  </Button>
                  
                  <div className="flex flex-col items-center gap-1">
                    <span className="text-xs md:text-sm text-muted-foreground">
                      {currentVideoIndex >= 0 && `${currentVideoIndex + 1} of ${allVideos.length}`}
                    </span>
                  </div>
                  
                  <Button
                    size="sm"
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
          </div>
        </DialogContent>
      </DialogPortal>
    </Dialog>
  );
}