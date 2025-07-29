'use client';

import React, { createContext, useContext, useState, useCallback } from 'react';
import { useUIContext } from '@/context/UIContext';

interface SelectedTextContext {
  text: string;
  source: string;
  timestamp: number;
}

interface AskLunaContextType {
  sendToLuna: (selectedText: string, question: string, quickAction?: string) => void;
  isLunaOpen: boolean;
  setIsLunaOpen: (open: boolean) => void;
  selectedTextContext: SelectedTextContext | null;
  clearSelectedText: () => void;
}

const AskLunaContext = createContext<AskLunaContextType | undefined>(undefined);

export function AskLunaProvider({ children }: { children: React.ReactNode }) {
  const [isLunaOpen, setIsLunaOpen] = useState(false);
  const [selectedTextContext, setSelectedTextContext] = useState<SelectedTextContext | null>(null);
  const { setPanelVisible } = useUIContext();

  const clearSelectedText = useCallback(() => {
    setSelectedTextContext(null);
  }, []);

  const sendToLuna = useCallback((selectedText: string, question: string, quickAction?: string) => {
    // Set the selected text context for display in Luna chat
    setSelectedTextContext({
      text: selectedText,
      source: 'lesson content', // Could be made dynamic based on context
      timestamp: Date.now()
    });

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
    
    // Also open the main AI panel in the app shell
    setPanelVisible(true);
    
    // Also dispatch to document for broader reach
    document.dispatchEvent(event);
    
    console.log('🚀 Sent question to Luna with context:', {
      selectedText: selectedText.substring(0, 100) + '...',
      question,
      quickAction
    });
  }, [setPanelVisible]);

  return (
    <AskLunaContext.Provider value={{
      sendToLuna,
      isLunaOpen,
      setIsLunaOpen,
      selectedTextContext,
      clearSelectedText
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