"use client";

import React from 'react';
import { Button } from '@/components/ui/button';
import { ChevronRight } from 'lucide-react';
import { useUIContext } from '@/context/UIContext';
import { LunaAIChat } from '@/components/LunaAIChat';

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
      </div>

      {/* Luna AI Chat Component */}
      <div className="flex-1 overflow-y-auto py-4 px-2">
        <LunaAIChat />
      </div>
    </aside>
  );
};

export default AiPanel; 