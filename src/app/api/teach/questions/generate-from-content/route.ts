import { NextRequest, NextResponse } from 'next/server';
import { createServerClient, type CookieOptions } from '@supabase/ssr';
import { cookies } from 'next/headers';
import { QuestionGenerationService } from '@/lib/services/question-generation-service';

export async function POST(request: NextRequest) {
  try {
    const cookieStore = await cookies();
    
    // Create Supabase client using the same pattern as other API routes
    const supabase = createServerClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      {
        cookies: {
          get(name: string) {
            return cookieStore.get(name)?.value;
          },
          set(name: string, value: string, options: CookieOptions) {
            try {
              cookieStore.set({ name, value, ...options });
            } catch (error) {
              // Ignore error on Server Components (middleware handles refresh)
            }
          },
          remove(name: string, options: CookieOptions) {
            try {
              cookieStore.set({ name, value: '', ...options });
            } catch (error) {
              // Ignore error on Server Components (middleware handles refresh)
            }
          },
        },
      }
    );

    // Use getUser() for secure authentication instead of getSession()
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      console.error('Authentication error:', authError);
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    console.log('Request body received:', JSON.stringify(body, null, 2));
    
    const { 
      lessonId, 
      sectionIds, 
      baseClassId,
      questionTypes = ['multiple_choice'], 
      difficulty = 'medium',
      numQuestions = 5,
      bloomTaxonomy = 'understand',
      learningObjectives = [],
      focusAreas = [],
      questionDistribution
    } = body;

    console.log('Parsed request parameters:', {
      lessonId,
      sectionIds,
      baseClassId,
      questionTypes,
      difficulty,
      numQuestions,
      bloomTaxonomy,
      learningObjectives,
      focusAreas,
      questionDistribution
    });

    // Validate required fields
    if (!baseClassId) {
      console.error('Validation failed: baseClassId is required');
      return NextResponse.json(
        { error: 'baseClassId is required' }, 
        { status: 400 }
      );
    }

    // If no lessonId or sectionIds provided, we'll generate from all lessons in the base class
    // This is handled by the service layer
    console.log('Validation passed - proceeding with question generation');

    // Initialize the question generation service
    const questionService = new QuestionGenerationService(supabase);

    // Generate questions from content
    const result = await questionService.generateQuestionsFromContent({
      lessonId,
      sectionIds,
      baseClassId,
      questionTypes,
      difficulty,
      numQuestions,
      bloomTaxonomy,
      learningObjectives,
      focusAreas,
      questionDistribution,
      userId: user.id
    });

    return NextResponse.json({
      success: true,
      questions: result.questions,
      metadata: result.metadata,
      sourceContent: result.sourceContent
    });

  } catch (error) {
    console.error('Question generation error:', error);
    return NextResponse.json(
      { error: 'Failed to generate questions from content', details: error instanceof Error ? error.message : 'Unknown error' }, 
      { status: 500 }
    );
  }
} 