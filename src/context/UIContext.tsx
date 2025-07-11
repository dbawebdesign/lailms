"use client";

import React, { createContext, useContext, useState, ReactNode } from "react";

interface UIContextProps {
  isNavCollapsed: boolean;
  toggleNavCollapsed: () => void;
  setNavCollapsed: (isCollapsed: boolean) => void;
  isPanelVisible: boolean;
  togglePanelVisible: () => void;
  setPanelVisible: (isVisible: boolean) => void;
  // Feedback modal
  isFeedbackModalOpen: boolean;
  openFeedbackModal: (options?: {
    category?: 'feedback' | 'support' | 'bug_report';
    priority?: 'low' | 'medium' | 'high' | 'critical';
  }) => void;
  closeFeedbackModal: () => void;
  feedbackModalCategory?: 'feedback' | 'support' | 'bug_report';
  feedbackModalPriority?: 'low' | 'medium' | 'high' | 'critical';
}

const UIContext = createContext<UIContextProps | undefined>(undefined);

export const UIContextProvider: React.FC<{ children: ReactNode }> = ({
  children,
}) => {
  const [isNavCollapsed, setIsNavCollapsed] = useState(false);
  const [isPanelVisible, setIsPanelVisible] = useState(false); // Default to hidden
  const [isFeedbackModalOpen, setIsFeedbackModalOpen] = useState(false);
  const [feedbackModalCategory, setFeedbackModalCategory] = useState<'feedback' | 'support' | 'bug_report'>('feedback');
  const [feedbackModalPriority, setFeedbackModalPriority] = useState<'low' | 'medium' | 'high' | 'critical'>('medium');

  const toggleNavCollapsed = () => {
    setIsNavCollapsed(!isNavCollapsed);
  };

  const setNavCollapsed = (isCollapsed: boolean) => {
    setIsNavCollapsed(isCollapsed);
  };

  const togglePanelVisible = () => {
    setIsPanelVisible(!isPanelVisible);
  };

  const setPanelVisible = (isVisible: boolean) => {
    setIsPanelVisible(isVisible);
  };

  const openFeedbackModal = (options?: {
    category?: 'feedback' | 'support' | 'bug_report';
    priority?: 'low' | 'medium' | 'high' | 'critical';
  }) => {
    setFeedbackModalCategory(options?.category || 'feedback');
    setFeedbackModalPriority(options?.priority || 'medium');
    setIsFeedbackModalOpen(true);
  };

  const closeFeedbackModal = () => {
    setIsFeedbackModalOpen(false);
  };

  return (
    <UIContext.Provider
      value={{
        isNavCollapsed,
        toggleNavCollapsed,
        setNavCollapsed,
        isPanelVisible,
        togglePanelVisible,
        setPanelVisible,
        isFeedbackModalOpen,
        openFeedbackModal,
        closeFeedbackModal,
        feedbackModalCategory,
        feedbackModalPriority,
      }}
    >
      {children}
    </UIContext.Provider>
  );
};

export const useUIContext = () => {
  const context = useContext(UIContext);
  if (context === undefined) {
    throw new Error("useUIContext must be used within a UIContextProvider");
  }
  return context;
}; 