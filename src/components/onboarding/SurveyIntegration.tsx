'use client';

import { useState, useEffect } from 'react';
import { supabase } from '@/utils/supabase/browser';
import { SurveyModal } from './SurveyModal';
import { Tables } from 'packages/types/db';

interface SurveyIntegrationProps {
  userRole: string;
  profile: Tables<'profiles'>;
}

export function SurveyIntegration({ userRole, profile }: SurveyIntegrationProps) {
  const [showSurvey, setShowSurvey] = useState(false);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const checkSurveyStatus = async () => {
      try {
        // Show survey for all users except students
        if (userRole === 'student') {
          setIsLoading(false);
          return;
        }

        // Check if survey is already completed
        if (profile.survey_completed) {
          setIsLoading(false);
          return;
        }

        // Show survey if user is not a student and hasn't completed it
        setShowSurvey(true);
      } catch (error) {
        console.error('Error checking survey status:', error);
      } finally {
        setIsLoading(false);
      }
    };

    checkSurveyStatus();
  }, [userRole, profile]);

  const handleSurveyComplete = async () => {
    // Refresh the profile data to confirm survey completion
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const { data: profile } = await supabase
        .from('profiles')
        .select('survey_completed')
        .eq('user_id', user.id)
        .single();

      if (profile?.survey_completed) {
        setShowSurvey(false);
        // Refresh the page to update the layout
        window.location.reload();
      }
    } catch (error) {
      console.error('Error checking survey completion:', error);
    }
  };

  // Survey cannot be closed until completed
  const handleSurveyClose = () => {
    // Do nothing - survey must be completed
  };

  // Check if user should see survey (all roles except student)
  const shouldShowSurvey = userRole !== 'student';

  if (isLoading && shouldShowSurvey) {
    return (
      <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-[9999]">
        <div className="bg-white rounded-2xl p-8 text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto mb-4"></div>
          <p className="text-gray-600">Loading...</p>
        </div>
      </div>
    );
  }

  if (!shouldShowSurvey || !showSurvey) {
    return null;
  }

  return (
    <>
      {/* Full-screen blocking overlay */}
      <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-[9998]" />
      
      {/* Survey Modal */}
      <SurveyModal
        isOpen={showSurvey}
        onClose={handleSurveyClose}
        onComplete={handleSurveyComplete}
      />
    </>
  );
} 