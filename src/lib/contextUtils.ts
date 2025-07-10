/**
 * Extract only the visible portion of text from a scrollable element
 */
export function getVisibleTextFromElement(element: HTMLElement): string {
  if (!element) return '';

  // If the element has no scrollable area, return all text
  if (element.scrollHeight <= element.clientHeight) {
    return element.textContent || '';
  }

  // For scrollable elements, we want to get text that's currently in view
  const scrollTop = element.scrollTop;
  const scrollBottom = scrollTop + element.clientHeight;
  
  // Get all text nodes in the element
  const textNodes: Node[] = [];
  const walker = document.createTreeWalker(
    element,
    NodeFilter.SHOW_TEXT,
    null
  );
  
  let node: Node | null;
  while ((node = walker.nextNode())) {
    textNodes.push(node);
  }
  
  // Extract text from nodes that are in the viewable area
  let visibleText = '';
  
  for (const node of textNodes) {
    // Skip empty text nodes
    if (!node.textContent?.trim()) continue;
    
    // Get the node's position
    const range = document.createRange();
    range.selectNodeContents(node);
    
    const rect = range.getBoundingClientRect();
    const elementRect = element.getBoundingClientRect();
    
    // Convert client coordinates to element-relative coordinates
    const nodeTop = rect.top - elementRect.top + scrollTop;
    const nodeBottom = rect.bottom - elementRect.top + scrollTop;
    
    // Check if the node is visible in the scrollable area
    if (nodeTop <= scrollBottom && nodeBottom >= scrollTop) {
      visibleText += node.textContent;
    }
  }
  
  return visibleText;
}

/**
 * Create a content summary for large text
 */
export function createContentSummary(text: string, maxLength: number = 500): Record<string, any> {
  if (!text) return { text: '' };
  
  // If text is within limits, return it as is
  if (text.length <= maxLength) {
    return { text };
  }
  
  // Create a summary with both visible excerpt and metadata
  const visibleExcerpt = text.substring(0, maxLength);
  
  return {
    text: visibleExcerpt,
    isTruncated: true,
    fullTextLength: text.length,
    remainingChars: text.length - maxLength,
  };
}

/**
 * Sanitize component props to remove large or sensitive data
 */
export function sanitizeProps(props: Record<string, any>): Record<string, any> {
  if (!props) return {};
  
  const result: Record<string, any> = {};
  
  // Define sensitive key patterns
  const sensitiveKeys = [
    /password/i,
    /token/i,
    /key/i,
    /secret/i,
    /auth/i,
    /credential/i,
  ];
  
  // Check if a key might contain sensitive information
  const isSensitiveKey = (key: string): boolean => {
    return sensitiveKeys.some(pattern => pattern.test(key));
  };
  
  // Process each prop
  for (const [key, value] of Object.entries(props)) {
    // Skip functions, they can't be serialized
    if (typeof value === 'function') continue;
    
    // Skip DOM nodes
    if (value instanceof Node) continue;
    
    // Mask sensitive values
    if (isSensitiveKey(key)) {
      result[key] = '[REDACTED]';
      continue;
    }
    
    // Handle arrays and objects recursively
    if (Array.isArray(value)) {
      // Only include arrays if they're not too large
      if (value.length <= 20) {
        result[key] = value.map(item => 
          typeof item === 'object' && item !== null
            ? sanitizeProps(item as Record<string, any>)
            : item
        );
      } else {
        // Just indicate array length for large arrays
        result[key] = `[Array with ${value.length} items]`;
      }
    } else if (typeof value === 'object' && value !== null) {
      result[key] = sanitizeProps(value as Record<string, any>);
    } else {
      // Simple value, just include it
      result[key] = value;
    }
  }
  
  return result;
}

/**
 * Helper to selectively collect content from elements by selector
 */
export function collectContentBySelector(
  rootElement: HTMLElement,
  selector: string
): Record<string, string> {
  if (!rootElement) return {};
  
  const result: Record<string, string> = {};
  const elements = rootElement.querySelectorAll(selector);
  
  elements.forEach((el, index) => {
    const key = el.getAttribute('data-content-key') || `content-${index}`;
    result[key] = el.textContent || '';
  });
  
  return result;
} 