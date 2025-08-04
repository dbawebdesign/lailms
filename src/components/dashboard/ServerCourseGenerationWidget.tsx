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

  return (
    <ProductionCourseGenerationWidget
      userId={userId}
      className={className}
      initialJobs={initialJobs || []}
    />
  );
}