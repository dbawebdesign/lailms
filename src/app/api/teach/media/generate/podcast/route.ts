import { NextRequest, NextResponse } from 'next/server';
import { createSupabaseServerClient } from '@/lib/supabase/server';
import { createClient } from '@supabase/supabase-js';
import { brainbytesGenerationService } from '@/lib/services/brainbytes-generation-service';

interface PodcastRequest {
  lessonId: string;
  content?: string; // Optional fallback content
  gradeLevel: string;
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { lessonId, content: fallbackContent, gradeLevel, userId, internal } = body;

    if (!lessonId) {
      return NextResponse.json(
        { error: 'Lesson ID is required' },
        { status: 400 }
      );
    }

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
      console.log('🔧 [PodcastAPI] Internal brainbytes request (using service role):', { lessonId, userId, internal });
    } else {
      // Handle regular requests with authentication
      supabase = createSupabaseServerClient();
      const { data: { user: authUser }, error: userError } = await supabase.auth.getUser();
      if (userError || !authUser) {
        return NextResponse.json(
          { error: 'Authentication required' },
          { status: 401 }
        );
      }
      user = authUser;
    }

    // Check if regeneration is requested
    const regenerate = request.nextUrl.searchParams.get('regenerate') === 'true';

    // Use the brainbytes generation service
    const result = await brainbytesGenerationService.generateLessonBrainbytes(
      supabase,
      lessonId,
      user,
      {
        regenerate,
        internal: !!internal,
        gradeLevel: gradeLevel || 'middle_school',
        maxRetries: 3,
        retryDelay: 2000
      }
    );

    if (!result.success) {
      // Handle specific error cases
      if (result.error?.includes('A Brain Bytes podcast already exists for this lesson')) {
        return NextResponse.json(
          { error: result.error },
          { status: 409 }
        );
      }
      
      return NextResponse.json(
        { error: result.error || 'Failed to generate Brain Bytes podcast. Please try again.' },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      asset: result.asset
    });

  } catch (error) {
    console.error('[PodcastAPI] Podcast generation error:', error);
    return NextResponse.json(
      { error: 'Failed to generate Brain Bytes podcast. Please try again.' },
      { status: 500 }
    );
  }
} 