import { useEffect, useRef, useState, useCallback } from 'react';
import { useLunaContextControl, UIComponentConfig, UIComponentData } from '@/context/LunaContextProvider';

/**
 * React hook for components to register with the UI Context system
 * 
 * @param config Configuration for the component
 * @returns Object with functions to update component state and visibility
 */
export function useUIContext(config: UIComponentConfig) {
  const {
    registerComponent,
    updateComponent,
    unregisterComponent,
    recordUserAction
  } = useLunaContextControl();
  
  // Store the component ID
  const [componentId, setComponentId] = useState<string | null>(null);
  
  // Use a ref to track if the component is mounted
  const isMounted = useRef(false);
  
  // Register component on mount
  useEffect(() => {
    const id = registerComponent(config);
    setComponentId(id);
    isMounted.current = true;
    
    // Unregister component on unmount
    return () => {
      if (isMounted.current && id) {
        unregisterComponent(id);
        isMounted.current = false;
      }
    };
  }, [config, registerComponent, unregisterComponent]);
  
  // Handlers for updating component state
  const updateState = useCallback((newState: Record<string, any>) => {
    if (componentId) {
      updateComponent(componentId, { state: newState });
    }
  }, [componentId, updateComponent]);
  
  const updateContent = useCallback((newContent: Record<string, any>) => {
    if (componentId) {
      updateComponent(componentId, { content: newContent });
    }
  }, [componentId, updateComponent]);
  
  const updateVisibility = useCallback((isVisible: boolean) => {
    if (componentId) {
      updateComponent(componentId, { isVisible });
    }
  }, [componentId, updateComponent]);
  
  const updateMetadata = useCallback((newMetadata: Record<string, any>) => {
    if (componentId) {
      updateComponent(componentId, { metadata: newMetadata });
    }
  }, [componentId, updateComponent]);
  
  // Function to record user interactions with this component
  const trackUserAction = useCallback((actionType: string) => {
    if (componentId) {
      recordUserAction(componentId, actionType);
    }
  }, [componentId, recordUserAction]);
  
  return {
    componentId,
    updateState,
    updateContent,
    updateVisibility,
    updateMetadata,
    trackUserAction
  };
} 