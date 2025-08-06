import { createSupabaseServerClient } from '@/lib/supabase/server';
import PremiumProgressWidget from './PremiumProgressWidget';

interface ServerPremiumProgressWidgetProps {
  userId: string;
  className?: string;
}

/**
 * Server component wrapper for the premium progress widget
 * Fetches initial data server-side for better performance
 */
export default async function ServerPremiumProgressWidget({ 
  userId, 
  className 
}: ServerPremiumProgressWidgetProps) {
  const supabase = createSupabaseServerClient();

  // Fetch active jobs
  const { data: jobs } = await supabase
    .from('course_generation_jobs')
    .select(`
      id,
      status,
      progress_percentage,
      base_class_id,
      job_data,
      error_message,
      created_at,
      updated_at,
      total_tasks,
      completed_tasks,
      failed_tasks,
      base_classes (
        name
      )
    `)
    .eq('user_id', userId)
    .eq('is_cleared', false)
    .in('status', ['queued', 'processing', 'completed', 'failed'])
    .order('created_at', { ascending: false })
    .limit(5);

  // Only show widget if there are active jobs
  if (!jobs || jobs.length === 0) {
    return null;
  }

  return <PremiumProgressWidget userId={userId} className={className} />;
}