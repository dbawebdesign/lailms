import { NextResponse } from 'next/server';
import { createSupabaseServerClient } from '@/lib/supabase/server';
import { type User } from '@supabase/supabase-js';
import { Tables } from 'packages/types/db';

import { PROFILE_ROLE_FIELDS } from '@/lib/utils/roleUtils';
// Authorization helper (can be shared or adapted)
async function authorizeTeacherForEnrollmentAction(
    supabase: ReturnType<typeof createSupabaseServerClient>, 
    instanceId: string, 
    enrollmentId: string, 
    currentUser: User
): Promise<{ enrollment?: any; errorResponse?: NextResponse }> {
    const { data: profile, error: profileError } = await supabase
        .from('profiles')
        .select(PROFILE_ROLE_FIELDS + ', organisation_id')
        .eq('user_id', currentUser.id)
        .single<Tables<"profiles">>();

    if (profileError || !profile) {
        return { errorResponse: NextResponse.json({ error: 'User not part of an organisation or not authorized.' }, { status: 403 }) };
    }

    if (!profile.organisation_id) {
        return { errorResponse: NextResponse.json({ error: 'User not associated with an organisation.' }, { status: 403 }) };
    }

    if (!['admin', 'teacher'].includes(profile.role)) {
        return { errorResponse: NextResponse.json({ error: 'User does not have sufficient privileges.' }, { status: 403 }) };
    }

    // Check if the enrollment exists, belongs to the instance, and the instance belongs to the teacher's org
    // We need to join with class_instances to get the organisation_id
    const { data: enrollment, error: enrollmentError } = await supabase
        .from('rosters')
        .select(`
            id, 
            class_instance_id, 
            class_instances!inner(
                id,
                organisation_id
            )
        `)
        .eq('id', enrollmentId)
        .eq('class_instance_id', instanceId) // Ensure it's for the correct instance
        .eq('class_instances.organisation_id', profile.organisation_id) // Ensure it's within the teacher's org
        .single<Tables<"rosters">>();

    if (enrollmentError || !enrollment) {
        console.error('Auth error: Enrollment not found, not in specified instance, or not in user\'s organisation:', enrollmentError);
        return { errorResponse: NextResponse.json({ error: 'Enrollment record not found or access denied.' }, { status: 404 }) };
    }
    
    return { enrollment };
}

// DELETE Handler: Unenroll a student (deletes an enrollment record)
export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ instanceId: string; enrollmentId: string }> }
) {
  const supabase = createSupabaseServerClient();
  const { instanceId, enrollmentId } = await params;

  try {
    const { data: { user }, error: userError } = await supabase.auth.getUser();
    if (userError || !user) {
      return NextResponse.json({ error: 'Authentication required.' }, { status: 401 });
    }

    const authCheck = await authorizeTeacherForEnrollmentAction(supabase, instanceId, enrollmentId, user);
    if (authCheck.errorResponse) {
      return authCheck.errorResponse;
    }
    // authCheck.enrollment contains the validated enrollment record

    const { error: deleteError, count } = await supabase
      .from('rosters')
      .delete()
      .eq('id', enrollmentId);
      // RLS also applies, but direct check via authorizeTeacherForEnrollmentAction is good practice

    if (deleteError) {
      console.error('Error deleting enrollment:', deleteError);
      return NextResponse.json({ error: 'Failed to delete enrollment.', details: deleteError.message }, { status: 500 });
    }

    if (count === 0) {
      // This case should ideally be caught by authorizeTeacherForEnrollmentAction if enrollment wasn't found
      return NextResponse.json({ error: 'Enrollment record not found or already deleted.' }, { status: 404 });
    }

    return NextResponse.json({ message: 'Enrollment deleted successfully.' }, { status: 200 }); // Or 204 No Content

  } catch (error: any) {
    console.error('Unexpected error in DELETE /enrollments/[enrollmentId]:', error);
    return NextResponse.json({ error: 'An unexpected error occurred.', details: error.message }, { status: 500 });
  }
} 