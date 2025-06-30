import { createSupabaseServerClient } from '@/lib/supabase/server';

/**
 * Calculates the overall progress for a base class.
 * This should be called on the server.
 * @param baseClassId - The ID of the base class.
 * @param userId - The ID of the user.
 * @returns The overall progress percentage (0-100).
 */
export async function calculateOverallProgress(baseClassId: string, userId: string): Promise<number> {
  const supabase = createSupabaseServerClient();

  type PathWithItems = {
    lessons: { id: string }[],
    assessments: { id: string }[]
  }

  // 1. Get all lessons and assessments for the class
  const { data: paths, error: pathsError } = await supabase
    .from('paths')
    .select('lessons(id), assessments(id)')
    .eq('base_class_id', baseClassId)
    .returns<PathWithItems[]>();

  if (pathsError || !paths) {
    console.error('Error fetching paths for progress:', pathsError);
    return 0;
  }

  const lessonIds = paths.flatMap(p => p.lessons.map(l => l.id));
  const assessmentIds = paths.flatMap(p => p.assessments.map(a => a.id));
  const totalItems = lessonIds.length + assessmentIds.length;

  if (totalItems === 0) return 0;

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
    
  const totalCompleted = (completedLessons || 0) + (completedAssessments || 0);

  return (totalCompleted / totalItems) * 100;
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

  // 3. Determine status based on progress
  let status = 'in_progress';
  if (progressPercentage === 0) {
    status = 'not_started';
  } else if (progressPercentage >= 100) {
    status = 'completed';
  }

  // 4. Upsert the class instance progress
  const { error: upsertError } = await supabase.rpc('upsert_progress' as any, {
    p_user_id: userId,
    p_item_type: 'class_instance',
    p_item_id: classInstanceId,
    p_status: status,
    p_progress_percentage: Math.round(progressPercentage),
    p_last_position: null
  });

  if (upsertError) {
    console.error('Error updating class instance progress:', upsertError);
  } else {
    console.log(`Updated class instance progress: ${classInstanceId} -> ${Math.round(progressPercentage)}%`);
  }
} 