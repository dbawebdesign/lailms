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
  // This is a simplified example. A real implementation might need a dedicated progress table.
  // Assuming a 'student_lesson_progress' and 'student_assessment_progress' table
  const { count: completedLessons, error: lessonProgressError } = await supabase
    .from('student_lesson_progress')
    .select('*', { count: 'exact', head: true })
    .eq('user_id', userId)
    .in('lesson_id', lessonIds)
    .eq('status', 'completed');

  const { count: completedAssessments, error: assessmentProgressError } = await supabase
    .from('student_assessment_progress')
    .select('*', { count: 'exact', head: true })
    .eq('user_id', userId)
    .in('assessment_id', assessmentIds)
    .eq('status', 'passed'); // Or 'completed', depending on requirements

  if (lessonProgressError || assessmentProgressError) {
    console.error('Error fetching progress:', lessonProgressError, assessmentProgressError);
    return 0;
  }
    
  const totalCompleted = (completedLessons || 0) + (completedAssessments || 0);

  return (totalCompleted / totalItems) * 100;
} 