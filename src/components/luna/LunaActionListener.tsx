"use client";

import { useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { useLunaContextControl } from '@/context/LunaContextProvider';
import { toast } from '@/components/ui/use-toast';

interface UIAction {
  componentId: string;
  actionType: string;
  additionalParams?: Record<string, any>;
  timestamp: number;
}

/**
 * LunaActionListener listens for AI-initiated UI actions and executes them
 * This component should be mounted at the root level to handle actions anywhere in the app
 */
const LunaActionListener: React.FC = () => {
  const router = useRouter();
  const { debug } = useLunaContextControl();
  const actionChannel = useRef<BroadcastChannel | null>(null);
  
  // Set up listener for UI actions
  useEffect(() => {
    if (typeof window === 'undefined') return;
    
    // Initialize broadcast channel
    actionChannel.current = new BroadcastChannel('luna-ui-actions');
    
    // Listen for action messages
    actionChannel.current.onmessage = (event: MessageEvent<UIAction>) => {
      const action = event.data;
      console.log('Luna Action received:', action);
      
      // Execute the action
      executeAction(action);
    };
    
    return () => {
      // Clean up
      actionChannel.current?.close();
    };
  }, [router]);
  
  /**
   * Execute a UI action based on the action type
   */
  const executeAction = async (action: UIAction) => {
    const { componentId, actionType, additionalParams } = action;
    
    try {
      // Get the registry to find the component
      const registry = debug.getRegistry();
      const component = registry[componentId];
      
      if (!component) {
        console.warn(`Component with ID ${componentId} not found in registry`);
        toast({
          title: 'Action Failed',
          description: `Could not find the UI element to perform the action on.`,
          variant: 'destructive'
        });
        return;
      }
      
      // Execute based on action type
      switch (actionType.toLowerCase()) {
        case 'click':
          await handleClickAction(component, additionalParams);
          break;
          
        case 'navigate':
          await handleNavigationAction(component, additionalParams);
          break;
          
        case 'submit':
          await handleSubmitAction(component, additionalParams);
          break;
          
        case 'select':
          await handleSelectAction(component, additionalParams);
          break;
          
        case 'focus':
          await handleFocusAction(component, additionalParams);
          break;
          
        default:
          console.warn(`Unknown action type: ${actionType}`);
          toast({
            title: 'Unknown Action',
            description: `Action type "${actionType}" is not supported.`,
            variant: 'destructive'
          });
      }
      
      // Notify user that an action was performed
      toast({
        title: 'Action Performed',
        description: `Luna performed ${actionType} on a ${component.type} element.`,
      });
      
    } catch (error) {
      console.error('Error executing action:', error);
      toast({
        title: 'Action Failed',
        description: `Failed to perform the requested action: ${error instanceof Error ? error.message : 'unknown error'}`,
        variant: 'destructive'
      });
    }
  };
  
  /**
   * Handle click actions on UI components
   */
  const handleClickAction = async (component: any, params?: Record<string, any>) => {
    // Find the DOM element by a data attribute we can add to our components
    const element = document.querySelector(`[data-luna-id="${component.id}"]`) as HTMLElement;
    
    if (element) {
      // Simulate a click on the element
      element.click();
    } else {
      // If we can't find it by data attribute, try using the component's type and role
      const fallbackSelector = `[data-luna-type="${component.type}"][data-luna-role="${component.role}"]`;
      const fallbackElement = document.querySelector(fallbackSelector) as HTMLElement;
      
      if (fallbackElement) {
        fallbackElement.click();
      } else {
        throw new Error('Could not find element to click');
      }
    }
  };
  
  /**
   * Handle navigation actions
   */
  const handleNavigationAction = async (component: any, params?: Record<string, any>) => {
    // Check if we have a specific path to navigate to
    if (params?.path) {
      router.push(params.path);
      return;
    }
    
    // Otherwise try to extract a path from the component data
    if (component.props?.href) {
      router.push(component.props.href);
    } else if (component.metadata?.path) {
      router.push(component.metadata.path);
    } else {
      throw new Error('No navigation path found in the component or parameters');
    }
  };
  
  /**
   * Handle form submission actions
   */
  const handleSubmitAction = async (component: any, params?: Record<string, any>) => {
    // Find the form element
    const formElement = document.querySelector(`[data-luna-id="${component.id}"]`) as HTMLFormElement;
    
    if (formElement) {
      // Simulate a form submission
      formElement.submit();
    } else {
      // Try to find a submit button inside the form component
      const submitButton = document.querySelector(`[data-luna-id="${component.id}"] button[type="submit"]`) as HTMLButtonElement;
      
      if (submitButton) {
        submitButton.click();
      } else {
        throw new Error('Could not find form or submit button to click');
      }
    }
  };
  
  /**
   * Handle select actions (for dropdowns, radio buttons, etc.)
   */
  const handleSelectAction = async (component: any, params?: Record<string, any>) => {
    if (!params?.value) {
      throw new Error('No value provided for select action');
    }
    
    // Find the select element
    const selectElement = document.querySelector(`[data-luna-id="${component.id}"]`) as HTMLSelectElement;
    
    if (selectElement) {
      // Set the value and dispatch change event
      selectElement.value = params.value;
      selectElement.dispatchEvent(new Event('change', { bubbles: true }));
    } else {
      throw new Error('Could not find select element');
    }
  };
  
  /**
   * Handle focus actions
   */
  const handleFocusAction = async (component: any, params?: Record<string, any>) => {
    // Find the element
    const element = document.querySelector(`[data-luna-id="${component.id}"]`) as HTMLElement;
    
    if (element) {
      // Focus the element
      element.focus();
    } else {
      throw new Error('Could not find element to focus');
    }
  };
  
  // This component doesn't render anything visible
  return null;
};

export default LunaActionListener; 