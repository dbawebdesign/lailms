"use client";

import React, { useState, useRef, useEffect } from 'react';
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
  const [viewportHeight, setViewportHeight] = useState('100vh');
  const panelRef = useRef<HTMLDivElement>(null);
  const { registerComponent, unregisterComponent, updateComponent } = useLunaContext();

  // Detect mobile and handle viewport changes
  useEffect(() => {
    const checkMobile = () => {
      setIsMobile(window.innerWidth < 768); // md breakpoint
    };

    const handleResize = () => {
      checkMobile();
      
      // Update viewport height to handle mobile keyboard
      if (window.innerWidth < 768) {
        // Use dvh for better mobile support, fallback to innerHeight
        const vh = window.innerHeight * 0.01;
        document.documentElement.style.setProperty('--vh', `${vh}px`);
        setViewportHeight(`${window.innerHeight}px`);
      } else {
        setViewportHeight('100vh');
      }
    };

    // Initial check
    handleResize();

    // Add event listeners
    window.addEventListener('resize', handleResize);
    window.addEventListener('orientationchange', handleResize);

    // Handle visual viewport API for better keyboard detection
    if (window.visualViewport) {
      const handleViewportChange = () => {
        if (window.innerWidth < 768) {
          setViewportHeight(`${window.visualViewport?.height || window.innerHeight}px`);
        }
      };
      
      window.visualViewport.addEventListener('resize', handleViewportChange);
      
      return () => {
        window.removeEventListener('resize', handleResize);
        window.removeEventListener('orientationchange', handleResize);
        window.visualViewport?.removeEventListener('resize', handleViewportChange);
      };
    }

    return () => {
      window.removeEventListener('resize', handleResize);
      window.removeEventListener('orientationchange', handleResize);
    };
  }, []);

  // Prevent background scrolling on mobile when chat is open
  useEffect(() => {
    if (isMobile && isOpen && !isMinimized) {
      // Prevent scrolling on the body
      document.body.style.overflow = 'hidden';
      document.body.style.position = 'fixed';
      document.body.style.width = '100%';
      document.body.style.height = '100%';
      
      return () => {
        // Restore scrolling
        document.body.style.overflow = '';
        document.body.style.position = '';
        document.body.style.width = '';
        document.body.style.height = '';
      };
    }
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
        currentPersona,
        isMobile
      }
    });

    return () => {
      unregisterComponent(componentId);
    };
  }, [registerComponent, unregisterComponent, isOpen, isMinimized, currentPersona, isMobile]);

  // Update component state when it changes
  useEffect(() => {
    updateComponent && updateComponent('luna-panel', {
      state: {
        isOpen,
        isMinimized,
        currentPersona,
        isMobile
      }
    });
  }, [updateComponent, isOpen, isMinimized, currentPersona, isMobile]);

  // Toggle panel open/closed
  const togglePanel = () => {
    setIsOpen(!isOpen);
    if (isMinimized && !isOpen) {
      setIsMinimized(false);
    }
  };

  // Toggle minimized state (disabled on mobile)
  const toggleMinimize = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (!isMobile) {
      setIsMinimized(!isMinimized);
    }
  };

  // Close panel
  const closePanel = (e: React.MouseEvent) => {
    e.stopPropagation();
    setIsOpen(false);
  };

  // Handle persona change
  const handlePersonaChange = (persona: PersonaType) => {
    setCurrentPersona(persona);
  };

  if (!isOpen) {
    return (
      <Button 
        onClick={togglePanel}
        className={`fixed z-50 rounded-full shadow-lg bg-primary text-primary-foreground transition-all duration-200 hover:scale-105 ${
          isMobile 
            ? 'bottom-6 right-6 h-14 w-14 p-0 text-lg' 
            : 'bottom-4 right-4 h-12 w-12 p-0'
        }`}
        aria-label="Open Luna Assistant"
      >
        {isMobile ? '🌙' : 'Luna'}
      </Button>
    );
  }

  // Mobile full-screen layout
  if (isMobile) {
    return (
      <>
        {/* Mobile backdrop */}
        <div 
          className="fixed inset-0 bg-black/50 z-40"
          onClick={closePanel}
        />
        
        {/* Mobile chat panel */}
        <div 
          ref={panelRef}
          className="fixed inset-0 z-50 flex flex-col bg-background"
          style={{ height: viewportHeight }}
        >
          {/* Mobile Header */}
          <div className="bg-primary px-4 py-3 text-primary-foreground flex items-center justify-between border-b flex-shrink-0">
            <h2 className="font-medium text-lg">Luna AI Assistant</h2>
            <Button 
              variant="ghost" 
              size="icon" 
              className="h-8 w-8 text-primary-foreground hover:bg-primary/80"
              onClick={closePanel}
            >
              <X size={20} />
            </Button>
          </div>

          {/* Mobile Persona Selector */}
          <div className="flex-shrink-0 border-b">
            <PersonaSelector 
              currentPersona={currentPersona} 
              onChange={handlePersonaChange} 
            />
          </div>

          {/* Mobile Chat Thread */}
          <div className="flex-1 overflow-hidden flex flex-col min-h-0">
            <div className="flex-1 overflow-y-auto overscroll-contain">
              <div className="p-4">
                <ChatThread persona={currentPersona} />
              </div>
            </div>
          </div>

          {/* Mobile Input Area - Fixed at bottom */}
          <div className="flex-shrink-0 border-t bg-background">
            <div className="p-4 pb-safe">
              <ChatInput persona={currentPersona} />
            </div>
          </div>
        </div>
      </>
    );
  }

  // Desktop layout (existing design)
  return (
    <Card 
      ref={panelRef}
      className={`fixed bottom-4 right-4 z-50 flex flex-col shadow-xl transition-all duration-300 ease-in-out border-primary/20 overflow-hidden
        ${isMinimized ? 'h-16 w-72' : 'h-[70vh] w-96'}`}
    >
      {/* Header */}
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

      {/* Main Content - Only render if not minimized */}
      {!isMinimized && (
        <>
          {/* Persona Selector */}
          <PersonaSelector 
            currentPersona={currentPersona} 
            onChange={handlePersonaChange} 
          />

          {/* Chat Thread */}
          <ScrollArea className="flex-1 p-4 pt-2">
            <ChatThread persona={currentPersona} />
          </ScrollArea>

          {/* Input Area */}
          <div className="p-2 border-t">
            <ChatInput persona={currentPersona} />
          </div>
        </>
      )}
    </Card>
  );
};

export default LunaPanel; 