import { useUIContext } from '@/context/UIContext';

export function useFeedback() {
  const { openFeedbackModal } = useUIContext();

  const openFeedback = () => {
    openFeedbackModal({ category: 'feedback', priority: 'medium' });
  };

  const openSupport = () => {
    openFeedbackModal({ category: 'support', priority: 'medium' });
  };

  const openBugReport = () => {
    openFeedbackModal({ category: 'bug_report', priority: 'high' });
  };

  return {
    openFeedback,
    openSupport,
    openBugReport,
    openFeedbackModal, // For custom options
  };
} 