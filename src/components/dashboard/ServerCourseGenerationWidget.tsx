import { createSupabaseServerClient } from '@/lib/supabase/server';
import ProductionCourseGenerationWidget from './ProductionCourseGenerationWidget';

interface ServerCourseGenerationWidgetProps {
  userId: string;
  className?: string;
}

/**
 * Server component that fetches initial data and passes it to the production widget
 * This prevents the initial loading state and improves perceived performance
 */
export default async function ServerCourseGenerationWidget({ 
  userId, 
  className 
}: ServerCourseGenerationWidgetProps) {
  const supabase = createSupabaseServerClient();

  // Fetch initial jobs on the server to prevent loading state
  const { data: initialJobs, error } = await supabase
    .from('course_generation_jobs')
    .select('*')
    .eq('user_id', userId)
    .eq('is_cleared', false)
    .order('created_at', { ascending: false });

  if (error) {
    console.error('ServerCourseGenerationWidget: Failed to fetch initial jobs:', error);
  }

  // Transform database null values to undefined to match CourseGenerationJob interface
  const transformedJobs = initialJobs?.map(job => ({
    ...job,
    base_class_id: job.base_class_id ?? undefined,
    job_data: job.job_data ?? undefined,
    result_data: job.result_data ?? undefined,
    error_message: job.error_message ?? undefined,
    started_at: job.started_at ?? undefined,
    completed_at: job.completed_at ?? undefined,
    confetti_shown: job.confetti_shown ?? undefined,
    generation_config: job.generation_config ?? undefined,
    performance_metrics: job.performance_metrics ?? undefined,
    retry_configuration: job.retry_configuration ?? undefined,
    user_actions: job.user_actions ?? undefined,
    actual_completion_time: job.actual_completion_time ?? undefined,
    estimated_completion_time: job.estimated_completion_time ?? undefined,
    priority: job.priority ?? undefined,
    tags: job.tags ?? undefined,
    metadata: job.metadata ?? undefined,
  })) || [];

  return (
    <ProductionCourseGenerationWidget
      userId={userId}
      className={className}
      initialJobs={transformedJobs}
    />
  );
}