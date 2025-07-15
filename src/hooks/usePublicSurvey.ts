'use client';

import { useState, useEffect } from 'react';
import { supabase } from '@/utils/supabase/browser';
import { PublicSurveySection, PublicSurveyQuestion, PublicSurveySubmissionData } from '@/types/publicSurvey';

export function usePublicSurvey() {
  const [sections, setSections] = useState<PublicSurveySection[]>([]);
  const [questions, setQuestions] = useState<PublicSurveyQuestion[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Fetch survey data on mount
  useEffect(() => {
    const fetchSurveyData = async () => {
      try {
        setIsLoading(true);
        setError(null);

        // Fetch sections
        const { data: sectionsData, error: sectionsError } = await supabase
          .from('public_survey_sections')
          .select('*')
          .order('order_index');

        if (sectionsError) {
          throw sectionsError;
        }

        // Fetch questions
        const { data: questionsData, error: questionsError } = await supabase
          .from('public_survey_questions')
          .select('*')
          .order('section_id, order_index');

        if (questionsError) {
          throw questionsError;
        }

        setSections(sectionsData || []);
        setQuestions(questionsData || []);
      } catch (err) {
        console.error('Error fetching public survey data:', err);
        setError('Failed to load survey. Please refresh the page.');
      } finally {
        setIsLoading(false);
      }
    };

    fetchSurveyData();
  }, []);

  // Submit survey responses
  const submitSurvey = async (submissionData: PublicSurveySubmissionData) => {
    try {
      setIsSubmitting(true);
      setError(null);

      // Submit to our API endpoint that handles public survey submissions
      const response = await fetch('/api/public-survey/submit', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(submissionData),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to submit survey');
      }

      const result = await response.json();
      return result;
    } catch (err) {
      console.error('Error submitting public survey:', err);
      setError(err instanceof Error ? err.message : 'Failed to submit survey. Please try again.');
      throw err;
    } finally {
      setIsSubmitting(false);
    }
  };

  return {
    sections,
    questions,
    isLoading,
    error,
    isSubmitting,
    submitSurvey,
  };
} 