import { NextResponse } from 'next/server';
import { createSupabaseServerClient } from '@/lib/supabase/server';
import { type User } from '@supabase/supabase-js';

// Define expected types for request/response payloads
interface EnrollmentRequest {
  student_som_id: string;
  role_in_class?: 'student' | 'observer'; // Matches enrollment_role_in_class_enum
}

interface EnrolledStudent {
  enrollment_id: string;
  student_som_id: string;
  student_user_id: string; // from student_organisation_memberships
  student_full_name?: string; // from profiles
  student_email?: string; // from auth.users or profiles
  role_in_class: 'student' | 'observer';
  status: 'active' | 'withdrawn' | 'pending_approval' | 'completed'; // Matches enrollment_status_enum
  enrolled_at: string;
}

async function authorizeTeacher(supabase: any, instanceId: string, currentUser: User): Promise<{ organisationId: string; errorResponse?: NextResponse }> {
  const { data: member, error: memberError } = await supabase
    .from('members')
    .select('organisation_id, role')
    .eq('user_id', currentUser.id)
    .single();

  if (memberError || !member) {
    console.error('Auth error: User is not a member of any organisation or error fetching member:', memberError);
    return { organisationId: '', errorResponse: NextResponse.json({ error: 'User not part of an organisation or not authorized.' }, { status: 403 }) };
  }

  if (!['admin', 'teacher'].includes(member.role)) {
    console.warn('Auth warning: User is not an admin or teacher.', { userId: currentUser.id, role: member.role });
    return { organisationId: '', errorResponse: NextResponse.json({ error: 'User does not have sufficient privileges (admin/teacher required).' }, { status: 403 }) };
  }

  const { data: classInstance, error: instanceError } = await supabase
    .from('class_instances')
    .select('id, organisation_id, settings')
    .eq('id', instanceId)
    .eq('organisation_id', member.organisation_id) // Ensure instance is in teacher's org
    .single();

  if (instanceError || !classInstance) {
    console.error('Auth error: Class instance not found or not in user\'s organisation:', instanceError);
    return { organisationId: '', errorResponse: NextResponse.json({ error: 'Class instance not found or access denied.' }, { status: 404 }) };
  }
  
  return { organisationId: member.organisation_id };
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
    // const { organisationId } = authCheck;

    const { data: enrollments, error: enrollmentsError } = await supabase
      .from('student_enrollments')
      .select(`
        id,
        student_som_id,
        role_in_class,
        status,
        enrolled_at,
        student_organisation_memberships (
          student_user_id,
          status,
          profiles (full_name, email)
        )
      `)
      .eq('class_instance_id', instanceId);
      // RLS handles organisation check implicitly for teachers

    if (enrollmentsError) {
      console.error('Error fetching enrollments:', enrollmentsError);
      return NextResponse.json({ error: 'Failed to fetch enrollments for the class instance.', details: enrollmentsError.message }, { status: 500 });
    }

    const responsePayload: EnrolledStudent[] = enrollments.map((enroll: any) => ({
      enrollment_id: enroll.id,
      student_som_id: enroll.student_som_id,
      student_user_id: enroll.student_organisation_memberships?.student_user_id,
      student_full_name: enroll.student_organisation_memberships?.profiles?.full_name,
      student_email: enroll.student_organisation_memberships?.profiles?.email, // Assuming email is on profiles
      role_in_class: enroll.role_in_class,
      status: enroll.status,
      enrolled_at: enroll.enrolled_at,
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

  const { student_som_id, role_in_class = 'student' } = requestBody;

  if (!student_som_id) {
    return NextResponse.json({ error: 'student_som_id is required.' }, { status: 400 });
  }

  try {
    const { data: { user }, error: userError } = await supabase.auth.getUser();
    if (userError || !user) {
      return NextResponse.json({ error: 'Authentication required.' }, { status: 401 });
    }

    const authCheck = await authorizeTeacher(supabase, instanceId, user);
    if (authCheck.errorResponse) return authCheck.errorResponse;
    const { organisationId } = authCheck; // Organisation ID of the teacher and the instance

    // Fetch class instance details including capacity
    const { data: classInstance, error: instanceDetailsError } = await supabase
      .from('class_instances')
      .select('id, settings, organisation_id')
      .eq('id', instanceId)
      .eq('organisation_id', organisationId)
      .single();

    if (instanceDetailsError || !classInstance) {
        return NextResponse.json({ error: 'Class instance not found or not accessible.' }, { status: 404 });
    }

    // 1. Validate student_organisation_membership (SOM)
    const { data: somRecord, error: somError } = await supabase
      .from('student_organisation_memberships')
      .select('id, student_user_id, organisation_id, status')
      .eq('id', student_som_id)
      .single();

    if (somError || !somRecord) {
      console.error('Error fetching student_organisation_membership record:', somError);
      return NextResponse.json({ error: 'Student membership record not found.' }, { status: 404 });
    }
    if (somRecord.organisation_id !== organisationId) {
      return NextResponse.json({ error: 'Student does not belong to the same organisation as the class instance.' }, { status: 403 });
    }
    if (somRecord.status !== 'active') {
      return NextResponse.json({ error: `Student is not active in the organisation (status: ${somRecord.status}).` }, { status: 400 });
    }

    // 2. Check instance capacity (if capacity is set)
    const capacity = classInstance.settings?.capacity;
    if (typeof capacity === 'number' && capacity > 0) {
      const { count: currentEnrollmentCount, error: countError } = await supabase
        .from('student_enrollments')
        .select('id', { count: 'exact', head: true })
        .eq('class_instance_id', instanceId)
        .eq('status', 'active'); // Only count active enrollments against capacity

      if (countError) {
        console.error('Error counting current enrollments:', countError);
        // Decide if this is a fatal error or if we proceed cautiously
      }
      if (currentEnrollmentCount !== null && currentEnrollmentCount >= capacity) {
        return NextResponse.json({ error: 'Class instance has reached its capacity.' }, { status: 409 }); // 409 Conflict
      }
    }
    
    // 3. Create enrollment record
    const enrollmentData = {
      class_instance_id: instanceId,
      student_som_id: student_som_id,
      organisation_id: organisationId, // Crucial for RLS and consistency
      role_in_class: role_in_class,
      status: 'active', // Default, or could be 'pending_approval' depending on workflow
    };

    const { data: newEnrollment, error: insertError } = await supabase
      .from('student_enrollments')
      .insert(enrollmentData)
      .select()
      .single();

    if (insertError) {
      console.error('Error creating enrollment:', insertError);
      if (insertError.code === '23505') { // Unique constraint violation (already enrolled)
        return NextResponse.json({ error: 'Student is already enrolled in this class instance.' }, { status: 409 });
      }
      return NextResponse.json({ error: 'Failed to enroll student.', details: insertError.message }, { status: 500 });
    }

    return NextResponse.json(newEnrollment, { status: 201 });

  } catch (error: any) {
    console.error('Unexpected error in POST /enrollments:', error);
    return NextResponse.json({ error: 'An unexpected error occurred.', details: error.message }, { status: 500 });
  }
} 