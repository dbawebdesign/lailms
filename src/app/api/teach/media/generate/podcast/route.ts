import { NextRequest, NextResponse } from 'next/server';
import { createSupabaseServerClient } from '@/lib/supabase/server';
import { brainbytesGenerationService } from '@/lib/services/brainbytes-generation-service';

interface PodcastRequest {
  lessonId: string;
  content?: string; // Optional fallback content
  gradeLevel: string;
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { lessonId, gradeLevel } = body;

    if (!lessonId) {
      return NextResponse.json(
        { error: 'Lesson ID is required' },
        { status: 400 }
      );
    }

    const supabase = createSupabaseServerClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) return NextResponse.json({ error: 'Authentication required' }, { status: 401 });

    // Check if regeneration is requested
    const regenerate = request.nextUrl.searchParams.get('regenerate') === 'true';

    // Use the brainbytes generation service
    const result = await brainbytesGenerationService.generateLessonBrainbytes(
      supabase,
      lessonId,
      user,
      {
        regenerate,
        internal: false,
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