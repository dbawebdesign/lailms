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
import { Eye, Lightbulb, Brain, CheckCircle, ArrowRight, BookOpen, Target, AlertTriangle, Users, Zap } from 'lucide-react';

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

  const renderContent = () => {
    if (!productionContent) {
      return <p className="text-muted-foreground italic">No content available</p>;
    }

    // Handle AI-generated educational content with expert teaching structure
    if (typeof productionContent === 'object' && (
      productionContent.expertTeachingContent || 
      productionContent.introduction || 
      productionContent.expertSummary || 
      productionContent.checkForUnderstanding ||
      productionContent.bridgeToNext
    )) {
      return (
        <div className="max-w-none space-y-8 bg-gradient-to-br from-slate-50 to-blue-50 dark:from-slate-900 dark:to-blue-900/20 p-6 rounded-lg">
          {/* Section Title */}
          {productionContent.sectionTitle && (
            <div className="text-center mb-8">
              <h1 className="text-3xl font-bold text-slate-800 dark:text-slate-200 mb-2">
                {productionContent.sectionTitle}
              </h1>
              <div className="w-24 h-1 bg-gradient-to-r from-blue-500 to-purple-500 mx-auto rounded-full"></div>
            </div>
          )}

          {/* Introduction */}
          {productionContent.introduction && (
            <div className="bg-gradient-to-r from-blue-50 to-indigo-50 dark:from-blue-950/30 dark:to-indigo-950/30 p-6 rounded-xl border-l-4 border-blue-500 shadow-sm">
              <div className="flex items-start space-x-3 mb-3">
                <BookOpen className="h-6 w-6 text-blue-600 dark:text-blue-400 mt-1 flex-shrink-0" />
                <h2 className="text-xl font-semibold text-blue-900 dark:text-blue-100">Introduction</h2>
              </div>
              <div className="text-blue-800 dark:text-blue-200 leading-relaxed text-lg pl-9">
                {productionContent.introduction}
              </div>
            </div>
          )}

          {/* Expert Teaching Content - Main Content */}
          {productionContent.expertTeachingContent && (
            <div className="space-y-6">
              {/* Concept Introduction */}
              {productionContent.expertTeachingContent.conceptIntroduction && (
                <div className="bg-gradient-to-r from-purple-50 to-pink-50 dark:from-purple-950/30 dark:to-pink-950/30 p-6 rounded-xl border-l-4 border-purple-500 shadow-sm">
                  <div className="flex items-start space-x-3 mb-4">
                    <Target className="h-6 w-6 text-purple-600 dark:text-purple-400 mt-1 flex-shrink-0" />
                    <h2 className="text-xl font-semibold text-purple-900 dark:text-purple-100">Key Concept</h2>
                  </div>
                  <div className="text-purple-800 dark:text-purple-200 leading-relaxed text-lg pl-9">
                    {productionContent.expertTeachingContent.conceptIntroduction}
                  </div>
                </div>
              )}

              {/* Detailed Explanation */}
              {productionContent.expertTeachingContent.detailedExplanation && (
                <div className="bg-white dark:bg-slate-800 p-6 rounded-xl border border-slate-200 dark:border-slate-700 shadow-sm">
                  <div className="flex items-start space-x-3 mb-4">
                    <Brain className="h-6 w-6 text-slate-600 dark:text-slate-400 mt-1 flex-shrink-0" />
                    <h2 className="text-xl font-semibold text-slate-900 dark:text-slate-100">Deep Dive</h2>
                  </div>
                  <div className="text-slate-800 dark:text-slate-200 leading-relaxed text-base pl-9 space-y-4">
                    {productionContent.expertTeachingContent.detailedExplanation.split('\n\n').map((paragraph: string, index: number) => (
                      <p key={index} className="text-justify">{paragraph}</p>
                    ))}
                  </div>
                </div>
              )}

              {/* Expert Insights */}
              {productionContent.expertTeachingContent.expertInsights && productionContent.expertTeachingContent.expertInsights.length > 0 && (
                <div className="bg-gradient-to-r from-amber-50 to-orange-50 dark:from-amber-950/30 dark:to-orange-950/30 p-6 rounded-xl border-l-4 border-amber-500 shadow-sm">
                  <div className="flex items-start space-x-3 mb-4">
                    <Lightbulb className="h-6 w-6 text-amber-600 dark:text-amber-400 mt-1 flex-shrink-0" />
                    <h2 className="text-xl font-semibold text-amber-900 dark:text-amber-100">Expert Insights</h2>
                  </div>
                  <div className="space-y-3 pl-9">
                    {productionContent.expertTeachingContent.expertInsights.map((insight: string, index: number) => (
                      <div key={index} className="flex items-start space-x-3">
                        <Zap className="h-4 w-4 text-amber-600 dark:text-amber-400 mt-1 flex-shrink-0" />
                        <p className="text-amber-800 dark:text-amber-200 leading-relaxed">{insight}</p>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Practical Examples */}
              {productionContent.expertTeachingContent.practicalExamples && productionContent.expertTeachingContent.practicalExamples.length > 0 && (
                <div className="bg-gradient-to-r from-green-50 to-emerald-50 dark:from-green-950/30 dark:to-emerald-950/30 p-6 rounded-xl border-l-4 border-green-500 shadow-sm">
                  <div className="flex items-start space-x-3 mb-4">
                    <Users className="h-6 w-6 text-green-600 dark:text-green-400 mt-1 flex-shrink-0" />
                    <h2 className="text-xl font-semibold text-green-900 dark:text-green-100">Examples & Applications</h2>
                  </div>
                  <div className="space-y-4 pl-9">
                    {productionContent.expertTeachingContent.practicalExamples.map((example: any, index: number) => (
                      <div key={index} className="bg-white dark:bg-green-900/20 p-4 rounded-lg border border-green-200 dark:border-green-800">
                        {/* Handle structured example object */}
                        {typeof example === 'object' && example.title ? (
                          <div className="space-y-3">
                            <h3 className="font-semibold text-green-900 dark:text-green-100">{example.title}</h3>
                            {example.context && (
                              <div className="text-green-800 dark:text-green-200 text-sm">
                                <strong>Context:</strong> {example.context}
                              </div>
                            )}
                            {example.walkthrough && (
                              <div className="text-green-800 dark:text-green-200">
                                <strong>Walkthrough:</strong> {example.walkthrough}
                              </div>
                            )}
                            {example.keyTakeaways && Array.isArray(example.keyTakeaways) && example.keyTakeaways.length > 0 && (
                              <div className="text-green-800 dark:text-green-200">
                                <strong>Key Takeaways:</strong>
                                <ul className="list-disc list-inside mt-1 ml-4 space-y-1">
                                  {example.keyTakeaways.map((takeaway: string, takeawayIndex: number) => (
                                    <li key={takeawayIndex}>{takeaway}</li>
                                  ))}
                                </ul>
                              </div>
                            )}
                          </div>
                        ) : (
                          /* Handle simple string examples */
                          <p className="text-green-800 dark:text-green-200 leading-relaxed">
                            {typeof example === 'string' ? example : JSON.stringify(example)}
                          </p>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Common Misconceptions */}
              {productionContent.expertTeachingContent.commonMisconceptions && productionContent.expertTeachingContent.commonMisconceptions.length > 0 && (
                <div className="bg-gradient-to-r from-red-50 to-rose-50 dark:from-red-950/30 dark:to-rose-950/30 p-6 rounded-xl border-l-4 border-red-500 shadow-sm">
                  <div className="flex items-start space-x-3 mb-4">
                    <AlertTriangle className="h-6 w-6 text-red-600 dark:text-red-400 mt-1 flex-shrink-0" />
                    <h2 className="text-xl font-semibold text-red-900 dark:text-red-100">Common Pitfalls to Avoid</h2>
                  </div>
                  <div className="space-y-3 pl-9">
                    {productionContent.expertTeachingContent.commonMisconceptions.map((misconception: any, index: number) => (
                      <div key={index} className="bg-white dark:bg-red-900/20 p-4 rounded-lg border border-red-200 dark:border-red-800 space-y-2">
                        {/* Handle structured misconception object */}
                        {typeof misconception === 'object' && misconception.misconception ? (
                          <div className="space-y-2">
                            <div className="flex items-start space-x-3">
                              <div className="w-2 h-2 bg-red-500 rounded-full mt-2 flex-shrink-0"></div>
                              <div>
                                <p className="text-red-800 dark:text-red-200 leading-relaxed font-medium">
                                  <strong>Misconception:</strong> {misconception.misconception}
                                </p>
                              </div>
                            </div>
                            {misconception.correction && (
                              <div className="ml-5 text-red-700 dark:text-red-300">
                                <strong>Correction:</strong> {misconception.correction}
                              </div>
                            )}
                            {misconception.prevention && (
                              <div className="ml-5 text-red-600 dark:text-red-400 text-sm">
                                <strong>How to avoid:</strong> {misconception.prevention}
                              </div>
                            )}
                          </div>
                        ) : (
                          /* Handle simple string misconceptions */
                          <div className="flex items-start space-x-3">
                            <div className="w-2 h-2 bg-red-500 rounded-full mt-2 flex-shrink-0"></div>
                            <p className="text-red-800 dark:text-red-200 leading-relaxed">
                              {typeof misconception === 'string' ? misconception : JSON.stringify(misconception)}
                            </p>
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Real World Connections */}
              {productionContent.expertTeachingContent.realWorldConnections && productionContent.expertTeachingContent.realWorldConnections.length > 0 && (
                <div className="bg-gradient-to-r from-cyan-50 to-teal-50 dark:from-cyan-950/30 dark:to-teal-950/30 p-6 rounded-xl border-l-4 border-cyan-500 shadow-sm">
                  <div className="flex items-start space-x-3 mb-4">
                    <Target className="h-6 w-6 text-cyan-600 dark:text-cyan-400 mt-1 flex-shrink-0" />
                    <h2 className="text-xl font-semibold text-cyan-900 dark:text-cyan-100">Real-World Applications</h2>
                  </div>
                  <div className="space-y-3 pl-9">
                    {productionContent.expertTeachingContent.realWorldConnections.map((connection: string, index: number) => (
                      <div key={index} className="flex items-start space-x-3">
                        <ArrowRight className="h-4 w-4 text-cyan-600 dark:text-cyan-400 mt-1 flex-shrink-0" />
                        <p className="text-cyan-800 dark:text-cyan-200 leading-relaxed">{connection}</p>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Check for Understanding */}
          {productionContent.checkForUnderstanding && productionContent.checkForUnderstanding.length > 0 && (
            <div className="bg-gradient-to-r from-violet-50 to-purple-50 dark:from-violet-950/30 dark:to-purple-950/30 p-6 rounded-xl border-l-4 border-violet-500 shadow-sm">
              <div className="flex items-start space-x-3 mb-4">
                <CheckCircle className="h-6 w-6 text-violet-600 dark:text-violet-400 mt-1 flex-shrink-0" />
                <h2 className="text-xl font-semibold text-violet-900 dark:text-violet-100">Check Your Understanding</h2>
              </div>
              <div className="space-y-4 pl-9">
                {productionContent.checkForUnderstanding.map((question: string, index: number) => (
                  <div key={index} className="bg-white dark:bg-violet-900/20 p-4 rounded-lg border border-violet-200 dark:border-violet-800">
                    <div className="flex items-start space-x-3">
                      <span className="flex-shrink-0 w-6 h-6 bg-violet-100 dark:bg-violet-800 text-violet-700 dark:text-violet-300 rounded-full flex items-center justify-center text-sm font-semibold">
                        {index + 1}
                      </span>
                      <p className="text-violet-800 dark:text-violet-200 leading-relaxed">{question}</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Expert Summary */}
          {productionContent.expertSummary && (
            <div className="bg-gradient-to-r from-slate-100 to-gray-100 dark:from-slate-800 dark:to-gray-800 p-6 rounded-xl border-l-4 border-slate-500 shadow-sm">
              <div className="flex items-start space-x-3 mb-4">
                <Brain className="h-6 w-6 text-slate-600 dark:text-slate-400 mt-1 flex-shrink-0" />
                <h2 className="text-xl font-semibold text-slate-900 dark:text-slate-100">Key Takeaways</h2>
              </div>
              <div className="text-slate-800 dark:text-slate-200 leading-relaxed text-lg pl-9 font-medium bg-white dark:bg-slate-900/50 p-4 rounded-lg border border-slate-200 dark:border-slate-700">
                {productionContent.expertSummary}
              </div>
            </div>
          )}

          {/* Bridge to Next */}
          {productionContent.bridgeToNext && (
            <div className="bg-gradient-to-r from-indigo-50 to-blue-50 dark:from-indigo-950/30 dark:to-blue-950/30 p-6 rounded-xl border-l-4 border-indigo-500 shadow-sm">
              <div className="flex items-start space-x-3 mb-4">
                <ArrowRight className="h-6 w-6 text-indigo-600 dark:text-indigo-400 mt-1 flex-shrink-0" />
                <h2 className="text-xl font-semibold text-indigo-900 dark:text-indigo-100">What's Next?</h2>
              </div>
              <div className="text-indigo-800 dark:text-indigo-200 leading-relaxed text-base pl-9">
                {productionContent.bridgeToNext}
              </div>
            </div>
          )}
        </div>
      );
    }

    // Handle structured lesson content (original structure)
    if (typeof productionContent === 'object' && (
        productionContent.introduction || 
        productionContent.main_content || 
        productionContent.main_teaching_content ||
        productionContent.activities ||
        productionContent.key_concepts ||
        productionContent.key_takeaways ||
        productionContent.comprehension_checks ||
        productionContent.independent_practice ||
        productionContent.common_misconceptions ||
        productionContent.section_summary
      )) {
      return (
        <div className="prose dark:prose-invert max-w-none space-y-6">
          {/* Introduction */}
          {productionContent.introduction && (
            <div className="bg-blue-50 dark:bg-blue-950/20 p-4 rounded-lg border-l-4 border-blue-500">
              <h4 className="text-lg font-semibold mb-2 text-blue-900 dark:text-blue-100">Introduction</h4>
              <p className="text-blue-800 dark:text-blue-200 leading-relaxed">{productionContent.introduction}</p>
            </div>
          )}

          {/* Key Concepts */}
          {productionContent.key_concepts && productionContent.key_concepts.length > 0 && (
            <div className="bg-indigo-50 dark:bg-indigo-950/20 p-4 rounded-lg border-l-4 border-indigo-500">
              <h4 className="text-lg font-semibold mb-3 text-indigo-900 dark:text-indigo-100">Key Concepts</h4>
              <ul className="list-disc list-inside space-y-2">
                {productionContent.key_concepts.map((concept: string, index: number) => (
                  <li key={index} className="text-indigo-800 dark:text-indigo-200 leading-relaxed">
                    {concept}
                  </li>
                ))}
              </ul>
            </div>
          )}

          {/* Main Teaching Content */}
          {productionContent.main_teaching_content && productionContent.main_teaching_content.length > 0 && (
            <div className="space-y-4">
              {productionContent.main_teaching_content.map((section: any, index: number) => (
                <div key={index} className="bg-gray-50 dark:bg-gray-900/50 p-4 rounded-lg">
                  {section.concept_title && (
                    <h4 className="text-lg font-semibold mb-3 text-foreground">{section.concept_title}</h4>
                  )}
                  {section.explanation && (
                    <p className="text-foreground leading-relaxed mb-3">{section.explanation}</p>
                  )}
                  
                  {/* Guided Practice */}
                  {section.guided_practice && (
                    <div className="bg-amber-50 dark:bg-amber-950/20 p-3 rounded border-l-4 border-amber-400 mb-3">
                      <h5 className="font-medium text-amber-900 dark:text-amber-100 mb-2">Guided Practice</h5>
                      <p className="text-sm text-amber-800 dark:text-amber-200 mb-2">{section.guided_practice.activity}</p>
                      {section.guided_practice.instructions && (
                        <p className="text-xs text-amber-700 dark:text-amber-300 mb-2">
                          <strong>Instructions:</strong> {section.guided_practice.instructions}
                        </p>
                      )}
                      {section.guided_practice.expected_outcome && (
                        <p className="text-xs text-amber-700 dark:text-amber-300">
                          <strong>Expected Outcome:</strong> {section.guided_practice.expected_outcome}
                        </p>
                      )}
                    </div>
                  )}

                  {/* Examples */}
                  {section.examples && section.examples.length > 0 && (
                    <div className="bg-green-50 dark:bg-green-950/20 p-3 rounded border-l-4 border-green-400 mb-3">
                      <h5 className="font-medium text-green-900 dark:text-green-100 mb-2">Examples</h5>
                      <div className="space-y-2">
                        {section.examples.map((example: string, exIndex: number) => (
                          <p key={exIndex} className="text-sm text-green-800 dark:text-green-200">
                            {example}
                          </p>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              ))}
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
                      {activity.instruction || activity.activity}
                    </p>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Independent Practice */}
          {productionContent.independent_practice && (
            <div className="bg-purple-50 dark:bg-purple-950/20 p-4 rounded-lg border-l-4 border-purple-500">
              <h4 className="text-lg font-semibold mb-3 text-purple-900 dark:text-purple-100">Independent Practice</h4>
              <p className="text-purple-800 dark:text-purple-200 leading-relaxed">{productionContent.independent_practice}</p>
            </div>
          )}

          {/* Comprehension Checks */}
          {productionContent.comprehension_checks && productionContent.comprehension_checks.length > 0 && (
            <div className="bg-orange-50 dark:bg-orange-950/20 p-4 rounded-lg border-l-4 border-orange-500">
              <h4 className="text-lg font-semibold mb-3 text-orange-900 dark:text-orange-100">Check Your Understanding</h4>
              <div className="space-y-2">
                {productionContent.comprehension_checks.map((check: string, index: number) => (
                  <p key={index} className="text-orange-800 dark:text-orange-200 leading-relaxed">
                    <strong>{index + 1}.</strong> {check}
                  </p>
                ))}
              </div>
            </div>
          )}

          {/* Common Misconceptions */}
          {productionContent.common_misconceptions && productionContent.common_misconceptions.length > 0 && (
            <div className="bg-red-50 dark:bg-red-950/20 p-4 rounded-lg border-l-4 border-red-500">
              <h4 className="text-lg font-semibold mb-3 text-red-900 dark:text-red-100">Common Misconceptions</h4>
              <div className="space-y-2">
                {productionContent.common_misconceptions.map((misconception: string, index: number) => (
                  <p key={index} className="text-red-800 dark:text-red-200 leading-relaxed">
                    • {misconception}
                  </p>
                ))}
              </div>
            </div>
          )}

          {/* Key Takeaways */}
          {productionContent.key_takeaways && productionContent.key_takeaways.length > 0 && (
            <div className="bg-gray-50 dark:bg-gray-900/50 p-4 rounded-lg border-l-4 border-gray-500">
              <h4 className="text-lg font-semibold mb-3 text-gray-900 dark:text-gray-100">Key Takeaways</h4>
              <ul className="list-disc list-inside space-y-2">
                {productionContent.key_takeaways.map((takeaway: string, index: number) => (
                  <li key={index} className="text-gray-800 dark:text-gray-200 leading-relaxed">
                    {takeaway}
                  </li>
                ))}
              </ul>
            </div>
          )}

          {/* Section Summary */}
          {productionContent.section_summary && (
            <div className="bg-teal-50 dark:bg-teal-950/20 p-4 rounded-lg border-l-4 border-teal-500">
              <h4 className="text-lg font-semibold mb-2 text-teal-900 dark:text-teal-100">Summary</h4>
              <p className="text-teal-800 dark:text-teal-200 leading-relaxed">{productionContent.section_summary}</p>
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

    // Handle TipTap editor content
    if (editor && (typeof productionContent === 'string' || (typeof productionContent === 'object' && productionContent.type === 'doc'))) {
      return <EditorContent editor={editor} />;
    }

    // Handle simple string content
    if (typeof productionContent === 'string') {
      return (
        <div className="prose dark:prose-invert max-w-none">
          <p className="leading-relaxed whitespace-pre-wrap">{productionContent}</p>
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