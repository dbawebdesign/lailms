"use client";

import React, { createContext, useCallback, useContext, useEffect, useRef, useState } from 'react';
import { usePathname } from 'next/navigation';
import { v4 as uuidv4 } from 'uuid';

// Define the component data structure
export interface UIComponentData {
  id: string;                     // Unique identifier for the component
  type: string;                   // Component type (e.g., 'button', 'form', 'table')
  role: string;                   // Purpose (e.g., 'navigation', 'content', 'action')
  route: string;                  // Current route/page
  props?: Record<string, any>;    // Component props (sanitized)
  state?: Record<string, any>;    // Component internal state (if shared)
  content?: Record<string, any>;  // Actual content (text, data, etc.)
  isVisible?: boolean;            // Visibility status
  children?: string[];            // Child component IDs for hierarchy
  parentId?: string;              // Parent component ID
  lastUpdated: number;            // Timestamp for staleness detection
  metadata?: Record<string, any>; // Additional context-specific data
}

// Serialized UI context that will be passed to Luna
export interface SerializedUIContext {
  timestamp: number;              // When snapshot was taken
  route: string;                  // Current application route
  components: UIComponentData[];  // Flat array of component data
  focused?: string;               // ID of focused component if any
  lastUserAction?: {              // Last user interaction
    componentId: string;
    actionType: string;
    timestamp: number;
  };
  viewportSize: {                 // Current viewport dimensions
    width: number;
    height: number;
  };
  sessionId: string;              // Current session ID
}

// Input config for useUIContext hook
export interface UIComponentConfig {
  type: string;
  role: string;
  props?: Record<string, any>;
  state?: Record<string, any>;
  content?: Record<string, any>;
  metadata?: Record<string, any>;
  parentId?: string;
}

// Context state
interface UIContextValue {
  registerComponent: (data: UIComponentConfig) => string;
  updateComponent: (id: string, updates: Partial<UIComponentData>) => void;
  unregisterComponent: (id: string) => void;
  recordUserAction: (componentId: string, actionType: string) => void;
  setFocusedComponent: (componentId: string | null) => void;
  debug: {
    logRegistry: () => void;
    getRegistry: () => Record<string, UIComponentData>;
    getCurrentContext: () => SerializedUIContext;
  };
}

// Create context
const UIContext = createContext<UIContextValue | null>(null);

// Generate a session ID for this browser session
const getSessionId = () => {
  const storageKey = 'luna-ui-context-session-id';
  let sessionId = sessionStorage.getItem(storageKey);
  
  if (!sessionId) {
    sessionId = uuidv4();
    sessionStorage.setItem(storageKey, sessionId);
  }
  
  return sessionId;
};

export const UIContextProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  // Store the component registry
  const registry = useRef<Record<string, UIComponentData>>({});
  
  // Track current route
  const pathname = usePathname();
  
  // Session ID
  const sessionId = useRef(getSessionId());
  
  // Broadcast channel for direct context passing
  const broadcastChannel = useRef<BroadcastChannel | null>(null);
  
  // Track focused component and last user action
  const [focusedComponentId, setFocusedComponentId] = useState<string | null>(null);
  const lastUserAction = useRef<{ componentId: string; actionType: string; timestamp: number } | null>(null);
  
  // Initialize broadcast channel
  useEffect(() => {
    if (typeof window !== 'undefined') {
      broadcastChannel.current = new BroadcastChannel('luna-ui-context');
    }
    
    return () => {
      broadcastChannel.current?.close();
    };
  }, []);
  
  // Function to serialize the current UI context
  const serializeContext = useCallback((): SerializedUIContext => {
    return {
      timestamp: Date.now(),
      route: pathname || '/',
      components: Object.values(registry.current),
      focused: focusedComponentId || undefined,
      lastUserAction: lastUserAction.current || undefined,
      viewportSize: {
        width: typeof window !== 'undefined' ? window.innerWidth : 0,
        height: typeof window !== 'undefined' ? window.innerHeight : 0,
      },
      sessionId: sessionId.current,
    };
  }, [pathname, focusedComponentId]);
  
  // Debounced broadcast function
  const debouncedBroadcast = useCallback(
    (() => {
      let timeout: NodeJS.Timeout | null = null;
      
      return () => {
        if (timeout) clearTimeout(timeout);
        
        timeout = setTimeout(() => {
          const context = serializeContext();
          broadcastChannel.current?.postMessage(context);
          
          // Also store in sessionStorage for persistence
          sessionStorage.setItem('luna-latest-ui-context', JSON.stringify(context));
        }, 300); // 300ms debounce
      };
    })(),
    [serializeContext]
  );
  
  // Broadcast context on component registry changes
  useEffect(() => {
    // Initial broadcast
    debouncedBroadcast();
  }, [debouncedBroadcast, pathname]);
  
  // Register a component
  const registerComponent = useCallback((data: UIComponentConfig): string => {
    const id = `${data.type}-${uuidv4()}`;
    
    registry.current[id] = {
      id,
      type: data.type,
      role: data.role,
      route: pathname || '/',
      props: data.props || {},
      state: data.state || {},
      content: data.content || {},
      isVisible: true,
      parentId: data.parentId,
      children: [],
      lastUpdated: Date.now(),
      metadata: data.metadata || {},
    };
    
    // Update parent's children array if parentId is provided
    if (data.parentId && registry.current[data.parentId]) {
      registry.current[data.parentId].children = [
        ...(registry.current[data.parentId].children || []),
        id,
      ];
    }
    
    debouncedBroadcast();
    return id;
  }, [pathname, debouncedBroadcast]);
  
  // Update a component
  const updateComponent = useCallback((id: string, updates: Partial<UIComponentData>) => {
    if (!registry.current[id]) return;
    
    registry.current[id] = {
      ...registry.current[id],
      ...updates,
      lastUpdated: Date.now(),
    };
    
    debouncedBroadcast();
  }, [debouncedBroadcast]);
  
  // Unregister a component
  const unregisterComponent = useCallback((id: string) => {
    if (!registry.current[id]) return;
    
    // Remove this component from its parent's children array
    const parentId = registry.current[id].parentId;
    if (parentId && registry.current[parentId] && registry.current[parentId].children) {
      registry.current[parentId].children = registry.current[parentId].children?.filter(
        childId => childId !== id
      );
    }
    
    // Delete the component from registry
    delete registry.current[id];
    
    debouncedBroadcast();
  }, [debouncedBroadcast]);
  
  // Record user action
  const recordUserAction = useCallback((componentId: string, actionType: string) => {
    lastUserAction.current = {
      componentId,
      actionType,
      timestamp: Date.now(),
    };
    
    debouncedBroadcast();
  }, [debouncedBroadcast]);
  
  // Set focused component
  const setFocusedComponent = useCallback((componentId: string | null) => {
    setFocusedComponentId(componentId);
    debouncedBroadcast();
  }, [debouncedBroadcast]);
  
  // Debug utilities
  const debug = {
    logRegistry: () => console.log(registry.current),
    getRegistry: () => ({ ...registry.current }),
    getCurrentContext: serializeContext,
  };
  
  const value: UIContextValue = {
    registerComponent,
    updateComponent,
    unregisterComponent,
    recordUserAction,
    setFocusedComponent,
    debug,
  };
  
  return <UIContext.Provider value={value}>{children}</UIContext.Provider>;
};

export const useUIContextControl = () => {
  const context = useContext(UIContext);
  
  if (!context) {
    throw new Error('useUIContextControl must be used within a UIContextProvider');
  }
  
  return context;
}; 