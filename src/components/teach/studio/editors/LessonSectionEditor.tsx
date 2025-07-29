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

// Tiptap imports
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

// Icons
import { 
  Bold, Italic, Strikethrough, Code, Pilcrow, List, ListOrdered, Quote, Minus, 
  Image as ImageIcon, Link as LinkIcon, Columns, Trash2, Edit, Eye, Save,
  BookOpen, Brain, Target, Lightbulb, Sparkles, CheckCircle2, ArrowRight,
  AlertTriangle, Users, Zap, Globe, ChevronDown, ChevronRight, Plus, X,
  Settings, Layout, Type, FileText
} from 'lucide-react';

interface LessonSectionEditorProps {
  section: LessonSection;
  onSave: (updatedSection: Partial<LessonSection>) => Promise<void>;
}

// Enhanced Toolbar component with better organization
const EditorToolbar = ({ editor }: { editor: any | null }) => {
  const addImage = useCallback(() => {
    if (!editor) return;
    const url = window.prompt('Enter image URL');
    if (url) {
      editor.chain().focus().setImage({ src: url }).run();
    }
  }, [editor]);

  const setLink = useCallback(() => {
    if (!editor) return;
    const previousUrl = editor.getAttributes('link').href;
    const url = window.prompt('Enter URL', previousUrl);
    if (url === null) return;
    if (url === '') {
      editor.chain().focus().extendMarkRange('link').unsetLink().run();
      return;
    }
    editor.chain().focus().extendMarkRange('link').setLink({ href: url }).run();
  }, [editor]);

  if (!editor) {
    return null;
  }

  return (
    <div className="flex flex-wrap items-center gap-1 p-3 border border-input rounded-t-md bg-muted/30">
      {/* Text Formatting */}
      <div className="flex items-center gap-1 pr-2 border-r border-border">
        <Button variant="ghost" size="sm" onClick={() => editor.chain().focus().toggleBold().run()} disabled={!editor.can().chain().focus().toggleBold().run()} className={editor.isActive('bold') ? 'bg-accent' : ''}><Bold className="h-4 w-4" /></Button>
        <Button variant="ghost" size="sm" onClick={() => editor.chain().focus().toggleItalic().run()} disabled={!editor.can().chain().focus().toggleItalic().run()} className={editor.isActive('italic') ? 'bg-accent' : ''}><Italic className="h-4 w-4" /></Button>
        <Button variant="ghost" size="sm" onClick={() => editor.chain().focus().toggleStrike().run()} disabled={!editor.can().chain().focus().toggleStrike().run()} className={editor.isActive('strike') ? 'bg-accent' : ''}><Strikethrough className="h-4 w-4" /></Button>
        <Button variant="ghost" size="sm" onClick={() => editor.chain().focus().toggleCode().run()} disabled={!editor.can().chain().focus().toggleCode().run()} className={editor.isActive('code') ? 'bg-accent' : ''}><Code className="h-4 w-4" /></Button>
      </div>
      
      {/* Headings */}
      <div className="flex items-center gap-1 pr-2 border-r border-border">
        <Button variant="ghost" size="sm" onClick={() => editor.chain().focus().setParagraph().run()} className={editor.isActive('paragraph') ? 'bg-accent' : ''}><Pilcrow className="h-4 w-4" /></Button>
        <Button variant="ghost" size="sm" onClick={() => editor.chain().focus().toggleHeading({ level: 1 }).run()} className={editor.isActive('heading', { level: 1 }) ? 'bg-accent' : ''}>H1</Button>
        <Button variant="ghost" size="sm" onClick={() => editor.chain().focus().toggleHeading({ level: 2 }).run()} className={editor.isActive('heading', { level: 2 }) ? 'bg-accent' : ''}>H2</Button>
        <Button variant="ghost" size="sm" onClick={() => editor.chain().focus().toggleHeading({ level: 3 }).run()} className={editor.isActive('heading', { level: 3 }) ? 'bg-accent' : ''}>H3</Button>
      </div>
      
      {/* Lists & Blocks */}
      <div className="flex items-center gap-1 pr-2 border-r border-border">
        <Button variant="ghost" size="sm" onClick={() => editor.chain().focus().toggleBulletList().run()} className={editor.isActive('bulletList') ? 'bg-accent' : ''}><List className="h-4 w-4" /></Button>
        <Button variant="ghost" size="sm" onClick={() => editor.chain().focus().toggleOrderedList().run()} className={editor.isActive('orderedList') ? 'bg-accent' : ''}><ListOrdered className="h-4 w-4" /></Button>
        <Button variant="ghost" size="sm" onClick={() => editor.chain().focus().toggleBlockquote().run()} className={editor.isActive('blockquote') ? 'bg-accent' : ''}><Quote className="h-4 w-4" /></Button>
        <Button variant="ghost" size="sm" onClick={() => editor.chain().focus().setHorizontalRule().run()}><Minus className="h-4 w-4" /></Button>
      </div>
      
      {/* Media & Links */}
      <div className="flex items-center gap-1 pr-2 border-r border-border">
        <Button variant="ghost" size="sm" onClick={addImage}><ImageIcon className="h-4 w-4" /></Button>
        <Button variant="ghost" size="sm" onClick={setLink} disabled={editor.isActive('link')}><LinkIcon className="h-4 w-4" /></Button>
        <Button variant="ghost" size="sm" onClick={() => editor.chain().focus().toggleCodeBlock().run()} className={editor.isActive('codeBlock') ? 'bg-accent' : ''}>Code</Button>
      </div>

      {/* Table */}
      <div className="flex items-center gap-1">
        <Button variant="ghost" size="sm" onClick={() => editor.chain().focus().insertTable({ rows: 3, cols: 3, withHeaderRow: true }).run()}><Columns className="h-4 w-4" /></Button>
        {editor.can().deleteTable && <Button variant="ghost" size="sm" onClick={() => editor.chain().focus().deleteTable().run()}><Trash2 className="h-4 w-4" /></Button>}
      </div>
    </div>
  );
};

// Student View Preview Component that matches the actual course player
const StudentViewPreview = ({ content, title }: { content: any, title: string }) => {
  if (!content) {
    return (
      <div className="flex items-center justify-center min-h-[200px] text-muted-foreground">
        <div className="text-center">
          <BookOpen className="h-12 w-12 mx-auto mb-4 opacity-50" />
          <p>No content to preview</p>
        </div>
      </div>
    );
  }

  // Render content similar to LessonContentRenderer
  return (
    <div className="max-w-4xl mx-auto space-y-8 bg-gradient-to-br from-slate-50 to-blue-50 dark:from-slate-900 dark:to-blue-900/20 p-6 rounded-lg">
      {/* Section Title */}
      <div className="text-center mb-8">
        <h1 className="text-3xl font-bold text-slate-800 dark:text-slate-200 mb-2">
          {title || content.sectionTitle || 'Section Title'}
        </h1>
        <div className="w-24 h-1 bg-gradient-to-r from-blue-500 to-purple-500 mx-auto rounded-full"></div>
      </div>

      {/* Introduction */}
      {content.introduction && (
        <div className="bg-gradient-to-r from-blue-50 to-indigo-50 dark:from-blue-950/30 dark:to-indigo-950/30 p-6 rounded-xl border-l-4 border-blue-500 shadow-sm">
          <div className="flex items-start space-x-3 mb-3">
            <BookOpen className="h-6 w-6 text-blue-600 dark:text-blue-400 mt-1 flex-shrink-0" />
            <h2 className="text-xl font-semibold text-blue-900 dark:text-blue-100">Introduction</h2>
          </div>
          <div className="text-blue-800 dark:text-blue-200 leading-relaxed text-lg pl-9">
            <ReactMarkdown>{content.introduction}</ReactMarkdown>
          </div>
        </div>
      )}

      {/* Expert Teaching Content */}
      {content.expertTeachingContent && (
        <div className="space-y-6">
          {/* Concept Introduction */}
          {content.expertTeachingContent.conceptIntroduction && (
            <div className="bg-gradient-to-r from-purple-50 to-pink-50 dark:from-purple-950/30 dark:to-pink-950/30 p-6 rounded-xl border-l-4 border-purple-500 shadow-sm">
              <div className="flex items-start space-x-3 mb-4">
                <Target className="h-6 w-6 text-purple-600 dark:text-purple-400 mt-1 flex-shrink-0" />
                <h2 className="text-xl font-semibold text-purple-900 dark:text-purple-100">Key Concept</h2>
              </div>
              <div className="text-purple-800 dark:text-purple-200 leading-relaxed text-lg pl-9">
                <ReactMarkdown>{content.expertTeachingContent.conceptIntroduction}</ReactMarkdown>
              </div>
            </div>
          )}

          {/* Detailed Explanation */}
          {content.expertTeachingContent.detailedExplanation && (
            <div className="bg-white dark:bg-slate-800 p-6 rounded-xl border border-slate-200 dark:border-slate-700 shadow-sm">
              <div className="flex items-start space-x-3 mb-4">
                <Brain className="h-6 w-6 text-slate-600 dark:text-slate-400 mt-1 flex-shrink-0" />
                <h2 className="text-xl font-semibold text-slate-900 dark:text-slate-100">Deep Dive</h2>
              </div>
              <div className="text-slate-800 dark:text-slate-200 leading-relaxed text-base pl-9 prose dark:prose-invert max-w-none">
                <div dangerouslySetInnerHTML={{ __html: content.expertTeachingContent.detailedExplanation }} />
              </div>
            </div>
          )}

          {/* Expert Insights */}
          {content.expertTeachingContent.expertInsights && content.expertTeachingContent.expertInsights.length > 0 && (
            <div className="bg-gradient-to-r from-amber-50 to-orange-50 dark:from-amber-950/30 dark:to-orange-950/30 p-6 rounded-xl border-l-4 border-amber-500 shadow-sm">
              <div className="flex items-start space-x-3 mb-4">
                <Lightbulb className="h-6 w-6 text-amber-600 dark:text-amber-400 mt-1 flex-shrink-0" />
                <h2 className="text-xl font-semibold text-amber-900 dark:text-amber-100">Expert Insights</h2>
              </div>
              <div className="space-y-3 pl-9">
                {content.expertTeachingContent.expertInsights.map((insight: string, index: number) => (
                  <div key={index} className="flex items-start space-x-3">
                    <Zap className="h-4 w-4 text-amber-600 dark:text-amber-400 mt-1 flex-shrink-0" />
                    <p className="text-amber-800 dark:text-amber-200 leading-relaxed">{insight}</p>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {/* Expert Summary */}
      {content.expertSummary && (
        <div className="bg-gradient-to-r from-slate-100 to-gray-100 dark:from-slate-800 dark:to-gray-800 p-6 rounded-xl border-l-4 border-slate-500 shadow-sm">
          <div className="flex items-start space-x-3 mb-4">
            <Brain className="h-6 w-6 text-slate-600 dark:text-slate-400 mt-1 flex-shrink-0" />
            <h2 className="text-xl font-semibold text-slate-900 dark:text-slate-100">Key Takeaways</h2>
          </div>
          <div className="text-slate-800 dark:text-slate-200 leading-relaxed text-lg pl-9 font-medium bg-white dark:bg-slate-900/50 p-4 rounded-lg border border-slate-200 dark:border-slate-700">
            <ReactMarkdown>{content.expertSummary}</ReactMarkdown>
          </div>
        </div>
      )}
    </div>
  );
};

// Content Section Editor Component
const ContentSectionEditor = ({ 
  title, 
  value, 
  onChange, 
  placeholder, 
  icon: Icon, 
  description,
  isRequired = false,
  type = 'textarea'
}: {
  title: string;
  value: string;
  onChange: (value: string) => void;
  placeholder: string;
  icon: any;
  description?: string;
  isRequired?: boolean;
  type?: 'textarea' | 'editor';
}) => {
  const [isExpanded, setIsExpanded] = useState(!!value || isRequired);

  return (
    <Collapsible open={isExpanded} onOpenChange={setIsExpanded}>
      <CollapsibleTrigger asChild>
        <Button
          variant="ghost"
          className="w-full justify-between p-4 h-auto border border-border rounded-lg hover:bg-muted/50"
        >
          <div className="flex items-center gap-3">
            <Icon className="h-5 w-5 text-muted-foreground" />
            <div className="text-left">
              <div className="flex items-center gap-2">
                <span className="font-medium">{title}</span>
                {isRequired && <Badge variant="secondary" className="text-xs">Required</Badge>}
                {value && <Badge variant="outline" className="text-xs">Has Content</Badge>}
              </div>
              {description && (
                <p className="text-sm text-muted-foreground mt-1">{description}</p>
              )}
            </div>
          </div>
          {isExpanded ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
        </Button>
      </CollapsibleTrigger>
      <CollapsibleContent className="mt-2">
        <div className="border border-border rounded-lg p-4 bg-muted/20">
          <Textarea
            value={value}
            onChange={(e) => onChange(e.target.value)}
            placeholder={placeholder}
            rows={4}
            className="min-h-[100px] resize-y"
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

  // Content state for structured editing
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

  // TipTap editor for detailed explanation
  const editor = useEditor({
    extensions: [
      StarterKit.configure({
        heading: false,
        codeBlock: false,
      }),
      Placeholder.configure({
        placeholder: 'Write the detailed explanation that students will see...',
      }),
      Table.configure({
        resizable: true,
      }),
      TableRow,
      TableHeader,
      TableCell,
      Image,
      Link.configure({
        openOnClick: false,
        autolink: true,
      }),
      CodeBlockLowlight.configure({
        lowlight: lowlightInstance,
      }),
    ],
    content: contentData.detailedExplanation,
    immediatelyRender: false,
    onUpdate: ({ editor }) => {
      setContentData(prev => ({
        ...prev,
        detailedExplanation: editor.getHTML()
      }));
    },
  });

  // Update content data when specific fields change
  const updateContentField = (field: keyof typeof contentData, value: string) => {
    setContentData(prev => ({
      ...prev,
      [field]: value
    }));
  };

  // Build structured content for saving
  const buildStructuredContent = () => {
    return {
      sectionTitle: title,
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
         realWorldConnections: contentData.realWorldConnections.split('\n').filter((item: string) => item.trim())
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
    <Card className="w-full">
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle className="flex items-center gap-2">
            <Settings className="h-5 w-5" />
            Editing: {section.title || "Untitled Section"}
          </CardTitle>
          <div className="flex items-center gap-2">
            <Button
              onClick={handleSave}
              disabled={isSaving}
              className="flex items-center gap-2"
            >
              <Save className="h-4 w-4" />
              {isSaving ? 'Saving...' : 'Save Section'}
            </Button>
          </div>
        </div>
        {lastSaved && (
          <p className="text-sm text-muted-foreground">
            Last saved: {lastSaved.toLocaleTimeString()}
          </p>
        )}
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Basic Section Info */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label htmlFor="sectionTitle" className="block text-sm font-medium text-foreground mb-2">
              Section Title
            </label>
            <Input
              id="sectionTitle"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Enter section title"
            />
          </div>
          <div>
            <label htmlFor="sectionType" className="block text-sm font-medium text-foreground mb-2">
              Section Type
            </label>
            <Select value={sectionType} onValueChange={setSectionType}>
              <SelectTrigger>
                <SelectValue placeholder="Select section type" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="text">Text Content</SelectItem>
                <SelectItem value="introduction">Introduction</SelectItem>
                <SelectItem value="core_concept">Core Concept</SelectItem>
                <SelectItem value="example">Example</SelectItem>
                <SelectItem value="analysis">Analysis</SelectItem>
                <SelectItem value="summary">Summary</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>

        <Separator />

        {/* Content Editing Tabs */}
        <Tabs value={activeTab} onValueChange={(value) => setActiveTab(value as 'edit' | 'preview')} className="w-full">
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="edit" className="flex items-center gap-2">
              <Edit className="h-4 w-4" />
              Edit Content
            </TabsTrigger>
            <TabsTrigger value="preview" className="flex items-center gap-2">
              <Eye className="h-4 w-4" />
              Student Preview
            </TabsTrigger>
          </TabsList>

          <TabsContent value="edit" className="space-y-4 mt-6">
            <div className="bg-muted/30 p-4 rounded-lg">
              <div className="flex items-center gap-2 mb-3">
                <Layout className="h-5 w-5 text-muted-foreground" />
                <h3 className="font-medium">Content Structure</h3>
              </div>
              <p className="text-sm text-muted-foreground mb-4">
                Edit each section of your lesson content. Students will see these in a beautifully formatted layout.
              </p>
              
              <div className="space-y-3">
                <ContentSectionEditor
                  title="Introduction"
                  value={contentData.introduction}
                  onChange={(value) => updateContentField('introduction', value)}
                  placeholder="Write an engaging introduction that hooks students and sets up the learning objectives..."
                  icon={BookOpen}
                  description="Sets the stage and explains what students will learn"
                  isRequired={true}
                />

                <ContentSectionEditor
                  title="Key Concept Introduction"
                  value={contentData.conceptIntroduction}
                  onChange={(value) => updateContentField('conceptIntroduction', value)}
                  placeholder="Introduce the main concept or idea that this section focuses on..."
                  icon={Target}
                  description="Highlights the core concept students need to understand"
                />

                <div className="border border-border rounded-lg p-4">
                  <div className="flex items-center gap-3 mb-4">
                    <Brain className="h-5 w-5 text-muted-foreground" />
                    <div>
                      <h4 className="font-medium">Detailed Explanation</h4>
                      <p className="text-sm text-muted-foreground">The main content that students will learn from (Rich Text Editor)</p>
                      <Badge variant="secondary" className="text-xs mt-1">Required</Badge>
                    </div>
                  </div>
                  
                  <div className="space-y-2">
                    <EditorToolbar editor={editor} />
                    <EditorContent 
                      editor={editor} 
                      className="border border-input rounded-b-md min-h-[200px] p-4 focus:outline-none focus:ring-2 focus:ring-ring prose dark:prose-invert max-w-full"
                    />
                    {editor && (
                      <BubbleMenu editor={editor} className="bg-background border border-input rounded-md shadow-xl p-1 flex gap-1">
                        <Button variant="ghost" size="sm" onClick={() => editor.chain().focus().toggleBold().run()} className={editor.isActive('bold') ? 'bg-muted' : ''}><Bold className="h-4 w-4" /></Button>
                        <Button variant="ghost" size="sm" onClick={() => editor.chain().focus().toggleItalic().run()} className={editor.isActive('italic') ? 'bg-muted' : ''}><Italic className="h-4 w-4" /></Button>
                      </BubbleMenu>
                    )}
                  </div>
                </div>

                <ContentSectionEditor
                  title="Expert Insights"
                  value={contentData.expertInsights}
                  onChange={(value) => updateContentField('expertInsights', value)}
                  placeholder="Share professional insights, tips, and advanced perspectives (one per line)..."
                  icon={Lightbulb}
                  description="Professional tips and insights that add depth"
                />

                <ContentSectionEditor
                  title="Practical Examples"
                  value={contentData.practicalExamples}
                  onChange={(value) => updateContentField('practicalExamples', value)}
                  placeholder="Provide real-world examples. Format: 'Title: Description' (separate examples with double line breaks)..."
                  icon={Users}
                  description="Real-world examples that illustrate the concepts"
                />

                <ContentSectionEditor
                  title="Common Misconceptions"
                  value={contentData.commonMisconceptions}
                  onChange={(value) => updateContentField('commonMisconceptions', value)}
                  placeholder="Address common mistakes. Format: 'Misconception - Correction' (separate with double line breaks)..."
                  icon={AlertTriangle}
                  description="Help students avoid common pitfalls"
                />

                <ContentSectionEditor
                  title="Real-World Connections"
                  value={contentData.realWorldConnections}
                  onChange={(value) => updateContentField('realWorldConnections', value)}
                  placeholder="Show how this applies in the real world (one connection per line)..."
                  icon={Globe}
                  description="Connect learning to practical applications"
                />

                <ContentSectionEditor
                  title="Expert Summary"
                  value={contentData.expertSummary}
                  onChange={(value) => updateContentField('expertSummary', value)}
                  placeholder="Summarize the key takeaways and main points students should remember..."
                  icon={Brain}
                  description="Key takeaways that reinforce learning"
                />

                <ContentSectionEditor
                  title="Check for Understanding"
                  value={contentData.checkForUnderstanding}
                  onChange={(value) => updateContentField('checkForUnderstanding', value)}
                  placeholder="Create questions to help students reflect on their learning (one per line)..."
                  icon={CheckCircle2}
                  description="Questions that help students self-assess"
                />

                <ContentSectionEditor
                  title="Bridge to Next Section"
                  value={contentData.bridgeToNext}
                  onChange={(value) => updateContentField('bridgeToNext', value)}
                  placeholder="Connect this section to what comes next in the learning journey..."
                  icon={ArrowRight}
                  description="Smooth transition to the next part of the lesson"
                />
              </div>
            </div>
          </TabsContent>

          <TabsContent value="preview" className="mt-6">
            <div className="bg-muted/30 p-4 rounded-lg mb-4">
              <div className="flex items-center gap-2 mb-2">
                <Eye className="h-5 w-5 text-muted-foreground" />
                <h3 className="font-medium">Student Preview</h3>
              </div>
              <p className="text-sm text-muted-foreground">
                This is exactly how students will see your content in the course player.
              </p>
            </div>
            
            <div className="border border-border rounded-lg overflow-hidden">
              <StudentViewPreview content={buildStructuredContent()} title={title} />
            </div>
          </TabsContent>
        </Tabs>
      </CardContent>
    </Card>
  );
};

export default LessonSectionEditor; 