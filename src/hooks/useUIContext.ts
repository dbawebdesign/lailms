import { useEffect, useRef, useState } from 'react';
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
  }, []); // Empty dependency array to only run on mount/unmount
  
  // Handlers for updating component state
  const updateState = (newState: Record<string, any>) => {
    if (componentId) {
      updateComponent(componentId, { state: newState });
    }
  };
  
  const updateContent = (newContent: Record<string, any>) => {
    if (componentId) {
      updateComponent(componentId, { content: newContent });
    }
  };
  
  const updateVisibility = (isVisible: boolean) => {
    if (componentId) {
      updateComponent(componentId, { isVisible });
    }
  };
  
  const updateMetadata = (newMetadata: Record<string, any>) => {
    if (componentId) {
      updateComponent(componentId, { metadata: newMetadata });
    }
  };
  
  // Function to record user interactions with this component
  const trackUserAction = (actionType: string) => {
    if (componentId) {
      recordUserAction(componentId, actionType);
    }
  };
  
  return {
    componentId,
    updateState,
    updateContent,
    updateVisibility,
    updateMetadata,
    trackUserAction
  };
} 