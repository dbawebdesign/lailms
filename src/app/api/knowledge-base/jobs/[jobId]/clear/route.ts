import { NextRequest, NextResponse } from 'next/server';
import { createSupabaseServerClient } from '@/lib/supabase/server';

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ jobId: string }> }
) {
  try {
    const { jobId } = await params;

    if (!jobId) {
      return NextResponse.json({ error: 'Job ID is required' }, { status: 400 });
    }

    const supabase = createSupabaseServerClient();

    // Get the current user
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Update the job to mark it as cleared
    const { error: updateError } = await supabase
      .from('course_generation_jobs')
      .update({ 
        is_cleared: true,
        updated_at: new Date().toISOString()
      })
      .eq('id', jobId)
      .eq('user_id', user.id); // Ensure user can only clear their own jobs

    if (updateError) {
      console.error('Failed to clear job:', updateError);
      return NextResponse.json({ 
        error: 'Failed to clear job',
        details: updateError.message 
      }, { status: 500 });
    }

    return NextResponse.json({ 
      success: true,
      message: 'Job cleared successfully',
      jobId 
    });

  } catch (error) {
    console.error('Error clearing job:', error);
    return NextResponse.json({ 
      error: 'Internal server error',
      details: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 });
  }
}