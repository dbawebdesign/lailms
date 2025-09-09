'use client';

import React, { useState, useRef, useCallback } from 'react';
import { Plus, Trash2 } from 'lucide-react';
import { cn } from '@/lib/utils';

interface HoverInsertionWrapperProps {
  children: React.ReactNode;
  itemType: 'path' | 'lesson' | 'section';
  itemId: string;
  onInsertAbove: () => void;
  onInsertBelow: () => void;
  onDelete?: () => void;
  className?: string;
  disabled?: boolean;
  canDelete?: boolean;
}

export const HoverInsertionWrapper: React.FC<HoverInsertionWrapperProps> = ({
  children,
  itemType,
  itemId,
  onInsertAbove,
  onInsertBelow,
  onDelete,
  className,
  disabled = false,
  canDelete = true
}) => {
  const [isDirectlyHovered, setIsDirectlyHovered] = useState(false);
  const [showAbove, setShowAbove] = useState(false);
  const [showBelow, setShowBelow] = useState(false);
  const [showDelete, setShowDelete] = useState(false);
  const hoverTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const wrapperRef = useRef<HTMLDivElement>(null);

  const checkDirectHover = useCallback((e: React.MouseEvent) => {
    if (!wrapperRef.current || disabled) return false;
    
    // Get the element that the mouse is directly over
    const elementUnderMouse = document.elementFromPoint(e.clientX, e.clientY);
    if (!elementUnderMouse) return false;
    
    // Check if the mouse is over this wrapper or its direct children (not nested wrappers)
    const isOverThisWrapper = wrapperRef.current.contains(elementUnderMouse);
    
    // Check if the mouse is over a nested HoverInsertionWrapper
    const isOverNestedWrapper = elementUnderMouse.closest('[data-hover-insertion-wrapper]') !== wrapperRef.current;
    
    return isOverThisWrapper && !isOverNestedWrapper;
  }, [disabled]);

  const handleMouseMove = useCallback((e: React.MouseEvent) => {
    if (disabled) return;
    
    const isDirectlyOver = checkDirectHover(e);
    
    if (isDirectlyOver && !isDirectlyHovered) {
      // Clear any existing timeout
      if (hoverTimeoutRef.current) {
        clearTimeout(hoverTimeoutRef.current);
      }
      
      // Set a small delay before showing the plus icons for a cleaner UX
      hoverTimeoutRef.current = setTimeout(() => {
        setIsDirectlyHovered(true);
        setShowAbove(true);
        setShowBelow(true);
        setShowDelete(canDelete && !!onDelete);
      }, 150);
    } else if (!isDirectlyOver && isDirectlyHovered) {
      // Clear timeout if mouse moves away
      if (hoverTimeoutRef.current) {
        clearTimeout(hoverTimeoutRef.current);
      }
      
      setIsDirectlyHovered(false);
      setShowAbove(false);
      setShowBelow(false);
      setShowDelete(false);
    }
  }, [disabled, isDirectlyHovered, checkDirectHover]);

  const handleMouseLeave = useCallback((e: React.MouseEvent) => {
    if (disabled) return;
    
    // Clear timeout if mouse leaves
    if (hoverTimeoutRef.current) {
      clearTimeout(hoverTimeoutRef.current);
    }
    
    setIsDirectlyHovered(false);
    setShowAbove(false);
    setShowBelow(false);
    setShowDelete(false);
  }, [disabled]);

  const handleInsertAbove = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    onInsertAbove();
  };

  const handleInsertBelow = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    onInsertBelow();
  };

  const handleDelete = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (onDelete) {
      onDelete();
    }
  };

  // Clean up timeout on unmount
  React.useEffect(() => {
    return () => {
      if (hoverTimeoutRef.current) {
        clearTimeout(hoverTimeoutRef.current);
      }
    };
  }, []);

  return (
    <div
      ref={wrapperRef}
      className={cn("relative group", className)}
      onMouseMove={handleMouseMove}
      onMouseLeave={handleMouseLeave}
      data-item-type={itemType}
      data-item-id={itemId}
      data-hover-insertion-wrapper="true"
    >
      {/* Insert Above Button */}
      <div
                  className={cn(
            "absolute -top-2 left-1/2 transform -translate-x-1/2 z-50 transition-all duration-200 ease-in-out",
            showAbove && isDirectlyHovered
              ? "opacity-100 scale-100"
              : "opacity-0 translate-y-2 scale-95 pointer-events-none"
          )}
      >
        <button
          onClick={handleInsertAbove}
          className={cn(
            "flex items-center justify-center w-6 h-6 rounded-full shadow-lg transition-all duration-200 ease-in-out",
            "bg-primary text-primary-foreground hover:bg-primary/90 hover:scale-110",
            "border-2 border-background",
            "focus:outline-none focus:ring-2 focus:ring-primary/50 focus:ring-offset-2"
          )}
          title={`Insert new ${itemType} above`}
          aria-label={`Insert new ${itemType} above`}
        >
          <Plus size={14} className="stroke-2" />
        </button>
      </div>

      {/* Main Content */}
      <div className="relative">
        {children}
      </div>

      {/* Insert Below Button */}
      <div
                  className={cn(
            "absolute -bottom-2 left-1/2 transform -translate-x-1/2 z-50 transition-all duration-200 ease-in-out",
            showBelow && isDirectlyHovered
              ? "opacity-100 scale-100"
              : "opacity-0 -translate-y-2 scale-95 pointer-events-none"
          )}
      >
        <button
          onClick={handleInsertBelow}
          className={cn(
            "flex items-center justify-center w-6 h-6 rounded-full shadow-lg transition-all duration-200 ease-in-out",
            "bg-primary text-primary-foreground hover:bg-primary/90 hover:scale-110",
            "border-2 border-background",
            "focus:outline-none focus:ring-2 focus:ring-primary/50 focus:ring-offset-2"
          )}
          title={`Insert new ${itemType} below`}
          aria-label={`Insert new ${itemType} below`}
        >
          <Plus size={14} className="stroke-2" />
        </button>
      </div>

      {/* Delete Button */}
      {canDelete && onDelete && (
        <div
          className={cn(
            "absolute top-1/2 -right-2 transform -translate-y-1/2 z-50 transition-all duration-200 ease-in-out",
            showDelete && isDirectlyHovered
              ? "opacity-100 scale-100"
              : "opacity-0 translate-x-2 scale-95 pointer-events-none"
          )}
        >
          <button
            onClick={handleDelete}
            className={cn(
              "flex items-center justify-center w-6 h-6 rounded-full shadow-lg transition-all duration-200 ease-in-out",
              "bg-red-600 text-white hover:bg-red-700 hover:scale-110",
              "border-2 border-background",
              "focus:outline-none focus:ring-2 focus:ring-red-500/50 focus:ring-offset-2"
            )}
            title={`Delete ${itemType}`}
            aria-label={`Delete ${itemType}`}
          >
            <Trash2 size={12} className="stroke-2" />
          </button>
        </div>
      )}
    </div>
  );
};

