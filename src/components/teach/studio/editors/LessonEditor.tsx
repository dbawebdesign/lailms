import React, { useState, useEffect } from 'react';
import { Lesson, LessonSection } from '@/types/lesson';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';

interface LessonEditorProps {
  lesson: Lesson;
  onSave: (updatedLesson: Partial<Lesson>) => Promise<void>;
  pathId: string;
  sections: LessonSection[];
  onReorderSections: (lessonId: string, activeSectionId: string, overSectionId: string) => Promise<void>;
  fetchSectionsForLesson: (lessonId: string) => Promise<void>;
  isLoadingSections: boolean;
  // Future props for managing sections:
  // onAddSection: () => void;
  // onReorderSection: (sectionId: string, newOrder: number) => void;
  // onDeleteSection: (sectionId: string) => void;
}

const LessonEditor: React.FC<LessonEditorProps> = ({ lesson, onSave, pathId, sections, onReorderSections, fetchSectionsForLesson, isLoadingSections }) => {
  const [title, setTitle] = useState(lesson.title);
  const [description, setDescription] = useState(lesson.description || '');
  // Add other fields from Lesson as needed, e.g., learning_objectives

  useEffect(() => {
    setTitle(lesson.title);
    setDescription(lesson.description || '');
  }, [lesson]);

  const handleSave = async () => {
    const updatedData: Partial<Lesson> = {
      id: lesson.id,
      title,
      description,
      // include other fields
    };
    await onSave(updatedData);
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>{lesson.title}</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div>
          <label htmlFor="lessonTitle" className="block text-sm font-medium text-gray-700 dark:text-gray-300">
            Title
          </label>
          <Input
            id="lessonTitle"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="Lesson Title"
          />
        </div>
        <div>
          <label htmlFor="lessonDescription" className="block text-sm font-medium text-gray-700 dark:text-gray-300">
            Description
          </label>
          <Textarea
            id="lessonDescription"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="Lesson Description"
            rows={3}
          />
        </div>
        {/* Add fields for learning_objectives (e.g., Textarea or a more structured editor) */}
        <Button onClick={handleSave}>Save Lesson Details</Button>

        {/* Placeholder for Lesson Section Management */}
        <div className="mt-6 pt-4 border-t border-border">
          <h4 className="text-md font-semibold mb-2">Sections in this Lesson:</h4>
          {lesson.sections && lesson.sections.length > 0 ? (
            <ul className="space-y-1">
              {lesson.sections.map((section: LessonSection) => (
                <li key={section.id} className="text-sm p-1 bg-muted/50 rounded">
                  {section.title}
                  {/* TODO: Add edit/delete/reorder controls */}
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-sm text-muted-foreground">No sections yet in this lesson.</p>
          )}
          {/* TODO: Add button to create a new section */}
        </div>
      </CardContent>
    </Card>
  );
};

export default LessonEditor; 