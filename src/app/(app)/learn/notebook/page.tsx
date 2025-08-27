'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import { createPortal } from 'react-dom';
import { useRouter, useSearchParams } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import ReactMarkdown from 'react-markdown';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { ResizablePanelGroup, ResizablePanel, ResizableHandle } from '@/components/ui/resizable';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Checkbox } from '@/components/ui/checkbox';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Textarea } from '@/components/ui/textarea';
import { 
  BookOpen,
  Search,
  FileText,
  Video,
  Download,
  Play,
  MessageSquare,
  NotebookPen,
  Target,
  BarChart3,
  Sparkles,
  Mic,
  Send,
  Plus,
  Settings,
  Bookmark,
  Clock,
  TrendingUp,
  Zap,
  Users,
  Filter,
  MoreHorizontal,
  ChevronRight,
  Volume2,
  Eye,
  ChevronDown,
  Upload,
  FolderPlus,
  GraduationCap,
  Library,
  Lightbulb,
  ArrowRight,
  Star,
  Calendar,
  Activity,
  Maximize2,
  Minimize2,
  X,
  ExternalLink,
  PlayCircle,
  PauseCircle,
  SkipForward,
  SkipBack,
  VolumeX,
  Brain,
  Map,
  Headphones,
  CheckSquare,
  PenTool,
  Check,
  ChevronsUpDown,

  Bold,
  Italic,
  Underline,
  Highlighter,
  List,
  ListOrdered,
  Link,
  Code,
  Save,
  Edit,
  ArrowLeft,
  Type,
  Palette,
  Wand2,
  RefreshCw,
  Trash2,
  Copy,
  ChevronLeft,
  Loader2,
  Image,
  CheckCircle2
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { NotionEditorWrapper } from '@/components/tiptap-templates/notion-like/notion-editor-wrapper';
import { lunaAIService, type StudyContext, type LunaConversation } from '@/lib/services/luna-ai-service';
import { StudyMindMapViewer } from '@/components/study-space/MindMapViewer';
import { LessonContentRenderer } from '@/components/study-space/LessonContentRenderer';
import { LunaChat, LunaChatRef } from '@/components/study-space/LunaChat';
import { BrainbytesGenerator } from '@/components/study-space/BrainbytesGenerator';
import { useToast } from '@/components/ui/use-toast';
import { useDebounce } from '@/hooks/use-debounce';
import { v4 as uuidv4 } from 'uuid';
import LunaContextElement from '@/components/luna/LunaContextElement';

interface Course {
  id: string;
  name: string;
  title: string; // Add title property
  description: string;
  instructor: string;
  progress: number;
  color: string;
  base_class_id?: string;
}

interface LessonSectionContent {
  introduction?: string;
  sectionTitle?: string;
  expertSummary?: string;
  bridgeToNext?: string;
  checkForUnderstanding?: string[];
  expertTeachingContent?: {
    conceptIntroduction?: string;
    detailedExplanation?: string;
    practicalExamples?: Array<{
      title: string;
      context?: string;
      walkthrough?: string;
      keyTakeaways?: string[];
    }>;
    commonMisconceptions?: Array<{
      misconception: string;
      correction: string;
      prevention: string;
    }>;
    expertInsights?: string[];
    realWorldConnections?: string[];
  };
}

interface ContentItem {
  id: string;
  title: string;
  type: 'lesson' | 'document' | 'video' | 'assignment' | 'discussion' | 'resource' | 'section';
  description?: string;
  duration?: string;
  progress?: number;
  thumbnail?: string;
  tags?: string[];
  course_id?: string;
  content?: string | LessonSectionContent;
  url?: string;
  base_class_id?: string;
  lesson_id?: string;
  path_id?: string;
  order_index?: number;
  section_type?: 'text' | 'video' | 'audio' | 'image' | 'interactive';
  video_url?: string;
  audio_url?: string;
  image_url?: string;
}

interface StudySpace {
  id: string;
  name: string;
  type: 'course' | 'custom';
  course_id?: string;
  description?: string;
  color: string;
  created_at: string;
}

interface TextSelection {
  text: string;
  startOffset: number;
  endOffset: number;
  x: number;
  y: number;
}

interface Note {
  id: string;
  title: string;
  content: any;
  created_at: string;
  updated_at: string;
  tags: string[];
  source?: string;
  isStarred: boolean;
  study_space_id?: string;
  isNew?: boolean;
  user_id?: string;
  organisation_id?: string;
}

type PanelExpansion = 'none' | 'sources' | 'tools';
type NoteView = 'list' | 'editor';

export default function UnifiedStudySpace() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const spaceId = searchParams?.get('space');
  const contentRef = useRef<HTMLDivElement>(null);
  const noteEditorRef = useRef<any>(null);
  const lunaChatRef = useRef<LunaChatRef>(null);
  const supabase = createClient();
  const { toast } = useToast();

  // UI State
  const [selectedCourse, setSelectedCourse] = useState<Course | null>(null);
  const [selectedSpace, setSelectedSpace] = useState<StudySpace | null>(null);
  const [selectedSources, setSelectedSources] = useState<Set<string>>(new Set());
  const [sourceDropdownOpen, setSourceDropdownOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  
  // Hierarchical content selection state
  const [selectedPaths, setSelectedPaths] = useState<Set<string>>(new Set());
  const [selectedLessons, setSelectedLessons] = useState<Set<string>>(new Set());
  const [selectedSections, setSelectedSections] = useState<Set<string>>(new Set());
  const [chatMessage, setChatMessage] = useState('');
  const [isGenerating, setIsGenerating] = useState(false);
  const [showCreateSpace, setShowCreateSpace] = useState(false);
  const [newSpaceName, setNewSpaceName] = useState('');
  const [expandedPanel, setExpandedPanel] = useState<PanelExpansion>('none');
  const [activeToolTab, setActiveToolTab] = useState('chat');
  const [highlightedTextForLuna, setHighlightedTextForLuna] = useState<string | null>(null);

  // Reset auto-generate flag when switching away from mindmaps tab (but not when switching TO it)
  const prevActiveToolTab = useRef(activeToolTab);
  useEffect(() => {
    const previousTab = prevActiveToolTab.current;
    prevActiveToolTab.current = activeToolTab;
    
    // Only reset if we're switching AWAY from mindmaps, not TO mindmaps
    if (previousTab === 'mindmaps' && activeToolTab !== 'mindmaps') {
      setShouldAutoGenerateMindMap(false);
    }
  }, [activeToolTab]);
  const [textSelection, setTextSelection] = useState<TextSelection | null>(null);
  const [showSelectionPopover, setShowSelectionPopover] = useState(false);
  const [persistedSelection, setPersistedSelection] = useState<Range | null>(null);
  const [shouldAutoGenerateMindMap, setShouldAutoGenerateMindMap] = useState(false);
  const [shouldAutoGenerateAudio, setShouldAutoGenerateAudio] = useState(false);
  const [currentMindMap, setCurrentMindMap] = useState<any>(null); // Lift mind map state to parent

  // Clear mind map when study space changes
  useEffect(() => {
    if (selectedSpace) {
      console.log('Study space changed, clearing mind map and resetting auto-generate flags');
      setCurrentMindMap(null);
      setShouldAutoGenerateMindMap(false);
      setShouldAutoGenerateAudio(false);
    }
  }, [selectedSpace?.id]);

  // Note-taking states
  const [noteView, setNoteView] = useState<NoteView>('list');
  const [currentNote, setCurrentNote] = useState<Note | null>(null);
  const [noteTitle, setNoteTitle] = useState('');
  const [noteContent, setNoteContent] = useState('');
  const [isEditingNote, setIsEditingNote] = useState(false);
  const [noteSelection, setNoteSelection] = useState<TextSelection | null>(null);
  const [showNoteActions, setShowNoteActions] = useState(false);
  const [isSaving, setIsSaving] = useState(false);

  // Video player state for premium content viewing
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [volume, setVolume] = useState(1);
  const [isMuted, setIsMuted] = useState(false);

  // Loading states
  const [isLoadingCourses, setIsLoadingCourses] = useState(true);
  const [isLoadingContent, setIsLoadingContent] = useState(false);
  const [isLoadingNotes, setIsLoadingNotes] = useState(false);

  // Data states - now connected to Supabase
  const [courses, setCourses] = useState<Course[]>([]);
  const [studySpaces, setStudySpaces] = useState<StudySpace[]>([]);
  const [contentItems, setContentItems] = useState<ContentItem[]>([]);
  const [notes, setNotes] = useState<Note[]>([]);
  const [currentUser, setCurrentUser] = useState<any>(null);
  const [currentConversation, setCurrentConversation] = useState<LunaConversation | null>(null);
  const [isChatInterfaceOpen, setIsChatInterfaceOpen] = useState(false);
  const [activeNote, setActiveNote] = useState<Note | null>(null);
  const [userProfile, setUserProfile] = useState<any>(null);
  const [activeStudySpace, setActiveStudySpace] = useState<StudySpace | null>(null);

  // Initialize user and load data
  useEffect(() => {
    const initializeUser = async () => {
      try {
        const { data: { user } } = await supabase.auth.getUser();
        if (user) {
          console.log('🔐 User authenticated:', user.id);
          setCurrentUser(user);
          await loadUserCourses(); // Uses API that handles family account switching
          await loadUserStudySpaces(); // Updated to use active profile
          // Don't load notes until a study space is selected
          // Don't create study session until user selects a course/space
        }
      } catch (error) {
        console.error('Error initializing user:', error);
      } finally {
        setIsLoadingCourses(false);
      }
    };

    initializeUser();
  }, []);

  // Load user's enrolled courses and class instances using API (handles family account switching)
  const loadUserCourses = async () => {
    try {
      setIsLoadingCourses(true);
      
      console.log('📚 Loading courses via API...');
      
      // Use the API endpoint that properly handles family account switching
      const response = await fetch('/api/learn/courses', {
        cache: 'no-store',
        headers: {
          'Cache-Control': 'no-cache'
        }
      });

      if (!response.ok) {
        console.error('Error loading courses from API:', response.status, response.statusText);
        setCourses([]);
        return;
      }

      const coursesData = await response.json();
      console.log('Study space courses from API:', coursesData);

      if (coursesData && coursesData.length > 0) {
        const courseData: Course[] = coursesData.map((course: any) => {
          console.log('Processing course:', course);
          
          return {
            id: course.id,
            name: course.name,
            title: course.name,
            description: course.baseClass?.description || 'No description available',
            instructor: 'Instructor', // TODO: Get actual instructor info
            progress: 0, // TODO: Calculate actual progress
            color: getRandomColor(),
            base_class_id: course.baseClass?.id
          };
        });

        console.log('Processed course data for study space:', courseData);
        setCourses(courseData);
      } else {
        console.log('No courses found from API');
        setCourses([]);
      }
    } catch (error) {
      console.error('Error loading courses:', error);
      setCourses([]);
    } finally {
      setIsLoadingCourses(false);
    }
  };

  // Load user's study spaces (using active profile for family account switching)
  const loadUserStudySpaces = async () => {
    try {
      // Determine the active user ID (handles family account switching)
      let activeUserId: string;
      
      // Check for active family member cookie
      const activeFamilyMemberCookie = document.cookie
        .split('; ')
        .find(row => row.startsWith('active_family_member='));
      const activeFamilyMemberId = activeFamilyMemberCookie?.split('=')[1];
      
      if (activeFamilyMemberId) {
        activeUserId = activeFamilyMemberId;
        console.log('📚 Loading study spaces for active family member:', activeUserId);
      } else {
        // Fall back to authenticated user
        const { data: { user } } = await supabase.auth.getUser();
        activeUserId = user?.id || '';
        console.log('📚 Loading study spaces for authenticated user:', activeUserId);
      }
      
      if (!activeUserId) {
        console.error('No active user ID found');
        return;
      }
      
      const { data: spaces, error } = await supabase
        .from('study_spaces')
        .select(`
          *,
          base_classes!study_spaces_course_id_fkey (
            id,
            name
          )
        `)
        .eq('user_id', activeUserId)
        .order('created_at', { ascending: false });

      if (error) {
        console.error('Error loading study spaces:', error);
        return;
      }

      if (spaces) {
        const studySpaceData: StudySpace[] = spaces.map(space => ({
          id: space.id,
          name: space.name,
          type: space.course_id ? 'course' : 'custom',
          course_id: space.course_id,
          description: space.description,
          color: space.color || 'bg-orange-500',
          created_at: space.created_at
        }));

        console.log(`📚 Loaded ${studySpaceData.length} study spaces:`, studySpaceData.map(s => ({ 
          name: s.name, 
          type: s.type, 
          course_id: s.course_id 
        })));
        setStudySpaces(studySpaceData);
      }
    } catch (error) {
      console.error('Error loading study spaces:', error);
    }
  };

  // Load user's notes - FIXED: Always require study space ID to prevent cross-contamination
  const loadUserNotes = async (userId: string, studySpaceId?: string) => {
    try {
      setIsLoadingNotes(true);
      
      // FIXED: Only load notes if we have a study space ID to prevent cross-contamination
      if (!studySpaceId) {
        console.log('🚫 No study space selected, clearing notes');
        setNotes([]);
        return;
      }

      const { data: userNotes, error } = await supabase
        .from('study_notes')
        .select('*')
        .eq('user_id', userId)
        .eq('study_space_id', studySpaceId) // FIXED: Always filter by study space
        .order('updated_at', { ascending: false });

      if (error) {
        console.error('Error loading notes:', error);
        return;
      }

      console.log(`📝 Loaded ${userNotes?.length || 0} notes for study space:`, studySpaceId);

      if (userNotes) {
        const noteData: Note[] = userNotes.map(note => ({
          id: note.id,
          title: note.title,
          content: note.content,
          created_at: note.created_at,
          updated_at: note.updated_at,
          tags: note.tags || [],
          isStarred: note.is_favorite || false,
          study_space_id: note.study_space_id,
          isNew: note.is_new || false,
          user_id: note.user_id,
          organisation_id: note.organisation_id,
        }));

        setNotes(noteData);
      }
    } catch (error) {
      console.error('Error loading notes:', error);
    } finally {
      setIsLoadingNotes(false);
    }
  };

    // Load content based on selected course or space - FIXED: Ensure sources load properly
  useEffect(() => {
    console.log('🔄 Loading content for:', { 
      selectedCourse: selectedCourse?.name, 
      selectedSpace: selectedSpace?.name,
      courseBaseClassId: selectedCourse?.base_class_id,
      spaceCourseId: selectedSpace?.course_id
    });
    
    // Always clear content first to show loading state
    setContentItems([]);
    
    if (selectedSpace?.type === 'course' && selectedSpace.course_id) {
      // FIXED: For course-linked study spaces, always load the course content
      console.log('📚 Loading course content for study space:', selectedSpace.name, 'Course ID:', selectedSpace.course_id);
      loadCourseContent(selectedSpace.course_id);
    } else if (selectedCourse && selectedCourse.base_class_id) {
      // Load content directly from selected course
      console.log('📚 Loading course content directly:', selectedCourse.name, 'Base class ID:', selectedCourse.base_class_id);
      loadCourseContent(selectedCourse.base_class_id);
    } else if (selectedSpace?.type === 'custom') {
      console.log('📁 Loading custom content for space:', selectedSpace.name);
      loadCustomContent(selectedSpace.id);
    } else {
      // Keep content cleared when nothing is selected
      console.log('🚫 No valid selection, content cleared');
    }
  }, [selectedCourse, selectedSpace]);

  // Load notes when a study space is selected
  useEffect(() => {
    if (currentUser && selectedSpace) {
      loadUserNotes(currentUser.id, selectedSpace.id);
    } else {
      // Clear notes when no study space is selected - don't show any notes
      setNotes([]);
    }
  }, [currentUser, selectedSpace]);

  const loadCourseContent = async (baseClassId: string) => {
    try {
      setIsLoadingContent(true);
      
      console.log('Loading course content for base class:', baseClassId);
      
      // Load paths first (using the same pattern as the working navigation API)
      const { data: paths, error: pathsError } = await supabase
        .from('paths')
        .select('id, title, description, order_index')
        .eq('base_class_id', baseClassId)
        .order('order_index');

      if (pathsError) {
        console.error('Error loading paths:', pathsError);
        return;
      }

      console.log('Loaded paths:', paths);

      if (paths && paths.length > 0) {
        const contentItems: ContentItem[] = [];
        const pathIds = paths.map(p => p.id);

        // Load lessons for all paths
        const { data: lessons, error: lessonsError } = await supabase
          .from('lessons')
          .select('*')
          .in('path_id', pathIds)
          .order('order_index');

        if (lessonsError) {
          console.error('Error loading lessons:', lessonsError);
          return;
        }

        console.log('Loaded lessons:', lessons);

        // Load lesson sections for all lessons
        let lessonSections: any[] = [];
        if (lessons && lessons.length > 0) {
          const lessonIds = lessons.map(l => l.id);
          
          const { data: sections, error: sectionsError } = await supabase
            .from('lesson_sections')
            .select('*')
            .in('lesson_id', lessonIds)
            .order('order_index');

          if (sectionsError) {
            console.error('Error loading lesson sections:', sectionsError);
            return;
          }

          console.log('Loaded lesson sections:', sections);
          lessonSections = sections || [];
        }

        // Process paths and build content items
        paths.forEach((path: any) => {
          contentItems.push({
            id: `path-${path.id}`,
            title: path.title,
            type: 'lesson' as const,
            description: path.description || 'Learning path',
            course_id: baseClassId,
            base_class_id: baseClassId,
            order_index: path.order_index,
            tags: ['path']
          });

          // Add lessons for this path
          const pathLessons = lessons?.filter(lesson => lesson.path_id === path.id) || [];
          pathLessons.forEach((lesson: any) => {
            contentItems.push({
              id: `lesson-${lesson.id}`,
              title: lesson.title,
              type: 'lesson' as const,
              description: lesson.description || 'Lesson content',
              course_id: baseClassId,
              base_class_id: baseClassId,
              lesson_id: lesson.id,
              path_id: path.id,
              order_index: lesson.order_index,
              tags: ['lesson']
            });

            // Add lesson sections for this lesson
            const sectionsByLesson = lessonSections.filter(section => section.lesson_id === lesson.id);
            sectionsByLesson.forEach((section: any) => {
              contentItems.push({
                id: `section-${section.id}`,
                title: section.title,
                type: 'section' as const,
                description: `${section.section_type} content`,
                content: section.content,
                course_id: baseClassId,
                base_class_id: baseClassId,
                lesson_id: lesson.id,
                path_id: path.id,
                order_index: section.order_index,
                section_type: section.section_type as ContentItem['section_type'],
                video_url: section.video_url,
                audio_url: section.audio_url,
                image_url: section.image_url,
                tags: ['section', section.section_type]
              });
            });
          });
        });

        console.log('Processed content items:', contentItems);
        setContentItems(contentItems);
      } else {
        console.log('No paths found for base class:', baseClassId);
        setContentItems([]);
      }
    } catch (error) {
      console.error('Error loading course content:', error);
    } finally {
      setIsLoadingContent(false);
    }
  };

  const loadCustomContent = async (spaceId: string) => {
    try {
      setIsLoadingContent(true);
      
      // Load bookmarks and other custom content from the study space
      const { data: bookmarks, error } = await supabase
        .from('bookmarks')
        .select('*')
        .eq('study_space_id', spaceId);

      if (error) {
        console.error('Error loading custom content:', error);
        return;
      }

      if (bookmarks) {
        const contentItems: ContentItem[] = bookmarks.map(bookmark => ({
          id: bookmark.id,
          title: bookmark.title,
          type: 'resource' as const,
          description: bookmark.description,
          url: bookmark.url,
          tags: bookmark.tags || []
        }));

        setContentItems(contentItems);
      }
    } catch (error) {
      console.error('Error loading custom content:', error);
    } finally {
      setIsLoadingContent(false);
    }
  };

  // Utility function to get random colors for courses
  const getRandomColor = () => {
    const colors = [
      'bg-blue-500',
      'bg-emerald-500',
      'bg-purple-500',
      'bg-orange-500',
      'bg-pink-500',
      'bg-indigo-500',
      'bg-teal-500'
    ];
    return colors[Math.floor(Math.random() * colors.length)];
  };

  // Handle text selection in source content
  useEffect(() => {
    const handleMouseUp = () => {
      const selection = window.getSelection();
      if (selection && selection.toString().trim()) {
        // Check if selection is within the main content area (this should cover all source content)
        const isInContentArea = contentRef.current?.contains(selection.anchorNode);
        
        // Also check if selection is within any source content containers
        const isInSourceContent = selection.anchorNode && 
          (selection.anchorNode.nodeType === Node.TEXT_NODE ? 
            selection.anchorNode.parentElement : 
            selection.anchorNode as Element)?.closest('[data-source-content]');
        
        // Check if selection is within any article or content container (broader check)
        const isInArticleContent = selection.anchorNode &&
          (selection.anchorNode.nodeType === Node.TEXT_NODE ? 
            selection.anchorNode.parentElement : 
            selection.anchorNode as Element)?.closest('article, .prose, [class*="prose"]');
        
        if (isInContentArea || isInSourceContent || isInArticleContent) {
          const range = selection.getRangeAt(0);
          const rect = range.getBoundingClientRect();
          
          // Store the range for later restoration
          setPersistedSelection(range.cloneRange());
          
          // Add visual highlight to show the full selection
          addCustomHighlight(range);
          
          // Get selected text with debugging
          const selectedText = selection.toString();
          
          // Alternative method: get text from range without modifying DOM
          let rangeText = '';
          try {
            const clonedRange = range.cloneRange();
            const contents = clonedRange.cloneContents();
            rangeText = contents.textContent || '';
          } catch (e) {
            console.log('Range cloning failed, using selection.toString()');
          }
          
          const finalText = rangeText && rangeText.length > selectedText.length ? rangeText : selectedText;
          
          console.log('Selection method - length:', selectedText.length);
          console.log('Range method - length:', rangeText.length);
          console.log('Final text - length:', finalText.length);
          console.log('Preview:', finalText.substring(0, 200) + (finalText.length > 200 ? '...' : ''));
          
          setTextSelection({
            text: finalText,
            startOffset: range.startOffset,
            endOffset: range.endOffset,
            x: rect.left + rect.width / 2,
            y: rect.bottom + 5 // Position below the selected text
          });
          setShowSelectionPopover(true);
        }
      }
    };

    const handleMouseDown = (e: MouseEvent) => {
      // Don't clear selection if clicking on the popover
      const target = e.target as Element;
      const isPopoverClick = target.closest('[data-selection-popover]');
      
      if (!isPopoverClick) {
        setShowSelectionPopover(false);
        setTextSelection(null);
        setPersistedSelection(null);
        removeCustomHighlight();
      }
    };

    document.addEventListener('mouseup', handleMouseUp);
    document.addEventListener('mousedown', handleMouseDown);

    return () => {
      document.removeEventListener('mouseup', handleMouseUp);
      document.removeEventListener('mousedown', handleMouseDown);
    };
  }, []);

  // Function to restore text selection
  const restoreSelection = () => {
    if (persistedSelection) {
      const selection = window.getSelection();
      if (selection) {
        selection.removeAllRanges();
        selection.addRange(persistedSelection);
      }
    }
  };

  // Function to add custom visual highlight
  const addCustomHighlight = (range: Range) => {
    // Remove any existing custom highlights
    removeCustomHighlight();
    
    try {
      // Create a highlight using CSS
      const rects = range.getClientRects();
      const container = contentRef.current;
      if (!container) return;
      
      // Create highlight elements for each rect
      Array.from(rects).forEach((rect, index) => {
        const highlight = document.createElement('div');
        highlight.className = 'custom-text-highlight';
        highlight.style.cssText = `
          position: absolute;
          left: ${rect.left + window.scrollX - container.getBoundingClientRect().left}px;
          top: ${rect.top + window.scrollY - container.getBoundingClientRect().top}px;
          width: ${rect.width}px;
          height: ${rect.height}px;
          background-color: rgba(147, 51, 234, 0.3);
          pointer-events: none;
          z-index: 1;
          border-radius: 2px;
        `;
        highlight.setAttribute('data-highlight-id', 'custom-selection');
        container.appendChild(highlight);
      });
    } catch (error) {
      console.log('Custom highlight failed:', error);
    }
  };

  // Function to remove custom highlight
  const removeCustomHighlight = () => {
    const highlights = document.querySelectorAll('[data-highlight-id="custom-selection"]');
    highlights.forEach(highlight => highlight.remove());
  };

  // Handle text selection in note editor
  useEffect(() => {
    const handleNoteSelection = () => {
      const selection = window.getSelection();
      if (selection && selection.toString().trim() && noteEditorRef.current?.view?.dom?.contains(selection.anchorNode)) {
        const range = selection.getRangeAt(0);
        const rect = range.getBoundingClientRect();
        
        // Get the position relative to the note editor container
        const editorRect = noteEditorRef.current?.view?.dom?.getBoundingClientRect();
        
        if (!editorRect) return;
        
        // Calculate position relative to the editor container, not the viewport
        const relativeX = rect.left + rect.width / 2;
        const relativeY = rect.bottom + 5;
        
        setNoteSelection({
          text: selection.toString(),
          startOffset: range.startOffset,
          endOffset: range.endOffset,
          x: relativeX,
          y: relativeY
        });
        setShowNoteActions(true);
      } else {
        setShowNoteActions(false);
        setNoteSelection(null);
      }
    };

    const handleNoteMouseDown = () => {
      setShowNoteActions(false);
      setNoteSelection(null);
    };

    if (noteView === 'editor') {
      document.addEventListener('mouseup', handleNoteSelection);
      document.addEventListener('mousedown', handleNoteMouseDown);
    }

    return () => {
      document.removeEventListener('mouseup', handleNoteSelection);
      document.removeEventListener('mousedown', handleNoteMouseDown);
    };
  }, [noteView]);

  useEffect(() => {
    if (noteView === 'editor' && noteEditorRef.current && currentNote) {
      const editor = noteEditorRef.current;
      const handleUpdate = () => {
        if (editor.isFocused) {
          setNoteContent(editor.getHTML());
        }
      };

      if (editor.isDestroyed) return;

      editor.commands.setContent(currentNote.content, false);
      
      editor.on('transaction', handleUpdate);

      return () => {
        editor.off('transaction', handleUpdate);
      };
    }
  }, [noteView, currentNote, noteEditorRef.current]);

  // Helper function to extract text from Tiptap JSON content
  const extractTextFromTiptapJSON = (content: any): string => {
    if (!content || typeof content !== 'object') return '';
    
    if (typeof content === 'string') return content;
    
    if (content.type === 'text') {
      return content.text || '';
    }
    
    if (content.content && Array.isArray(content.content)) {
      return content.content.map(extractTextFromTiptapJSON).join(' ');
    }
    
    return '';
  };

  const getSelectedContent = () => {
    return Array.from(selectedSources)
      .map(id => contentItems.find(item => item.id === id))
      .filter(Boolean);
  };

  // Helper functions for hierarchical selection
  const handlePathSelection = (pathId: string, checked: boolean) => {
    const newSelectedPaths = new Set(selectedPaths);
    const newSelectedLessons = new Set(selectedLessons);
    const newSelectedSections = new Set(selectedSections);
    const newSelectedSources = new Set(selectedSources);

    if (checked) {
      newSelectedPaths.add(pathId);
      // Auto-select all lessons and sections in this path
      const pathLessons = contentItems.filter(item => item.id.startsWith(`lesson-`) && item.path_id === pathId);
      pathLessons.forEach(lesson => {
        newSelectedLessons.add(lesson.id);
        newSelectedSources.add(lesson.id);
        // Auto-select all sections in this lesson
        const lessonSections = contentItems.filter(item => 
          item.id.startsWith(`section-`) && item.lesson_id === lesson.id.replace('lesson-', '')
        );
        lessonSections.forEach(section => {
          newSelectedSections.add(section.id);
          newSelectedSources.add(section.id);
        });
      });
      // Add path itself to selected sources
      newSelectedSources.add(`path-${pathId}`);
    } else {
      newSelectedPaths.delete(pathId);
      // Auto-deselect all lessons and sections in this path
      const pathLessons = contentItems.filter(item => item.id.startsWith(`lesson-`) && item.path_id === pathId);
      pathLessons.forEach(lesson => {
        newSelectedLessons.delete(lesson.id);
        newSelectedSources.delete(lesson.id);
        // Auto-deselect all sections in this lesson
        const lessonSections = contentItems.filter(item => 
          item.id.startsWith(`section-`) && item.lesson_id === lesson.id.replace('lesson-', '')
        );
        lessonSections.forEach(section => {
          newSelectedSections.delete(section.id);
          newSelectedSources.delete(section.id);
        });
      });
      // Remove path itself from selected sources
      newSelectedSources.delete(`path-${pathId}`);
    }

    setSelectedPaths(newSelectedPaths);
    setSelectedLessons(newSelectedLessons);
    setSelectedSections(newSelectedSections);
    setSelectedSources(newSelectedSources);
  };

  const handleLessonSelection = (lessonId: string, pathId: string, checked: boolean) => {
    const newSelectedLessons = new Set(selectedLessons);
    const newSelectedSections = new Set(selectedSections);
    const newSelectedSources = new Set(selectedSources);

    if (checked) {
      newSelectedLessons.add(lessonId);
      newSelectedSources.add(lessonId);
      // Auto-select all sections in this lesson
      const lessonSections = contentItems.filter(item => 
        item.id.startsWith(`section-`) && item.lesson_id === lessonId.replace('lesson-', '')
      );
      lessonSections.forEach(section => {
        newSelectedSections.add(section.id);
        newSelectedSources.add(section.id);
      });
    } else {
      newSelectedLessons.delete(lessonId);
      newSelectedSources.delete(lessonId);
      // Auto-deselect all sections in this lesson
      const lessonSections = contentItems.filter(item => 
        item.id.startsWith(`section-`) && item.lesson_id === lessonId.replace('lesson-', '')
      );
      lessonSections.forEach(section => {
        newSelectedSections.delete(section.id);
        newSelectedSources.delete(section.id);
      });
      // If no lessons in path are selected, deselect path
      const pathLessons = contentItems.filter(item => item.id.startsWith(`lesson-`) && item.path_id === pathId);
      const anyPathLessonsSelected = pathLessons.some(lesson => newSelectedLessons.has(lesson.id));
      if (!anyPathLessonsSelected) {
        setSelectedPaths(prev => {
          const newPaths = new Set(prev);
          newPaths.delete(pathId);
          newSelectedSources.delete(`path-${pathId}`);
          return newPaths;
        });
      }
    }

    setSelectedLessons(newSelectedLessons);
    setSelectedSections(newSelectedSections);
    setSelectedSources(newSelectedSources);
  };

  const handleSectionSelection = (sectionId: string, lessonId: string, pathId: string, checked: boolean) => {
    const newSelectedSections = new Set(selectedSections);
    const newSelectedSources = new Set(selectedSources);

    if (checked) {
      newSelectedSections.add(sectionId);
      newSelectedSources.add(sectionId);
    } else {
      newSelectedSections.delete(sectionId);
      newSelectedSources.delete(sectionId);
      
      // If no sections in lesson are selected, deselect lesson
      const lessonSections = contentItems.filter(item => 
        item.id.startsWith(`section-`) && item.lesson_id === lessonId.replace('lesson-', '')
      );
      const anyLessonSectionsSelected = lessonSections.some(section => newSelectedSections.has(section.id));
      if (!anyLessonSectionsSelected) {
        setSelectedLessons(prev => {
          const newLessons = new Set(prev);
          newLessons.delete(lessonId);
          newSelectedSources.delete(lessonId);
          return newLessons;
        });
        
        // If no lessons in path are selected, deselect path
        const pathLessons = contentItems.filter(item => item.id.startsWith(`lesson-`) && item.path_id === pathId);
        const anyPathLessonsSelected = pathLessons.some(lesson => 
          lesson.id !== lessonId && selectedLessons.has(lesson.id)
        );
        if (!anyPathLessonsSelected) {
          setSelectedPaths(prev => {
            const newPaths = new Set(prev);
            newPaths.delete(pathId);
            newSelectedSources.delete(`path-${pathId}`);
            return newPaths;
          });
        }
      }
    }

    setSelectedSections(newSelectedSections);
    setSelectedSources(newSelectedSources);
  };

  const handleSendMessage = async () => {
    if (!chatMessage.trim() || !lunaChatRef.current) return;
    
    setIsGenerating(true);
    
    try {
      // Switch to chat tab to show the conversation
      setActiveToolTab('chat');
      
      // Mark that the chat interface is open
      setIsChatInterfaceOpen(true);
      
      // Use the Luna chat's internal sendMessage function
      await lunaChatRef.current.sendMessage(chatMessage);
      
      // Clear the input
      setChatMessage('');
      
      // Clear highlighted text after using it
      if (highlightedTextForLuna) {
        setHighlightedTextForLuna(null);
      }

    } catch (error) {
      console.error('Error sending message to Luna:', error);
    } finally {
      setIsGenerating(false);
    }
  };

  const createCustomSpace = async () => {
    if (!newSpaceName.trim() || !currentUser) return;
    
    try {
      const { data: newSpace, error } = await supabase
        .from('study_spaces')
        .insert({
          name: newSpaceName,
          user_id: currentUser.id,
          organisation_id: null, // Personal space
          description: 'Personal study space',
          color: getRandomColor(),
          is_default: false
        })
        .select()
        .single();

      if (error) {
        console.error('Error creating study space:', error);
        return;
      }

      if (newSpace) {
        const studySpaceData: StudySpace = {
          id: newSpace.id,
          name: newSpace.name,
          type: 'custom',
          description: newSpace.description,
          color: newSpace.color,
          created_at: newSpace.created_at
        };

        setStudySpaces(prev => [studySpaceData, ...prev]);
      }
    } catch (error) {
      console.error('Error creating study space:', error);
    }
    
    setShowCreateSpace(false);
    setNewSpaceName('');
  };

  const openNewNoteWithText = async (text: string, title?: string) => {
    if (!selectedSpace) {
      toast({
        title: "Error",
        description: "Please select a study space first.",
        variant: "destructive"
      });
      return;
    }

    if (!currentUser) {
      toast({
        title: "Error",
        description: "User not ready. Please try again in a moment.",
        variant: "destructive"
      });
      return;
    }

    // Get organisation_id, fetch from profile if needed
    let organisationId = currentUser.organisation_id;
    if (!organisationId) {
      const { data: profile } = await supabase
        .from('profiles')
        .select('organisation_id')
        .eq('user_id', currentUser.id)
        .single();
      organisationId = profile?.organisation_id;
    }

    const newNoteId = uuidv4();
    const newTitle = title || 'New Note from Luna';

    const tiptapJSON = {
      type: 'doc',
      content: text.split('\n').filter(line => line.trim() !== '').map(line => ({
        type: 'paragraph',
        content: [{ type: 'text', text: line }],
      })),
    };

    if (tiptapJSON.content.length === 0) {
      tiptapJSON.content.push({ type: 'paragraph', content: [] });
    }

    const newNote = {
      id: newNoteId,
      title: newTitle,
      content: tiptapJSON,
      isNew: true, // This is a new, unsaved note
      study_space_id: selectedSpace.id,
      // Temporary values for local state
      user_id: currentUser?.id,
      organisation_id: organisationId,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };

    setNotes(prev => [newNote as any, ...prev]);
    setActiveNote(newNote as any);
    setActiveToolTab('notes');
  };

  const openNote = (note: Note) => {
    setCurrentNote(note);
    setNoteTitle(note.title);
    setNoteContent(note.content);
    setNoteView('editor');
    setIsEditingNote(true); // Enable editing when opening a note
    
    // Set editor content after a brief delay to ensure editor is ready
    setTimeout(() => {
      if (noteEditorRef.current) {
        noteEditorRef.current.commands.setContent(note.content);
      }
    }, 100);
  };

  const createNewNote = async () => {
    if (!selectedSpace) {
      toast({
        title: "Error",
        description: "Please select a study space to create a new note.",
        variant: "destructive"
      });
      return;
    }

    if (!currentUser) {
      toast({
        title: "Error",
        description: "User not ready. Please try again in a moment.",
        variant: "destructive"
      });
      return;
    }

    // Get organisation_id, fetch from profile if needed
    let organisationId = currentUser.organisation_id;
    if (!organisationId) {
      const { data: profile } = await supabase
        .from('profiles')
        .select('organisation_id')
        .eq('user_id', currentUser.id)
        .single();
      organisationId = profile?.organisation_id;
    }
    
    const newNoteId = uuidv4();
    
    const newNote = {
      id: newNoteId,
      title: 'Untitled Note',
      content: { type: 'doc', content: [{ type: 'paragraph', content: [] }] },
      isNew: true, // Flag to indicate it's a new, unsaved note
      study_space_id: selectedSpace.id,
      // Temporary values for local state
      user_id: currentUser?.id,
      organisation_id: organisationId,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };
    
    // Add to notes list and set as current
    setNotes(prev => [newNote as any, ...prev]);
    setActiveNote(newNote as any);
    setCurrentNote(newNote as any);
    setNoteTitle(newNote.title);
    setNoteContent(newNote.content as any);
    setNoteView('editor');
    setIsEditingNote(true); // Enable editing for new notes
    
    // Set editor content after a brief delay to ensure editor is ready
    setTimeout(() => {
    if (noteEditorRef.current) {
        noteEditorRef.current.commands.setContent(newNote.content);
        noteEditorRef.current.commands.focus();
      }
    }, 100);
  };

  const saveNote = async (noteId: string, title: string, content: any) => {
    if (!noteId) {
      console.error('No note selected to save');
      return;
    }

    if (!title || title.trim() === '') {
      toast({
        title: "Error",
        description: "Note title cannot be empty",
        variant: "destructive"
      });
      return;
    }

    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      console.error('User not authenticated');
      return;
    }

    if (!currentUser) {
      toast({
        title: "Error",
        description: "User not ready. Please try again in a moment.",
        variant: "destructive"
      });
      console.error('Save attempt failed: User not loaded yet.');
      return;
    }

    // If organisation_id is missing, try to fetch it from the profile
    let organisationId = currentUser.organisation_id;
    if (!organisationId) {
      const { data: profile } = await supabase
        .from('profiles')
        .select('organisation_id')
        .eq('user_id', currentUser.id)
        .single();
      
      organisationId = profile?.organisation_id;
    }

    if (!organisationId) {
      toast({
        title: "Error",
        description: "Unable to determine organization. Please try refreshing the page.",
        variant: "destructive"
      });
      return;
    }

    // Ensure we have a selected space
    if (!selectedSpace) {
      toast({
        title: "Error",
        description: "No study space selected",
        variant: "destructive"
      });
      return;
    }
    
    // Find the note in the local state
    const noteToSave = notes.find(n => n.id === noteId);
    
    // Determine if it's an existing note or a new one. A note is new if it has the `isNew` flag.
    const isExistingNote = noteToSave && !noteToSave.isNew;

    if (isExistingNote) {
        // Update existing note
      const { error } = await supabase
          .from('study_notes')
          .update({
          title,
          content,
          updated_at: new Date().toISOString(),
        })
        .eq('id', noteId);

        if (error) {
        console.error('Error updating note:', JSON.stringify(error, null, 2));
        toast({
          title: "Error",
          description: `Failed to update note: ${error.message}`,
          variant: "destructive"
        });
          return;
        }
      } else {
        // Create new note
      const newNoteData = {
        id: noteId,
        study_space_id: selectedSpace.id,
        user_id: currentUser.id,
        organisation_id: organisationId,
        title,
        content,
      };

        const { data: newNote, error } = await supabase
          .from('study_notes')
        .insert(newNoteData)
          .select()
          .single();

        if (error) {
        console.error('Error creating note:', JSON.stringify(error, null, 2));
        toast({
          title: "Error",
          description: `Failed to create note: ${error.message}`,
          variant: "destructive"
        });
          return;
      }
    }

    // After saving, refresh the notes list to get the latest state from DB
    const { data: updatedNotes } = await supabase
      .from('study_notes')
      .select('*')
      .eq('study_space_id', selectedSpace.id)
      .order('updated_at', { ascending: false });
    
    if (updatedNotes) {
      setNotes(updatedNotes);
      // Make sure the just-saved note is active and current
      const savedNote = updatedNotes.find(n => n.id === noteId) || null;
      setActiveNote(savedNote);
      setCurrentNote(savedNote);
      
      // Remove the isNew flag since it's now saved
      if (savedNote) {
        delete (savedNote as any).isNew;
      }
    }
          toast({
        title: "Success",
        description: `Note '${title}' saved successfully!`,
      });
  };

  const deleteNote = async (noteId: string) => {
    if (!noteId) return;

    // Optimistically remove from UI
    const originalNotes = [...notes];
    const notesAfterDelete = notes.filter(n => n.id !== noteId);
    setNotes(notesAfterDelete);
    
    if (activeNote?.id === noteId) {
      setActiveNote(notesAfterDelete.length > 0 ? notesAfterDelete[0] : null);
    }

      const { error } = await supabase
        .from('study_notes')
        .delete()
        .eq('id', noteId);

      if (error) {
        console.error('Error deleting note:', error);
      toast({
        title: "Error",
        description: "Failed to delete note.",
        variant: "destructive"
      });
      // Revert UI change on error
      setNotes(originalNotes);
    } else {
      toast({
        title: "Success",
        description: "Note deleted.",
      });
    }
  };

  const debouncedSaveNote = useDebounce(saveNote, 2000);
  
  useEffect(() => {
    if (activeNote && noteEditorRef.current) {
      // Check if content is different before setting it to avoid loops
      if (JSON.stringify(noteEditorRef.current.getJSON()) !== JSON.stringify(activeNote.content)) {
        noteEditorRef.current.commands.setContent(activeNote.content, false);
      }
      setNoteTitle(activeNote.title);
      setNoteContent(activeNote.content);
    } else if (!activeNote && noteEditorRef.current) {
      noteEditorRef.current.commands.clearContent();
      setNoteTitle('');
      setNoteContent('');
    }
  }, [activeNote]);

  const handleNoteContentChange = (newContent: any) => {
    setNoteContent(newContent);
    
    // Update the note in the notes list immediately
    if (currentNote) {
      setNotes(prev => prev.map(note => 
        note.id === currentNote.id 
          ? { ...note, content: newContent, updated_at: new Date().toISOString() }
          : note
      ));
      
      // Trigger debounced save
      debouncedSaveNote(currentNote.id, noteTitle, newContent);
    }
  };

  const handleNoteTitleChange = (newTitle: string) => {
    setNoteTitle(newTitle);
    
    // Update the note in the notes list immediately
    if (currentNote) {
      setNotes(prev => prev.map(note => 
        note.id === currentNote.id 
          ? { ...note, title: newTitle, updated_at: new Date().toISOString() }
          : note
      ));
      
      // Trigger debounced save
      debouncedSaveNote(currentNote.id, newTitle, noteContent);
    }
  };

  const handleAddToNotes = async (content: string, title?: string) => {
    if (!selectedSpace) {
      toast({
        title: "Error",
        description: "Please select a study space first.",
        variant: "destructive"
      });
      return;
    }

    const newNoteId = uuidv4();
    const noteTitle = title || 'Luna Response';

    // Convert markdown content to Tiptap JSON format with proper formatting
    const { markdownToTiptap } = await import('@/lib/utils/markdownToTiptap');
    const tiptapJSON = markdownToTiptap(content);

    // Create and save the note immediately
    await saveNote(newNoteId, noteTitle, tiptapJSON);
    
    // Switch to notes tab to show the new note
    setActiveToolTab('notes');
  };



  const createMindMap = async (content: string) => {
    if (!currentUser) return;

    // Switch to mind map tab and trigger mind map generation
    setActiveToolTab('mindmaps');
    
    // The StudyMindMapViewer component will handle the actual mind map generation
    // using the selected content, text, and notes
    console.log('Switching to mind map tab with content:', content);
  };

  // Create or get study session
  const createStudySession = async (userId: string, baseClassId?: string) => {
    try {
      console.log('🔄 createStudySession called with:', { userId, baseClassId });
      
      const { data: profile, error: profileError } = await supabase
        .from('profiles')
        .select('organisation_id')
        .eq('user_id', userId)
        .single();

      if (!profile?.organisation_id) {
        console.error('No organisation found for user');
        return null;
      }

      // Get or create a persistent study space for the user-course combination
      let studySpaceId = selectedSpace?.id;
      
      console.log('📍 Current state:', { 
        currentSelectedSpace: selectedSpace?.name,
        currentSelectedCourse: selectedCourse?.name,
        baseClassIdProvided: baseClassId
      });
      
      // If we already have a selected space, use it and don't create a new one
      if (studySpaceId && selectedSpace) {
        console.log('✅ Using already selected study space:', selectedSpace.name);
      } else if (baseClassId) {
        // FIXED: Always check for existing study space for this user-course combination
        const { data: existingSpace, error: existingSpaceError } = await supabase
          .from('study_spaces')
          .select('*')
          .eq('user_id', userId)
          .eq('course_id', baseClassId)
          .single();

        if (existingSpaceError && existingSpaceError.code !== 'PGRST116') {
          console.error('Error checking for existing study space:', existingSpaceError);
          return null;
        }

        if (existingSpace) {
          // Use the existing study space
          studySpaceId = existingSpace.id;
          console.log('✅ Found and using existing study space:', existingSpace.name);
          
          // Update the selected space in the UI
          const studySpaceData: StudySpace = {
            id: existingSpace.id,
            name: existingSpace.name,
            type: 'course',
            course_id: existingSpace.course_id,
            description: existingSpace.description,
            color: existingSpace.color || 'bg-blue-500',
            created_at: existingSpace.created_at
          };
          setSelectedSpace(studySpaceData);
          
          // FIXED: Add to study spaces list if not already there
          setStudySpaces(prev => {
            const exists = prev.find(s => s.id === studySpaceData.id);
            if (!exists) {
              return [studySpaceData, ...prev];
            }
            return prev;
          });
        } else {
          // Get the course name for a meaningful study space name
          const { data: baseClass, error: baseClassError } = await supabase
            .from('base_classes')
            .select('name')
            .eq('id', baseClassId)
            .single();

          const courseName = baseClass?.name || 'Course';

          // Create a new study space linked to the course
          const insertData = {
            user_id: userId,
            organisation_id: profile.organisation_id,
            course_id: baseClassId,
            name: `${courseName} Study Space`,
            description: `Study space for ${courseName}`,
            color: selectedCourse?.color || 'bg-blue-500',
            is_default: false
          };
          
          console.log('🆕 Creating new study space with data:', insertData);
          
          const { data: studySpace, error: spaceError } = await supabase
            .from('study_spaces')
            .insert(insertData)
            .select()
            .single();

          if (spaceError) {
            console.error('❌ Error creating study space:', spaceError);
            return null;
          }
          
          studySpaceId = studySpace.id;
          console.log('✅ Created new course-linked study space:', studySpace.name, 'with course_id:', studySpace.course_id);
          
          // Update the selected space in the UI and add to study spaces list
          const studySpaceData: StudySpace = {
            id: studySpace.id,
            name: studySpace.name,
            type: 'course',
            course_id: studySpace.course_id,
            description: studySpace.description,
            color: studySpace.color,
            created_at: studySpace.created_at
          };
          setSelectedSpace(studySpaceData);
          setStudySpaces(prev => [studySpaceData, ...prev]);
        }
      } else if (!studySpaceId) {
        // Fallback: create a generic study space if no course is specified
        console.log('⚠️ FALLBACK: Creating generic study space (no baseClassId provided)');
        
        const { data: studySpace, error: spaceError } = await supabase
          .from('study_spaces')
          .insert({
            user_id: userId,
            organisation_id: profile.organisation_id,
            name: 'Study Session',
            description: 'Auto-created for study session',
            is_default: false
            // NOTE: No course_id set here - this creates an unlinked study space
          })
          .select()
          .single();

        if (spaceError) {
          console.error('❌ Error creating generic study space:', spaceError);
          return null;
        }
        studySpaceId = studySpace.id;
        console.log('⚠️ Created generic study space (not linked to course):', studySpace.name);
      }

      const { data, error } = await supabase
        .from('study_sessions')
        .insert({
          user_id: userId,
          organisation_id: profile.organisation_id,
          study_space_id: studySpaceId,
          session_type: 'focus'
          // Note: linked_path_id should only be set when we have an actual path ID, not base_class_id
        })
        .select()
        .single();

      if (error) {
        console.error('Error creating study session:', error);
        console.error('Error details:', JSON.stringify(error, null, 2));
        return null;
      }

      console.log('Study session created:', data);
      return data;
    } catch (error) {
      console.error('Error creating study session:', error);
      return null;
    }
  };

  const toggleStarNote = async (noteId: string) => {
    try {
      const note = notes.find(n => n.id === noteId);
      if (!note) return;

      const { error } = await supabase
        .from('study_notes')
        .update({ is_favorite: !note.isStarred })
        .eq('id', noteId);

      if (error) {
        console.error('Error toggling note star:', error);
        return;
      }

      setNotes(notes.map(note => 
        note.id === noteId 
          ? { ...note, isStarred: !note.isStarred }
          : note
      ));
    } catch (error) {
      console.error('Error toggling note star:', error);
    }
  };

  const togglePanelExpansion = (panel: PanelExpansion) => {
    setExpandedPanel(expandedPanel === panel ? 'none' : panel);
  };

  const renderExpandButton = (panel: PanelExpansion, position: 'left' | 'right' = 'right') => (
    <Button
      variant="ghost"
      size="sm"
      onClick={() => togglePanelExpansion(panel)}
      className={cn(
        "h-8 w-8 p-0 text-muted-foreground hover:text-foreground transition-all duration-200",
        "hover:bg-muted rounded-lg",
        position === 'left' ? 'order-first' : 'order-last'
      )}
    >
      {expandedPanel === panel ? <Minimize2 className="h-4 w-4" /> : <Maximize2 className="h-4 w-4" />}
    </Button>
  );

  const handleSelectionAction = (action: 'note' | 'mindmap' | 'explain' | 'audio') => {
    if (!textSelection) return;
    
    const selectedText = textSelection.text;
    
    switch (action) {
      case 'note':
        // Add to notes
        openNewNoteWithText(selectedText);
        // Keep selection for potential further actions
        restoreSelection();
        break;
      case 'mindmap':
        // Switch to mind map tab and trigger auto-generation
        setActiveToolTab('mindmaps');
        setShouldAutoGenerateMindMap(true);
        // Keep the text selection available for the mind map viewer
        // Don't clear the selection immediately, let the mind map viewer handle it
        break;
      case 'explain':
        // Ask Luna to explain - set the highlighted text for Luna
        setHighlightedTextForLuna(selectedText);
        setActiveToolTab('chat'); // Switch to chat tab
        // Keep selection for potential further actions
        restoreSelection();
        break;
      case 'audio':
        // Switch to audio tab and trigger auto-generation
        setActiveToolTab('audio');
        setShouldAutoGenerateAudio(true);
        // Keep the text selection available for the audio generator
        // Don't clear the selection immediately, let the audio generator handle it
        break;
    }
    
    // Only hide popover, don't clear selection for mind map or audio actions
    setShowSelectionPopover(false);
    
    // For non-mindmap and non-audio actions, clear the selection after a brief delay
    if (action !== 'mindmap' && action !== 'audio') {
      setTimeout(() => {
        setTextSelection(null);
        setPersistedSelection(null);
        setShouldAutoGenerateMindMap(false); // Reset auto-generate flag
        setShouldAutoGenerateAudio(false); // Reset audio auto-generate flag
        removeCustomHighlight();
      }, 100);
    } else {
      // For mindmap action, clear the selection after a longer delay to allow the mind map viewer to process it
      setTimeout(() => {
        setTextSelection(null);
        setPersistedSelection(null);
        removeCustomHighlight();
        // Don't reset shouldAutoGenerateMindMap here - let the mind map viewer handle it
      }, 1000);
    }
  };

  // Old functions removed - using the new Supabase-connected versions above

  const handleNoteAction = (action: 'enhance' | 'summarize' | 'expand' | 'format') => {
    if (!noteSelection) return;
    
    const selectedText = noteSelection.text;
    
    switch (action) {
      case 'enhance':
        setChatMessage(`Please enhance this note text: "${selectedText}"`);
        break;
      case 'summarize':
        setChatMessage(`Please summarize this: "${selectedText}"`);
        break;
      case 'expand':
        setChatMessage(`Please expand on this topic: "${selectedText}"`);
        break;
      case 'format':
        setChatMessage(`Please help me format and improve this text: "${selectedText}"`);
        break;
    }
    
    setShowNoteActions(false);
    setNoteSelection(null);
  };

  const formatText = (format: 'bold' | 'italic' | 'underline' | 'highlight') => {
    // Simple text formatting - in a real app, you'd use a rich text editor library
    const textarea = document.querySelector('textarea[data-note-editor]') as HTMLTextAreaElement;
    if (!textarea) return;

    const start = textarea.selectionStart;
    const end = textarea.selectionEnd;
    const selectedText = textarea.value.substring(start, end);
    
    if (!selectedText) return;

    let formattedText = '';
    switch (format) {
      case 'bold':
        formattedText = `**${selectedText}**`;
        break;
      case 'italic':
        formattedText = `*${selectedText}*`;
        break;
      case 'underline':
        formattedText = `<u>${selectedText}</u>`;
        break;
      case 'highlight':
        formattedText = `==${selectedText}==`;
        break;
    }

    const newContent = textarea.value.substring(0, start) + formattedText + textarea.value.substring(end);
    setNoteContent(newContent);
  };

  const renderSourceContent = () => {
    const contentToShow = getSelectedContent();

          if (contentToShow.length === 0) {
      return (
        <div className="flex flex-col items-center justify-center h-full text-center py-16">
          <div className="p-6 rounded-2xl bg-muted mb-6">
            <BookOpen className="h-12 w-12 text-muted-foreground mx-auto" />
          </div>
          <h3 className="text-xl font-semibold mb-4 text-foreground">
            Select Sources to Study
          </h3>
          <p className="text-muted-foreground mb-6 max-w-md leading-relaxed">
            Choose from your course materials or custom sources using the dropdown above. You can select multiple sources to study together.
          </p>
          <Button variant="outline" size="sm">
            <ArrowRight className="h-4 w-4 mr-2" />
            Get Started
          </Button>
        </div>
      );
    }

    if (isLoadingContent) {
      return (
        <div className="flex items-center justify-center h-full">
          <div className="text-center">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto mb-4"></div>
            <p className="text-muted-foreground">Loading content...</p>
          </div>
        </div>
      );
    }

    return (
      <div className="space-y-8 relative" ref={contentRef} data-source-content style={{ position: 'relative' }}>
        {contentToShow.filter(content => content).map((content, index) => {
          if (!content) return null;
          
          switch (content.type) {
            case 'video':
              return (
                <div key={content.id} className="space-y-4">
                  <div className="flex items-center gap-3 mb-4">
                    <div className="p-2 rounded-lg bg-red-100 dark:bg-red-900/20">
                      <Video className="h-5 w-5 text-red-600 dark:text-red-400" />
                    </div>
                    <div data-source-content>
                      <h3 className="font-semibold text-lg text-slate-900 dark:text-slate-100 select-text">{content.title}</h3>
                      {content.description && (
                        <p className="text-sm text-slate-600 dark:text-slate-400 select-text">{content.description}</p>
                      )}
                    </div>
                  </div>
                  
                  <div className="relative bg-black rounded-xl overflow-hidden shadow-2xl">
                    <div className="aspect-video bg-gradient-to-br from-slate-900 to-slate-800 flex items-center justify-center">
                      {content.thumbnail ? (
                        <img 
                          src={content.thumbnail} 
                          alt={content.title}
                          className="w-full h-full object-cover"
                        />
                      ) : (
                        <div className="text-white/60">
                          <PlayCircle className="h-16 w-16 mb-4 mx-auto" />
                          <p className="text-sm">Video Preview</p>
                        </div>
                      )}
                      <div className="absolute inset-0 bg-black/20 flex items-center justify-center">
                        <Button
                          size="lg"
                          className="h-16 w-16 rounded-full bg-white/20 backdrop-blur-sm hover:bg-white/30 border-2 border-white/30"
                          onClick={() => setIsPlaying(!isPlaying)}
                        >
                          {isPlaying ? (
                            <PauseCircle className="h-8 w-8 text-white" />
                          ) : (
                            <PlayCircle className="h-8 w-8 text-white" />
                          )}
                        </Button>
                      </div>
                    </div>
                    
                    {/* Video Controls */}
                    <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/80 to-transparent p-4">
                      <div className="flex items-center gap-3 text-white">
                        <Button variant="ghost" size="sm" className="h-8 w-8 p-0 text-white hover:bg-white/20">
                          <SkipBack className="h-4 w-4" />
                        </Button>
                        <Button variant="ghost" size="sm" className="h-8 w-8 p-0 text-white hover:bg-white/20">
                          {isPlaying ? <PauseCircle className="h-4 w-4" /> : <PlayCircle className="h-4 w-4" />}
                        </Button>
                        <Button variant="ghost" size="sm" className="h-8 w-8 p-0 text-white hover:bg-white/20">
                          <SkipForward className="h-4 w-4" />
                        </Button>
                        
                        <div className="flex-1 mx-4">
                          <div className="h-1 bg-white/20 rounded-full">
                            <div className="h-1 bg-white rounded-full" style={{ width: '35%' }} />
                          </div>
                        </div>
                        
                        <span className="text-xs text-white/80">10:30 / 30:00</span>
                        
                        <Button variant="ghost" size="sm" className="h-8 w-8 p-0 text-white hover:bg-white/20">
                          {isMuted ? <VolumeX className="h-4 w-4" /> : <Volume2 className="h-4 w-4" />}
                        </Button>
                        
                        <Button variant="ghost" size="sm" className="h-8 w-8 p-0 text-white hover:bg-white/20">
                          <Maximize2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </div>
                  </div>
                </div>
              );

            case 'section':
              return (
                <article key={content.id} className="max-w-none">
                  <div className="bg-card rounded-2xl shadow-sm border border-border overflow-hidden">
                    {/* Content Header */}
                    <div className="px-8 py-6 border-b border-border">
                      <div className="flex items-start gap-4">
                        <div className={cn(
                          "p-3 rounded-xl shrink-0",
                          content.section_type === 'video' ? "bg-red-500/10" :
                          content.section_type === 'audio' ? "bg-purple-500/10" :
                          content.section_type === 'image' ? "bg-orange-500/10" :
                          "bg-muted"
                        )}>
                          {content.section_type === 'video' && <Video className="h-5 w-5 text-red-600" />}
                          {content.section_type === 'audio' && <Volume2 className="h-5 w-5 text-purple-600" />}
                          {content.section_type === 'image' && <Image className="h-5 w-5 text-orange-600" />}
                          {(!content.section_type || content.section_type === 'text') && <FileText className="h-5 w-5 text-muted-foreground" />}
                        </div>
                        <div className="flex-1 min-w-0" data-source-content>
                          <h2 className="text-xl font-semibold text-foreground mb-2 leading-tight select-text" data-source-content>
                            {content.title}
                          </h2>
                          {content.description && (
                            <p className="text-sm text-muted-foreground leading-relaxed select-text" data-source-content>
                              {content.description}
                            </p>
                          )}
                          <div className="flex items-center gap-2 mt-3">
                            {content.section_type && (
                              <Badge variant="secondary" className="text-xs px-2 py-1">
                                {content.section_type}
                              </Badge>
                            )}
                            <Badge variant="outline" className="text-xs px-2 py-1">
                              section
                            </Badge>
                          </div>
                        </div>
                      </div>
                    </div>

                    {/* Content Body */}
                    <div className="px-8 py-6">
                      <div className="space-y-6">
                        {/* Video Content */}
                        {content.section_type === 'video' && content.video_url && (
                          <div className="relative bg-slate-900 rounded-xl overflow-hidden shadow-lg">
                            <div className="aspect-video">
                              <iframe
                                src={content.video_url}
                                className="w-full h-full"
                                allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                                allowFullScreen
                                title={content.title}
                              />
                            </div>
                          </div>
                        )}
                        
                        {/* Audio Content */}
                        {content.section_type === 'audio' && content.audio_url && (
                          <div className="bg-slate-50 dark:bg-slate-800/50 rounded-xl p-6 border border-slate-200 dark:border-slate-700">
                            <div className="flex items-center gap-4 mb-4">
                              <div className="p-2 rounded-lg bg-purple-100 dark:bg-purple-900/20">
                                <Volume2 className="h-5 w-5 text-purple-600 dark:text-purple-400" />
                              </div>
                              <div>
                                <h3 className="font-medium text-slate-900 dark:text-slate-100">Audio Content</h3>
                                <p className="text-sm text-slate-600 dark:text-slate-400">Listen to the lesson audio</p>
                              </div>
                            </div>
                            <audio 
                              controls 
                              className="w-full h-12 bg-white dark:bg-slate-700 rounded-lg"
                              preload="metadata"
                            >
                              <source src={content.audio_url} type="audio/mpeg" />
                              <source src={content.audio_url} type="audio/wav" />
                              <source src={content.audio_url} type="audio/ogg" />
                              Your browser does not support the audio element.
                            </audio>
                          </div>
                        )}
                        
                        {/* Image Content */}
                        {content.section_type === 'image' && content.image_url && (
                          <div className="rounded-xl overflow-hidden shadow-sm border border-slate-200 dark:border-slate-700">
                            <img
                              src={content.image_url}
                              alt={content.title}
                              className="w-full h-auto object-cover"
                              loading="lazy"
                            />
                          </div>
                        )}
                        
                        {/* Text Content - Simple fallback for now */}
                        {content.content && typeof content.content === 'string' && (
                          <div className="prose prose-slate dark:prose-invert max-w-none select-text">
                            <ReactMarkdown className="text-base leading-relaxed select-text">
                              {content.content}
                            </ReactMarkdown>
                          </div>
                        )}
                        
                        {/* Structured Content - JSON object */}
                        {content.content && typeof content.content === 'object' && (
                          <div className="select-text">
                            <LessonContentRenderer content={content.content as LessonSectionContent} />
                          </div>
                        )}
                        
                        {/* Empty state for sections without content */}
                        {!content.content && !content.video_url && !content.audio_url && !content.image_url && (
                          <div className="text-center py-12 text-slate-500 dark:text-slate-400">
                            <div className="p-4 rounded-xl bg-slate-50 dark:bg-slate-800/50 inline-block mb-4">
                              <FileText className="h-8 w-8 opacity-50" />
                            </div>
                            <p className="text-sm">No content available for this section</p>
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                </article>
              );

            case 'document':
            case 'lesson':
              return (
                <article key={content.id} className="max-w-none">
                  <div className="bg-card rounded-2xl shadow-sm border border-border overflow-hidden">
                    {/* Lesson Header */}
                    <div className="px-8 py-6 border-b border-border">
                      <div className="flex items-start gap-4">
                        <div className="p-3 rounded-xl shrink-0 bg-primary/10">
                          <BookOpen className="h-5 w-5 text-primary" />
                        </div>
                        <div className="flex-1 min-w-0" data-source-content>
                          <h2 className="text-xl font-semibold text-foreground mb-2 leading-tight select-text" data-source-content>
                            {content.title}
                          </h2>
                          {content.description && (
                            <p className="text-sm text-muted-foreground leading-relaxed select-text" data-source-content>
                              {content.description}
                            </p>
                          )}
                          <div className="flex items-center gap-2 mt-3">
                            <Badge variant="outline" className="text-xs px-2 py-1">
                              {content.type}
                            </Badge>
                          </div>
                        </div>
                      </div>
                    </div>

                    {/* Lesson Sections */}
                    <div className="px-8 py-6">
                      {(() => {
                        // Find all sections for this lesson
                        const lessonSections = contentToShow.filter(item => 
                          item && item.type === 'section' && 
                          item.lesson_id === content.lesson_id &&
                          selectedSources.has(item.id)
                        );
                        
                        if (lessonSections.length === 0) {
                          return null; // Don't show anything if no sections are selected
                        }

                        return (
                          <div className="space-y-8">
                            {lessonSections
                              .filter((section): section is NonNullable<typeof section> => section != null)
                              .sort((a, b) => (a.order_index || 0) - (b.order_index || 0))
                              .map((section, sectionIndex) => (
                                <div key={section.id} className="border-l-2 border-border pl-6">
                                  {/* Section Header */}
                                  <div className="flex items-center gap-3 mb-4">
                                    <div className={cn(
                                      "p-2 rounded-lg",
                                      section.section_type === 'video' ? "bg-red-500/10" :
                                      section.section_type === 'audio' ? "bg-purple-500/10" :
                                      section.section_type === 'image' ? "bg-orange-500/10" :
                                      "bg-muted"
                                    )}>
                                      {section.section_type === 'video' && <Video className="h-4 w-4 text-red-600" />}
                                      {section.section_type === 'audio' && <Volume2 className="h-4 w-4 text-purple-600" />}
                                      {section.section_type === 'image' && <Image className="h-4 w-4 text-orange-600" />}
                                      {(!section.section_type || section.section_type === 'text') && <FileText className="h-4 w-4 text-muted-foreground" />}
                                    </div>
                                    <div>
                                      <h3 className="font-medium text-foreground select-text" data-source-content>{section.title}</h3>
                                      {section.section_type && (
                                        <span className="text-xs text-muted-foreground capitalize">
                                          {section.section_type} content
                                        </span>
                                      )}
                                    </div>
                                  </div>

                                  {/* Section Content */}
                                  <div className="space-y-4">
                                    {/* Video */}
                                    {section.section_type === 'video' && section.video_url && (
                                      <div className="relative bg-slate-900 rounded-xl overflow-hidden shadow-lg">
                                        <div className="aspect-video">
                                          <iframe
                                            src={section.video_url}
                                            className="w-full h-full"
                                            allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                                            allowFullScreen
                                            title={section.title}
                                          />
                                        </div>
                                      </div>
                                    )}
                                    
                                    {/* Audio */}
                                    {section.section_type === 'audio' && section.audio_url && (
                                      <div className="bg-muted rounded-xl p-4 border border-border">
                                        <audio 
                                          controls 
                                          className="w-full h-10 bg-background rounded-lg"
                                          preload="metadata"
                                        >
                                          <source src={section.audio_url} type="audio/mpeg" />
                                          <source src={section.audio_url} type="audio/wav" />
                                          <source src={section.audio_url} type="audio/ogg" />
                                          Your browser does not support the audio element.
                                        </audio>
                                      </div>
                                    )}
                                    
                                    {/* Image */}
                                    {section.section_type === 'image' && section.image_url && (
                                      <div className="rounded-xl overflow-hidden shadow-sm border border-border">
                                        <img
                                          src={section.image_url}
                                          alt={section.title}
                                          className="w-full h-auto object-cover"
                                          loading="lazy"
                                        />
                                      </div>
                                    )}
                                    
                                    {/* Text Content */}
                                    {section.content && typeof section.content === 'string' && section.content.trim() && (
                                      <div className="prose prose-slate dark:prose-invert max-w-none select-text">
                                        <ReactMarkdown 
                                          className="text-base leading-relaxed select-text"
                                          components={{
                                            h1: ({children}) => <h1 className="text-2xl font-bold mb-4 mt-6 first:mt-0 text-foreground">{children}</h1>,
                                            h2: ({children}) => <h2 className="text-xl font-semibold mb-3 mt-5 first:mt-0 text-foreground">{children}</h2>,
                                            h3: ({children}) => <h3 className="text-lg font-medium mb-2 mt-4 first:mt-0 text-foreground">{children}</h3>,
                                            h4: ({children}) => <h4 className="text-base font-medium mb-2 mt-3 first:mt-0 text-foreground">{children}</h4>,
                                            p: ({children}) => <p className="mb-3 text-foreground leading-relaxed">{children}</p>,
                                            ul: ({children}) => <ul className="mb-3 space-y-1">{children}</ul>,
                                            ol: ({children}) => <ol className="mb-3 space-y-1">{children}</ol>,
                                            li: ({children}) => <li className="text-foreground ml-4">{children}</li>,
                                            code: ({children, className}) => {
                                              const isInline = !className;
                                              if (isInline) {
                                                return <code className="bg-muted px-2 py-1 rounded text-sm font-mono border border-border text-foreground">{children}</code>
                                              }
                                              return <code className="text-sm font-mono text-foreground">{children}</code>
                                            },
                                            pre: ({children}) => <pre className="bg-muted p-4 rounded-lg overflow-x-auto my-4 border border-border shadow-sm">{children}</pre>,
                                            strong: ({children}) => <strong className="font-semibold text-foreground">{children}</strong>,
                                            em: ({children}) => <em className="italic text-foreground">{children}</em>,
                                            blockquote: ({children}) => <blockquote className="border-l-4 border-border pl-4 my-3 italic text-muted-foreground">{children}</blockquote>
                                          }}
                                        >
                                          {section.content}
                                        </ReactMarkdown>
                                      </div>
                                    )}
                                  </div>
                                </div>
                              ))}
                          </div>
                        );
                      })()}
                    </div>
                  </div>
                </article>
              );

            default:
              return (
                <div key={content.id} className="text-center py-12 text-slate-500 dark:text-slate-400">
                  <div className="p-6 rounded-2xl bg-gradient-to-br from-slate-50 to-slate-100 dark:from-slate-800 dark:to-slate-900 mb-6 inline-block">
                    <Eye className="h-12 w-12 text-slate-400 mx-auto" />
                  </div>
                  <h3 className="font-semibold text-lg text-slate-900 dark:text-slate-100 mb-2">{content.title}</h3>
                  <p className="text-slate-600 dark:text-slate-400">This content type is not yet supported for preview</p>
                </div>
              );
          }
        })}

        {/* Enhanced Text Selection Popover */}
        {showSelectionPopover && textSelection && typeof document !== 'undefined' && createPortal(
          <div
            data-selection-popover
            className="fixed z-50 bg-white/95 dark:bg-slate-800/95 border border-slate-200 dark:border-slate-700 rounded-xl shadow-2xl p-3 flex gap-2 backdrop-blur-sm"
            style={{
              left: `${textSelection.x}px`,
              top: `${textSelection.y}px`,
              transform: 'translateX(-50%)',
            }}
          >
            <div className="flex items-center gap-2">
              <Button
                size="sm"
                variant="ghost"
                onClick={() => handleSelectionAction('explain')}
                className="h-9 px-4 text-xs font-medium bg-gradient-to-r from-purple-50 to-pink-50 hover:from-purple-100 hover:to-pink-100 dark:from-purple-900/20 dark:to-pink-900/20 dark:hover:from-purple-900/40 dark:hover:to-pink-900/40 text-purple-700 dark:text-purple-300 border border-purple-200/50 dark:border-purple-700/50 rounded-lg transition-all duration-200 hover:scale-105"
              >
                <Sparkles className="h-4 w-4 mr-2" />
                Ask Luna
              </Button>
              <div className="w-px h-6 bg-slate-200 dark:bg-slate-700" />
            <Button
              size="sm"
              variant="ghost"
              onClick={() => handleSelectionAction('note')}
                className="h-9 px-3 text-xs bg-blue-50 hover:bg-blue-100 dark:bg-blue-900/20 dark:hover:bg-blue-900/40 text-blue-700 dark:text-blue-300 border border-blue-200/50 dark:border-blue-700/50 rounded-lg transition-all duration-200 hover:scale-105"
            >
              <NotebookPen className="h-3 w-3 mr-1" />
              Note
            </Button>
            <Button
              size="sm"
              variant="ghost"
              onClick={() => handleSelectionAction('mindmap')}
                className="h-9 px-3 text-xs bg-indigo-50 hover:bg-indigo-100 dark:bg-indigo-900/20 dark:hover:bg-indigo-900/40 text-indigo-700 dark:text-indigo-300 border border-indigo-200/50 dark:border-indigo-700/50 rounded-lg transition-all duration-200 hover:scale-105"
            >
              <Map className="h-3 w-3 mr-1" />
              Map
            </Button>
            <Button
              size="sm"
              variant="ghost"
              onClick={() => handleSelectionAction('audio')}
                className="h-9 px-3 text-xs bg-emerald-50 hover:bg-emerald-100 dark:bg-emerald-900/20 dark:hover:bg-emerald-900/40 text-emerald-700 dark:text-emerald-300 border border-emerald-200/50 dark:border-emerald-700/50 rounded-lg transition-all duration-200 hover:scale-105"
            >
              <Headphones className="h-3 w-3 mr-1" />
              Audio
            </Button>
            </div>
          </div>,
          document.body
        )}
      </div>
    );
  };

  const renderNoteTakingInterface = () => {
    if (noteView === 'list') {
      return (
        <div className="space-y-4">
          {/* Add New Note Button at the top */}
          <Button 
            variant="outline" 
            size="sm" 
            className="w-full justify-start text-slate-600 dark:text-slate-400"
            onClick={(e) => {
              e.preventDefault();
              e.stopPropagation();
              createNewNote();
            }}
          >
            <Plus className="h-4 w-4 mr-2" />
            Add New Note
          </Button>

          {/* Notes List */}
          <div className="grid grid-cols-1 gap-3">
            {notes.map((note) => (
              <Card 
                key={note.id} 
                className="p-4 bg-card hover:bg-card/80 hover:shadow-md transition-all cursor-pointer group border border-border"
                onClick={() => openNote(note)}
              >
                <div className="flex items-center justify-between">
                  <div className="flex-1 min-w-0">
                    <h5 className="font-medium text-sm text-foreground group-hover:text-primary transition-colors truncate">
                      {note.title}
                    </h5>
                    <div className="flex items-center gap-2 mt-1">
                      <div className="flex items-center gap-1 text-xs text-muted-foreground">
                        <Clock className="h-3 w-3" />
                        {new Date(note.updated_at).toLocaleDateString()}
                      </div>
                      <div className="flex items-center gap-1 text-xs text-muted-foreground">
                        <NotebookPen className="h-3 w-3" />
                        Note
                      </div>
                      {note.isStarred && (
                        <div className="flex items-center gap-1 text-xs text-yellow-600 dark:text-yellow-400">
                          <Star className="h-3 w-3 fill-current" />
                          Starred
                        </div>
                      )}
                    </div>
                  </div>
                  <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={(e) => {
                        e.stopPropagation();
                        toggleStarNote(note.id);
                      }}
                      className="h-6 w-6 p-0"
                    >
                      <Star className={cn("h-3 w-3", note.isStarred ? "text-yellow-500 fill-yellow-500" : "text-slate-400")} />
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={(e) => {
                        e.stopPropagation();
                        deleteNote(note.id);
                      }}
                      className="h-6 w-6 p-0 text-red-400 hover:text-red-600"
                    >
                      <Trash2 className="h-3 w-3" />
                    </Button>
                  </div>
                </div>
              </Card>
            ))}
          </div>
        </div>
      );
    }

    // Note Editor View
    return (
      <div className="h-full flex flex-col space-y-4">
        {/* Editor Header */}
        <div className="flex items-center justify-between pb-3 border-b border-slate-200 dark:border-slate-700">
          <div className="flex items-center gap-2">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setNoteView('list')}
              className="h-8 w-8 p-0 text-slate-600 dark:text-slate-400"
            >
              <ChevronLeft className="h-4 w-4" />
            </Button>
            <div className="flex items-center gap-2">
              <div className="p-1.5 rounded-lg bg-blue-100 dark:bg-blue-900/20">
                <NotebookPen className="h-4 w-4 text-blue-600 dark:text-blue-400" />
              </div>
              <span className="text-sm font-medium text-slate-900 dark:text-slate-100">
                {currentNote ? 'Edit Note' : 'New Note'}
              </span>
            </div>
          </div>
          
          <div className="flex items-center gap-2">
            {isEditingNote ? (
              <>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => {
                    if (currentNote) {
                      setNoteTitle(currentNote.title);
                      setNoteContent(currentNote.content);
                    }
                    setIsEditingNote(false);
                  }}
                  className="text-slate-600 dark:text-slate-400"
                >
                  Cancel
                </Button>
                <Button
                  size="sm"
                  onClick={async () => {
                    if (currentNote?.id && noteTitle.trim()) {
                      await saveNote(currentNote.id, noteTitle, noteContent);
                      setIsEditingNote(false);
                    }
                  }}
                  disabled={!noteTitle.trim() || isSaving || !currentNote?.id}
                  className="bg-blue-600 hover:bg-blue-700 text-white"
                >
                  {isSaving ? (
                    <RefreshCw className="h-3 w-3 animate-spin mr-1" />
                  ) : (
                    <Save className="h-3 w-3 mr-1" />
                  )}
                  {isSaving ? 'Saving...' : 'Save'}
                </Button>
              </>
            ) : (
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setIsEditingNote(true)}
                className="text-slate-600 dark:text-slate-400"
              >
                <Edit className="h-3 w-3 mr-1" />
                Edit
              </Button>
            )}
          </div>
        </div>

        {/* Title Input */}
        <div>
          <Input
            value={noteTitle}
            onChange={(e) => handleNoteTitleChange(e.target.value)}
            placeholder="Note title..."
            disabled={!isEditingNote}
            className="text-lg font-semibold border-none px-0 bg-transparent focus:ring-0 focus:border-none placeholder:text-slate-400"
          />
        </div>
        
        {/* Content Editor */}
        <div className="flex-1 relative">
          <NotionEditorWrapper 
            ref={noteEditorRef}
            room={currentNote ? `note-${currentNote.id}` : 'new-note'}
            placeholder="Start writing your amazing notes..."
            onUpdate={handleNoteContentChange}
          />
        </div>
      </div>
    );
  };

  const renderToolContent = () => {
    // If no study space is selected, show a message prompting user to select one
    if (!selectedSpace) {
      return (
        <div className="flex flex-col items-center justify-center py-12 px-4">
          <div className="p-6 rounded-2xl bg-gradient-to-br from-slate-50 to-slate-100 dark:from-slate-800 dark:to-slate-900 mb-6 inline-block">
            <BookOpen className="h-12 w-12 text-slate-400 mx-auto" />
          </div>
          <h3 className="text-lg font-semibold mb-2 text-slate-900 dark:text-slate-100">
            Select a Study Space
          </h3>
          <p className="text-slate-600 dark:text-slate-400 text-center max-w-md leading-relaxed">
            Choose a course or study space from the dropdown above to access your notes, mind maps, audio summaries, and other study materials.
          </p>
        </div>
      );
    }

    switch (activeToolTab) {
      case 'chat':
        return (
          <LunaChat
            ref={lunaChatRef}
            selectedSources={getSelectedContent()}
            highlightedText={highlightedTextForLuna}
            onHighlightedTextUsed={() => setHighlightedTextForLuna(null)}
            onAddToNotes={handleAddToNotes}
            className="h-full"
            userId={currentUser?.id}
            studySpaceId={selectedSpace?.id}
          />
        );

      case 'notes':
        return renderNoteTakingInterface();

      case 'mindmaps':
        return (
          <div className="h-full min-h-[600px] p-2">
            <StudyMindMapViewer
              selectedContent={getSelectedContent()}
              selectedText={textSelection ? { text: textSelection.text, source: 'Study Material' } : undefined}
              currentNotes={notes}
              baseClassId={selectedCourse?.base_class_id}
              studySpaceId={selectedSpace?.id || ''} // Pass the current study space ID
              shouldAutoGenerate={shouldAutoGenerateMindMap}
              currentMindMap={currentMindMap} // Pass mind map state from parent
              onMindMapCreated={(mindMapData) => {
                console.log('Mind map created:', mindMapData);
                setCurrentMindMap(mindMapData); // Update parent state
                setShouldAutoGenerateMindMap(false); // Reset the flag after creation
              }}
              onMindMapChanged={setCurrentMindMap} // Allow component to update parent state
            />
          </div>
        );



      case 'audio':
        return (
          <BrainbytesGenerator
            selectedContent={getSelectedContent()}
            selectedText={textSelection ? { text: textSelection.text, source: 'Study Material' } : undefined}
            baseClassId={selectedCourse?.base_class_id}
            studySpaceId={selectedSpace?.id || ''}
            shouldAutoGenerate={shouldAutoGenerateAudio}
            onBrainbytesCreated={(brainbytesData) => {
              console.log('Brainbytes created:', brainbytesData);
              setShouldAutoGenerateAudio(false); // Reset the flag after creation
            }}
            className="h-full"
          />
        );

      case 'quiz':
        return (
          <div className="space-y-4">
            <Card className="p-4 bg-white/80 dark:bg-slate-800/80 backdrop-blur-sm">
              <div className="flex items-center justify-between mb-3">
                <h5 className="font-medium text-sm text-slate-900 dark:text-slate-100">React Hooks Quiz</h5>
                <Badge variant="secondary" className="text-xs bg-green-100 dark:bg-green-900 text-green-700 dark:text-green-300">
                  5 questions
                </Badge>
              </div>
              <p className="text-xs text-slate-600 dark:text-slate-400 mb-4">
                Test your understanding of React Hooks concepts covered in the lesson.
              </p>
              <div className="flex items-center gap-2">
                <Button size="sm" className="flex-1 bg-gradient-to-r from-blue-500 to-purple-600 text-white">
                  <CheckSquare className="h-3 w-3 mr-2" />
                  Start Quiz
                </Button>
                <Button size="sm" variant="outline">
                  <Eye className="h-3 w-3" />
                </Button>
              </div>
            </Card>
            
            <Button variant="outline" size="sm" className="w-full justify-start text-slate-600 dark:text-slate-400">
              <Plus className="h-4 w-4 mr-2" />
              Generate Quiz
            </Button>
          </div>
        );

      default:
        return <div>Select a tool to get started</div>;
    }
  };

  return (
    <LunaContextElement
      type="study-space"
      role="main-interface"
      content={{
        selectedCourse: selectedCourse ? {
          id: selectedCourse.id,
          name: selectedCourse.name,
          description: selectedCourse.description,
          baseClassId: selectedCourse.base_class_id
        } : null,
        selectedSpace: selectedSpace ? {
          id: selectedSpace.id,
          name: selectedSpace.name,
          type: selectedSpace.type,
          description: selectedSpace.description
        } : null,
        contentItems: contentItems.map(item => ({
          id: item.id,
          title: item.title,
          type: item.type,
          description: item.description,
          content: typeof item.content === 'string' ? item.content.substring(0, 500) + '...' : 'Structured content'
        })),
        selectedSources: Array.from(selectedSources),
        highlightedText: highlightedTextForLuna,
        notes: notes.map(note => ({
          id: note.id,
          title: note.title,
          content: extractTextFromTiptapJSON(note.content).substring(0, 200) + '...'
        })),
        activeToolTab,
        totalContentItems: contentItems.length,
        totalNotes: notes.length
      }}
      state={{
        isLoadingContent,
        isLoadingNotes,
        hasSelectedCourse: !!selectedCourse,
        hasSelectedSpace: !!selectedSpace,
        hasContentItems: contentItems.length > 0,
        hasNotes: notes.length > 0,
        hasSelectedSources: selectedSources.size > 0,
        hasHighlightedText: !!highlightedTextForLuna,
        activeTab: activeToolTab,
        expandedPanel
      }}
      metadata={{
        pageType: 'study-space',
        courseId: selectedCourse?.id,
        spaceId: selectedSpace?.id,
        userId: currentUser?.id,
        contextDescription: 'AI-powered study space with course content, note-taking, mind mapping, and Luna AI chat integration'
      }}
      actionable={true}
    >
      <div className="h-screen flex flex-col bg-background overflow-hidden" style={{ height: 'calc(100vh - 64px)' }}>
      
      {/* Sophisticated Header */}
      <div className="border-b border-border bg-background/95 backdrop-blur-xl sticky top-0 z-50 shadow-sm">
        <div className="flex items-center justify-between p-6">
          <div className="flex items-center gap-6">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-xl bg-gradient-to-br from-primary/80 to-accent/80 shadow-lg">
                <Sparkles className="h-5 w-5 text-primary-foreground" />
              </div>
              <div>
                <h1 className="text-xl font-semibold text-foreground">
                  AI Study Space
                </h1>
                <p className="text-xs text-muted-foreground">Intelligent learning workspace</p>
              </div>
            </div>

            {/* Course/Space Selector */}
            <div className="flex items-center gap-3">
              <Select 
                value={selectedCourse?.id || selectedSpace?.id || ''} 
                onValueChange={async (value) => {
                  const course = courses.find(c => c.id === value);
                  const space = studySpaces.find(s => s.id === value);
                  
                  console.log('Selection changed:', { value, course, space, studySpaces });
                  
                  if (course) {
                    // FIXED: Clear previous selections and content first
                    console.log('🎯 Course selected:', course.name, 'Base class ID:', course.base_class_id);
                    
                    // Clear content immediately to show loading state
                    setContentItems([]);
                    setSelectedCourse(course);
                    setSelectedSpace(null); // Clear previous space selection
                    
                    if (currentUser && course.base_class_id) {
                      // This will find existing study space or create new one if needed
                      await createStudySession(currentUser.id, course.base_class_id);
                    } else {
                      console.error('❌ Missing base_class_id for course:', course);
                    }
                  } else if (space) {
                    console.log('🏠 Space selected:', space.name, 'Type:', space.type, 'Course ID:', space.course_id);
                    
                    // Clear content immediately to show loading state
                    setContentItems([]);
                    
                    // If it's a course-linked space, also set the course
                    if (space.type === 'course' && space.course_id) {
                      const linkedCourse = courses.find(c => c.base_class_id === space.course_id);
                      console.log('🔗 Found linked course:', linkedCourse?.name);
                      setSelectedCourse(linkedCourse || null);
                    } else {
                      setSelectedCourse(null);
                    }
                    setSelectedSpace(space);
                    
                    // Create study session when space is selected - pass course_id if it's a course-linked space
                    if (currentUser) {
                      if (space.type === 'course' && space.course_id) {
                        await createStudySession(currentUser.id, space.course_id);
                      } else {
                        await createStudySession(currentUser.id);
                      }
                    }
                  }
                }}
                disabled={isLoadingCourses}
              >
                <SelectTrigger className="w-64 bg-background border-border">
                  {isLoadingCourses ? (
                    <div className="flex items-center gap-2">
                      <Loader2 className="h-4 w-4 animate-spin" />
                      <span>Loading courses...</span>
                    </div>
                  ) : (
                  <SelectValue placeholder="Select a course or space" />
                  )}
                </SelectTrigger>
                <SelectContent>
                  <div className="p-2">
                    <div className="flex items-center gap-2 px-2 py-1 text-xs font-medium text-muted-foreground uppercase tracking-wide">
                      <GraduationCap className="h-3 w-3" />
                      ACTIVE COURSES
                      {isLoadingCourses && <Loader2 className="h-3 w-3 animate-spin" />}
                    </div>
                    {isLoadingCourses ? (
                      <div className="pl-6 py-2 text-sm text-muted-foreground">Loading courses...</div>
                    ) : courses.length === 0 ? (
                      <div className="pl-6 py-2 text-sm text-muted-foreground">No courses available yet</div>
                    ) : (
                      courses.map((course) => (
                      <SelectItem key={course.id} value={course.id} className="pl-6">
                        <div className="flex items-center gap-3">
                          <div className={cn("w-2 h-2 rounded-full", course.color)} />
                          <div>
                            <div className="font-medium">{course.name}</div>
                          </div>
                        </div>
                      </SelectItem>
                      ))
                    )}
                  </div>
                  
                  <div className="border-t">
                    <div className="p-2">
                      <div className="flex items-center gap-2 px-2 py-1 text-xs font-medium text-muted-foreground uppercase tracking-wide">
                        <Library className="h-3 w-3" />
                        CUSTOM SPACES
                      </div>
                      {studySpaces.map((space) => (
                        <SelectItem key={space.id} value={space.id} className="pl-6">
                          <div className="flex items-center gap-3">
                            <div className={cn("w-2 h-2 rounded-full", space.color)} />
                            <div>
                              <div className="font-medium">{space.name}</div>
                              <div className="text-xs text-muted-foreground">{space.type === 'custom' ? 'Personal' : 'Course'}</div>
                            </div>
                          </div>
                        </SelectItem>
                      ))}
                      
                      <Dialog 
                        open={showCreateSpace} 
                        onOpenChange={(open) => {
                          setShowCreateSpace(open);
                          if (!open) {
                            setNewSpaceName(''); // Clear input when dialog closes
                          }
                        }}
                      >
                        <DialogTrigger asChild>
                          <Button variant="ghost" size="sm" className="w-full justify-start mt-2 text-muted-foreground">
                            <Plus className="h-3 w-3 mr-2" />
                            Create New Space
                          </Button>
                        </DialogTrigger>
                        <DialogContent className="sm:max-w-md">
                          <DialogHeader>
                            <DialogTitle className="flex items-center gap-2">
                              <FolderPlus className="h-5 w-5" />
                              Create Custom Study Space
                            </DialogTitle>
                            <DialogDescription>
                              Create your own independent study space to upload and organize any materials you want to learn from.
                            </DialogDescription>
                          </DialogHeader>
                          <div className="space-y-4">
                            <Input
                              key="create-space-name-input"
                              placeholder="Enter space name..."
                              value={newSpaceName}
                              onChange={(e) => setNewSpaceName(e.target.value)}
                            />
                          </div>
                          <DialogFooter>
                            <Button variant="outline" onClick={() => setShowCreateSpace(false)}>
                              Cancel
                            </Button>
                            <Button onClick={createCustomSpace} disabled={!newSpaceName.trim()}>
                              Create Space
                            </Button>
                          </DialogFooter>
                        </DialogContent>
                      </Dialog>
                    </div>
                  </div>
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <Button variant="ghost" size="sm" className="text-muted-foreground">
              <Settings className="h-4 w-4" />
            </Button>
            <Button variant="ghost" size="sm" className="text-muted-foreground">
              <MoreHorizontal className="h-4 w-4" />
            </Button>
          </div>
        </div>
      </div>

      {/* Main Workspace - Two Panel Layout */}
      <div className="flex-1 overflow-hidden">
        {expandedPanel === 'none' ? (
          <ResizablePanelGroup direction="horizontal" className="h-full">
            
            {/* LEFT PANEL - Sources & Content */}
            <ResizablePanel defaultSize={50} minSize={30} maxSize={70}>
              <div className="h-full flex flex-col bg-background border-r border-border">
                
                                  {/* Sources Header with Multi-Select Dropdown */}
                <div className="p-4 border-b border-border bg-background">
                  <div className="flex items-center justify-between mb-4">
                                          <h3 className="font-semibold text-foreground">Sources</h3>
                    {renderExpandButton('sources')}
                  </div>
                  
                  {/* Multi-Select Sources Dropdown */}
                  <Popover open={sourceDropdownOpen} onOpenChange={setSourceDropdownOpen}>
                    <PopoverTrigger asChild>
                      <Button
                        variant="outline"
                        role="combobox"
                        aria-expanded={sourceDropdownOpen}
                        className="w-full justify-between"
                      >
                        {selectedSources.size === 0 ? (
                          "Select sources..."
                        ) : selectedSources.size === 1 ? (
                          contentItems.find(item => selectedSources.has(item.id))?.title || "1 source selected"
                        ) : (
                          `${selectedSources.size} sources selected`
                        )}
                        <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                      </Button>
                    </PopoverTrigger>
                    <PopoverContent className="w-full p-0" align="start">
                      <div className="p-3 border-b border-border">
                        <div className="relative">
                          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                          <Input
                            placeholder="Search sources..."
                            value={searchQuery}
                            onChange={(e) => setSearchQuery(e.target.value)}
                            className="pl-10 h-9"
                          />
                        </div>
                      </div>
                      
                      <div className="max-h-80 overflow-y-auto">
                        {/* Select All Option */}
                        <div className="p-3 border-b border-border bg-muted/50">
                          <div className="flex items-center space-x-3">
                            <Checkbox
                              id="select-all"
                              checked={selectedSources.size === contentItems.length && contentItems.length > 0}
                              onCheckedChange={(checked) => {
                                if (checked) {
                                  setSelectedSources(new Set(contentItems.map(item => item.id)));
                                } else {
                                  setSelectedSources(new Set());
                                }
                              }}
                            />
                            <label
                              htmlFor="select-all"
                              className="text-sm font-medium text-foreground cursor-pointer"
                            >
                              Select All ({contentItems.length})
                            </label>
                          </div>
                        </div>
                        
                        {/* Hierarchical Content Tree */}
                        {(() => {
                          // Group content by paths
                          const paths = contentItems.filter(item => item.type === 'lesson' && item.id.startsWith('path-'));
                          const lessons = contentItems.filter(item => item.type === 'lesson' && item.id.startsWith('lesson-'));
                          const sections = contentItems.filter(item => item.type === 'section');
                          
                          return paths
                            .filter(path => 
                              searchQuery === '' || 
                              path.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
                              lessons.some(lesson => lesson.path_id === path.id.replace('path-', '') && 
                                lesson.title.toLowerCase().includes(searchQuery.toLowerCase())) ||
                              sections.some(section => section.path_id === path.id.replace('path-', '') && 
                                section.title.toLowerCase().includes(searchQuery.toLowerCase()))
                            )
                            .map((path) => {
                              const pathId = path.id.replace('path-', '');
                              const pathLessons = lessons.filter(lesson => lesson.path_id === pathId);
                              const isPathSelected = selectedPaths.has(pathId);
                              
                              return (
                                <div key={path.id} className="border-b border-border last:border-b-0">
                                  {/* Path Header */}
                                  <div className="p-3 hover:bg-muted/50 transition-colors">
                                    <div className="flex items-start space-x-3">
                                      <Checkbox
                                        id={path.id}
                                        checked={isPathSelected}
                                        onCheckedChange={(checked) => handlePathSelection(pathId, !!checked)}
                                      />
                                      <div className="flex-1 min-w-0">
                                        <div className="flex items-center gap-2 mb-1">
                                          <div className="p-1 rounded bg-primary/10">
                                            <BookOpen className="h-4 w-4 text-primary" />
                                          </div>
                                          <label
                                            htmlFor={path.id}
                                            className="text-sm font-semibold text-foreground cursor-pointer"
                                          >
                                            {path.title}
                                          </label>
                                          <span className="text-xs text-muted-foreground bg-muted px-2 py-1 rounded">
                                            Path
                                          </span>
                                        </div>
                                        {path.description && (
                                          <p className="text-xs text-muted-foreground ml-7">
                                            {path.description}
                                          </p>
                                        )}
                                      </div>
                                    </div>
                                  </div>
                                  
                                  {/* Path Lessons */}
                                  {pathLessons.map((lesson) => {
                                    const lessonSections = sections.filter(section => section.lesson_id === lesson.lesson_id);
                                    const isLessonSelected = selectedLessons.has(lesson.id);
                                    
                                    return (
                                      <div key={lesson.id} className="ml-6 border-l border-border">
                                        {/* Lesson Header */}
                                        <div className="p-3 hover:bg-muted/50 transition-colors">
                                          <div className="flex items-start space-x-3">
                                            <Checkbox
                                              id={lesson.id}
                                              checked={isLessonSelected}
                                              onCheckedChange={(checked) => handleLessonSelection(lesson.id, pathId, !!checked)}
                                            />
                                            <div className="flex-1 min-w-0">
                                              <div className="flex items-center gap-2 mb-1">
                                                <div className="p-1 rounded bg-secondary/50">
                                                  <FileText className="h-3 w-3 text-secondary-foreground" />
                                                </div>
                                                <label
                                                  htmlFor={lesson.id}
                                                  className="text-sm font-medium text-foreground cursor-pointer"
                                                >
                                                  {lesson.title}
                                                </label>
                                                <span className="text-xs text-muted-foreground bg-muted px-2 py-1 rounded">
                                                  Lesson
                                                </span>
                                              </div>
                                              {lesson.description && (
                                                <p className="text-xs text-muted-foreground ml-5">
                                                  {lesson.description}
                                                </p>
                                              )}
                                            </div>
                                          </div>
                                        </div>
                                        
                                        {/* Lesson Sections */}
                                        {lessonSections.map((section) => {
                                          const isSectionSelected = selectedSections.has(section.id);
                                          
                                          return (
                                            <div key={section.id} className="ml-6 border-l border-border/50">
                                              <div className="p-2 hover:bg-muted/50 transition-colors">
                                                <div className="flex items-start space-x-3">
                                                  <Checkbox
                                                    id={section.id}
                                                    checked={isSectionSelected}
                                                    onCheckedChange={(checked) => handleSectionSelection(section.id, lesson.id, pathId, !!checked)}
                                                  />
                                                  <div className="flex-1 min-w-0">
                                                    <div className="flex items-center gap-2 mb-1">
                                                      <div className="p-1 rounded bg-muted">
                                                        {section.section_type === 'video' && <Video className="h-3 w-3 text-red-500" />}
                                                        {section.section_type === 'audio' && <Video className="h-3 w-3 text-purple-500" />}
                                                        {section.section_type === 'image' && <FileText className="h-3 w-3 text-orange-500" />}
                                                        {(section.section_type === 'text' || !section.section_type) && <FileText className="h-3 w-3 text-muted-foreground" />}
                                                      </div>
                                                      <label
                                                        htmlFor={section.id}
                                                        className="text-xs font-medium text-foreground cursor-pointer"
                                                      >
                                                        {section.title}
                                                      </label>
                                                      <span className="text-xs text-muted-foreground bg-muted/50 px-1 py-0.5 rounded text-[10px]">
                                                        {section.section_type || 'text'}
                                                      </span>
                                                    </div>
                                                    {section.description && (
                                                      <p className="text-xs text-muted-foreground ml-5 line-clamp-1">
                                                        {section.description}
                                                      </p>
                                                    )}
                                                  </div>
                                                </div>
                                              </div>
                                            </div>
                                          );
                                        })}
                                      </div>
                                    );
                                  })}
                                </div>
                              );
                            });
                        })()}
                      </div>
                    </PopoverContent>
                  </Popover>
                </div>

                {/* Full Content Display Area */}
                <div className="flex-1 overflow-hidden">
                  <ScrollArea className="h-full">
                    <div className="p-6">
                      {renderSourceContent()}
                    </div>
                  </ScrollArea>
                </div>
              </div>
            </ResizablePanel>

            <ResizableHandle withHandle />

            {/* RIGHT PANEL - Study Tools with Tabbed Interface */}
            <ResizablePanel defaultSize={50} minSize={30} maxSize={70}>
              <div className="h-full flex flex-col bg-background border-l border-border/60 relative">
                
                {/* Tools Header with Tabs */}
                <div className="p-4 border-b border-border/60 bg-background/80">
                  <div className="flex items-center justify-between mb-4">
                                          <h3 className="font-semibold text-foreground">Study Tools</h3>
                    {renderExpandButton('tools')}
                  </div>
                  
                  <Tabs value={activeToolTab} onValueChange={setActiveToolTab} className="w-full">
                    <TabsList className="grid w-full grid-cols-5 bg-muted">
                      <TabsTrigger value="chat" className="text-xs">
                        <MessageSquare className="h-3 w-3 mr-1" />
                        Chat
                      </TabsTrigger>
                      <TabsTrigger value="notes" className="text-xs">
                        <NotebookPen className="h-3 w-3 mr-1" />
                        Notes
                      </TabsTrigger>
                      <TabsTrigger value="mindmaps" className="text-xs">
                        <Map className="h-3 w-3 mr-1" />
                        Maps
                      </TabsTrigger>
                      <TabsTrigger value="audio" className="text-xs">
                        <Headphones className="h-3 w-3 mr-1" />
                        Audio
                      </TabsTrigger>
                      <TabsTrigger value="quiz" className="text-xs">
                        <CheckSquare className="h-3 w-3 mr-1" />
                        Quiz
                      </TabsTrigger>
                    </TabsList>
                  </Tabs>
                </div>

                {/* Tool Content Area */}
                <div className="flex-1 min-h-0 flex flex-col">
                  <div className="flex-1 min-h-0 overflow-hidden">
                    <ScrollArea className="h-full">
                      <div className="p-4">
                        {renderToolContent()}
                      </div>
                    </ScrollArea>
                  </div>


                </div>
              </div>
            </ResizablePanel>

          </ResizablePanelGroup>
        ) : (
          // Full Screen Panel Views
          <div className="h-full bg-background relative">
            <div className="absolute top-4 right-4 z-50">
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setExpandedPanel('none')}
                className="h-8 w-8 p-0 text-muted-foreground hover:text-foreground bg-background/80 backdrop-blur-sm shadow-lg rounded-lg"
              >
                <X className="h-4 w-4" />
              </Button>
            </div>

            {expandedPanel === 'sources' && (
              <div className="h-full p-8">
                <h2 className="text-2xl font-bold mb-6 text-foreground">Source Content</h2>
                <div className="h-full max-w-5xl mx-auto">
                  {renderSourceContent()}
                </div>
              </div>
            )}

            {expandedPanel === 'tools' && (
              <div className="h-full flex flex-col">
                <div className="flex-shrink-0 p-8 pb-4">
                <h2 className="text-2xl font-bold mb-6 text-foreground">Study Tools</h2>
                <div className="max-w-5xl mx-auto">
                  <Tabs value={activeToolTab} onValueChange={setActiveToolTab} className="w-full">
                      <TabsList className="grid w-full grid-cols-5 bg-muted">
                      <TabsTrigger value="chat">
                        <MessageSquare className="h-4 w-4 mr-2" />
                        Chat
                      </TabsTrigger>
                      <TabsTrigger value="notes">
                        <NotebookPen className="h-4 w-4 mr-2" />
                        Notes
                      </TabsTrigger>
                      <TabsTrigger value="mindmaps">
                        <Map className="h-4 w-4 mr-2" />
                        Mind Maps
                      </TabsTrigger>
                      <TabsTrigger value="audio">
                        <Headphones className="h-4 w-4 mr-2" />
                        Audio
                      </TabsTrigger>
                      <TabsTrigger value="quiz">
                        <CheckSquare className="h-4 w-4 mr-2" />
                        Quiz
                      </TabsTrigger>
                    </TabsList>
                    </Tabs>
                  </div>
                </div>
                
                {/* Tool Content Area - Scrollable */}
                <div className="flex-1 min-h-0 overflow-hidden px-8">
                  <div className="max-w-5xl mx-auto h-full flex flex-col">
                    {activeToolTab === 'chat' ? (
                      <div className="flex-1 min-h-0 overflow-hidden border border-border rounded-lg bg-background">
                        <LunaChat 
                          ref={lunaChatRef}
                          selectedSources={Array.from(selectedSources).map(id => contentItems.find(item => item.id === id)).filter(Boolean)}
                          highlightedText={highlightedTextForLuna}
                          onHighlightedTextUsed={() => {
                            setHighlightedTextForLuna(null);
                            setTextSelection(null);
                            setPersistedSelection(null);
                            removeCustomHighlight();
                          }}
                          onAddToNotes={handleAddToNotes}
                          onChatViewChange={setIsChatInterfaceOpen}
                          chatMessage={chatMessage}
                          setChatMessage={setChatMessage}
                          isGenerating={isGenerating}
                          className="h-full w-full"
                          userId={currentUser?.id}
                          studySpaceId={selectedSpace?.id}
                        />
                      </div>
                    ) : (
                      <ScrollArea className="h-full">
                        <div className="pb-8">
                          {activeToolTab === 'notes' && renderNoteTakingInterface()}
                          {activeToolTab === 'mindmaps' && (
                            <div className="h-full min-h-[600px] p-2">
                              <StudyMindMapViewer
                                selectedContent={getSelectedContent()}
                                selectedText={textSelection ? { text: textSelection.text, source: 'Study Material' } : undefined}
                                currentNotes={notes}
                                baseClassId={selectedCourse?.base_class_id}
                                studySpaceId={selectedSpace?.id || ''}
                                shouldAutoGenerate={shouldAutoGenerateMindMap}
                                currentMindMap={currentMindMap}
                                onMindMapCreated={(mindMapData) => {
                                  console.log('Mind map created:', mindMapData);
                                  setCurrentMindMap(mindMapData);
                                  setShouldAutoGenerateMindMap(false);
                                }}
                                onMindMapChanged={setCurrentMindMap}
                              />
                            </div>
                          )}
                          {activeToolTab === 'audio' && (
                                                         <BrainbytesGenerator
                               selectedContent={getSelectedContent()}
                               selectedText={textSelection ? { text: textSelection.text, source: 'Study Material' } : undefined}
                               baseClassId={selectedCourse?.base_class_id}
                               studySpaceId={selectedSpace?.id || ''}
                             />
                          )}
                          {activeToolTab === 'quiz' && (
                            <div className="text-center py-12">
                              <div className="p-6 rounded-2xl bg-green-500/10 mb-6 inline-block">
                                <CheckSquare className="h-12 w-12 text-green-500 mx-auto" />
                              </div>
                              <h3 className="text-lg font-semibold mb-4 text-foreground">
                                Interactive Quizzes
                              </h3>
                              <p className="text-muted-foreground mb-6 max-w-md mx-auto leading-relaxed">
                                Test your knowledge with AI-generated quizzes, flashcards, and practice questions based on your study materials.
                              </p>
                              <Button variant="outline">
                                <Brain className="h-4 w-4 mr-2" />
                                Coming Soon
                              </Button>
                            </div>
                          )}
                        </div>
                      </ScrollArea>
                    )}
                  </div>
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
    </LunaContextElement>
  );
} 