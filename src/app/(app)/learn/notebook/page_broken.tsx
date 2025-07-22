'use client';

import { useState, useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';

// Tiptap v3 imports for premium rich text editing
import { useEditor, EditorContent } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';
import { Image as TiptapImage } from '@tiptap/extension-image';
import { Link as TiptapLink } from '@tiptap/extension-link';
import { Table as TiptapTable } from '@tiptap/extension-table';
import { TableRow } from '@tiptap/extension-table-row';
import { TableCell } from '@tiptap/extension-table-cell';
import { TableHeader } from '@tiptap/extension-table-header';
import { Placeholder } from '@tiptap/extension-placeholder';
import { CodeBlockLowlight } from '@tiptap/extension-code-block-lowlight';
import { createLowlight } from 'lowlight';
import javascript from 'highlight.js/lib/languages/javascript';
import typescript from 'highlight.js/lib/languages/typescript';
import python from 'highlight.js/lib/languages/python';
import css from 'highlight.js/lib/languages/css';
import html from 'highlight.js/lib/languages/xml';

// Premium Tiptap v3 extensions
import { Color } from '@tiptap/extension-color';
import { TextStyle } from '@tiptap/extension-text-style';
import { TextAlign } from '@tiptap/extension-text-align';
import { Underline as TiptapUnderline } from '@tiptap/extension-underline';
import { Subscript as TiptapSubscript } from '@tiptap/extension-subscript';
import { Superscript as TiptapSuperscript } from '@tiptap/extension-superscript';
import { Highlight as TiptapHighlight } from '@tiptap/extension-highlight';
import { TaskList } from '@tiptap/extension-task-list';
import { TaskItem } from '@tiptap/extension-task-item';
import { Focus } from '@tiptap/extension-focus';
import { Typography } from '@tiptap/extension-typography';
import { CharacterCount } from '@tiptap/extension-character-count';

import { useRouter, useSearchParams } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
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
  Quote,
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
  Heading1,
  Heading2,
  Heading3,
  Hash,
  Table,
  Image,
  FileAudio,
  Smile,
  AlignLeft,
  AlignCenter,
  AlignRight,
  Indent,
  Outdent,
  Strikethrough,
  Subscript,
  Superscript,
  PaintBucket,
  Paperclip
} from 'lucide-react';
import { cn } from '@/lib/utils';

interface Course {
  id: string;
  name: string;
  description: string;
  instructor: string;
  progress: number;
  color: string;
}

interface ContentItem {
  id: string;
  title: string;
  type: 'lesson' | 'document' | 'video' | 'assignment' | 'discussion' | 'resource';
  description?: string;
  duration?: string;
  progress?: number;
  thumbnail?: string;
  tags?: string[];
  course_id?: string;
  content?: string;
  url?: string;
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
  content: string;
  created_at: string;
  updated_at: string;
  tags: string[];
  source?: string;
  isStarred: boolean;
}

type PanelExpansion = 'none' | 'sources' | 'tools';
type NoteView = 'list' | 'editor';

export default function UnifiedStudySpace() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const spaceId = searchParams?.get('space');
  const contentRef = useRef<HTMLDivElement>(null);
  const noteEditorRef = useRef<HTMLDivElement>(null);

  const [selectedCourse, setSelectedCourse] = useState<Course | null>(null);
  const [selectedSpace, setSelectedSpace] = useState<StudySpace | null>(null);
  const [selectedSources, setSelectedSources] = useState<Set<string>>(new Set());
  const [sourceDropdownOpen, setSourceDropdownOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [chatMessage, setChatMessage] = useState('');
  const [isGenerating, setIsGenerating] = useState(false);
  const [showCreateSpace, setShowCreateSpace] = useState(false);
  const [newSpaceName, setNewSpaceName] = useState('');
  const [expandedPanel, setExpandedPanel] = useState<PanelExpansion>('none');
  const [activeToolTab, setActiveToolTab] = useState('chat');
  const [textSelection, setTextSelection] = useState<TextSelection | null>(null);
  const [showSelectionPopover, setShowSelectionPopover] = useState(false);

  // Note-taking states
  const [noteView, setNoteView] = useState<NoteView>('list');
  const [currentNote, setCurrentNote] = useState<Note | null>(null);
  const [noteTitle, setNoteTitle] = useState('');
  const [noteContent, setNoteContent] = useState('');
  const [isEditingNote, setIsEditingNote] = useState(false);
  const [noteSelection, setNoteSelection] = useState<TextSelection | null>(null);
  const [showNoteActions, setShowNoteActions] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  
  // Initialize premium Tiptap v3 editor
  const lowlight = createLowlight();
  lowlight.register({
    javascript,
    typescript,
    python,
    css,
    html,
  });
  
  const editor = useEditor({
    immediatelyRender: false, // Prevent SSR hydration mismatches
    extensions: [
      StarterKit.configure({
        heading: {
          levels: [1, 2, 3, 4, 5, 6],
        },
      }),
      // Core extensions
      TextStyle,
      Color.configure({ types: ['textStyle'] }),
      TiptapHighlight.configure({ multicolor: true }),
      TiptapUnderline,
      TiptapSubscript,
      TiptapSuperscript,
      TextAlign.configure({
        types: ['heading', 'paragraph'],
      }),
      
      // Content extensions
      TiptapImage.configure({
        inline: true,
        allowBase64: true,
        HTMLAttributes: {
          class: 'rounded-lg max-w-full h-auto my-4',
        },
      }),
      TiptapLink.configure({
        openOnClick: false,
        autolink: true,
        linkOnPaste: true,
        HTMLAttributes: {
          class: 'text-blue-600 hover:text-blue-800 underline cursor-pointer',
        },
      }),
      
      // Table extensions
      TiptapTable.configure({
        resizable: true,
        HTMLAttributes: {
          class: 'border-collapse table-auto w-full',
        },
      }),
      TableRow,
      TableHeader.configure({
        HTMLAttributes: {
          class: 'border border-gray-300 px-4 py-2 bg-gray-50 font-semibold',
        },
      }),
      TableCell.configure({
        HTMLAttributes: {
          class: 'border border-gray-300 px-4 py-2',
        },
      }),
      
      // Task list
      TaskList.configure({
        HTMLAttributes: {
          class: 'not-prose pl-2',
        },
      }),
      TaskItem.configure({
        nested: true,
        HTMLAttributes: {
          class: 'flex items-start my-1',
        },
      }),
      
      // Code blocks with syntax highlighting
      CodeBlockLowlight.configure({
        lowlight,
        HTMLAttributes: {
          class: 'rounded-md bg-gray-900 text-gray-100 p-4 font-mono text-sm overflow-x-auto',
        },
      }),
      
      // UI enhancements
      Placeholder.configure({
        placeholder: ({ node }) => {
          if (node.type.name === 'heading') {
            return `Heading ${node.attrs.level}`;
          }
          return 'Start writing your notes... Press "/" for commands';
        },
      }),
      Focus.configure({
        className: 'has-focus',
        mode: 'all',
      }),
      Typography,
      CharacterCount.configure({
        limit: 10000,
      }),
    ],
    content: noteContent,
    editable: true,
    onUpdate: ({ editor }) => {
      setNoteContent(editor.getHTML());
    },
    editorProps: {
      attributes: {
        class: 'prose prose-lg dark:prose-invert max-w-none focus:outline-none min-h-[400px] p-6 bg-white dark:bg-gray-900 rounded-lg border border-gray-200 dark:border-gray-700',
        spellcheck: 'false',
      },
    },
  });

  // Sync editor editable state with isEditingNote
  useEffect(() => {
    if (editor) {
      editor.setEditable(isEditingNote);
      if (isEditingNote) {
        // Focus the editor when entering edit mode
        setTimeout(() => editor.commands.focus(), 100);
      }
    }
  }, [editor, isEditingNote]);

  // Sync editor content with noteContent state
  useEffect(() => {
    if (editor && editor.getHTML() !== noteContent) {
      editor.commands.setContent(noteContent);
    }
  }, [editor, noteContent]);

  // Sync editor content when switching notes
  useEffect(() => {
    if (editor && currentNote) {
      editor.commands.setContent(currentNote.content);
      setNoteContent(currentNote.content);
      setNoteTitle(currentNote.title);
    }
  }, [editor, currentNote]);

  // Video player state for premium content viewing
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [volume, setVolume] = useState(1);
  const [isMuted, setIsMuted] = useState(false);

  // Mock notes data
  const [notes, setNotes] = useState<Note[]>([
    {
      id: '1',
      title: 'React Hooks Summary',
      content: 'Key concepts: useState for state management, useEffect for side effects, custom hooks for reusable logic. Remember to only call hooks at the top level and use the ESLint plugin to catch common mistakes.',
      created_at: '2024-01-22T10:30:00Z',
      updated_at: '2024-01-22T14:30:00Z',
      tags: ['react', 'hooks'],
      source: 'Introduction to React Hooks',
      isStarred: false
    },
    {
      id: '2',
      title: 'State Management Notes',
      content: 'useReducer vs useState: useReducer is better for complex state logic with multiple sub-values or when the next state depends on the previous one. Context API provides a way to pass data through the component tree without prop drilling.',
      created_at: '2024-01-21T09:15:00Z',
      updated_at: '2024-01-21T09:15:00Z',
      tags: ['react', 'state'],
      source: 'Advanced State Management',
      isStarred: true
    }
  ]);

  // Mock data - replace with real Supabase data
  const [courses] = useState<Course[]>([
    {
      id: '1',
      name: 'Advanced React Development',
      description: 'Master React with hooks, context, and advanced patterns',
      instructor: 'Dr. Sarah Johnson',
      progress: 75,
      color: 'bg-blue-500'
    },
    {
      id: '2',
      name: 'Full Stack JavaScript',
      description: 'Complete JavaScript development from frontend to backend',
      instructor: 'Prof. Mike Chen',
      progress: 45,
      color: 'bg-emerald-500'
    },
    {
      id: '3',
      name: 'UI/UX Design Principles',
      description: 'Learn design thinking and user experience fundamentals',
      instructor: 'Maria Rodriguez',
      progress: 60,
      color: 'bg-purple-500'
    }
  ]);

  const [studySpaces] = useState<StudySpace[]>([
    {
      id: 'custom-1',
      name: 'Personal Research',
      type: 'custom',
      description: 'My independent study materials',
      color: 'bg-orange-500',
      created_at: '2024-01-15'
    }
  ]);

  const [contentItems, setContentItems] = useState<ContentItem[]>([]);

  useEffect(() => {
    // Load content based on selected course or space
    if (selectedCourse) {
      loadCourseContent(selectedCourse.id);
    } else if (selectedSpace && selectedSpace.type === 'custom') {
      loadCustomContent(selectedSpace.id);
    }
  }, [selectedCourse, selectedSpace]);

  // Handle text selection in source content
  useEffect(() => {
    const handleMouseUp = () => {
      const selection = window.getSelection();
      if (selection && selection.toString().trim() && contentRef.current?.contains(selection.anchorNode)) {
        const range = selection.getRangeAt(0);
        const rect = range.getBoundingClientRect();
        
        setTextSelection({
          text: selection.toString(),
          startOffset: range.startOffset,
          endOffset: range.endOffset,
          x: rect.left + rect.width / 2,
          y: rect.bottom + 5 // Position below the selected text
        });
        setShowSelectionPopover(true);
      } else {
        setShowSelectionPopover(false);
        setTextSelection(null);
      }
    };

    const handleMouseDown = () => {
      setShowSelectionPopover(false);
      setTextSelection(null);
    };

    document.addEventListener('mouseup', handleMouseUp);
    document.addEventListener('mousedown', handleMouseDown);

    return () => {
      document.removeEventListener('mouseup', handleMouseUp);
      document.removeEventListener('mousedown', handleMouseDown);
    };
  }, []);

  // Handle text selection in note editor
  useEffect(() => {
    const handleNoteSelection = () => {
      if (!editor) {
        setShowNoteActions(false);
        setNoteSelection(null);
        return;
      }

      // Get selected text from Tiptap editor
      const { from, to, empty } = editor.state.selection;
      const selectedText = editor.state.doc.textBetween(from, to, ' ');
      
      if (selectedText.trim() && !empty) {
        // Get the editor container's bounding rect
        const editorElement = editor.view.dom;
        const editorRect = editorElement.getBoundingClientRect();
        
        // Position in bottom right corner of the editor with padding
        const padding = 20; // Space from edges
        const popoverWidth = 300; // Approximate popover width
        const popoverHeight = 50; // Approximate popover height
        
        const x = editorRect.right - popoverWidth - padding;
        const y = editorRect.bottom - popoverHeight - padding;
        
        setNoteSelection({
          text: selectedText,
          startOffset: from,
          endOffset: to,
          x: x,
          y: y
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

    if (noteView === 'editor' && editor) {
      // Add event listeners to the Tiptap editor
      editor.on('selectionUpdate', handleNoteSelection);
      document.addEventListener('mousedown', handleNoteMouseDown);

      return () => {
        editor.off('selectionUpdate', handleNoteSelection);
        document.removeEventListener('mousedown', handleNoteMouseDown);
      };
    }

    return () => {};
  }, [noteView]);

  const loadCourseContent = (courseId: string) => {
    // Mock course content - replace with Supabase queries
    const mockContent: ContentItem[] = [
      {
        id: '1',
        title: 'Introduction to React Hooks',
        type: 'lesson',
        description: 'Learn the fundamentals of React Hooks and how to use them effectively.',
        duration: '45 min',
        progress: 75,
        tags: ['react', 'hooks', 'frontend'],
        course_id: courseId,
        content: `# Introduction to React Hooks

React Hooks are functions that let you use state and other React features without writing a class. They were introduced in React 16.8 and have revolutionized how we write React components.

## Key Concepts

### useState Hook
The useState hook allows you to add state to functional components:

\`\`\`javascript
import React, { useState } from 'react';

function Counter() {
  const [count, setCount] = useState(0);
  
  return (
    <div>
      <p>You clicked {count} times</p>
      <button onClick={() => setCount(count + 1)}>
        Click me
      </button>
    </div>
  );
}
\`\`\`

### useEffect Hook
The useEffect hook lets you perform side effects in function components:

\`\`\`javascript
import React, { useState, useEffect } from 'react';

function Example() {
  const [count, setCount] = useState(0);

  useEffect(() => {
    document.title = \`You clicked \${count} times\`;
  });

  return (
    <div>
      <p>You clicked {count} times</p>
      <button onClick={() => setCount(count + 1)}>
        Click me
      </button>
    </div>
  );
}
\`\`\`

## Best Practices

1. **Only call hooks at the top level** - Don't call hooks inside loops, conditions, or nested functions
2. **Use the ESLint plugin** - Install eslint-plugin-react-hooks to catch common mistakes
3. **Separate concerns** - Use multiple state variables for unrelated data
4. **Custom hooks** - Extract component logic into reusable functions

## Common Patterns

### Fetching Data
\`\`\`javascript
function UserProfile({ userId }) {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchUser(userId).then(user => {
      setUser(user);
      setLoading(false);
    });
  }, [userId]);

  if (loading) return <div>Loading...</div>;
  return <div>Hello {user.name}!</div>;
}
\`\`\`

This lesson covers the fundamental concepts you need to get started with React Hooks.`
      },
      {
        id: '2',
        title: 'Advanced State Management',
        type: 'lesson',
        description: 'Deep dive into complex state management patterns.',
        duration: '60 min',
        progress: 30,
        tags: ['react', 'state', 'advanced'],
        course_id: courseId,
        content: `# Advanced State Management

As your React applications grow, managing state becomes more complex. This lesson explores advanced patterns and techniques for effective state management.

## useReducer Hook

For complex state logic, useReducer is often preferable to useState:

\`\`\`javascript
import React, { useReducer } from 'react';

const initialState = { count: 0 };

function reducer(state, action) {
  switch (action.type) {
    case 'increment':
      return { count: state.count + 1 };
    case 'decrement':
      return { count: state.count - 1 };
    case 'reset':
      return initialState;
    default:
      throw new Error();
  }
}

function Counter() {
  const [state, dispatch] = useReducer(reducer, initialState);
  
  return (
    <>
      Count: {state.count}
      <button onClick={() => dispatch({ type: 'reset' })}>
        Reset
      </button>
      <button onClick={() => dispatch({ type: 'increment' })}>+</button>
      <button onClick={() => dispatch({ type: 'decrement' })}>-</button>
    </>
  );
}
\`\`\`

## Context API

React Context provides a way to pass data through the component tree without having to pass props down manually at every level.

\`\`\`javascript
const ThemeContext = React.createContext('light');

function App() {
  return (
    <ThemeContext.Provider value="dark">
      <Toolbar />
    </ThemeContext.Provider>
  );
}

function Toolbar() {
  return (
    <div>
      <ThemedButton />
    </div>
  );
}

function ThemedButton() {
  const theme = useContext(ThemeContext);
  return <button className={theme}>I am styled by theme context!</button>;
}
\`\`\`

## Custom Hooks

Create reusable stateful logic:

\`\`\`javascript
function useCounter(initialValue = 0) {
  const [count, setCount] = useState(initialValue);
  
  const increment = () => setCount(count + 1);
  const decrement = () => setCount(count - 1);
  const reset = () => setCount(initialValue);
  
  return { count, increment, decrement, reset };
}

// Usage
function Counter() {
  const { count, increment, decrement, reset } = useCounter(10);
  
  return (
    <div>
      <p>Count: {count}</p>
      <button onClick={increment}>+</button>
      <button onClick={decrement}>-</button>
      <button onClick={reset}>Reset</button>
    </div>
  );
}
\`\`\`

This approach allows you to share stateful logic between components without changing your component hierarchy.`
      },
      {
        id: '3',
        title: 'Project Requirements Document',
        type: 'document',
        description: 'Detailed specifications for the final project.',
        tags: ['project', 'requirements'],
        course_id: courseId,
        content: `# Final Project Requirements

## Project Overview
Build a full-stack React application that demonstrates mastery of the concepts covered in this course.

## Technical Requirements

### Frontend (React)
- Use functional components with hooks
- Implement at least 3 custom hooks
- Use Context API for global state management
- Responsive design with CSS Grid/Flexbox
- Form validation and error handling
- Loading states and user feedback

### Backend (Node.js/Express)
- RESTful API with proper HTTP status codes
- Authentication and authorization
- Input validation and sanitization
- Error handling middleware
- Database integration (MongoDB or PostgreSQL)

### Additional Features
- Real-time features (WebSocket or Server-Sent Events)
- File upload functionality
- Search and filtering capabilities
- Pagination for large datasets
- Unit and integration tests

## Deliverables
1. Source code repository (GitHub)
2. Live deployment (Vercel, Netlify, or Heroku)
3. Documentation (README with setup instructions)
4. Video demonstration (5-10 minutes)

## Timeline
- Week 1-2: Project planning and setup
- Week 3-4: Core functionality development
- Week 5-6: Advanced features and testing
- Week 7: Documentation and deployment
- Week 8: Final presentation

## Evaluation Criteria
- Code quality and organization (25%)
- Functionality and user experience (25%)
- Technical complexity (25%)
- Documentation and presentation (25%)

## Project Ideas
- Social media dashboard
- E-commerce platform
- Project management tool
- Real-time chat application
- Data visualization dashboard
- Learning management system

Choose a project that interests you and allows you to demonstrate the skills learned in this course.`
      },
      {
        id: '4',
        title: 'React Best Practices Video',
        type: 'video',
        description: 'Industry expert discusses React best practices.',
        duration: '30 min',
        tags: ['react', 'best-practices'],
        course_id: courseId,
        url: 'https://example.com/video.mp4',
        thumbnail: 'https://via.placeholder.com/800x450/3B82F6/FFFFFF?text=React+Best+Practices'
      },
      {
        id: '5',
        title: 'Component Architecture Assignment',
        type: 'assignment',
        description: 'Build a complex component hierarchy.',
        tags: ['react', 'components', 'assignment'],
        course_id: courseId,
      },
      {
        id: '6',
        title: 'React Testing Documentation',
        type: 'resource',
        description: 'Comprehensive guide to testing React applications.',
        tags: ['react', 'testing', 'documentation'],
        course_id: courseId,
      }
    ];
    setContentItems(mockContent);
  };

  const loadCustomContent = (spaceId: string) => {
    // Mock custom content
    const mockContent: ContentItem[] = [
      {
        id: 'custom-1',
        title: 'Machine Learning Research Paper',
        type: 'document',
        description: 'Latest research on neural networks',
        tags: ['ml', 'research'],
        content: `# Neural Network Architectures for Natural Language Processing

## Abstract
This paper presents a comprehensive analysis of modern neural network architectures specifically designed for natural language processing tasks...

## Introduction
Natural Language Processing has seen remarkable advances in recent years, primarily driven by the development of transformer-based architectures...`
      }
    ];
    setContentItems(mockContent);
  };

  const getSelectedContent = () => {
    return contentItems.filter(item => selectedSources.has(item.id));
  };

  const handleSendMessage = () => {
    if (!chatMessage.trim()) return;
    
    setIsGenerating(true);
    setTimeout(() => {
      setIsGenerating(false);
      setChatMessage('');
    }, 1500);
  };

  const createCustomSpace = () => {
    if (!newSpaceName.trim()) return;
    
    // TODO: Create space in Supabase
    setShowCreateSpace(false);
    setNewSpaceName('');
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
        "h-8 w-8 p-0 text-slate-400 hover:text-slate-600 dark:hover:text-slate-300 transition-all duration-200",
        "hover:bg-slate-100 dark:hover:bg-slate-700 rounded-lg",
        position === 'left' ? 'order-first' : 'order-last'
      )}
    >
      {expandedPanel === panel ? <Minimize2 className="h-4 w-4" /> : <Maximize2 className="h-4 w-4" />}
    </Button>
  );

  const handleSelectionAction = (action: 'note' | 'mindmap' | 'explain' | 'quote') => {
    if (!textSelection) return;
    
    const selectedText = textSelection.text;
    
    switch (action) {
      case 'note':
        // Add to notes
        openNewNoteWithText(selectedText);
        break;
      case 'mindmap':
        // Create mind map
        console.log('Creating mind map from:', selectedText);
        break;
      case 'explain':
        // Ask Luna to explain
        setChatMessage(`Can you explain this: "${selectedText}"`);
        setActiveToolTab('chat'); // Switch to chat tab
        break;
      case 'quote':
        // Save as quote
        console.log('Saving quote:', selectedText);
        break;
    }
    
    setShowSelectionPopover(false);
    setTextSelection(null);
  };

  const openNewNoteWithText = (text: string) => {
    setNoteView('editor');
    setCurrentNote(null);
    setNoteTitle('New Note');
    setNoteContent(text);
    setIsEditingNote(true);
    setActiveToolTab('notes');
  };

  const openNote = (note: Note) => {
    setCurrentNote(note);
    setNoteTitle(note.title);
    setNoteContent(note.content);
    setNoteView('editor');
    setIsEditingNote(false);
  };

  const createNewNote = () => {
    setCurrentNote(null);
    setNoteTitle('');
    setNoteContent('');
    setNoteView('editor');
    setIsEditingNote(true);
  };

  const saveNote = async () => {
    if (!noteTitle.trim() || !noteContent.trim()) return;
    
    setIsSaving(true);
    
    // Simulate save delay
    setTimeout(() => {
      const now = new Date().toISOString();
      
      if (currentNote) {
        // Update existing note
        const updatedNotes = notes.map(note => 
          note.id === currentNote.id 
            ? { ...note, title: noteTitle, content: noteContent, updated_at: now }
            : note
        );
        setNotes(updatedNotes);
      } else {
        // Create new note
        const newNote: Note = {
          id: Date.now().toString(),
          title: noteTitle,
          content: noteContent,
          created_at: now,
          updated_at: now,
          tags: [],
          isStarred: false
        };
        setNotes([newNote, ...notes]);
        setCurrentNote(newNote);
      }
      
      setIsEditingNote(false);
      setIsSaving(false);
    }, 800);
  };

  const deleteNote = (noteId: string) => {
    setNotes(notes.filter(note => note.id !== noteId));
    if (currentNote?.id === noteId) {
      setNoteView('list');
      setCurrentNote(null);
    }
  };

  const toggleStarNote = (noteId: string) => {
    setNotes(notes.map(note => 
      note.id === noteId 
        ? { ...note, isStarred: !note.isStarred }
        : note
    ));
  };

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

  const formatText = (format: string, value?: string) => {
    // Enhanced text formatting with rich text capabilities
    const textarea = document.querySelector('textarea[data-note-editor]') as HTMLTextAreaElement;
    if (!textarea) return;

    const start = textarea.selectionStart;
    const end = textarea.selectionEnd;
    const selectedText = textarea.value.substring(start, end);
    
    let formattedText = '';
    let insertAtCursor = false;

    switch (format) {
      // Basic text formatting
      case 'bold':
        formattedText = selectedText ? `**${selectedText}**` : '**bold text**';
        break;
      case 'italic':
        formattedText = selectedText ? `*${selectedText}*` : '*italic text*';
        break;
      case 'underline':
        formattedText = selectedText ? `<u>${selectedText}</u>` : '<u>underlined text</u>';
        break;
      case 'strikethrough':
        formattedText = selectedText ? `~~${selectedText}~~` : '~~strikethrough text~~';
        break;
      case 'highlight':
        formattedText = selectedText ? `==${selectedText}==` : '==highlighted text==';
        break;
      
      // Headings
      case 'heading':
        const headingLevel = value === 'h1' ? '# ' : value === 'h2' ? '## ' : '### ';
        formattedText = selectedText ? `${headingLevel}${selectedText}` : `${headingLevel}Heading`;
        break;
      
      // Lists
      case 'bulletList':
        formattedText = selectedText ? `• ${selectedText}` : '• List item';
        break;
      case 'numberedList':
        formattedText = selectedText ? `1. ${selectedText}` : '1. List item';
        break;
      case 'checkList':
        formattedText = selectedText ? `- [ ] ${selectedText}` : '- [ ] Task item';
        break;
      
      // Code
      case 'code':
        formattedText = selectedText ? `\`${selectedText}\`` : '`inline code`';
        break;
      case 'codeBlock':
        formattedText = selectedText ? `\`\`\`\n${selectedText}\n\`\`\`` : '```\ncode block\n```';
        break;
      
      // Quote
      case 'quote':
        formattedText = selectedText ? `> ${selectedText}` : '> Quote text';
        break;
      
      // Alignment (placeholder - would need rich text editor for full support)
      case 'alignLeft':
      case 'alignCenter':
      case 'alignRight':
        formattedText = selectedText || 'Alignment formatting applied';
        break;
      
      // Media embeds
      case 'image':
        formattedText = '![Image description](image-url)';
        insertAtCursor = true;
        break;
      case 'video':
        formattedText = '🎥 [Video: Video title](video-url)';
        insertAtCursor = true;
        break;
      case 'audio':
        formattedText = '🎵 [Audio: Audio title](audio-url)';
        insertAtCursor = true;
        break;
      case 'file':
        formattedText = '📎 [File: Filename](file-url)';
        insertAtCursor = true;
        break;
      
      // Advanced
      case 'table':
        formattedText = `| Column 1 | Column 2 | Column 3 |
|----------|----------|----------|
| Cell 1   | Cell 2   | Cell 3   |
| Cell 4   | Cell 5   | Cell 6   |`;
        insertAtCursor = true;
        break;
      case 'link':
        formattedText = selectedText ? `[${selectedText}](url)` : '[Link text](url)';
        break;
      case 'emoji':
        formattedText = '😊';
        insertAtCursor = true;
        break;
      
      default:
        return;
    }

    const newContent = textarea.value.substring(0, start) + formattedText + textarea.value.substring(end);
    setNoteContent(newContent);
    
    // Set cursor position after formatting
    setTimeout(() => {
      if (insertAtCursor) {
        textarea.setSelectionRange(start + formattedText.length, start + formattedText.length);
      } else {
        textarea.setSelectionRange(start, start + formattedText.length);
      }
      textarea.focus();
    }, 10);
  };

  const renderSourceContent = () => {
    const contentToShow = getSelectedContent();

    if (contentToShow.length === 0) {
      return (
        <div className="flex flex-col items-center justify-center h-full text-center py-16">
          <div className="p-6 rounded-2xl bg-gradient-to-br from-slate-50 to-slate-100 dark:from-slate-800 dark:to-slate-900 mb-6">
            <BookOpen className="h-12 w-12 text-slate-400 mx-auto" />
          </div>
          <h3 className="text-xl font-semibold mb-4 text-slate-900 dark:text-slate-100">
            Select Sources to Study
          </h3>
          <p className="text-slate-600 dark:text-slate-400 mb-6 max-w-md leading-relaxed">
            Choose from your course materials or custom sources using the dropdown above. You can select multiple sources to study together.
          </p>
          <Button variant="outline" size="sm" className="bg-white dark:bg-slate-800">
            <ArrowRight className="h-4 w-4 mr-2" />
            Get Started
          </Button>
        </div>
      );
    }

    return (
      <div className="space-y-8 relative" ref={contentRef}>
        {contentToShow.map((content, index) => {
          if (!content) return null;
          
          switch (content.type) {
            case 'video':
              return (
                <div key={content.id} className="space-y-4">
                  <div className="flex items-center gap-3 mb-4">
                    <div className="p-2 rounded-lg bg-red-100 dark:bg-red-900/20">
                      <Video className="h-5 w-5 text-red-600 dark:text-red-400" />
                    </div>
                    <div>
                      <h3 className="font-semibold text-lg text-slate-900 dark:text-slate-100">{content.title}</h3>
                      {content.description && (
                        <p className="text-sm text-slate-600 dark:text-slate-400">{content.description}</p>
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

            case 'document':
            case 'lesson':
              return (
                <div key={content.id} className="prose prose-slate dark:prose-invert max-w-none">
                  <div className="bg-white dark:bg-slate-800/50 rounded-xl p-8 shadow-sm border border-slate-200 dark:border-slate-700">
                    <div className="flex items-center gap-3 mb-6">
                      <div className={cn(
                        "p-2 rounded-lg",
                        content.type === 'lesson' ? "bg-blue-100 dark:bg-blue-900/20" : "bg-emerald-100 dark:bg-emerald-900/20"
                      )}>
                        {content.type === 'lesson' ? (
                          <BookOpen className="h-5 w-5 text-blue-600 dark:text-blue-400" />
                        ) : (
                          <FileText className="h-5 w-5 text-emerald-600 dark:text-emerald-400" />
                        )}
                      </div>
                      <div>
                        <h3 className="font-semibold text-xl text-slate-900 dark:text-slate-100 mb-1">{content.title}</h3>
                        {content.description && (
                          <p className="text-sm text-slate-600 dark:text-slate-400">{content.description}</p>
                        )}
                      </div>
                    </div>
                    
                    {content.content ? (
                      <div 
                        className="text-sm leading-relaxed select-text"
                        dangerouslySetInnerHTML={{ 
                          __html: content.content
                            .replace(/^# (.+)$/gm, '<h1 class="text-2xl font-bold mb-6 text-slate-900 dark:text-slate-100 border-b border-slate-200 dark:border-slate-700 pb-3">$1</h1>')
                            .replace(/^## (.+)$/gm, '<h2 class="text-xl font-semibold mb-4 mt-8 text-slate-800 dark:text-slate-200">$1</h2>')
                            .replace(/^### (.+)$/gm, '<h3 class="text-lg font-medium mb-3 mt-6 text-slate-700 dark:text-slate-300">$1</h3>')
                            .replace(/```javascript\n([\s\S]*?)\n```/g, '<pre class="bg-slate-100 dark:bg-slate-900 p-4 rounded-lg overflow-x-auto my-6 border border-slate-200 dark:border-slate-700"><code class="text-sm font-mono">$1</code></pre>')
                            .replace(/```\n([\s\S]*?)\n```/g, '<pre class="bg-slate-100 dark:bg-slate-900 p-4 rounded-lg overflow-x-auto my-6 border border-slate-200 dark:border-slate-700"><code class="text-sm font-mono">$1</code></pre>')
                            .replace(/`([^`]+)`/g, '<code class="bg-slate-100 dark:bg-slate-800 px-2 py-1 rounded text-sm font-mono border border-slate-200 dark:border-slate-600">$1</code>')
                            .replace(/\n\n/g, '</p><p class="mb-4 text-slate-700 dark:text-slate-300 leading-relaxed">')
                            .replace(/^(?!<[h|p|c|u])(.+)$/gm, '<p class="mb-4 text-slate-700 dark:text-slate-300 leading-relaxed">$1</p>')
                        }}
                      />
                    ) : (
                      <div className="text-center py-12 text-slate-500 dark:text-slate-400">
                        <FileText className="h-12 w-12 mx-auto mb-4 opacity-50" />
                        <p>Content will be loaded here</p>
                      </div>
                    )}
                  </div>
                </div>
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

        {/* Text Selection Popover */}
        {showSelectionPopover && textSelection && typeof document !== 'undefined' && createPortal(
          <div
            className="fixed z-50 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg shadow-xl p-2 flex gap-1"
            style={{
              left: `${textSelection.x}px`,
              top: `${textSelection.y}px`,
              transform: 'translateX(-50%)',
            }}
          >
            <Button
              size="sm"
              variant="ghost"
              onClick={() => handleSelectionAction('note')}
              className="h-8 px-3 text-xs bg-blue-50 hover:bg-blue-100 dark:bg-blue-900/20 dark:hover:bg-blue-900/40 text-blue-700 dark:text-blue-300"
            >
              <NotebookPen className="h-3 w-3 mr-1" />
              Note
            </Button>
            <Button
              size="sm"
              variant="ghost"
              onClick={() => handleSelectionAction('mindmap')}
              className="h-8 px-3 text-xs bg-purple-50 hover:bg-purple-100 dark:bg-purple-900/20 dark:hover:bg-purple-900/40 text-purple-700 dark:text-purple-300"
            >
              <Map className="h-3 w-3 mr-1" />
              Map
            </Button>
            <Button
              size="sm"
              variant="ghost"
              onClick={() => handleSelectionAction('explain')}
              className="h-8 px-3 text-xs bg-emerald-50 hover:bg-emerald-100 dark:bg-emerald-900/20 dark:hover:bg-emerald-900/40 text-emerald-700 dark:text-emerald-300"
            >
              <Sparkles className="h-3 w-3 mr-1" />
              Ask Luna
            </Button>
            <Button
              size="sm"
              variant="ghost"
              onClick={() => handleSelectionAction('quote')}
              className="h-8 px-3 text-xs bg-orange-50 hover:bg-orange-100 dark:bg-orange-900/20 dark:hover:bg-orange-900/40 text-orange-700 dark:text-orange-300"
            >
              <Quote className="h-3 w-3 mr-1" />
              Quote
            </Button>
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
          <div className="grid grid-cols-1 gap-3">
            {notes.map((note) => (
              <Card key={note.id} className="p-4 bg-white/80 dark:bg-slate-800/80 backdrop-blur-sm hover:shadow-md transition-shadow cursor-pointer group">
                <div className="flex items-start justify-between mb-3">
                  <h5 
                    className="font-medium text-sm text-slate-900 dark:text-slate-100 cursor-pointer hover:text-blue-600 dark:hover:text-blue-400 transition-colors"
                    onClick={() => openNote(note)}
                  >
                    {note.title}
                  </h5>
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
                <p className="text-xs text-slate-600 dark:text-slate-400 line-clamp-3 mb-3">
                  {note.content}
                </p>
                <div className="flex items-center justify-between text-xs text-slate-500 dark:text-slate-400">
                  <span>{new Date(note.updated_at).toLocaleDateString()}</span>
                  <div className="flex items-center gap-2">
                    {note.source && (
                      <Badge variant="secondary" className="text-xs">From: {note.source}</Badge>
                    )}
                    <Badge variant="secondary" className="text-xs">
                      {note.id === notes.find(n => n.id === note.id)?.id ? 'Auto-generated' : 'Manual'}
                    </Badge>
                  </div>
                </div>
              </Card>
            ))}
          </div>
          
          <Button 
            variant="outline" 
            size="sm" 
            className="w-full justify-start text-slate-600 dark:text-slate-400"
            onClick={createNewNote}
          >
            <Plus className="h-4 w-4 mr-2" />
            Add New Note
          </Button>
        </div>
      );
    }

    // Note Editor View
    return (
      <div className="h-full min-h-[600px] flex flex-col">
        {/* Editor Header - Fixed height */}
        <div className="flex-shrink-0 flex items-center justify-between pb-3 border-b border-slate-200 dark:border-slate-700 mb-4">
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
                  onClick={saveNote}
                  disabled={!noteTitle.trim() || !noteContent.trim() || isSaving}
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

        {/* Top Section - Title and Toolbar - About 25% */}
        <div className="flex-shrink-0 space-y-3 mb-4">
          {/* Title Input */}
          <div>
            <Input
              value={noteTitle}
              onChange={(e) => setNoteTitle(e.target.value)}
              placeholder="Note title..."
              disabled={!isEditingNote}
              className="text-lg font-semibold border-none px-0 bg-transparent focus:ring-0 focus:border-none placeholder:text-slate-400"
            />
          </div>


                {/* Headings */}
                <Select onValueChange={(value) => formatText('heading', value)}>
                  <SelectTrigger className="w-20 h-8 text-xs">
                    <SelectValue placeholder="H" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="h1">
                      <div className="flex items-center gap-2">
                        <Heading1 className="h-3 w-3" />
                        <span>H1</span>
                      </div>
                    </SelectItem>
                    <SelectItem value="h2">
                      <div className="flex items-center gap-2">
                        <Heading2 className="h-3 w-3" />
                        <span>H2</span>
                      </div>
                    </SelectItem>
                    <SelectItem value="h3">
                      <div className="flex items-center gap-2">
                        <Heading3 className="h-3 w-3" />
                        <span>H3</span>
                      </div>
                    </SelectItem>
                  </SelectContent>
                </Select>

                <div className="w-px h-6 bg-slate-300 dark:bg-slate-600 mx-1" />

                {/* Text Formatting */}
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => formatText('bold')}
                  className="h-8 w-8 p-0 text-slate-600 dark:text-slate-400 hover:bg-slate-200 dark:hover:bg-slate-700"
                  title="Bold"
                >
                  <Bold className="h-4 w-4" />
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => formatText('italic')}
                  className="h-8 w-8 p-0 text-slate-600 dark:text-slate-400 hover:bg-slate-200 dark:hover:bg-slate-700"
                  title="Italic"
                >
                  <Italic className="h-4 w-4" />
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => formatText('underline')}
                  className="h-8 w-8 p-0 text-slate-600 dark:text-slate-400 hover:bg-slate-200 dark:hover:bg-slate-700"
                  title="Underline"
                >
                  <Underline className="h-4 w-4" />
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => formatText('strikethrough')}
                  className="h-8 w-8 p-0 text-slate-600 dark:text-slate-400 hover:bg-slate-200 dark:hover:bg-slate-700"
                  title="Strikethrough"
                >
                  <Strikethrough className="h-4 w-4" />
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => formatText('highlight')}
                  className="h-8 w-8 p-0 text-slate-600 dark:text-slate-400 hover:bg-slate-200 dark:hover:bg-slate-700"
                  title="Highlight"
                >
                  <Highlighter className="h-4 w-4" />
                </Button>

                <div className="w-px h-6 bg-slate-300 dark:bg-slate-600 mx-1" />

                {/* Lists */}
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => formatText('bulletList')}
                  className="h-8 w-8 p-0 text-slate-600 dark:text-slate-400 hover:bg-slate-200 dark:hover:bg-slate-700"
                  title="Bullet List"
                >
                  <List className="h-4 w-4" />
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => formatText('numberedList')}
                  className="h-8 w-8 p-0 text-slate-600 dark:text-slate-400 hover:bg-slate-200 dark:hover:bg-slate-700"
                  title="Numbered List"
                >
                  <ListOrdered className="h-4 w-4" />
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => formatText('checkList')}
                  className="h-8 w-8 p-0 text-slate-600 dark:text-slate-400 hover:bg-slate-200 dark:hover:bg-slate-700"
                  title="Check List"
                >
                  <CheckSquare className="h-4 w-4" />
                </Button>

                <div className="w-px h-6 bg-slate-300 dark:bg-slate-600 mx-1" />

                {/* Alignment */}
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => formatText('alignLeft')}
                  className="h-8 w-8 p-0 text-slate-600 dark:text-slate-400 hover:bg-slate-200 dark:hover:bg-slate-700"
                  title="Align Left"
                >
                  <AlignLeft className="h-4 w-4" />
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => formatText('alignCenter')}
                  className="h-8 w-8 p-0 text-slate-600 dark:text-slate-400 hover:bg-slate-200 dark:hover:bg-slate-700"
                  title="Align Center"
                >
                  <AlignCenter className="h-4 w-4" />
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => formatText('alignRight')}
                  className="h-8 w-8 p-0 text-slate-600 dark:text-slate-400 hover:bg-slate-200 dark:hover:bg-slate-700"
                  title="Align Right"
                >
                  <AlignRight className="h-4 w-4" />
                </Button>
              </div>

              {/* Secondary Formatting Row */}
              <div className="flex items-center gap-1 p-2 bg-slate-50 dark:bg-slate-800/50 rounded-lg border border-slate-200 dark:border-slate-700">
                {/* Code & Quote */}
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => formatText('code')}
                  className="h-8 w-8 p-0 text-slate-600 dark:text-slate-400 hover:bg-slate-200 dark:hover:bg-slate-700"
                  title="Inline Code"
                >
                  <Code className="h-4 w-4" />
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => formatText('codeBlock')}
                  className="h-8 px-2 text-slate-600 dark:text-slate-400 hover:bg-slate-200 dark:hover:bg-slate-700"
                  title="Code Block"
                >
                  <Hash className="h-4 w-4 mr-1" />
                  <span className="text-xs">Code</span>
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => formatText('quote')}
                  className="h-8 w-8 p-0 text-slate-600 dark:text-slate-400 hover:bg-slate-200 dark:hover:bg-slate-700"
                  title="Quote"
                >
                  <Quote className="h-4 w-4" />
                </Button>

                <div className="w-px h-6 bg-slate-300 dark:bg-slate-600 mx-1" />

                {/* Media & Embeds */}
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => formatText('image')}
                  className="h-8 w-8 p-0 text-slate-600 dark:text-slate-400 hover:bg-slate-200 dark:hover:bg-slate-700"
                  title="Insert Image"
                >
                  <Image className="h-4 w-4" />
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => formatText('video')}
                  className="h-8 w-8 p-0 text-slate-600 dark:text-slate-400 hover:bg-slate-200 dark:hover:bg-slate-700"
                  title="Insert Video"
                >
                  <Video className="h-4 w-4" />
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => formatText('audio')}
                  className="h-8 w-8 p-0 text-slate-600 dark:text-slate-400 hover:bg-slate-200 dark:hover:bg-slate-700"
                  title="Insert Audio"
                >
                  <FileAudio className="h-4 w-4" />
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => formatText('file')}
                  className="h-8 w-8 p-0 text-slate-600 dark:text-slate-400 hover:bg-slate-200 dark:hover:bg-slate-700"
                  title="Attach File"
                >
                  <Paperclip className="h-4 w-4" />
                </Button>

                <div className="w-px h-6 bg-slate-300 dark:bg-slate-600 mx-1" />

                {/* Advanced */}
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => formatText('table')}
                  className="h-8 w-8 p-0 text-slate-600 dark:text-slate-400 hover:bg-slate-200 dark:hover:bg-slate-700"
                  title="Insert Table"
                >
                  <Table className="h-4 w-4" />
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => formatText('link')}
                  className="h-8 w-8 p-0 text-slate-600 dark:text-slate-400 hover:bg-slate-200 dark:hover:bg-slate-700"
                  title="Insert Link"
                >
                  <Link className="h-4 w-4" />
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => formatText('emoji')}
                  className="h-8 w-8 p-0 text-slate-600 dark:text-slate-400 hover:bg-slate-200 dark:hover:bg-slate-700"
                  title="Insert Emoji"
                >
                  <Smile className="h-4 w-4" />
                </Button>
              </div>
            </div>
          )}
        </div>

                  {/* Content Editor - About 75% of remaining height */}
          <div className="flex-1 min-h-[400px] relative" ref={noteEditorRef}>
            {/* Premium Rich Text Toolbar */}
            {isEditingNote && editor && (
              <div className="sticky top-0 z-20 bg-background border-b border-[#E0E0E0] dark:border-[#333333] p-3 mb-4 rounded-t-lg shadow-sm">
                <div className="flex flex-wrap items-center gap-1">
                  {/* Text Formatting */}
                  <div className="flex items-center gap-1 border-r border-gray-200 dark:border-gray-700 pr-3 mr-3">
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => editor.chain().focus().toggleBold().run()}
                      className={editor.isActive('bold') ? 'bg-blue-100 text-blue-700 dark:bg-blue-900 dark:text-blue-300' : 'hover:bg-gray-100 dark:hover:bg-gray-800'}
                      title="Bold (Ctrl+B)"
                    >
                      <Bold className="h-4 w-4" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => editor.chain().focus().toggleItalic().run()}
                      className={editor.isActive('italic') ? 'bg-blue-100 text-blue-700 dark:bg-blue-900 dark:text-blue-300' : 'hover:bg-gray-100 dark:hover:bg-gray-800'}
                      title="Italic (Ctrl+I)"
                    >
                      <Italic className="h-4 w-4" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => editor.chain().focus().toggleUnderline().run()}
                      className={editor.isActive('underline') ? 'bg-blue-100 text-blue-700 dark:bg-blue-900 dark:text-blue-300' : 'hover:bg-gray-100 dark:hover:bg-gray-800'}
                      title="Underline (Ctrl+U)"
                    >
                      <Underline className="h-4 w-4" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => editor.chain().focus().toggleStrike().run()}
                      className={editor.isActive('strike') ? 'bg-blue-100 text-blue-700 dark:bg-blue-900 dark:text-blue-300' : 'hover:bg-gray-100 dark:hover:bg-gray-800'}
                      title="Strikethrough"
                    >
                      <Strikethrough className="h-4 w-4" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => editor.chain().focus().toggleHighlight().run()}
                      className={editor.isActive('highlight') ? 'bg-yellow-100 text-yellow-700 dark:bg-yellow-900 dark:text-yellow-300' : 'hover:bg-gray-100 dark:hover:bg-gray-800'}
                      title="Highlight"
                    >
                      <Palette className="h-4 w-4" />
                    </Button>
                  </div>

                  {/* Headings */}
                  <div className="flex items-center gap-1 border-r border-gray-200 dark:border-gray-700 pr-3 mr-3">
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => editor.chain().focus().toggleHeading({ level: 1 }).run()}
                      className={editor.isActive('heading', { level: 1 }) ? 'bg-purple-100 text-purple-700 dark:bg-purple-900 dark:text-purple-300' : 'hover:bg-gray-100 dark:hover:bg-gray-800'}
                      title="Heading 1"
                    >
                      H1
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => editor.chain().focus().toggleHeading({ level: 2 }).run()}
                      className={editor.isActive('heading', { level: 2 }) ? 'bg-purple-100 text-purple-700 dark:bg-purple-900 dark:text-purple-300' : 'hover:bg-gray-100 dark:hover:bg-gray-800'}
                      title="Heading 2"
                    >
                      H2
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => editor.chain().focus().toggleHeading({ level: 3 }).run()}
                      className={editor.isActive('heading', { level: 3 }) ? 'bg-purple-100 text-purple-700 dark:bg-purple-900 dark:text-purple-300' : 'hover:bg-gray-100 dark:hover:bg-gray-800'}
                      title="Heading 3"
                    >
                      H3
                    </Button>
                  </div>

                  {/* Lists & Tasks */}
                  <div className="flex items-center gap-1 border-r border-gray-200 dark:border-gray-700 pr-3 mr-3">
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => editor.chain().focus().toggleBulletList().run()}
                      className={editor.isActive('bulletList') ? 'bg-green-100 text-green-700 dark:bg-green-900 dark:text-green-300' : 'hover:bg-gray-100 dark:hover:bg-gray-800'}
                      title="Bullet List"
                    >
                      <List className="h-4 w-4" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => editor.chain().focus().toggleOrderedList().run()}
                      className={editor.isActive('orderedList') ? 'bg-green-100 text-green-700 dark:bg-green-900 dark:text-green-300' : 'hover:bg-gray-100 dark:hover:bg-gray-800'}
                      title="Numbered List"
                    >
                      <ListOrdered className="h-4 w-4" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => editor.chain().focus().toggleTaskList().run()}
                      className={editor.isActive('taskList') ? 'bg-green-100 text-green-700 dark:bg-green-900 dark:text-green-300' : 'hover:bg-gray-100 dark:hover:bg-gray-800'}
                      title="Task List"
                    >
                      <CheckSquare className="h-4 w-4" />
                    </Button>
                  </div>

                  {/* Alignment */}
                  <div className="flex items-center gap-1 border-r border-gray-200 dark:border-gray-700 pr-3 mr-3">
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => editor.chain().focus().setTextAlign('left').run()}
                      className={editor.isActive({ textAlign: 'left' }) ? 'bg-orange-100 text-orange-700 dark:bg-orange-900 dark:text-orange-300' : 'hover:bg-gray-100 dark:hover:bg-gray-800'}
                      title="Align Left"
                    >
                      <AlignLeft className="h-4 w-4" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => editor.chain().focus().setTextAlign('center').run()}
                      className={editor.isActive({ textAlign: 'center' }) ? 'bg-orange-100 text-orange-700 dark:bg-orange-900 dark:text-orange-300' : 'hover:bg-gray-100 dark:hover:bg-gray-800'}
                      title="Align Center"
                    >
                      <AlignCenter className="h-4 w-4" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => editor.chain().focus().setTextAlign('right').run()}
                      className={editor.isActive({ textAlign: 'right' }) ? 'bg-orange-100 text-orange-700 dark:bg-orange-900 dark:text-orange-300' : 'hover:bg-gray-100 dark:hover:bg-gray-800'}
                      title="Align Right"
                    >
                      <AlignRight className="h-4 w-4" />
                    </Button>
                  </div>

                  {/* Advanced Features */}
                  <div className="flex items-center gap-1 border-r border-gray-200 dark:border-gray-700 pr-3 mr-3">
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => editor.chain().focus().toggleBlockquote().run()}
                      className={editor.isActive('blockquote') ? 'bg-indigo-100 text-indigo-700 dark:bg-indigo-900 dark:text-indigo-300' : 'hover:bg-gray-100 dark:hover:bg-gray-800'}
                      title="Quote"
                    >
                      <Quote className="h-4 w-4" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => editor.chain().focus().toggleCodeBlock().run()}
                      className={editor.isActive('codeBlock') ? 'bg-gray-200 text-gray-800 dark:bg-gray-700 dark:text-gray-200' : 'hover:bg-gray-100 dark:hover:bg-gray-800'}
                      title="Code Block"
                    >
                      <Code className="h-4 w-4" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => {
                        const url = window.prompt('Enter image URL:');
                        if (url) {
                          editor.chain().focus().setImage({ src: url }).run();
                        }
                      }}
                      title="Insert Image"
                      className="hover:bg-gray-100 dark:hover:bg-gray-800"
                    >
                      <Image className="h-4 w-4" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => {
                        const url = window.prompt('Enter URL:');
                        if (url) {
                          editor.chain().focus().setLink({ href: url }).run();
                        }
                      }}
                      className={editor.isActive('link') ? 'bg-blue-100 text-blue-700 dark:bg-blue-900 dark:text-blue-300' : 'hover:bg-gray-100 dark:hover:bg-gray-800'}
                      title="Add Link"
                    >
                      <Link className="h-4 w-4" />
                    </Button>
                  </div>

                  {/* Table */}
                  <div className="flex items-center gap-1">
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => editor.chain().focus().insertTable({ rows: 3, cols: 3, withHeaderRow: true }).run()}
                      title="Insert Table"
                      className="hover:bg-gray-100 dark:hover:bg-gray-800"
                    >
                      <Table className="h-4 w-4" />
                    </Button>
                  </div>
                </div>

                {/* Character Count */}
                {editor.storage.characterCount && (
                  <div className="mt-2 text-xs text-gray-500 dark:text-gray-400 flex justify-between">
                    <span>
                      {editor.storage.characterCount.characters()}/10000 characters
                    </span>
                    <span>
                      {editor.storage.characterCount.words()} words
                    </span>
                  </div>
                )}
              </div>
            )}

            <div className="relative">
              <EditorContent 
                editor={editor}
                className="h-full w-full min-h-[400px] border-none bg-transparent focus-within:ring-2 focus-within:ring-blue-500 focus-within:ring-opacity-50 rounded-lg transition-all duration-200"
              />
              
              {/* Floating Action Button for AI Features */}
              {isEditingNote && editor && (
                <div className="absolute bottom-4 right-4 flex flex-col gap-2">
                  <Button
                    size="sm"
                    variant="outline"
                    className="shadow-lg bg-white/90 backdrop-blur-sm hover:bg-white border-gray-200 hover:border-blue-300 transition-all duration-200"
                    onClick={() => {
                      // AI enhancement placeholder
                      const selectedText = editor.state.doc.textBetween(
                        editor.state.selection.from,
                        editor.state.selection.to,
                        ' '
                      );
                      if (selectedText) {
                        console.log('Enhance with AI:', selectedText);
                      }
                    }}
                    title="Enhance with AI"
                  >
                    <Brain className="h-4 w-4 mr-1" />
                    AI
                  </Button>
                </div>
              )}
            </div>
            


        {/* Note Text Selection Actions */}
        {showNoteActions && noteSelection && typeof document !== 'undefined' && createPortal(
          <div
            className="fixed z-50 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg shadow-xl p-2 flex flex-wrap gap-1"
            style={{
              left: `${noteSelection.x}px`,
              top: `${noteSelection.y}px`,
              transform: 'translateX(-50%)',
              minWidth: '280px',
              maxWidth: '320px'
            }}
          >
               <Button
                 size="sm"
                 variant="ghost"
                 onClick={() => handleNoteAction('enhance')}
                 className="h-7 px-2 text-xs bg-emerald-50 hover:bg-emerald-100 dark:bg-emerald-900/20 dark:hover:bg-emerald-900/40 text-emerald-700 dark:text-emerald-300 flex-shrink-0"
               >
                 <Wand2 className="h-3 w-3 mr-1" />
                 Enhance
               </Button>
               <Button
                 size="sm"
                 variant="ghost"
                 onClick={() => handleNoteAction('summarize')}
                 className="h-7 px-2 text-xs bg-blue-50 hover:bg-blue-100 dark:bg-blue-900/20 dark:hover:bg-blue-900/40 text-blue-700 dark:text-blue-300 flex-shrink-0"
               >
                 <Target className="h-3 w-3 mr-1" />
                 Summarize
               </Button>
               <Button
                 size="sm"
                 variant="ghost"
                 onClick={() => handleNoteAction('expand')}
                 className="h-7 px-2 text-xs bg-purple-50 hover:bg-purple-100 dark:bg-purple-900/20 dark:hover:bg-purple-900/40 text-purple-700 dark:text-purple-300 flex-shrink-0"
               >
                 <Plus className="h-3 w-3 mr-1" />
                 Expand
               </Button>
               <Button
                 size="sm"
                 variant="ghost"
                 onClick={() => handleNoteAction('format')}
                 className="h-7 px-2 text-xs bg-orange-50 hover:bg-orange-100 dark:bg-orange-900/20 dark:hover:bg-orange-900/40 text-orange-700 dark:text-orange-300 flex-shrink-0"
               >
                 <Type className="h-3 w-3 mr-1" />
                 Format
               </Button>
             </div>,
             document.body
           )}
        </div>
      </div>
    );
  };

  const renderToolContent = () => {
    switch (activeToolTab) {
      case 'chat':
        return (
          <div className="space-y-4">
            <div className="text-center py-12">
              <div className="p-6 rounded-2xl bg-gradient-to-br from-blue-50 to-purple-50 dark:from-blue-950/20 dark:to-purple-950/20 mb-6 inline-block">
                <MessageSquare className="h-12 w-12 text-blue-500 dark:text-blue-400 mx-auto" />
              </div>
              <h3 className="text-lg font-semibold mb-4 text-slate-900 dark:text-slate-100">
                Chat with Luna AI
              </h3>
              <p className="text-slate-600 dark:text-slate-400 mb-6 max-w-md mx-auto leading-relaxed">
                Luna is your AI study companion. She can help explain concepts, summarize content, create study materials, and answer questions about your sources.
              </p>
              <div className="flex flex-col gap-3 max-w-sm mx-auto">
                <Button variant="outline" size="sm" className="justify-start text-slate-600 dark:text-slate-400">
                  <Sparkles className="h-4 w-4 mr-2" />
                  Explain this concept
                </Button>
                <Button variant="outline" size="sm" className="justify-start text-slate-600 dark:text-slate-400">
                  <Target className="h-4 w-4 mr-2" />
                  Summarize key points
                </Button>
                <Button variant="outline" size="sm" className="justify-start text-slate-600 dark:text-slate-400">
                  <CheckSquare className="h-4 w-4 mr-2" />
                  Create practice questions
                </Button>
              </div>
            </div>
          </div>
        );

      case 'notes':
        return renderNoteTakingInterface();

      case 'mindmaps':
        return (
          <div className="space-y-4">
            <Card className="p-4 bg-white/80 dark:bg-slate-800/80 backdrop-blur-sm">
              <div className="flex items-center justify-between mb-3">
                <h5 className="font-medium text-sm text-slate-900 dark:text-slate-100">React Ecosystem</h5>
                <Badge variant="secondary" className="text-xs bg-purple-100 dark:bg-purple-900 text-purple-700 dark:text-purple-300">
                  12 nodes
                </Badge>
              </div>
              <div className="bg-gradient-to-br from-purple-50 to-blue-50 dark:from-purple-950/20 dark:to-blue-950/20 rounded-lg p-6 mb-3">
                <div className="flex items-center justify-center text-slate-500 dark:text-slate-400">
                  <Map className="h-8 w-8 mb-2" />
                </div>
                <p className="text-xs text-center text-slate-600 dark:text-slate-400">Mind map preview</p>
              </div>
              <div className="flex items-center justify-between text-xs text-slate-500 dark:text-slate-400">
                <span>3 hours ago</span>
                <Button variant="ghost" size="sm" className="h-6 px-2 text-xs">
                  <Eye className="h-3 w-3 mr-1" />
                  View
                </Button>
              </div>
            </Card>
            
            <Button variant="outline" size="sm" className="w-full justify-start text-slate-600 dark:text-slate-400">
              <Plus className="h-4 w-4 mr-2" />
              Generate Mind Map
            </Button>
          </div>
        );



      case 'audio':
        return (
          <div className="space-y-4">
            <Card className="p-4 bg-white/80 dark:bg-slate-800/80 backdrop-blur-sm">
              <div className="flex items-center justify-between mb-3">
                <h5 className="font-medium text-sm text-slate-900 dark:text-slate-100">Audio Summary</h5>
                <Badge variant="secondary" className="text-xs bg-orange-100 dark:bg-orange-900 text-orange-700 dark:text-orange-300">
                  Ready
                </Badge>
              </div>
              <div className="bg-gradient-to-br from-orange-50 to-red-50 dark:from-orange-950/20 dark:to-red-950/20 rounded-lg p-6 mb-3">
                <div className="flex items-center justify-center text-slate-500 dark:text-slate-400">
                  <Headphones className="h-8 w-8 mb-2" />
                </div>
                <p className="text-xs text-center text-slate-600 dark:text-slate-400">React Hooks Overview - 5 min</p>
              </div>
              <div className="flex items-center gap-2">
                <Button size="sm" variant="outline" className="flex-1">
                  <Play className="h-3 w-3 mr-2" />
                  Play
                </Button>
                <Button size="sm" variant="outline">
                  <Download className="h-3 w-3" />
                </Button>
              </div>
            </Card>
            
            <Button variant="outline" size="sm" className="w-full justify-start text-slate-600 dark:text-slate-400">
              <Plus className="h-4 w-4 mr-2" />
              Generate Audio Summary
            </Button>
          </div>
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
    <div className="h-full flex flex-col bg-gradient-to-br from-slate-50 via-white to-slate-50 dark:from-slate-950 dark:via-slate-900 dark:to-slate-950">
      
      {/* Sophisticated Header */}
      <div className="flex-shrink-0 border-b bg-white/80 dark:bg-slate-900/80 backdrop-blur-xl sticky top-0 z-50 shadow-sm">
        <div className="flex items-center justify-between p-6">
          <div className="flex items-center gap-6">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-xl bg-gradient-to-br from-blue-500 to-purple-600 shadow-lg">
                <Sparkles className="h-5 w-5 text-white" />
              </div>
              <div>
                <h1 className="text-xl font-semibold bg-gradient-to-r from-slate-900 to-slate-600 dark:from-slate-100 dark:to-slate-400 bg-clip-text text-transparent">
                  AI Study Space
                </h1>
                <p className="text-xs text-slate-500 dark:text-slate-400">Intelligent learning workspace</p>
              </div>
            </div>

            {/* Course/Space Selector */}
            <div className="flex items-center gap-3">
              <Select 
                value={selectedCourse?.id || selectedSpace?.id || ''} 
                onValueChange={(value) => {
                  const course = courses.find(c => c.id === value);
                  const space = studySpaces.find(s => s.id === value);
                  
                  if (course) {
                    setSelectedCourse(course);
                    setSelectedSpace(null);
                  } else if (space) {
                    setSelectedSpace(space);
                    setSelectedCourse(null);
                  }
                }}
              >
                <SelectTrigger className="w-64 bg-white/50 dark:bg-slate-800/50 border-slate-200 dark:border-slate-700">
                  <SelectValue placeholder="Select a course or space" />
                </SelectTrigger>
                <SelectContent>
                  <div className="p-2">
                    <div className="flex items-center gap-2 px-2 py-1 text-xs font-medium text-slate-500 dark:text-slate-400 uppercase tracking-wide">
                      <GraduationCap className="h-3 w-3" />
                      Active Courses
                    </div>
                    {courses.map((course) => (
                      <SelectItem key={course.id} value={course.id} className="pl-6">
                        <div className="flex items-center gap-3">
                          <div className={cn("w-2 h-2 rounded-full", course.color)} />
                          <div>
                            <div className="font-medium">{course.name}</div>
                            <div className="text-xs text-slate-500">{course.progress}% complete</div>
                          </div>
                        </div>
                      </SelectItem>
                    ))}
                  </div>
                  
                  <div className="border-t">
                    <div className="p-2">
                      <div className="flex items-center gap-2 px-2 py-1 text-xs font-medium text-slate-500 dark:text-slate-400 uppercase tracking-wide">
                        <Library className="h-3 w-3" />
                        Custom Spaces
                      </div>
                      {studySpaces.map((space) => (
                        <SelectItem key={space.id} value={space.id} className="pl-6">
                          <div className="flex items-center gap-3">
                            <div className={cn("w-2 h-2 rounded-full", space.color)} />
                            <div>
                              <div className="font-medium">{space.name}</div>
                              <div className="text-xs text-slate-500">{space.type === 'custom' ? 'Personal' : 'Course'}</div>
                            </div>
                          </div>
                        </SelectItem>
                      ))}
                      
                      <Dialog open={showCreateSpace} onOpenChange={setShowCreateSpace}>
                        <DialogTrigger asChild>
                          <Button variant="ghost" size="sm" className="w-full justify-start mt-2 text-slate-600 dark:text-slate-400">
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
            <Button variant="ghost" size="sm" className="text-slate-600 dark:text-slate-400">
              <Settings className="h-4 w-4" />
            </Button>
            <Button variant="ghost" size="sm" className="text-slate-600 dark:text-slate-400">
              <MoreHorizontal className="h-4 w-4" />
            </Button>
          </div>
        </div>
      </div>

      {/* Main Workspace - Two Panel Layout */}
      <div className="flex-1 min-h-0 overflow-hidden">
        {expandedPanel === 'none' ? (
          <ResizablePanelGroup direction="horizontal" className="h-full min-h-0">
            
            {/* LEFT PANEL - Sources & Content */}
            <ResizablePanel defaultSize={50} minSize={30} maxSize={70}>
              <div className="h-full min-h-0 flex flex-col bg-white/50 dark:bg-slate-900/50 border-r border-slate-200/60 dark:border-slate-700/60">
                
                {/* Sources Header with Multi-Select Dropdown */}
                <div className="flex-shrink-0 p-4 border-b border-slate-200/60 dark:border-slate-700/60 bg-white/80 dark:bg-slate-900/80">
                  <div className="flex items-center justify-between mb-4">
                    <h3 className="font-semibold text-slate-900 dark:text-slate-100">Sources</h3>
                    {renderExpandButton('sources')}
                  </div>
                  
                  {/* Multi-Select Sources Dropdown */}
                  <Popover open={sourceDropdownOpen} onOpenChange={setSourceDropdownOpen}>
                    <PopoverTrigger asChild>
                      <Button
                        variant="outline"
                        role="combobox"
                        aria-expanded={sourceDropdownOpen}
                        className="w-full justify-between bg-white/60 dark:bg-slate-800/60 border-slate-200 dark:border-slate-700"
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
                      <div className="p-3 border-b border-slate-200 dark:border-slate-700">
                        <div className="relative">
                          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-slate-400" />
                          <Input
                            placeholder="Search sources..."
                            value={searchQuery}
                            onChange={(e) => setSearchQuery(e.target.value)}
                            className="pl-10 h-9 bg-white dark:bg-slate-800 border-slate-200 dark:border-slate-700"
                          />
                        </div>
                      </div>
                      
                      <div className="max-h-80 overflow-y-auto">
                        {/* Select All Option */}
                        <div className="p-3 border-b border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/50">
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
                              className="text-sm font-medium text-slate-900 dark:text-slate-100 cursor-pointer"
                            >
                              Select All ({contentItems.length})
                            </label>
                          </div>
                        </div>
                        
                        {/* Individual Sources */}
                        {contentItems
                          .filter(item => 
                            item.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
                            item.description?.toLowerCase().includes(searchQuery.toLowerCase())
                          )
                          .map((item) => (
                            <div key={item.id} className="p-3 hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors">
                              <div className="flex items-start space-x-3">
                                <Checkbox
                                  id={item.id}
                                  checked={selectedSources.has(item.id)}
                                  onCheckedChange={(checked) => {
                                    const newSelected = new Set(selectedSources);
                                    if (checked) {
                                      newSelected.add(item.id);
                                    } else {
                                      newSelected.delete(item.id);
                                    }
                                    setSelectedSources(newSelected);
                                  }}
                                />
                                <div className="flex-1 min-w-0">
                                  <div className="flex items-center gap-2 mb-1">
                                    <div className="p-1 rounded bg-slate-100 dark:bg-slate-700">
                                      {item.type === 'lesson' && <BookOpen className="h-3 w-3 text-blue-500" />}
                                      {item.type === 'document' && <FileText className="h-3 w-3 text-emerald-500" />}
                                      {item.type === 'video' && <Video className="h-3 w-3 text-red-500" />}
                                      {item.type === 'assignment' && <Target className="h-3 w-3 text-orange-500" />}
                                      {item.type === 'resource' && <Library className="h-3 w-3 text-purple-500" />}
                                    </div>
                                    <label
                                      htmlFor={item.id}
                                      className="text-sm font-medium text-slate-900 dark:text-slate-100 cursor-pointer truncate"
                                    >
                                      {item.title}
                                    </label>
                                  </div>
                                  {item.description && (
                                    <p className="text-xs text-slate-600 dark:text-slate-400 line-clamp-2 ml-5">
                                      {item.description}
                                    </p>
                                  )}
                                  {item.duration && (
                                    <div className="flex items-center gap-1 mt-1 ml-5">
                                      <Clock className="h-3 w-3 text-slate-400" />
                                      <span className="text-xs text-slate-500 dark:text-slate-400">{item.duration}</span>
                                    </div>
                                  )}
                                </div>
                              </div>
                            </div>
                          ))}
                      </div>
                    </PopoverContent>
                  </Popover>
                </div>

                {/* Full Content Display Area */}
                <div className="flex-1 min-h-0 overflow-hidden">
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
              <div className="study-tools-panel h-full min-h-0 flex flex-col bg-white/50 dark:bg-slate-900/50 border-l border-slate-200/60 dark:border-slate-700/60 relative">
                
                {/* Tools Header with Tabs */}
                <div className="flex-shrink-0 p-4 border-b border-slate-200/60 dark:border-slate-700/60 bg-white/80 dark:bg-slate-900/80">
                  <div className="flex items-center justify-between mb-4">
                    <h3 className="font-semibold text-slate-900 dark:text-slate-100">Study Tools</h3>
                    {renderExpandButton('tools')}
                  </div>
                  
                  <Tabs value={activeToolTab} onValueChange={setActiveToolTab} className="w-full">
                    <TabsList className="grid w-full grid-cols-5 bg-slate-100 dark:bg-slate-800">
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

                {/* Tool Content Area - Takes remaining space above Luna chat */}
                <div className="flex-1 min-h-0 overflow-hidden">
                  <ScrollArea className="h-full">
                    <div className="p-4 pb-6">
                      {renderToolContent()}
                    </div>
                  </ScrollArea>
                </div>

                {/* Luna Chat - Always Pinned at Bottom of Panel */}
                <div className="flex-shrink-0 border-t border-slate-200/60 dark:border-slate-700/60 bg-gradient-to-r from-slate-50 to-white dark:from-slate-900 dark:to-slate-800 p-4">
                  <div className="flex items-center gap-2 mb-3">
                    <div className="p-1.5 rounded-lg bg-gradient-to-br from-blue-500 to-purple-600 shadow-sm">
                      <Sparkles className="h-3 w-3 text-white" />
                    </div>
                    <span className="text-xs font-medium text-slate-700 dark:text-slate-300">Luna AI</span>
                    <Badge variant="secondary" className="text-xs bg-gradient-to-r from-blue-100 to-purple-100 dark:from-blue-900 dark:to-purple-900 text-blue-700 dark:text-blue-300">
                      Context Aware
                    </Badge>
                  </div>
                  
                  <div className="flex gap-2">
                    <div className="flex-1 relative">
                      <Input
                        placeholder={
                          selectedSources.size > 0
                            ? `Ask Luna about ${selectedSources.size === 1 ? 'this source' : `${selectedSources.size} sources`}...`
                            : "Select sources to start chatting with Luna..."
                        }
                        value={chatMessage}
                        onChange={(e) => setChatMessage(e.target.value)}
                        onKeyPress={(e) => e.key === 'Enter' && handleSendMessage()}
                        disabled={selectedSources.size === 0 || isGenerating}
                        className="pr-10 text-xs bg-white dark:bg-slate-800 border-slate-200 dark:border-slate-700 focus:ring-2 focus:ring-blue-500 dark:focus:ring-blue-400"
                      />
                      <Button
                        size="sm"
                        variant="ghost"
                        className="absolute right-1 top-1/2 transform -translate-y-1/2 h-6 w-6 p-0 text-slate-400 hover:text-slate-600 dark:hover:text-slate-300"
                      >
                        <Mic className="h-3 w-3" />
                      </Button>
                    </div>
                    <Button 
                      onClick={handleSendMessage}
                      disabled={!chatMessage.trim() || selectedSources.size === 0 || isGenerating}
                      size="sm"
                      className="px-3 bg-gradient-to-r from-blue-500 to-purple-600 text-white shadow-md hover:shadow-lg transition-all"
                    >
                      {isGenerating ? (
                        <div className="h-3 w-3 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                      ) : (
                        <Send className="h-3 w-3" />
                      )}
                    </Button>
                  </div>
                  
                  {isGenerating && (
                    <div className="mt-3 p-3 bg-white/60 dark:bg-slate-800/60 rounded-lg border border-slate-200 dark:border-slate-700">
                      <div className="flex items-center gap-2 mb-2">
                        <div className="p-1 rounded bg-gradient-to-br from-blue-500 to-purple-600">
                          <Sparkles className="h-2 w-2 text-white animate-pulse" />
                        </div>
                        <span className="text-xs font-medium text-slate-700 dark:text-slate-300">Luna is thinking...</span>
                      </div>
                      <div className="space-y-1">
                        <div className="h-2 bg-slate-200 dark:bg-slate-700 rounded animate-pulse"></div>
                        <div className="h-2 bg-slate-200 dark:bg-slate-700 rounded animate-pulse w-3/4"></div>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            </ResizablePanel>

          </ResizablePanelGroup>
        ) : (
          // Full Screen Panel Views
          <div className="h-full bg-white dark:bg-slate-900 relative">
            <div className="absolute top-4 right-4 z-50">
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setExpandedPanel('none')}
                className="h-8 w-8 p-0 text-slate-400 hover:text-slate-600 dark:hover:text-slate-300 bg-white/80 dark:bg-slate-800/80 backdrop-blur-sm shadow-lg rounded-lg"
              >
                <X className="h-4 w-4" />
              </Button>
            </div>

            {expandedPanel === 'sources' && (
              <div className="h-full p-8">
                <h2 className="text-2xl font-bold mb-6 text-slate-900 dark:text-slate-100">Source Content</h2>
                <div className="h-full max-w-5xl mx-auto">
                  {renderSourceContent()}
                </div>
              </div>
            )}

            {expandedPanel === 'tools' && (
              <div className="h-full p-8">
                <h2 className="text-2xl font-bold mb-6 text-slate-900 dark:text-slate-100">Study Tools</h2>
                <div className="max-w-5xl mx-auto">
                  <Tabs value={activeToolTab} onValueChange={setActiveToolTab} className="w-full">
                    <TabsList className="grid w-full grid-cols-5 bg-slate-100 dark:bg-slate-800 mb-8">
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
                    
                    <div className="grid grid-cols-2 gap-6">
                      <div className="col-span-2">
                        {renderToolContent()}
                      </div>
                    </div>
                  </Tabs>
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
} 