import { useState, useEffect, useCallback } from 'react';

interface SelectionData {
  text: string;
  range: Range;
  rect: DOMRect;
  containerId: string;
}

export function useTextSelection(containerId: string) {
  const [selection, setSelection] = useState<SelectionData | null>(null);
  const [isVisible, setIsVisible] = useState(false);

  const handleSelectionChange = useCallback(() => {
    const windowSelection = window.getSelection();
    
    if (!windowSelection || windowSelection.rangeCount === 0) {
      setSelection(null);
      setIsVisible(false);
      return;
    }

    const range = windowSelection.getRangeAt(0);
    const selectedText = windowSelection.toString().trim();
    
    if (!selectedText || selectedText.length < 3) {
      setSelection(null);
      setIsVisible(false);
      return;
    }

    // Check if selection is within our container
    const container = document.getElementById(containerId);
    if (!container || !container.contains(range.commonAncestorContainer)) {
      setSelection(null);
      setIsVisible(false);
      return;
    }

    // Get the bounding rect of the selection
    const rect = range.getBoundingClientRect();
    
    if (rect.width === 0 && rect.height === 0) {
      setSelection(null);
      setIsVisible(false);
      return;
    }

    setSelection({
      text: selectedText,
      range: range.cloneRange(),
      rect,
      containerId
    });
    setIsVisible(true);
  }, [containerId]);

  const clearSelection = useCallback(() => {
    setSelection(null);
    setIsVisible(false);
    window.getSelection()?.removeAllRanges();
  }, []);

  useEffect(() => {
    document.addEventListener('selectionchange', handleSelectionChange);
    document.addEventListener('mouseup', handleSelectionChange);
    document.addEventListener('click', (e) => {
      // Clear selection if clicking outside the container or popover
      const container = document.getElementById(containerId);
      const popover = document.querySelector('[data-luna-popover]');
      
      if (container && !container.contains(e.target as Node) && 
          popover && !popover.contains(e.target as Node)) {
        clearSelection();
      }
    });

    return () => {
      document.removeEventListener('selectionchange', handleSelectionChange);
      document.removeEventListener('mouseup', handleSelectionChange);
    };
  }, [handleSelectionChange, clearSelection, containerId]);

  return {
    selection,
    isVisible,
    clearSelection
  };
} 