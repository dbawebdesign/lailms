import { NextRequest, NextResponse } from 'next/server';
import { createSupabaseServerClient } from '@/lib/supabase/server';
import { Tables } from "packages/types/db";

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

    let asset = null;

    // First try to fetch from lesson_media_assets
    const { data: lessonAsset, error: lessonError } = await supabase
      .from('lesson_media_assets')
      .select('*')
      .eq('id', id)
      .eq('asset_type', 'mind_map')
      .single<Tables<"lesson_media_assets">>();

    if (lessonAsset && !lessonError) {
      asset = lessonAsset;
    } else {
      // If not found in lesson assets, try base_class_media_assets
      const { data: baseClassAsset, error: baseClassError } = await supabase
        .from('base_class_media_assets')
        .select('*')
        .eq('id', id)
        .eq('asset_type', 'mind_map')
        .eq('status', 'completed')
        .single<Tables<"base_class_media_assets">>();

      if (baseClassAsset && !baseClassError) {
        asset = baseClassAsset;
      }
    }

    if (!asset) {
      return NextResponse.json(
        { error: 'Mind map not found' },
        { status: 404 }
      );
    }

    if (!asset.svg_content) {
      return NextResponse.json(
        { error: 'Mind map content not available' },
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