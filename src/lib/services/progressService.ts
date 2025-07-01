import { createSupabaseServerClient } from "@/lib/supabase/server";
import { createClient } from '@/lib/supabase/client';
import { emitProgressUpdate } from '@/lib/utils/progressEvents';
import { HierarchicalProgressServiceClient } from './hierarchical-progress-service.client';

export type ProgressStatus = 'not_started' | 'in_progress' | 'completed' | 'paused';
export type ItemType = 'lesson' | 'lesson_section' | 'assessment' | 'path' | 'course';
export type MasteryLevel = 'novice' | 'developing' | 'proficient' | 'advanced' | 'expert';

export interface ProgressUpdate {
    status?: 'not_started' | 'in_progress' | 'completed' | 'passed' | 'failed';
    progressPercentage?: number;
    lastPosition?: string | null;
}

export interface ProgressData {
    id: string;
    user_id: string;
    item_type: ItemType;
    item_id: string;
    status: ProgressStatus;
    progress_percentage: number;
    last_position: string | null;
    created_at: string;
    updated_at: string;
}

export class ProgressService {
    private supabase;
    private userId: string;
    private hierarchicalService: HierarchicalProgressServiceClient;

    constructor(userId: string) {
        this.supabase = createClient();
        this.userId = userId;
        this.hierarchicalService = new HierarchicalProgressServiceClient();
    }

    /**
     * Update lesson progress using hierarchical service
     * This ensures proper progress flow: lesson → path → class instance
     * Progress will never go backwards
     */
    async updateLessonProgress(lessonId: string, update: ProgressUpdate) {
        return await this.hierarchicalService.updateLessonProgress(lessonId, this.userId, update);
    }

    /**
     * Update assessment progress using hierarchical service
     * This ensures proper progress flow and triggers path/class updates
     * Progress will never go backwards
     */
    async updateAssessmentProgress(assessmentId: string, update: ProgressUpdate) {
        return await this.hierarchicalService.updateAssessmentProgress(assessmentId, this.userId, update);
    }

    /**
     * Get current position in course
     */
    async getCurrentPosition(courseId: string): Promise<{
        currentPath?: string;
        currentLesson?: string;
        currentSection?: string;
        lastPosition?: string | null;
    }> {
        // Get all paths for this course
        const { data: paths, error: pathsError } = await this.supabase
            .from('paths')
            .select(`
                id,
                title,
                order_index,
                lessons (
                    id,
                    title,
                    order_index
                )
            `)
            .eq('base_class_id', courseId)
            .order('order_index');

        if (pathsError || !paths) {
            console.error('Error fetching paths:', pathsError);
            return {};
        }

        // Get all lesson IDs
        const allLessons = paths.flatMap(path => 
            (path.lessons as any[]).map(lesson => ({
                ...lesson,
                path_id: path.id,
                path_title: path.title,
                path_order: path.order_index
            }))
        ).sort((a, b) => {
            if (a.path_order !== b.path_order) {
                return a.path_order - b.path_order;
            }
            return a.order_index - b.order_index;
        });

        // Get progress for all lessons
        const lessonIds = allLessons.map(l => l.id);
        const { data: progressData, error: progressError } = await this.supabase
            .from('progress')
            .select('*')
            .eq('user_id', this.userId)
            .eq('item_type', 'lesson')
            .in('item_id', lessonIds);

        if (progressError) {
            console.error('Error fetching progress:', progressError);
            return {};
        }

        // Create progress map
        const progressMap = new Map(progressData?.map(p => [p.item_id, p]) || []);

        // Find the current lesson (first incomplete lesson)
        for (const lesson of allLessons) {
            const progress = progressMap.get(lesson.id);
            if (!progress || progress.status !== 'completed') {
                return {
                    currentPath: lesson.path_id,
                    currentLesson: lesson.id,
                    lastPosition: progress?.last_position || null
                };
            }
        }

        // All lessons completed, return last lesson
        if (allLessons.length > 0) {
            const lastLesson = allLessons[allLessons.length - 1];
            const lastProgress = progressMap.get(lastLesson.id);
            return {
                currentPath: lastLesson.path_id,
                currentLesson: lastLesson.id,
                lastPosition: lastProgress?.last_position || null
            };
        }

        return {};
    }

    /**
     * Calculate mastery level based on performance
     */
    async calculateMastery(itemId: string, itemType: ItemType): Promise<MasteryLevel> {
        // Get progress data
        const { data: progress, error } = await this.supabase
            .from('progress')
            .select('progress_percentage, status')
            .eq('user_id', this.userId)
            .eq('item_type', itemType)
            .eq('item_id', itemId)
            .single();

        if (error || !progress) {
            return 'novice';
        }

        const percentage = progress.progress_percentage || 0;
        
        if (percentage >= 95) return 'expert';
        if (percentage >= 85) return 'advanced';
        if (percentage >= 70) return 'proficient';
        if (percentage >= 50) return 'developing';
        return 'novice';
    }

    /**
     * Get resume point for course
     */
    async getResumePoint(courseId: string): Promise<{
        type: 'lesson' | 'assessment' | null;
        id: string | null;
        title: string | null;
        position?: string | null;
    }> {
        const position = await this.getCurrentPosition(courseId);
        
        if (position.currentLesson) {
            // Get lesson details
            const { data: lesson } = await this.supabase
                .from('lessons')
                .select('title')
                .eq('id', position.currentLesson)
                .single();

            return {
                type: 'lesson',
                id: position.currentLesson,
                title: lesson?.title || null,
                position: position.lastPosition
            };
        }

        return {
            type: null,
            id: null,
            title: null
        };
    }

    /**
     * Get progress for specific item using hierarchical service
     */
    async getProgress(itemId: string) {
        // Determine item type - this is a simplified approach
        // In practice, you might want to pass the item type explicitly
        return await this.hierarchicalService.getProgress(this.userId, 'lesson', itemId);
    }

    /**
     * Get course progress overview
     */
    async getCourseProgress(courseId: string) {
        const position = await this.getCurrentPosition(courseId);
        const resumePoint = await this.getResumePoint(courseId);

        return {
            currentPosition: position,
            resumePoint,
            overallProgress: 0 // This would be calculated based on all progress
        };
    }

    /**
     * Mark item as completed using hierarchical service
     */
    async markCompleted(itemId: string, itemType: ItemType) {
        const update = { status: 'completed' as const, progressPercentage: 100 };
        
        if (itemType === 'lesson') {
            return await this.hierarchicalService.updateLessonProgress(itemId, this.userId, update);
        } else if (itemType === 'assessment') {
            return await this.hierarchicalService.updateAssessmentProgress(itemId, this.userId, update);
        }
        
        // For other types, use the generic update method
        return await this.updateProgress(itemId, itemType, update);
    }

    /**
     * Generic progress update method (for backward compatibility)
     */
    private async updateProgress(itemId: string, itemType: ItemType, update: ProgressUpdate) {
        const { data, error } = await this.supabase.rpc('upsert_progress' as any, {
            p_user_id: this.userId,
            p_item_type: itemType,
            p_item_id: itemId,
            p_status: update.status || 'in_progress',
            p_progress_percentage: update.progressPercentage || 0,
            p_last_position: update.lastPosition || undefined
        });

        if (error) throw error;

        // Emit progress update event
        emitProgressUpdate(
            itemType as any, 
            itemId, 
            update.progressPercentage || 0, 
            update.status || 'in_progress'
        );

        return data;
    }
} 