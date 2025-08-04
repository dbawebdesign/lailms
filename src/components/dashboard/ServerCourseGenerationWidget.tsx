import { createSupabaseServerClient } from '@/lib/supabase/server';
import RealtimeCourseGenerationWidget from './RealtimeCourseGenerationWidget';

interface ServerCourseGenerationWidgetProps {
  userId: string;
  className?: string;
}

/**
 * Server component that fetches initial course generation jobs
 * Following Supabase best practices for combining server and client components
 */
export default async function ServerCourseGenerationWidget({ 
  userId, 
  className 
}: ServerCourseGenerationWidgetProps) {
  const supabase = createSupabaseServerClient();

  // Fetch initial jobs on the server
  const { data: initialJobs, error } = await supabase
    .from('course_generation_jobs')
    .select('*')
    .eq('user_id', userId)
    .eq('is_cleared', false)
    .order('created_at', { ascending: false });

  if (error) {
    console.error('ServerCourseGenerationWidget: Failed to fetch initial jobs:', error);
  }

  // Pass the server-fetched data to the client component
  return (
    <RealtimeCourseGenerationWidget
      userId={userId}
      initialJobs={initialJobs || []}
      className={className}
    />
  );
}