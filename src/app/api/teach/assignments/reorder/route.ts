import { NextRequest, NextResponse } from 'next/server';
import { createSupabaseServerClient } from '@/utils/supabase/server';

interface ReorderRequest {
  assignmentId: string;
  newOrderIndex: number;
  classInstanceId: string;
}

export async function POST(request: NextRequest) {
  try {
    const supabase = await createSupabaseServerClient();
    
    // Get current user
    const { data: { user }, error: userError } = await supabase.auth.getUser();
    if (userError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body: ReorderRequest = await request.json();
    const { assignmentId, newOrderIndex, classInstanceId } = body;

    if (!assignmentId || newOrderIndex === undefined || !classInstanceId) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
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
      .eq('id', classInstanceId)
      .single();

    if (classError || !classInstance) {
      return NextResponse.json({ error: 'Class not found or access denied' }, { status: 404 });
    }

    // Check if user owns the class or has teacher access
    if ((classInstance as any).base_classes.user_id !== user.id) {
      return NextResponse.json({ error: 'Access denied' }, { status: 403 });
    }

    // Get all assignments for this class instance to reorder them
    const { data: assignments, error: assignmentsError } = await supabase
      .from('assignments')
      .select('id, name, order_index')
      .eq('class_instance_id', classInstanceId)
      .order('order_index', { ascending: true });

    if (assignmentsError) {
      console.error('Failed to fetch assignments:', assignmentsError);
      return NextResponse.json({ error: 'Failed to fetch assignments' }, { status: 500 });
    }

    if (!assignments || assignments.length === 0) {
      return NextResponse.json({ error: 'No assignments found' }, { status: 404 });
    }

    // Find the assignment being moved
    const movingAssignment = assignments.find(a => a.id === assignmentId);
    if (!movingAssignment) {
      return NextResponse.json({ error: 'Assignment not found' }, { status: 404 });
    }

    // Get the current index of the moving assignment
    const currentIndex = assignments.findIndex(a => a.id === assignmentId);
    
    console.log('🔍 Reorder Debug:', {
      assignmentId,
      assignmentName: movingAssignment.name,
      requestedNewIndex: newOrderIndex,
      currentDatabaseIndex: currentIndex,
      currentOrderIndex: movingAssignment.order_index,
      totalAssignments: assignments.length
    });
    
    // Create a copy of the assignments array for reordering
    const reorderedAssignments = [...assignments];
    
    // Remove the assignment from its current position
    reorderedAssignments.splice(currentIndex, 1);
    
    // Insert it at the new position
    reorderedAssignments.splice(newOrderIndex, 0, movingAssignment);

    // Update ALL assignments to have sequential order_index values
    // This ensures the database matches the new order exactly
    const updatePromises = reorderedAssignments.map(async (assignment, index) => {
      const { error } = await supabase
        .from('assignments')
        .update({ order_index: index })
        .eq('id', assignment.id);
      
      if (error) {
        console.error(`Failed to update assignment ${assignment.id}:`, error);
        throw error;
      }
    });

    // Execute all updates
    try {
      await Promise.all(updatePromises);
      console.log('All assignment updates completed successfully');
    } catch (updateError) {
      console.error('Failed to update assignment order:', updateError);
      return NextResponse.json({ error: 'Failed to update assignment order' }, { status: 500 });
    }

    return NextResponse.json({ 
      success: true, 
      message: 'Assignment order updated successfully',
      updatedCount: reorderedAssignments.length
    });

  } catch (error) {
    console.error('Error reordering assignments:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
