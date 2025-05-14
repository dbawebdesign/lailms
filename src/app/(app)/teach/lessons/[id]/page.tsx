'use client';

import React, { useEffect, useState } from 'react';
import LessonEditor from '@/components/teach/designer/LessonEditor'; // We will create/update this component next
import { getLessonSections } from '@/lib/services/teachService';
import type { LessonSection } from '@/types/teach';
import { LoadingSpinner } from '@/components/ui/loading-spinner'; // Assuming a loading spinner component exists

interface LessonPageProps {
  params: {
    id: string; // This will be the lesson ID or 'new'
  };
}

const LessonPage: React.FC<LessonPageProps> = ({ params }) => {
  const { id: lessonIdParam } = params;
  const isNewLesson = lessonIdParam === 'new';

  const [initialSections, setInitialSections] = useState<LessonSection[] | undefined>(undefined);
  const [isLoading, setIsLoading] = useState<boolean>(!isNewLesson);
  const [error, setError] = useState<string | null>(null);
  const [lessonTitle, setLessonTitle] = useState<string>(''); // Placeholder for actual lesson title fetching if needed

  useEffect(() => {
    if (!isNewLesson && lessonIdParam) {
      setIsLoading(true);
      // Here you might also fetch the lesson details itself to get the title, etc.
      // For now, just focusing on sections
      // e.g. getLessonDetails(lessonIdParam).then(details => setLessonTitle(details.title));

      getLessonSections(lessonIdParam)
        .then((sections) => {
          setInitialSections(sections);
          setError(null);
        })
        .catch((err) => {
          console.error('Failed to load lesson sections:', err);
          setError(err.message || 'Failed to load lesson sections.');
          setInitialSections([]); // Set to empty array on error to allow editor to show 'add section'
        })
        .finally(() => {
          setIsLoading(false);
        });
    } else {
      // For a new lesson, no sections to fetch initially
      setInitialSections([]);
      setIsLoading(false);
    }
  }, [lessonIdParam, isNewLesson]);

  // Placeholder for lesson title logic
  useEffect(() => {
    if (isNewLesson) {
      setLessonTitle('Create New Lesson');
    } else if (lessonIdParam) {
      // In a real app, you would fetch the lesson title based on lessonIdParam
      setLessonTitle(`Edit Lesson ${lessonIdParam}`); 
    }
  }, [isNewLesson, lessonIdParam]);

  if (isLoading) {
    return (
      <div className="flex justify-center items-center h-screen">
        <LoadingSpinner />
      </div>
    );
  }

  return (
    <div className="container mx-auto p-4">
      <h1 className="text-3xl font-bold mb-6">
        {lessonTitle}
      </h1>
      {error && <div className="text-red-500 bg-red-100 p-3 rounded mb-4">Error: {error}</div>}
      
      <LessonEditor 
        lessonIdParam={lessonIdParam} 
        initialSections={initialSections}
      />
    </div>
  );
};

export default LessonPage; 