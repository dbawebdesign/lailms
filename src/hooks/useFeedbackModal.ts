import { useState, useCallback } from 'react';

export interface FeedbackModalState {
  isOpen: boolean;
  initialCategory?: 'feedback' | 'support' | 'bug_report';
  initialPriority?: 'low' | 'medium' | 'high' | 'critical';
}

export function useFeedbackModal() {
  const [state, setState] = useState<FeedbackModalState>({
    isOpen: false,
  });

  const openModal = useCallback((options?: {
    category?: 'feedback' | 'support' | 'bug_report';
    priority?: 'low' | 'medium' | 'high' | 'critical';
  }) => {
    setState({
      isOpen: true,
      initialCategory: options?.category,
      initialPriority: options?.priority,
    });
  }, []);

  const closeModal = useCallback(() => {
    setState({
      isOpen: false,
      initialCategory: undefined,
      initialPriority: undefined,
    });
  }, []);

  // Convenience methods for specific types
  const openFeedback = useCallback(() => {
    openModal({ category: 'feedback', priority: 'medium' });
  }, [openModal]);

  const openSupport = useCallback(() => {
    openModal({ category: 'support', priority: 'medium' });
  }, [openModal]);

  const openBugReport = useCallback(() => {
    openModal({ category: 'bug_report', priority: 'high' });
  }, [openModal]);

  return {
    ...state,
    openModal,
    closeModal,
    openFeedback,
    openSupport,
    openBugReport,
  };
} 