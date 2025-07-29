'use client';

import React, { useState, useEffect, useRef } from 'react';
import ReactMarkdown from 'react-markdown';
import { LessonContent, PracticalExample, CommonMisconception } from '@/lib/types/lesson';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { useLessonContent } from '@/hooks/useLessonContent';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Separator } from '@/components/ui/separator';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Slider } from '@/components/ui/slider';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  BookOpen, 
  Brain, 
  Target, 
  Lightbulb, 
  Sparkles, 
  CheckCircle2, 
  ArrowRight, 
  ArrowLeft,
  Play,
  Pause,
  RotateCcw,
  Volume2,
  VolumeX,
  Eye,
  EyeOff,
  ChevronRight,
  ChevronDown,
  ChevronLeft,
  ExternalLink,
  AlertTriangle,
  Globe
} from 'lucide-react';
import LunaContextElement from '@/components/luna/LunaContextElement';
import { emitProgressUpdate } from '@/lib/utils/progressEvents';
import { useEditor, EditorContent } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';
import { Table } from '@tiptap/extension-table';
import TableRow from '@tiptap/extension-table-row';
import TableCell from '@tiptap/extension-table-cell';
import TableHeader from '@tiptap/extension-table-header';
import { Image } from '@tiptap/extension-image';
import Link from '@tiptap/extension-link';
import { TaskList, TaskItem } from '@tiptap/extension-list';
import { Highlight } from '@tiptap/extension-highlight';
import { Mathematics } from '@tiptap/extension-mathematics';
import { Typography } from '@tiptap/extension-typography';
import { VideoNode } from '@/components/tiptap-node/video-node/video-node-extension';
import { Node } from '@tiptap/core';

interface LessonContentRendererProps {
  content?: LessonContent;
  lessonId?: string;
}

interface MediaAsset {
  id: string;
  asset_type: 'mind_map' | 'podcast';
  title: string;
  file_url?: string;
  duration?: number;
  status: string;
  content?: string;
  svg_content?: string;
}

// Simple YouTube iframe extension for student view
const YouTubeIframeExtension = Node.create({
  name: 'youtubeIframe',
  group: 'block',
  atom: true,

  addAttributes() {
    return {
      src: {
        default: null,
      },
      title: {
        default: null,
      },
    };
  },

  parseHTML() {
    return [
      {
        tag: 'div[data-youtube-embed]',
        getAttrs: (element) => {
          const iframe = element.querySelector('iframe');
          if (iframe) {
            return {
              src: iframe.getAttribute('src'),
              title: iframe.getAttribute('title'),
            };
          }
          return {};
        },
      },
      {
        tag: 'div.youtube-embed-wrapper',
        getAttrs: (element) => {
          const iframe = element.querySelector('iframe');
          if (iframe && iframe.getAttribute('src')?.includes('youtube.com/embed/')) {
            return {
              src: iframe.getAttribute('src'),
              title: iframe.getAttribute('title'),
            };
          }
          return false;
        },
      },
    ];
  },

  renderHTML({ HTMLAttributes }) {
    const { src, title } = HTMLAttributes;
    return [
      'div',
      {
        'data-youtube-embed': 'true',
        class: 'youtube-embed-wrapper',
        style: 'margin: 1.5rem 0;',
      },
      [
        'div',
        {
          style: 'position: relative; width: 100%; padding-bottom: 56.25%; height: 0; overflow: hidden; border-radius: 0.5rem; box-shadow: 0 10px 15px -3px rgba(0, 0, 0, 0.1), 0 4px 6px -2px rgba(0, 0, 0, 0.05);',
        },
        [
          'iframe',
          {
            src,
            title: title || 'YouTube video',
            style: 'position: absolute; top: 0; left: 0; width: 100%; height: 100%;',
            frameborder: '0',
            allow: 'accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture',
            allowfullscreen: 'true',
          },
        ],
      ],
      title ? [
        'p',
        {
          style: 'font-size: 0.875rem; color: #6b7280; margin-top: 0.5rem; text-align: center; font-style: italic;',
        },
        title,
      ] : '',
    ];
  },
});

// Rich Content Renderer Component for HTML content with media
const RichContentRenderer = ({ content }: { content: string }) => {
  const editor = useEditor({
    extensions: [
      StarterKit,
      Table.configure({ resizable: true }),
      TableRow,
      TableHeader,
      TableCell,
      Image.configure({
        inline: false,
        allowBase64: false,
      }),
      VideoNode.configure({
        inline: false,
        allowBase64: false,
      }),
      YouTubeIframeExtension, // Include YouTube extension for student view
      Link.configure({ 
        openOnClick: true, 
        autolink: true 
      }),
      TaskList,
      TaskItem,
      Highlight,
      Mathematics,
      Typography,
    ],
    content: content || '',
    editable: false,
    immediatelyRender: false,
  });

  if (!editor) {
    return (
      <div className="prose prose-slate dark:prose-invert max-w-none">
        <ReactMarkdown>{content}</ReactMarkdown>
      </div>
    );
  }

  return (
    <div className="prose prose-slate dark:prose-invert max-w-none">
      <EditorContent editor={editor} />
    </div>
  );
};

// Modern content section component with Apple-inspired design
const ContentSection = ({ 
  title, 
  children, 
  icon: Icon, 
  gradient = "from-blue-500/10 to-purple-500/10",
  delay = 0 
}: { 
  title: string; 
  children: React.ReactNode; 
  icon?: any;
  gradient?: string;
  delay?: number;
}) => (
  <LunaContextElement
    type="lesson-content-section"
    role="display"
    content={{
      title,
      sectionType: title.toLowerCase().replace(/\s+/g, '-'),
      hasIcon: !!Icon,
      gradient,
      description: `Educational content section: ${title}`,
      contentLength: typeof children === 'string' ? children.length : 'dynamic-content'
    }}
    metadata={{
      delay,
      isAnimated: true,
      hasChildren: !!children,
      iconName: Icon?.name || 'none'
    }}
    actionable={true}
  >
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.6, delay }}
      className="mb-8"
    >
      <Card className="border-0 shadow-sm bg-gradient-to-br from-white to-gray-50/50 dark:from-gray-900 dark:to-gray-800/50 backdrop-blur-sm">
        <CardHeader className="pb-4">
          <CardTitle className="flex items-center space-x-3 text-lg font-semibold">
            {Icon && <Icon className="h-5 w-5 text-primary" />}
            <span className="bg-gradient-to-r from-gray-900 to-gray-600 dark:from-white dark:to-gray-300 bg-clip-text text-transparent">
              {title}
            </span>
          </CardTitle>
      </CardHeader>
        <CardContent className={`prose prose-gray max-w-none dark:prose-invert bg-gradient-to-br ${gradient} rounded-lg p-6`}>
        {children}
      </CardContent>
    </Card>
    </motion.div>
  </LunaContextElement>
);

// Tesla-inspired audio player component
const AudioPlayer = ({ src, title }: { src: string; title: string }) => {
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [volume, setVolume] = useState(1);
  const [isMuted, setIsMuted] = useState(false);
  const audioRef = useRef<HTMLAudioElement>(null);

  const togglePlay = () => {
    if (audioRef.current) {
      if (isPlaying) {
        audioRef.current.pause();
      } else {
        audioRef.current.play();
      }
      setIsPlaying(!isPlaying);
    }
  };

  const handleTimeUpdate = () => {
    if (audioRef.current) {
      setCurrentTime(audioRef.current.currentTime);
    }
  };

  const handleLoadedMetadata = () => {
    if (audioRef.current) {
      setDuration(audioRef.current.duration);
    }
  };

  const handleSeek = (value: number[]) => {
    if (audioRef.current) {
      audioRef.current.currentTime = value[0];
      setCurrentTime(value[0]);
    }
  };

  const toggleMute = () => {
    if (audioRef.current) {
      audioRef.current.muted = !isMuted;
      setIsMuted(!isMuted);
    }
  };

  const restart = () => {
    if (audioRef.current) {
      audioRef.current.currentTime = 0;
      setCurrentTime(0);
    }
  };

  const formatTime = (time: number) => {
    const minutes = Math.floor(time / 60);
    const seconds = Math.floor(time % 60);
    return `${minutes}:${seconds.toString().padStart(2, '0')}`;
  };

  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.95 }}
      animate={{ opacity: 1, scale: 1 }}
      className="bg-gradient-to-r from-gray-900 to-gray-800 dark:from-gray-800 dark:to-gray-700 rounded-2xl p-6 text-white shadow-xl"
    >
      <audio
        ref={audioRef}
        src={src}
        onTimeUpdate={handleTimeUpdate}
        onLoadedMetadata={handleLoadedMetadata}
        onEnded={() => setIsPlaying(false)}
      />
      
      <div className="flex items-center space-x-4 mb-4">
        <div className="flex items-center space-x-2">
          <Brain className="h-5 w-5 text-blue-400" />
          <span className="font-medium text-sm">Brain Bytes</span>
        </div>
        <Badge variant="secondary" className="bg-blue-500/20 text-blue-300">
          Podcast
        </Badge>
      </div>

      <h4 className="font-semibold mb-4 text-white">{title}</h4>

      <div className="space-y-4">
        {/* Progress bar */}
        <div className="space-y-2">
          <Progress 
            value={(currentTime / duration) * 100} 
            className="h-2 bg-gray-700"
          />
          <div className="flex justify-between text-xs text-gray-400">
            <span>{formatTime(currentTime)}</span>
            <span>{formatTime(duration)}</span>
          </div>
        </div>

        {/* Controls */}
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-3">
            <Button
              variant="ghost"
              size="sm"
              onClick={restart}
              className="h-8 w-8 p-0 hover:bg-white/10"
            >
              <RotateCcw className="h-4 w-4" />
            </Button>
            <Button
              variant="ghost"
              size="lg"
              onClick={togglePlay}
              className="h-12 w-12 p-0 hover:bg-white/10 bg-white/5"
            >
              {isPlaying ? <Pause className="h-6 w-6" /> : <Play className="h-6 w-6" />}
            </Button>
            <Button
              variant="ghost"
              size="sm"
              onClick={toggleMute}
              className="h-8 w-8 p-0 hover:bg-white/10"
            >
              {isMuted ? <VolumeX className="h-4 w-4" /> : <Volume2 className="h-4 w-4" />}
            </Button>
          </div>
          
          <div className="text-xs text-gray-400">
            AI-Generated Content
          </div>
        </div>
      </div>
    </motion.div>
  );
};

// OpenAI-inspired mind map viewer
const MindMapViewer = ({ mindMapUrl, title }: { mindMapUrl: string; title: string }) => {
  const [isExpanded, setIsExpanded] = useState(false);

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className="mb-6"
    >
      <Card className="border-0 shadow-lg bg-gradient-to-br from-purple-50 to-indigo-50 dark:from-purple-900/20 dark:to-indigo-900/20">
        <CardHeader>
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-3">
              <div className="p-2 bg-purple-100 dark:bg-purple-900/30 rounded-lg">
                <Brain className="h-5 w-5 text-purple-600 dark:text-purple-400" />
              </div>
              <div>
                <CardTitle className="text-lg">Interactive Mind Map</CardTitle>
                <p className="text-sm text-muted-foreground">Visual learning companion</p>
              </div>
            </div>
            <Button
              variant="outline"
              onClick={() => setIsExpanded(!isExpanded)}
              className="flex items-center space-x-2"
            >
              {isExpanded ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
              <span>{isExpanded ? 'Hide' : 'Show'}</span>
            </Button>
          </div>
        </CardHeader>
        <AnimatePresence>
          {isExpanded && (
            <motion.div
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: 'auto', opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              transition={{ duration: 0.3 }}
            >
              <CardContent>
                <div className="relative rounded-lg overflow-hidden border bg-white dark:bg-gray-900">
                  <iframe
                    src={mindMapUrl}
                    className="w-full h-96 border-0"
                    title={`Mind Map: ${title}`}
                  />
                  <div className="absolute top-2 right-2">
                    <Button
                      variant="secondary"
                      size="sm"
                      onClick={() => window.open(mindMapUrl, '_blank')}
                      className="flex items-center space-x-1"
                    >
                      <ExternalLink className="h-3 w-3" />
                      <span>Full View</span>
                    </Button>
                  </div>
                </div>
              </CardContent>
            </motion.div>
          )}
        </AnimatePresence>
      </Card>
    </motion.div>
  );
};

// Enhanced practical examples with better UX
const PracticalExamplesSection = ({ examples }: { examples: PracticalExample[] }) => {
  const [expandedExample, setExpandedExample] = useState<number | null>(null);

  return (
    <div className="space-y-4">
      {examples.map((example, index) => (
        <motion.div
          key={index}
          initial={{ opacity: 0, x: -20 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ delay: index * 0.1 }}
        >
          <Card 
            className="cursor-pointer transition-all duration-200 hover:shadow-md border-l-4 border-l-green-500"
            onClick={() => setExpandedExample(expandedExample === index ? null : index)}
          >
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center space-x-3">
                  <div className="p-2 bg-green-100 dark:bg-green-900/30 rounded-lg">
                    <Lightbulb className="h-4 w-4 text-green-600 dark:text-green-400" />
                  </div>
                  <CardTitle className="text-base">{example.title}</CardTitle>
                </div>
                {expandedExample === index ? 
                  <ChevronDown className="h-4 w-4" /> : 
                  <ChevronRight className="h-4 w-4" />
                }
              </div>
            </CardHeader>
            <AnimatePresence>
              {expandedExample === index && (
                <motion.div
                  initial={{ height: 0, opacity: 0 }}
                  animate={{ height: 'auto', opacity: 1 }}
                  exit={{ height: 0, opacity: 0 }}
                >
                  <CardContent className="pt-0 space-y-4">
                    <div>
                      <h5 className="font-semibold text-sm text-blue-600 dark:text-blue-400 mb-2">Context</h5>
                      <div className="prose prose-sm max-w-none">
                <ReactMarkdown>{example.context}</ReactMarkdown>
                      </div>
                    </div>
                    <Separator />
                    <div>
                      <h5 className="font-semibold text-sm text-purple-600 dark:text-purple-400 mb-2">Walkthrough</h5>
                      <div className="prose prose-sm max-w-none">
                <ReactMarkdown>{example.walkthrough}</ReactMarkdown>
                      </div>
                    </div>
                    <Separator />
                    <div>
                      <h5 className="font-semibold text-sm text-green-600 dark:text-green-400 mb-2">Key Takeaways</h5>
                      <ul className="space-y-1">
                  {example.keyTakeaways.map((takeaway, i) => (
                          <li key={i} className="flex items-start space-x-2 text-sm">
                            <Target className="h-3 w-3 text-green-500 mt-1 flex-shrink-0" />
                            <span>{takeaway}</span>
                          </li>
                  ))}
                </ul>
                    </div>
                  </CardContent>
                </motion.div>
              )}
            </AnimatePresence>
          </Card>
        </motion.div>
      ))}
    </div>
  );
};

// Enhanced misconceptions section
const MisconceptionsSection = ({ misconceptions }: { misconceptions: CommonMisconception[] }) => {
  const [expandedMisconception, setExpandedMisconception] = useState<number | null>(null);

  return (
    <div className="space-y-4">
      {misconceptions.map((item, index) => (
        <motion.div
          key={index}
          initial={{ opacity: 0, x: -20 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ delay: index * 0.1 }}
        >
          <Card 
            className="cursor-pointer transition-all duration-200 hover:shadow-md border-l-4 border-l-orange-500"
            onClick={() => setExpandedMisconception(expandedMisconception === index ? null : index)}
          >
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center space-x-3">
                  <div className="p-2 bg-orange-100 dark:bg-orange-900/30 rounded-lg">
                    <AlertTriangle className="h-4 w-4 text-orange-600 dark:text-orange-400" />
                  </div>
                  <CardTitle className="text-base">{item.misconception}</CardTitle>
                </div>
                {expandedMisconception === index ? 
                  <ChevronDown className="h-4 w-4" /> : 
                  <ChevronRight className="h-4 w-4" />
                }
              </div>
            </CardHeader>
            <AnimatePresence>
              {expandedMisconception === index && (
                <motion.div
                  initial={{ height: 0, opacity: 0 }}
                  animate={{ height: 'auto', opacity: 1 }}
                  exit={{ height: 0, opacity: 0 }}
                >
                  <CardContent className="pt-0 space-y-4">
                    <div>
                      <h5 className="font-semibold text-sm text-red-600 dark:text-red-400 mb-2">Correction</h5>
                      <div className="prose prose-sm max-w-none">
                <ReactMarkdown>{item.correction}</ReactMarkdown>
                      </div>
                    </div>
                    <Separator />
                    <div>
                      <h5 className="font-semibold text-sm text-blue-600 dark:text-blue-400 mb-2">Prevention</h5>
                      <div className="prose prose-sm max-w-none">
                <ReactMarkdown>{item.prevention}</ReactMarkdown>
                      </div>
                    </div>
                  </CardContent>
                </motion.div>
              )}
            </AnimatePresence>
          </Card>
        </motion.div>
      ))}
    </div>
  );
};

export default function LessonContentRenderer({ content, lessonId }: LessonContentRendererProps) {
  const { data: lessonData, loading, error } = useLessonContent(lessonId || null);
  const [currentSectionIndex, setCurrentSectionIndex] = useState(0);
  const [completedSections, setCompletedSections] = useState<Set<number>>(new Set());
  const [isUpdatingProgress, setIsUpdatingProgress] = useState(false);
  const [currentProgressFromDB, setCurrentProgressFromDB] = useState<{progress: number, status: string, lastPosition?: string} | null>(null);
  const [showMediaPanel, setShowMediaPanel] = useState(false);
  const [activeTab, setActiveTab] = useState("content");

  // Use the comprehensive lesson data if available, otherwise fall back to the passed content
  const lesson = lessonData?.lesson;
  const sections = lesson?.sections || [];
  const mindMap = lessonData?.mindMap;
  const brainbytes = lessonData?.brainbytes;

  // Get current section content
  const currentSection = sections[currentSectionIndex];
  const displayContent = currentSection?.content || content;

  // Reset tab to "content" whenever section changes
  useEffect(() => {
    setActiveTab("content");
  }, [currentSectionIndex]);



  // Track section completion and update progress 
  // Progress will never go backwards thanks to the hierarchical progress service
  const updateLessonProgress = async (progressPercentage: number, status: string = 'in_progress') => {
    if (!lessonId || isUpdatingProgress) return;

    setIsUpdatingProgress(true);
    try {
      const response = await fetch(`/api/progress/lesson/${lessonId}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          progressPercentage,
          status,
          lastPosition: currentSectionIndex.toString()
        }),
      });

      if (!response.ok) {
        console.error('Failed to update lesson progress');
      } else {
        const data = await response.json();
        
        // Update local state to reflect new progress from server
        // The server ensures progress never goes backwards
        if (data.progress) {
          setCurrentProgressFromDB({
            progress: data.progress.progress_percentage || progressPercentage,
            status: data.progress.status || status,
            lastPosition: data.progress.last_position || currentSectionIndex.toString()
          });
        }
        
        // Emit progress update event for other components to listen to
        console.log('📢 Lesson Content: Emitting progress event:', {
          type: 'lesson',
          itemId: lessonId,
          progress: data.progress?.progress_percentage || progressPercentage,
          status: data.progress?.status || status
        });
        emitProgressUpdate('lesson', lessonId, data.progress?.progress_percentage || progressPercentage, data.progress?.status || status);
      }
    } catch (error) {
      console.error('Error updating lesson progress:', error);
    } finally {
      setIsUpdatingProgress(false);
    }
  };

  // Fetch current progress when lesson loads
  useEffect(() => {
    const loadCurrentProgress = async () => {
      if (lessonId) {
        const response = await fetch(`/api/progress/lesson/${lessonId}`);
        if (response.ok) {
          const data = await response.json();
          const progress = {
            progress: data.progress?.progress_percentage || 0,
            status: data.progress?.status || 'not_started',
            lastPosition: data.progress?.last_position
          };
          
          console.log('Loaded current progress from DB:', progress);
          setCurrentProgressFromDB(progress);
          
          // Restore current section index from last_position
          if (progress.lastPosition !== null && progress.lastPosition !== undefined) {
            const savedSectionIndex = parseInt(progress.lastPosition);
            if (!isNaN(savedSectionIndex) && savedSectionIndex >= 0 && savedSectionIndex < sections.length) {
              setCurrentSectionIndex(savedSectionIndex);
            }
          }
          
          // Initialize completed sections based on current progress
          if (progress && progress.progress > 0) {
            const completedCount = Math.floor((progress.progress / 100) * sections.length);
            const newCompleted = new Set<number>();
            for (let i = 0; i < completedCount; i++) {
              newCompleted.add(i);
            }
            setCompletedSections(newCompleted);
          }
        }
      }
    };
    loadCurrentProgress();
  }, [lessonId, sections.length]);

  // Mark the current section as completed when moving to next section
  const markCurrentSectionComplete = () => {
    setCompletedSections(prev => {
      const newCompleted = new Set(prev);
      newCompleted.add(currentSectionIndex);
      
      // Calculate progress based on completed sections
      const progressPercentage = Math.round((newCompleted.size / sections.length) * 100);
      
      // Update progress in database
      updateLessonProgress(progressPercentage, 'in_progress');
      
      return newCompleted;
    });
  };

  // Mark the entire lesson as complete
  const markLessonComplete = () => {
    setCompletedSections(prev => {
      const newCompleted = new Set(prev);
      // Mark all sections as complete
      for (let i = 0; i < sections.length; i++) {
        newCompleted.add(i);
      }
      
      // Mark lesson as completed
      updateLessonProgress(100, 'completed');
      
      return newCompleted;
    });
  };

  // Initialize progress for single-section lessons or lessons without sections (only mark as in_progress, not completed)
  useEffect(() => {
    if (lessonId && (sections.length <= 1 || (!sections.length && displayContent))) {
      // For lessons with no sections or single section, mark as in_progress when viewed
      if (currentProgressFromDB?.status === 'not_started') {
        updateLessonProgress(0, 'in_progress');
      }
    }
  }, [lessonId, sections.length, displayContent, currentProgressFromDB?.status]);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
          <p className="text-muted-foreground">Loading lesson content...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-center">
          <AlertTriangle className="h-12 w-12 text-red-500 mx-auto mb-4" />
          <p className="text-red-500 mb-2">Error loading content</p>
          <p className="text-sm text-muted-foreground">{error}</p>
        </div>
      </div>
    );
  }

  if (!displayContent && sections.length === 0) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-center">
          <BookOpen className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
          <p className="text-muted-foreground">No content available</p>
        </div>
      </div>
    );
  }

  // Navigation functions for sections
  const goToNextSection = () => {
    if (currentSectionIndex < sections.length - 1) {
      // Mark current section as complete before moving to next
      markCurrentSectionComplete();
      setCurrentSectionIndex(prev => prev + 1);
    }
  };

  const goToPrevSection = () => {
    if (currentSectionIndex > 0) {
      setCurrentSectionIndex(prev => prev - 1);
    }
  };

  // Calculate progress based on completed sections, but never go below current DB progress
  const calculatedProgress = sections.length > 0 ? Math.round((completedSections.size / sections.length) * 100) : 0;
  const progress = Math.max(calculatedProgress, currentProgressFromDB?.progress || 0);

  // Check if this is the last section and it's not completed yet
  const isLastSection = currentSectionIndex === sections.length - 1;
  const isCurrentSectionCompleted = completedSections.has(currentSectionIndex);
  const isLessonCompleted = currentProgressFromDB?.status === 'completed';

  return (
    <LunaContextElement
      type="lesson-content-renderer"
      role="display"
      content={{
        title: lesson?.title || displayContent?.sectionTitle,
        description: lesson?.description,
        hasAudio: !!brainbytes,
        hasMindMap: !!mindMap,
        currentSection: currentSection?.title,
        totalSections: sections.length,
        progress: progress,
        allSections: sections.map((section, index) => ({
          id: section.id,
          title: section.title,
          isCurrentSection: index === currentSectionIndex,
          isCompleted: completedSections.has(index)
        })),
        audioContent: brainbytes ? {
          title: brainbytes.title,
          hasAudio: !!(brainbytes as any).file_url,
          url: (brainbytes as any).file_url
        } : null,
        mindMapContent: mindMap ? {
          title: mindMap.title,
          content: mindMap.content
        } : null,
        displayContent: displayContent ? {
          introduction: displayContent.introduction,
          conceptIntroduction: displayContent.expertTeachingContent?.conceptIntroduction,
          detailedExplanation: displayContent.expertTeachingContent?.detailedExplanation,
          expertSummary: displayContent.expertSummary,
          practicalExamples: displayContent.expertTeachingContent?.practicalExamples,
          commonMisconceptions: displayContent.expertTeachingContent?.commonMisconceptions,
          expertInsights: displayContent.expertTeachingContent?.expertInsights,
          checkForUnderstanding: displayContent.checkForUnderstanding,
          realWorldConnections: displayContent.expertTeachingContent?.realWorldConnections,
          bridgeToNext: displayContent.bridgeToNext
        } : null
      }}
      metadata={{
        lessonId,
        hasInteractiveContent: !!(mindMap || brainbytes),
        sectionIndex: currentSectionIndex,
        currentSectionId: currentSection?.id,
        isCompleted: progress === 100,
        hasAllContentTypes: !!(displayContent?.introduction && displayContent?.expertTeachingContent?.conceptIntroduction && displayContent?.expertTeachingContent?.detailedExplanation)
      }}
      state={{
        isLoading: loading,
        hasError: !!error,
        currentSectionIndex,
        canNavigatePrevious: currentSectionIndex > 0,
        canNavigateNext: currentSectionIndex < sections.length - 1,
        activeTab: activeTab
      }}
      actionable={true}
    >
      <div className="max-w-4xl mx-auto p-6 space-y-8">
        {/* Header with lesson title and progress */}
        <motion.div
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          className="text-center mb-12"
        >
          <h1 className="text-4xl font-bold bg-gradient-to-r from-blue-600 via-purple-600 to-blue-800 bg-clip-text text-transparent mb-4">
            {lesson?.title || displayContent?.sectionTitle || 'Lesson Content'}
          </h1>
          
          {/* Section navigation and progress */}
          {sections.length > 1 && (
            <div className="flex items-center justify-center space-x-4 mb-6">
              <Button 
                variant="outline" 
                size="sm" 
                onClick={goToPrevSection}
                disabled={currentSectionIndex === 0}
              >
                <ChevronLeft className="h-4 w-4 mr-1" />
                Previous
              </Button>
              
              <div className="flex items-center space-x-2">
                <span className="text-sm text-muted-foreground">
                  Section {currentSectionIndex + 1} of {sections.length}
                </span>
                <Progress value={progress} className="w-24" />
                <span className="text-sm text-muted-foreground">{progress}%</span>
                {completedSections.has(currentSectionIndex) && (
                  <span className="text-xs text-green-600 font-medium">✓ Complete</span>
                )}
              </div>
              
              {!isLastSection ? (
                <Button 
                  variant="outline" 
                  size="sm" 
                  onClick={goToNextSection}
                >
                  Next
                  <ChevronRight className="h-4 w-4 ml-1" />
                </Button>
              ) : (
                !isLessonCompleted && (
                  <Button 
                    variant="default" 
                    size="sm" 
                    onClick={markLessonComplete}
                    className="bg-green-600 hover:bg-green-700"
                  >
                    <CheckCircle2 className="h-4 w-4 mr-1" />
                    Mark as Complete
                  </Button>
                )
              )}
            </div>
          )}

          {/* Single section completion button */}
          {sections.length <= 1 && !isLessonCompleted && (
            <div className="mb-6">
              <Button 
                variant="default" 
                size="sm" 
                onClick={markLessonComplete}
                className="bg-green-600 hover:bg-green-700"
              >
                <CheckCircle2 className="h-4 w-4 mr-1" />
                Mark Lesson as Complete
              </Button>
            </div>
          )}

          {/* Current section title */}
          {currentSection && (
            <h2 className="text-2xl font-semibold text-gray-700 dark:text-gray-300 mb-4">
              {currentSection.title}
            </h2>
          )}

          {/* Completion message */}
          {isLessonCompleted && (
            <motion.div
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              className="bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded-lg p-4 mb-6"
            >
              <div className="flex items-center space-x-2 text-green-700 dark:text-green-300">
                <Target className="h-5 w-5" />
                <span className="font-medium">Lesson Completed!</span>
              </div>
              <p className="text-sm text-green-600 dark:text-green-400 mt-1">
                You've completed this lesson. Great job!
              </p>
            </motion.div>
          )}
          
          <div className="flex items-center justify-center space-x-4 text-sm text-muted-foreground">
            <div className="flex items-center space-x-2">
              <Sparkles className="h-4 w-4" />
              <span>Enhanced Learning Experience</span>
            </div>
          </div>
        </motion.div>

        {/* Sticky Media Bar - Only show when media assets are available */}
        {(mindMap || brainbytes) && (
          <div className="sticky top-0 z-40 bg-white/95 dark:bg-gray-900/95 backdrop-blur-sm border-b border-gray-200 dark:border-gray-700 mb-6">
            <div className="flex items-center justify-between p-3">
              <div className="flex items-center gap-4">
                <div className="flex items-center gap-2">
                  <Brain className="h-4 w-4 text-blue-600" />
                  <span className="text-sm font-medium text-gray-700 dark:text-gray-300">
                    Enhanced Learning Tools Available
                  </span>
                </div>
                <div className="flex items-center gap-2">
                  {mindMap && (
                    <Badge variant="secondary" className="text-xs">
                      Mind Map
                    </Badge>
                  )}
                  {brainbytes && (
                    <Badge variant="secondary" className="text-xs">
                      Brain Bytes Podcast
                    </Badge>
                  )}
                </div>
              </div>
              <Button
                variant="outline"
                size="sm"
                onClick={() => setShowMediaPanel(!showMediaPanel)}
                className="flex items-center gap-2"
              >
                {showMediaPanel ? (
                  <>
                    <EyeOff className="h-4 w-4" />
                    Hide Tools
                  </>
                ) : (
                  <>
                    <Eye className="h-4 w-4" />
                    Show Tools
                  </>
                )}
              </Button>
            </div>
          </div>
        )}

        {/* Enhanced Floating Media Panel */}
        <AnimatePresence>
          {showMediaPanel && (mindMap || brainbytes) && (
            <motion.div
              initial={{ opacity: 0, x: 300 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: 300 }}
              className="fixed right-4 top-1/2 transform -translate-y-1/2 w-96 bg-white dark:bg-gray-900 rounded-xl shadow-2xl border border-gray-200 dark:border-gray-700 z-50 max-h-[80vh] overflow-hidden"
            >
              <div className="p-4 border-b border-gray-200 dark:border-gray-700">
                <div className="flex items-center justify-between">
                  <h3 className="font-semibold flex items-center gap-2">
                    <Brain className="h-5 w-5 text-blue-600" />
                    Learning Enhancement Tools
                  </h3>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => setShowMediaPanel(false)}
                  >
                    <EyeOff className="h-4 w-4" />
                  </Button>
                </div>
                <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">
                  Complementary resources to deepen your understanding
                </p>
              </div>
              
              <div className="overflow-y-auto max-h-[calc(80vh-120px)]">
                {mindMap && (
                  <div className="p-4 border-b border-gray-100 dark:border-gray-800">
                    <Card className="hover:shadow-md transition-shadow">
                      <CardContent className="p-4">
                        <div className="flex items-start gap-3">
                          <div className="p-3 rounded-lg bg-blue-100 dark:bg-blue-900/20">
                            <Brain className="h-5 w-5 text-blue-600" />
                          </div>
                          <div className="flex-1 min-w-0">
                            <h4 className="font-medium text-base">{mindMap.title}</h4>
                            <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">
                              Visual concept map showing key relationships and connections
                            </p>
                            <div className="mt-3">
                              <Button
                                size="sm"
                                onClick={() => {
                                  // Open mind map in modal
                                  window.open(`/api/student/lessons/${lessonId}/mind-map/${mindMap.id}`, '_blank', 'width=1200,height=800');
                                }}
                                className="w-full"
                              >
                                <Eye className="h-4 w-4 mr-2" />
                                Open Mind Map
                              </Button>
                            </div>
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  </div>
                )}

                {brainbytes && (
                  <div className="p-4">
                    <Card className="hover:shadow-md transition-shadow">
                      <CardContent className="p-4">
                        <div className="flex items-start gap-3">
                          <div className="p-3 rounded-lg bg-purple-100 dark:bg-purple-900/20">
                            <Volume2 className="h-5 w-5 text-purple-600" />
                          </div>
                          <div className="flex-1 min-w-0">
                            <h4 className="font-medium text-base">{brainbytes.title}</h4>
                            <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">
                              Audio summary perfect for reviewing key concepts
                            </p>
                            <div className="flex items-center gap-2 mt-2 mb-3">
                              <Badge variant="outline" className="text-xs">
                                {brainbytes.duration ? `${Math.round(brainbytes.duration / 60)} min` : 'Audio'}
                              </Badge>
                              <Badge variant="outline" className="text-xs">
                                Brain Bytes
                              </Badge>
                            </div>
                            <div className="space-y-3">
                              <AudioPlayer 
                                src={(brainbytes as any).file_url || ''} 
                                title={brainbytes.title}
                              />
                            </div>
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  </div>
                )}
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Section Content */}
        {displayContent && (
          <LunaContextElement
            type="lesson-content-tabs"
            role="navigation"
            content={{
              availableTabs: ["content", "examples", "insights"],
              activeTab: activeTab,
              currentTabContent: activeTab === "content" ? {
                introduction: displayContent.introduction,
                conceptIntroduction: displayContent.expertTeachingContent?.conceptIntroduction,
                detailedExplanation: displayContent.expertTeachingContent?.detailedExplanation,
                expertSummary: displayContent.expertSummary
              } : activeTab === "examples" ? {
                practicalExamples: displayContent.expertTeachingContent?.practicalExamples,
                commonMisconceptions: displayContent.expertTeachingContent?.commonMisconceptions
              } : {
                expertInsights: displayContent.expertTeachingContent?.expertInsights,
                checkForUnderstanding: displayContent.checkForUnderstanding,
                realWorldConnections: displayContent.expertTeachingContent?.realWorldConnections,
                bridgeToNext: displayContent.bridgeToNext
              },
              allTabsContent: {
                contentTab: {
                  introduction: displayContent.introduction,
                  conceptIntroduction: displayContent.expertTeachingContent?.conceptIntroduction,
                  detailedExplanation: displayContent.expertTeachingContent?.detailedExplanation,
                  expertSummary: displayContent.expertSummary
                },
                examplesTab: {
                  practicalExamples: displayContent.expertTeachingContent?.practicalExamples,
                  commonMisconceptions: displayContent.expertTeachingContent?.commonMisconceptions
                },
                insightsTab: {
                  expertInsights: displayContent.expertTeachingContent?.expertInsights,
                  checkForUnderstanding: displayContent.checkForUnderstanding,
                  realWorldConnections: displayContent.expertTeachingContent?.realWorldConnections,
                  bridgeToNext: displayContent.bridgeToNext
                }
              }
            }}
            state={{
              activeTab: activeTab,
              currentSectionIndex: currentSectionIndex,
              progress: progress
            }}
            metadata={{
              lessonId,
              sectionIndex: currentSectionIndex,
              hasAllContent: !!(displayContent.introduction && displayContent.expertTeachingContent?.conceptIntroduction && displayContent.expertTeachingContent?.detailedExplanation),
              componentPurpose: `This component displays lesson content in tabs. The student is currently viewing the "${activeTab}" tab. Luna should reference the content from the currently active tab when answering questions about what the student is viewing.`
            }}
            actionable={true}
          >
            <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
              <TabsList className="grid w-full grid-cols-3 mb-8">
                <TabsTrigger value="content" className="flex items-center space-x-2">
                  <BookOpen className="h-4 w-4" />
                  <span>Content</span>
                </TabsTrigger>
                <TabsTrigger value="examples" className="flex items-center space-x-2">
                  <Lightbulb className="h-4 w-4" />
                  <span>Examples</span>
                </TabsTrigger>
                <TabsTrigger value="insights" className="flex items-center space-x-2">
                  <Target className="h-4 w-4" />
                  <span>Insights</span>
                </TabsTrigger>
              </TabsList>

            <TabsContent value="content" className="space-y-6">
              {displayContent.introduction && (
                <ContentSection title="Introduction" icon={BookOpen} delay={0.1}>
                  <ReactMarkdown>{displayContent.introduction}</ReactMarkdown>
                </ContentSection>
              )}
              
              {displayContent.expertTeachingContent?.conceptIntroduction && (
                <ContentSection title="Concept Introduction" icon={Sparkles} gradient="from-blue-500/10 to-cyan-500/10" delay={0.2}>
                  <ReactMarkdown>{displayContent.expertTeachingContent.conceptIntroduction}</ReactMarkdown>
                </ContentSection>
              )}
              
              {displayContent.expertTeachingContent?.detailedExplanation && (
                <ContentSection title="Detailed Explanation" icon={Brain} gradient="from-purple-500/10 to-pink-500/10" delay={0.3}>
                  <RichContentRenderer content={displayContent.expertTeachingContent.detailedExplanation} />
                </ContentSection>
              )}

              {displayContent.expertSummary && (
                <ContentSection title="Expert Summary" icon={Target} gradient="from-green-500/10 to-emerald-500/10" delay={0.4}>
                  <ReactMarkdown>{displayContent.expertSummary}</ReactMarkdown>
                </ContentSection>
              )}
            </TabsContent>

            <TabsContent value="examples">
              {displayContent.expertTeachingContent?.practicalExamples && (
                <ContentSection title="Practical Examples" icon={Lightbulb}>
                  <PracticalExamplesSection examples={displayContent.expertTeachingContent.practicalExamples} />
                </ContentSection>
              )}
              
              {displayContent.expertTeachingContent?.commonMisconceptions && (
                <ContentSection title="Common Misconceptions" icon={AlertTriangle}>
                  <MisconceptionsSection misconceptions={displayContent.expertTeachingContent.commonMisconceptions} />
                </ContentSection>
              )}
            </TabsContent>

            <TabsContent value="insights">
              {displayContent.expertTeachingContent?.expertInsights && (
                <ContentSection title="Expert Insights" icon={Brain} gradient="from-indigo-500/10 to-purple-500/10">
                  <ul className="space-y-3">
                    {displayContent.expertTeachingContent.expertInsights.map((insight: string, i: number) => (
                      <motion.li 
                        key={i} 
                        initial={{ opacity: 0, x: -20 }}
                        animate={{ opacity: 1, x: 0 }}
                        transition={{ delay: i * 0.1 }}
                        className="flex items-start space-x-3 p-3 bg-white/50 dark:bg-gray-800/50 rounded-lg"
                      >
                        <Sparkles className="h-4 w-4 text-indigo-500 mt-1 flex-shrink-0" />
                        <span>{insight}</span>
                      </motion.li>
                    ))}
                  </ul>
                </ContentSection>
              )}

              {displayContent.checkForUnderstanding && (
                <ContentSection title="Check for Understanding" icon={Target} gradient="from-orange-500/10 to-red-500/10">
                  <ul className="space-y-3">
                    {displayContent.checkForUnderstanding.map((question: string, i: number) => (
                      <motion.li 
                        key={i}
                        initial={{ opacity: 0, x: -20 }}
                        animate={{ opacity: 1, x: 0 }}
                        transition={{ delay: i * 0.1 }}
                        className="flex items-start space-x-3 p-3 bg-white/50 dark:bg-gray-800/50 rounded-lg"
                      >
                        <Target className="h-4 w-4 text-orange-500 mt-1 flex-shrink-0" />
                        <span>{question}</span>
                      </motion.li>
                    ))}
                  </ul>
                </ContentSection>
              )}

              {displayContent.expertTeachingContent?.realWorldConnections && (
                <ContentSection title="Real-World Connections" icon={Globe} gradient="from-emerald-500/10 to-teal-500/10">
                  <ul className="space-y-3">
                    {displayContent.expertTeachingContent.realWorldConnections.map((connection: string, i: number) => (
                      <motion.li 
                        key={i}
                        initial={{ opacity: 0, x: -20 }}
                        animate={{ opacity: 1, x: 0 }}
                        transition={{ delay: i * 0.1 }}
                        className="flex items-start space-x-3 p-3 bg-white/50 dark:bg-gray-800/50 rounded-lg"
                      >
                        <Globe className="h-4 w-4 text-emerald-500 mt-1 flex-shrink-0" />
                        <span>{connection}</span>
                      </motion.li>
                    ))}
                  </ul>
                </ContentSection>
              )}

              {displayContent.bridgeToNext && (
                <ContentSection title="Bridge to Next Section" icon={ChevronRight} gradient="from-teal-500/10 to-cyan-500/10">
                  <ReactMarkdown>{displayContent.bridgeToNext}</ReactMarkdown>
                </ContentSection>
              )}
            </TabsContent>
          </Tabs>
          </LunaContextElement>
        )}

        {/* Section Navigation Footer */}
        {sections.length > 1 && (
          <LunaContextElement
            type="lesson-navigation"
            role="navigation"
            content={{
              currentSection: currentSectionIndex + 1,
              totalSections: sections.length,
              progress: progress,
              canGoToPrevious: currentSectionIndex > 0,
              canGoToNext: currentSectionIndex < sections.length - 1,
              sections: sections.map((section, index) => ({
                id: section.id,
                title: section.title,
                isCurrentSection: index === currentSectionIndex,
                isCompleted: completedSections.has(index)
              }))
            }}
            metadata={{
              lessonId,
              currentSectionId: sections[currentSectionIndex]?.id,
              currentSectionIndex
            }}
            actionable={true}
          >
            <div className="flex justify-between items-center pt-8 border-t border-border">
              <Button 
                variant="outline" 
                onClick={goToPrevSection}
                disabled={currentSectionIndex === 0}
                className="flex items-center space-x-2"
              >
                <ChevronLeft className="h-4 w-4" />
                <span>Previous Section</span>
              </Button>
              
              <div className="text-center">
                <p className="text-sm text-muted-foreground mb-2">
                  Section {currentSectionIndex + 1} of {sections.length}
                </p>
                <Progress value={progress} className="w-32" />
              </div>
              
              {!isLastSection ? (
                <Button 
                  variant="outline" 
                  onClick={goToNextSection}
                  className="flex items-center space-x-2"
                >
                  <span>Next Section</span>
                  <ChevronRight className="h-4 w-4" />
                </Button>
              ) : (
                !isLessonCompleted && (
                  <Button 
                    variant="default" 
                    onClick={markLessonComplete}
                    className="flex items-center space-x-2 bg-green-600 hover:bg-green-700"
                  >
                    <CheckCircle2 className="h-4 w-4" />
                    <span>Mark as Complete</span>
                  </Button>
                )
              )}
            </div>
          </LunaContextElement>
        )}
      </div>
    </LunaContextElement>
  );
} 