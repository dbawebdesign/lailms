import React, { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { PremiumAnimation, SuccessNotification } from './premium-animations';
import { ContentUpdateIndicator } from './content-update-indicator';
import { supabase } from '@/utils/supabase/browser';

interface RealTimeUpdaterProps {
  onContentUpdate?: (entity: string, entityId: string, updatedData?: any) => void;
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
  const [currentEntity, setCurrentEntity] = useState<string>('');
  const [currentEntityName, setCurrentEntityName] = useState<string>('');

  // Function to fetch updated data based on entity type
  const fetchUpdatedData = async (entity: string, entityId: string) => {
    try {
      let updatedData = null;
      
      switch (entity) {
        case 'baseClass':
          const { data: baseClassData, error: baseClassError } = await supabase
            .from('base_classes')
            .select('*')
            .eq('id', entityId)
            .single();
          
          if (baseClassError) throw baseClassError;
          updatedData = baseClassData;
          break;
          
        case 'path':
          const { data: pathData, error: pathError } = await supabase
            .from('paths')
            .select('*')
            .eq('id', entityId)
            .single();
          
          if (pathError) throw pathError;
          updatedData = pathData;
          break;
          
        case 'lesson':
          const { data: lessonData, error: lessonError } = await supabase
            .from('lessons')
            .select('*')
            .eq('id', entityId)
            .single();
          
          if (lessonError) throw lessonError;
          updatedData = lessonData;
          break;
          
        case 'section':
          const { data: sectionData, error: sectionError } = await supabase
            .from('lesson_sections')
            .select('*')
            .eq('id', entityId)
            .single();
          
          if (sectionError) throw sectionError;
          updatedData = sectionData;
          break;
          
        default:
          console.warn('Unknown entity type for update:', entity);
          return null;
      }
      
      return updatedData;
    } catch (error) {
      console.error(`Error fetching updated ${entity} data:`, error);
      return null;
    }
  };

  useEffect(() => {
    // Listen for Luna content updates
    const handleLunaUpdate = async (event: CustomEvent) => {
      const { entity, entityId } = event.detail;
      
      console.log('Real-time update received:', { entity, entityId });
      
      // Show updating indicator
      setUpdateStatus('updating');
      setShowUpdateIndicator(true);
      setCurrentEntity(entity);
      setCurrentEntityName(''); // Will be set once we fetch the data
      
      try {
        // Fetch the updated data
        const updatedData = await fetchUpdatedData(entity, entityId);
        
        if (updatedData) {
          // Extract the name/title for better feedback
          const entityName = updatedData.name || updatedData.title || `ID: ${entityId}`;
          setCurrentEntityName(entityName);
          
          // Call the callback with the updated data
          onContentUpdate?.(entity, entityId, updatedData);
          
          // Show success status
          setUpdateStatus('success');
          
          // Show notification
          if (enableNotifications) {
            setNotificationMessage(`${entity.charAt(0).toUpperCase() + entity.slice(1)} "${entityName}" updated successfully!`);
            setShowNotification(true);
            setTimeout(() => setShowNotification(false), 3000);
          }
        } else {
          throw new Error('Failed to fetch updated data');
        }
        
      } catch (error) {
        console.error('Error handling real-time update:', error);
        setUpdateStatus('error');
        
        if (enableNotifications) {
          setNotificationMessage(`Failed to update ${entity}`);
          setShowNotification(true);
          setTimeout(() => setShowNotification(false), 3000);
        }
      }
      
      // Hide update indicator after processing
      setTimeout(() => {
        setShowUpdateIndicator(false);
        setUpdateStatus(null);
        setCurrentEntity('');
        setCurrentEntityName('');
      }, 2000);
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
    window.addEventListener('lunaContentUpdate', handleLunaUpdate as unknown as EventListener);
    window.addEventListener('learnology-update-fallback', handleFallbackUpdate as unknown as EventListener);
    
    if (broadcastChannel) {
      broadcastChannel.addEventListener('message', handleBroadcastUpdate);
    }

    // Cleanup
    return () => {
      window.removeEventListener('lunaContentUpdate', handleLunaUpdate as unknown as EventListener);
      window.removeEventListener('learnology-update-fallback', handleFallbackUpdate as unknown as EventListener);
      if (broadcastChannel) {
        broadcastChannel.close();
      }
    };
  }, [onContentUpdate, enableNotifications]);

  return (
    <>
      <ContentUpdateIndicator
        isVisible={showUpdateIndicator}
        status={updateStatus || 'updating'}
        entity={currentEntity}
        entityName={currentEntityName}
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
  onContentUpdate?: (entity: string, entityId: string, updatedData?: any, eventType?: 'create' | 'update' | 'delete') => void,
  enableNotifications: boolean = true
) => {
  const [lastUpdate, setLastUpdate] = useState<{ entity: string; entityId: string; data?: any; eventType?: string } | null>(null);

  useEffect(() => {
    const handleUpdate = async (event: CustomEvent) => {
      const { entity, entityId, eventType = 'update' } = event.detail;
      
      // Fetch updated data
      let updatedData = null;
      try {
        switch (entity) {
          case 'baseClass':
            const { data: baseClassData, error: baseClassError } = await supabase
              .from('base_classes')
              .select('*')
              .eq('id', entityId)
              .single();
            
            if (baseClassError) throw baseClassError;
            updatedData = baseClassData;
            break;
            
          case 'path':
            const { data: pathData, error: pathError } = await supabase
              .from('paths')
              .select('*')
              .eq('id', entityId)
              .single();
            
            if (pathError) throw pathError;
            updatedData = pathData;
            break;
            
          case 'lesson':
            const { data: lessonData, error: lessonError } = await supabase
              .from('lessons')
              .select('*')
              .eq('id', entityId)
              .single();
            
            if (lessonError) throw lessonError;
            updatedData = lessonData;
            break;
            
          case 'section':
            const { data: sectionData, error: sectionError } = await supabase
              .from('lesson_sections')
              .select('*')
              .eq('id', entityId)
              .single();
            
            if (sectionError) throw sectionError;
            updatedData = sectionData;
            break;
        }
      } catch (error) {
        console.error(`Error fetching updated ${entity} data:`, error);
      }
      
      setLastUpdate({ entity, entityId, data: updatedData, eventType });
      onContentUpdate?.(entity, entityId, updatedData, eventType as 'create' | 'update' | 'delete');
    };

    const broadcastChannel = typeof window !== 'undefined' ? new BroadcastChannel('learnology-updates') : null;
    const handleBroadcastUpdate = (event: MessageEvent) => {
      const updateEvent = event.data;
      if (updateEvent.isAIGenerated) {
        handleUpdate(new CustomEvent('lunaContentUpdate', {
          detail: { 
            entity: updateEvent.entity, 
            entityId: updateEvent.entityId,
            eventType: updateEvent.type || 'update'
          }
        }));
      }
    };

    const handleFallbackUpdate = (event: CustomEvent) => {
      const updateEvent = event.detail;
      if (updateEvent.isAIGenerated) {
        handleUpdate(new CustomEvent('lunaContentUpdate', {
          detail: { 
            entity: updateEvent.entity, 
            entityId: updateEvent.entityId,
            eventType: updateEvent.type || 'update'
          }
        }));
      }
    };

    window.addEventListener('lunaContentUpdate', handleUpdate as unknown as EventListener);
    window.addEventListener('learnology-update-fallback', handleFallbackUpdate as unknown as EventListener);
    
    if (broadcastChannel) {
      broadcastChannel.addEventListener('message', handleBroadcastUpdate);
    }

    return () => {
      window.removeEventListener('lunaContentUpdate', handleUpdate as unknown as EventListener);
      window.removeEventListener('learnology-update-fallback', handleFallbackUpdate as unknown as EventListener);
      if (broadcastChannel) {
        broadcastChannel.close();
      }
    };
  }, [onContentUpdate]);

  return { lastUpdate };
};

export default RealTimeUpdater; 