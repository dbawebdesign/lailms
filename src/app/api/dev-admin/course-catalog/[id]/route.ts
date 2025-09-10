import { NextRequest, NextResponse } from 'next/server';
import { createSupabaseServiceClient } from '@/lib/supabase/server';

const DEV_ADMIN_PASSWORD = 'TerroirLAI';

function validateDevAdminPassword(request: NextRequest): boolean {
  const authHeader = request.headers.get('x-dev-admin-password');
  return authHeader === DEV_ADMIN_PASSWORD;
}

export async function DELETE(
  request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  // Check dev admin password
  if (!validateDevAdminPassword(request)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const supabase = createSupabaseServiceClient();
    const { id } = await context.params;

    // Verify this is a course catalog item
    const { data: baseClass, error: fetchError } = await supabase
      .from('base_classes')
      .select('id, name, course_catalog')
      .eq('id', id)
      .eq('course_catalog', true)
      .single();

    if (fetchError || !baseClass) {
      return NextResponse.json(
        { error: 'Course catalog item not found' },
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
        { error: 'Failed to delete course catalog item' },
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
