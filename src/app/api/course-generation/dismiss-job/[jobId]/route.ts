import { NextRequest, NextResponse } from 'next/server';
import { createSupabaseServerClient } from '@/lib/supabase/server';

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ jobId: string }> }
) {
  try {
    const { jobId } = await params;
    const supabase = createSupabaseServerClient();
    
    // Get current user
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Update job to mark as cleared (dismissed from view)
    const { error } = await supabase
      .from('course_generation_jobs')
      .update({ is_cleared: true })
      .eq('id', jobId)
      .eq('user_id', user.id);

    if (error) {
      console.error('Error dismissing job:', error);
      return NextResponse.json({ error: 'Failed to dismiss job' }, { status: 500 });
    }

    return NextResponse.json({ 
      success: true, 
      message: 'Job dismissed successfully' 
    });

  } catch (error) {
    console.error('Error in dismiss-job API:', error);
    return NextResponse.json({ 
      error: 'Internal server error' 
    }, { status: 500 });
  }
}