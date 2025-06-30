'use client';

import { useState, useEffect } from 'react';
import StudentCourseNavigationTree from '@/components/student/StudentCourseNavigationTree';
import { createClient } from '@/lib/supabase/client';
import { Tables } from 'packages/types/db';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { updateItemProgress } from '@/lib/student/progress.client';
import { Button } from '@/components/ui/button';
import LessonContentRenderer from './LessonContentRenderer';
import { LessonContent } from '@/lib/types/lesson';
import LunaContextElement from '@/components/luna/LunaContextElement';

// A more detailed content player
const ContentPlayer = ({ selectedItemId, selectedItemType }: { selectedItemId?: string, selectedItemType?: 'lesson' | 'assessment' }) => {
  const [loading, setLoading] = useState(false);
  const [content, setContent] = useState<any>(null);
  const [error, setError] = useState<string | null>(null);
  const [user, setUser] = useState<any>(null); // Supabase user

  useEffect(() => {
    const getUser = async () => {
      const supabase = createClient();
      const { data: { user } } = await supabase.auth.getUser();
      setUser(user);
    }
    getUser();
  }, []);

  useEffect(() => {
    const fetchContent = async () => {
      if (!selectedItemId || !selectedItemType || !user) {
        setContent(null);
        return;
      }

      setLoading(true);
      setError(null);
      
      try {
        if (selectedItemType === 'assessment') {
          // For assessments, query directly
          const supabase = createClient();
          const { data, error } = await supabase
            .from('assessments')
            .select('*')
            .eq('id', selectedItemId)
            .single();

          if (error) throw error;
          setContent(data);
          
          // Mark as 'in_progress' when viewed
          await updateItemProgress(selectedItemId, selectedItemType, user.id, 'in_progress');
        } else if (selectedItemType === 'lesson') {
          // For lessons, just mark progress - content will be fetched by LessonContentRenderer
          await updateItemProgress(selectedItemId, selectedItemType, user.id, 'in_progress');
          setContent({ id: selectedItemId }); // Minimal content to indicate something is selected
        }

      } catch (err: any) {
        setError(`Failed to load content: ${err.message}`);
        console.error(err);
      } finally {
        setLoading(false);
      }
    };

    fetchContent();
  }, [selectedItemId, selectedItemType, user]);

  const handleMarkComplete = async () => {
    if (user && selectedItemId && selectedItemType) {
      await updateItemProgress(selectedItemId, selectedItemType, user.id, 'completed');
      alert('Progress updated!');
    }
  };

  const renderContent = () => {
    if (loading) {
      return <Skeleton className="h-[500px] w-full" />;
    }
    if (error) {
      return <div className="text-red-500">{error}</div>;
    }
    if (!content) {
       return (
        <div className="flex items-center justify-center h-full bg-muted/20 rounded-lg">
          <div className="text-center">
            <h2 className="text-2xl font-semibold text-muted-foreground">Select an item</h2>
            <p className="text-muted-foreground">Choose a lesson or assessment from the navigation on the left.</p>
          </div>
        </div>
      );
    }
    
    if (selectedItemType === 'lesson') {
      return <LessonContentRenderer lessonId={selectedItemId} />;
    }

    if (selectedItemType === 'assessment') {
        // Keep existing assessment view for now
        return (
            <Card>
                <CardHeader>
                    <CardTitle>{content.title}</CardTitle>
                </CardHeader>
                <CardContent>
                    <p>{content.description}</p>
                    <pre className="mt-4 p-4 bg-muted rounded-lg">{JSON.stringify(content, null, 2)}</pre>
                </CardContent>
            </Card>
        );
    }

    return null;
  };

  return (
    <div className="p-4 h-full">
      {renderContent()}
      {content && (
         <div className="mt-4 flex justify-end">
            <Button onClick={handleMarkComplete}>Mark as Complete</Button>
        </div>
      )}
    </div>
  );
};


interface CoursePlayerClientProps {
    courseId: string;
}

export default function CoursePlayerClient({ courseId }: CoursePlayerClientProps) {
  const [selectedItemId, setSelectedItemId] = useState<string | undefined>();
  const [selectedItemType, setSelectedItemType] = useState<'lesson' | 'assessment' | undefined>();

  const handleSelectItem = (type: string, id: string) => {
    if (type === 'lesson' || type === 'assessment') {
      setSelectedItemId(id);
      setSelectedItemType(type);
    } else {
      // Handle or ignore invalid types
      setSelectedItemId(undefined);
      setSelectedItemType(undefined);
    }
  };

  return (
    <LunaContextElement
      type="course-player"
      role="display"
      content={{
        courseId,
        selectedItem: selectedItemId ? {
          id: selectedItemId,
          type: selectedItemType
        } : null
      }}
      metadata={{ courseId }}
      state={{
        hasSelectedItem: !!selectedItemId,
        selectedItemType
      }}
    >
      <div className="grid grid-cols-1 md:grid-cols-4 gap-6 h-full">
        <div className="md:col-span-1 h-full overflow-y-auto">
          <StudentCourseNavigationTree
            baseClassId={courseId}
            onSelectItem={handleSelectItem}
            selectedItemId={selectedItemId}
            selectedItemType={selectedItemType}
          />
        </div>
        <div className="md:col-span-3 h-full">
          <ContentPlayer
            selectedItemId={selectedItemId}
            selectedItemType={selectedItemType}
          />
        </div>
      </div>
    </LunaContextElement>
  );
} 