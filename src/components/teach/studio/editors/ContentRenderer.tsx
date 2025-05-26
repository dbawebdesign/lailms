import React from 'react';
import { useEditor, EditorContent } from '@tiptap/react';
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

interface ContentRendererProps {
  content: any;
  className?: string;
}

const ContentRenderer: React.FC<ContentRendererProps> = ({ content, className = '' }) => {
  const lowlightInstance = createLowlight();
  lowlightInstance.register('javascript', javascript);

  const editor = useEditor({
    extensions: [
      StarterKit,
      Table.configure({
        resizable: true,
      }),
      TableRow,
      TableHeader,
      TableCell,
      Image,
      Link.configure({
        openOnClick: true,
        autolink: true,
      }),
      CodeBlockLowlight.configure({
        lowlight: lowlightInstance,
      }),
    ],
    content: content || '',
    editable: false, // Read-only mode
    editorProps: {
      attributes: {
        class: 'prose dark:prose-invert max-w-none focus:outline-none',
      },
    },
  });

  // Handle different content types
  const renderContent = () => {
    if (!content) {
      return <p className="text-muted-foreground italic">No content available</p>;
    }

    // If content is a string, display it as plain text
    if (typeof content === 'string') {
      return <div className="whitespace-pre-wrap">{content}</div>;
    }

    // If content is TipTap JSON, render it with the editor
    if (typeof content === 'object' && content.type === 'doc') {
      return <EditorContent editor={editor} className={`${className} min-h-[100px]`} />;
    }

    // If content is an object but not TipTap format, try to display it nicely
    if (typeof content === 'object') {
      try {
        return <pre className="whitespace-pre-wrap text-sm bg-muted p-4 rounded-md overflow-auto">{JSON.stringify(content, null, 2)}</pre>;
      } catch (e) {
        return <p className="text-muted-foreground italic">Unable to display content</p>;
      }
    }

    return <p className="text-muted-foreground italic">Unknown content format</p>;
  };

  return (
    <div className={`content-renderer ${className}`}>
      {renderContent()}
    </div>
  );
};

export default ContentRenderer; 