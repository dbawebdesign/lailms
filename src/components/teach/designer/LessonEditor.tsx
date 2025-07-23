'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { useEditor, EditorContent, Editor } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';
import Document from '@tiptap/extension-document';
import Paragraph from '@tiptap/extension-paragraph';
import Text from '@tiptap/extension-text';
import Heading from '@tiptap/extension-heading';
import ListItem from '@tiptap/extension-list-item';
import OrderedList from '@tiptap/extension-ordered-list';
import BulletList from '@tiptap/extension-bullet-list';
import CodeBlock from '@tiptap/extension-code-block';
import { Table } from '@tiptap/extension-table';
import TableRow from '@tiptap/extension-table-row';
import TableCell from '@tiptap/extension-table-cell';
import TableHeader from '@tiptap/extension-table-header';

import type { LessonSection } from '@/types/lesson'; // Using lesson.ts for consistency
import {
  getLessonSections, // For re-fetching if needed
  addLessonSection,
  updateLessonSection,
  deleteLessonSection,
  getSectionVersions,
  revertToVersion,
} from '@/lib/services/teachService';
import { Button } from '@/components/ui/button'; // Assuming Button component exists
import { Input } from '@/components/ui/input';   // Assuming Input component exists
import { LoadingSpinner } from '@/components/ui/loading-spinner';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { PlusCircle, Trash2, Edit3, History, CheckCircle, XCircle, Save, Brain, FileText } from 'lucide-react'; // Icons
import MediaAssetsPanel from '@/components/teach/studio/editors/MediaAssetsPanel';

// Define a basic toolbar component (can be expanded significantly)
const TiptapToolbar: React.FC<{ editor: Editor | null }> = ({ editor }) => {
  if (!editor) {
    return null;
  }

  return (
    <div className="flex space-x-1 p-2 border-b border-gray-300 mb-2 sticky top-0 bg-background z-10 flex-wrap">
      <Button variant="outline" size="sm" onClick={() => editor.chain().focus().toggleBold().run()} disabled={!editor.can().chain().focus().toggleBold().run()} className={editor.isActive('bold') ? 'is-active' : ''}>Bold</Button>
      <Button variant="outline" size="sm" onClick={() => editor.chain().focus().toggleItalic().run()} disabled={!editor.can().chain().focus().toggleItalic().run()} className={editor.isActive('italic') ? 'is-active' : ''}>Italic</Button>
      <Button variant="outline" size="sm" onClick={() => editor.chain().focus().toggleStrike().run()} disabled={!editor.can().chain().focus().toggleStrike().run()} className={editor.isActive('strike') ? 'is-active' : ''}>Strike</Button>
      <Button variant="outline" size="sm" onClick={() => editor.chain().focus().toggleHeading({ level: 1 }).run()} className={editor.isActive('heading', { level: 1 }) ? 'is-active' : ''}>H1</Button>
      <Button variant="outline" size="sm" onClick={() => editor.chain().focus().toggleHeading({ level: 2 }).run()} className={editor.isActive('heading', { level: 2 }) ? 'is-active' : ''}>H2</Button>
      {/* Add more buttons for lists, code blocks, tables etc. */}
    </div>
  );
};

export interface LessonEditorProps {
  lessonIdParam: string; // Can be 'new' or an existing lesson ID
  initialSections?: LessonSection[];
}

const LessonEditor: React.FC<LessonEditorProps> = ({ lessonIdParam, initialSections }) => {
  const [lessonId, setLessonId] = useState<string | null>(lessonIdParam === 'new' ? null : lessonIdParam);
  const [sections, setSections] = useState<LessonSection[]>([]);
  const [activeSectionId, setActiveSectionId] = useState<string | null>(null);
  const [isCreatingSection, setIsCreatingSection] = useState(false);
  const [newSectionTitle, setNewSectionTitle] = useState('');
  const [isLoading, setIsLoading] = useState(true); // Initial loading state for sections
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Tiptap editor instance
  const editor = useEditor({
    extensions: [
      StarterKit.configure({ 
        document: false, paragraph: false, text: false, heading: false, 
        listItem: false, orderedList: false, bulletList: false, codeBlock: false,
      }),
      Document,
      Paragraph,
      Text,
      Heading.configure({ levels: [1, 2, 3] }),
      ListItem,
      OrderedList,
      BulletList,
      CodeBlock,
      Table.configure({ resizable: true }),
      TableRow,
      TableHeader,
      TableCell,
      // Placeholder for custom media block extensions
    ],
    content: '<p>Select or create a section to start editing.</p>',
    editable: false,
    onUpdate: ({ editor: currentEditor }: { editor: Editor }) => {
      // Auto-save logic or manual save trigger
      // For now, let's handle saving via a button
    },
  });

  useEffect(() => {
    if (initialSections) {
      setSections(initialSections);
      if (initialSections.length === 0 && lessonIdParam !== 'new') {
        setIsCreatingSection(true); 
      }
      setIsLoading(false);
    } else if (lessonIdParam === 'new') {
        setSections([]);
        setIsLoading(false);
        // For a truly new lesson, prompt to create the lesson first or set lessonId after first save.
        // For now, we'll allow trying to add a section, but it will be disabled if lessonId is null.
        setIsCreatingSection(true);
    }
  }, [initialSections, lessonIdParam]);

  // Load active section content into editor
  useEffect(() => {
    if (activeSectionId && editor) {
      const activeSection = sections.find(s => s.id === activeSectionId);
      if (activeSection) {
        editor.commands.setContent(activeSection.content || '<p></p>'); // Set to empty paragraph if content is null/undefined
        editor.setEditable(true);
      } else {
        editor.commands.clearContent();
        editor.setEditable(false);
      }
    } else if (editor) {
      editor.commands.setContent('<p>Select or create a section to start editing.</p>');
      editor.setEditable(false);
    }
  }, [activeSectionId, sections, editor]);

  const handleSelectSection = (sectionId: string) => {
    // Potentially save pending changes in current active section first (not implemented yet)
    setActiveSectionId(sectionId);
    setIsCreatingSection(false); // Close new section form if open
    setError(null);
  };

  const handleAddNewSectionClick = () => {
    setActiveSectionId(null); // Deselect any active section
    editor?.commands.clearContent();
    editor?.setEditable(false);
    setIsCreatingSection(true);
    setNewSectionTitle('');
    setError(null);
  }

  const handleCreateSection = async () => {
    if (!newSectionTitle.trim()) {
      setError('Section title is required.');
      return;
    }
    if (!lessonId) {
      setError('Lesson ID is not available. Save the lesson first to get an ID.');
      // This indicates the parent page/component needs to handle the 'new' lesson flow and provide a lessonId.
      // For now, the button to add will be disabled if lessonId is null.
      console.warn('Attempted to create section for a lesson with no ID.');
      return;
    }
    setIsSaving(true);
    setError(null);
    try {
      const newSection = await addLessonSection(lessonId, { title: newSectionTitle, content: { type: 'doc', content: [{ type: 'paragraph' }] } }); // Add with empty content
      setSections(prev => [...prev, newSection]);
      setActiveSectionId(newSection.id);
      setNewSectionTitle('');
      setIsCreatingSection(false);
    } catch (err: any) {
      console.error('Failed to add section:', err);
      setError(err.message || 'Failed to add section');
    } finally {
      setIsSaving(false);
    }
  };

  const handleSaveSectionContent = async () => {
    if (!activeSectionId || !editor || !editor.isEditable) {
      setError('No active editable section or editor to save.');
      return;
    }
    const currentContent = editor.getJSON();
    setIsSaving(true);
    setError(null);
    try {
      const updatedSection = await updateLessonSection(activeSectionId, { content: currentContent });
      setSections(prev => prev.map(s => s.id === activeSectionId ? { ...s, ...updatedSection, content: currentContent } : s)); // Ensure local state reflects saved content
      // Consider adding a success notification (toast)
    } catch (err: any) {
      console.error('Failed to save section content:', err);
      setError(err.message || 'Failed to save content');
    } finally {
      setIsSaving(false);
    }
  };

  const handleDeleteSelectedSection = async (sectionIdToDelete: string) => {
    if (!confirm('Are you sure you want to delete this section?')) return;
    setIsSaving(true);
    setError(null);
    try {
      await deleteLessonSection(sectionIdToDelete);
      setSections(prev => prev.filter(s => s.id !== sectionIdToDelete));
      if (activeSectionId === sectionIdToDelete) {
        setActiveSectionId(null);
        editor?.commands.clearContent();
        editor?.setEditable(false);
      }
    } catch (err: any) {
      console.error('Failed to delete section:', err);
      setError(err.message || 'Failed to delete section');
    } finally {
      setIsSaving(false);
    }
  };

  if (isLoading) {
    return <div className="flex justify-center items-center p-10 h-full"><LoadingSpinner /></div>;
  }

  return (
    <div className="lesson-editor flex flex-col lg:flex-row h-[calc(100vh-var(--header-height,100px)-2rem)] gap-4" /* Adjust height as needed */ >
      {/* Sections Sidebar */}
      <div className="sections-sidebar w-full lg:w-80 border-r border-gray-300 p-4 space-y-2 bg-slate-50 overflow-y-auto flex flex-col">
        <h2 className="text-xl font-semibold mb-3 shrink-0">Lesson Sections</h2>
        <div className="space-y-2 overflow-y-auto flex-grow">
            {sections.map(section => (
            <div 
                key={section.id} 
                className={`p-3 rounded-md cursor-pointer hover:bg-slate-200 transition-colors 
                            ${activeSectionId === section.id ? 'bg-primary/20 text-primary-foreground ring-2 ring-primary' : 'bg-slate-100'}`}
                onClick={() => handleSelectSection(section.id)}
            >
                <div className="flex justify-between items-center">
                <span className="font-medium truncate w-4/5" title={section.title}>{section.title}</span>
                <Button variant="ghost" size="icon" className="text-slate-500 hover:text-destructive shrink-0" onClick={(e) => { e.stopPropagation(); handleDeleteSelectedSection(section.id); }}>
                    <Trash2 size={16} />
                </Button>
                </div>
            </div>
            ))}
        </div>

        {sections.length === 0 && !isCreatingSection && lessonIdParam !== 'new' && (
            <p className="text-slate-500 text-center py-4">No sections yet. Add one to get started!</p>
        )}
        
        {isCreatingSection ? (
          <div className="mt-4 p-3 bg-slate-100 rounded-md border border-slate-200 shrink-0">
            <h3 className="text-lg font-medium mb-2">New Section</h3>
            <Input 
              type="text"
              value={newSectionTitle}
              onChange={(e) => setNewSectionTitle(e.target.value)}
              placeholder="Enter section title"
              className="mb-2"
            />
            <div className="flex justify-end space-x-2">
                <Button variant="ghost" size="sm" onClick={() => {setIsCreatingSection(false); setNewSectionTitle(''); setError(null);}} disabled={isSaving}>
                    <XCircle size={16} className="mr-1"/> Cancel
                </Button>
                <Button onClick={handleCreateSection} disabled={isSaving || !newSectionTitle.trim() || !lessonId} size="sm">
                  {isSaving ? <LoadingSpinner size={16}/> : <CheckCircle size={16} className="mr-1"/>} Add Section
                </Button>
            </div>
            {!lessonId && (
                <p className="text-xs text-amber-600 mt-2">Note: A Lesson ID is required. If this is a new lesson, it may need to be saved first (flow TBD).</p>
            )}
          </div>
        ) : (
          <Button variant="outline" className="w-full mt-4 shrink-0" onClick={handleAddNewSectionClick}>
            <PlusCircle size={18} className="mr-2" /> Add New Section
          </Button>
        )}
        {error && <p className="text-red-500 text-sm mt-2 shrink-0">{error}</p>}
      </div>

      {/* Editor Area */}
      <div className="editor-main-area flex-1 flex flex-col p-4 bg-white rounded-md shadow">
        {activeSectionId && sections.find(s => s.id === activeSectionId) ? (
          <>
            <div className="flex justify-between items-center mb-3 pb-3 border-b">
                <h3 className="text-2xl font-semibold truncate" title={sections.find(s=>s.id === activeSectionId)?.title}>Editing: {sections.find(s=>s.id === activeSectionId)?.title}</h3>
                <Button onClick={handleSaveSectionContent} disabled={isSaving || !editor?.isEditable} variant="default" size="sm">
                  {isSaving ? <LoadingSpinner size={16}/> : <Save size={16} className="mr-1"/>} Save Content
                </Button>
            </div>
            <TiptapToolbar editor={editor} />
            <EditorContent editor={editor} className="flex-grow tiptap-editor prose max-w-none prose-slate rounded-b-md focus:outline-none p-1" />
            {/* Version history UI placeholder */}
          </>
        ) : (
          <div className="flex flex-col justify-center items-center h-full text-slate-500 bg-slate-50 rounded-md">
            <Edit3 size={48} className="mb-4 text-slate-400"/>
            <p className="text-lg mb-2">Please select a section to edit.</p>
            <p className="text-sm mb-4">Or, create a new section if none exist or if you wish to add more.</p>
            {(!lessonId && sections.length === 0 && !isCreatingSection) && 
                <p className="text-amber-600 text-sm mb-2">This appears to be a new lesson. It may need to be saved first to get a Lesson ID before adding sections.</p>
            }
            {!isCreatingSection && (
                 <Button className="mt-2" variant="secondary" onClick={handleAddNewSectionClick}>
                    <PlusCircle size={18} className="mr-2" /> Add Section
                </Button>
            )}
          </div>
        )}
      </div>
    </div>
  );
};

export default LessonEditor;