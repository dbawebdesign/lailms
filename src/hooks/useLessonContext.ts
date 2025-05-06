import { useEffect } from 'react';
import { useUIContext } from './useUIContext';
import { createContentSummary } from '@/lib/contextUtils';

interface LessonData {
  lessonId: string;
  title: string;
  currentSection?: {
    id: string;
    title: string;
    content: string;
    index: number;
  };
  totalSections?: number;
  subject?: string;
  gradeLevel?: string | number;
  learningObjectives?: string[];
  timeSpent?: number;
  progress?: number;
  metadata?: Record<string, any>;
}

/**
 * A specialized hook for lesson content components
 * Captures detailed information about the educational content
 */
export function useLessonContext(lessonData: LessonData) {
  const {
    lessonId,
    title,
    currentSection,
    totalSections,
    subject,
    gradeLevel,
    learningObjectives,
    timeSpent,
    progress,
    metadata = {}
  } = lessonData;
  
  // Register with the UI context
  const { componentId, updateContent } = useUIContext({
    type: 'lessonContent',
    role: 'main-content',
    props: {
      lessonId,
      title,
      subject,
      gradeLevel,
    },
    metadata: {
      ...metadata,
      lessonIdentifier: lessonId,
      contentType: 'lesson',
      educational: true
    }
  });
  
  // Update when lesson data changes
  useEffect(() => {
    if (!componentId) return;
    
    // Generate content summary for section content if available
    const sectionContentSummary = currentSection?.content
      ? createContentSummary(currentSection.content, 1000)
      : undefined;
    
    // Build content object with educational information
    updateContent({
      title,
      progressInfo: {
        currentSection: currentSection?.index,
        totalSections,
        progress: progress || (totalSections && currentSection 
          ? Math.round((currentSection.index / totalSections) * 100) 
          : undefined),
        timeSpent,
      },
      currentSection: currentSection ? {
        id: currentSection.id,
        title: currentSection.title,
        index: currentSection.index,
        content: sectionContentSummary
      } : undefined,
      educationalContext: {
        subject,
        gradeLevel,
        learningObjectives,
      }
    });
  }, [
    componentId, 
    title, 
    currentSection, 
    totalSections, 
    subject, 
    gradeLevel, 
    learningObjectives, 
    timeSpent, 
    progress, 
    updateContent
  ]);
  
  return {
    componentId,
    trackSectionChange: (sectionId: string, sectionIndex: number) => {
      updateContent({
        progressInfo: {
          currentSection: sectionIndex,
          totalSections,
          progress: totalSections ? Math.round((sectionIndex / totalSections) * 100) : undefined,
          timeSpent,
        }
      });
    },
    trackTimeSpent: (newTimeSpent: number) => {
      updateContent({
        progressInfo: {
          currentSection: currentSection?.index,
          totalSections,
          progress: progress || (totalSections && currentSection 
            ? Math.round((currentSection.index / totalSections) * 100) 
            : undefined),
          timeSpent: newTimeSpent,
        }
      });
    }
  };
} 