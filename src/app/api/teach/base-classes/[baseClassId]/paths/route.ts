import { createSupabaseServerClient } from '@/lib/supabase/server';
import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

interface BaseClassPathsParams {
  params: Promise<{
    baseClassId: string;
  }>;
}

// POST - Create a new path within a base class
export async function POST(request: NextRequest, { params }: BaseClassPathsParams) {
  const supabase = await createSupabaseServerClient();
  const { baseClassId } = await params;

  const {
    data: { session },
  } = await supabase.auth.getSession();

  if (!session) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const { title, description, order_index } = await request.json();

    if (!title || !description) {
      return NextResponse.json({ error: 'title and description are required' }, { status: 400 });
    }

    // Get user profile for organisation_id
    const { data: profile, error: profileError } = await supabase
      .from('profiles')
      .select('organisation_id')
      .eq('user_id', session.user.id)
      .single();

    if (profileError || !profile) {
      return NextResponse.json({ error: 'Could not verify user organisation' }, { status: 500 });
    }

    const pathData = {
      title,
      description,
      base_class_id: baseClassId,
      organisation_id: profile.organisation_id,
      creator_user_id: session.user.id,
      order_index: order_index || 0,
    };

    const { data: newPath, error: pathError } = await supabase
      .from('paths')
      .insert(pathData)
      .select('*')
      .single();

    if (pathError) {
      console.error('Error creating path:', pathError);
      return NextResponse.json({ error: 'Failed to create path', details: pathError.message }, { status: 500 });
    }

    return NextResponse.json(newPath, { status: 201 });

  } catch (error: any) {
    console.error('POST Path API Error:', error);
    return NextResponse.json({ error: 'An unexpected error occurred', details: error.message }, { status: 500 });
  }
} 