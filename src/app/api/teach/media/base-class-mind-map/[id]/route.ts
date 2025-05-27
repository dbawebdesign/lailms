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
        { error: 'Mind map ID is required' },
        { status: 400 }
      );
    }

    // Initialize Supabase client
    const supabase = createSupabaseServerClient();

    // Fetch the mind map asset
    const { data: asset, error: assetError } = await supabase
      .from('base_class_media_assets')
      .select('*')
      .eq('id', id)
      .eq('asset_type', 'mind_map')
      .eq('status', 'completed')
      .single();

    if (assetError) {
      console.error('Failed to fetch base class mind map:', assetError);
      return NextResponse.json(
        { error: 'Mind map not found' },
        { status: 404 }
      );
    }

    if (!asset || !asset.svg_content) {
      return NextResponse.json(
        { error: 'Mind map content not available' },
        { status: 404 }
      );
    }

    // Return the HTML content directly
    return new NextResponse(asset.svg_content, {
      headers: {
        'Content-Type': 'text/html',
        'Cache-Control': 'public, max-age=3600', // Cache for 1 hour
      },
    });

  } catch (error) {
    console.error('Base class mind map serving error:', error);
    return NextResponse.json(
      { error: 'Failed to serve mind map' },
      { status: 500 }
    );
  }
} 