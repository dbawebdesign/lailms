'use client';

import React, { createContext, useContext, useState, useCallback } from 'react';

interface AskLunaContextType {
  sendToLuna: (selectedText: string, question: string, quickAction?: string) => void;
  isLunaOpen: boolean;
  setIsLunaOpen: (open: boolean) => void;
}

const AskLunaContext = createContext<AskLunaContextType | undefined>(undefined);

export function AskLunaProvider({ children }: { children: React.ReactNode }) {
  const [isLunaOpen, setIsLunaOpen] = useState(false);

  const sendToLuna = useCallback((selectedText: string, question: string, quickAction?: string) => {
    // Dispatch a custom event that the Luna chat can listen to
    const event = new CustomEvent('askLunaWithContext', {
      detail: {
        selectedText,
        question,
        quickAction,
        timestamp: Date.now()
      }
    });
    
    window.dispatchEvent(event);
    
    // Open Luna chat if it's not already open
    setIsLunaOpen(true);
    
    // Also dispatch to document for broader reach
    document.dispatchEvent(event);
    
    console.log('🚀 Sent question to Luna with context:', {
      selectedText: selectedText.substring(0, 100) + '...',
      question,
      quickAction
    });
  }, []);

  return (
    <AskLunaContext.Provider value={{
      sendToLuna,
      isLunaOpen,
      setIsLunaOpen
    }}>
      {children}
    </AskLunaContext.Provider>
  );
}

export function useAskLuna() {
  const context = useContext(AskLunaContext);
  if (context === undefined) {
    throw new Error('useAskLuna must be used within an AskLunaProvider');
  }
  return context;
} 