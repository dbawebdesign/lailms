import { createClient } from '@/lib/supabase/client';
import { emitProgressUpdate } from '@/lib/utils/progressEvents';

export interface ProgressUpdateData {
    status?: 'not_started' | 'in_progress' | 'completed' | 'passed' | 'failed';
    progressPercentage?: number;
    lastPosition?: string | null;
}

/**
 * Client-side hierarchical progress service for browser environments
 * Ensures progress never goes backwards and triggers hierarchical updates
 */
export class HierarchicalProgressServiceClient {
    private supabase;

    constructor() {
        this.supabase = createClient();
    }

    /**
     * Update lesson progress and trigger hierarchical updates
     * Progress will never go backwards
     */
    async updateLessonProgress(
        lessonId: string, 
        userId: string, 
        update: ProgressUpdateData
    ): Promise<void> {
        console.log(`🔄 Client: Starting lesson progress update: ${lessonId} for user ${userId}`);
        
        try {
            // Call the server API endpoint which handles the hierarchical updates
            const response = await fetch(`/api/progress/lesson/${lessonId}`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    status: update.status || 'in_progress',
                    progressPercentage: update.progressPercentage || 0,
                    lastPosition: update.lastPosition || null
                }),
            });

            if (!response.ok) {
                throw new Error(`Failed to update lesson progress: ${response.statusText}`);
            }

            const data = await response.json();
            console.log(`✅ Client: Lesson progress updated successfully`, data);

            // Emit progress update event for real-time UI updates
            if (data.progress) {
                emitProgressUpdate(
                    'lesson', 
                    lessonId, 
                    data.progress.progress_percentage || 0, 
                    data.progress.status || 'in_progress'
                );
            }

        } catch (error) {
            console.error('Error updating lesson progress:', error);
            throw error;
        }
    }

    /**
     * Update assessment progress and trigger hierarchical updates
     * Progress will never go backwards
     */
    async updateAssessmentProgress(
        assessmentId: string, 
        userId: string, 
        update: ProgressUpdateData
    ): Promise<void> {
        console.log(`🔄 Client: Starting assessment progress update: ${assessmentId} for user ${userId}`);
        
        try {
            // Call the server API endpoint which handles the hierarchical updates
            const response = await fetch(`/api/progress/assessment/${assessmentId}`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    status: update.status || 'in_progress',
                    progressPercentage: update.progressPercentage || 0,
                    lastPosition: update.lastPosition || null
                }),
            });

            if (!response.ok) {
                throw new Error(`Failed to update assessment progress: ${response.statusText}`);
            }

            const data = await response.json();
            console.log(`✅ Client: Assessment progress updated successfully`, data);

            // Emit progress update event for real-time UI updates
            if (data.progress) {
                emitProgressUpdate(
                    'assessment', 
                    assessmentId, 
                    data.progress.progress_percentage || 0, 
                    data.progress.status || 'in_progress'
                );
            }

        } catch (error) {
            console.error('Error updating assessment progress:', error);
            throw error;
        }
    }

    /**
     * Get current progress for any item
     */
    async getProgress(
        userId: string,
        itemType: 'lesson' | 'assessment' | 'path' | 'class_instance',
        itemId: string
    ): Promise<any> {
        const { data, error } = await this.supabase
            .from('progress')
            .select('*')
            .eq('user_id', userId)
            .eq('item_type', itemType)
            .eq('item_id', itemId)
            .single();

        if (error && error.code !== 'PGRST116') { // PGRST116 = no rows returned
            console.error('Error fetching progress:', error);
            throw error;
        }

        return data || {
            user_id: userId,
            item_type: itemType,
            item_id: itemId,
            status: 'not_started',
            progress_percentage: 0,
            last_position: null
        };
    }
}

// Export convenience function
export const createClientProgressService = () => new HierarchicalProgressServiceClient(); 