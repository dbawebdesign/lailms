import React, { useState, useEffect, useCallback } from 'react';
import { LessonSection } from '@/types/lesson';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import ReactMarkdown from 'react-markdown';

// Enhanced Tiptap imports for premium editor
import { useEditor, EditorContent } from '@tiptap/react';
import { BubbleMenu } from '@tiptap/react/menus';
import StarterKit from '@tiptap/starter-kit';
import { Table } from '@tiptap/extension-table';
import TableRow from '@tiptap/extension-table-row';
import TableCell from '@tiptap/extension-table-cell';
import TableHeader from '@tiptap/extension-table-header';
import Image from '@tiptap/extension-image';
import Link from '@tiptap/extension-link';
import CodeBlockLowlight from '@tiptap/extension-code-block-lowlight';
import { createLowlight } from 'lowlight';
import javascript from 'highlight.js/lib/languages/javascript';
import Placeholder from '@tiptap/extension-placeholder';
import { TaskList, TaskItem } from '@tiptap/extension-list';
import { Color, TextStyle } from '@tiptap/extension-text-style';
import { Highlight } from '@tiptap/extension-highlight';
import { TextAlign } from '@tiptap/extension-text-align';
import { Mathematics } from '@tiptap/extension-mathematics';
import { Typography } from '@tiptap/extension-typography';

// Import our custom extensions
import { VideoNode } from '@/components/tiptap-node/video-node/video-node-extension';
import { ImageUploadNode } from '@/components/tiptap-node/image-upload-node/image-upload-node-extension';
import { HorizontalRule } from '@/components/tiptap-node/horizontal-rule-node/horizontal-rule-node-extension';

// Icons
import { 
  Save, Edit, Eye, ChevronDown, ChevronRight, 
  Type, FileText, Lightbulb, Users, Target, 
  AlertTriangle, ArrowRight, CheckCircle,
  Bold, Italic, Code, List, ListOrdered,
  Quote, Minus, Image as ImageIcon, Video,
  Link as LinkIcon, Table as TableIcon,
  Palette, AlignLeft, AlignCenter, AlignRight
} from 'lucide-react';

interface LessonSectionEditorProps {
  section: LessonSection;
  onSave: (updatedSection: Partial<LessonSection>) => Promise<void>;
}

// Premium Editor Toolbar Component
const EditorToolbar = ({ editor }: { editor: any }) => {
  if (!editor) return null;

  return (
    <div className="flex items-center gap-1 p-3 border-b border-gray-100 dark:border-gray-800 bg-gray-50/50 dark:bg-gray-900/50">
      {/* Text Formatting */}
      <div className="flex items-center gap-1">
        <Button
          variant="ghost"
          size="sm"
          onClick={() => editor.chain().focus().toggleBold().run()}
          className={`h-8 w-8 p-0 ${editor.isActive('bold') ? 'bg-gray-200 dark:bg-gray-700' : ''}`}
        >
          <Bold className="h-4 w-4" />
        </Button>
        <Button
          variant="ghost"
          size="sm"
          onClick={() => editor.chain().focus().toggleItalic().run()}
          className={`h-8 w-8 p-0 ${editor.isActive('italic') ? 'bg-gray-200 dark:bg-gray-700' : ''}`}
        >
          <Italic className="h-4 w-4" />
        </Button>
        <Button
          variant="ghost"
          size="sm"
          onClick={() => editor.chain().focus().toggleCode().run()}
          className={`h-8 w-8 p-0 ${editor.isActive('code') ? 'bg-gray-200 dark:bg-gray-700' : ''}`}
        >
          <Code className="h-4 w-4" />
        </Button>
      </div>

      <div className="w-px h-6 bg-gray-200 dark:bg-gray-700 mx-2" />

      {/* Lists */}
      <div className="flex items-center gap-1">
        <Button
          variant="ghost"
          size="sm"
          onClick={() => editor.chain().focus().toggleBulletList().run()}
          className={`h-8 w-8 p-0 ${editor.isActive('bulletList') ? 'bg-gray-200 dark:bg-gray-700' : ''}`}
        >
          <List className="h-4 w-4" />
        </Button>
        <Button
          variant="ghost"
          size="sm"
          onClick={() => editor.chain().focus().toggleOrderedList().run()}
          className={`h-8 w-8 p-0 ${editor.isActive('orderedList') ? 'bg-gray-200 dark:bg-gray-700' : ''}`}
        >
          <ListOrdered className="h-4 w-4" />
        </Button>
        <Button
          variant="ghost"
          size="sm"
          onClick={() => editor.chain().focus().toggleTaskList().run()}
          className={`h-8 w-8 p-0 ${editor.isActive('taskList') ? 'bg-gray-200 dark:bg-gray-700' : ''}`}
        >
          <CheckCircle className="h-4 w-4" />
        </Button>
      </div>

      <div className="w-px h-6 bg-gray-200 dark:bg-gray-700 mx-2" />

      {/* Media */}
      <div className="flex items-center gap-1">
        <Button
          variant="ghost"
          size="sm"
          onClick={() => {
            const url = window.prompt('Enter image URL:');
            if (url) {
              editor.chain().focus().setImage({ src: url }).run();
            }
          }}
          className="h-8 w-8 p-0"
        >
          <ImageIcon className="h-4 w-4" />
        </Button>
        <Button
          variant="ghost"
          size="sm"
          onClick={() => {
            const url = window.prompt('Enter video URL:');
            if (url) {
              editor.chain().focus().setVideo({ src: url }).run();
            }
          }}
          className="h-8 w-8 p-0"
        >
          <Video className="h-4 w-4" />
        </Button>
        <Button
          variant="ghost"
          size="sm"
          onClick={() => {
            const url = window.prompt('Enter link URL:');
            if (url) {
              editor.chain().focus().setLink({ href: url }).run();
            }
          }}
          className="h-8 w-8 p-0"
        >
          <LinkIcon className="h-4 w-4" />
        </Button>
      </div>

      <div className="w-px h-6 bg-gray-200 dark:bg-gray-700 mx-2" />

      {/* Blocks */}
      <div className="flex items-center gap-1">
        <Button
          variant="ghost"
          size="sm"
          onClick={() => editor.chain().focus().toggleBlockquote().run()}
          className={`h-8 w-8 p-0 ${editor.isActive('blockquote') ? 'bg-gray-200 dark:bg-gray-700' : ''}`}
        >
          <Quote className="h-4 w-4" />
        </Button>
        <Button
          variant="ghost"
          size="sm"
          onClick={() => editor.chain().focus().setHorizontalRule().run()}
          className="h-8 w-8 p-0"
        >
          <Minus className="h-4 w-4" />
        </Button>
        <Button
          variant="ghost"
          size="sm"
          onClick={() => editor.chain().focus().insertTable({ rows: 3, cols: 3, withHeaderRow: true }).run()}
          className="h-8 w-8 p-0"
        >
          <TableIcon className="h-4 w-4" />
        </Button>
      </div>
    </div>
  );
};

// Student Preview Component
const StudentViewPreview = ({ content, title }: { content: any; title: string }) => {
  const previewEditor = useEditor({
    extensions: [
      StarterKit,
      Table.configure({ resizable: true }),
      TableRow,
      TableHeader,
      TableCell,
      Image,
      Link.configure({ openOnClick: true, autolink: true }),
      VideoNode,
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

  return (
    <div className="bg-white dark:bg-gray-900 rounded-xl border border-gray-200 dark:border-gray-800 overflow-hidden">
      {/* Student view header */}
      <div className="bg-gradient-to-r from-blue-50 to-indigo-50 dark:from-blue-950/50 dark:to-indigo-950/50 px-6 py-4 border-b border-gray-200 dark:border-gray-800">
        <h2 className="text-xl font-semibold text-gray-900 dark:text-gray-100">{title}</h2>
        <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">Student View</p>
      </div>
      
      {/* Content */}
      <div className="p-6">
        <EditorContent 
          editor={previewEditor}
          className="prose dark:prose-invert max-w-none"
        />
      </div>
    </div>
  );
};

// Simple Content Editor for additional sections
const ContentEditor = ({ 
  label, 
  value, 
  onChange, 
  placeholder,
  isRequired = false
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  placeholder: string;
  isRequired?: boolean;
}) => {
  const [isOpen, setIsOpen] = useState(isRequired && !value);

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
        </div>
      </CollapsibleContent>
    </Collapsible>
  );
};

const LessonSectionEditor: React.FC<LessonSectionEditorProps> = ({ section, onSave }) => {
  const [title, setTitle] = useState(section.title);
  const [sectionType, setSectionType] = useState(section.section_type || 'text');
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

  const lowlightInstance = createLowlight();
  lowlightInstance.register('javascript', javascript);

  // Premium rich text editor with multimedia support
  const editor = useEditor({
    extensions: [
      StarterKit.configure({
        heading: { levels: [1, 2, 3] },
        codeBlock: false,
      }),
      Placeholder.configure({
        placeholder: 'Start writing your lesson content...',
        emptyNodeClass: 'is-empty',
      }),
      Table.configure({ resizable: true }),
      TableRow,
      TableHeader,
      TableCell,
      Image.configure({
        inline: false,
        allowBase64: false,
      }),
      ImageUploadNode.configure({
        accept: "image/*",
        maxSize: 5 * 1024 * 1024, // 5MB
        upload: async (file: File) => {
          // Implement your image upload logic here
          // For now, return a placeholder URL
          return URL.createObjectURL(file);
        },
      }),
      VideoNode,
      Link.configure({ 
        openOnClick: false, 
        autolink: true,
        protocols: ['http', 'https', 'mailto']
      }),
      CodeBlockLowlight.configure({ lowlight: lowlightInstance }),
      TaskList,
      TaskItem.configure({ nested: true }),
      Color,
      TextStyle,
      Highlight.configure({ multicolor: true }),
      TextAlign.configure({ types: ['heading', 'paragraph'] }),
      Mathematics,
      Typography,
      HorizontalRule,
    ],
    content: '',
    immediatelyRender: false,
    editorProps: {
      attributes: {
        class: 'prose dark:prose-invert max-w-none focus:outline-none min-h-[300px] p-4',
      },
    },
    onUpdate: ({ editor }) => {
      setContentData(prev => ({
        ...prev,
        detailedExplanation: editor.getHTML()
      }));
    },
  }, []);

  // Sync editor content when section changes
  useEffect(() => {
    if (editor && section.id) {
      const newContent = section.content?.expertTeachingContent?.detailedExplanation || '';
      if (editor.getHTML() !== newContent) {
        editor.commands.setContent(newContent);
      }
      
      // Update all content data
      setContentData({
        introduction: section.content?.introduction || '',
        conceptIntroduction: section.content?.expertTeachingContent?.conceptIntroduction || '',
        detailedExplanation: newContent,
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
      });
      
      setTitle(section.title);
      setSectionType(section.section_type || 'text');
    }
  }, [section.id, section.content, editor]);

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
        section_type: sectionType,
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

      {/* Basic info - cleaner grid */}
      <div className="grid grid-cols-2 gap-6 mb-8">
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
        <div className="space-y-2">
          <label className="text-sm font-medium text-gray-700 dark:text-gray-300">
            Section Type
          </label>
          <Select value={sectionType} onValueChange={setSectionType}>
            <SelectTrigger className="border-gray-200 dark:border-gray-700 rounded-lg">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="text">Text Content</SelectItem>
              <SelectItem value="introduction">Introduction</SelectItem>
              <SelectItem value="core_concept">Core Concept</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      {/* Clean tabs */}
      <Tabs value={activeTab} onValueChange={(value) => setActiveTab(value as 'edit' | 'preview')} className="w-full">
        <TabsList className="grid w-full grid-cols-2 mb-8 bg-gray-100 dark:bg-gray-800 p-1 rounded-xl">
          <TabsTrigger value="edit" className="flex items-center gap-2 rounded-lg">
            <Edit className="h-4 w-4" />
            Edit
          </TabsTrigger>
          <TabsTrigger value="preview" className="flex items-center gap-2 rounded-lg">
            <Eye className="h-4 w-4" />
            Preview
          </TabsTrigger>
        </TabsList>

        <TabsContent value="edit" className="space-y-6">
          {/* Main content editor - premium design */}
          <div className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-xl overflow-hidden shadow-sm">
            <div className="px-6 py-4 border-b border-gray-100 dark:border-gray-800 bg-gray-50/50 dark:bg-gray-900/50">
              <h3 className="font-semibold text-gray-900 dark:text-gray-100">Main Content</h3>
              <p className="text-sm text-gray-500 mt-1">Rich text editor with multimedia support</p>
            </div>
            <EditorToolbar editor={editor} />
            <EditorContent editor={editor} />
          </div>

          {/* Additional sections - simplified */}
          <div className="space-y-4">
            <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-4">Additional Sections</h3>
            
            <ContentEditor
              label="Introduction"
              value={contentData.introduction}
              onChange={(value) => updateContentField('introduction', value)}
              placeholder="Write an engaging introduction to hook students..."
            />

            <ContentEditor
              label="Key Concept"
              value={contentData.conceptIntroduction}
              onChange={(value) => updateContentField('conceptIntroduction', value)}
              placeholder="Introduce the main concept clearly..."
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
              This is how students will see your content in the course player.
            </p>
          </div>
          
          <StudentViewPreview 
            content={contentData.detailedExplanation} 
            title={title} 
          />
        </TabsContent>
      </Tabs>
    </div>
  );
};

export default LessonSectionEditor; 