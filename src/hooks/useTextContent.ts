import { useEffect, useRef } from 'react';
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
  
  // Setup the content tracking
  useEffect(() => {
    if (!componentId || !elementRef.current) return;
    
    // Initial content capture
    const updateTextContent = () => {
      const element = elementRef.current;
      if (!element) return;
      
      // Get text content (either all or just visible portion)
      const rawText = trackVisibleOnly
        ? getVisibleTextFromElement(element)
        : element.textContent || '';
      
      // Create a content summary if needed
      const contentData = createContentSummary(rawText, maxLength);
      
      // Update the component's content
      updateContent(contentData);
    };
    
    // Call immediately for initial state
    updateTextContent();
    
    // Setup mutation observer to track content changes
    observer.current = new MutationObserver(updateTextContent);
    
    observer.current.observe(elementRef.current, {
      characterData: true,
      childList: true,
      subtree: true
    });
    
    // If tracking visible content, also listen for scroll events
    if (trackVisibleOnly && elementRef.current) {
      elementRef.current.addEventListener('scroll', updateTextContent);
    }
    
    // Cleanup
    return () => {
      observer.current?.disconnect();
      
      if (trackVisibleOnly && elementRef.current) {
        elementRef.current.removeEventListener('scroll', updateTextContent);
      }
    };
  }, [componentId, elementRef, maxLength, trackVisibleOnly, updateContent]);
  
  return componentId;
} 