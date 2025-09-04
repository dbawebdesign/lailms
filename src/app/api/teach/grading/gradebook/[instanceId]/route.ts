import { NextRequest, NextResponse } from 'next/server';
import { createSupabaseServerClient } from '@/utils/supabase/server';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ instanceId: string }> } // Correctly typed as a Promise
) {
  try {
    const supabase = await createSupabaseServerClient();
    const { instanceId } = await params; // Awaiting the params promise

    // Get current user
    const { data: { user }, error: userError } = await supabase.auth.getUser();
    if (userError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Verify user has access to this class instance
    const { data: classInstance, error: classError } = await supabase
      .from('class_instances')
      .select(`
        id,
        name,
        base_classes!inner(
          id,
          user_id
        )
      `)
      .eq('id', instanceId)
      .single();

    if (classError || !classInstance) {
      return NextResponse.json({ error: 'Class not found or access denied' }, { status: 404 });
    }

    // Get students enrolled in this class
    const { data: rosters, error: rosterError } = await supabase
      .from('rosters')
      .select(`
        id,
        joined_at,
        profiles!inner(
          user_id,
          first_name,
          last_name
        )
      `)
      .eq('class_instance_id', instanceId);

    if (rosterError) {
      return NextResponse.json({ error: 'Failed to fetch students' }, { status: 500 });
    }

    // Transform student data
    const students = (rosters || []).map((roster: any) => {
      const user = roster.profiles;
      return {
        id: user.user_id,
        name: `${user.first_name || ''} ${user.last_name || ''}`.trim() || 'Unknown Student',
        email: user.user_id, // Using user_id as email placeholder for now
        enrolled_at: roster.joined_at,
        status: 'active', // Default status
        overall_grade: 0, // Will be calculated
        grade_letter: 'N/A',
        missing_assignments: 0,
        late_assignments: 0,
        mastery_level: 'approaching'
      };
    });

    // Get assignments for this class instance
    const { data: assignments, error: assignmentsError } = await supabase
      .from('assignments')
      .select('*')
      .eq('class_instance_id', instanceId)
      .order('order_index', { ascending: true })
      .order('due_date', { ascending: true, nullsLast: true })
      .order('created_at', { ascending: true });

    if (assignmentsError) {
      return NextResponse.json({ error: 'Failed to fetch assignments' }, { status: 500 });
    }

    // Get grades for all students and assignments
    const studentIds = students.map((s: any) => s.id);
    const assignmentIds = (assignments || []).map(a => a.id);
    
    const { data: gradesData, error: gradesError } = await supabase
      .from('grades')
      .select('*')
      .eq('class_instance_id', instanceId)
      .in('student_id', studentIds)
      .in('assignment_id', assignmentIds);

    if (gradesError) {
      return NextResponse.json({ error: 'Failed to fetch grades' }, { status: 500 });
    }

    // Transform grades data
    const grades: Record<string, any> = {};
    const studentGrades: Record<string, { totalScore: number; totalMaxScore: number; attempts: number }> = {};

    for (const grade of gradesData || []) {
      const key = `${grade.student_id}-${grade.assignment_id}`;
      const percentage = grade.percentage || 0;
      
      grades[key] = {
        student_id: grade.student_id,
        assignment_id: grade.assignment_id,
        points_earned: grade.points_earned,
        points_possible: assignments?.find(a => a.id === grade.assignment_id)?.points_possible || 0,
        percentage,
        status: grade.status || 'pending',
        submitted_at: grade.submitted_at,
        graded_at: grade.graded_at,
        feedback: grade.feedback
      };

      // Track student totals for overall grade calculation
      if (grade.points_earned !== null && grade.points_earned !== undefined) {
        if (!studentGrades[grade.student_id!]) {
          studentGrades[grade.student_id!] = { totalScore: 0, totalMaxScore: 0, attempts: 0 };
        }
        const assignment = assignments?.find(a => a.id === grade.assignment_id);
        const pointsPossible = assignment?.points_possible || 0;
        
        studentGrades[grade.student_id!].totalScore += Number(grade.points_earned);
        studentGrades[grade.student_id!].totalMaxScore += pointsPossible;
        studentGrades[grade.student_id!].attempts += 1;
      }
    }

    // Update student overall grades
    for (const student of students) {
      const studentGrade = studentGrades[student.id];
      if (studentGrade && studentGrade.totalMaxScore > 0) {
        const overallGrade = Math.round((studentGrade.totalScore / studentGrade.totalMaxScore) * 100);
        student.overall_grade = overallGrade;
        
        // Assign letter grade
        if (overallGrade >= 90) student.grade_letter = 'A';
        else if (overallGrade >= 80) student.grade_letter = 'B';
        else if (overallGrade >= 70) student.grade_letter = 'C';
        else if (overallGrade >= 60) student.grade_letter = 'D';
        else student.grade_letter = 'F';

        // Assign mastery level
        if (overallGrade >= 90) student.mastery_level = 'advanced';
        else if (overallGrade >= 80) student.mastery_level = 'proficient';
        else if (overallGrade >= 70) student.mastery_level = 'approaching';
        else student.mastery_level = 'below';
      }
    }

    return NextResponse.json({
      students,
      assignments: assignments || [],
      grades,
      standards: [], // TODO: Implement standards tracking
      settings: {} // TODO: Implement gradebook settings
    });

  } catch (error) {
    console.error('Error fetching gradebook data:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
} 