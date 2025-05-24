import { NextRequest, NextResponse } from 'next/server';
import { createSupabaseServerClient } from '@/lib/supabase/server';

interface MediaAsset {
  id: string;
  asset_type: string;
  title: string;
  status: string;
  file_url?: string;
  duration?: number;
  created_at: string;
}

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ lessonId: string }> }
) {
  try {
    const { lessonId } = await params;

    if (!lessonId) {
      return NextResponse.json(
        { error: 'Lesson ID is required' },
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

    // Fetch media assets for the lesson
    const { data: assets, error: assetsError } = await supabase
      .from('lesson_media_assets')
      .select('*')
      .eq('lesson_id', lessonId)
      .order('created_at', { ascending: false });

    if (assetsError) {
      console.error('Database error:', assetsError);
      return NextResponse.json(
        { error: 'Failed to fetch media assets' },
        { status: 500 }
      );
    }

    // Transform the data to match the frontend interface
    const transformedAssets = (assets as MediaAsset[]).map((asset: MediaAsset) => ({
      id: asset.id,
      type: asset.asset_type,
      title: asset.title,
      status: asset.status,
      url: asset.file_url,
      duration: asset.duration,
      createdAt: asset.created_at
    }));

    return NextResponse.json({
      success: true,
      assets: transformedAssets
    });

  } catch (error) {
    console.error('Media assets fetch error:', error);
    return NextResponse.json(
      { error: 'Failed to fetch media assets' },
      { status: 500 }
    );
  }
} 