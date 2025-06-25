import { NextRequest, NextResponse } from 'next/server';
import { createSupabaseServerClient } from '@/lib/supabase/server';
import { TeacherToolCreationInput } from '@/types/teachingTools';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const supabase = createSupabaseServerClient();
    
    // Check authentication
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { id } = await params;

    const { data: creation, error: queryError } = await supabase
      .from('teacher_tool_creations')
      .select('*')
      .eq('id', id)
      .eq('user_id', user.id)
      .single();

    if (queryError) {
      if (queryError.code === 'PGRST116') {
        return NextResponse.json({ error: 'Creation not found' }, { status: 404 });
      }
      console.error('Creation query error:', queryError);
      return NextResponse.json({ error: 'Failed to fetch creation' }, { status: 500 });
    }

    return NextResponse.json({ creation });

  } catch (error) {
    console.error('Library GET error:', error);
    return NextResponse.json(
      { error: 'Failed to process request' },
      { status: 500 }
    );
  }
}

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const supabase = createSupabaseServerClient();
    
    // Check authentication
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { id } = await params;
    const updateData = await request.json();

    // Update creation
    const { data: creation, error: updateError } = await supabase
      .from('teacher_tool_creations')
      .update({
        title: updateData.title,
        description: updateData.description,
        content: updateData.content,
        metadata: updateData.metadata,
        tags: updateData.tags,
        is_favorite: updateData.is_favorite
      })
      .eq('id', id)
      .eq('user_id', user.id)
      .select()
      .single();

    if (updateError) {
      if (updateError.code === 'PGRST116') {
        return NextResponse.json({ error: 'Creation not found' }, { status: 404 });
      }
      console.error('Creation update error:', updateError);
      return NextResponse.json({ error: 'Failed to update creation' }, { status: 500 });
    }

    return NextResponse.json({ creation });

  } catch (error) {
    console.error('Library PUT error:', error);
    return NextResponse.json(
      { error: 'Failed to process request' },
      { status: 500 }
    );
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const supabase = createSupabaseServerClient();
    
    // Check authentication
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { id } = await params;

    // Delete creation
    const { error: deleteError } = await supabase
      .from('teacher_tool_creations')
      .delete()
      .eq('id', id)
      .eq('user_id', user.id);

    if (deleteError) {
      console.error('Creation delete error:', deleteError);
      return NextResponse.json({ error: 'Failed to delete creation' }, { status: 500 });
    }

    return NextResponse.json({ success: true });

  } catch (error) {
    console.error('Library DELETE error:', error);
    return NextResponse.json(
      { error: 'Failed to process request' },
      { status: 500 }
    );
  }
} 