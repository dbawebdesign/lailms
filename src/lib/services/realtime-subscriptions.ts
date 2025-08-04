import { createClient } from '@/lib/supabase/client';
import { createSupabaseServerClient } from '@/lib/supabase/server';
import { RealtimeChannel, RealtimePostgresChangesPayload } from '@supabase/supabase-js';

export type CourseGenerationJobUpdate = {
  id: string;
  status: 'pending' | 'processing' | 'completed' | 'failed' | 'cancelled';
  progress: number;
  current_task?: string;
  error_message?: string;
  updated_at: string;
};

export type CourseGenerationTaskUpdate = {
  id: string;
  job_id: string;
  status: 'pending' | 'running' | 'completed' | 'failed';
  progress: number;
  error_message?: string;
  updated_at: string;
};

export type DocumentProcessingUpdate = {
  id: string;
  status: 'uploading' | 'processing' | 'completed' | 'failed';
  progress: number;
  error_message?: string;
  updated_at: string;
};

export type AssessmentGradingUpdate = {
  id: string;
  status: 'pending' | 'grading' | 'completed' | 'failed';
  score?: number;
  feedback?: string;
  updated_at: string;
};

export type SubscriptionCallback<T> = (payload: RealtimePostgresChangesPayload<T>) => void;

/**
 * Centralized service for managing Supabase Realtime subscriptions
 * Replaces polling patterns with efficient real-time updates
 */
export class RealtimeSubscriptionService {
  private supabase = createClient();
  private channels = new Map<string, RealtimeChannel>();
  private subscriptions = new Map<string, Set<SubscriptionCallback<any>>>();

  /**
   * Subscribe to course generation job updates for a specific job
   */
  subscribeToJobUpdates(
    jobId: string, 
    callback: SubscriptionCallback<CourseGenerationJobUpdate>
  ): () => void {
    const channelName = `job-updates-${jobId}`;
    
    if (!this.channels.has(channelName)) {
      const channel = this.supabase
        .channel(channelName)
        .on(
          'postgres_changes',
          {
            event: 'UPDATE',
            schema: 'public',
            table: 'course_generation_jobs',
            filter: `id=eq.${jobId}`
          },
          callback
        )
        .subscribe();

      this.channels.set(channelName, channel);
      this.subscriptions.set(channelName, new Set([callback]));
    } else {
      // Add callback to existing channel
      const callbacks = this.subscriptions.get(channelName) || new Set();
      callbacks.add(callback);
      this.subscriptions.set(channelName, callbacks);
    }

    // Return unsubscribe function
    return () => this.unsubscribeFromJobUpdates(jobId, callback);
  }

  /**
   * Subscribe to task updates for a specific job
   */
  subscribeToTaskUpdates(
    jobId: string,
    callback: SubscriptionCallback<CourseGenerationTaskUpdate>
  ): () => void {
    const channelName = `task-updates-${jobId}`;
    
    if (!this.channels.has(channelName)) {
      const channel = this.supabase
        .channel(channelName)
        .on(
          'postgres_changes',
          {
            event: '*', // Listen to all changes (INSERT, UPDATE, DELETE)
            schema: 'public',
            table: 'course_generation_tasks',
            filter: `job_id=eq.${jobId}`
          },
          callback
        )
        .subscribe();

      this.channels.set(channelName, channel);
      this.subscriptions.set(channelName, new Set([callback]));
    } else {
      const callbacks = this.subscriptions.get(channelName) || new Set();
      callbacks.add(callback);
      this.subscriptions.set(channelName, callbacks);
    }

    return () => this.unsubscribeFromTaskUpdates(jobId, callback);
  }

  /**
   * Subscribe to document processing updates
   */
  subscribeToDocumentProcessing(
    documentId: string,
    callback: SubscriptionCallback<DocumentProcessingUpdate>
  ): () => void {
    const channelName = `doc-processing-${documentId}`;
    
    if (!this.channels.has(channelName)) {
      const channel = this.supabase
        .channel(channelName)
        .on(
          'postgres_changes',
          {
            event: 'UPDATE',
            schema: 'public',
            table: 'knowledge_base_files',
            filter: `id=eq.${documentId}`
          },
          callback
        )
        .subscribe();

      this.channels.set(channelName, channel);
      this.subscriptions.set(channelName, new Set([callback]));
    } else {
      const callbacks = this.subscriptions.get(channelName) || new Set();
      callbacks.add(callback);
      this.subscriptions.set(channelName, callbacks);
    }

    return () => this.unsubscribeFromDocumentProcessing(documentId, callback);
  }

  /**
   * Subscribe to assessment grading updates
   */
  subscribeToAssessmentGrading(
    attemptId: string,
    callback: SubscriptionCallback<AssessmentGradingUpdate>
  ): () => void {
    const channelName = `grading-${attemptId}`;
    
    if (!this.channels.has(channelName)) {
      const channel = this.supabase
        .channel(channelName)
        .on(
          'postgres_changes',
          {
            event: 'UPDATE',
            schema: 'public',
            table: 'assessment_attempts',
            filter: `id=eq.${attemptId}`
          },
          callback
        )
        .subscribe();

      this.channels.set(channelName, channel);
      this.subscriptions.set(channelName, new Set([callback]));
    } else {
      const callbacks = this.subscriptions.get(channelName) || new Set();
      callbacks.add(callback);
      this.subscriptions.set(channelName, callbacks);
    }

    return () => this.unsubscribeFromAssessmentGrading(attemptId, callback);
  }

  /**
   * Subscribe to user's course generation jobs (for dashboard)
   */
  subscribeToUserJobs(
    userId: string,
    callback: SubscriptionCallback<CourseGenerationJobUpdate>
  ): () => void {
    const channelName = `user-jobs-${userId}`;
    
    if (!this.channels.has(channelName)) {
      const channel = this.supabase
        .channel(channelName)
        .on(
          'postgres_changes',
          {
            event: '*',
            schema: 'public',
            table: 'course_generation_jobs',
            filter: `user_id=eq.${userId}`
          },
          callback
        )
        .subscribe();

      this.channels.set(channelName, channel);
      this.subscriptions.set(channelName, new Set([callback]));
    } else {
      const callbacks = this.subscriptions.get(channelName) || new Set();
      callbacks.add(callback);
      this.subscriptions.set(channelName, callbacks);
    }

    return () => this.unsubscribeFromUserJobs(userId, callback);
  }

  /**
   * Broadcast custom events (for coordination between components)
   */
  broadcastJobEvent(jobId: string, event: string, data: any): void {
    const channelName = `job-events-${jobId}`;
    
    if (!this.channels.has(channelName)) {
      const channel = this.supabase.channel(channelName);
      this.channels.set(channelName, channel);
      channel.subscribe();
    }

    const channel = this.channels.get(channelName);
    channel?.send({
      type: 'broadcast',
      event,
      payload: data
    });
  }

  /**
   * Listen to custom broadcast events
   */
  subscribeToBroadcast(
    jobId: string,
    event: string,
    callback: (payload: any) => void
  ): () => void {
    const channelName = `job-events-${jobId}`;
    
    if (!this.channels.has(channelName)) {
      const channel = this.supabase
        .channel(channelName)
        .on('broadcast', { event }, callback)
        .subscribe();

      this.channels.set(channelName, channel);
    }

    return () => {
      const channel = this.channels.get(channelName);
      if (channel) {
        channel.unsubscribe();
        this.channels.delete(channelName);
      }
    };
  }

  // Unsubscribe methods
  private unsubscribeFromJobUpdates(jobId: string, callback: SubscriptionCallback<CourseGenerationJobUpdate>): void {
    const channelName = `job-updates-${jobId}`;
    const callbacks = this.subscriptions.get(channelName);
    
    if (callbacks) {
      callbacks.delete(callback);
      if (callbacks.size === 0) {
        const channel = this.channels.get(channelName);
        channel?.unsubscribe();
        this.channels.delete(channelName);
        this.subscriptions.delete(channelName);
      }
    }
  }

  private unsubscribeFromTaskUpdates(jobId: string, callback: SubscriptionCallback<CourseGenerationTaskUpdate>): void {
    const channelName = `task-updates-${jobId}`;
    const callbacks = this.subscriptions.get(channelName);
    
    if (callbacks) {
      callbacks.delete(callback);
      if (callbacks.size === 0) {
        const channel = this.channels.get(channelName);
        channel?.unsubscribe();
        this.channels.delete(channelName);
        this.subscriptions.delete(channelName);
      }
    }
  }

  private unsubscribeFromDocumentProcessing(documentId: string, callback: SubscriptionCallback<DocumentProcessingUpdate>): void {
    const channelName = `doc-processing-${documentId}`;
    const callbacks = this.subscriptions.get(channelName);
    
    if (callbacks) {
      callbacks.delete(callback);
      if (callbacks.size === 0) {
        const channel = this.channels.get(channelName);
        channel?.unsubscribe();
        this.channels.delete(channelName);
        this.subscriptions.delete(channelName);
      }
    }
  }

  private unsubscribeFromAssessmentGrading(attemptId: string, callback: SubscriptionCallback<AssessmentGradingUpdate>): void {
    const channelName = `grading-${attemptId}`;
    const callbacks = this.subscriptions.get(channelName);
    
    if (callbacks) {
      callbacks.delete(callback);
      if (callbacks.size === 0) {
        const channel = this.channels.get(channelName);
        channel?.unsubscribe();
        this.channels.delete(channelName);
        this.subscriptions.delete(channelName);
      }
    }
  }

  private unsubscribeFromUserJobs(userId: string, callback: SubscriptionCallback<CourseGenerationJobUpdate>): void {
    const channelName = `user-jobs-${userId}`;
    const callbacks = this.subscriptions.get(channelName);
    
    if (callbacks) {
      callbacks.delete(callback);
      if (callbacks.size === 0) {
        const channel = this.channels.get(channelName);
        channel?.unsubscribe();
        this.channels.delete(channelName);
        this.subscriptions.delete(channelName);
      }
    }
  }

  /**
   * Clean up all subscriptions (call on app unmount)
   */
  cleanup(): void {
    for (const channel of this.channels.values()) {
      channel.unsubscribe();
    }
    this.channels.clear();
    this.subscriptions.clear();
  }
}

// Export singleton instance
export const realtimeService = new RealtimeSubscriptionService();