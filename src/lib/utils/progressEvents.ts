// Simple event system for progress updates
type ProgressUpdateEvent = {
  type: 'lesson' | 'assessment' | 'path' | 'class_instance';
  itemId: string;
  progress: number;
  status: string;
};

type ProgressEventListener = (event: ProgressUpdateEvent) => void;

class ProgressEventManager {
  private listeners: ProgressEventListener[] = [];

  subscribe(listener: ProgressEventListener) {
    this.listeners.push(listener);
    
    // Return unsubscribe function
    return () => {
      const index = this.listeners.indexOf(listener);
      if (index > -1) {
        this.listeners.splice(index, 1);
      }
    };
  }

  emit(event: ProgressUpdateEvent) {
    this.listeners.forEach(listener => {
      try {
        listener(event);
      } catch (error) {
        console.error('Error in progress event listener:', error);
      }
    });
  }
}

// Global instance
export const progressEvents = new ProgressEventManager();

// Helper function to emit progress updates
export const emitProgressUpdate = (
  type: 'lesson' | 'assessment' | 'path' | 'class_instance',
  itemId: string,
  progress: number,
  status: string
) => {
  progressEvents.emit({ type, itemId, progress, status });
}; 