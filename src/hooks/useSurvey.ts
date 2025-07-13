'use client';

import { useState, useEffect } from 'react';
import { supabase } from '@/utils/supabase/browser';
import { SurveySection, SurveyQuestion, SurveySubmissionData } from '@/types/survey';

export function useSurvey() {
  const [sections, setSections] = useState<SurveySection[]>([]);
  const [questions, setQuestions] = useState<SurveyQuestion[]>([]);
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
          .from('survey_sections')
          .select('*')
          .order('order_index');

        if (sectionsError) {
          throw sectionsError;
        }

        // Fetch questions
        const { data: questionsData, error: questionsError } = await supabase
          .from('survey_questions')
          .select('*')
          .order('section_id, order_index');

        if (questionsError) {
          throw questionsError;
        }

        setSections(sectionsData || []);
        setQuestions(questionsData || []);
      } catch (err) {
        console.error('Error fetching survey data:', err);
        setError('Failed to load survey. Please refresh the page.');
      } finally {
        setIsLoading(false);
      }
    };

    fetchSurveyData();
  }, [supabase]);

  // Submit survey responses
  const submitSurvey = async (submissionData: SurveySubmissionData) => {
    try {
      setIsSubmitting(true);
      setError(null);

      // Get current user
      const { data: { user }, error: userError } = await supabase.auth.getUser();
      
      if (userError || !user) {
        throw new Error('User not authenticated');
      }

      // Create survey response record
      const { data: surveyResponse, error: responseError } = await supabase
        .from('survey_responses')
        .insert({
          user_id: user.id,
          duration_seconds: submissionData.duration,
          device_info: submissionData.deviceInfo,
        })
        .select()
        .single();

      if (responseError) {
        throw responseError;
      }

      // Create question responses
      const questionResponses = Object.entries(submissionData.responses).map(([questionId, value]) => ({
        survey_response_id: surveyResponse.id,
        question_id: parseInt(questionId),
        response_value: Array.isArray(value) ? JSON.stringify(value) : String(value),
        response_text: typeof value === 'string' ? value : null,
      }));

      const { error: questionsError } = await supabase
        .from('survey_question_responses')
        .insert(questionResponses);

      if (questionsError) {
        throw questionsError;
      }

      // Update user profile to mark survey as completed
      const { error: profileError } = await supabase
        .from('profiles')
        .update({ survey_completed: true })
        .eq('user_id', user.id);

      if (profileError) {
        throw profileError;
      }

      return surveyResponse;
    } catch (err) {
      console.error('Error submitting survey:', err);
      setError('Failed to submit survey. Please try again.');
      throw err;
    } finally {
      setIsSubmitting(false);
    }
  };

  // Check if user has completed survey
  const checkSurveyCompletion = async () => {
    try {
      const { data: { user }, error: userError } = await supabase.auth.getUser();
      
      if (userError || !user) {
        return false;
      }

      const { data: profile, error: profileError } = await supabase
        .from('profiles')
        .select('survey_completed')
        .eq('user_id', user.id)
        .single();

      if (profileError) {
        console.error('Error checking survey completion:', profileError);
        return false;
      }

      return profile?.survey_completed || false;
    } catch (err) {
      console.error('Error checking survey completion:', err);
      return false;
    }
  };

  return {
    sections,
    questions,
    isLoading,
    error,
    isSubmitting,
    submitSurvey,
    checkSurveyCompletion,
  };
} 