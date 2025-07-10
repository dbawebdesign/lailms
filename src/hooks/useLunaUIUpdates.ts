import { useEffect, useState } from 'react';

interface LunaUIUpdateEvent {
  elementType: string;
  elementId?: string;
  action: string;
  data?: any;
}

interface GlowState {
  [key: string]: boolean;
}

// Comprehensive mapping of all possible Luna update types
export const LUNA_UPDATE_TYPES = {
  // Base Class Updates
  BASE_CLASS_NAME: 'base-class-name',
  BASE_CLASS_DESCRIPTION: 'base-class-description',
  BASE_CLASS_SETTINGS: 'base-class-settings',
  
  // Path Updates
  PATH_TITLE: 'path-title',
  PATH_DESCRIPTION: 'path-description',
  PATH_SETTINGS: 'path-settings',
  
  // Lesson Updates
  LESSON_TITLE: 'lesson-title',
  LESSON_DESCRIPTION: 'lesson-description',
  LESSON_CONTENT: 'lesson-content',
  LESSON_OBJECTIVES: 'lesson-objectives',
  
  // Section Updates
  SECTION_TITLE: 'section-title',
  SECTION_CONTENT: 'section-content',
  SECTION_ACTIVITIES: 'section-activities',
  
  // Generated Content
  COURSE_OUTLINE: 'course-outline',
  MIND_MAP: 'mind-map',
  LESSON_SECTIONS: 'lesson-sections',
  
  // Instance Updates
  INSTANCE_NAME: 'instance-name',
  INSTANCE_SETTINGS: 'instance-settings',
  
  // Knowledge Base
  KNOWLEDGE_BASE: 'knowledge-base',
  DOCUMENTS: 'documents',
  
  // Generic Updates
  FORM_FIELD: 'form-field',
  CONTENT_AREA: 'content-area',
  LIST_ITEM: 'list-item',
} as const;

export type LunaUpdateType = typeof LUNA_UPDATE_TYPES[keyof typeof LUNA_UPDATE_TYPES];

interface LunaUIUpdateOptions {
  onDataRefresh?: (elementType: string, elementId?: string, data?: any) => Promise<void>;
  refreshDelay?: number;
  glowDuration?: number;
}

export const useLunaUIUpdates = (options: LunaUIUpdateOptions = {}) => {
  const { 
    onDataRefresh, 
    refreshDelay = 3100, 
    glowDuration = 3000 
  } = options;
  
  const [glowingElements, setGlowingElements] = useState<GlowState>({});

  useEffect(() => {
    const handleLunaUIUpdate = (event: CustomEvent<LunaUIUpdateEvent>) => {
      const { elementType, elementId, action, data } = event.detail;
      
      if (action === 'glow-and-refresh') {
        const elementKey = elementId || elementType;
        
        console.log('🔄 Luna UI Update received:', { elementType, elementId, data });
        
        // Start glow effect
        setGlowingElements(prev => ({
          ...prev,
          [elementKey]: true
        }));
        
        // Remove glow effect after specified duration
        setTimeout(() => {
          setGlowingElements(prev => ({
            ...prev,
            [elementKey]: false
          }));
        }, glowDuration);
        
        // Trigger data refresh callback if provided
        if (onDataRefresh) {
          setTimeout(async () => {
            try {
              await onDataRefresh(elementType, elementId, data);
              console.log('✅ Data refresh completed for:', elementKey);
            } catch (error) {
              console.error('❌ Data refresh failed for:', elementKey, error);
            }
          }, refreshDelay);
        }
        
        console.log('✨ Applied glow effect to:', elementKey);
      }
    };

    window.addEventListener('lunaUIUpdate', handleLunaUIUpdate as EventListener);
    
    return () => {
      window.removeEventListener('lunaUIUpdate', handleLunaUIUpdate as EventListener);
    };
  }, [onDataRefresh, refreshDelay, glowDuration]);

  const isGlowing = (elementKey: string) => glowingElements[elementKey] || false;
  
  const getGlowClasses = (elementKey: string) => {
    return isGlowing(elementKey) 
      ? 'animate-pulse ring-4 ring-blue-500 ring-opacity-90 shadow-xl shadow-blue-500/60 border-blue-400 transition-all duration-500 scale-[1.02]'
      : '';
  };

  // Helper function to manually trigger glow effect
  const triggerGlow = (elementKey: string, duration?: number) => {
    setGlowingElements(prev => ({
      ...prev,
      [elementKey]: true
    }));
    
    setTimeout(() => {
      setGlowingElements(prev => ({
        ...prev,
        [elementKey]: false
      }));
    }, duration || glowDuration);
  };

  return {
    isGlowing,
    getGlowClasses,
    triggerGlow,
    LUNA_UPDATE_TYPES
  };
}; 