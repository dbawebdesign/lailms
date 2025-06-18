"use client";

import React, { useEffect, useState, useRef, useMemo } from 'react';
import { useLunaContext } from '@/hooks/useLunaContext';
import { UIComponentConfig } from '@/context/LunaContextProvider';

interface LunaContextElementProps {
  children: React.ReactNode;
  type: string;
  role: string;
  content?: Record<string, any>;
  state?: Record<string, any>;
  metadata?: Record<string, any>;
  parentId?: string;
  registerEvents?: boolean;
  actionable?: boolean; // Whether this component can be controlled by Luna
}

/**
 * Wrapper component that registers child elements with Luna Context
 * for context-aware AI capabilities
 */
const LunaContextElement: React.FC<LunaContextElementProps> = ({
  children,
  type,
  role,
  content = {},
  state = {},
  metadata = {},
  parentId,
  registerEvents = false,
  actionable = true
}) => {
  const componentRef = useRef<HTMLDivElement>(null);
  const [componentId, setComponentId] = useState<string | null>(null);
  const lunaContext = useLunaContext();
  
  // Memoize the content, state, and metadata to prevent unnecessary re-renders
  const memoizedContent = useMemo(() => content, [content]);
  const memoizedState = useMemo(() => state, [state]);
  const memoizedMetadata = useMemo(() => metadata, [metadata]);

  // Stabilize the lunaContext functions to prevent re-registration
  const lunaContextRef = useRef(lunaContext);
  lunaContextRef.current = lunaContext;

  // Register component with Luna Context
  useEffect(() => {
    if (!lunaContextRef.current.registerComponent) {
      console.warn('Luna Context not available for registration');
      return;
    }

    const componentConfig: UIComponentConfig = {
      type,
      role,
      content: memoizedContent,
      state: memoizedState,
      metadata: memoizedMetadata,
      parentId
    };

    const id = lunaContextRef.current.registerComponent(componentConfig);
    setComponentId(id);

    return () => {
      if (lunaContextRef.current.unregisterComponent && id) {
        lunaContextRef.current.unregisterComponent(id);
      }
    };
  }, [
    type, 
    role, 
    memoizedContent,
    memoizedState,
    memoizedMetadata,
    parentId
  ]);

  // Update component when content or state changes
  useEffect(() => {
    if (componentId && lunaContextRef.current.updateComponent) {
      lunaContextRef.current.updateComponent(componentId, {
        content: memoizedContent,
        state: memoizedState,
        metadata: memoizedMetadata
      });
    }
  }, [componentId, memoizedContent, memoizedState, memoizedMetadata]);

  // Register click event handler
  const handleInteraction = (e: React.MouseEvent) => {
    if (componentId && lunaContextRef.current.recordUserAction) {
      lunaContextRef.current.recordUserAction(componentId, 'click');
    }
  };

  // Register focus event handler
  const handleFocus = (e: React.FocusEvent) => {
    if (componentId && lunaContextRef.current.setFocusedComponent) {
      lunaContextRef.current.setFocusedComponent(componentId);
    }
  };

  // Register blur event handler
  const handleBlur = (e: React.FocusEvent) => {
    if (componentId && lunaContextRef.current.setFocusedComponent) {
      lunaContextRef.current.setFocusedComponent(null);
    }
  };

  // Only add event listeners if registerEvents is true
  const eventProps = registerEvents ? {
    onClick: handleInteraction,
    onFocus: handleFocus,
    onBlur: handleBlur
  } : {};

  // Data attributes for action listener to find this component
  const dataAttributes = actionable && componentId ? {
    'data-luna-id': componentId,
    'data-luna-type': type,
    'data-luna-role': role,
    'data-luna-actionable': 'true'
  } : {};

  return (
    <div 
      ref={componentRef}
      {...eventProps}
      {...dataAttributes}
    >
      {children}
    </div>
  );
};

export default LunaContextElement; 