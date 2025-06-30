import { NextResponse } from 'next/server';
import { createSupabaseServerClient } from '@/lib/supabase/server';

export async function POST(request: Request) {
  const supabase = createSupabaseServerClient();

  try {
    // First, verify that the user is authenticated
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      return NextResponse.json({ error: 'Authentication required' }, { status: 401 });
    }

    // Parse request body
    const { enrollment_code } = await request.json();

    if (!enrollment_code || typeof enrollment_code !== 'string' || enrollment_code.trim() === '') {
      return NextResponse.json({ error: 'Enrollment code is required' }, { status: 400 });
    }

    // Call the enroll_student_in_class RPC function
    const { data, error } = await supabase
      .rpc('enroll_student_in_class', { 
        p_enrollment_code: enrollment_code 
      });

    if (error) {
      console.error('Error joining class:', error);
      return NextResponse.json({ error: error.message || 'An unknown error occurred' }, { status: 500 });
    }

    // The RPC function is defined to return an array, so we take the first element.
    const result = data?.[0];

    if (!result) {
        return NextResponse.json({ error: 'Failed to join class. Invalid response from server.' }, { status: 500 });
    }
    
    if (!result.success) {
      return NextResponse.json({ error: result.message }, { status: 400 });
    }

    return NextResponse.json({
      success: result.success,
      message: result.message,
      classInstanceId: result.class_instance_id,
    });

  } catch (err: any) {
    console.error('Unexpected error in enroll route:', err);
    return NextResponse.json({ error: err.message || 'An unexpected error occurred.' }, { status: 500 });
  }
} 