import { useState, useEffect } from 'react';
import { LessonContent } from '@/lib/types/lesson';

interface LessonContentResponse {
  lesson: {
    id: string;
    title: string;
    description: string;
    content: LessonContent;
    estimated_duration_hours: number;
    sections: Array<{
      id: string;
      title: string;
      content: any;
      order_index: number;
      section_type: string;
      estimated_duration: number;
      educational_content?: {
        id: string;
        title: string;
        content: any;
        content_type: string;
        difficulty_level: string;
        estimated_duration: number;
        practical_examples: any[];
        common_misconceptions: any[];
        key_concepts: string[];
      };
    }>;
    assessments: Array<{
      id: string;
      title: string;
      description: string;
      assessment_type: string;
      time_limit_minutes: number;
      passing_score_percentage: number;
      questions: Array<{
        id: string;
        question_text: string;
        question_type: string;
        options: any;
        correct_answer: any;
        explanation: string;
        points: number;
        order_index: number;
      }>;
    }>;
  };
  progress: {
    id: string;
    user_id: string;
    item_id: string;
    item_type: string;
    status: string;
    progress_percentage: number;
    last_position: string | null;
    completed_at: string | null;
    created_at: string;
    updated_at: string;
  } | null;
  mindMap: {
    id: string;
    lesson_id: string;
    title: string;
    content: any;
    status: string;
    created_at: string;
  } | null;
  brainbytes: {
    id: string;
    lesson_id: string;
    title: string;
    content: string;
    audio_url: string;
    duration: number;
    status: string;
    created_at: string;
  } | null;
  hasInteractiveContent: boolean;
}

interface UseLessonContentReturn {
  data: LessonContentResponse | null;
  loading: boolean;
  error: string | null;
  refetch: () => Promise<void>;
}

export function useLessonContent(lessonId: string | null): UseLessonContentReturn {
  const [data, setData] = useState<LessonContentResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchLessonContent = async () => {
    if (!lessonId) {
      setData(null);
      setError(null);
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const response = await fetch(`/api/student/lessons/${lessonId}/content`);
      
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to fetch lesson content');
      }

      const lessonData = await response.json();
      setData(lessonData);
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'An unexpected error occurred';
      setError(errorMessage);
      console.error('Error fetching lesson content:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchLessonContent();
  }, [lessonId]);

  return {
    data,
    loading,
    error,
    refetch: fetchLessonContent
  };
} 