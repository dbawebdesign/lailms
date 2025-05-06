"use client";

import React, { useEffect, useState, useRef } from 'react';
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

  // Register component with Luna Context
  useEffect(() => {
    if (!lunaContext.registerComponent) {
      console.warn('Luna Context not available for registration');
      return;
    }

    const componentConfig: UIComponentConfig = {
      type,
      role,
      content,
      state,
      metadata,
      parentId
    };

    const id = lunaContext.registerComponent(componentConfig);
    setComponentId(id);

    return () => {
      if (lunaContext.unregisterComponent && id) {
        lunaContext.unregisterComponent(id);
      }
    };
  }, [
    type, 
    role, 
    lunaContext.registerComponent, 
    lunaContext.unregisterComponent
  ]);

  // Update component when content or state changes
  useEffect(() => {
    if (componentId && lunaContext.updateComponent) {
      lunaContext.updateComponent(componentId, {
        content,
        state,
        metadata
      });
    }
  }, [componentId, content, state, metadata, lunaContext.updateComponent]);

  // Register click event handler
  const handleInteraction = (e: React.MouseEvent) => {
    if (componentId && lunaContext.recordUserAction) {
      lunaContext.recordUserAction(componentId, 'click');
    }
  };

  // Register focus event handler
  const handleFocus = (e: React.FocusEvent) => {
    if (componentId && lunaContext.setFocusedComponent) {
      lunaContext.setFocusedComponent(componentId);
    }
  };

  // Register blur event handler
  const handleBlur = (e: React.FocusEvent) => {
    if (componentId && lunaContext.setFocusedComponent) {
      lunaContext.setFocusedComponent(null);
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