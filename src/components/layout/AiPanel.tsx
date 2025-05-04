"use client";

import React from 'react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Send, ChevronRight } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useUIContext } from '@/context/UIContext';

const AiPanel = () => {
  const { togglePanelVisible } = useUIContext();

  return (
    <aside
      className="h-full flex flex-col bg-background border-l border-[#E0E0E0] dark:border-[#333333]"
      aria-label="AI Chat Panel"
    >
      {/* Panel Header */}
      <div className="h-16 flex items-center justify-start px-6 border-b border-[#E0E0E0] dark:border-[#333333] shrink-0 gap-2">
        <Button
          variant="ghost"
          size="icon"
          onClick={togglePanelVisible}
          aria-label="Collapse AI Panel"
          className="h-8 w-8"
        >
          <ChevronRight className="h-4 w-4" />
        </Button>
        <h2 className="text-lg font-semibold">Luna Assistant</h2>
        {/* Add persona switcher or other controls here later */}
      </div>

      {/* Message List Area */}
      <div className="flex-1 p-6 overflow-y-auto space-y-4">
        {/* Placeholder for chat messages */}
        <div className={cn(
          "p-3 rounded-lg self-start max-w-xs",
          "bg-primary/10 dark:bg-primary/20 text-primary dark:text-primary-foreground"
        )}>
          Hello! How can I help you learn today?
        </div>
        <div className={cn(
          "p-3 rounded-lg self-end max-w-xs ml-auto",
          "bg-muted dark:bg-muted/50"
        )}>
          Tell me about photosynthesis.
        </div>
         <div className={cn(
          "p-3 rounded-lg self-start max-w-xs",
          "bg-primary/10 dark:bg-primary/20 text-primary dark:text-primary-foreground"
        )}>
          Okay, let's dive in! Photosynthesis is...
        </div>
      </div>

      {/* Input Area */}
      <div className="p-6 border-t border-[#E0E0E0] dark:border-[#333333] shrink-0">
        <div className="flex gap-2">
          <Input placeholder="Ask Luna anything..." className="flex-1" />
          <Button size="icon" aria-label="Send message">
            <Send className="h-4 w-4" />
          </Button>
        </div>
        {/* TODO: Add Slash Command Palette trigger/integration later */}
      </div>
    </aside>
  );
};

export default AiPanel; 