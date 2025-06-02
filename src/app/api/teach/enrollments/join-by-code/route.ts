import { NextResponse } from 'next/server';
import { createSupabaseServerClient } from '@/lib/supabase/server';

interface JoinByCodeRequest {
  enrollment_code: string;
}

// This structure should match the TABLE returned by the RPC function
interface JoinByCodeResponse {
  success: boolean;
  message: string;
  class_instance_id?: string; // uuid is string in JS/TS
  class_instance_name?: string;
  enrollment_id?: string; // uuid is string in JS/TS
}

export async function POST(request: Request) {
  const supabase = createSupabaseServerClient();
  let requestBody: JoinByCodeRequest;

  try {
    requestBody = await request.json();
  } catch (e) {
    return NextResponse.json({ error: 'Invalid request body. JSON expected.' }, { status: 400 });
  }

  const { enrollment_code } = requestBody;

  if (!enrollment_code || typeof enrollment_code !== 'string' || enrollment_code.trim() === '') {
    return NextResponse.json({ error: 'enrollment_code is required and must be a non-empty string.' }, { status: 400 });
  }

  try {
    const { data: { user }, error: userError } = await supabase.auth.getUser();
    if (userError || !user) {
      // This check is important, as the RPC relies on auth.uid()
      return NextResponse.json({ error: 'Authentication required.' }, { status: 401 });
    }

    // Get user profile
    const { data: profile, error: profileError } = await supabase
      .from('profiles')
      .select('user_id')
      .eq('user_id', user.id)
      .single();

    if (profileError || !profile) {
      return NextResponse.json({ error: 'User profile not found.' }, { status: 404 });
    }

    // Find the class instance by enrollment code
    const { data: classInstance, error: classError } = await supabase
      .from('class_instances')
      .select('id, name, base_class_id')
      .eq('enrollment_code', enrollment_code)
      .single();

    if (classError) {
      if (classError.code === 'PGRST116') { // Not found
        return NextResponse.json({
          success: false,
          message: 'Invalid enrollment code'
        }, { status: 404 });
      }
      throw classError;
    }

    // Check if user is already enrolled
    const { data: existingEnrollment, error: enrollmentCheckError } = await supabase
      .from('rosters')
      .select('id')
      .eq('class_instance_id', classInstance.id)
      .eq('profile_id', user.id)
      .single();

    if (enrollmentCheckError && enrollmentCheckError.code !== 'PGRST116') {
      throw enrollmentCheckError;
    }

    if (existingEnrollment) {
      return NextResponse.json({
        success: true,
        message: 'You are already enrolled in this class',
        class_instance_id: classInstance.id,
        class_instance_name: classInstance.name,
        enrollment_id: existingEnrollment.id
      }, { status: 200 });
    }

    // Create new enrollment
    const { data: newEnrollment, error: enrollmentError } = await supabase
      .from('rosters')
      .insert({
        class_instance_id: classInstance.id,
        profile_id: user.id,
        role: 'student' // Default role for joining by code
      })
      .select('id')
      .single();

    if (enrollmentError) {
      throw enrollmentError;
    }

    return NextResponse.json({
      success: true,
      message: 'Successfully enrolled in class',
      class_instance_id: classInstance.id,
      class_instance_name: classInstance.name,
      enrollment_id: newEnrollment.id
    }, { status: 201 });

  } catch (error: any) {
    console.error('Unexpected error in POST /enrollments/join-by-code:', error);
    return NextResponse.json({ error: 'An unexpected error occurred.', details: error.message }, { status: 500 });
  }
} 