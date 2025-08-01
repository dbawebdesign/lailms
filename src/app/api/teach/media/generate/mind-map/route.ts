import { NextRequest, NextResponse } from 'next/server';
import { createSupabaseServerClient } from '@/lib/supabase/server';
import { createClient } from '@supabase/supabase-js';
import { mindMapGenerationService } from '@/lib/services/mind-map-generation-service';
import { Tables } from 'packages/types/db';

// Extract rich text content from JSONB
function extractTextContent(content: any): string {
  if (!content) return '';
  if (typeof content === 'string') return content;
  
  if (content.type === 'doc' && content.content) {
    return extractFromNodes(content.content);
  }
  
  return '';
}

function extractFromNodes(nodes: any[]): string {
  if (!Array.isArray(nodes)) return '';
  
  return nodes.map(node => {
    if (node.type === 'paragraph' && node.content) {
      return node.content.map((textNode: any) => textNode.text || '').join('');
    } else if (node.type === 'text') {
      return node.text || '';
    } else if (node.content) {
      return extractFromNodes(node.content);
    }
    return '';
  }).join('\n');
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { lessonId, baseClassId, userId, internal } = body;
    
    let supabase;
    let user;
    
    // Handle internal requests from course generation
    if (internal && userId) {
      // Use service role client for internal requests to bypass RLS
      supabase = createClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.SUPABASE_SERVICE_ROLE_KEY!,
        {
          auth: {
            autoRefreshToken: false,
            persistSession: false
          }
        }
      );
      user = { id: userId };
      console.log('🔧 Internal mind map request (using service role):', { lessonId, userId, internal });
    } else {
      // Handle regular requests with authentication
      supabase = createSupabaseServerClient();
      const { data: { user: authUser } } = await supabase.auth.getUser();
      if (!authUser) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
      }
      user = authUser;
    }

    // Determine the type of mind map to generate
    const isLessonMindMap = !!lessonId;
    const isBaseClassMindMap = !!baseClassId;

    if (!isLessonMindMap && !isBaseClassMindMap) {
      return NextResponse.json({ error: 'Either lessonId or baseClassId is required' }, { status: 400 });
    }

    if (isLessonMindMap && isBaseClassMindMap) {
      return NextResponse.json({ error: 'Cannot specify both lessonId and baseClassId' }, { status: 400 });
    }

    const regenerate = request.nextUrl.searchParams.get('regenerate') === 'true';
    let mindMapData, svgHtml, assetData;

    if (isLessonMindMap) {
      // Generate lesson mind map using the service
      const result = await mindMapGenerationService.generateLessonMindMap(
        supabase, 
        lessonId, 
        user, 
        { regenerate, internal: !!internal }
      );
      
      if (!result.success) {
        throw new Error(result.error || 'Failed to generate lesson mind map');
      }
      
      mindMapData = result.mindMapData;
      svgHtml = result.svgHtml;
      assetData = result.asset;
    } else {
      // Generate base class mind map using the service
      const result = await mindMapGenerationService.generateBaseClassMindMap(
        supabase, 
        baseClassId, 
        user, 
        { regenerate, internal: !!internal }
      );
      
      if (!result.success) {
        throw new Error(result.error || 'Failed to generate base class mind map');
      }
      
      mindMapData = result.mindMapData;
      svgHtml = result.svgHtml;
      assetData = result.asset;
    }

    return NextResponse.json({
      success: true,
      asset: assetData
    });

  } catch (error) {
    console.error('Mind map generation error:', error);
    return NextResponse.json({ error: 'Failed to generate mind map' }, { status: 500 });
  }
}

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = request.nextUrl;
    const lessonId = searchParams.get('lessonId');
    const baseClassId = searchParams.get('baseClassId');

    if (!lessonId && !baseClassId) {
      return NextResponse.json({ error: 'Either lessonId or baseClassId is required' }, { status: 400 });
    }

    const supabase = createSupabaseServerClient();
    const { data: { user } } = await supabase.auth.getUser();
    
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    let mindMapAsset;

    if (lessonId) {
      // Check for existing lesson mind map
      const { data: existingAssets } = await supabase
        .from('lesson_media_assets')
        .select('*')
        .eq('lesson_id', lessonId)
        .eq('asset_type', 'mind_map')
        .eq('status', 'completed')
        .order('created_at', { ascending: false })
        .limit(1);

      mindMapAsset = existingAssets?.[0];
    } else if (baseClassId) {
      // Check for existing base class mind map
      const { data: existingAssets } = await supabase
        .from('base_class_media_assets')
        .select('*')
        .eq('base_class_id', baseClassId)
        .eq('asset_type', 'mind_map')
        .eq('status', 'completed')
        .order('created_at', { ascending: false })
        .limit(1);

      mindMapAsset = existingAssets?.[0];
    }

    if (!mindMapAsset) {
      return NextResponse.json({ 
        exists: false, 
        message: 'No mind map found' 
      });
    }

    return NextResponse.json({
      exists: true,
      asset: {
        id: mindMapAsset.id,
        type: 'mind_map',
        url: `/api/teach/media/mind-map/${mindMapAsset.id}`,
        title: mindMapAsset.title,
        metadata: (mindMapAsset as any).metadata || null
      }
    });

  } catch (error) {
    console.error('Error checking for mind map:', error);
    return NextResponse.json({ error: 'Failed to check mind map' }, { status: 500 });
  }
}