"use client";

import React, { useState, useEffect, useMemo } from "react";
import Link from "next/link";
import Image from "next/image";
import { usePathname } from "next/navigation";
import { useTheme } from "next-themes";
import { useUIContext } from "@/context/UIContext";
import { ThemeAwareLogo } from "@/components/ui/theme-aware-logo";
import navConfig, { NavItem } from "@/config/navConfig";
import { UserRole } from "@/lib/utils/roleUtils";
import { cn } from "@/lib/utils";
import { ChevronLeft, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useQuickGuide } from "@/hooks/use-quick-guide";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";

interface LeftNavProps {
  userRole: UserRole;
}

const LeftNav: React.FC<LeftNavProps> = ({ userRole }) => {
  const { isNavCollapsed, toggleNavCollapsed, setNavCollapsed, openFeedbackModal } = useUIContext();
  const { openQuickGuide } = useQuickGuide();
  const pathname = usePathname();
  const { resolvedTheme } = useTheme();
  const [mounted, setMounted] = useState(false);
  const [isMobile, setIsMobile] = useState(false);
  const [animateHelp, setAnimateHelp] = useState(false);

  useEffect(() => {
    setMounted(true);

    const handleResize = () => {
      const mobile = window.innerWidth < 768;
      setIsMobile(mobile);

      if (mobile && !isNavCollapsed) {
        setNavCollapsed(true);
      }
    };

    handleResize();
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, [isNavCollapsed, setNavCollapsed]);

  // Listen for the custom event to animate the help link
  useEffect(() => {
    const handleAnimateHelp = () => {
      setAnimateHelp(true);
      // Remove animation after 8 seconds for better visibility
      setTimeout(() => setAnimateHelp(false), 8000);
    };

    window.addEventListener('animateHelpLink', handleAnimateHelp);
    return () => window.removeEventListener('animateHelpLink', handleAnimateHelp);
  }, []);

  const mainNavItems = navConfig.filter(
    (item) => item.roles.includes(userRole) && !item.isBottom
  );
  const bottomNavItems = navConfig.filter(
    (item) => item.roles.includes(userRole) && item.isBottom
  );

  const iconLogoSrc = "/web-app-manifest-512x512.png";

  const handleNavItemClick = (item: NavItem, e: React.MouseEvent) => {
    if (item.href === '/feedback') {
      e.preventDefault();
      openFeedbackModal({ category: 'feedback', priority: 'medium' });
    } else if (item.href === '/quick-guide') {
      e.preventDefault();
      openQuickGuide();
    }
    // For other items, let the Link handle the navigation naturally
  };

  return (
    <aside
      id="navigation"
      className={cn(
        "h-full flex flex-col bg-background border-r border-[#E0E0E0] dark:border-[#333333] animate-gentle-fade-in",
        isNavCollapsed ? "items-center" : "items-start"
      )}
      aria-label="Main Navigation"
      style={{"--animation-delay": "50ms"} as React.CSSProperties}
    >
      <div
        className={cn(
          "h-14 sm:h-16 shrink-0 flex items-center border-b border-[#E0E0E0] dark:border-[#333333] w-full animate-subtle-slide-up",
          isNavCollapsed ? "justify-center px-0" : "justify-between px-4"
        )}
        style={{"--animation-delay": "150ms"} as React.CSSProperties}
      >
        <div className="flex items-center">
          {!isNavCollapsed ? (
            <div 
              className="animate-gentle-fade-in"
              style={{"--animation-delay": "200ms"} as React.CSSProperties}
            >
              <ThemeAwareLogo
                width={160}
                height={32}
                className="py-2"
              />
            </div>
          ) : (
            <Button
              variant="ghost"
              className="p-0 h-auto"
              onClick={toggleNavCollapsed}
              aria-label="Expand Navigation"
            >
              <Image
                src={iconLogoSrc}
                alt="Learnology AI"
                width={32}
                height={32}
                className="py-1"
              />
            </Button>
          )}
        </div>
        {!isNavCollapsed && (
          <Button
            variant="ghost"
            size="icon"
            onClick={toggleNavCollapsed}
            className="h-8 w-8"
            aria-label="Collapse Navigation"
          >
            <ChevronLeft className="h-4 w-4" />
          </Button>
        )}
        {isMobile && !isNavCollapsed && (
          <Button
            variant="ghost"
            size="icon"
            onClick={toggleNavCollapsed}
            className="h-8 w-8 absolute right-2 top-2"
            aria-label="Close Navigation"
          >
            <X className="h-4 w-4" />
          </Button>
        )}
      </div>

      <nav className="flex-1 w-full overflow-y-auto py-4 space-y-1 px-2">
        {mainNavItems.map((item, index) => (
          <TooltipProvider key={item.href} delayDuration={0}>
            <Tooltip>
              <TooltipTrigger asChild>
                <Link
                  href={item.href}
                  onClick={(e) => handleNavItemClick(item, e)}
                  className={cn(
                    "flex items-center py-2 px-3 rounded-md text-sm font-medium transition-colors animate-subtle-slide-up",
                    pathname === item.href
                      ? "bg-gradient-to-r from-[#FF835D] via-[#E45DE5] to-[#6B5DE5] text-white"
                      : "text-muted-foreground hover:bg-gradient-to-r hover:from-[#6B5DE5]/5 hover:to-[#6B5DE5]/10 hover:text-foreground",
                    isNavCollapsed ? "justify-center" : "w-full"
                  )}
                  style={{"--animation-delay": `${300 + (index * 50)}ms`} as React.CSSProperties}
                >
                  <item.icon
                    className={cn(
                      "h-5 w-5 flex-shrink-0",
                      pathname === item.href ? "text-white" : "text-muted-foreground"
                    )}
                  />
                  {!isNavCollapsed && (
                    <span className="ml-3 truncate">{item.title}</span>
                  )}
                </Link>
              </TooltipTrigger>
              {isNavCollapsed && (
                <TooltipContent side="right" className="bg-popover text-popover-foreground border shadow-md">
                  {item.title}
                </TooltipContent>
              )}
            </Tooltip>
          </TooltipProvider>
        ))}
      </nav>

      {/* Bottom Navigation Items */}
      {bottomNavItems.length > 0 && (
        <nav className="w-full mt-auto border-t border-[#E0E0E0] dark:border-[#333333] py-4 space-y-1 px-2 shrink-0">
          {bottomNavItems.map((item) => (
            <TooltipProvider key={item.href} delayDuration={0}>
              <Tooltip>
                <TooltipTrigger asChild>
                  <Link
                    href={item.href}
                    onClick={(e) => handleNavItemClick(item, e)}
                    className={cn(
                      "flex items-center py-2 px-3 rounded-md text-sm font-medium transition-all relative",
                      pathname === item.href
                        ? "bg-gradient-to-r from-[#FF835D] via-[#E45DE5] to-[#6B5DE5] text-white"
                        : "text-muted-foreground hover:bg-gradient-to-r hover:from-[#6B5DE5]/5 hover:to-[#6B5DE5]/10 hover:text-foreground",
                      isNavCollapsed ? "justify-center" : "w-full",
                      // Add animation for Quick Guide link
                      item.title === "Quick Guide" && animateHelp && "animate-pulse ring-2 ring-blue-500 ring-offset-2 ring-offset-background bg-blue-50 dark:bg-blue-950/20"
                    )}
                  >
                    <item.icon
                      className={cn(
                        "h-5 w-5 flex-shrink-0",
                        pathname === item.href ? "text-white" : "text-muted-foreground",
                        item.title === "Quick Guide" && animateHelp && "text-blue-500"
                      )}
                    />
                    {!isNavCollapsed && (
                      <span className="ml-3 truncate">{item.title}</span>
                    )}
                    {/* Tooltip for Quick Guide link when animating */}
                    {item.title === "Quick Guide" && animateHelp && !isNavCollapsed && (
                      <span className="absolute -right-2 -top-2 flex h-3 w-3">
                        <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-blue-400 opacity-75"></span>
                        <span className="relative inline-flex rounded-full h-3 w-3 bg-blue-500"></span>
                      </span>
                    )}
                  </Link>
                </TooltipTrigger>
                {isNavCollapsed && (
                  <TooltipContent side="right" className="bg-popover text-popover-foreground border shadow-md">
                    {item.title}
                  </TooltipContent>
                )}
              </Tooltip>
            </TooltipProvider>
          ))}
        </nav>
      )}
    </aside>
  );
};

export default LeftNav; 