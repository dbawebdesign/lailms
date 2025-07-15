'use client';

import { useState, useEffect } from 'react';
import Image from 'next/image';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Skeleton } from '@/components/ui/skeleton';
import { Play, Clock, Search, Users, BookOpen, GraduationCap, Wrench, AlertCircle, Sparkles, X } from 'lucide-react';
import { createClient } from '@/lib/supabase/client';
import { toast } from 'sonner';

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

const categories = [
  { id: 'all', name: 'All Videos', icon: Play },
  { id: 'getting-started', name: 'Getting Started', icon: Sparkles },
  { id: 'student-tools', name: 'Student Tools', icon: BookOpen },
  { id: 'teacher-tools', name: 'Teacher Tools', icon: Users },
  { id: 'parent-tools', name: 'Parent Tools', icon: GraduationCap },
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

const VideoCard = ({ video, onPlay }: { video: VideoGuide; onPlay: (video: VideoGuide) => void }) => {
  // Check if it's a YouTube URL or Supabase bucket path
  const isYouTubeUrl = video.video_url.includes('youtube.com') || video.video_url.includes('youtu.be');
  const thumbnailUrl = video.thumbnail_url || 
    (isYouTubeUrl ? `https://img.youtube.com/vi/${getYouTubeVideoId(video.video_url)}/maxresdefault.jpg` : '/placeholder-video.jpg');

  return (
    <Card className="overflow-hidden hover:shadow-lg transition-all duration-200 ease-in-out bg-surface border-border">
      <div className="relative">
        <Image 
          src={thumbnailUrl} 
          alt={video.title}
          width={400}
          height={192}
          className="w-full h-48 object-cover"
          onError={(e) => {
            e.currentTarget.src = '/placeholder-video.jpg';
          }}
        />
        <div className="absolute inset-0 bg-black bg-opacity-0 hover:bg-opacity-20 transition-all duration-200 ease-in-out flex items-center justify-center">
          <Button
            variant="secondary"
            size="sm"
            className="opacity-0 hover:opacity-100 transition-opacity duration-200 ease-in-out"
            onClick={() => onPlay(video)}
          >
            <Play className="h-4 w-4 mr-1" />
            Play
          </Button>
        </div>
        {video.is_featured && (
          <Badge className="absolute top-3 left-3 bg-gradient-to-r from-[#FF835D] to-[#E45DE5] text-white">
            Featured
          </Badge>
        )}
        <div className="absolute bottom-3 right-3 bg-black bg-opacity-75 text-white px-3 py-1 rounded-md text-sm flex items-center">
          <Clock className="h-3 w-3 mr-1" />
          {formatDuration(video.duration_seconds)}
        </div>
      </div>
      <CardContent className="p-6">
        <h3 className="font-semibold text-lg mb-3 line-clamp-2 text-foreground">{video.title}</h3>
        <p className="text-muted-foreground text-sm mb-4 line-clamp-3">{video.description}</p>
        <div className="flex flex-wrap gap-2 mb-4">
          {video.tags.slice(0, 3).map((tag) => (
            <Badge key={tag} variant="secondary" className="text-xs">
              {tag}
            </Badge>
          ))}
          {video.tags.length > 3 && (
            <Badge variant="outline" className="text-xs">
              +{video.tags.length - 3} more
            </Badge>
          )}
        </div>
        <div className="flex items-center justify-end">
          <Button
            variant="outline"
            size="sm"
            onClick={() => onPlay(video)}
            className="transition-all duration-200 ease-in-out"
          >
            <Play className="h-4 w-4 mr-1" />
            Watch
          </Button>
        </div>
      </CardContent>
    </Card>
  );
};

const VideoModal = ({ video, isOpen, onClose }: { video: VideoGuide | null; isOpen: boolean; onClose: () => void }) => {
  if (!isOpen || !video) return null;

  const isYouTubeUrl = video.video_url.includes('youtube.com') || video.video_url.includes('youtu.be');
  let embedUrl = video.video_url;
  
  if (isYouTubeUrl) {
    const videoId = getYouTubeVideoId(video.video_url);
    embedUrl = videoId ? `https://www.youtube.com/embed/${videoId}` : video.video_url;
  } else {
    // For Supabase bucket videos
    embedUrl = getSupabaseVideoUrl(video.video_url);
  }

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-6">
      <div className="bg-background rounded-xl max-w-4xl w-full max-h-[90vh] overflow-y-auto border border-border shadow-2xl">
        <div className="flex items-center justify-between p-6 border-b border-border">
          <h2 className="text-xl font-semibold text-foreground">{video.title}</h2>
          <Button variant="ghost" size="sm" onClick={onClose} className="transition-all duration-200 ease-in-out">
            <X className="h-4 w-4" />
          </Button>
        </div>
        <div className="p-6">
          <div className="aspect-video mb-6">
            {isYouTubeUrl ? (
              <iframe
                src={embedUrl}
                title={video.title}
                className="w-full h-full rounded-lg"
                frameBorder="0"
                allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                allowFullScreen
              />
            ) : (
              <video
                src={embedUrl}
                controls
                className="w-full h-full rounded-lg"
                poster={video.thumbnail_url}
              >
                Your browser does not support the video tag.
              </video>
            )}
          </div>
          <div className="space-y-6">
            <div>
              <h3 className="font-semibold mb-3 text-foreground">Description</h3>
              <p className="text-muted-foreground">{video.description}</p>
            </div>
            <div className="flex flex-wrap gap-6">
              <div>
                <span className="font-semibold text-foreground">Duration: </span>
                <span className="text-muted-foreground">{formatDuration(video.duration_seconds)}</span>
              </div>
              <div>
                <span className="font-semibold text-foreground">Category: </span>
                <span className="capitalize text-muted-foreground">{video.category.replace('-', ' ')}</span>
              </div>
            </div>

            <div>
              <span className="font-semibold text-foreground">Tags: </span>
              <div className="flex flex-wrap gap-2 mt-2">
                {video.tags.map((tag) => (
                  <Badge key={tag} variant="secondary" className="text-xs">
                    {tag}
                  </Badge>
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

const VideoSkeleton = () => (
  <Card className="overflow-hidden bg-surface border-border">
    <Skeleton className="w-full h-48" />
    <CardContent className="p-6">
      <Skeleton className="h-6 w-3/4 mb-3" />
      <Skeleton className="h-4 w-full mb-1" />
      <Skeleton className="h-4 w-2/3 mb-4" />
      <div className="flex gap-2 mb-4">
        <Skeleton className="h-5 w-16" />
        <Skeleton className="h-5 w-20" />
      </div>
      <div className="flex justify-between">
        <Skeleton className="h-5 w-20" />
        <Skeleton className="h-8 w-20" />
      </div>
    </CardContent>
  </Card>
);

export default function HelpPage() {
  const [videos, setVideos] = useState<VideoGuide[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('all');
  const [selectedVideo, setSelectedVideo] = useState<VideoGuide | null>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);

  useEffect(() => {
    fetchVideos();
  }, []);

  const fetchVideos = async () => {
    try {
      const supabase = createClient();
      const { data, error } = await supabase
        .from('video_guides')
        .select('*')
        .eq('is_published', true)
        .order('order_index', { ascending: true });

      if (error) {
        console.error('Error fetching videos:', error);
        toast.error('Failed to load videos');
        return;
      }

      setVideos(data || []);
    } catch (error) {
      console.error('Error fetching videos:', error);
      toast.error('Failed to load videos');
    } finally {
      setLoading(false);
    }
  };

  const filteredVideos = videos.filter((video) => {
    const matchesSearch = video.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         video.description.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         video.tags.some(tag => tag.toLowerCase().includes(searchTerm.toLowerCase()));
    
    const matchesCategory = selectedCategory === 'all' || video.category === selectedCategory;
    
    return matchesSearch && matchesCategory;
  });

  const featuredVideos = filteredVideos.filter(video => video.is_featured);
  const regularVideos = filteredVideos.filter(video => !video.is_featured);

  const handlePlay = (video: VideoGuide) => {
    setSelectedVideo(video);
    setIsModalOpen(true);
  };

  const handleCloseModal = () => {
    setSelectedVideo(null);
    setIsModalOpen(false);
  };

  return (
    <div className="min-h-screen bg-background">
      <div className="max-w-7xl mx-auto px-4 py-12">
        <div className="flex flex-col items-center mb-8">
          <Image
            src="/Horizontal white text.png"
            alt="Learnology AI"
            width={240}
            height={60}
            className="h-16 w-auto mb-4"
          />
        </div>
        <div className="text-center mb-12">
          <h1 className="text-4xl font-bold text-foreground mb-6">Help & Video Guides</h1>
          <p className="text-xl text-muted-foreground max-w-3xl mx-auto">
            Learn how to make the most of our educational platform with these step-by-step video guides.
            No account required - these resources are available to everyone.
          </p>
        </div>

        {/* Search and Filter */}
        <div className="flex flex-col md:flex-row gap-6 mb-12">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground h-4 w-4" />
            <Input
              placeholder="Search videos..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-10 h-12 border-input focus:border-accent focus:ring-accent/20"
            />
          </div>
          <div className="flex gap-3 overflow-x-auto">
            {categories.map((category) => {
              const Icon = category.icon;
              return (
                <Button
                  key={category.id}
                  variant={selectedCategory === category.id ? "default" : "outline"}
                  onClick={() => setSelectedCategory(category.id)}
                  className="whitespace-nowrap h-12 px-6 transition-all duration-200 ease-in-out"
                >
                  <Icon className="h-4 w-4 mr-2" />
                  {category.name}
                </Button>
              );
            })}
          </div>
        </div>

        {loading ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
            {Array.from({ length: 6 }).map((_, i) => (
              <VideoSkeleton key={i} />
            ))}
          </div>
        ) : (
          <>
            {/* Featured Videos */}
            {featuredVideos.length > 0 && (
              <div className="mb-12">
                <h2 className="text-2xl font-semibold text-foreground mb-6">Featured Videos</h2>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
                  {featuredVideos.map((video) => (
                    <VideoCard key={video.id} video={video} onPlay={handlePlay} />
                  ))}
                </div>
              </div>
            )}

            {/* Regular Videos */}
            {regularVideos.length > 0 && (
              <div>
                <h2 className="text-2xl font-semibold text-foreground mb-6">
                  {featuredVideos.length > 0 ? 'All Videos' : 'Video Guides'}
                </h2>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
                  {regularVideos.map((video) => (
                    <VideoCard key={video.id} video={video} onPlay={handlePlay} />
                  ))}
                </div>
              </div>
            )}

            {/* Empty State */}
            {filteredVideos.length === 0 && (
              <div className="text-center py-16">
                <Play className="h-16 w-16 text-muted-foreground mx-auto mb-6" />
                <h3 className="text-lg font-semibold text-foreground mb-3">No videos found</h3>
                <p className="text-muted-foreground max-w-md mx-auto">
                  {searchTerm || selectedCategory !== 'all' 
                    ? 'Try adjusting your search or filter criteria.'
                    : 'Video guides will appear here when they are published.'}
                </p>
              </div>
            )}
          </>
        )}

        {/* Video Modal */}
        <VideoModal 
          video={selectedVideo} 
          isOpen={isModalOpen} 
          onClose={handleCloseModal} 
        />
      </div>
    </div>
  );
} 