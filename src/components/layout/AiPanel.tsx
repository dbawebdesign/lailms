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
  const { togglePanelVisible } = useUIContext();
  const [isMobile, setIsMobile] = useState(false);
  const [viewportHeight, setViewportHeight] = useState('100vh');
  const [keyboardHeight, setKeyboardHeight] = useState(0);

  useEffect(() => {
    const handleResize = () => {
      const mobile = window.innerWidth < 768;
      setIsMobile(mobile);
      
      if (mobile) {
        // Calculate the difference between window.innerHeight and visual viewport
        // This gives us the keyboard height
        const windowHeight = window.innerHeight;
        const visualHeight = window.visualViewport?.height || windowHeight;
        const keyboardHeight = windowHeight - visualHeight;
        
        setKeyboardHeight(keyboardHeight);
        setViewportHeight(`${visualHeight}px`);
        
        // Set CSS custom property for viewport height
        const vh = visualHeight * 0.01;
        document.documentElement.style.setProperty('--vh', `${vh}px`);
      } else {
        setViewportHeight('100vh');
        setKeyboardHeight(0);
      }
    };

    // Initial check
    handleResize();
    
    // Add event listeners
    window.addEventListener('resize', handleResize);
    window.addEventListener('orientationchange', handleResize);

    // Handle visual viewport API for better keyboard detection
    if (window.visualViewport && typeof window !== 'undefined') {
      const handleViewportChange = () => {
        if (window.innerWidth < 768) {
          const windowHeight = window.innerHeight;
          const visualHeight = window.visualViewport?.height || windowHeight;
          const keyboardHeight = Math.max(0, windowHeight - visualHeight);
          
          setKeyboardHeight(keyboardHeight);
          setViewportHeight(`${visualHeight}px`);
          
          // Update CSS custom property
          const vh = visualHeight * 0.01;
          document.documentElement.style.setProperty('--vh', `${vh}px`);
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

  // Prevent background scrolling and fix positioning when mobile panel is open
  useEffect(() => {
    if (isMobile) {
      // Store the current scroll position
      const scrollY = window.scrollY;
      
      // Apply styles to prevent scrolling and fix positioning
      const originalStyle = window.getComputedStyle(document.body);
      const originalOverflow = originalStyle.overflow;
      const originalPosition = originalStyle.position;
      const originalTop = originalStyle.top;
      const originalWidth = originalStyle.width;
      
      // Prevent all scrolling and fix the body position
      document.body.style.overflow = 'hidden';
      document.body.style.position = 'fixed';
      document.body.style.top = `-${scrollY}px`;
      document.body.style.width = '100%';
      document.body.style.height = '100%';
      
      // Also prevent scrolling on the html element
      document.documentElement.style.overflow = 'hidden';
      
      return () => {
        // Restore original styles
        document.body.style.overflow = originalOverflow;
        document.body.style.position = originalPosition;
        document.body.style.top = originalTop;
        document.body.style.width = originalWidth;
        document.body.style.height = '';
        document.documentElement.style.overflow = '';
        
        // Restore scroll position
        window.scrollTo(0, scrollY);
      };
    }
  }, [isMobile]);

  // Mobile full-screen layout
  if (isMobile) {
    return (
      <div 
        className="fixed inset-0 flex flex-col bg-background touch-none overscroll-none mobile-chat-overlay"
        style={{ 
          height: '100vh',
          minHeight: '100vh',
          maxHeight: '100vh',
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

        {/* Mobile Luna AI Chat Component - Full screen */}
        <div 
          className="flex-1 overflow-hidden flex flex-col min-h-0 relative bg-background"
          style={{ height: `calc(${viewportHeight} - 60px)` }} // Subtract header height
        >
          <LunaAIChat userRole={userRole} isMobile={true} />
        </div>
      </div>
    );
  }

  // Desktop layout (original)
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
};

export default AiPanel; 