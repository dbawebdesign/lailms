import { NextRequest, NextResponse } from 'next/server';
import { createSupabaseServerClient } from '@/lib/supabase/server';

export async function GET(req: NextRequest) {
  try {
    const supabase = createSupabaseServerClient();
    
    // Get current user
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Get current user's profile
    const { data: profile, error: profileError } = await supabase
      .from('profiles')
      .select('user_id, family_id, organisation_id, is_sub_account, is_primary_parent')
      .eq('user_id', user.id)
      .single();

    if (profileError || !profile) {
      return NextResponse.json({ error: 'Profile not found' }, { status: 404 });
    }

    // Check if user is a sub-account
    if ((profile as any).is_sub_account) {
      return NextResponse.json({ error: 'Sub-accounts cannot view student list' }, { status: 403 });
    }

    // Get all students linked to this parent
    let students: any[] = [];

    // First, get students by parent_account_id
    const { data: directStudents } = await supabase
      .from('profiles')
      .select('user_id, first_name, last_name, grade_level, is_sub_account, created_at')
      .eq('parent_account_id', user.id)
      .order('first_name');

    if (directStudents) {
      students = [...directStudents];
    }

    // Also get students by family_id
    if ((profile as any).family_id) {
      const { data: familyStudents } = await supabase
        .from('profiles')
        .select('user_id, first_name, last_name, grade_level, is_sub_account, created_at')
        .eq('family_id', (profile as any).family_id)
        .eq('is_sub_account', true)
        .neq('user_id', user.id)
        .order('first_name');

      if (familyStudents) {
        // Add students not already in the list
        familyStudents.forEach((student: any) => {
          if (!students.find(s => s.user_id === student.user_id)) {
            students.push(student);
          }
        });
      }
    }

    // Also check family_students table
    if ((profile as any).family_id) {
      const { data: linkedStudents } = await supabase
        .from('family_students')
        .select(`
          student_id,
          profiles!family_students_student_id_fkey (
            user_id,
            first_name,
            last_name,
            grade_level,
            is_sub_account,
            created_at
          )
        `)
        .eq('family_id', (profile as any).family_id);

      if (linkedStudents) {
        linkedStudents.forEach((ls: any) => {
          if (ls.profiles && !students.find(s => s.user_id === ls.student_id)) {
            students.push(ls.profiles);
          }
        });
      }
    }

    // Format the response
    const formattedStudents = students.map((student: any) => ({
      userId: student.user_id,
      firstName: student.first_name,
      lastName: student.last_name,
      gradeLevel: student.grade_level,
      isSubAccount: student.is_sub_account,
      createdAt: student.created_at,
    }));

    return NextResponse.json({
      students: formattedStudents,
      total: formattedStudents.length,
    });
  } catch (error: any) {
    console.error('Error fetching students:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to fetch students' },
      { status: 500 }
    );
  }
}
