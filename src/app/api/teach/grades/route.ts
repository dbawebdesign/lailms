import { NextRequest, NextResponse } from 'next/server';
import { createSupabaseServerClient } from '@/utils/supabase/server';

export async function GET(request: NextRequest) {
  try {
    const supabase = await createSupabaseServerClient();
    const { searchParams } = new URL(request.url);
    const instanceId = searchParams.get('instanceId');
    const studentId = searchParams.get('studentId');
    const assignmentId = searchParams.get('assignmentId');

    if (!instanceId) {
      return NextResponse.json({ error: 'Instance ID is required' }, { status: 400 });
    }

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
        base_classes!inner(
          id,
          user_id
        )
      `)
      .eq('id', instanceId)
      .eq('base_classes.user_id', user.id)
      .single();

    if (classError || !classInstance) {
      return NextResponse.json({ error: 'Class not found or access denied' }, { status: 404 });
    }

    // Build query for grades
    let query = supabase
      .from('grades')
      .select(`
        id,
        student_id,
        assignment_id,
        points_earned,
        points_possible,
        status,
        feedback,
        submitted_at,
        graded_at,
        created_at,
        updated_at,
        assignments!inner(
          id,
          title,
          type,
          class_instance_id
        ),
        profiles!inner(
          user_id,
          first_name,
          last_name
        )
      `)
      .eq('assignments.class_instance_id', instanceId);

    // Add filters if provided
    if (studentId) {
      query = query.eq('student_id', studentId);
    }
    if (assignmentId) {
      query = query.eq('assignment_id', assignmentId);
    }

    const { data: grades, error: gradesError } = await query.order('created_at', { ascending: false });

    if (gradesError) {
      return NextResponse.json({ error: 'Failed to fetch grades' }, { status: 500 });
    }

    return NextResponse.json({ grades: grades || [] });

  } catch (error) {
    console.error('Error fetching grades:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const supabase = await createSupabaseServerClient();
    const body = await request.json();
    
    const {
      student_id,
      assignment_id,
      points_earned,
      points_possible,
      status = 'graded',
      feedback,
      submitted_at,
      graded_at = new Date().toISOString()
    } = body;

    if (!student_id || !assignment_id || points_earned === undefined || !points_possible) {
      return NextResponse.json({ 
        error: 'student_id, assignment_id, points_earned, and points_possible are required' 
      }, { status: 400 });
    }

    // Get current user
    const { data: { user }, error: userError } = await supabase.auth.getUser();
    if (userError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Verify user has access to this assignment
    const { data: assignment, error: assignmentError } = await supabase
      .from('assignments')
      .select(`
        id,
        class_instances!inner(
          id,
          base_classes!inner(
            user_id
          )
        )
      `)
      .eq('id', assignment_id)
      .eq('class_instances.base_classes.user_id', user.id)
      .single();

    if (assignmentError || !assignment) {
      return NextResponse.json({ error: 'Assignment not found or access denied' }, { status: 404 });
    }

    // Verify student is enrolled in this class
    const { data: roster, error: rosterError } = await supabase
      .from('rosters')
      .select('id')
      .eq('class_instance_id', (assignment as any).class_instances.id)
      .eq('profiles.user_id', student_id)
      .single();

    if (rosterError || !roster) {
      return NextResponse.json({ error: 'Student not enrolled in this class' }, { status: 400 });
    }

    // Check if grade already exists to determine if this is an update or create
    const { data: existingGrade } = await supabase
      .from('grades')
      .select('id')
      .eq('student_id', student_id)
      .eq('assignment_id', assignment_id)
      .single();

    // Create or update grade (upsert)
    const { data: grade, error: gradeError } = await supabase
      .from('grades')
      .upsert({
        student_id,
        assignment_id,
        points_earned,
        points_possible,
        status,
        feedback,
        submitted_at,
        graded_at
      }, {
        onConflict: 'student_id,assignment_id'
      })
      .select()
      .single();

    if (gradeError) {
      return NextResponse.json({ error: 'Failed to create/update grade' }, { status: 500 });
    }

    // Broadcast real-time update
    const channel = supabase.channel(`gradebook:${(assignment as any).class_instances.id}`);
    await channel.send({
      type: 'broadcast',
      event: 'grade_update',
      payload: {
        type: existingGrade ? 'grade_updated' : 'grade_created',
        grade,
        class_instance_id: (assignment as any).class_instances.id
      }
    });

    return NextResponse.json({ grade }, { status: 201 });

  } catch (error) {
    console.error('Error creating/updating grade:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export async function PUT(request: NextRequest) {
  try {
    const supabase = await createSupabaseServerClient();
    const body = await request.json();
    
    const {
      id,
      points_earned,
      points_possible,
      status,
      feedback,
      submitted_at,
      graded_at
    } = body;

    if (!id) {
      return NextResponse.json({ error: 'Grade ID is required' }, { status: 400 });
    }

    // Get current user
    const { data: { user }, error: userError } = await supabase.auth.getUser();
    if (userError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Verify user has access to this grade
    const { data: grade, error: gradeError } = await supabase
      .from('grades')
      .select(`
        id,
        assignments!inner(
          id,
          class_instances!inner(
            id,
            base_classes!inner(
              user_id
            )
          )
        )
      `)
      .eq('id', id)
      .eq('assignments.class_instances.base_classes.user_id', user.id)
      .single();

    if (gradeError || !grade) {
      return NextResponse.json({ error: 'Grade not found or access denied' }, { status: 404 });
    }

    // Update grade
    const updateData: any = { updated_at: new Date().toISOString() };
    if (points_earned !== undefined) updateData.points_earned = points_earned;
    if (points_possible !== undefined) updateData.points_possible = points_possible;
    if (status !== undefined) updateData.status = status;
    if (feedback !== undefined) updateData.feedback = feedback;
    if (submitted_at !== undefined) updateData.submitted_at = submitted_at;
    if (graded_at !== undefined) updateData.graded_at = graded_at;

    const { data: updatedGrade, error: updateError } = await supabase
      .from('grades')
      .update(updateData)
      .eq('id', id)
      .select(`
        *,
        assignments!inner(
          class_instance_id
        )
      `)
      .single();

    if (updateError) {
      return NextResponse.json({ error: 'Failed to update grade' }, { status: 500 });
    }

    // Broadcast real-time update
    const channel = supabase.channel(`gradebook:${(updatedGrade as any).assignments.class_instance_id}`);
    await channel.send({
      type: 'broadcast',
      event: 'grade_update',
      payload: {
        type: 'grade_updated',
        grade: updatedGrade,
        class_instance_id: (updatedGrade as any).assignments.class_instance_id
      }
    });

    return NextResponse.json({ grade: updatedGrade });

  } catch (error) {
    console.error('Error updating grade:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const supabase = await createSupabaseServerClient();
    const { searchParams } = new URL(request.url);
    const id = searchParams.get('id');

    if (!id) {
      return NextResponse.json({ error: 'Grade ID is required' }, { status: 400 });
    }

    // Get current user
    const { data: { user }, error: userError } = await supabase.auth.getUser();
    if (userError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Verify user has access to this grade and get full grade data for broadcast
    const { data: grade, error: gradeError } = await supabase
      .from('grades')
      .select(`
        *,
        assignments!inner(
          id,
          class_instance_id,
          class_instances!inner(
            id,
            base_classes!inner(
              user_id
            )
          )
        )
      `)
      .eq('id', id)
      .eq('assignments.class_instances.base_classes.user_id', user.id)
      .single();

    if (gradeError || !grade) {
      return NextResponse.json({ error: 'Grade not found or access denied' }, { status: 404 });
    }

    // Delete grade
    const { error: deleteError } = await supabase
      .from('grades')
      .delete()
      .eq('id', id);

    if (deleteError) {
      return NextResponse.json({ error: 'Failed to delete grade' }, { status: 500 });
    }

    // Broadcast real-time update
    const channel = supabase.channel(`gradebook:${(grade as any).assignments.class_instance_id}`);
    await channel.send({
      type: 'broadcast',
      event: 'grade_update',
      payload: {
        type: 'grade_deleted',
        grade,
        class_instance_id: (grade as any).assignments.class_instance_id
      }
    });

    return NextResponse.json({ message: 'Grade deleted successfully' });

  } catch (error) {
    console.error('Error deleting grade:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
} 