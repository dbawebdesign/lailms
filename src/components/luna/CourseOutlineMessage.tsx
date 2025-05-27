'use client';

import React from 'react';
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import { Badge } from "@/components/ui/badge";

// Re-define or import the type for the outline data
interface CourseOutlineModule {
  title: string;
  topics: string[];
  suggestedLessons?: { title: string; objective?: string }[];
  suggestedAssessments?: { type: string; description?: string }[];
}

interface GeneratedCourseOutline {
  baseClassName?: string;
  description?: string;
  subject?: string;
  gradeLevel?: string;
  lengthInWeeks?: number;
  modules: CourseOutlineModule[];
}

interface CourseOutlineMessageProps {
  outline: GeneratedCourseOutline;
}

export function CourseOutlineMessage({ outline }: CourseOutlineMessageProps) {
  if (!outline) return null;

  return (
    <div className="space-y-3 text-sm w-full max-w-full overflow-hidden min-w-0">
      {/* Display basic course info if available */}
      {outline.baseClassName && (
        <div className="break-words text-wrap overflow-hidden">
          <strong className="font-medium">Course Title:</strong> {outline.baseClassName}
        </div>
      )}
      {outline.description && (
        <div className="break-words text-wrap overflow-hidden">
          <strong className="font-medium">Description:</strong> {outline.description}
        </div>
      )}
      {(outline.subject || outline.gradeLevel || outline.lengthInWeeks) && (
        <div className="flex flex-wrap gap-x-2 gap-y-1 text-xs text-muted-foreground overflow-hidden">
          {outline.subject && <span className="break-words text-wrap">Subject: {outline.subject}</span>}
          {outline.gradeLevel && <span className="break-words text-wrap">Grade: {outline.gradeLevel}</span>}
          {outline.lengthInWeeks && <span className="break-words text-wrap">Length: {outline.lengthInWeeks} weeks</span>}
        </div>
      )}

      {/* Display Modules using Accordion */}
      {outline.modules && outline.modules.length > 0 && (
        <div className="mt-3 pt-3 border-t border-muted-foreground/20 w-full min-w-0">
          <h4 className="font-semibold mb-2 break-words text-wrap">Course Modules:</h4>
          <Accordion type="single" collapsible className="w-full min-w-0">
            {outline.modules.map((module, index) => (
              <AccordionItem key={`module-${index}`} value={`item-${index}`} className="border-b border-muted-foreground/10 min-w-0">
                <AccordionTrigger className="text-sm font-medium hover:no-underline py-2 text-left break-words text-wrap min-w-0">
                  <span className="break-words text-wrap pr-2 min-w-0 overflow-hidden">{module.title || `Module ${index + 1}`}</span>
                </AccordionTrigger>
                <AccordionContent className="pl-1 pt-2 pb-3 text-xs space-y-2 w-full max-w-full overflow-hidden min-w-0">
                  {/* Topics */}
                  {module.topics && module.topics.length > 0 && (
                    <div className="w-full min-w-0 overflow-hidden">
                      <strong className="font-medium text-foreground/90 block mb-1 break-words text-wrap">Topics:</strong>
                      <ul className="space-y-1 pl-2">
                        {module.topics.map((topic, tIndex) => (
                          <li key={`topic-${index}-${tIndex}`} className="break-words text-wrap leading-relaxed relative before:content-['•'] before:absolute before:-left-2 before:text-muted-foreground overflow-hidden">
                            {topic}
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}
                  
                  {/* Suggested Lessons */}
                  {module.suggestedLessons && module.suggestedLessons.length > 0 && (
                    <div className="w-full min-w-0 overflow-hidden">
                      <strong className="font-medium text-foreground/90 block mb-1 break-words text-wrap">Suggested Lessons:</strong>
                      <ul className="space-y-1 pl-2">
                        {module.suggestedLessons.map((lesson, lIndex) => (
                          <li key={`lesson-${index}-${lIndex}`} className="break-words text-wrap leading-relaxed relative before:content-['•'] before:absolute before:-left-2 before:text-muted-foreground overflow-hidden">
                            <div className="font-medium break-words text-wrap overflow-hidden">{lesson.title}</div>
                            {lesson.objective && (
                              <div className="italic text-muted-foreground text-xs mt-1 break-words text-wrap overflow-hidden">
                                Objective: {lesson.objective}
                              </div>
                            )}
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}
                  
                  {/* Suggested Assessments */}
                  {module.suggestedAssessments && module.suggestedAssessments.length > 0 && (
                    <div className="w-full min-w-0 overflow-hidden">
                      <strong className="font-medium text-foreground/90 block mb-1 break-words text-wrap">Suggested Assessments:</strong>
                      <div className="space-y-1">
                        {module.suggestedAssessments.map((assessment, aIndex) => (
                          <div key={`assessment-${index}-${aIndex}`} className="break-words text-wrap overflow-hidden">
                            <Badge variant="secondary" className="text-xs px-1 py-0.5 break-words max-w-full inline-block overflow-hidden">
                              <span className="break-words text-wrap">{assessment.type}</span>
                              {assessment.description && (
                                <span className="break-words text-wrap">: {assessment.description}</span>
                              )}
                            </Badge>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </AccordionContent>
              </AccordionItem>
            ))}
          </Accordion>
        </div>
      )}
    </div>
  );
} 