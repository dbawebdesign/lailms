import { createSupabaseServerClient } from "@/lib/supabase/server";
import { createClient } from '@/lib/supabase/client';

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

    constructor(userId: string) {
        this.supabase = createClient();
        this.userId = userId;
    }

    /**
     * Update lesson progress and automatically update class instance progress
     */
    async updateLessonProgress(lessonId: string, update: ProgressUpdate) {
        // First update the lesson progress
        const { data, error } = await this.supabase.rpc('upsert_progress' as any, {
            p_user_id: this.userId,
            p_item_type: 'lesson',
            p_item_id: lessonId,
            p_status: update.status || 'in_progress',
            p_progress_percentage: update.progressPercentage || 0,
            p_last_position: update.lastPosition || undefined
        });

        if (error) throw error;

        // Now update the class instance progress
        try {
            await this.updateClassInstanceProgressForLesson(lessonId);
        } catch (classProgressError) {
            console.error('Error updating class instance progress:', classProgressError);
            // Don't fail the main operation if class progress update fails
        }

        return data;
    }

    /**
     * Helper method to update class instance progress when a lesson changes
     */
    private async updateClassInstanceProgressForLesson(lessonId: string) {
        // Get the lesson's base class
        const { data: lesson, error: lessonError } = await this.supabase
            .from('lessons')
            .select(`
                id,
                path_id,
                paths (
                    base_class_id
                )
            `)
            .eq('id', lessonId)
            .single();

        if (lessonError || !lesson) {
            console.error('Error fetching lesson for class instance update:', lessonError);
            return;
        }

        const baseClassId = (lesson.paths as any)?.base_class_id;
        if (!baseClassId) {
            console.error('No base class ID found for lesson:', lessonId);
            return;
        }

        // Find the class instance this user is enrolled in for this base class
        const { data: enrollment, error: enrollmentError } = await this.supabase
            .from('rosters')
            .select('class_instances (id)')
            .eq('profile_id', this.userId)
            .eq('role', 'student')
            .eq('class_instances.base_class_id', baseClassId)
            .single();

        if (enrollmentError || !enrollment?.class_instances) {
            console.error('Error finding enrollment for class instance update:', enrollmentError);
            return;
        }

        const classInstanceId = (enrollment.class_instances as any)?.id;
        if (!classInstanceId) {
            console.error('No class instance ID found for enrollment');
            return;
        }

        // Call the API to update class instance progress (this ensures consistency)
        try {
            const response = await fetch(`/api/progress/class-instance/${classInstanceId}`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({ userId: this.userId })
            });

            if (!response.ok) {
                console.error('Failed to update class instance progress via API');
            }
        } catch (error) {
            console.error('Error calling class instance progress API:', error);
        }
    }

    /**
     * Update assessment progress and automatically update class instance progress
     */
    async updateAssessmentProgress(assessmentId: string, update: ProgressUpdate) {
        // First update the assessment progress
        const { data, error } = await this.supabase.rpc('upsert_progress' as any, {
            p_user_id: this.userId,
            p_item_type: 'assessment',
            p_item_id: assessmentId,
            p_status: update.status || 'in_progress',
            p_progress_percentage: update.progressPercentage || 0,
            p_last_position: update.lastPosition || undefined
        });

        if (error) throw error;

        // Now update the class instance progress
        try {
            await this.updateClassInstanceProgressForAssessment(assessmentId);
        } catch (classProgressError) {
            console.error('Error updating class instance progress:', classProgressError);
            // Don't fail the main operation if class progress update fails
        }

        return data;
    }

    /**
     * Helper method to update class instance progress when an assessment changes
     */
    private async updateClassInstanceProgressForAssessment(assessmentId: string) {
        // Get the assessment's base class
        const { data: assessment, error: assessmentError } = await this.supabase
            .from('assessments')
            .select(`
                id,
                path_id,
                paths (
                    base_class_id
                )
            `)
            .eq('id', assessmentId)
            .single();

        if (assessmentError || !assessment) {
            console.error('Error fetching assessment for class instance update:', assessmentError);
            return;
        }

        const baseClassId = (assessment.paths as any)?.base_class_id;
        if (!baseClassId) {
            console.error('No base class ID found for assessment:', assessmentId);
            return;
        }

        // Find the class instance this user is enrolled in for this base class
        const { data: enrollment, error: enrollmentError } = await this.supabase
            .from('rosters')
            .select('class_instances (id)')
            .eq('profile_id', this.userId)
            .eq('role', 'student')
            .eq('class_instances.base_class_id', baseClassId)
            .single();

        if (enrollmentError || !enrollment?.class_instances) {
            console.error('Error finding enrollment for class instance update:', enrollmentError);
            return;
        }

        const classInstanceId = (enrollment.class_instances as any)?.id;
        if (!classInstanceId) {
            console.error('No class instance ID found for enrollment');
            return;
        }

        // Call the API to update class instance progress (this ensures consistency)
        try {
            const response = await fetch(`/api/progress/class-instance/${classInstanceId}`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({ userId: this.userId })
            });

            if (!response.ok) {
                console.error('Failed to update class instance progress via API');
            }
        } catch (error) {
            console.error('Error calling class instance progress API:', error);
        }
    }

    /**
     * Get current position in a course
     */
    async getCurrentPosition(courseId: string): Promise<{
        currentPath?: string;
        currentLesson?: string;
        currentSection?: string;
        lastPosition?: string | null;
    }> {
        // Get all progress for this course
        const { data: paths } = await this.supabase
            .from('paths')
            .select('id')
            .eq('base_class_id', courseId);

        if (!paths?.length) return {};

        const pathIds = paths.map(p => p.id);

        // Get lessons for these paths
        const { data: lessons } = await this.supabase
            .from('lessons')
            .select('id, path_id')
            .in('path_id', pathIds);

        if (!lessons?.length) return {};

        const lessonIds = lessons.map(l => l.id);

        // Get progress for all lessons
        const { data: progress } = await this.supabase
            .from('progress')
            .select('item_id, item_type, status, last_position, updated_at')
            .eq('user_id', this.userId)
            .in('item_id', lessonIds)
            .eq('item_type', 'lesson')
            .order('updated_at', { ascending: false });

        if (!progress?.length) {
            // No progress yet, return first lesson
            const firstLesson = lessons.find(l => l.path_id === pathIds[0]);
            return {
                currentPath: pathIds[0],
                currentLesson: firstLesson?.id
            };
        }

        // Find the most recent lesson that's in progress or the last completed one
        const inProgressLesson = progress.find(p => p.status === 'in_progress');
        const lastLesson = inProgressLesson || progress[0];

        const lesson = lessons.find(l => l.id === lastLesson.item_id);

        return {
            currentPath: lesson?.path_id,
            currentLesson: lesson?.id,
            lastPosition: lastLesson.last_position
        };
    }

    /**
     * Calculate mastery level based on assessment scores
     */
    async calculateMastery(itemId: string, itemType: ItemType): Promise<MasteryLevel> {
        if (itemType !== 'assessment') {
            return 'novice'; // Only assessments have mastery levels for now
        }

        // Get all attempts for this assessment
        const { data: attempts } = await this.supabase
            .from('student_attempts')
            .select('percentage_score, created_at')
            .eq('student_id', this.userId)
            .eq('assessment_id', itemId)
            .order('created_at', { ascending: true });

        if (!attempts?.length) return 'novice';

        const scores = attempts.map(a => a.percentage_score || 0);
        const avgScore = scores.reduce((a, b) => a + b, 0) / scores.length;
        const latestScore = scores[scores.length - 1];
        const improvement = scores.length > 1 ? latestScore - scores[0] : 0;

        if (latestScore >= 95 && avgScore >= 90) return 'expert';
        if (latestScore >= 85 && avgScore >= 80) return 'advanced';
        if (latestScore >= 75 && avgScore >= 70) return 'proficient';
        if (latestScore >= 60 || improvement > 20) return 'developing';
        return 'novice';
    }

    /**
     * Get resume point for a course
     */
    async getResumePoint(courseId: string): Promise<{
        type: 'lesson' | 'assessment' | null;
        id: string | null;
        title: string | null;
        position?: string | null;
    }> {
        const currentPosition = await this.getCurrentPosition(courseId);
        
        if (!currentPosition.currentLesson) {
            return { type: null, id: null, title: null };
        }

        // Get lesson details
        const { data: lesson } = await this.supabase
            .from('lessons')
            .select('title')
            .eq('id', currentPosition.currentLesson)
            .single();

        return {
            type: 'lesson',
            id: currentPosition.currentLesson,
            title: lesson?.title || 'Unknown Lesson',
            position: currentPosition.lastPosition
        };
    }

    /**
     * Get progress for a specific item
     */
    async getProgress(itemId: string) {
        const { data, error } = await this.supabase
            .from('progress')
            .select('*')
            .eq('user_id', this.userId)
            .eq('item_id', itemId)
            .maybeSingle();

        if (error) throw error;
        return data;
    }

    /**
     * Get all progress for a user in a specific course/path
     */
    async getCourseProgress(courseId: string) {
        // Simple approach - get all progress for user and filter by course items
        const { data: allProgress, error } = await this.supabase
            .from('progress')
            .select('*')
            .eq('user_id', this.userId);

        if (error) throw error;
        
        // Get all lessons in this course to filter progress
        const { data: courseLessons } = await this.supabase
            .from('lessons')
            .select('id, paths!inner(base_class_id)')
            .eq('paths.base_class_id', courseId);

        const lessonIds = courseLessons?.map(l => l.id) || [];
        
        // Filter progress to only include items from this course
        const courseProgress = allProgress?.filter(p => 
            lessonIds.includes(p.item_id) || p.item_id === courseId
        ) || [];

        return courseProgress;
    }

    /**
     * Mark an item as completed
     */
    async markCompleted(itemId: string, itemType: ItemType) {
        return this.updateProgress(itemId, itemType, {
            status: 'completed',
            progressPercentage: 100
        });
    }

    /**
     * Generic progress update method
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

        // Update class instance progress for lessons and assessments
        try {
            if (itemType === 'lesson') {
                await this.updateClassInstanceProgressForLesson(itemId);
            } else if (itemType === 'assessment') {
                await this.updateClassInstanceProgressForAssessment(itemId);
            }
        } catch (classProgressError) {
            console.error('Error updating class instance progress:', classProgressError);
            // Don't fail the main operation if class progress update fails
        }

        return data;
    }
} 