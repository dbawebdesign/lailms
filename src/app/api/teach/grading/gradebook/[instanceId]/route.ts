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

    // Get assignments (lessons with questions for this class)
    const { data: lessons, error: lessonsError } = await supabase
      .from('lessons')
      .select(`
        id,
        title,
        created_at,
        paths!inner(
          id,
          base_class_id
        ),
        lesson_questions(
          id,
          question_id
        )
      `)
      .eq('paths.base_class_id', (classInstance as any).base_classes.id)
      .not('lesson_questions', 'is', null);

    if (lessonsError) {
      return NextResponse.json({ error: 'Failed to fetch assignments' }, { status: 500 });
    }

    // Transform assignment data
    const assignments = (lessons || []).map((lesson: any) => ({
      id: lesson.id,
      name: lesson.title,
      type: 'quiz' as const,
      points_possible: lesson.lesson_questions?.length * 10 || 100, // Simplified scoring
      due_date: null,
      published: true,
      created_at: lesson.created_at
    }));

    // Get quiz attempts (grades) for all students and assignments
    const studentIds = students.map((s: any) => s.id);
    const { data: quizAttempts, error: attemptsError } = await supabase
      .from('quiz_attempts')
      .select(`
        id,
        user_id,
        score,
        max_score,
        created_at,
        lesson_questions!inner(
          lesson_id
        )
      `)
      .in('user_id', studentIds)
      .in('lesson_questions.lesson_id', assignments.map(a => a.id));

    if (attemptsError) {
      return NextResponse.json({ error: 'Failed to fetch grades' }, { status: 500 });
    }

    // Transform grades data
    const grades: Record<string, any> = {};
    const studentGrades: Record<string, { totalScore: number; totalMaxScore: number; attempts: number }> = {};

    for (const attempt of quizAttempts || []) {
      const attemptData = attempt as any;
      const key = `${attemptData.user_id}-${attemptData.lesson_questions.lesson_id}`;
      const percentage = attemptData.max_score > 0 ? Math.round((attemptData.score / attemptData.max_score) * 100) : 0;
      
      grades[key] = {
        student_id: attemptData.user_id,
        assignment_id: attemptData.lesson_questions.lesson_id,
        points_earned: attemptData.score,
        points_possible: attemptData.max_score,
        percentage,
        status: 'graded' as const,
        submitted_at: attemptData.created_at
      };

      // Track student totals for overall grade calculation
      if (!studentGrades[attemptData.user_id]) {
        studentGrades[attemptData.user_id] = { totalScore: 0, totalMaxScore: 0, attempts: 0 };
      }
      studentGrades[attemptData.user_id].totalScore += attemptData.score;
      studentGrades[attemptData.user_id].totalMaxScore += attemptData.max_score;
      studentGrades[attemptData.user_id].attempts += 1;
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
      assignments,
      grades,
      standards: [], // TODO: Implement standards tracking
      settings: {} // TODO: Implement gradebook settings
    });

  } catch (error) {
    console.error('Error fetching gradebook data:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
} 