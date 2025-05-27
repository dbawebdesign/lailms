import { NextRequest, NextResponse } from 'next/server';
import { createSupabaseServerClient } from '@/lib/supabase/server';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;

    if (!id) {
      return NextResponse.json(
        { error: 'Asset ID is required' },
        { status: 400 }
      );
    }

    // Initialize Supabase client
    const supabase = createSupabaseServerClient();

    // Get the current user
    const { data: { user }, error: userError } = await supabase.auth.getUser();
    if (userError || !user) {
      return NextResponse.json(
        { error: 'Authentication required' },
        { status: 401 }
      );
    }

    // Fetch the mind map asset
    const { data: asset, error: assetError } = await supabase
      .from('lesson_media_assets')
      .select('*')
      .eq('id', id)
      .eq('asset_type', 'mind_map')
      .single();

    if (assetError || !asset) {
      return NextResponse.json(
        { error: 'Mind map not found' },
        { status: 404 }
      );
    }

    // Return the HTML content
    return new NextResponse(asset.svg_content, {
      status: 200,
      headers: {
        'Content-Type': 'text/html',
        'Cache-Control': 'public, max-age=3600',
      },
    });

  } catch (error) {
    console.error('Error fetching mind map:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}