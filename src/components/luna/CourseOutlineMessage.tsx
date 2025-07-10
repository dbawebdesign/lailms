'use client';

import React, { useState } from 'react';
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardFooter } from "@/components/ui/card";
import { BookOpen, Save, ExternalLink, CheckCircle } from "lucide-react";

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
  onSaveAndContinue?: (outline: GeneratedCourseOutline) => void;
  onSaveAsDraft?: (outline: GeneratedCourseOutline) => void;
}

export function CourseOutlineMessage({ outline, onSaveAndContinue, onSaveAsDraft }: CourseOutlineMessageProps) {
  const [isSaving, setIsSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  if (!outline) return null;

  const handleSaveAndContinue = async () => {
    if (!onSaveAndContinue) return;
    
    setIsSaving(true);
    try {
      await onSaveAndContinue(outline);
      setSaved(true);
      // Optionally redirect to studio after a brief delay
      setTimeout(() => {
        // This would be handled by the parent component
      }, 1500);
    } catch (error) {
      console.error('Error saving course outline:', error);
    } finally {
      setIsSaving(false);
    }
  };

  const handleSaveAsDraft = async () => {
    if (!onSaveAsDraft) return;
    
    setIsSaving(true);
    try {
      await onSaveAsDraft(outline);
      setSaved(true);
    } catch (error) {
      console.error('Error saving course draft:', error);
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <Card className="w-full max-w-full overflow-hidden min-w-0">
      <CardContent className="space-y-2 text-sm w-full max-w-full overflow-hidden min-w-0 p-4">
      {/* Display basic course info if available */}
      {outline.baseClassName && (
        <div className="break-words text-wrap overflow-hidden">
          <strong className="font-medium text-xs">Course Title:</strong> <span className="text-sm">{outline.baseClassName}</span>
        </div>
      )}
      {outline.description && (
        <div className="break-words text-wrap overflow-hidden">
          <strong className="font-medium text-xs">Description:</strong> <span className="text-sm">{outline.description}</span>
        </div>
      )}
      {(outline.subject || outline.gradeLevel || outline.lengthInWeeks) && (
        <div className="flex flex-wrap gap-x-3 gap-y-1 text-xs text-muted-foreground overflow-hidden">
          {outline.subject && <span className="break-words text-wrap">Subject: {outline.subject}</span>}
          {outline.gradeLevel && <span className="break-words text-wrap">Grade: {outline.gradeLevel}</span>}
          {outline.lengthInWeeks && <span className="break-words text-wrap">Length: {outline.lengthInWeeks} weeks</span>}
        </div>
      )}

      {/* Display Modules using Accordion */}
      {outline.modules && outline.modules.length > 0 && (
        <div className="mt-2 pt-2 border-t border-muted-foreground/20 w-full min-w-0">
          <h4 className="font-medium text-xs mb-2 break-words text-wrap">Course Modules:</h4>
          <Accordion type="single" collapsible className="w-full min-w-0">
            {outline.modules.map((module, index) => (
              <AccordionItem key={`module-${index}`} value={`item-${index}`} className="border-b border-muted-foreground/10 min-w-0">
                <AccordionTrigger className="text-xs font-medium hover:no-underline py-1.5 text-left break-words text-wrap min-w-0">
                  <span className="break-words text-wrap pr-2 min-w-0 overflow-hidden">{module.title || `Module ${index + 1}`}</span>
                </AccordionTrigger>
                <AccordionContent className="pl-1 pt-1 pb-2 text-xs space-y-2 w-full max-w-full overflow-hidden min-w-0">
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
      </CardContent>
      
      {/* Action buttons for saving and continuing */}
      <CardFooter className="flex flex-col gap-3 p-4 pt-0">
        <div className="flex flex-col sm:flex-row gap-2 w-full">
          <Button 
            onClick={handleSaveAndContinue}
            disabled={isSaving || saved}
            className="flex-1 flex items-center gap-2"
            size="sm"
          >
            {saved ? (
              <>
                <CheckCircle className="h-4 w-4" />
                Saved!
              </>
            ) : isSaving ? (
              <>
                <Save className="h-4 w-4 animate-spin" />
                Saving...
              </>
            ) : (
              <>
                <BookOpen className="h-4 w-4" />
                Save & Continue in Studio
              </>
            )}
          </Button>
          
          <Button 
            onClick={handleSaveAsDraft}
            disabled={isSaving || saved}
            variant="outline"
            className="flex-1 flex items-center gap-2"
            size="sm"
          >
            {saved ? (
              <>
                <CheckCircle className="h-4 w-4" />
                Saved as Draft
              </>
            ) : (
              <>
                <Save className="h-4 w-4" />
                Save as Draft
              </>
            )}
          </Button>
        </div>
        
        <div className="text-xs text-muted-foreground text-center">
          <p className="mb-1">
            <strong>Save & Continue in Studio:</strong> Create the base class and open the studio to generate all lesson content
          </p>
          <p>
            <strong>Save as Draft:</strong> Save this outline to review and modify later
          </p>
        </div>
      </CardFooter>
    </Card>
  );
} 