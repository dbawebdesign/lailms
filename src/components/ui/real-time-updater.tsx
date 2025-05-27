import React, { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { PremiumAnimation, SuccessNotification } from './premium-animations';
import { ContentUpdateIndicator } from './content-update-indicator';

interface RealTimeUpdaterProps {
  onContentUpdate?: (entity: string, entityId: string) => void;
  enableNotifications?: boolean;
}

export const RealTimeUpdater: React.FC<RealTimeUpdaterProps> = ({
  onContentUpdate,
  enableNotifications = true,
}) => {
  const router = useRouter();
  const [showNotification, setShowNotification] = useState(false);
  const [notificationMessage, setNotificationMessage] = useState('');
  const [updateStatus, setUpdateStatus] = useState<'updating' | 'success' | 'error' | null>(null);
  const [showUpdateIndicator, setShowUpdateIndicator] = useState(false);

  useEffect(() => {
    // Listen for Luna content updates
    const handleLunaUpdate = (event: CustomEvent) => {
      const { entity, entityId } = event.detail;
      
      console.log('Real-time update received:', { entity, entityId });
      
      // Show updating indicator
      setUpdateStatus('updating');
      setShowUpdateIndicator(true);
      
      // Call the callback if provided
      onContentUpdate?.(entity, entityId);
      
      // Simulate update process with success
      setTimeout(() => {
        setUpdateStatus('success');
        
        // Show notification
        if (enableNotifications) {
          setNotificationMessage(`${entity.charAt(0).toUpperCase() + entity.slice(1)} updated successfully!`);
          setShowNotification(true);
          setTimeout(() => setShowNotification(false), 3000);
        }
        
        // Hide update indicator after success
        setTimeout(() => {
          setShowUpdateIndicator(false);
          setUpdateStatus(null);
        }, 2000);
        
        // Refresh the current page to show updates
        router.refresh();
      }, 1000);
    };

    // Listen for broadcast channel updates (from Luna chat)
    const broadcastChannel = typeof window !== 'undefined' ? new BroadcastChannel('learnology-updates') : null;
    const handleBroadcastUpdate = (event: MessageEvent) => {
      const updateEvent = event.data;
      if (updateEvent.isAIGenerated) {
        handleLunaUpdate(new CustomEvent('lunaContentUpdate', {
          detail: { entity: updateEvent.entity, entityId: updateEvent.entityId }
        }));
      }
    };

    // Listen for fallback custom events
    const handleFallbackUpdate = (event: CustomEvent) => {
      const updateEvent = event.detail;
      if (updateEvent.isAIGenerated) {
        handleLunaUpdate(new CustomEvent('lunaContentUpdate', {
          detail: { entity: updateEvent.entity, entityId: updateEvent.entityId }
        }));
      }
    };

    // Add event listeners
    window.addEventListener('lunaContentUpdate', handleLunaUpdate as EventListener);
    window.addEventListener('learnology-update-fallback', handleFallbackUpdate as EventListener);
    
    if (broadcastChannel) {
      broadcastChannel.addEventListener('message', handleBroadcastUpdate);
    }

    // Cleanup
    return () => {
      window.removeEventListener('lunaContentUpdate', handleLunaUpdate as EventListener);
      window.removeEventListener('learnology-update-fallback', handleFallbackUpdate as EventListener);
      if (broadcastChannel) {
        broadcastChannel.close();
      }
    };
  }, [onContentUpdate, enableNotifications, router]);

  return (
    <>
      <ContentUpdateIndicator
        isVisible={showUpdateIndicator}
        status={updateStatus || 'updating'}
      />
      <SuccessNotification
        message={notificationMessage}
        isVisible={showNotification}
        onClose={() => setShowNotification(false)}
      />
    </>
  );
};

// Hook version for easier use in components
export const useRealTimeContentUpdates = (
  onContentUpdate?: (entity: string, entityId: string) => void,
  enableNotifications: boolean = true
) => {
  const router = useRouter();
  const [lastUpdate, setLastUpdate] = useState<{ entity: string; entityId: string } | null>(null);

  useEffect(() => {
    const handleUpdate = (event: CustomEvent) => {
      const { entity, entityId } = event.detail;
      setLastUpdate({ entity, entityId });
      onContentUpdate?.(entity, entityId);
      
      // Refresh the page to show updates
      router.refresh();
    };

    const broadcastChannel = typeof window !== 'undefined' ? new BroadcastChannel('learnology-updates') : null;
    const handleBroadcastUpdate = (event: MessageEvent) => {
      const updateEvent = event.data;
      if (updateEvent.isAIGenerated) {
        handleUpdate(new CustomEvent('lunaContentUpdate', {
          detail: { entity: updateEvent.entity, entityId: updateEvent.entityId }
        }));
      }
    };

    const handleFallbackUpdate = (event: CustomEvent) => {
      const updateEvent = event.detail;
      if (updateEvent.isAIGenerated) {
        handleUpdate(new CustomEvent('lunaContentUpdate', {
          detail: { entity: updateEvent.entity, entityId: updateEvent.entityId }
        }));
      }
    };

    window.addEventListener('lunaContentUpdate', handleUpdate as EventListener);
    window.addEventListener('learnology-update-fallback', handleFallbackUpdate as EventListener);
    
    if (broadcastChannel) {
      broadcastChannel.addEventListener('message', handleBroadcastUpdate);
    }

    return () => {
      window.removeEventListener('lunaContentUpdate', handleUpdate as EventListener);
      window.removeEventListener('learnology-update-fallback', handleFallbackUpdate as EventListener);
      if (broadcastChannel) {
        broadcastChannel.close();
      }
    };
  }, [onContentUpdate, router]);

  return { lastUpdate };
};

export default RealTimeUpdater; 