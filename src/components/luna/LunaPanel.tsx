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
  const panelRef = useRef<HTMLDivElement>(null);
  const { registerComponent, unregisterComponent, updateComponent } = useLunaContext();

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
  const togglePanel = () => {
    setIsOpen(!isOpen);
    if (isMinimized && !isOpen) {
      setIsMinimized(false);
    }
  };

  // Toggle minimized state
  const toggleMinimize = (e: React.MouseEvent) => {
    e.stopPropagation();
    setIsMinimized(!isMinimized);
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
        className="fixed bottom-4 right-4 z-50 rounded-full p-4 shadow-lg bg-primary text-primary-foreground"
        aria-label="Open Luna Assistant"
      >
        Luna
      </Button>
    );
  }

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