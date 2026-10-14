import { requireGlobalAdmin } from '@/lib/auth/require-global-admin';
import { NextRequest, NextResponse } from 'next/server';
import { createSupabaseServiceClient } from '@/lib/supabase/server';

export async function DELETE(
  request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  const denied = await requireGlobalAdmin();
  if (denied) return denied;

  try {
    const supabase = createSupabaseServiceClient();
    const { id } = await context.params;

    // Get the base class to verify it exists and get the name for the response
    const { data: baseClass, error: fetchError } = await supabase
      .from('base_classes')
      .select('id, name')
      .eq('id', id)
      .single();

    if (fetchError || !baseClass) {
      return NextResponse.json(
        { error: 'Course not found' },
        { status: 404 }
      );
    }

    // Delete the base class (this will cascade to related content)
    const { error: deleteError } = await supabase
      .from('base_classes')
      .delete()
      .eq('id', id);

    if (deleteError) {
      console.error('Error deleting course catalog item:', deleteError);
      return NextResponse.json(
        { error: 'Failed to delete course' },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      message: `Course "${baseClass.name}" deleted successfully`
    });

  } catch (error) {
    console.error('Error in course catalog deletion:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
