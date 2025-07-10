import React, { useState, useEffect, useCallback } from 'react';
import { LessonSection } from '@/types/lesson';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import ContentRenderer from './ContentRenderer';

// Tiptap imports
import { useEditor, EditorContent, BubbleMenu } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';
import Table from '@tiptap/extension-table';
import TableRow from '@tiptap/extension-table-row';
import TableCell from '@tiptap/extension-table-cell';
import TableHeader from '@tiptap/extension-table-header';
import Image from '@tiptap/extension-image';
import Link from '@tiptap/extension-link';
import CodeBlockLowlight from '@tiptap/extension-code-block-lowlight';
import { createLowlight } from 'lowlight';
import javascript from 'highlight.js/lib/languages/javascript';
import Placeholder from '@tiptap/extension-placeholder';
import { Bold, Italic, Strikethrough, Code, Pilcrow, List, ListOrdered, Quote, Minus, Image as ImageIcon, Link as LinkIcon, Columns, Trash2, Palette, Highlighter, Edit, Eye } from 'lucide-react'; // Icons

interface LessonSectionEditorProps {
  section: LessonSection;
  onSave: (updatedSection: Partial<LessonSection>) => Promise<void>;
}

// Toolbar component
const EditorToolbar = ({ editor }: { editor: any | null }) => {
  // Moved useCallback hooks before the conditional return to ensure they are always called
  const addImage = useCallback(() => {
    if (!editor) return; // Guard against editor being null here
    const url = window.prompt('Enter image URL');
    if (url) {
      editor.chain().focus().setImage({ src: url }).run();
    }
  }, [editor]);

  const setLink = useCallback(() => {
    if (!editor) return; // Guard against editor being null here
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
    <div className="flex flex-wrap items-center gap-2 p-2 border border-input rounded-t-md bg-background">
      <Button variant="outline" size="sm" onClick={() => editor.chain().focus().toggleBold().run()} disabled={!editor.can().chain().focus().toggleBold().run()} className={editor.isActive('bold') ? 'is-active' : ''}><Bold className="h-4 w-4" /></Button>
      <Button variant="outline" size="sm" onClick={() => editor.chain().focus().toggleItalic().run()} disabled={!editor.can().chain().focus().toggleItalic().run()} className={editor.isActive('italic') ? 'is-active' : ''}><Italic className="h-4 w-4" /></Button>
      <Button variant="outline" size="sm" onClick={() => editor.chain().focus().toggleStrike().run()} disabled={!editor.can().chain().focus().toggleStrike().run()} className={editor.isActive('strike') ? 'is-active' : ''}><Strikethrough className="h-4 w-4" /></Button>
      <Button variant="outline" size="sm" onClick={() => editor.chain().focus().toggleCode().run()} disabled={!editor.can().chain().focus().toggleCode().run()} className={editor.isActive('code') ? 'is-active' : ''}><Code className="h-4 w-4" /></Button>
      
      <Button variant="outline" size="sm" onClick={() => editor.chain().focus().setParagraph().run()} className={editor.isActive('paragraph') ? 'is-active' : ''}><Pilcrow className="h-4 w-4" /></Button>
      <Button variant="outline" size="sm" onClick={() => editor.chain().focus().toggleHeading({ level: 1 }).run()} className={editor.isActive('heading', { level: 1 }) ? 'is-active' : ''}>H1</Button>
      <Button variant="outline" size="sm" onClick={() => editor.chain().focus().toggleHeading({ level: 2 }).run()} className={editor.isActive('heading', { level: 2 }) ? 'is-active' : ''}>H2</Button>
      <Button variant="outline" size="sm" onClick={() => editor.chain().focus().toggleHeading({ level: 3 }).run()} className={editor.isActive('heading', { level: 3 }) ? 'is-active' : ''}>H3</Button>
      
      <Button variant="outline" size="sm" onClick={() => editor.chain().focus().toggleBulletList().run()} className={editor.isActive('bulletList') ? 'is-active' : ''}><List className="h-4 w-4" /></Button>
      <Button variant="outline" size="sm" onClick={() => editor.chain().focus().toggleOrderedList().run()} className={editor.isActive('orderedList') ? 'is-active' : ''}><ListOrdered className="h-4 w-4" /></Button>
      <Button variant="outline" size="sm" onClick={() => editor.chain().focus().toggleBlockquote().run()} className={editor.isActive('blockquote') ? 'is-active' : ''}><Quote className="h-4 w-4" /></Button>
      <Button variant="outline" size="sm" onClick={() => editor.chain().focus().setHorizontalRule().run()}><Minus className="h-4 w-4" /></Button>
      
      <Button variant="outline" size="sm" onClick={() => editor.chain().focus().toggleCodeBlock().run()} className={editor.isActive('codeBlock') ? 'is-active' : ''}>CodeBlk</Button>
      <Button variant="outline" size="sm" onClick={addImage}><ImageIcon className="h-4 w-4" /></Button>
      <Button variant="outline" size="sm" onClick={setLink} disabled={editor.isActive('link')}><LinkIcon className="h-4 w-4" /></Button>
      <Button variant="outline" size="sm" onClick={() => editor.chain().focus().unsetLink().run()} disabled={!editor.isActive('link')}>Unlink</Button>

      <Button variant="outline" size="sm" onClick={() => editor.chain().focus().insertTable({ rows: 3, cols: 3, withHeaderRow: true }).run()}><Columns className="h-4 w-4" /></Button>
      {editor.can().deleteTable && <Button variant="destructive" size="sm" onClick={() => editor.chain().focus().deleteTable().run()}><Trash2 className="h-4 w-4" /></Button>}
      {/* Add more table controls as needed: addColumnBefore, addColumnAfter, deleteColumn, addRowBefore, addRowAfter, deleteRow, mergeCells, splitCell etc. */}
    </div>
  );
};

const LessonSectionEditor: React.FC<LessonSectionEditorProps> = ({ section, onSave }) => {
  const [title, setTitle] = useState(section.title);
  const [sectionType, setSectionType] = useState(section.section_type || 'text'); // Default to 'text'
  const [isSaving, setIsSaving] = useState(false);
  const [lastSaved, setLastSaved] = useState<Date | null>(null);
  const [isEditing, setIsEditing] = useState(false);

  const lowlightInstance = createLowlight();
  lowlightInstance.register('javascript', javascript);

  // Function to get initial editor content from structured data
  const getInitialEditorContent = () => {
    if (section.content && typeof section.content === 'object') {
      // If we have structured content, get the detailedExplanation
      if (section.content.expertTeachingContent?.detailedExplanation) {
        return section.content.expertTeachingContent.detailedExplanation;
      }
      // Fallback to text field if it exists
      if (section.content.text) {
        return section.content.text;
      }
    }
    // Fallback to raw content if it's a string
    if (typeof section.content === 'string') {
      return section.content;
    }
    return '';
  };

  const editor = useEditor({
    extensions: [
      StarterKit.configure({
        // Disabling heading allows custom H1, H2, H3 buttons
        heading: false, // Or configure levels if preferred
        codeBlock: false, // Using CodeBlockLowlight separately
      }),
      Placeholder.configure({
        placeholder: 'Start writing your lesson section here...',
      }),
      Table.configure({
        resizable: true,
      }),
      TableRow,
      TableHeader,
      TableCell,
      Image,
      Link.configure({
        openOnClick: false, // So user can edit link by clicking on it
        autolink: true,
      }),
      CodeBlockLowlight.configure({
        lowlight: lowlightInstance,
      }),
    ],
    content: getInitialEditorContent(), // Initialize with content from detailedExplanation
    editable: isEditing, // Always editable when in editing mode
    onUpdate: ({ editor }) => {
      // Debounced save or auto-save logic could go here
      // For now, content is updated on manual save.
    },
  });

  useEffect(() => {
    setTitle(section.title);
    setSectionType(section.section_type || 'text');
    if (editor) {
      // Ensure content is updated if section prop changes
      // For structured content with text field, extract the text for TipTap
      const currentContent = editor.getJSON();
      let newContent;
      
      try {
        // Handle structured lesson content
        if (section.content && typeof section.content === 'object' && section.content.expertTeachingContent?.detailedExplanation) {
          // For structured content, use the detailedExplanation field for TipTap editing
          newContent = section.content.expertTeachingContent.detailedExplanation;
        } else if (section.content && typeof section.content === 'object' && section.content.text) {
          // Fallback to text field for TipTap editing
          newContent = section.content.text;
        } else if (section.content && typeof section.content === 'object' && section.content.type) {
          // For TipTap JSON structure
          newContent = section.content;
        } else if (typeof section.content === 'string') {
          // For plain text content
          newContent = section.content;
        } else {
          // Fallback to empty content
          newContent = '';
        }
        
        // Only set content if it's different, to avoid cursor jumps and unnecessary re-renders
        if (JSON.stringify(currentContent) !== JSON.stringify(newContent)) {
          editor.commands.setContent(newContent || '', false);
        }
      } catch (e) {
        // If parsing fails or content is not structured, set as plain text or handle error
        console.warn("Failed to parse section content for Tiptap:", section.content, e);
        // For safety, initialize with empty content if content is invalid for Tiptap
        editor.commands.setContent('', false);
      }
      
      editor.setEditable(isEditing);
    }
  }, [section, editor, isEditing]);

  // Update editor editability when editing mode changes
  useEffect(() => {
    if (editor) {
      editor.setEditable(isEditing);
    }
  }, [editor, sectionType, isEditing]);

  // Define setLink for BubbleMenu
  const setLinkBubble = useCallback(() => {
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

  // Debounce save function - ALWAYS saves in structured format
  const debouncedSave = useCallback(
    async (currentTitle: string, currentContent: any, currentSectionType: string) => {
      setIsSaving(true);
      
      // ALWAYS save content in the structured format
      let contentToSave;
      
      // Check if we already have structured content to preserve
      const hasStructuredContent = section.content && 
        typeof section.content === 'object' && 
        (section.content.bridgeToNext || section.content.introduction || section.content.sectionTitle);
      
      if (hasStructuredContent) {
        // Preserve existing structured content and update title and detailedExplanation
        contentToSave = {
          ...section.content,
          sectionTitle: currentTitle,
          expertTeachingContent: {
            ...section.content.expertTeachingContent,
            detailedExplanation: currentContent
          }
        };
      } else {
        // Create new structured content format
        contentToSave = {
          bridgeToNext: "This section connects to the next part of the lesson, building on the concepts learned here.",
          introduction: "This section introduces key concepts that students need to understand.",
          sectionTitle: currentTitle,
          expertSummary: "By completing this section, students will have gained important knowledge and skills that prepare them for future learning.",
          checkForUnderstanding: [
            "What are the main concepts covered in this section?",
            "How do these concepts connect to what you learned previously?"
          ],
          expertTeachingContent: {
            expertInsights: [
              "This content represents foundational knowledge in the subject area.",
              "Students often benefit from connecting these concepts to real-world applications.",
              "Building understanding gradually helps students retain information better."
            ],
            practicalExamples: [
              {
                title: "Understanding the Concept",
                context: "This example helps illustrate the main ideas presented in this section.",
                walkthrough: "Step by step, students can see how the concept applies in practice.",
                keyTakeaways: [
                  "The main concept is important for understanding the subject.",
                  "Practical application helps reinforce learning."
                ]
              }
            ],
            conceptIntroduction: "This section introduces students to important concepts that form the foundation for deeper learning.",
            detailedExplanation: typeof currentContent === 'string' ? currentContent : 
              (currentContent && typeof currentContent === 'object' && currentContent.type === 'doc' ? 
                "Content from the TipTap editor will be displayed here." : 
                "This section provides detailed explanation of the key concepts."),
            commonMisconceptions: [
              {
                correction: "The correct understanding is based on accurate information and careful analysis.",
                prevention: "Students can avoid this misconception by focusing on the key principles.",
                misconception: "Students sometimes misunderstand the basic concepts."
              }
            ],
            realWorldConnections: [
              "These concepts apply to many situations in the real world.",
              "Understanding these ideas helps students see the relevance of their learning."
            ]
          }
        };
      }
      
      const updatedData: Partial<LessonSection> = {
        id: section.id,
        title: currentTitle,
        content: contentToSave,
        section_type: currentSectionType,
      };
      
      try {
        await onSave(updatedData);
        setLastSaved(new Date());
      } catch (error) {
        console.error("Failed to save section:", error);
        // Add user feedback for save failure
      } finally {
        setIsSaving(false);
      }
    },
    [onSave, section.id, section.content]
  );

  // Auto-save on content change (debounced)
  useEffect(() => {
    if (!editor) {
      return;
    }
    const handleUpdate = () => {
      // This is where you'd call a debounced version of handleSave
      // For simplicity now, we rely on manual save button.
      // Example: if (isDirty) { debouncedSave(title, editor.getJSON(), sectionType); }
    };
    editor.on('update', handleUpdate);
    return () => {
      editor.off('update', handleUpdate);
    };
  }, [editor, title, sectionType, debouncedSave]);


  const handleManualSave = async () => {
    if (!editor) {
      console.error("Editor not available for saving content");
      return;
    }
    // Get the content from the editor (this will go into detailedExplanation)
    const currentContent = editor.getHTML(); // Use HTML for better formatting preservation
    debouncedSave(title, currentContent, sectionType);
  };
  
  // State for non-Tiptap content input
  const [contentInput, setContentInput] = useState(() => {
    if (sectionType === 'text') {
      return '';
    }
    
    // For structured content types (introduction, core_concept, etc.), extract text content
    if (['introduction', 'core_concept', 'example', 'analysis', 'summary'].includes(sectionType) &&
        section.content && typeof section.content === 'object' && section.content.text) {
      return section.content.text;
    }
    // For other non-text types, extract production content or show raw content
    else if (section.content && typeof section.content === 'object' && section.content.text) {
      return section.content.text;
    } else if (typeof section.content === 'string') {
      return section.content;
    } else {
      return JSON.stringify(section.content || '', null, 2);
    }
  });

  useEffect(() => {
    // Update contentInput if section.content changes and it's not a text type editor
    if (sectionType !== 'text') {
      // For structured content types, prioritize text extraction
      if (['introduction', 'core_concept', 'example', 'analysis', 'summary'].includes(sectionType) &&
          section.content && typeof section.content === 'object' && section.content.text) {
        setContentInput(section.content.text);
      } else if (section.content && typeof section.content === 'object' && section.content.text) {
        setContentInput(section.content.text);
      } else if (typeof section.content === 'string') {
        setContentInput(section.content);
      } else {
        setContentInput(JSON.stringify(section.content || '', null, 2));
      }
    }
  }, [section.content, sectionType]);


  return (
    <Card className="w-full">
      <CardHeader>
        <CardTitle>Editing: {section.title || "Untitled Section"}</CardTitle>
      </CardHeader>
      <CardContent className="space-y-6 w-full">
        <div>
          <label htmlFor="sectionTitle" className="block text-sm font-medium text-foreground mb-1">
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
          <div className="flex items-center justify-between mb-2">
            <label className="block text-sm font-medium text-foreground">
              Content (goes into Detailed Explanation)
            </label>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setIsEditing(!isEditing)}
              className="flex items-center gap-2"
            >
              {isEditing ? (
                <>
                  <Eye className="h-4 w-4" />
                  Student Preview
                </>
              ) : (
                <>
                  <Edit className="h-4 w-4" />
                  Edit Content
                </>
              )}
            </Button>
          </div>
          
          {isEditing && editor ? (
            <div>
              <EditorToolbar editor={editor} />
              <EditorContent editor={editor} className="mt-0 border border-input rounded-b-md min-h-[200px] p-2 focus:outline-none focus:ring-2 focus:ring-ring prose dark:prose-invert max-w-full" />
              {editor && (
                <BubbleMenu editor={editor} tippyOptions={{ duration: 100 }} className="bg-background border border-input rounded-md shadow-xl p-1 flex gap-1">
                  <Button variant="ghost" size="sm" onClick={() => editor.chain().focus().toggleBold().run()} className={editor.isActive('bold') ? 'is-active bg-muted' : ''}><Bold className="h-4 w-4" /></Button>
                  <Button variant="ghost" size="sm" onClick={() => editor.chain().focus().toggleItalic().run()} className={editor.isActive('italic') ? 'is-active bg-muted' : ''}><Italic className="h-4 w-4" /></Button>
                  <Button variant="ghost" size="sm" onClick={setLinkBubble}><LinkIcon className="h-4 w-4" /></Button>
                </BubbleMenu>
              )}
            </div>
          ) : (
            <div className="border border-input rounded-md min-h-[200px] p-4 bg-background">
              <ContentRenderer content={section.content} className="prose dark:prose-invert max-w-none" showStudentView={true} sectionType={sectionType} />
            </div>
          )}
        </div>

        {false && (
        <div>
          <div className="flex items-center justify-between mb-2">
            <label htmlFor="nonTextContent" className="block text-sm font-medium text-foreground">
              {sectionType === 'video_url' && "Video URL"}
              {sectionType === 'quiz' && "Quiz JSON Data"}
              {sectionType === 'document_embed' && "Document Embed URL"}
              {sectionType === 'introduction' && "Introduction Content"}
              {sectionType === 'core_concept' && "Core Concept Content"}
              {sectionType === 'example' && "Example Content"}
              {sectionType === 'analysis' && "Analysis Content"}
              {sectionType === 'summary' && "Summary Content"}
              {!['video_url', 'quiz', 'document_embed', 'introduction', 'core_concept', 'example', 'analysis', 'summary'].includes(sectionType) && "Content"}
            </label>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setIsEditing(!isEditing)}
              className="flex items-center gap-2"
            >
              {isEditing ? (
                <>
                  <Eye className="h-4 w-4" />
                  Student Preview
                </>
              ) : (
                <>
                  <Edit className="h-4 w-4" />
                  Edit Content
                </>
              )}
            </Button>
          </div>
          
          {isEditing ? (
            // For structured content types (introduction, core_concept, etc.), only show raw editing if it's truly raw data
            ['introduction', 'core_concept', 'example', 'analysis', 'summary'].includes(sectionType) && 
            section.content && typeof section.content === 'object' && section.content.text ? (
              <Textarea
                id="nonTextContent"
                value={contentInput}
                onChange={(e) => setContentInput(e.target.value)}
                placeholder={`Enter ${sectionType.replace('_', ' ')} content here`}
                rows={6}
                className="text-sm"
              />
            ) : (
              <Textarea
                id="nonTextContent"
                value={contentInput}
                onChange={(e) => setContentInput(e.target.value)}
                placeholder={`Enter ${sectionType.replace('_', ' ')} content here`}
                rows={sectionType === 'quiz' ? 10 : 3}
                className="font-mono text-sm"
              />
            )
          ) : (
            <div className="border border-input rounded-md min-h-[100px] p-4 bg-background">
              <ContentRenderer content={section.content} showStudentView={true} sectionType={sectionType} />
            </div>
          )}
        </div>
        )}

        <div className="flex items-center justify-between mt-6">
            <Button 
              onClick={handleManualSave} 
              disabled={isSaving}
            >
                {isSaving ? 'Saving...' : 'Save Section'}
            </Button>
            {lastSaved && (
                <p className="text-sm text-muted-foreground">
                    Last saved: {lastSaved.toLocaleTimeString()}
                </p>
            )}
        </div>
      </CardContent>
    </Card>
  );
};

export default LessonSectionEditor; 