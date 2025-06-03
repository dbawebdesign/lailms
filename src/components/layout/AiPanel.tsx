"use client";

import React, { useEffect, useState } from 'react';
import { Button } from '@/components/ui/button';
import { X } from 'lucide-react';
import { useUIContext } from '@/context/UIContext';
import { LunaAIChat } from '@/components/LunaAIChat';
import { cn } from '@/lib/utils';
import type { UserRole } from "@/config/navConfig"; // Import UserRole

// Reuse the same hover class for consistency across components
const buttonHoverClass = "hover:bg-gradient-to-r hover:from-[#6B5DE5]/5 hover:to-[#6B5DE5]/10";

interface AiPanelProps {
  userRole: UserRole;
}

const AiPanel: React.FC<AiPanelProps> = ({ userRole }) => {
  const { togglePanelVisible, isPanelVisible } = useUIContext();
  const [isMobile, setIsMobile] = useState(false);
  const [viewportHeight, setViewportHeight] = useState('100vh');

  useEffect(() => {
    const handleResizeAndViewport = () => {
      const mobile = window.innerWidth < 768;
      setIsMobile(mobile);
      
      if (mobile) {
        const visualHeight = window.visualViewport?.height || window.innerHeight;
        setViewportHeight(`${visualHeight}px`);
        const vh = visualHeight * 0.01;
        document.documentElement.style.setProperty('--vh', `${vh}px`);
      } else {
        setViewportHeight('100vh');
        // Reset --vh if not mobile or ensure it's not misapplied
        document.documentElement.style.removeProperty('--vh');
      }
    };

    handleResizeAndViewport(); // Initial call
    
    window.addEventListener('resize', handleResizeAndViewport);
    window.addEventListener('orientationchange', handleResizeAndViewport);
    if (window.visualViewport) {
      window.visualViewport.addEventListener('resize', handleResizeAndViewport);
    }

    return () => {
      window.removeEventListener('resize', handleResizeAndViewport);
      window.removeEventListener('orientationchange', handleResizeAndViewport);
      if (window.visualViewport) {
        window.visualViewport.removeEventListener('resize', handleResizeAndViewport);
      }
    };
  }, []);

  useEffect(() => {
    let originalBodyOverflow = '';
    let originalBodyPosition = '';
    let originalBodyTop = '';
    let originalBodyWidth = '';
    let originalBodyHeight = '';
    let originalDocElementOverflow = '';
    let scrollY = 0;
    let stylesApplied = false;

    if (isMobile && isPanelVisible) {
      scrollY = window.scrollY;
      const bodyStyle = window.getComputedStyle(document.body);
      originalBodyOverflow = bodyStyle.overflow;
      originalBodyPosition = bodyStyle.position;
      originalBodyTop = bodyStyle.top;
      originalBodyWidth = bodyStyle.width;
      originalBodyHeight = bodyStyle.height;

      document.body.style.overflow = 'hidden';
      document.body.style.position = 'fixed';
      document.body.style.top = `-${scrollY}px`;
      document.body.style.width = '100%';
      document.body.style.height = '100vh'; // Use 100vh when fixed

      originalDocElementOverflow = document.documentElement.style.overflow;
      document.documentElement.style.overflow = 'hidden';
      stylesApplied = true;
    }

    return () => {
      if (stylesApplied) {
        document.body.style.overflow = originalBodyOverflow;
        document.body.style.position = originalBodyPosition;
        document.body.style.top = originalBodyTop;
        document.body.style.width = originalBodyWidth;
        document.body.style.height = originalBodyHeight;
        document.documentElement.style.overflow = originalDocElementOverflow;
        window.scrollTo(0, scrollY);
      }
    };
  }, [isMobile, isPanelVisible]);

  // Mobile full-screen layout - only render when panel is visible
  if (isMobile && isPanelVisible) {
    return (
      <div 
        className="fixed inset-0 flex flex-col bg-background mobile-chat-overlay"
        style={{ 
          height: viewportHeight,
          minHeight: viewportHeight,
          maxHeight: viewportHeight,
          zIndex: 9999, // Ensure it's above everything including mobile nav
          isolation: 'isolate' // Create new stacking context
        }}
      >
        {/* Mobile Header */}
        <div className="bg-primary px-4 py-3 text-primary-foreground flex items-center justify-between border-b flex-shrink-0 relative z-10">
          <h2 className="font-medium text-lg">Luna Assistant</h2>
          <Button 
            variant="ghost" 
            size="icon" 
            className="h-8 w-8 text-primary-foreground hover:bg-primary/80"
            onClick={togglePanelVisible}
            aria-label="Close AI Panel"
          >
            <X size={20} />
          </Button>
        </div>

        {/* Mobile Luna AI Chat Component - Full remaining space */}
        <div className="flex-1 overflow-hidden min-h-0 relative bg-background">
          <LunaAIChat userRole={userRole} isMobile={true} />
        </div>
      </div>
    );
  }

  // On mobile, if panel is not visible, don't render anything
  if (isMobile && !isPanelVisible) {
    return null;
  }

  // Desktop layout (original) - only render when panel is visible
  if (!isMobile && isPanelVisible) {
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
          <LunaAIChat userRole={userRole} />
        </div>
      </aside>
    );
  }

  // Default: panel is not visible
  return null;
};

export default AiPanel; 