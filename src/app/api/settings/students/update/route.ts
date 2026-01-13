import { NextRequest, NextResponse } from 'next/server';
import { createSupabaseServerClient } from '@/lib/supabase/server';

export async function POST(req: NextRequest) {
  try {
    const supabase = createSupabaseServerClient();
    
    // Get current user
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await req.json();
    const { studentId, firstName, lastName, gradeLevel } = body;

    if (!studentId) {
      return NextResponse.json({ error: 'Student ID is required' }, { status: 400 });
    }

    // Get current user's profile to verify they're a parent/teacher
    const { data: parentProfile, error: parentError } = await supabase
      .from('profiles')
      .select('user_id, family_id, is_primary_parent, is_sub_account, organisation_id')
      .eq('user_id', user.id)
      .single();

    if (parentError || !parentProfile) {
      return NextResponse.json({ error: 'Profile not found' }, { status: 404 });
    }

    // Check if user is a sub-account (they can't manage students)
    if (parentProfile.is_sub_account) {
      return NextResponse.json({ error: 'Sub-accounts cannot manage student settings' }, { status: 403 });
    }

    // Get the student profile to verify relationship
    const { data: studentProfile, error: studentError } = await supabase
      .from('profiles')
      .select('user_id, family_id, parent_account_id, is_sub_account, organisation_id')
      .eq('user_id', studentId)
      .single();

    if (studentError || !studentProfile) {
      return NextResponse.json({ error: 'Student not found' }, { status: 404 });
    }

    // Verify the parent has permission to edit this student
    const isAuthorized = 
      // Student's parent_account_id matches current user
      studentProfile.parent_account_id === user.id ||
      // Same family_id
      (parentProfile.family_id && studentProfile.family_id === parentProfile.family_id) ||
      // Same organisation and student is a sub-account
      (parentProfile.organisation_id && studentProfile.organisation_id === parentProfile.organisation_id && studentProfile.is_sub_account);

    if (!isAuthorized) {
      return NextResponse.json({ error: 'You do not have permission to edit this student' }, { status: 403 });
    }

    // Build update object
    const updateData: Record<string, any> = {
      updated_at: new Date().toISOString(),
    };

    // Validate and add first name
    if (firstName !== undefined) {
      if (typeof firstName !== 'string') {
        return NextResponse.json({ error: 'First name must be a string' }, { status: 400 });
      }
      const trimmedFirstName = firstName.trim();
      if (trimmedFirstName.length > 50) {
        return NextResponse.json({ error: 'First name must be 50 characters or less' }, { status: 400 });
      }
      if (trimmedFirstName.length === 0) {
        return NextResponse.json({ error: 'First name is required' }, { status: 400 });
      }
      updateData.first_name = trimmedFirstName;
    }

    // Validate and add last name
    if (lastName !== undefined) {
      if (typeof lastName !== 'string') {
        return NextResponse.json({ error: 'Last name must be a string' }, { status: 400 });
      }
      const trimmedLastName = lastName.trim();
      if (trimmedLastName.length > 50) {
        return NextResponse.json({ error: 'Last name must be 50 characters or less' }, { status: 400 });
      }
      updateData.last_name = trimmedLastName || null;
    }

    // Validate and add grade level
    if (gradeLevel !== undefined) {
      if (gradeLevel !== null && typeof gradeLevel !== 'string') {
        return NextResponse.json({ error: 'Grade level must be a string' }, { status: 400 });
      }
      if (gradeLevel) {
        const trimmedGradeLevel = gradeLevel.trim();
        if (trimmedGradeLevel.length > 20) {
          return NextResponse.json({ error: 'Grade level must be 20 characters or less' }, { status: 400 });
        }
        updateData.grade_level = trimmedGradeLevel;
      } else {
        updateData.grade_level = null;
      }
    }

    // Update student profile
    const { data: updatedStudent, error: updateError } = await supabase
      .from('profiles')
      .update(updateData)
      .eq('user_id', studentId)
      .select('user_id, first_name, last_name, grade_level')
      .single();

    if (updateError) {
      console.error('Error updating student profile:', updateError);
      return NextResponse.json({ error: 'Failed to update student profile' }, { status: 500 });
    }

    return NextResponse.json({
      success: true,
      student: {
        userId: updatedStudent.user_id,
        firstName: updatedStudent.first_name,
        lastName: updatedStudent.last_name,
        gradeLevel: updatedStudent.grade_level,
      },
    });
  } catch (error: any) {
    console.error('Error updating student:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to update student' },
      { status: 500 }
    );
  }
}
