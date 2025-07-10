import { NextRequest, NextResponse } from 'next/server';
import { createSupabaseServerClient } from '@/utils/supabase/server';

export async function GET(request: NextRequest) {
  try {
    const supabase = await createSupabaseServerClient();
    const { searchParams } = new URL(request.url);
    const instanceId = searchParams.get('instanceId');

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

    // Get assignments for this class
    const { data: assignments, error: assignmentsError } = await supabase
      .from('assignments')
      .select(`
        id,
        title,
        description,
        type,
        points_possible,
        due_date,
        published,
        created_at,
        updated_at,
        assignment_standards(
          id,
          standards(
            id,
            name,
            description
          )
        )
      `)
      .eq('class_instance_id', instanceId)
      .order('created_at', { ascending: false });

    if (assignmentsError) {
      return NextResponse.json({ error: 'Failed to fetch assignments' }, { status: 500 });
    }

    return NextResponse.json({ assignments: assignments || [] });

  } catch (error) {
    console.error('Error fetching assignments:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const supabase = await createSupabaseServerClient();
    const body = await request.json();
    
    const {
      class_instance_id,
      title,
      description,
      type,
      points_possible,
      due_date,
      published = false,
      standards = []
    } = body;

    if (!class_instance_id || !title || !type) {
      return NextResponse.json({ 
        error: 'class_instance_id, title, and type are required' 
      }, { status: 400 });
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
      .eq('id', class_instance_id)
      .eq('base_classes.user_id', user.id)
      .single();

    if (classError || !classInstance) {
      return NextResponse.json({ error: 'Class not found or access denied' }, { status: 404 });
    }

    // Create assignment
    const { data: assignment, error: assignmentError } = await supabase
      .from('assignments')
      .insert({
        class_instance_id,
        name: title,
        description,
        type,
        points_possible: points_possible || 100,
        due_date,
        published
      })
      .select()
      .single();

    if (assignmentError) {
      return NextResponse.json({ error: 'Failed to create assignment' }, { status: 500 });
    }

    // Create assignment-standards relationships if provided
    if (standards.length > 0) {
      const assignmentStandards = standards.map((standardId: string) => ({
        assignment_id: assignment.id,
        standard_id: standardId
      }));

      const { error: standardsError } = await supabase
        .from('assignment_standards')
        .insert(assignmentStandards);

      if (standardsError) {
        console.error('Error linking standards:', standardsError);
        // Don't fail the request, just log the error
      }
    }

    // Broadcast real-time update
    const channel = supabase.channel(`gradebook:${class_instance_id}`);
    await channel.send({
      type: 'broadcast',
      event: 'assignment_update',
      payload: {
        type: 'assignment_created',
        assignment,
        class_instance_id
      }
    });

    return NextResponse.json({ assignment }, { status: 201 });

  } catch (error) {
    console.error('Error creating assignment:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export async function PUT(request: NextRequest) {
  try {
    const supabase = await createSupabaseServerClient();
    const body = await request.json();
    
    const {
      id,
      title,
      description,
      type,
      points_possible,
      due_date,
      published,
      standards = []
    } = body;

    if (!id) {
      return NextResponse.json({ error: 'Assignment ID is required' }, { status: 400 });
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
      .eq('id', id)
      .eq('class_instances.base_classes.user_id', user.id)
      .single();

    if (assignmentError || !assignment) {
      return NextResponse.json({ error: 'Assignment not found or access denied' }, { status: 404 });
    }

    // Update assignment
    const { data: updatedAssignment, error: updateError } = await supabase
      .from('assignments')
      .update({
        name: title,
        description,
        type,
        points_possible,
        due_date,
        published,
        updated_at: new Date().toISOString()
      })
      .eq('id', id)
      .select()
      .single();

    if (updateError) {
      return NextResponse.json({ error: 'Failed to update assignment' }, { status: 500 });
    }

    // Update assignment-standards relationships
    // First, remove existing relationships
    await supabase
      .from('assignment_standards')
      .delete()
      .eq('assignment_id', id);

    // Then, add new relationships
    if (standards.length > 0) {
      const assignmentStandards = standards.map((standardId: string) => ({
        assignment_id: id,
        standard_id: standardId
      }));

      const { error: standardsError } = await supabase
        .from('assignment_standards')
        .insert(assignmentStandards);

      if (standardsError) {
        console.error('Error updating standards:', standardsError);
      }
    }

    // Broadcast real-time update
    const channel = supabase.channel(`gradebook:${updatedAssignment.class_instance_id}`);
    await channel.send({
      type: 'broadcast',
      event: 'assignment_update',
      payload: {
        type: 'assignment_updated',
        assignment: updatedAssignment,
        class_instance_id: updatedAssignment.class_instance_id
      }
    });

    return NextResponse.json({ assignment: updatedAssignment });

  } catch (error) {
    console.error('Error updating assignment:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const supabase = await createSupabaseServerClient();
    const { searchParams } = new URL(request.url);
    const id = searchParams.get('id');

    if (!id) {
      return NextResponse.json({ error: 'Assignment ID is required' }, { status: 400 });
    }

    // Get current user
    const { data: { user }, error: userError } = await supabase.auth.getUser();
    if (userError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Verify user has access to this assignment and get full assignment data for broadcast
    const { data: assignment, error: assignmentError } = await supabase
      .from('assignments')
      .select(`
        *,
        class_instances!inner(
          id,
          base_classes!inner(
            user_id
          )
        )
      `)
      .eq('id', id)
      .eq('class_instances.base_classes.user_id', user.id)
      .single();

    if (assignmentError || !assignment) {
      return NextResponse.json({ error: 'Assignment not found or access denied' }, { status: 404 });
    }

    // Delete assignment (this will cascade to delete related grades and standards)
    const { error: deleteError } = await supabase
      .from('assignments')
      .delete()
      .eq('id', id);

    if (deleteError) {
      return NextResponse.json({ error: 'Failed to delete assignment' }, { status: 500 });
    }

    // Broadcast real-time update
    const channel = supabase.channel(`gradebook:${assignment.class_instance_id}`);
    await channel.send({
      type: 'broadcast',
      event: 'assignment_update',
      payload: {
        type: 'assignment_deleted',
        assignment,
        class_instance_id: assignment.class_instance_id
      }
    });

    return NextResponse.json({ message: 'Assignment deleted successfully' });

  } catch (error) {
    console.error('Error deleting assignment:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
} 