import { useEffect, useRef, useCallback } from 'react';
import { useUIContext } from './useUIContext';
import { createContentSummary, getVisibleTextFromElement } from '@/lib/contextUtils';

interface TextContentOptions {
  role: string;
  type?: string;
  identifier?: string;
  maxLength?: number;
  trackVisibleOnly?: boolean;
  metadata?: Record<string, any>;
}

/**
 * A specialized hook for text content components
 * Automatically tracks text content changes using MutationObserver
 */
export function useTextContent(
  elementRef: React.RefObject<HTMLElement | null>,
  options: TextContentOptions
) {
  const {
    role,
    type = 'textContent',
    identifier,
    maxLength = 1000,
    trackVisibleOnly = false,
    metadata = {}
  } = options;
  
  // Register with the UI context
  const { componentId, updateContent } = useUIContext({
    type,
    role,
    metadata: {
      identifier,
      ...metadata
    }
  });
  
  // Reference to mutation observer
  const observer = useRef<MutationObserver | null>(null);
  
  // Memoized function to update text content
  const updateTextContentInternal = useCallback(() => {
    const element = elementRef.current;
    // Ensure updateContent is available (it should be, but good practice for useCallback dependencies)
    if (!element || !updateContent) return;
    
    const rawText = trackVisibleOnly
      ? getVisibleTextFromElement(element)
      : element.textContent || '';
    
    const contentData = createContentSummary(rawText, maxLength);
    updateContent(contentData);
  }, [elementRef, trackVisibleOnly, maxLength, updateContent]);
  
  // Setup the content tracking
  useEffect(() => {
    if (!componentId || !elementRef.current) return;
    
    // Initial content capture
    updateTextContentInternal();
    
    // Setup mutation observer to track content changes
    observer.current = new MutationObserver(updateTextContentInternal);
    
    observer.current.observe(elementRef.current, {
      characterData: true,
      childList: true,
      subtree: true
    });
    
    let scrollTargetElement: HTMLElement | null = null;
    if (trackVisibleOnly && elementRef.current) {
      scrollTargetElement = elementRef.current;
      scrollTargetElement.addEventListener('scroll', updateTextContentInternal);
    }
    
    // Cleanup
    return () => {
      observer.current?.disconnect();
      if (trackVisibleOnly && scrollTargetElement) {
        scrollTargetElement.removeEventListener('scroll', updateTextContentInternal);
      }
    };
  }, [componentId, elementRef, trackVisibleOnly, updateTextContentInternal]);
  
  return componentId;
} 