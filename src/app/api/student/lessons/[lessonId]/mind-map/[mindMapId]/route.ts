import { NextRequest, NextResponse } from 'next/server';
import { createSupabaseServerClient } from '@/lib/supabase/server';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ lessonId: string; mindMapId: string }> }
) {
  try {
    const { lessonId, mindMapId } = await params;
    const supabase = createSupabaseServerClient();

    // Get the current user
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      return new NextResponse('Unauthorized', { status: 401 });
    }

    // Fetch the mind map asset
    const { data: mindMapAsset, error: mindMapError } = await supabase
      .from('lesson_media_assets')
      .select('*')
      .eq('id', mindMapId)
      .eq('lesson_id', lessonId)
      .eq('asset_type', 'mind_map')
      .single();

    if (mindMapError || !mindMapAsset) {
      return new NextResponse('Mind map not found', { status: 404 });
    }

    // Return the SVG content as HTML
    const htmlContent = `
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>${mindMapAsset.title}</title>
    <style>
        body {
            margin: 0;
            padding: 20px;
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
            background: #f9fafb;
            color: #1f2937;
        }
        .mind-map-container {
            width: 100%;
            height: 100vh;
            display: flex;
            justify-content: center;
            align-items: center;
            overflow: auto;
        }
        svg {
            max-width: 100%;
            height: auto;
            background: white;
            border-radius: 12px;
            box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.1);
        }
        @media (prefers-color-scheme: dark) {
            body {
                background: #111827;
                color: #f9fafb;
            }
            svg {
                background: #1f2937;
            }
        }
    </style>
</head>
<body>
    <div class="mind-map-container">
        ${mindMapAsset.svg_content || '<p>Mind map content not available</p>'}
    </div>
</body>
</html>`;

    return new NextResponse(htmlContent, {
      headers: {
        'Content-Type': 'text/html',
        'Cache-Control': 'public, max-age=3600'
      }
    });

  } catch (error) {
    console.error('Error serving mind map:', error);
    return new NextResponse('Internal server error', { status: 500 });
  }
} 