"use client";

import React, { useState, useEffect } from "react";
import Link from "next/link";
import Image from "next/image";
import { usePathname } from "next/navigation";
import { useTheme } from "next-themes";
import { useUIContext } from "@/context/UIContext";
import navConfig, { NavItem } from "@/config/navConfig";
import { UserRole } from "@/lib/utils/roleUtils";
import { cn } from "@/lib/utils";
import { ChevronLeft, X } from "lucide-react";
import { Button } from "@/components/ui/button";
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
  const pathname = usePathname();
  const { resolvedTheme } = useTheme();
  const [mounted, setMounted] = useState(false);
  const [isMobile, setIsMobile] = useState(false);

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

  const mainNavItems = navConfig.filter(
    (item) => item.roles.includes(userRole) && !item.isBottom
  );
  const bottomNavItems = navConfig.filter(
    (item) => item.roles.includes(userRole) && item.isBottom
  );

  const fullLogoSrc = mounted && resolvedTheme === 'dark'
    ? "/Horizontal white text.png"
    : "/Horizontal black text.png";
  const iconLogoSrc = "/web-app-manifest-512x512.png";

  const handleNavItemClick = (item: NavItem, e: React.MouseEvent) => {
    if (item.href === '/feedback') {
      e.preventDefault();
      openFeedbackModal({ category: 'feedback', priority: 'medium' });
    }
    // For other items, let the Link handle the navigation naturally
  };

  return (
    <aside
      id="navigation"
      className={cn(
        "h-full flex flex-col bg-background border-r border-[#E0E0E0] dark:border-[#333333]",
        isNavCollapsed ? "items-center" : "items-start"
      )}
      aria-label="Main Navigation"
    >
      <div
        className={cn(
          "h-14 sm:h-16 shrink-0 flex items-center border-b border-[#E0E0E0] dark:border-[#333333]",
          isNavCollapsed ? "justify-center w-full px-0" : "justify-between w-full px-4"
        )}
      >
        <div className="flex items-center">
          {!isNavCollapsed ? (
            <Image
              src={fullLogoSrc}
              alt="Learnology AI"
              width={160}
              height={32}
              className="py-2"
            />
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
        {mainNavItems.map((item) => (
          <TooltipProvider key={item.href} delayDuration={0}>
            <Tooltip>
              <TooltipTrigger asChild>
                <Link
                  href={item.href}
                  className={cn(
                    "flex items-center py-2 px-3 rounded-md text-sm font-medium transition-colors",
                    pathname === item.href
                      ? "bg-gradient-to-r from-[#FF835D] via-[#E45DE5] to-[#6B5DE5] text-white"
                      : "text-muted-foreground hover:bg-gradient-to-r hover:from-[#6B5DE5]/5 hover:to-[#6B5DE5]/10 hover:text-foreground",
                    isNavCollapsed ? "justify-center" : "w-full"
                  )}
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
                      "flex items-center py-2 px-3 rounded-md text-sm font-medium transition-colors",
                      pathname === item.href
                        ? "bg-gradient-to-r from-[#FF835D] via-[#E45DE5] to-[#6B5DE5] text-white"
                        : "text-muted-foreground hover:bg-gradient-to-r hover:from-[#6B5DE5]/5 hover:to-[#6B5DE5]/10 hover:text-foreground",
                      isNavCollapsed ? "justify-center" : "w-full"
                    )}
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
      )}
    </aside>
  );
};

export default LeftNav; 