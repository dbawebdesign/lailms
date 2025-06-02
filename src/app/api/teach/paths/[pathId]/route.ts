import { createSupabaseServerClient } from '@/lib/supabase/server';
import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

interface PathParams {
  params: Promise<{
    pathId: string;
  }>;
}

// PATCH - Update a path
export async function PATCH(request: NextRequest, { params }: PathParams) {
  const supabase = await createSupabaseServerClient();
  const { pathId } = await params;

  const {
    data: { session },
  } = await supabase.auth.getSession();

  if (!session) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const updates = await request.json();

    // Remove any fields that shouldn't be updated directly
    const allowedFields = ['title', 'description'];
    const filteredUpdates = Object.keys(updates)
      .filter(key => allowedFields.includes(key))
      .reduce((obj: any, key) => {
        obj[key] = updates[key];
        return obj;
      }, {});

    if (Object.keys(filteredUpdates).length === 0) {
      return NextResponse.json({ error: 'No valid fields to update' }, { status: 400 });
    }

    const { data: updatedPath, error: updateError } = await supabase
      .from('paths')
      .update(filteredUpdates)
      .eq('id', pathId)
      .select('*')
      .single();

    if (updateError) {
      console.error('Error updating path:', updateError);
      return NextResponse.json({ error: 'Failed to update path', details: updateError.message }, { status: 500 });
    }

    return NextResponse.json(updatedPath);

  } catch (error: any) {
    console.error('PATCH Path API Error:', error);
    return NextResponse.json({ error: 'An unexpected error occurred', details: error.message }, { status: 500 });
  }
}

// DELETE - Delete a path
export async function DELETE(request: NextRequest, { params }: PathParams) {
  const supabase = await createSupabaseServerClient();
  const { pathId } = await params;

  const {
    data: { session },
  } = await supabase.auth.getSession();

  if (!session) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const { error: deleteError } = await supabase
      .from('paths')
      .delete()
      .eq('id', pathId);

    if (deleteError) {
      console.error('Error deleting path:', deleteError);
      return NextResponse.json({ error: 'Failed to delete path', details: deleteError.message }, { status: 500 });
    }

    return NextResponse.json({ message: 'Path deleted successfully' });

  } catch (error: any) {
    console.error('DELETE Path API Error:', error);
    return NextResponse.json({ error: 'An unexpected error occurred', details: error.message }, { status: 500 });
  }
} 