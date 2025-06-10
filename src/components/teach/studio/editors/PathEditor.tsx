import React, { useState, useEffect } from 'react';
import { Path, Lesson } from '@/types/lesson'; // Assuming this is the correct path
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { useLunaUIUpdates } from '@/hooks/useLunaUIUpdates';
import { cn } from '@/lib/utils';

interface PathEditorProps {
  path: Path;
  onSave: (updatedPath: Partial<Path>) => Promise<void>;
  baseClassId: string;
  lessons: Lesson[];
  onReorderLessons: (pathId: string, activeLessonId: string, overLessonId: string) => Promise<void>;
  fetchLessonsForPath: (pathId: string) => Promise<void>;
  isLoadingLessons: boolean;
  // Future props for managing lessons:
  // onAddLesson: () => void;
  // onReorderLesson: (lessonId: string, newOrder: number) => void;
  // onDeleteLesson: (lessonId: string) => void;
}

const PathEditor: React.FC<PathEditorProps> = ({ path, onSave, baseClassId, lessons, onReorderLessons, fetchLessonsForPath, isLoadingLessons }) => {
  const [title, setTitle] = useState(path.title);
  const [description, setDescription] = useState(path.description || '');
  
  // Enhanced hook for Luna UI updates with automatic data refresh
  const { getGlowClasses, LUNA_UPDATE_TYPES } = useLunaUIUpdates({
    onDataRefresh: async (elementType, elementId, data) => {
      if (elementType === LUNA_UPDATE_TYPES.PATH_DESCRIPTION || 
          elementType === LUNA_UPDATE_TYPES.PATH_TITLE) {
        // Refetch the path data from the API
        const response = await fetch(`/api/teach/paths/${path.id}`);
        if (response.ok) {
          const updatedPath = await response.json();
          setTitle(updatedPath.title);
          setDescription(updatedPath.description || '');
        }
      }
    },
    glowDuration: 3000,
    refreshDelay: 3100
  });

  useEffect(() => {
    setTitle(path.title);
    setDescription(path.description || '');
  }, [path]);



  const handleSave = async () => {
    const updatedData: Partial<Path> = {
      id: path.id,
      title,
      description,
    };
    await onSave(updatedData);
  };

  return (
    <Card className="w-full">
      <CardHeader>
        <CardTitle>{path.title}</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4 w-full">
        <div>
          <label htmlFor="pathTitle" className="block text-sm font-medium text-gray-700 dark:text-gray-300">
            Title
          </label>
          <Input
            id="pathTitle"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="Path Title"
            className={cn(getGlowClasses(LUNA_UPDATE_TYPES.PATH_TITLE))}
          />
        </div>
        <div>
          <label htmlFor="pathDescription" className="block text-sm font-medium text-gray-700 dark:text-gray-300">
            Description
          </label>
          <Textarea
            id="pathDescription"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="Path Description"
            rows={3}
            className={cn(getGlowClasses(LUNA_UPDATE_TYPES.PATH_DESCRIPTION))}
          />
        </div>
        <Button onClick={handleSave}>Save Path Details</Button>

        {/* Placeholder for Lesson Management */}
        <div className="mt-6 pt-4 border-t border-border">
          <h4 className="text-md font-semibold mb-2">Lessons in this Path:</h4>
          {path.lessons && path.lessons.length > 0 ? (
            <ul className="space-y-1">
              {path.lessons.map((lesson: Lesson) => (
                <li key={lesson.id} className="text-sm p-1 bg-muted/50 rounded">
                  {lesson.title}
                  {/* TODO: Add edit/delete/reorder controls */}
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-sm text-muted-foreground">No lessons yet in this path.</p>
          )}
          {/* TODO: Add button to create a new lesson */}
        </div>
      </CardContent>
    </Card>
  );
};

export default PathEditor; 