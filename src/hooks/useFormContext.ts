import { useEffect } from 'react';
import { useUIContext } from './useUIContext';
import { sanitizeProps } from '@/lib/contextUtils';

interface FormContextOptions {
  formId: string;
  role?: string;
  type?: string;
  metadata?: Record<string, any>;
}

/**
 * A specialized hook for form components
 * Tracks form state and user interactions
 */
export function useFormContext<T extends Record<string, any>>(
  formState: T,
  options: FormContextOptions
) {
  const {
    formId,
    role = 'form',
    type = 'form',
    metadata = {}
  } = options;
  
  // Register with the UI context
  const { componentId, updateState, updateContent, trackUserAction } = useUIContext({
    type,
    role,
    props: {
      formId,
    },
    metadata: {
      formIdentifier: formId,
      ...metadata
    }
  });
  
  // Update when form state changes
  useEffect(() => {
    if (!componentId) return;
    
    // Sanitize the form state to remove sensitive information
    const sanitizedState = sanitizeProps(formState);
    
    // Update the component state
    updateState(sanitizedState);
    
    // Extract field names and types
    const fieldInfo = Object.entries(formState).map(([fieldName, value]) => {
      let fieldType = 'text';
      
      if (typeof value === 'boolean') fieldType = 'boolean';
      else if (typeof value === 'number') fieldType = 'number';
      else if (Array.isArray(value)) fieldType = 'array';
      else if (value === null) fieldType = 'null';
      else if (typeof value === 'object') fieldType = 'object';
      
      return { fieldName, fieldType };
    });
    
    // Update content with form structure information
    updateContent({
      formFields: fieldInfo,
      filledFields: Object.keys(formState).filter(key => {
        const value = formState[key];
        if (value === null || value === undefined) return false;
        if (value === '') return false;
        if (Array.isArray(value) && value.length === 0) return false;
        return true;
      }),
      totalFields: Object.keys(formState).length,
    });
  }, [componentId, formId, formState, updateContent, updateState]);
  
  // Return functions to track form interactions
  return {
    trackSubmit: () => trackUserAction('form_submit'),
    trackFieldFocus: (fieldName: string) => trackUserAction(`focus_field:${fieldName}`),
    trackFieldBlur: (fieldName: string) => trackUserAction(`blur_field:${fieldName}`),
    trackFieldChange: (fieldName: string) => trackUserAction(`change_field:${fieldName}`),
    trackReset: () => trackUserAction('form_reset'),
    trackValidationError: (errors: Record<string, string>) => {
      updateContent({
        validationErrors: Object.keys(errors),
        hasErrors: Object.keys(errors).length > 0
      });
      trackUserAction('validation_error');
    }
  };
} 