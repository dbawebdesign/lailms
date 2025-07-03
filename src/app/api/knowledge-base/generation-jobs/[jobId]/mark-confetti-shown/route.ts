import { NextRequest, NextResponse } from 'next/server';
import { createSupabaseServerClient } from '@/lib/supabase/server';

export async function POST(
  request: NextRequest,
  { params }: { params: { jobId: string } }
) {
  try {
    const supabase = createSupabaseServerClient();
    
    // Check authentication
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { jobId } = params;

    // Update the job to mark confetti as shown
    const { error } = await supabase
      .from('course_generation_jobs')
      .update({ confetti_shown: true } as any)
      .eq('id', jobId)
      .eq('user_id', user.id); // Ensure user can only update their own jobs

    if (error) {
      console.error('Error marking confetti as shown:', error);
      return NextResponse.json({ error: 'Failed to mark confetti as shown' }, { status: 500 });
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error in mark-confetti-shown endpoint:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
} 