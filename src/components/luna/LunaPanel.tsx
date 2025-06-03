"use client";

import React, { useState, useRef, useEffect, useCallback } from 'react';
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { useLunaContext } from '@/hooks/useLunaContext';
import ChatThread from './ChatThread';
import ChatInput from './ChatInput';
import PersonaSelector, { PersonaType } from './PersonaSelector';
import { X, Minimize2, Maximize2 } from 'lucide-react';

type LunaPanelProps = {
  initialOpen?: boolean;
};

const LunaPanel: React.FC<LunaPanelProps> = ({ initialOpen = false }) => {
  const [isOpen, setIsOpen] = useState(initialOpen);
  const [isMinimized, setIsMinimized] = useState(false);
  const [currentPersona, setCurrentPersona] = useState<PersonaType>('tutor');
  const [isMobile, setIsMobile] = useState(false);
  const [keyboardHeight, setKeyboardHeight] = useState(0);
  const panelRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLDivElement>(null);
  const { registerComponent, unregisterComponent, updateComponent } = useLunaContext();

  // Detect mobile and handle keyboard appearance
  useEffect(() => {
    const checkMobile = () => {
      setIsMobile(window.innerWidth < 768);
    };

    const handleResize = () => {
      checkMobile();
      
      // Detect virtual keyboard on mobile
      if (window.innerWidth < 768) {
        const viewportHeight = window.visualViewport?.height || window.innerHeight;
        const windowHeight = window.innerHeight;
        const keyboardHeightDetected = windowHeight - viewportHeight;
        
        setKeyboardHeight(Math.max(0, keyboardHeightDetected));
      }
    };

    const handleVisualViewportChange = () => {
      if (window.visualViewport && window.innerWidth < 768) {
        const keyboardHeightDetected = window.innerHeight - window.visualViewport.height;
        setKeyboardHeight(Math.max(0, keyboardHeightDetected));
        
        // Scroll input into view when keyboard opens
        if (keyboardHeightDetected > 0 && inputRef.current) {
          setTimeout(() => {
            inputRef.current?.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
          }, 100);
        }
      }
    };

    checkMobile();
    window.addEventListener('resize', handleResize);
    
    if (window.visualViewport) {
      window.visualViewport.addEventListener('resize', handleVisualViewportChange);
    }

    return () => {
      window.removeEventListener('resize', handleResize);
      if (window.visualViewport) {
        window.visualViewport.removeEventListener('resize', handleVisualViewportChange);
      }
    };
  }, []);

  // Prevent body scroll when panel is open on mobile
  useEffect(() => {
    if (isMobile && isOpen && !isMinimized) {
      document.body.style.overflow = 'hidden';
      document.body.style.position = 'fixed';
      document.body.style.width = '100%';
      document.body.style.top = '0';
    } else {
      document.body.style.overflow = '';
      document.body.style.position = '';
      document.body.style.width = '';
      document.body.style.top = '';
    }

    return () => {
      document.body.style.overflow = '';
      document.body.style.position = '';
      document.body.style.width = '';
      document.body.style.top = '';
    };
  }, [isMobile, isOpen, isMinimized]);

  // Register with Luna Context
  useEffect(() => {
    const componentId = registerComponent({
      type: 'luna-panel',
      role: 'assistant',
      content: {
        title: 'Luna AI Assistant',
        isOpen,
        persona: currentPersona
      },
      state: {
        isOpen,
        isMinimized,
        currentPersona
      }
    });

    return () => {
      unregisterComponent(componentId);
    };
  }, [registerComponent, unregisterComponent, isOpen, isMinimized, currentPersona]);

  // Update component state when it changes
  useEffect(() => {
    updateComponent && updateComponent('luna-panel', {
      state: {
        isOpen,
        isMinimized,
        currentPersona
      }
    });
  }, [updateComponent, isOpen, isMinimized, currentPersona]);

  // Toggle panel open/closed
  const togglePanel = useCallback(() => {
    setIsOpen(!isOpen);
    if (isMinimized && !isOpen) {
      setIsMinimized(false);
    }
  }, [isOpen, isMinimized]);

  // Toggle minimized state
  const toggleMinimize = useCallback((e: React.MouseEvent) => {
    e.stopPropagation();
    setIsMinimized(!isMinimized);
  }, [isMinimized]);

  // Close panel
  const closePanel = useCallback((e: React.MouseEvent) => {
    e.stopPropagation();
    setIsOpen(false);
    setIsMinimized(false);
  }, []);

  // Handle persona change
  const handlePersonaChange = useCallback((persona: PersonaType) => {
    setCurrentPersona(persona);
  }, []);

  // Calculate dynamic height for mobile
  const getMobileHeight = () => {
    if (keyboardHeight > 0) {
      // When keyboard is open, use available viewport height
      return `${window.visualViewport?.height || window.innerHeight}px`;
    }
    return '100vh';
  };

  // Floating button when closed
  if (!isOpen) {
    return (
      <Button 
        onClick={togglePanel}
        className={`fixed z-50 rounded-full shadow-lg bg-primary text-primary-foreground transition-all duration-300 hover:scale-110 active:scale-95
          ${isMobile 
            ? 'bottom-6 right-6 h-14 w-14 text-lg' 
            : 'bottom-4 right-4 p-4'
          }`}
        aria-label="Open Luna Assistant"
      >
        Luna
      </Button>
    );
  }

  // Mobile full-screen layout
  if (isMobile) {
    return (
      <>
        {/* Mobile backdrop */}
        <div 
          className="fixed inset-0 z-40 bg-black/20 backdrop-blur-sm transition-opacity duration-300"
          onClick={closePanel}
        />
        
        {/* Mobile panel */}
        <div 
          ref={panelRef}
          className="fixed inset-0 z-50 flex flex-col bg-background transition-transform duration-300 ease-out"
          style={{ 
            height: getMobileHeight(),
            paddingBottom: keyboardHeight > 0 ? '0px' : 'env(safe-area-inset-bottom)'
          }}
        >
          {/* Mobile Header */}
          <div className="bg-primary px-4 py-4 text-primary-foreground flex items-center justify-between shadow-sm">
            <h2 className="font-semibold text-lg">Luna AI Assistant</h2>
            <Button 
              variant="ghost" 
              size="icon" 
              className="h-10 w-10 text-primary-foreground hover:bg-primary/80 hover:text-primary-foreground rounded-full"
              onClick={closePanel}
            >
              <X size={20} />
            </Button>
          </div>

          {/* Mobile Persona Selector */}
          <div className="px-4 py-2 border-b bg-background">
            <PersonaSelector 
              currentPersona={currentPersona} 
              onChange={handlePersonaChange} 
            />
          </div>

          {/* Mobile Chat Thread */}
          <div className="flex-1 overflow-hidden">
            <ScrollArea className="h-full px-4 py-2">
              <ChatThread persona={currentPersona} />
            </ScrollArea>
          </div>

          {/* Mobile Input Area */}
          <div 
            ref={inputRef}
            className="border-t bg-background p-4 pb-6"
            style={{ 
              paddingBottom: keyboardHeight > 0 ? '8px' : '24px'
            }}
          >
            <ChatInput persona={currentPersona} />
          </div>
        </div>
      </>
    );
  }

  // Desktop layout (original)
  return (
    <Card 
      ref={panelRef}
      className={`fixed bottom-4 right-4 z-50 flex flex-col shadow-xl transition-all duration-300 ease-in-out border-primary/20 overflow-hidden
        ${isMinimized ? 'h-16 w-72' : 'h-[70vh] w-96'}`}
    >
      {/* Desktop Header */}
      <div className="bg-primary px-4 py-2 text-primary-foreground flex items-center justify-between cursor-pointer"
        onClick={isMinimized ? togglePanel : undefined}
      >
        <h2 className="font-medium">Luna AI Assistant</h2>
        <div className="flex items-center gap-2">
          <Button 
            variant="ghost" 
            size="icon" 
            className="h-6 w-6 text-primary-foreground hover:bg-primary/80 hover:text-primary-foreground"
            onClick={toggleMinimize}
          >
            {isMinimized ? <Maximize2 size={14} /> : <Minimize2 size={14} />}
          </Button>
          <Button 
            variant="ghost" 
            size="icon" 
            className="h-6 w-6 text-primary-foreground hover:bg-primary/80 hover:text-primary-foreground"
            onClick={closePanel}
          >
            <X size={14} />
          </Button>
        </div>
      </div>

      {/* Desktop Content - Only render if not minimized */}
      {!isMinimized && (
        <>
          {/* Desktop Persona Selector */}
          <PersonaSelector 
            currentPersona={currentPersona} 
            onChange={handlePersonaChange} 
          />

          {/* Desktop Chat Thread */}
          <ScrollArea className="flex-1 p-4 pt-2">
            <ChatThread persona={currentPersona} />
          </ScrollArea>

          {/* Desktop Input Area */}
          <div className="p-2 border-t">
            <ChatInput persona={currentPersona} />
          </div>
        </>
      )}
    </Card>
  );
};

export default LunaPanel; 