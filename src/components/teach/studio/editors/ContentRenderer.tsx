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
  sectionType?: string; // Optional section type for better display context
}

const ContentRenderer: React.FC<ContentRendererProps> = ({ 
  content, 
  className = '', 
  showStudentView = true,
  sectionType
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

    // Handle structured lesson content (introduction, main_content, activities, etc.)
    if (typeof productionContent === 'object' && (productionContent.introduction || productionContent.main_content || productionContent.activities)) {
      return (
        <div className="prose dark:prose-invert max-w-none space-y-6">
          {/* Introduction */}
          {productionContent.introduction && (
            <div className="bg-blue-50 dark:bg-blue-950/20 p-4 rounded-lg border-l-4 border-blue-500">
              <h4 className="text-lg font-semibold mb-2 text-blue-900 dark:text-blue-100">Introduction</h4>
              <p className="text-blue-800 dark:text-blue-200 leading-relaxed">{productionContent.introduction}</p>
            </div>
          )}

          {/* Activities */}
          {productionContent.activities && productionContent.activities.length > 0 && (
            <div className="bg-green-50 dark:bg-green-950/20 p-4 rounded-lg border-l-4 border-green-500">
              <h4 className="text-lg font-semibold mb-3 text-green-900 dark:text-green-100">Activities</h4>
              <div className="space-y-3">
                {productionContent.activities.map((activity: any, index: number) => (
                  <div key={index} className="bg-white dark:bg-green-900/20 p-3 rounded border">
                    <div className="flex items-center gap-2 mb-2">
                      <span className="text-sm font-medium text-green-700 dark:text-green-300 capitalize">
                        {activity.type || 'Activity'}
                      </span>
                      {activity.duration && (
                        <span className="text-xs text-green-600 dark:text-green-400 bg-green-100 dark:bg-green-800 px-2 py-1 rounded">
                          {activity.duration}
                        </span>
                      )}
                    </div>
                    <p className="text-green-800 dark:text-green-200 text-sm leading-relaxed">
                      {activity.instruction}
                    </p>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Main Content */}
          {productionContent.main_content && productionContent.main_content.length > 0 && (
            <div className="space-y-4">
              {productionContent.main_content.map((section: any, index: number) => (
                <div key={index} className="bg-gray-50 dark:bg-gray-900/50 p-4 rounded-lg">
                  {section.heading && (
                    <h4 className="text-lg font-semibold mb-3 text-foreground">{section.heading}</h4>
                  )}
                  {section.content && (
                    <p className="text-foreground leading-relaxed mb-3">{section.content}</p>
                  )}
                  {section.key_points && section.key_points.length > 0 && (
                    <div className="mb-3">
                      <h5 className="font-medium text-foreground mb-2">Key Points:</h5>
                      <ul className="list-disc list-inside space-y-1 text-foreground">
                        {section.key_points.map((point: string, pointIndex: number) => (
                          <li key={pointIndex} className="text-sm">{point}</li>
                        ))}
                      </ul>
                    </div>
                  )}
                  {section.examples && section.examples.length > 0 && (
                    <div className="bg-yellow-50 dark:bg-yellow-950/20 p-3 rounded border-l-4 border-yellow-400">
                      <h5 className="font-medium text-yellow-900 dark:text-yellow-100 mb-2">Examples:</h5>
                      <ul className="space-y-1">
                        {section.examples.map((example: string, exampleIndex: number) => (
                          <li key={exampleIndex} className="text-sm text-yellow-800 dark:text-yellow-200">
                            • {example}
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}

          {/* Key Takeaways */}
          {productionContent.key_takeaways && productionContent.key_takeaways.length > 0 && (
            <div className="bg-purple-50 dark:bg-purple-950/20 p-4 rounded-lg border-l-4 border-purple-500">
              <h4 className="text-lg font-semibold mb-3 text-purple-900 dark:text-purple-100">Key Takeaways</h4>
              <ul className="list-disc list-inside space-y-2">
                {productionContent.key_takeaways.map((takeaway: string, index: number) => (
                  <li key={index} className="text-purple-800 dark:text-purple-200 leading-relaxed">
                    {takeaway}
                  </li>
                ))}
              </ul>
            </div>
          )}

          {/* Additional Resources */}
          {productionContent.additional_resources && productionContent.additional_resources.length > 0 && (
            <div className="bg-gray-50 dark:bg-gray-900/50 p-4 rounded-lg">
              <h4 className="text-lg font-semibold mb-3 text-foreground">Additional Resources</h4>
              <ul className="space-y-1">
                {productionContent.additional_resources.map((resource: string, index: number) => (
                  <li key={index} className="text-sm">
                    {resource.startsWith('http') ? (
                      <a href={resource} target="_blank" rel="noopener noreferrer" 
                         className="text-blue-600 dark:text-blue-400 hover:underline">
                        {resource}
                      </a>
                    ) : (
                      <span className="text-foreground">{resource}</span>
                    )}
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
      );
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

    // If content is an object but not a recognized format, try to display it nicely
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
      {showStudentView && (hasMetadata || sectionType) && (
        <div className="flex items-center gap-2 mb-4 pb-2 border-b border-border/50">
          <Eye className="h-3 w-3 text-muted-foreground" />
          <span className="text-xs text-muted-foreground font-medium">
            Student View
            {sectionType && ` • ${sectionType.replace('_', ' ').replace(/\b\w/g, l => l.toUpperCase())}`}
          </span>
        </div>
      )}
      <div className="min-h-[2rem]">
        {renderContent()}
      </div>
    </div>
  );
};

export default ContentRenderer; 