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
    <div className="space-y-3 text-sm">
      {/* Display basic course info if available */}
      {outline.baseClassName && <p><strong className="font-medium">Course Title:</strong> {outline.baseClassName}</p>}
      {outline.description && <p><strong className="font-medium">Description:</strong> {outline.description}</p>}
      {(outline.subject || outline.gradeLevel || outline.lengthInWeeks) && (
        <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted-foreground">
          {outline.subject && <span>Subject: {outline.subject}</span>}
          {outline.gradeLevel && <span>Grade: {outline.gradeLevel}</span>}
          {outline.lengthInWeeks && <span>Length: {outline.lengthInWeeks} weeks</span>}
        </div>
      )}

      {/* Display Modules using Accordion */}
      {outline.modules && outline.modules.length > 0 && (
        <div className="mt-3 pt-3 border-t border-muted-foreground/20">
          <h4 className="font-semibold mb-2">Course Modules:</h4>
          <Accordion type="single" collapsible className="w-full">
            {outline.modules.map((module, index) => (
              <AccordionItem key={`module-${index}`} value={`item-${index}`}>
                <AccordionTrigger className="text-sm font-medium hover:no-underline py-2">
                  {module.title || `Module ${index + 1}`}
                </AccordionTrigger>
                <AccordionContent className="pl-4 pt-2 pb-3 text-xs space-y-2 overflow-x-hidden break-words">
                  {/* Topics */}
                  {module.topics && module.topics.length > 0 && (
                    <div>
                      <strong className="font-medium text-foreground/90">Topics:</strong>
                      <ul className="list-disc list-outside pl-5 mt-1 space-y-0.5">
                        {module.topics.map((topic, tIndex) => (
                          <li key={`topic-${index}-${tIndex}`} className="break-words">{topic}</li>
                        ))}
                      </ul>
                    </div>
                  )}
                  {/* Suggested Lessons */}
                  {module.suggestedLessons && module.suggestedLessons.length > 0 && (
                    <div className="mt-2">
                      <strong className="font-medium text-foreground/90">Suggested Lessons:</strong>
                      <ul className="list-disc list-outside pl-5 mt-1 space-y-0.5">
                        {module.suggestedLessons.map((lesson, lIndex) => (
                          <li key={`lesson-${index}-${lIndex}`} className="break-words">
                            {lesson.title}
                            {lesson.objective && <span className="italic text-muted-foreground block text-wrap"> - Obj: {lesson.objective}</span>}
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}
                  {/* Suggested Assessments */}
                  {module.suggestedAssessments && module.suggestedAssessments.length > 0 && (
                    <div className="mt-2">
                      <strong className="font-medium text-foreground/90">Suggested Assessments:</strong>
                      <div className="flex flex-wrap gap-1 mt-1">
                        {module.suggestedAssessments.map((assessment, aIndex) => (
                          <Badge key={`assessment-${index}-${aIndex}`} variant="secondary" className="break-words">
                            {assessment.type}: {assessment.description}
                          </Badge>
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