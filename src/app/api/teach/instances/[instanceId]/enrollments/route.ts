import { NextResponse } from 'next/server';
import { createSupabaseServerClient } from '@/lib/supabase/server';
import { type User } from '@supabase/supabase-js';

// Define expected types for request/response payloads
interface EnrollmentRequest {
  profile_id: string; // Changed from student_som_id to profile_id
  role?: 'student' | 'teacher' | 'admin'; // Matches user_role enum
}

interface EnrolledStudent {
  enrollment_id: string;
  profile_id: string;
  student_full_name?: string;
  student_email?: string;
  role: 'student' | 'teacher' | 'admin';
  joined_at: string;
}

// Authorization helper
async function authorizeTeacher(supabase: any, instanceId: string, currentUser: User): Promise<{ organisationId: string; errorResponse?: NextResponse }> {
  const { data: profile, error: profileError } = await supabase
    .from('profiles')
    .select('organisation_id, role')
    .eq('user_id', currentUser.id)
    .single();

  if (profileError || !profile) {
    console.error('Auth error: User profile not found:', profileError);
    return { organisationId: '', errorResponse: NextResponse.json({ error: 'User not part of an organisation or not authorized.' }, { status: 403 }) };
  }

  if (!profile.organisation_id) {
    return { organisationId: '', errorResponse: NextResponse.json({ error: 'User not associated with an organisation.' }, { status: 403 }) };
  }

  if (!['admin', 'teacher'].includes(profile.role)) {
    console.warn('Auth warning: User is not an admin or teacher.', { userId: currentUser.id, role: profile.role });
    return { organisationId: '', errorResponse: NextResponse.json({ error: 'User does not have sufficient privileges (admin/teacher required).' }, { status: 403 }) };
  }

  // Check if the class instance belongs to the teacher's organisation
  const { data: classInstance, error: instanceError } = await supabase
    .from('class_instances')
    .select('id, base_class_id, base_classes!inner(organisation_id)')
    .eq('id', instanceId)
    .eq('base_classes.organisation_id', profile.organisation_id)
    .single();

  if (instanceError || !classInstance) {
    console.error('Auth error: Class instance not found or not in user\'s organisation:', instanceError);
    return { organisationId: '', errorResponse: NextResponse.json({ error: 'Class instance not found or access denied.' }, { status: 404 }) };
  }
  
  return { organisationId: profile.organisation_id };
}

// GET Handler: List enrolled students for a class instance
export async function GET(
  request: Request,
  { params }: { params: Promise<{ instanceId: string }> }
) {
  const supabase = createSupabaseServerClient();
  const { instanceId } = await params;

  try {
    const { data: { user }, error: userError } = await supabase.auth.getUser();
    if (userError || !user) {
      return NextResponse.json({ error: 'Authentication required' }, { status: 401 });
    }

    const authCheck = await authorizeTeacher(supabase, instanceId, user);
    if (authCheck.errorResponse) return authCheck.errorResponse;

    const { data: enrollments, error: enrollmentsError } = await supabase
      .from('rosters')
      .select(`
        id,
        profile_id,
        role,
        joined_at,
        profiles!inner(
          first_name,
          last_name,
          user_id
        )
      `)
      .eq('class_instance_id', instanceId);

    if (enrollmentsError) {
      console.error('Error fetching enrollments:', enrollmentsError);
      return NextResponse.json({ error: 'Failed to fetch enrollments for the class instance.', details: enrollmentsError.message }, { status: 500 });
    }

    const responsePayload: EnrolledStudent[] = enrollments.map((enroll: any) => ({
      enrollment_id: enroll.id,
      profile_id: enroll.profile_id,
      student_full_name: `${enroll.profiles?.first_name || ''} ${enroll.profiles?.last_name || ''}`.trim(),
      role: enroll.role,
      joined_at: enroll.joined_at,
    }));

    return NextResponse.json(responsePayload);

  } catch (error: any) {
    console.error('Unexpected error in GET /enrollments:', error);
    return NextResponse.json({ error: 'An unexpected error occurred.', details: error.message }, { status: 500 });
  }
}

// POST Handler: Enroll a student into a class instance
export async function POST(
  request: Request,
  { params }: { params: Promise<{ instanceId: string }> }
) {
  const supabase = createSupabaseServerClient();
  const { instanceId } = await params;
  let requestBody: EnrollmentRequest;

  try {
    requestBody = await request.json();
  } catch (e) {
    return NextResponse.json({ error: 'Invalid request body.' }, { status: 400 });
  }

  const { profile_id, role = 'student' } = requestBody;

  if (!profile_id) {
    return NextResponse.json({ error: 'profile_id is required.' }, { status: 400 });
  }

  try {
    const { data: { user }, error: userError } = await supabase.auth.getUser();
    if (userError || !user) {
      return NextResponse.json({ error: 'Authentication required.' }, { status: 401 });
    }

    const authCheck = await authorizeTeacher(supabase, instanceId, user);
    if (authCheck.errorResponse) return authCheck.errorResponse;
    const { organisationId } = authCheck;

    // Validate that the profile exists and belongs to the same organisation
    const { data: profileRecord, error: profileError } = await supabase
      .from('profiles')
      .select('user_id, organisation_id')
      .eq('user_id', profile_id)
      .single();

    if (profileError || !profileRecord) {
      console.error('Error fetching profile record:', profileError);
      return NextResponse.json({ error: 'Profile not found.' }, { status: 404 });
    }

    if (profileRecord.organisation_id !== organisationId) {
      return NextResponse.json({ error: 'Profile does not belong to the same organisation as the class instance.' }, { status: 403 });
    }

    // Check if already enrolled
    const { data: existingEnrollment, error: existingError } = await supabase
      .from('rosters')
      .select('id')
      .eq('class_instance_id', instanceId)
      .eq('profile_id', profile_id)
      .single();

    if (existingError && existingError.code !== 'PGRST116') {
      throw existingError;
    }

    if (existingEnrollment) {
      return NextResponse.json({ error: 'Profile is already enrolled in this class instance.' }, { status: 409 });
    }
    
    // Create enrollment record
    const enrollmentData = {
      class_instance_id: instanceId,
      profile_id: profile_id,
      role: role,
    };

    const { data: newEnrollment, error: insertError } = await supabase
      .from('rosters')
      .insert(enrollmentData)
      .select()
      .single();

    if (insertError) {
      console.error('Error creating enrollment:', insertError);
      return NextResponse.json({ error: 'Failed to enroll profile.', details: insertError.message }, { status: 500 });
    }

    return NextResponse.json(newEnrollment, { status: 201 });

  } catch (error: any) {
    console.error('Unexpected error in POST /enrollments:', error);
    return NextResponse.json({ error: 'An unexpected error occurred.', details: error.message }, { status: 500 });
  }
} 