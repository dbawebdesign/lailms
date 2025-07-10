import { createSupabaseServerClient } from '@/lib/supabase/server';

/**
 * Calculates the overall progress for a base class using weighted calculation.
 * Lessons account for 80% and assessments account for 20% of the total progress.
 * This should be called on the server.
 * @param baseClassId - The ID of the base class.
 * @param userId - The ID of the user.
 * @returns The overall progress percentage (0-100).
 */
export async function calculateOverallProgress(baseClassId: string, userId: string): Promise<number> {
  const supabase = createSupabaseServerClient();

  // 1. Get all lessons for the class
  const { data: paths, error: pathsError } = await supabase
    .from('paths')
    .select('lessons(id)')
    .eq('base_class_id', baseClassId)
    .returns<{ lessons: { id: string }[] }[]>();

  if (pathsError || !paths) {
    console.error('Error fetching paths for progress:', pathsError);
    return 0;
  }

  const lessonIds = paths.flatMap(p => p.lessons.map(l => l.id));

  // Get all assessments for the class (lesson, path, and class assessments)
  const { data: assessments, error: assessmentsError } = await supabase
    .from('assessments')
    .select('id')
    .eq('base_class_id', baseClassId);

  if (assessmentsError) {
    console.error('Error fetching assessments for progress:', assessmentsError);
    return 0;
  }

  const assessmentIds = assessments?.map(a => a.id) || [];

  // 2. Get all completed items for the user in this class
  const { count: completedLessons, error: lessonProgressError } = await supabase
    .from('progress')
    .select('*', { count: 'exact', head: true })
    .eq('user_id', userId)
    .eq('item_type', 'lesson')
    .in('item_id', lessonIds)
    .eq('status', 'completed');

  const { count: completedAssessments, error: assessmentProgressError } = await supabase
    .from('progress')
    .select('*', { count: 'exact', head: true })
    .eq('user_id', userId)
    .eq('item_type', 'assessment')
    .in('item_id', assessmentIds)
    .in('status', ['completed', 'passed']); // Either completed or passed for assessments

  if (lessonProgressError || assessmentProgressError) {
    console.error('Error fetching progress:', lessonProgressError, assessmentProgressError);
    return 0;
  }

  // 3. Calculate weighted progress: lessons 80%, assessments 20%
  const totalLessons = lessonIds.length;
  const totalAssessments = assessmentIds.length;
  
  if (totalLessons === 0 && totalAssessments === 0) return 0;

  // Calculate individual progress percentages
  const lessonProgress = totalLessons > 0 ? ((completedLessons || 0) / totalLessons) * 100 : 0;
  const assessmentProgress = totalAssessments > 0 ? ((completedAssessments || 0) / totalAssessments) * 100 : 0;

  // Apply weighted calculation
  let overallProgress = 0;
  if (totalLessons > 0 && totalAssessments > 0) {
    // Both lessons and assessments exist: apply 80/20 weighting
    overallProgress = (lessonProgress * 0.8) + (assessmentProgress * 0.2);
  } else if (totalLessons > 0) {
    // Only lessons exist: lessons count for 100%
    overallProgress = lessonProgress;
  } else if (totalAssessments > 0) {
    // Only assessments exist: assessments count for 100%
    overallProgress = assessmentProgress;
  }

  return Math.round(overallProgress);
}

/**
 * Updates the class instance progress for a user.
 * This should be called whenever lesson progress changes.
 * @param classInstanceId - The ID of the class instance.
 * @param userId - The ID of the user.
 */
export async function updateClassInstanceProgress(classInstanceId: string, userId: string): Promise<void> {
  const supabase = createSupabaseServerClient();

  // 1. Get the base class ID for this instance
  const { data: instance, error: instanceError } = await supabase
    .from('class_instances')
    .select('base_class_id')
    .eq('id', classInstanceId)
    .single();

  if (instanceError || !instance) {
    console.error('Error fetching class instance:', instanceError);
    return;
  }

  // 2. Calculate the overall progress
  const progressPercentage = await calculateOverallProgress(instance.base_class_id, userId);

  // 3. Get existing progress to ensure we never go backwards
  const { data: existingProgress } = await supabase
    .from('progress')
    .select('progress_percentage')
    .eq('user_id', userId)
    .eq('item_type', 'class_instance')
    .eq('item_id', classInstanceId)
    .single();

  // Only update if progress has increased or if no existing progress
  const currentProgress = existingProgress?.progress_percentage || 0;
  const newProgress = Math.round(progressPercentage);
  
  if (newProgress <= currentProgress) {
    console.log(`Skipping class instance progress update: ${newProgress}% <= ${currentProgress}%`);
    return;
  }

  // 4. Determine status based on progress
  let status = 'in_progress';
  if (newProgress === 0) {
    status = 'not_started';
  } else if (newProgress >= 100) {
    status = 'completed';
  }

  // 5. Upsert the class instance progress
  const { error: upsertError } = await supabase.rpc('upsert_progress' as any, {
    p_user_id: userId,
    p_item_type: 'class_instance',
    p_item_id: classInstanceId,
    p_status: status,
    p_progress_percentage: newProgress,
    p_last_position: null
  });

  if (upsertError) {
    console.error('Error updating class instance progress:', upsertError);
  } else {
    console.log(`Updated class instance progress: ${classInstanceId} -> ${newProgress}% (was ${currentProgress}%)`);
  }
} 