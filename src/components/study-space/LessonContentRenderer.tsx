'use client';

import React from 'react';
import ReactMarkdown from 'react-markdown';
import { 
  BookOpen, 
  Brain, 
  Target, 
  Lightbulb, 
  Sparkles,
  CheckCircle2
} from 'lucide-react';

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

export function LessonContentRenderer({ content, className = "" }: LessonContentRendererProps) {
  return (
    <div className={`space-y-6 ${className}`}>
      {/* Introduction */}
      {content.introduction && (
        <div className="prose prose-slate dark:prose-invert max-w-none">
          <div className="bg-blue-50 dark:bg-blue-900/20 rounded-xl p-6 border border-blue-200 dark:border-blue-700/50">
            <h4 className="text-lg font-semibold text-blue-900 dark:text-blue-100 mb-3 flex items-center gap-2">
              <BookOpen className="h-5 w-5" />
              Introduction
            </h4>
            <ReactMarkdown className="text-blue-800 dark:text-blue-200 select-text">
              {content.introduction}
            </ReactMarkdown>
          </div>
        </div>
      )}

      {/* Concept Introduction */}
      {content.expertTeachingContent?.conceptIntroduction && (
        <div className="prose prose-slate dark:prose-invert max-w-none">
          <div className="bg-purple-50 dark:bg-purple-900/20 rounded-xl p-6 border border-purple-200 dark:border-purple-700/50">
            <h4 className="text-lg font-semibold text-purple-900 dark:text-purple-100 mb-3 flex items-center gap-2">
              <Sparkles className="h-5 w-5" />
              Concept Introduction
            </h4>
            <ReactMarkdown className="text-purple-800 dark:text-purple-200 select-text">
              {content.expertTeachingContent.conceptIntroduction}
            </ReactMarkdown>
          </div>
        </div>
      )}

      {/* Detailed Explanation */}
      {content.expertTeachingContent?.detailedExplanation && (
        <div className="prose prose-slate dark:prose-invert max-w-none">
          <div className="bg-white dark:bg-slate-800/50 rounded-xl p-6 border border-slate-200 dark:border-slate-700">
            <h4 className="text-lg font-semibold text-slate-900 dark:text-slate-100 mb-3 flex items-center gap-2">
              <Brain className="h-5 w-5" />
              Detailed Explanation
            </h4>
            <ReactMarkdown 
              className="text-slate-700 dark:text-slate-300 select-text"
              components={{
                h1: ({children}) => <h1 className="text-2xl font-bold mb-4 mt-6 first:mt-0 text-slate-900 dark:text-slate-100">{children}</h1>,
                h2: ({children}) => <h2 className="text-xl font-semibold mb-3 mt-5 first:mt-0 text-slate-800 dark:text-slate-200">{children}</h2>,
                h3: ({children}) => <h3 className="text-lg font-medium mb-2 mt-4 first:mt-0 text-slate-700 dark:text-slate-300">{children}</h3>,
                p: ({children}) => <p className="mb-4 leading-relaxed">{children}</p>,
                ul: ({children}) => <ul className="mb-4 space-y-2 list-disc list-inside">{children}</ul>,
                ol: ({children}) => <ol className="mb-4 space-y-2 list-decimal list-inside">{children}</ol>,
                li: ({children}) => <li className="ml-4">{children}</li>,
                strong: ({children}) => <strong className="font-semibold text-slate-900 dark:text-slate-100">{children}</strong>,
                em: ({children}) => <em className="italic">{children}</em>
              }}
            >
              {content.expertTeachingContent.detailedExplanation}
            </ReactMarkdown>
          </div>
        </div>
      )}

      {/* Expert Summary */}
      {content.expertSummary && (
        <div className="prose prose-slate dark:prose-invert max-w-none">
          <div className="bg-green-50 dark:bg-green-900/20 rounded-xl p-6 border border-green-200 dark:border-green-700/50">
            <h4 className="text-lg font-semibold text-green-900 dark:text-green-100 mb-3 flex items-center gap-2">
              <Target className="h-5 w-5" />
              Expert Summary
            </h4>
            <ReactMarkdown className="text-green-800 dark:text-green-200 select-text">
              {content.expertSummary}
            </ReactMarkdown>
          </div>
        </div>
      )}

      {/* Practical Examples */}
      {content.expertTeachingContent?.practicalExamples && content.expertTeachingContent.practicalExamples.length > 0 && (
        <div className="prose prose-slate dark:prose-invert max-w-none">
          <div className="bg-orange-50 dark:bg-orange-900/20 rounded-xl p-6 border border-orange-200 dark:border-orange-700/50">
            <h4 className="text-lg font-semibold text-orange-900 dark:text-orange-100 mb-4 flex items-center gap-2">
              <Lightbulb className="h-5 w-5" />
              Practical Examples
            </h4>
            {content.expertTeachingContent.practicalExamples.map((example, index) => (
              <div key={index} className="mb-6 last:mb-0">
                <h5 className="font-semibold text-orange-800 dark:text-orange-200 mb-2">{example.title}</h5>
                {example.context && (
                  <p className="text-sm text-orange-700 dark:text-orange-300 mb-2 italic">{example.context}</p>
                )}
                {example.walkthrough && (
                  <ReactMarkdown className="text-orange-800 dark:text-orange-200 select-text mb-3">
                    {example.walkthrough}
                  </ReactMarkdown>
                )}
                {example.keyTakeaways && example.keyTakeaways.length > 0 && (
                  <div>
                    <p className="font-medium text-orange-900 dark:text-orange-100 mb-2">Key Takeaways:</p>
                    <ul className="list-disc list-inside space-y-1">
                      {example.keyTakeaways.map((takeaway, i) => (
                        <li key={i} className="text-orange-800 dark:text-orange-200 text-sm">{takeaway}</li>
                      ))}
                    </ul>
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Check for Understanding */}
      {content.checkForUnderstanding && content.checkForUnderstanding.length > 0 && (
        <div className="prose prose-slate dark:prose-invert max-w-none">
          <div className="bg-indigo-50 dark:bg-indigo-900/20 rounded-xl p-6 border border-indigo-200 dark:border-indigo-700/50">
            <h4 className="text-lg font-semibold text-indigo-900 dark:text-indigo-100 mb-4 flex items-center gap-2">
              <CheckCircle2 className="h-5 w-5" />
              Check for Understanding
            </h4>
            <ul className="space-y-3">
              {content.checkForUnderstanding.map((question, index) => (
                <li key={index} className="text-indigo-800 dark:text-indigo-200 select-text">{question}</li>
              ))}
            </ul>
          </div>
        </div>
      )}
    </div>
  );
} 