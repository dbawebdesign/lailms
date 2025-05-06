"use client";

import React, { useEffect, useState } from 'react';
import { Button } from '@/components/ui/button';
import { X } from 'lucide-react';
import { useUIContext } from '@/context/UIContext';
import { LunaAIChat } from '@/components/LunaAIChat';
import { cn } from '@/lib/utils';

// Reuse the same hover class for consistency across components
const buttonHoverClass = "hover:bg-gradient-to-r hover:from-[#6B5DE5]/5 hover:to-[#6B5DE5]/10";

const AiPanel = () => {
  const { togglePanelVisible } = useUIContext();
  const [isMobile, setIsMobile] = useState(false);

  useEffect(() => {
    const handleResize = () => {
      setIsMobile(window.innerWidth < 768);
    };

    // Set initial state
    handleResize();
    
    // Add event listener
    window.addEventListener('resize', handleResize);
    
    // Clean up
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  return (
    <aside
      className="h-full flex flex-col bg-background border-l border-[#E0E0E0] dark:border-[#333333]"
      aria-label="AI Chat Panel"
    >
      {/* Panel Header */}
      <div className="h-14 sm:h-16 flex items-center justify-between px-4 sm:px-6 border-b border-[#E0E0E0] dark:border-[#333333] shrink-0">
        <div className="flex items-center gap-2">
          <Button
            variant="ghost"
            size="icon"
            onClick={togglePanelVisible}
            aria-label="Close AI Panel"
            className={cn("h-8 w-8", buttonHoverClass)}
          >
            <X className="h-5 w-5" />
          </Button>
          <h2 className="text-lg font-semibold">Luna Assistant</h2>
        </div>
        
        {/* Right side of header - intentionally empty */}
        <div></div>
      </div>

      {/* Luna AI Chat Component */}
      <div className="flex-1 overflow-y-auto py-4 px-2">
        <LunaAIChat />
      </div>
    </aside>
  );
};

export default AiPanel; 