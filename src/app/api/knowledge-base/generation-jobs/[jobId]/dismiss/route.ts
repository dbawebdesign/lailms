import { NextRequest, NextResponse } from 'next/server';
import { createSupabaseServerClient } from '@/lib/supabase/server';

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ jobId: string }> }
) {
  try {
    const { jobId } = await params;
    const supabase = createSupabaseServerClient();
    
    // Check authentication
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Verify user owns this job and mark it as cleared
    const { error: updateError } = await supabase
      .from('course_generation_jobs')
      .update({ 
        is_cleared: true,
        updated_at: new Date().toISOString()
      })
      .eq('id', jobId)
      .eq('user_id', user.id);

    if (updateError) {
      console.error('Error dismissing job:', updateError);
      return NextResponse.json(
        { error: 'Failed to dismiss job' }, 
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      message: 'Job dismissed successfully'
    });

  } catch (error) {
    console.error('Dismiss job API error:', error);
    return NextResponse.json(
      { error: 'Failed to dismiss job' }, 
      { status: 500 }
    );
  }
} 