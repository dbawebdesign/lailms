import { NextResponse } from 'next/server';
import { createSupabaseServerClient } from '@/lib/supabase/server';
import { type User } from '@supabase/supabase-js';
import { Tables } from 'packages/types/db';
import { PROFILE_ROLE_FIELDS } from '@/lib/utils/roleUtils';

// Authorization helper
async function authorizeTeacher(supabase: ReturnType<typeof createSupabaseServerClient>, instanceId: string, currentUser: User): Promise<{ organisationId: string; errorResponse?: NextResponse }> {
  const { data: profile, error: profileError } = await supabase
    .from('profiles')
    .select(PROFILE_ROLE_FIELDS + ', organisation_id')
    .eq('user_id', currentUser.id)
    .single<Tables<"profiles">>();

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
    .single<Tables<"class_instances">>();

  if (instanceError || !classInstance) {
    console.error('Auth error: Class instance not found or not in user\'s organisation:', instanceError);
    return { organisationId: '', errorResponse: NextResponse.json({ error: 'Class instance not found or access denied.' }, { status: 404 }) };
  }
  
  return { organisationId: profile.organisation_id };
}

// DELETE Handler: Remove a student from a class instance
export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ instanceId: string; enrollmentId: string }> }
) {
  const supabase = createSupabaseServerClient();
  const { instanceId, enrollmentId } = await params;

  try {
    const { data: { user }, error: userError } = await supabase.auth.getUser();
    if (userError || !user) {
      return NextResponse.json({ error: 'Authentication required' }, { status: 401 });
    }

    const authCheck = await authorizeTeacher(supabase, instanceId, user);
    if (authCheck.errorResponse) return authCheck.errorResponse;

    // Verify the enrollment exists and belongs to the class instance
    const { data: enrollment, error: enrollmentError } = await supabase
      .from('rosters')
      .select('id, class_instance_id, profile_id')
      .eq('id', enrollmentId)
      .eq('class_instance_id', instanceId)
      .single<Tables<"rosters">>();

    if (enrollmentError || !enrollment) {
      console.error('Error fetching enrollment:', enrollmentError);
      return NextResponse.json({ error: 'Enrollment not found.' }, { status: 404 });
    }

    // Delete the enrollment
    const { error: deleteError } = await supabase
      .from('rosters')
      .delete()
      .eq('id', enrollmentId);

    if (deleteError) {
      console.error('Error deleting enrollment:', deleteError);
      return NextResponse.json({ error: 'Failed to remove student from class.', details: deleteError.message }, { status: 500 });
    }

    return NextResponse.json({ message: 'Student successfully removed from class.' });

  } catch (error: any) {
    console.error('Unexpected error in DELETE /enrollments:', error);
    return NextResponse.json({ error: 'An unexpected error occurred.', details: error.message }, { status: 500 });
  }
}