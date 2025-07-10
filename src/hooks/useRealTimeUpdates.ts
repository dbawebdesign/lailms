import { useEffect, useCallback, useState } from 'react';

interface RealTimeUpdateEvent {
  type: 'create' | 'update' | 'delete';
  entity: 'baseClass' | 'path' | 'lesson' | 'section';
  entityId: string;
  parentId?: string;
  data?: any;
  isAIGenerated?: boolean;
}

interface UseRealTimeUpdatesOptions {
  onUpdate?: (event: RealTimeUpdateEvent) => void;
  enableAnimations?: boolean;
  onRefreshNeeded?: (entity: string, entityId: string) => void;
}

export const useRealTimeUpdates = (options: UseRealTimeUpdatesOptions = {}) => {
  const [pendingUpdates, setPendingUpdates] = useState<RealTimeUpdateEvent[]>([]);
  const [isProcessingUpdate, setIsProcessingUpdate] = useState(false);

  // Broadcast channel for cross-component communication
  const [broadcastChannel] = useState(() => {
    if (typeof window !== 'undefined') {
      return new BroadcastChannel('learnology-updates');
    }
    return null;
  });

  const triggerRefresh = useCallback((event: RealTimeUpdateEvent) => {
    const { entity, entityId, parentId } = event;
    
    // Trigger refresh callbacks for different entity types
    options.onRefreshNeeded?.(entity, entityId);
    
    // Also trigger refresh for parent entities
    if (parentId) {
      switch (entity) {
        case 'path':
          options.onRefreshNeeded?.('baseClass', parentId);
          break;
        case 'lesson':
          options.onRefreshNeeded?.('path', parentId);
          break;
        case 'section':
          options.onRefreshNeeded?.('lesson', parentId);
          break;
      }
    }
  }, [options]);

  const processUpdate = useCallback(async (event: RealTimeUpdateEvent) => {
    setIsProcessingUpdate(true);
    
    try {
      // Trigger refresh to update UI
      triggerRefresh(event);
      
      // Call the optional callback
      options.onUpdate?.(event);
      
      // Add a small delay for animations
      if (options.enableAnimations && event.isAIGenerated) {
        await new Promise(resolve => setTimeout(resolve, 300));
      }
      
    } finally {
      setIsProcessingUpdate(false);
    }
  }, [triggerRefresh, options]);

  const triggerUpdate = useCallback((event: RealTimeUpdateEvent) => {
    // Add to pending updates
    setPendingUpdates(prev => [...prev, event]);
    
    // Broadcast to other components (only if channel is available)
    if (broadcastChannel) {
      try {
        broadcastChannel.postMessage(event);
      } catch (error) {
        console.warn('BroadcastChannel error (channel may be closed):', error);
        // Fallback to custom event
        if (typeof window !== 'undefined') {
          window.dispatchEvent(new CustomEvent('learnology-update-fallback', {
            detail: event
          }));
        }
      }
    } else {
      // Fallback to custom event when BroadcastChannel is not available
      if (typeof window !== 'undefined') {
        window.dispatchEvent(new CustomEvent('learnology-update-fallback', {
          detail: event
        }));
      }
    }
    
    // Process the update
    processUpdate(event);
  }, [broadcastChannel, processUpdate]);

  // Listen for broadcast messages from other components
  useEffect(() => {
    if (!broadcastChannel) return;
    
    const handleMessage = (event: MessageEvent<RealTimeUpdateEvent>) => {
      processUpdate(event.data);
    };

    broadcastChannel.addEventListener('message', handleMessage);
    
    return () => {
      broadcastChannel.removeEventListener('message', handleMessage);
    };
  }, [broadcastChannel, processUpdate]);

  // Listen for fallback custom events
  useEffect(() => {
    if (typeof window === 'undefined') return;
    
    const handleFallbackEvent = (event: CustomEvent<RealTimeUpdateEvent>) => {
      processUpdate(event.detail);
    };

    window.addEventListener('learnology-update-fallback', handleFallbackEvent as EventListener);
    
    return () => {
      window.removeEventListener('learnology-update-fallback', handleFallbackEvent as EventListener);
    };
  }, [processUpdate]);

  // Cleanup
  useEffect(() => {
    return () => {
      if (broadcastChannel) {
        broadcastChannel.close();
      }
    };
  }, [broadcastChannel]);

  return {
    triggerUpdate,
    pendingUpdates,
    isProcessingUpdate,
    clearPendingUpdates: () => setPendingUpdates([]),
  };
};

// Helper hook for specific entity types
export const useBaseClassUpdates = () => {
  return useRealTimeUpdates({
    onUpdate: (event) => {
      console.log('Base class update:', event);
    },
    enableAnimations: true,
  });
};

export const usePathUpdates = () => {
  return useRealTimeUpdates({
    onUpdate: (event) => {
      console.log('Path update:', event);
    },
    enableAnimations: true,
  });
};

export const useLessonUpdates = () => {
  return useRealTimeUpdates({
    onUpdate: (event) => {
      console.log('Lesson update:', event);
    },
    enableAnimations: true,
  });
};

export const useSectionUpdates = () => {
  return useRealTimeUpdates({
    onUpdate: (event) => {
      console.log('Section update:', event);
    },
    enableAnimations: true,
  });
};

export default useRealTimeUpdates; 