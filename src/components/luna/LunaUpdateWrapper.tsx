import React from 'react';
import { useLunaUIUpdates, LUNA_UPDATE_TYPES, LunaUpdateType } from '@/hooks/useLunaUIUpdates';
import { cn } from '@/lib/utils';

interface LunaUpdateWrapperProps {
  children: React.ReactElement;
  updateType: LunaUpdateType;
  onDataRefresh?: (elementType: string, elementId?: string, data?: any) => Promise<void>;
  className?: string;
  glowDuration?: number;
  refreshDelay?: number;
}

/**
 * Wrapper component that adds Luna UI update functionality to any child component
 * 
 * Usage:
 * <LunaUpdateWrapper updateType={LUNA_UPDATE_TYPES.PATH_DESCRIPTION}>
 *   <Textarea value={description} onChange={...} />
 * </LunaUpdateWrapper>
 */
export const LunaUpdateWrapper: React.FC<LunaUpdateWrapperProps> = ({
  children,
  updateType,
  onDataRefresh,
  className,
  glowDuration = 3000,
  refreshDelay = 3100
}) => {
  const { getGlowClasses } = useLunaUIUpdates({
    onDataRefresh,
    glowDuration,
    refreshDelay
  });

  // Clone the child element and add glow classes to its className
  const childElement = React.cloneElement(children, {
    className: cn(
      (children.props as any).className,
      getGlowClasses(updateType),
      className
    )
  } as any);

  return childElement;
};

// Helper hook for components that need to trigger Luna updates manually
export const useLunaUpdateTrigger = () => {
  const triggerLunaUpdate = (
    elementType: LunaUpdateType,
    elementId?: string,
    data?: any
  ) => {
    const updateEvent = new CustomEvent('lunaUIUpdate', {
      detail: { 
        elementType, 
        elementId,
        action: 'glow-and-refresh',
        data
      }
    });
    window.dispatchEvent(updateEvent);
    console.log('🔄 Manually triggered Luna UI update:', { elementType, elementId, data });
  };

  return { triggerLunaUpdate, LUNA_UPDATE_TYPES };
};

export { LUNA_UPDATE_TYPES };
export type { LunaUpdateType }; 