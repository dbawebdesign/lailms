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
import { Eye } from 'lucide-react';

interface ContentRendererProps {
  content: any;
  className?: string;
  showStudentView?: boolean; // Option to show/hide the student view indicator
}

const ContentRenderer: React.FC<ContentRendererProps> = ({ 
  content, 
  className = '', 
  showStudentView = true 
}) => {
  const lowlightInstance = createLowlight();
  lowlightInstance.register('javascript', javascript);

  // Extract production-ready content from the lesson section structure
  const getProductionContent = (rawContent: any) => {
    // If content is null/undefined
    if (!rawContent) {
      return null;
    }

    // If content is a string, return as-is
    if (typeof rawContent === 'string') {
      return rawContent;
    }

    // If content is an object with lesson section structure (has 'text' field)
    if (typeof rawContent === 'object' && rawContent.text) {
      return rawContent.text;
    }

    // If content is TipTap JSON structure
    if (typeof rawContent === 'object' && rawContent.type === 'doc') {
      return rawContent;
    }

    // For quiz content or other structured content without text field
    if (typeof rawContent === 'object' && rawContent.questions) {
      return rawContent; // Let it be handled by quiz renderer
    }

    // For other object types, return the original content
    return rawContent;
  };

  const productionContent = getProductionContent(content);
  const hasMetadata = content && typeof content === 'object' && content.knowledge_base_integration;

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
    content: productionContent || '',
    editable: false, // Read-only mode
    editorProps: {
      attributes: {
        class: 'prose dark:prose-invert max-w-none focus:outline-none',
      },
    },
  });

  // Handle different content types
  const renderContent = () => {
    if (!productionContent) {
      return <p className="text-muted-foreground italic">No content available</p>;
    }

    // If content is a string, display it as formatted text with better styling
    if (typeof productionContent === 'string') {
      return (
        <div className="prose dark:prose-invert max-w-none">
          <div className="text-base leading-relaxed text-foreground whitespace-pre-wrap font-normal">
            {productionContent}
          </div>
        </div>
      );
    }

    // If content is TipTap JSON, render it with the editor
    if (typeof productionContent === 'object' && productionContent.type === 'doc') {
      return <EditorContent editor={editor} className={`${className} min-h-[100px]`} />;
    }

    // Handle quiz content
    if (typeof productionContent === 'object' && productionContent.questions) {
      return (
        <div className="prose dark:prose-invert max-w-none w-full">
          <h4 className="text-lg font-semibold mb-3">Quiz Questions</h4>
          <div className="w-full space-y-4">
            {productionContent.questions.map((question: any, index: number) => (
              <div key={index} className="w-full p-4 bg-muted/30 rounded-lg">
                <p className="font-medium mb-2">{index + 1}. {question.question}</p>
                {question.options && (
                  <div className="w-full">
                    <ul className="list-none space-y-1 ml-4">
                      {question.options.map((option: string, optIndex: number) => (
                        <li key={optIndex} className="text-sm">
                          <span className="text-muted-foreground">{String.fromCharCode(65 + optIndex)}.</span> {option}
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      );
    }

    // If content is an object but not TipTap or quiz format, try to display it nicely
    if (typeof productionContent === 'object') {
      try {
        return <pre className="whitespace-pre-wrap text-sm bg-muted p-4 rounded-md overflow-auto">{JSON.stringify(productionContent, null, 2)}</pre>;
      } catch (e) {
        return <p className="text-muted-foreground italic">Unable to display content</p>;
      }
    }

    return <p className="text-muted-foreground italic">Unknown content format</p>;
  };

  return (
    <div className={`content-renderer ${className}`}>
      {showStudentView && hasMetadata && (
        <div className="flex items-center gap-2 mb-4 pb-2 border-b border-border/50">
          <Eye className="h-3 w-3 text-muted-foreground" />
          <span className="text-xs text-muted-foreground font-medium">Student View</span>
        </div>
      )}
      <div className="min-h-[2rem]">
        {renderContent()}
      </div>
    </div>
  );
};

export default ContentRenderer; 