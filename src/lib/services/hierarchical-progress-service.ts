import { createClient } from '@/lib/supabase/client';
import { emitProgressUpdate } from '@/lib/utils/progressEvents';

// Dynamic import for server client to avoid Next.js SSR issues
const getServerClient = async () => {
    const { createSupabaseServerClient } = await import('@/lib/supabase/server');
    return createSupabaseServerClient();
};

export interface ProgressUpdateData {
    status?: 'not_started' | 'in_progress' | 'completed' | 'passed' | 'failed';
    progressPercentage?: number;
    lastPosition?: string | null;
}

export interface ProgressCalculationResult {
    progressPercentage: number;
    status: 'not_started' | 'in_progress' | 'completed';
    totalItems: number;
    completedItems: number;
}

/**
 * Comprehensive hierarchical progress service that ensures immediate updates
 * flow from lesson → path → class instance with proper 80/20 weighting.
 * CRITICAL: Progress never goes backwards at any level.
 */
export class HierarchicalProgressService {
    private supabase: any;
    private isServerSide: boolean;

    constructor(isServerSide = false) {
        this.isServerSide = isServerSide;
        // Initialize supabase client based on context
        if (isServerSide) {
            // For server-side, we'll initialize in the method calls
            this.supabase = null;
        } else {
            this.supabase = createClient();
        }
    }

    private async getSupabaseClient() {
        if (this.isServerSide) {
            return await getServerClient();
        }
        return this.supabase;
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
        console.log(`🔄 Starting lesson progress update: ${lessonId} for user ${userId}`);
        
        // Get current progress to ensure we never go backwards
        const currentProgress = await this.getProgress(userId, 'lesson', lessonId);
        const safeUpdate = await this.ensureProgressNeverGoesBackwards(currentProgress, update);
        
        if (!safeUpdate.shouldUpdate) {
            console.log(`⚠️ Skipping lesson progress update: ${update.progressPercentage}% <= ${currentProgress.progress_percentage}%`);
            return;
        }

        // 1. Update lesson progress in database
        await this.updateProgressInDatabase(userId, 'lesson', lessonId, safeUpdate.update);

        // 2. Get lesson's path and trigger path progress update (before emitting events)
        const supabase = await this.getSupabaseClient();
        const { data: lesson } = await supabase
            .from('lessons')
            .select('path_id, base_class_id')
            .eq('id', lessonId)
            .single();

        if (lesson?.path_id) {
            console.log(`🔄 Triggering path progress update: ${lesson.path_id}`);
            await this.updatePathProgress(lesson.path_id, userId);
        }

        // 3. Emit progress update event after all hierarchical updates are complete
        emitProgressUpdate(
            'lesson', 
            lessonId, 
            safeUpdate.update.progressPercentage || 0, 
            safeUpdate.update.status || 'in_progress'
        );
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
        console.log(`🔄 Starting assessment progress update: ${assessmentId} for user ${userId}`);
        
        // Get current progress to ensure we never go backwards
        const currentProgress = await this.getProgress(userId, 'assessment', assessmentId);
        const safeUpdate = await this.ensureProgressNeverGoesBackwards(currentProgress, update);
        
        if (!safeUpdate.shouldUpdate) {
            console.log(`⚠️ Skipping assessment progress update: ${update.progressPercentage}% <= ${currentProgress.progress_percentage}%`);
            return;
        }

        // 1. Update assessment progress in database
        await this.updateProgressInDatabase(userId, 'assessment', assessmentId, safeUpdate.update);
        
        // 2. Emit progress update event
        emitProgressUpdate(
            'assessment', 
            assessmentId, 
            safeUpdate.update.progressPercentage || 0, 
            safeUpdate.update.status || 'in_progress'
        );

        // 3. Get assessment's path/class and trigger appropriate updates
        const supabase = await this.getSupabaseClient();
        const { data: assessment } = await supabase
            .from('assessments')
            .select('path_id, base_class_id, assessment_type')
            .eq('id', assessmentId)
            .single();

        if (assessment) {
            if (assessment.path_id) {
                console.log(`🔄 Triggering path progress update from assessment: ${assessment.path_id}`);
                await this.updatePathProgress(assessment.path_id, userId);
            } else if (assessment.base_class_id) {
                // Class-level assessment - directly update class instance
                console.log(`🔄 Triggering class instance progress update from class assessment`);
                await this.updateClassInstanceProgress(assessment.base_class_id, userId);
            }
        }
    }

    /**
     * Calculate and update path progress based on lessons and assessments
     * Progress will never go backwards
     */
    async updatePathProgress(pathId: string, userId: string): Promise<void> {
        console.log(`🔄 Calculating path progress: ${pathId} for user ${userId}`);
        
        const pathProgress = await this.calculatePathProgress(pathId, userId);
        
        // Get current path progress to ensure we never go backwards
        const currentProgress = await this.getProgress(userId, 'path', pathId);
        const safeUpdate = await this.ensureProgressNeverGoesBackwards(currentProgress, {
            status: pathProgress.status,
            progressPercentage: pathProgress.progressPercentage
        });

        if (!safeUpdate.shouldUpdate) {
            console.log(`⚠️ Skipping path progress update: ${pathProgress.progressPercentage}% <= ${currentProgress.progress_percentage}%`);
            // Still need to trigger class instance update in case other paths changed
            const supabase = await this.getSupabaseClient();
            const { data: path } = await supabase
                .from('paths')
                .select('base_class_id')
                .eq('id', pathId)
                .single();

            if (path?.base_class_id) {
                await this.updateClassInstanceProgress(path.base_class_id, userId);
            }
            return;
        }

        // Update path progress in database
        await this.updateProgressInDatabase(userId, 'path', pathId, safeUpdate.update);

        // Get path's base class and trigger class instance update (before emitting events)
        const supabaseForPath = await this.getSupabaseClient();
        const { data: path } = await supabaseForPath
            .from('paths')
            .select('base_class_id')
            .eq('id', pathId)
            .single();

        if (path?.base_class_id) {
            console.log(`🔄 Triggering class instance progress update: ${path.base_class_id}`);
            await this.updateClassInstanceProgress(path.base_class_id, userId);
        }

        // Emit progress update event after all hierarchical updates are complete
        emitProgressUpdate(
            'path', 
            pathId, 
            safeUpdate.update.progressPercentage || 0, 
            safeUpdate.update.status || 'in_progress'
        );
    }

    /**
     * Calculate and update class instance progress
     * Progress will never go backwards
     */
    async updateClassInstanceProgress(baseClassId: string, userId: string): Promise<void> {
        console.log(`🔄 Calculating class instance progress for base class: ${baseClassId}, user: ${userId}`);
        
        // Find the class instance this user is enrolled in
        const supabase = await this.getSupabaseClient();
        const { data: enrollment } = await supabase
            .from('rosters')
            .select('class_instance_id')
            .eq('profile_id', userId)
            .eq('role', 'student')
            .single();

        if (!enrollment?.class_instance_id) {
            console.log('No enrollment found - user may be in self-paced learning mode');
            return;
        }

        // Verify this class instance belongs to the correct base class
        const { data: classInstance } = await supabase
            .from('class_instances')
            .select('base_class_id')
            .eq('id', enrollment.class_instance_id)
            .eq('base_class_id', baseClassId)
            .single();

        if (!classInstance) {
            console.log(`Class instance ${enrollment.class_instance_id} does not match base class ${baseClassId}`);
            return;
        }

        const classProgress = await this.calculateClassInstanceProgress(baseClassId, userId);
        
        // Get current class instance progress to ensure we never go backwards
        const currentProgress = await this.getProgress(userId, 'class_instance', enrollment.class_instance_id);
        const safeUpdate = await this.ensureProgressNeverGoesBackwards(currentProgress, {
            status: classProgress.status,
            progressPercentage: classProgress.progressPercentage
        });

        if (!safeUpdate.shouldUpdate) {
            console.log(`⚠️ Skipping class instance progress update: ${classProgress.progressPercentage}% <= ${currentProgress.progress_percentage}%`);
            return;
        }

        // Update class instance progress in database
        await this.updateProgressInDatabase(userId, 'class_instance', enrollment.class_instance_id, safeUpdate.update);

        // Emit progress update event
        emitProgressUpdate(
            'class_instance', 
            enrollment.class_instance_id, 
            safeUpdate.update.progressPercentage || 0, 
            safeUpdate.update.status || 'in_progress'
        );

        console.log(`✅ Updated class instance progress: ${enrollment.class_instance_id} -> ${safeUpdate.update.progressPercentage}%`);
    }

    /**
     * Ensures progress never goes backwards
     * Returns whether update should proceed and the safe update data
     */
    private async ensureProgressNeverGoesBackwards(
        currentProgress: any,
        proposedUpdate: ProgressUpdateData
    ): Promise<{ shouldUpdate: boolean; update: ProgressUpdateData }> {
        const currentPercentage = currentProgress?.progress_percentage || 0;
        const proposedPercentage = proposedUpdate.progressPercentage || 0;
        const currentStatus = currentProgress?.status || 'not_started';
        const proposedStatus = proposedUpdate.status || 'in_progress';

        // Never allow progress percentage to go backwards
        if (proposedPercentage < currentPercentage) {
            return { shouldUpdate: false, update: proposedUpdate };
        }

        // Don't allow status downgrades if progress hasn't increased
        if (proposedPercentage === currentPercentage) {
            // Status priority: completed > passed > in_progress > not_started
            const statusPriority = {
                'not_started': 0,
                'in_progress': 1,
                'passed': 2,
                'completed': 3,
                'failed': 1 // Same as in_progress for priority
            };

            const currentPriority = statusPriority[currentStatus as keyof typeof statusPriority] || 0;
            const proposedPriority = statusPriority[proposedStatus as keyof typeof statusPriority] || 0;

            if (proposedPriority < currentPriority) {
                return { shouldUpdate: false, update: proposedUpdate };
            }

            // If same priority and same percentage, no need to update
            if (proposedPriority === currentPriority) {
                return { shouldUpdate: false, update: proposedUpdate };
            }
        }

        // Safe to update - progress is moving forward
        return { 
            shouldUpdate: true, 
            update: {
                ...proposedUpdate,
                progressPercentage: Math.max(currentPercentage, proposedPercentage)
            }
        };
    }

    /**
     * Calculate path progress using 80/20 weighting (lessons 80%, assessments 20%)
     */
    private async calculatePathProgress(pathId: string, userId: string): Promise<ProgressCalculationResult> {
        const supabase = await this.getSupabaseClient();
        
        // Get all lessons in the path
        const { data: lessons } = await supabase
            .from('lessons')
            .select('id')
            .eq('path_id', pathId);

        // Get all assessments for the path (lesson assessments + path assessments)
        const { data: pathAssessments } = await supabase
            .from('assessments')
            .select('id')
            .eq('path_id', pathId);

        const { data: lessonAssessments } = await supabase
            .from('assessments')
            .select('id')
            .in('lesson_id', lessons?.map((l: any) => l.id) || []);

        const lessonIds = lessons?.map((l: any) => l.id) || [];
        const assessmentIds = [
            ...(pathAssessments?.map((a: any) => a.id) || []),
            ...(lessonAssessments?.map((a: any) => a.id) || [])
        ];

        // Get progress for lessons
        const { data: lessonProgress } = await supabase
            .from('progress')
            .select('status, progress_percentage')
            .eq('user_id', userId)
            .eq('item_type', 'lesson')
            .in('item_id', lessonIds);

        // Get progress for assessments
        const { data: assessmentProgress } = await supabase
            .from('progress')
            .select('status, progress_percentage')
            .eq('user_id', userId)
            .eq('item_type', 'assessment')
            .in('item_id', assessmentIds);

        // Calculate lesson progress
        const totalLessons = lessonIds.length;
        const completedLessons = lessonProgress?.filter((p: any) => p.status === 'completed').length || 0;
        const lessonProgressPercentage = totalLessons > 0 ? (completedLessons / totalLessons) * 100 : 0;

        // Calculate assessment progress
        const totalAssessments = assessmentIds.length;
        const completedAssessments = assessmentProgress?.filter((p: any) => 
            p.status === 'completed' || p.status === 'passed'
        ).length || 0;
        const assessmentProgressPercentage = totalAssessments > 0 ? (completedAssessments / totalAssessments) * 100 : 0;

        // Apply 80/20 weighting
        let overallProgress = 0;
        if (totalLessons > 0 && totalAssessments > 0) {
            // Both lessons and assessments exist: apply 80/20 weighting
            overallProgress = (lessonProgressPercentage * 0.8) + (assessmentProgressPercentage * 0.2);
        } else if (totalLessons > 0) {
            // Only lessons exist: lessons count for 100%
            overallProgress = lessonProgressPercentage;
        } else if (totalAssessments > 0) {
            // Only assessments exist: assessments count for 100%
            overallProgress = assessmentProgressPercentage;
        }

        const progressPercentage = Math.round(overallProgress);
        
        // Determine status
        let status: 'not_started' | 'in_progress' | 'completed' = 'not_started';
        if (progressPercentage > 0 && progressPercentage < 100) {
            status = 'in_progress';
        } else if (progressPercentage >= 100) {
            status = 'completed';
        }

        console.log(`📊 Path ${pathId} progress: ${progressPercentage}% (${completedLessons}/${totalLessons} lessons, ${completedAssessments}/${totalAssessments} assessments)`);

        return {
            progressPercentage,
            status,
            totalItems: totalLessons + totalAssessments,
            completedItems: completedLessons + completedAssessments
        };
    }

    /**
     * Calculate class instance progress using 80/20 weighting
     */
    private async calculateClassInstanceProgress(baseClassId: string, userId: string): Promise<ProgressCalculationResult> {
        const supabase = await this.getSupabaseClient();
        
        // Get all paths for the class
        const { data: paths } = await supabase
            .from('paths')
            .select('id')
            .eq('base_class_id', baseClassId);

        const pathIds = paths?.map((p: any) => p.id) || [];

        // Get all lessons for the class
        const { data: lessons } = await supabase
            .from('lessons')
            .select('id')
            .in('path_id', pathIds);

        const lessonIds = lessons?.map((l: any) => l.id) || [];

        // Get all assessments for the class
        const { data: assessments } = await supabase
            .from('assessments')
            .select('id')
            .eq('base_class_id', baseClassId);

        const assessmentIds = assessments?.map((a: any) => a.id) || [];

        // Get progress for lessons
        const { data: lessonProgress } = await supabase
            .from('progress')
            .select('status, progress_percentage')
            .eq('user_id', userId)
            .eq('item_type', 'lesson')
            .in('item_id', lessonIds);

        // Get progress for assessments
        const { data: assessmentProgress } = await supabase
            .from('progress')
            .select('status, progress_percentage')
            .eq('user_id', userId)
            .eq('item_type', 'assessment')
            .in('item_id', assessmentIds);

        // Calculate lesson progress
        const totalLessons = lessonIds.length;
        const completedLessons = lessonProgress?.filter((p: any) => p.status === 'completed').length || 0;
        const lessonProgressPercentage = totalLessons > 0 ? (completedLessons / totalLessons) * 100 : 0;

        // Calculate assessment progress
        const totalAssessments = assessmentIds.length;
        const completedAssessments = assessmentProgress?.filter((p: any) => 
            p.status === 'completed' || p.status === 'passed'
        ).length || 0;
        const assessmentProgressPercentage = totalAssessments > 0 ? (completedAssessments / totalAssessments) * 100 : 0;

        // Apply 80/20 weighting
        let overallProgress = 0;
        if (totalLessons > 0 && totalAssessments > 0) {
            // Both lessons and assessments exist: apply 80/20 weighting
            overallProgress = (lessonProgressPercentage * 0.8) + (assessmentProgressPercentage * 0.2);
        } else if (totalLessons > 0) {
            // Only lessons exist: lessons count for 100%
            overallProgress = lessonProgressPercentage;
        } else if (totalAssessments > 0) {
            // Only assessments exist: assessments count for 100%
            overallProgress = assessmentProgressPercentage;
        }

        const progressPercentage = Math.round(overallProgress);
        
        // Determine status
        let status: 'not_started' | 'in_progress' | 'completed' = 'not_started';
        if (progressPercentage > 0 && progressPercentage < 100) {
            status = 'in_progress';
        } else if (progressPercentage >= 100) {
            status = 'completed';
        }

        console.log(`📊 Class ${baseClassId} progress: ${progressPercentage}% (${completedLessons}/${totalLessons} lessons, ${completedAssessments}/${totalAssessments} assessments)`);

        return {
            progressPercentage,
            status,
            totalItems: totalLessons + totalAssessments,
            completedItems: completedLessons + completedAssessments
        };
    }

    /**
     * Update progress in database using the upsert function
     */
    private async updateProgressInDatabase(
        userId: string,
        itemType: 'lesson' | 'assessment' | 'path' | 'class_instance',
        itemId: string,
        update: ProgressUpdateData
    ): Promise<void> {
        const supabase = await this.getSupabaseClient();
        const { error } = await supabase.rpc('upsert_progress' as any, {
            p_user_id: userId,
            p_item_type: itemType,
            p_item_id: itemId,
            p_status: update.status || 'in_progress',
            p_progress_percentage: update.progressPercentage || 0,
            p_last_position: update.lastPosition || null
        });

        if (error) {
            console.error(`Error updating ${itemType} progress:`, error);
            throw error;
        }

        console.log(`✅ Updated ${itemType} progress: ${itemId} -> ${update.progressPercentage}% (${update.status})`);
    }

    /**
     * Get current progress for any item
     */
    async getProgress(
        userId: string,
        itemType: 'lesson' | 'assessment' | 'path' | 'class_instance',
        itemId: string
    ): Promise<any> {
        const supabase = await this.getSupabaseClient();
        const { data, error } = await supabase
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

// Export convenience functions for backward compatibility
export const createHierarchicalProgressService = (isServerSide = false) => 
    new HierarchicalProgressService(isServerSide); 