import React, { useState, useEffect, useCallback } from 'react';
import { LessonSection } from '@/types/lesson';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';

import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import ReactMarkdown from 'react-markdown';

// Enhanced Tiptap imports for premium notion-like editor
import { useEditor, EditorContent } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';
import { Table } from '@tiptap/extension-table';
import TableRow from '@tiptap/extension-table-row';
import TableCell from '@tiptap/extension-table-cell';
import TableHeader from '@tiptap/extension-table-header';
import { Image } from '@tiptap/extension-image';
import { Mention } from '@tiptap/extension-mention';
import { TaskList, TaskItem } from '@tiptap/extension-list';
import { Color, TextStyle } from '@tiptap/extension-text-style';
import { Placeholder } from '@tiptap/extensions';
import { Typography } from '@tiptap/extension-typography';
import { Highlight } from '@tiptap/extension-highlight';
import { Superscript } from '@tiptap/extension-superscript';
import { Subscript } from '@tiptap/extension-subscript';
import { TextAlign } from '@tiptap/extension-text-align';
import { Mathematics } from '@tiptap/extension-mathematics';
import { UniqueID } from '@tiptap/extension-unique-id';
import { Emoji, gitHubEmojis } from '@tiptap/extension-emoji';
import Link from '@tiptap/extension-link';
import CodeBlockLowlight from '@tiptap/extension-code-block-lowlight';
import { createLowlight } from 'lowlight';
import javascript from 'highlight.js/lib/languages/javascript';
import { Node, mergeAttributes } from '@tiptap/core';
import { ReactNodeViewRenderer } from '@tiptap/react';

// Import our custom extensions
import { VideoNode } from '@/components/tiptap-node/video-node/video-node-extension';
import { ImageUploadNode } from '@/components/tiptap-node/image-upload-node/image-upload-node-extension';
import { HorizontalRule } from '@/components/tiptap-node/horizontal-rule-node/horizontal-rule-node-extension';

// Import notion-like UI components
import { SlashDropdownMenu } from '@/components/tiptap-ui/slash-dropdown-menu';
import { EmojiDropdownMenu } from '@/components/tiptap-ui/emoji-dropdown-menu';
import { MentionDropdownMenu } from '@/components/tiptap-ui/mention-dropdown-menu';

// Utils and services
import { mediaUploadService, FILE_SIZE_LIMITS } from '@/lib/media-upload-service';

// Icons
import { 
  Save, Edit, Eye, ChevronDown, ChevronRight, 
  Type, FileText, Lightbulb, Users, Target, 
  AlertTriangle, ArrowRight, CheckCircle,
  Bold, Italic, Code, List, ListOrdered,
  Quote, Minus, Image as ImageIcon, Video,
  Link as LinkIcon, Table as TableIcon,
  Palette, AlignLeft, AlignCenter, AlignRight,
  MoreVertical, Upload, Youtube, BookOpen,
  Brain, Sparkles
} from 'lucide-react';

// Import styles
import '@/components/tiptap-templates/notion-like/notion-like-editor.scss';

interface LessonSectionEditorProps {
  section: LessonSection;
  onSave: (updatedSection: Partial<LessonSection>) => Promise<void>;
}

// YouTube URL validation and ID extraction
const extractYouTubeId = (url: string): string | null => {
  const patterns = [
    /(?:youtube\.com\/watch\?v=|youtu\.be\/|youtube\.com\/embed\/)([^&\n?#]+)/,
    /youtube\.com\/v\/([^&\n?#]+)/,
    /youtube\.com\/embed\/([^&\n?#]+)/
  ];
  
  for (const pattern of patterns) {
    const match = url.match(pattern);
    if (match) return match[1];
  }
  return null;
};

// Check if a URL is a YouTube URL
const isYouTubeUrl = (url: string): boolean => {
  return /(?:youtube\.com|youtu\.be)/.test(url);
};

// Simple YouTube iframe extension
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

  addCommands() {
    return {
      insertYouTubeEmbed: (options: { src: string; title?: string }) => ({ commands }: any) => {
        return commands.insertContent({
          type: this.name,
          attrs: options,
        });
      },
    } as any;
  },
});

// Enhanced Media Upload Handler
const handleEnhancedImageUpload = async (file: File): Promise<string> => {
  try {
    const result = await mediaUploadService.uploadMedia(file, {
      onProgress: (event) => {
        console.log(`Upload progress: ${event.progress}% - ${event.status}`);
      }
    });
    return result.url;
  } catch (error) {
    console.error('Image upload failed:', error);
    throw error;
  }
};

// Enhanced Video Upload Handler
const handleVideoUpload = async (file: File): Promise<string> => {
  try {
    const result = await mediaUploadService.uploadMedia(file, {
      onProgress: (event) => {
        console.log(`Video upload progress: ${event.progress}% - ${event.status}`);
      }
    });
    return result.url;
  } catch (error) {
    console.error('Video upload failed:', error);
    throw error;
  }
};

// Simple Floating Toolbar Component
const NotionFloatingToolbar = ({ editor }: { editor: any }) => {
  const [shouldShow, setShouldShow] = useState(false);
  const [position, setPosition] = useState({ top: 0, left: 0 });

  useEffect(() => {
    if (!editor) return;

    const handleSelectionUpdate = () => {
      const { state } = editor;
      const { selection } = state;
      const hasSelection = !selection.empty;
      
      if (hasSelection) {
        // Get selection coordinates
        const { from, to } = selection;
        const start = editor.view.coordsAtPos(from);
        const end = editor.view.coordsAtPos(to);
        
        setPosition({
          top: start.top - 60,
          left: (start.left + end.left) / 2
        });
      }
      
      setShouldShow(hasSelection);
    };

    handleSelectionUpdate();
    editor.on('selectionUpdate', handleSelectionUpdate);

    return () => {
      editor.off('selectionUpdate', handleSelectionUpdate);
    };
  }, [editor]);

  if (!shouldShow || !editor) return null;

  const insertYouTubeVideo = () => {
    const url = window.prompt('Enter YouTube URL:');
    if (url) {
      const videoId = extractYouTubeId(url);
      if (videoId) {
        const title = window.prompt('Enter video title (optional):') || '';
        // Use the YouTube iframe extension
        const embedSrc = `https://www.youtube.com/embed/${videoId}?rel=0&modestbranding=1&showinfo=0`;
        (editor.chain().focus() as any).insertYouTubeEmbed({ 
          src: embedSrc, 
          title: title || 'YouTube video' 
        }).run();
      } else {
        alert('Invalid YouTube URL. Please enter a valid YouTube video URL.');
      }
    }
  };

  const uploadImage = () => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = 'image/*';
    input.onchange = async (e) => {
      const file = (e.target as HTMLInputElement).files?.[0];
      if (file) {
        try {
          const url = await handleEnhancedImageUpload(file);
          editor.chain().focus().setImage({ src: url, alt: file.name }).run();
        } catch (error) {
          alert('Failed to upload image. Please try again.');
        }
      }
    };
    input.click();
  };

  const uploadVideo = () => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = 'video/*';
    input.onchange = async (e) => {
      const file = (e.target as HTMLInputElement).files?.[0];
      if (file) {
        try {
          const url = await handleVideoUpload(file);
          editor.chain().focus().setVideo({ src: url }).run();
        } catch (error) {
          alert('Failed to upload video. Please try again.');
        }
      }
    };
    input.click();
  };

  return (
    <div 
      className="fixed z-50 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg shadow-lg p-2 flex items-center gap-1"
      style={{ 
        top: position.top,
        left: position.left,
        transform: 'translateX(-50%)'
      }}
    >
      <Button
        variant="ghost"
        size="sm"
        onClick={() => editor.chain().focus().toggleBold().run()}
        className={`h-8 w-8 p-0 hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors ${editor.isActive('bold') ? 'bg-gray-100 dark:bg-gray-700' : ''}`}
      >
        <Bold className="h-4 w-4" />
      </Button>
      <Button
        variant="ghost"
        size="sm"
        onClick={() => editor.chain().focus().toggleItalic().run()}
        className={`h-8 w-8 p-0 hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors ${editor.isActive('italic') ? 'bg-gray-100 dark:bg-gray-700' : ''}`}
      >
        <Italic className="h-4 w-4" />
      </Button>
      <Button
        variant="ghost"
        size="sm"
        onClick={() => editor.chain().focus().toggleCode().run()}
        className={`h-8 w-8 p-0 hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors ${editor.isActive('code') ? 'bg-gray-100 dark:bg-gray-700' : ''}`}
      >
        <Code className="h-4 w-4" />
      </Button>
      <div className="w-px h-6 bg-gray-200 dark:bg-gray-700 mx-1" />
      
      {/* Media buttons */}
      <Button
        variant="ghost"
        size="sm"
        onClick={uploadImage}
        className="h-8 w-8 p-0 hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
        title="Upload Image"
      >
        <ImageIcon className="h-4 w-4" />
      </Button>
      <Button
        variant="ghost"
        size="sm"
        onClick={uploadVideo}
        className="h-8 w-8 p-0 hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
        title="Upload Video"
      >
        <Video className="h-4 w-4" />
      </Button>
      <Button
        variant="ghost"
        size="sm"
        onClick={insertYouTubeVideo}
        className="h-8 w-8 p-0 hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
        title="Embed YouTube Video"
      >
        <Youtube className="h-4 w-4" />
      </Button>
      
      <div className="w-px h-6 bg-gray-200 dark:bg-gray-700 mx-1" />
      <Button
        variant="ghost"
        size="sm"
        onClick={() => {
          const url = window.prompt('Enter link URL:');
          if (url) {
            editor.chain().focus().setLink({ href: url }).run();
          }
        }}
        className="h-8 w-8 p-0 hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
      >
        <LinkIcon className="h-4 w-4" />
      </Button>
    </div>
  );
};

// Main Notion-like Editor Component
const NotionLikeEditor = ({ 
  content, 
  onChange, 
  placeholder = "Start writing your lesson content..."
}: {
  content: string;
  onChange: (content: string) => void;
  placeholder?: string;
}) => {
  const lowlightInstance = createLowlight();
  lowlightInstance.register('javascript', javascript);

  const editor = useEditor({
    immediatelyRender: false,
    shouldRerenderOnTransaction: false,
    onUpdate: ({ editor }) => {
      onChange(editor.getHTML());
    },
    editorProps: {
      attributes: {
        class: "notion-like-editor prose dark:prose-invert max-w-none focus:outline-none min-h-[300px] p-6",
      },
      handlePaste: (view: any, event: ClipboardEvent, slice: any) => {
        // Handle pasted text to detect YouTube URLs
        const clipboardData = event.clipboardData;
        if (clipboardData) {
          const text = clipboardData.getData('text/plain');
          if (isYouTubeUrl(text)) {
            const videoId = extractYouTubeId(text);
            if (videoId) {
              // Prevent default paste and insert YouTube embed instead
              event.preventDefault();
              const title = `YouTube Video`;
              // Insert YouTube embed using the extension
              setTimeout(() => {
                if (editor) {
                  const embedSrc = `https://www.youtube.com/embed/${videoId}?rel=0&modestbranding=1&showinfo=0`;
                  (editor.chain().focus() as any).insertYouTubeEmbed({ 
                    src: embedSrc, 
                    title 
                  }).run();
                }
              }, 0);
              return true;
            }
          }
        }
        return false; // Allow default paste behavior for non-YouTube content
      },
    },
    extensions: [
      StarterKit.configure({
        horizontalRule: false,
        dropcursor: {
          width: 2,
        },
        link: { openOnClick: false },
      }),
      HorizontalRule,
      TextAlign.configure({ types: ["heading", "paragraph"] }),
      Placeholder.configure({
        placeholder,
        emptyNodeClass: "is-empty with-slash",
      }),
      Mention,
      Emoji.configure({
        emojis: gitHubEmojis.filter(
          (emoji) => !emoji.name.includes("regional")
        ),
        forceFallbackImages: true,
      }),
      Mathematics,
      Superscript,
      Subscript,
      Color,
      TextStyle,
      TaskList,
      TaskItem.configure({ nested: true }),
      Highlight.configure({ multicolor: true }),
      Image.configure({
        inline: false,
        allowBase64: false,
      }),
      ImageUploadNode.configure({
        accept: "image/*",
        maxSize: FILE_SIZE_LIMITS.IMAGE,
        limit: 5,
        upload: handleEnhancedImageUpload,
        onError: (error) => console.error("Upload failed:", error),
      }),
      VideoNode.configure({
        inline: false,
        allowBase64: false,
      }),
      YouTubeIframeExtension, // Simple YouTube iframe extension
      Table.configure({ resizable: true }),
      TableRow,
      TableHeader,
      TableCell,
      Link.configure({
        openOnClick: false,
        autolink: true,
      }),
      CodeBlockLowlight.configure({
        lowlight: lowlightInstance,
      }),
      UniqueID,
      Typography,
    ],
    content,
  }, []);

  // Update editor content when prop changes
  useEffect(() => {
    if (editor && content !== editor.getHTML()) {
      console.log('Setting editor content:', content);
      editor.commands.setContent(content);
    }
  }, [content, editor]);

  if (!editor) {
    return (
      <div className="flex items-center justify-center min-h-[300px] text-gray-400">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-gray-900 dark:border-gray-100"></div>
      </div>
    );
  }

  return (
    <div className="notion-like-editor-wrapper bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-xl overflow-hidden shadow-sm">
      <EditorContent
        editor={editor}
        className="notion-like-editor-content"
      />
      <NotionFloatingToolbar editor={editor} />
      <SlashDropdownMenu editor={editor} />
      <EmojiDropdownMenu editor={editor} />
      <MentionDropdownMenu editor={editor} />
    </div>
  );
};

// Rich Content Preview Component for the main editor content
const RichContentPreview = ({ content }: { content: string }) => {
  const previewEditor = useEditor({
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
             YouTubeIframeExtension, // Include YouTube extension for preview
      Link.configure({ openOnClick: true, autolink: true }),
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

  useEffect(() => {
    if (previewEditor && content !== previewEditor.getHTML()) {
      console.log('Setting preview editor content:', content);
      previewEditor.commands.setContent(content);
    }
  }, [content, previewEditor]);

  if (!previewEditor) {
    return (
      <div className="prose prose-slate dark:prose-invert max-w-none">
        <ReactMarkdown>{content}</ReactMarkdown>
      </div>
    );
  }

  return (
    <div className="prose prose-slate dark:prose-invert max-w-none">
      <EditorContent editor={previewEditor} />
    </div>
  );
};

// Enhanced Student Preview Component with Rich Content Support
const StudentViewPreview = ({ contentData, title }: { contentData: any; title: string }) => {
  // Build the full structured content like the student course player expects
  const structuredContent = {
    introduction: contentData.introduction,
    expertTeachingContent: {
      conceptIntroduction: contentData.conceptIntroduction,
      detailedExplanation: contentData.detailedExplanation,
      expertInsights: contentData.expertInsights.split('\n').filter((item: string) => item.trim()),
      practicalExamples: contentData.practicalExamples.split('\n\n').filter((item: string) => item.trim()).map((item: string) => {
        const parts = item.split(': ');
        if (parts.length >= 2) {
          return {
            title: parts[0],
            walkthrough: parts.slice(1).join(': '),
            keyTakeaways: ['Key insight from this example']
          };
        }
        return { title: item, walkthrough: '', keyTakeaways: [] };
      }),
      commonMisconceptions: contentData.commonMisconceptions.split('\n\n').filter((item: string) => item.trim()).map((item: string) => {
        const parts = item.split(' - ');
        if (parts.length >= 2) {
          return {
            misconception: parts[0],
            correction: parts.slice(1).join(' - '),
            prevention: 'Focus on understanding the correct principles'
          };
        }
        return { misconception: item, correction: '', prevention: '' };
      }),
      realWorldConnections: contentData.realWorldConnections.split('\n').filter((item: string) => item.trim()),
    },
    expertSummary: contentData.expertSummary,
    checkForUnderstanding: contentData.checkForUnderstanding.split('\n').filter((item: string) => item.trim()),
    bridgeToNext: contentData.bridgeToNext
  };

  return (
    <div className="bg-white dark:bg-gray-900 rounded-xl border border-gray-200 dark:border-gray-800 overflow-hidden">
      {/* Student view header */}
      <div className="bg-gradient-to-r from-gray-50 to-gray-100 dark:from-gray-800 dark:to-gray-900 px-6 py-4 border-b border-gray-200 dark:border-gray-800">
        <h2 className="text-xl font-semibold text-gray-900 dark:text-gray-100">{title}</h2>
        <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">Student View - Full Lesson Section</p>
      </div>
      
      {/* Use the actual LessonContentRenderer component */}
      <div className="p-6">
        <div className="space-y-6">
          {/* Introduction */}
          {structuredContent.introduction && (
            <div className="bg-blue-50 dark:bg-blue-900/20 rounded-xl p-6 border border-blue-200 dark:border-blue-700/50">
              <h4 className="text-lg font-semibold text-blue-900 dark:text-blue-100 mb-3 flex items-center gap-2">
                <BookOpen className="h-5 w-5" />
                Introduction
              </h4>
              <div className="prose prose-slate dark:prose-invert max-w-none text-blue-800 dark:text-blue-200">
                <ReactMarkdown>{structuredContent.introduction}</ReactMarkdown>
              </div>
            </div>
          )}

          {/* Concept Introduction */}
          {structuredContent.expertTeachingContent?.conceptIntroduction && (
            <div className="bg-purple-50 dark:bg-purple-900/20 rounded-xl p-6 border border-purple-200 dark:border-purple-700/50">
              <h4 className="text-lg font-semibold text-purple-900 dark:text-purple-100 mb-3 flex items-center gap-2">
                <Sparkles className="h-5 w-5" />
                Concept Introduction
              </h4>
              <div className="prose prose-slate dark:prose-invert max-w-none text-purple-800 dark:text-purple-200">
                <ReactMarkdown>{structuredContent.expertTeachingContent.conceptIntroduction}</ReactMarkdown>
              </div>
            </div>
          )}

          {/* Main Content - Rich Editor Content */}
          {structuredContent.expertTeachingContent?.detailedExplanation && (
            <div className="bg-gray-50 dark:bg-gray-900/20 rounded-xl p-6 border border-gray-200 dark:border-gray-700/50">
              <h4 className="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-3 flex items-center gap-2">
                <Brain className="h-5 w-5" />
                Deep Dive
              </h4>
              <RichContentPreview content={structuredContent.expertTeachingContent.detailedExplanation} />
            </div>
          )}

          {/* Practical Examples */}
          {structuredContent.expertTeachingContent?.practicalExamples && structuredContent.expertTeachingContent.practicalExamples.length > 0 && (
            <div className="bg-green-50 dark:bg-green-900/20 rounded-xl p-6 border border-green-200 dark:border-green-700/50">
              <h4 className="text-lg font-semibold text-green-900 dark:text-green-100 mb-4 flex items-center gap-2">
                <Target className="h-5 w-5" />
                Practical Examples
              </h4>
              <div className="space-y-4">
                {structuredContent.expertTeachingContent.practicalExamples.map((example: any, index: number) => (
                  <div key={index} className="bg-white dark:bg-gray-800 rounded-lg p-4 border border-green-200 dark:border-green-700/30">
                    <h5 className="font-semibold text-green-800 dark:text-green-200 mb-2">{example.title}</h5>
                    {example.walkthrough && (
                      <div className="prose prose-slate dark:prose-invert max-w-none text-green-700 dark:text-green-300 mb-3">
                        <ReactMarkdown>{example.walkthrough}</ReactMarkdown>
                      </div>
                    )}
                    {example.keyTakeaways && example.keyTakeaways.length > 0 && (
                      <div className="mt-3">
                        <h6 className="font-medium text-green-800 dark:text-green-200 mb-2">Key Takeaways:</h6>
                        <ul className="list-disc list-inside text-green-700 dark:text-green-300 space-y-1">
                          {example.keyTakeaways.map((takeaway: string, takeawayIndex: number) => (
                            <li key={takeawayIndex}>{takeaway}</li>
                          ))}
                        </ul>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Expert Insights */}
          {structuredContent.expertTeachingContent?.expertInsights && structuredContent.expertTeachingContent.expertInsights.length > 0 && (
            <div className="bg-indigo-50 dark:bg-indigo-900/20 rounded-xl p-6 border border-indigo-200 dark:border-indigo-700/50">
              <h4 className="text-lg font-semibold text-indigo-900 dark:text-indigo-100 mb-3 flex items-center gap-2">
                <Brain className="h-5 w-5" />
                Expert Insights
              </h4>
              <ul className="space-y-2">
                {structuredContent.expertTeachingContent.expertInsights.map((insight: string, index: number) => (
                  <li key={index} className="text-indigo-800 dark:text-indigo-200 flex items-start gap-2">
                    <span className="text-indigo-500 dark:text-indigo-400 mt-1">•</span>
                    <span>{insight}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}

          {/* Expert Summary */}
          {structuredContent.expertSummary && (
            <div className="bg-slate-50 dark:bg-slate-900/20 rounded-xl p-6 border border-slate-200 dark:border-slate-700/50">
              <h4 className="text-lg font-semibold text-slate-900 dark:text-slate-100 mb-3 flex items-center gap-2">
                <CheckCircle className="h-5 w-5" />
                Summary
              </h4>
              <div className="prose prose-slate dark:prose-invert max-w-none">
                <ReactMarkdown>{structuredContent.expertSummary}</ReactMarkdown>
              </div>
            </div>
          )}

          {/* Check for Understanding */}
          {structuredContent.checkForUnderstanding && structuredContent.checkForUnderstanding.length > 0 && (
            <div className="bg-teal-50 dark:bg-teal-900/20 rounded-xl p-6 border border-teal-200 dark:border-teal-700/50">
              <h4 className="text-lg font-semibold text-teal-900 dark:text-teal-100 mb-3 flex items-center gap-2">
                <CheckCircle className="h-5 w-5" />
                Check Your Understanding
              </h4>
              <ul className="space-y-2">
                {structuredContent.checkForUnderstanding.map((question: string, index: number) => (
                  <li key={index} className="text-teal-800 dark:text-teal-200 flex items-start gap-2">
                    <span className="text-teal-500 dark:text-teal-400 mt-1">{index + 1}.</span>
                    <span>{question}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

// Enhanced Content Editor for additional sections with media support
const ContentEditor = ({ 
  label, 
  value, 
  onChange, 
  placeholder,
  isRequired = false,
  allowMedia = false
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  placeholder: string;
  isRequired?: boolean;
  allowMedia?: boolean;
}) => {
  const [isOpen, setIsOpen] = useState(isRequired && !value);

  const handleMediaUpload = async (type: 'image' | 'video') => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = type === 'image' ? 'image/*' : 'video/*';
    input.onchange = async (e) => {
      const file = (e.target as HTMLInputElement).files?.[0];
      if (file) {
        try {
          const result = await mediaUploadService.uploadMedia(file);
          const mediaTag = type === 'image' 
            ? `![${file.name}](${result.url})`
            : `[Video: ${file.name}](${result.url})`;
          onChange(value + '\n\n' + mediaTag);
        } catch (error) {
          alert(`Failed to upload ${type}. Please try again.`);
        }
      }
    };
    input.click();
  };

  return (
    <Collapsible open={isOpen} onOpenChange={setIsOpen}>
      <CollapsibleTrigger asChild>
        <Button
          variant="ghost"
          className="w-full justify-between p-4 h-auto border border-gray-200 dark:border-gray-800 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-900/50 transition-colors"
        >
          <div className="flex items-center gap-3">
            <div className="text-left">
              <div className="font-medium text-gray-900 dark:text-gray-100">{label}</div>
              {value && (
                <div className="text-sm text-gray-500 mt-1 truncate max-w-md">
                  {value.substring(0, 60)}...
                </div>
              )}
            </div>
          </div>
          <div className="flex items-center gap-2">
            {value && <div className="w-2 h-2 bg-green-500 rounded-full" />}
            {isOpen ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
          </div>
        </Button>
      </CollapsibleTrigger>
      <CollapsibleContent className="mt-2">
        <div className="border border-gray-200 dark:border-gray-800 rounded-lg overflow-hidden">
          <Textarea
            value={value}
            onChange={(e) => onChange(e.target.value)}
            placeholder={placeholder}
            className="min-h-[120px] border-0 resize-none focus:ring-0"
          />
          {allowMedia && (
            <div className="flex items-center gap-2 p-3 border-t border-gray-200 dark:border-gray-800 bg-gray-50 dark:bg-gray-900/50">
              <Button
                variant="ghost"
                size="sm"
                onClick={() => handleMediaUpload('image')}
                className="text-xs"
              >
                <ImageIcon className="h-3 w-3 mr-1" />
                Add Image
              </Button>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => handleMediaUpload('video')}
                className="text-xs"
              >
                <Video className="h-3 w-3 mr-1" />
                Add Video
              </Button>
            </div>
          )}
        </div>
      </CollapsibleContent>
    </Collapsible>
  );
};

const LessonSectionEditor: React.FC<LessonSectionEditorProps> = ({ section, onSave }) => {
  const [title, setTitle] = useState(section.title);

  const [isSaving, setIsSaving] = useState(false);
  const [lastSaved, setLastSaved] = useState<Date | null>(null);
  const [activeTab, setActiveTab] = useState<'edit' | 'preview'>('edit');

  // Enhanced content state
  const [contentData, setContentData] = useState(() => {
    if (section.content && typeof section.content === 'object') {
      return {
        introduction: section.content.introduction || '',
        conceptIntroduction: section.content.expertTeachingContent?.conceptIntroduction || '',
        detailedExplanation: section.content.expertTeachingContent?.detailedExplanation || '',
        expertInsights: section.content.expertTeachingContent?.expertInsights?.join('\n') || '',
        practicalExamples: section.content.expertTeachingContent?.practicalExamples?.map((ex: any) => 
          typeof ex === 'object' ? `${ex.title}: ${ex.walkthrough}` : ex
        ).join('\n\n') || '',
        commonMisconceptions: section.content.expertTeachingContent?.commonMisconceptions?.map((misc: any) =>
          typeof misc === 'object' ? `${misc.misconception} - ${misc.correction}` : misc
        ).join('\n\n') || '',
        realWorldConnections: section.content.expertTeachingContent?.realWorldConnections?.join('\n') || '',
        expertSummary: section.content.expertSummary || '',
        checkForUnderstanding: section.content.checkForUnderstanding?.join('\n') || '',
        bridgeToNext: section.content.bridgeToNext || ''
      };
    }
    return {
      introduction: '',
      conceptIntroduction: '',
      detailedExplanation: '',
      expertInsights: '',
      practicalExamples: '',
      commonMisconceptions: '',
      realWorldConnections: '',
      expertSummary: '',
      checkForUnderstanding: '',
      bridgeToNext: ''
    };
  });

  // Sync content when section changes
  useEffect(() => {
    if (section.id) {
      const newContent = {
        introduction: section.content?.introduction || '',
        conceptIntroduction: section.content?.expertTeachingContent?.conceptIntroduction || '',
        detailedExplanation: section.content?.expertTeachingContent?.detailedExplanation || '',
        expertInsights: section.content?.expertTeachingContent?.expertInsights?.join('\n') || '',
        practicalExamples: section.content?.expertTeachingContent?.practicalExamples?.map((ex: any) => 
          typeof ex === 'object' ? `${ex.title}: ${ex.walkthrough}` : ex
        ).join('\n\n') || '',
        commonMisconceptions: section.content?.expertTeachingContent?.commonMisconceptions?.map((misc: any) =>
          typeof misc === 'object' ? `${misc.misconception} - ${misc.correction}` : misc
        ).join('\n\n') || '',
        realWorldConnections: section.content?.expertTeachingContent?.realWorldConnections?.join('\n') || '',
        expertSummary: section.content?.expertSummary || '',
        checkForUnderstanding: section.content?.checkForUnderstanding?.join('\n') || '',
        bridgeToNext: section.content?.bridgeToNext || ''
      };
      
      setContentData(newContent);
      setTitle(section.title);

    }
  }, [section.id, section.content]);

  const updateContentField = (field: string, value: string) => {
    setContentData(prev => ({ ...prev, [field]: value }));
  };

  const buildStructuredContent = () => {
    return {
      introduction: contentData.introduction,
      expertTeachingContent: {
        conceptIntroduction: contentData.conceptIntroduction,
        detailedExplanation: contentData.detailedExplanation,
        expertInsights: contentData.expertInsights.split('\n').filter((item: string) => item.trim()),
        practicalExamples: contentData.practicalExamples.split('\n\n').filter((item: string) => item.trim()).map((item: string) => {
          const parts = item.split(': ');
          if (parts.length >= 2) {
            return {
              title: parts[0],
              walkthrough: parts.slice(1).join(': '),
              keyTakeaways: ['Key insight from this example']
            };
          }
          return item;
        }),
        commonMisconceptions: contentData.commonMisconceptions.split('\n\n').filter((item: string) => item.trim()).map((item: string) => {
          const parts = item.split(' - ');
          if (parts.length >= 2) {
            return {
              misconception: parts[0],
              correction: parts.slice(1).join(' - '),
              prevention: 'Focus on understanding the correct principles'
            };
          }
          return item;
        }),
        realWorldConnections: contentData.realWorldConnections.split('\n').filter((item: string) => item.trim()),
      },
      expertSummary: contentData.expertSummary,
      checkForUnderstanding: contentData.checkForUnderstanding.split('\n').filter((item: string) => item.trim()),
      bridgeToNext: contentData.bridgeToNext
    };
  };

  const handleSave = async () => {
    setIsSaving(true);
    
    try {
      const structuredContent = buildStructuredContent();
      
      const updatedData: Partial<LessonSection> = {
        id: section.id,
        title: title,
        content: structuredContent,
        section_type: 'core_concept',
      };
      
      await onSave(updatedData);
      setLastSaved(new Date());
    } catch (error) {
      console.error("Failed to save section:", error);
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="max-w-5xl mx-auto">
      {/* Clean, premium header */}
      <div className="flex items-center justify-between mb-8 pb-6 border-b border-gray-100 dark:border-gray-800">
        <div>
          <h1 className="text-3xl font-light text-gray-900 dark:text-gray-100">
            {section.title || "Untitled Section"}
          </h1>
          <p className="text-gray-500 mt-2">Lesson Section Editor</p>
          {lastSaved && (
            <p className="text-xs text-gray-400 mt-1">
              Last saved {lastSaved.toLocaleTimeString()}
            </p>
          )}
        </div>
        <Button
          onClick={handleSave}
          disabled={isSaving}
          className="bg-gray-900 hover:bg-gray-800 dark:bg-white dark:hover:bg-gray-100 dark:text-gray-900 px-6 py-2 rounded-lg transition-colors"
        >
          <Save className="h-4 w-4 mr-2" />
          {isSaving ? 'Saving...' : 'Save'}
        </Button>
      </div>

      {/* Basic info - cleaner layout */}
      <div className="mb-8">
        <div className="space-y-2">
          <label className="text-sm font-medium text-gray-700 dark:text-gray-300">
            Section Title
          </label>
          <Input
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="Enter section title"
            className="border-gray-200 dark:border-gray-700 rounded-lg"
          />
        </div>
      </div>

      {/* Clean tabs */}
      <Tabs value={activeTab} onValueChange={(value) => setActiveTab(value as 'edit' | 'preview')} className="w-full">
        <TabsList className="grid w-full grid-cols-2 mb-8 bg-gray-100 dark:bg-gray-800 p-1 rounded-xl">
          <TabsTrigger value="edit" className="flex items-center gap-2 rounded-lg data-[state=active]:bg-white dark:data-[state=active]:bg-gray-700 transition-colors">
            <Edit className="h-4 w-4" />
            Edit
          </TabsTrigger>
          <TabsTrigger value="preview" className="flex items-center gap-2 rounded-lg data-[state=active]:bg-white dark:data-[state=active]:bg-gray-700 transition-colors">
            <Eye className="h-4 w-4" />
            Preview
          </TabsTrigger>
        </TabsList>

        <TabsContent value="edit" className="space-y-6">
          {/* Main content editor - Notion-like experience with full media support */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100">Main Content</h3>
              <div className="text-sm text-gray-500">Type "/" for commands • Select text for formatting • Paste YouTube URLs directly</div>
            </div>
            <NotionLikeEditor
              content={contentData.detailedExplanation}
              onChange={(content) => updateContentField('detailedExplanation', content)}
              placeholder="Start writing your lesson content... Type '/' for commands, upload images/videos, or paste YouTube URLs directly"
            />
          </div>

          {/* Additional sections - with media support for key sections */}
          <div className="space-y-4">
            <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-4">Additional Sections</h3>
            
            <ContentEditor
              label="Introduction"
              value={contentData.introduction}
              onChange={(value) => updateContentField('introduction', value)}
              placeholder="Write an engaging introduction to hook students..."
              allowMedia={true}
            />

            <ContentEditor
              label="Key Concept"
              value={contentData.conceptIntroduction}
              onChange={(value) => updateContentField('conceptIntroduction', value)}
              placeholder="Introduce the main concept clearly..."
              allowMedia={true}
            />

            <ContentEditor
              label="Expert Insights"
              value={contentData.expertInsights}
              onChange={(value) => updateContentField('expertInsights', value)}
              placeholder="Share expert-level insights (one per line)..."
            />

            <ContentEditor
              label="Practical Examples"
              value={contentData.practicalExamples}
              onChange={(value) => updateContentField('practicalExamples', value)}
              placeholder="Provide real-world examples (separate with double line breaks)..."
              allowMedia={true}
            />

            <ContentEditor
              label="Common Misconceptions"
              value={contentData.commonMisconceptions}
              onChange={(value) => updateContentField('commonMisconceptions', value)}
              placeholder="Address common misconceptions (separate with double line breaks)..."
            />

            <ContentEditor
              label="Real-World Connections"
              value={contentData.realWorldConnections}
              onChange={(value) => updateContentField('realWorldConnections', value)}
              placeholder="Connect to real-world applications (one per line)..."
            />

            <ContentEditor
              label="Expert Summary"
              value={contentData.expertSummary}
              onChange={(value) => updateContentField('expertSummary', value)}
              placeholder="Provide a comprehensive summary..."
            />

            <ContentEditor
              label="Check for Understanding"
              value={contentData.checkForUnderstanding}
              onChange={(value) => updateContentField('checkForUnderstanding', value)}
              placeholder="Add questions to check understanding (one per line)..."
            />

            <ContentEditor
              label="Bridge to Next"
              value={contentData.bridgeToNext}
              onChange={(value) => updateContentField('bridgeToNext', value)}
              placeholder="Connect to the next lesson section..."
            />
          </div>
        </TabsContent>

        <TabsContent value="preview" className="space-y-6">
          <div className="bg-gray-50 dark:bg-gray-900/50 p-4 rounded-lg border border-gray-200 dark:border-gray-800">
            <div className="flex items-center gap-2 mb-2">
              <Eye className="h-5 w-5 text-gray-500" />
              <h3 className="font-medium text-gray-900 dark:text-gray-100">Student Preview</h3>
            </div>
            <p className="text-sm text-gray-600 dark:text-gray-400">
              This is how students will see your content in the course player, including all images, videos, and YouTube embeds.
            </p>
          </div>
          
          <StudentViewPreview 
            contentData={contentData} 
            title={title} 
          />
        </TabsContent>
      </Tabs>
    </div>
  );
};

export default LessonSectionEditor; 