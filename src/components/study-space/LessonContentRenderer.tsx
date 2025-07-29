'use client';

import React from 'react';
import ReactMarkdown from 'react-markdown';
import { useEditor, EditorContent } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';
import { Table } from '@tiptap/extension-table';
import TableRow from '@tiptap/extension-table-row';
import TableCell from '@tiptap/extension-table-cell';
import TableHeader from '@tiptap/extension-table-header';
import { Image } from '@tiptap/extension-image';
import Link from '@tiptap/extension-link';
import { TaskList, TaskItem } from '@tiptap/extension-list';
import { Highlight } from '@tiptap/extension-highlight';
import { Mathematics } from '@tiptap/extension-mathematics';
import { Typography } from '@tiptap/extension-typography';
import { VideoNode } from '@/components/tiptap-node/video-node/video-node-extension';
import { Node } from '@tiptap/core';

// Simple YouTube iframe extension for student view
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
});

import { 
  BookOpen, 
  Brain, 
  Target, 
  Lightbulb, 
  Sparkles,
  CheckCircle2
} from 'lucide-react';
import LunaContextElement from '@/components/luna/LunaContextElement';

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

interface LessonContentRendererProps {
  content: LessonSectionContent;
  className?: string;
}

// Rich Content Renderer Component for HTML content with media
const RichContentRenderer = ({ content }: { content: string }) => {
  const editor = useEditor({
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
      YouTubeIframeExtension, // Include YouTube extension for student view
      Link.configure({ 
        openOnClick: true, 
        autolink: true 
      }),
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

  if (!editor) {
    return (
      <div className="prose prose-slate dark:prose-invert max-w-none">
        <ReactMarkdown>{content}</ReactMarkdown>
      </div>
    );
  }

  return (
    <div className="prose prose-slate dark:prose-invert max-w-none">
      <EditorContent editor={editor} />
    </div>
  );
};

// Enhanced Markdown Renderer with media support
const EnhancedMarkdownRenderer = ({ content }: { content: string }) => {
  // Process content to handle embedded media
  const processedContent = React.useMemo(() => {
    if (!content) return '';
    
    let processed = content;
    
    // Handle YouTube embeds in markdown format
    const youtubeRegex = /\[YouTube: ([^\]]+)\]\(https:\/\/(?:www\.)?youtube\.com\/watch\?v=([a-zA-Z0-9_-]+)\)/g;
    processed = processed.replace(youtubeRegex, (match: string, title: string, videoId: string) => {
      return `<div class="youtube-embed-wrapper my-4">
        <div class="relative w-full pb-[56.25%] h-0 overflow-hidden rounded-lg shadow-lg">
          <iframe
            class="absolute top-0 left-0 w-full h-full"
            src="https://www.youtube.com/embed/${videoId}?rel=0&modestbranding=1&showinfo=0"
            title="${title}"
            frameborder="0"
            allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
            allowfullscreen>
          </iframe>
        </div>
        <p class="text-sm text-gray-600 dark:text-gray-400 mt-2 text-center italic">${title}</p>
      </div>`;
    });
    
    // Handle video files in markdown format
    const videoRegex = /\[Video: ([^\]]+)\]\(([^)]+)\)/g;
    processed = processed.replace(videoRegex, (match: string, title: string, url: string) => {
      return `<div class="video-wrapper my-4">
        <video controls class="w-full rounded-lg shadow-md">
          <source src="${url}" type="video/mp4">
          Your browser does not support the video tag.
        </video>
        <p class="text-sm text-gray-600 dark:text-gray-400 mt-2 text-center italic">${title}</p>
      </div>`;
    });
    
    return processed;
  }, [content]);

  // If content contains HTML (like YouTube embeds), use dangerouslySetInnerHTML
  if (processedContent.includes('<div class="youtube-embed-wrapper') || processedContent.includes('<div class="video-wrapper')) {
    return (
      <div 
        className="prose prose-slate dark:prose-invert max-w-none"
        dangerouslySetInnerHTML={{ __html: processedContent }}
      />
    );
  }

  // Otherwise use ReactMarkdown
  return (
    <div className="prose prose-slate dark:prose-invert max-w-none">
      <ReactMarkdown>{processedContent}</ReactMarkdown>
    </div>
  );
};

export function LessonContentRenderer({ content, className = "" }: LessonContentRendererProps) {
  return (
    <LunaContextElement
      type="lesson-content"
      role="educational-content"
      content={{
        introduction: content.introduction,
        sectionTitle: content.sectionTitle,
        expertSummary: content.expertSummary,
        conceptIntroduction: content.expertTeachingContent?.conceptIntroduction,
        detailedExplanation: content.expertTeachingContent?.detailedExplanation,
        practicalExamples: content.expertTeachingContent?.practicalExamples?.map(ex => ({
          title: ex.title,
          context: ex.context,
          keyTakeaways: ex.keyTakeaways
        })),
        checkForUnderstanding: content.checkForUnderstanding,
        realWorldConnections: content.expertTeachingContent?.realWorldConnections,
        expertInsights: content.expertTeachingContent?.expertInsights
      }}
      metadata={{
        contentType: 'lesson-section',
        hasIntroduction: !!content.introduction,
        hasExpertContent: !!content.expertTeachingContent,
        hasExamples: !!(content.expertTeachingContent?.practicalExamples?.length),
        hasCheckForUnderstanding: !!(content.checkForUnderstanding?.length),
        contextDescription: 'Structured lesson content with expert teaching materials, examples, and understanding checks'
      }}
      actionable={true}
    >
      <div className={`space-y-6 ${className}`}>
      {/* Introduction */}
      {content.introduction && (
        <div className="bg-blue-50 dark:bg-blue-900/20 rounded-xl p-6 border border-blue-200 dark:border-blue-700/50">
          <h4 className="text-lg font-semibold text-blue-900 dark:text-blue-100 mb-3 flex items-center gap-2">
            <BookOpen className="h-5 w-5" />
            Introduction
          </h4>
          <EnhancedMarkdownRenderer content={content.introduction} />
        </div>
      )}

      {/* Concept Introduction */}
      {content.expertTeachingContent?.conceptIntroduction && (
        <div className="bg-purple-50 dark:bg-purple-900/20 rounded-xl p-6 border border-purple-200 dark:border-purple-700/50">
          <h4 className="text-lg font-semibold text-purple-900 dark:text-purple-100 mb-3 flex items-center gap-2">
            <Sparkles className="h-5 w-5" />
            Concept Introduction
          </h4>
          <EnhancedMarkdownRenderer content={content.expertTeachingContent.conceptIntroduction} />
        </div>
      )}

      {/* Main Content - Detailed Explanation with Rich Media Support */}
      {content.expertTeachingContent?.detailedExplanation && (
        <div className="bg-gray-50 dark:bg-gray-900/20 rounded-xl p-6 border border-gray-200 dark:border-gray-700/50">
          <h4 className="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-3 flex items-center gap-2">
            <Brain className="h-5 w-5" />
            Deep Dive
          </h4>
          {/* Use RichContentRenderer for HTML content with embedded media */}
          <RichContentRenderer content={content.expertTeachingContent.detailedExplanation} />
        </div>
      )}

      {/* Practical Examples */}
      {content.expertTeachingContent?.practicalExamples && content.expertTeachingContent.practicalExamples.length > 0 && (
        <div className="bg-green-50 dark:bg-green-900/20 rounded-xl p-6 border border-green-200 dark:border-green-700/50">
          <h4 className="text-lg font-semibold text-green-900 dark:text-green-100 mb-4 flex items-center gap-2">
            <Target className="h-5 w-5" />
            Practical Examples
          </h4>
          <div className="space-y-4">
            {content.expertTeachingContent.practicalExamples.map((example, index) => (
              <div key={index} className="bg-white dark:bg-gray-800 rounded-lg p-4 border border-green-200 dark:border-green-700/30">
                <h5 className="font-semibold text-green-800 dark:text-green-200 mb-2">{example.title}</h5>
                {example.context && (
                  <div className="text-green-700 dark:text-green-300 mb-2">
                    <EnhancedMarkdownRenderer content={example.context} />
                  </div>
                )}
                {example.walkthrough && (
                  <div className="text-green-700 dark:text-green-300 mb-3">
                    <EnhancedMarkdownRenderer content={example.walkthrough} />
                  </div>
                )}
                {example.keyTakeaways && example.keyTakeaways.length > 0 && (
                  <div className="mt-3">
                    <h6 className="font-medium text-green-800 dark:text-green-200 mb-2">Key Takeaways:</h6>
                    <ul className="list-disc list-inside text-green-700 dark:text-green-300 space-y-1">
                      {example.keyTakeaways.map((takeaway, takeawayIndex) => (
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

      {/* Common Misconceptions */}
      {content.expertTeachingContent?.commonMisconceptions && content.expertTeachingContent.commonMisconceptions.length > 0 && (
        <div className="bg-yellow-50 dark:bg-yellow-900/20 rounded-xl p-6 border border-yellow-200 dark:border-yellow-700/50">
          <h4 className="text-lg font-semibold text-yellow-900 dark:text-yellow-100 mb-4 flex items-center gap-2">
            <Lightbulb className="h-5 w-5" />
            Common Misconceptions
          </h4>
          <div className="space-y-4">
            {content.expertTeachingContent.commonMisconceptions.map((misconception, index) => (
              <div key={index} className="bg-white dark:bg-gray-800 rounded-lg p-4 border border-yellow-200 dark:border-yellow-700/30">
                <div className="mb-3">
                  <span className="font-semibold text-red-600 dark:text-red-400">Misconception: </span>
                  <span className="text-yellow-800 dark:text-yellow-200">{misconception.misconception}</span>
                </div>
                <div className="mb-2">
                  <span className="font-semibold text-green-600 dark:text-green-400">Correction: </span>
                  <span className="text-yellow-800 dark:text-yellow-200">{misconception.correction}</span>
                </div>
                <div>
                  <span className="font-semibold text-blue-600 dark:text-blue-400">Prevention: </span>
                  <span className="text-yellow-800 dark:text-yellow-200">{misconception.prevention}</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Expert Insights */}
      {content.expertTeachingContent?.expertInsights && content.expertTeachingContent.expertInsights.length > 0 && (
        <div className="bg-indigo-50 dark:bg-indigo-900/20 rounded-xl p-6 border border-indigo-200 dark:border-indigo-700/50">
          <h4 className="text-lg font-semibold text-indigo-900 dark:text-indigo-100 mb-3 flex items-center gap-2">
            <Brain className="h-5 w-5" />
            Expert Insights
          </h4>
          <ul className="space-y-2">
            {content.expertTeachingContent.expertInsights.map((insight, index) => (
              <li key={index} className="text-indigo-800 dark:text-indigo-200 flex items-start gap-2">
                <span className="text-indigo-500 dark:text-indigo-400 mt-1">•</span>
                <span>{insight}</span>
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* Real-World Connections */}
      {content.expertTeachingContent?.realWorldConnections && content.expertTeachingContent.realWorldConnections.length > 0 && (
        <div className="bg-orange-50 dark:bg-orange-900/20 rounded-xl p-6 border border-orange-200 dark:border-orange-700/50">
          <h4 className="text-lg font-semibold text-orange-900 dark:text-orange-100 mb-3 flex items-center gap-2">
            <Target className="h-5 w-5" />
            Real-World Connections
          </h4>
          <ul className="space-y-2">
            {content.expertTeachingContent.realWorldConnections.map((connection, index) => (
              <li key={index} className="text-orange-800 dark:text-orange-200 flex items-start gap-2">
                <span className="text-orange-500 dark:text-orange-400 mt-1">•</span>
                <span>{connection}</span>
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* Expert Summary */}
      {content.expertSummary && (
        <div className="bg-slate-50 dark:bg-slate-900/20 rounded-xl p-6 border border-slate-200 dark:border-slate-700/50">
          <h4 className="text-lg font-semibold text-slate-900 dark:text-slate-100 mb-3 flex items-center gap-2">
            <CheckCircle2 className="h-5 w-5" />
            Summary
          </h4>
          <EnhancedMarkdownRenderer content={content.expertSummary} />
        </div>
      )}

      {/* Check for Understanding */}
      {content.checkForUnderstanding && content.checkForUnderstanding.length > 0 && (
        <div className="bg-teal-50 dark:bg-teal-900/20 rounded-xl p-6 border border-teal-200 dark:border-teal-700/50">
          <h4 className="text-lg font-semibold text-teal-900 dark:text-teal-100 mb-3 flex items-center gap-2">
            <CheckCircle2 className="h-5 w-5" />
            Check Your Understanding
          </h4>
          <ul className="space-y-2">
            {content.checkForUnderstanding.map((question, index) => (
              <li key={index} className="text-teal-800 dark:text-teal-200 flex items-start gap-2">
                <span className="text-teal-500 dark:text-teal-400 mt-1">{index + 1}.</span>
                <span>{question}</span>
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* Bridge to Next */}
      {content.bridgeToNext && (
        <div className="bg-gray-50 dark:bg-gray-900/20 rounded-xl p-6 border border-gray-200 dark:border-gray-700/50">
          <h4 className="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-3">Coming Up Next</h4>
          <EnhancedMarkdownRenderer content={content.bridgeToNext} />
        </div>
      )}
    </div>
    </LunaContextElement>
  );
} 