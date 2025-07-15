import { createSupabaseServerClient } from '@/lib/supabase/server';
import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { Tables } from 'packages/types/db';

interface PathParams {
  params: Promise<{
    pathId: string;
  }>;
}

// GET /api/teach/paths/[pathId] - Get a specific path
export async function GET(
  request: Request,
  { params }: { params: Promise<{ pathId: string }> }
) {
  const { pathId } = await params;
  const supabase = createSupabaseServerClient();
  const {
    data: { user },
    error: authError
  } = await supabase.auth.getUser();

  if (authError || !user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    // Get user's organization
    const { data: profile } = await supabase
      .from('profiles')
      .select('organisation_id')
      .eq('user_id', user.id)
      .single<Tables<'profiles'>>();

    if (!profile?.organisation_id) {
      return NextResponse.json({ error: 'Organization not found' }, { status: 404 });
    }

    // Get the path with lessons
    const { data: path, error } = await supabase
      .from('paths')
      .select(`
        *,
        lessons(*)
      `)
      .eq('id', pathId)
      .eq('organisation_id', profile.organisation_id)
      .single();

    if (error) {
      return NextResponse.json({ error: 'Path not found' }, { status: 404 });
    }

    return NextResponse.json(path);
  } catch (error) {
    console.error('Error fetching path:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

// PUT /api/teach/paths/[pathId] - Update a path
export async function PUT(
  request: Request,
  { params }: { params: Promise<{ pathId: string }> }
) {
  const { pathId } = await params;
  const supabase = createSupabaseServerClient();
  const {
    data: { user },
    error: authError
  } = await supabase.auth.getUser();

  if (authError || !user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const body = await request.json();
    const { title, description, status } = body;

    // Get user's organization
    const { data: profile } = await supabase
      .from('profiles')
      .select('organisation_id')
      .eq('user_id', user.id)
      .single<Tables<'profiles'>>();

    if (!profile?.organisation_id) {
      return NextResponse.json({ error: 'Organization not found' }, { status: 404 });
    }

    // Update the path
    const { data: path, error } = await supabase
      .from('paths')
      .update({
        title,
        description,
        status,
        updated_at: new Date().toISOString()
      })
      .eq('id', pathId)
      .eq('organisation_id', profile.organisation_id)
      .select()
      .single();

    if (error) {
      return NextResponse.json({ error: 'Failed to update path' }, { status: 500 });
    }

    return NextResponse.json(path);
  } catch (error) {
    console.error('Error updating path:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

// DELETE /api/teach/paths/[pathId] - Delete a path
export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ pathId: string }> }
) {
  const { pathId } = await params;
  const supabase = createSupabaseServerClient();
  const {
    data: { user },
    error: authError
  } = await supabase.auth.getUser();

  if (authError || !user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    // Get user's organization
    const { data: profile } = await supabase
      .from('profiles')
      .select('organisation_id')
      .eq('user_id', user.id)
      .single<Tables<'profiles'>>();

    if (!profile?.organisation_id) {
      return NextResponse.json({ error: 'Organization not found' }, { status: 404 });
    }

    // Delete the path
    const { error } = await supabase
      .from('paths')
      .delete()
      .eq('id', pathId)
      .eq('organisation_id', profile.organisation_id);

    if (error) {
      return NextResponse.json({ error: 'Failed to delete path' }, { status: 500 });
    }

    return NextResponse.json({ message: 'Path deleted successfully' });
  } catch (error) {
    console.error('Error deleting path:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
} 