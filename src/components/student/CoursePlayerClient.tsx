'use client';

import { useState, useEffect } from 'react';
import StudentCourseNavigationTree from '@/components/student/StudentCourseNavigationTree';
import { createClient } from '@/lib/supabase/client';
import { Tables } from 'packages/types/db';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { ProgressService } from '@/lib/services/progressService';
import { Button } from '@/components/ui/button';
import LessonContentRenderer from './LessonContentRenderer';
import { LessonContent } from '@/lib/types/lesson';
import LunaContextElement from '@/components/luna/LunaContextElement';
import { NewSchemaAssessmentTaker } from '@/components/assessments/v2/NewSchemaAssessmentTaker';

// A more detailed content player
const ContentPlayer = ({ selectedItemId, selectedItemType }: { selectedItemId?: string, selectedItemType?: 'lesson' | 'assessment' }) => {
  const [loading, setLoading] = useState(false);
  const [content, setContent] = useState<any>(null);
  const [error, setError] = useState<string | null>(null);
  const [user, setUser] = useState<any>(null); // Supabase user
  const [progressService, setProgressService] = useState<ProgressService | null>(null);

  useEffect(() => {
    const getUser = async () => {
      const supabase = createClient();
      const { data: { user } } = await supabase.auth.getUser();
      setUser(user);
      if (user) {
        setProgressService(new ProgressService(user.id));
      }
    }
    getUser();
  }, []);

  useEffect(() => {
    const fetchContent = async () => {
      if (!selectedItemId || !selectedItemType || !user || !progressService) {
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
          
          // Mark as 'in_progress' when viewed using ProgressService
          await progressService.updateAssessmentProgress(selectedItemId, {
            status: 'in_progress'
          });
        } else if (selectedItemType === 'lesson') {
          // For lessons, just mark progress - content will be fetched by LessonContentRenderer
          await progressService.updateLessonProgress(selectedItemId, {
            status: 'in_progress'
          });
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
  }, [selectedItemId, selectedItemType, user, progressService]);



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
        return (
          <NewSchemaAssessmentTaker
            assessmentId={selectedItemId!}
            onComplete={(attemptId) => {
              console.log('Assessment completed:', attemptId);
              // TODO: Navigate to results or next item
              // For now, we'll just refresh the navigation to show updated progress
              window.location.reload();
            }}
            className="h-full"
          />
        );
    }

    return null;
  };

  return (
    <LunaContextElement
      type="content-player"
      role="display"
      content={{
        selectedItemId,
        selectedItemType,
        hasContent: !!content,
        isLoading: loading,
        error: error,
        contentType: selectedItemType === 'lesson' ? 'lesson-content' : selectedItemType === 'assessment' ? 'assessment-content' : 'no-selection',
        description: selectedItemId ? `Displaying ${selectedItemType}: ${selectedItemId}` : "Content area waiting for selection"
      }}
      metadata={{
        selectedItemId,
        selectedItemType,
        hasError: !!error,
        userId: user?.id
      }}
      state={{
        loading,
        hasContent: !!content,
        hasError: !!error,
        isUserLoggedIn: !!user
      }}
      actionable={true}
    >
      <div className="p-4 h-full">
        {renderContent()}
      </div>
    </LunaContextElement>
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
        } : null,
        hasSelectedItem: !!selectedItemId,
        currentView: selectedItemId ? (selectedItemType === 'lesson' ? 'lesson-content' : 'assessment-content') : 'selection-prompt',
        availableInteractionTypes: ['lesson', 'assessment'],
        description: "Main course player interface with navigation tree and content viewer"
      }}
      metadata={{ 
        courseId,
        selectedItemId,
        selectedItemType,
        isContentLoaded: !!selectedItemId
      }}
      state={{
        hasSelectedItem: !!selectedItemId,
        selectedItemType,
        isNavigationVisible: true,
        isContentAreaVisible: true
      }}
      actionable={true}
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