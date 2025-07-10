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
      questionTypes,
      difficulty,
      numQuestions,
      bloomTaxonomy,
      learningObjectives,
      focusAreas,
      questionDistribution
    });

    // Validate required fields
    if (!lessonId) {
      console.error('Validation failed: lessonId is required');
      return NextResponse.json(
        { error: 'lessonId is required' }, 
        { status: 400 }
      );
    }

    // Initialize the question generation service
    const questionService = new QuestionGenerationService();

    // Fetch lesson basic info
    const { data: lesson, error: lessonError } = await supabase
      .from('lessons')
      .select('id, title, description, base_class_id')
      .eq('id', lessonId)
      .single();

    if (lessonError || !lesson) {
      console.error('Lesson not found:', lessonError);
      return NextResponse.json({ error: 'Lesson not found' }, { status: 404 });
    }

    // Fetch lesson sections content
    const { data: lessonSections, error: sectionsError } = await supabase
      .from('lesson_sections')
      .select('title, content, section_type, order_index')
      .eq('lesson_id', lessonId)
      .order('order_index');

    // Fetch generated lesson content
    const { data: generatedContent, error: generatedError } = await supabase
      .from('generated_lesson_content')
      .select('content_type, generated_content')
      .eq('lesson_id', lessonId);

    // Combine all content sources
    let content = `${lesson.title}\n\n${lesson.description || ''}`;

    // Add lesson sections content
    if (lessonSections && lessonSections.length > 0) {
      content += '\n\nLesson Sections:\n';
      lessonSections.forEach(section => {
        content += `\n${section.title}\n`;
        if (section.content) {
          // Handle JSONB content - extract text content
          const sectionContent = typeof section.content === 'object' 
            ? JSON.stringify(section.content) 
            : section.content;
          content += `${sectionContent}\n`;
        }
      });
    }

    // Add generated content
    if (generatedContent && generatedContent.length > 0) {
      content += '\n\nGenerated Content:\n';
      generatedContent.forEach(gc => {
        content += `\n${gc.content_type}:\n`;
        const genContent = typeof gc.generated_content === 'object'
          ? JSON.stringify(gc.generated_content)
          : gc.generated_content;
        content += `${genContent}\n`;
      });
    }

    content = content.trim();
    
    if (!content || content === lesson.title) {
      return NextResponse.json({ error: 'Lesson has no content to generate questions from' }, { status: 400 });
    }

    // Generate questions from content
    const questions = await questionService.generateQuestionsFromContent(
      content,
      numQuestions,
      questionTypes,
      lesson.base_class_id,
      focusAreas || []
    );

    return NextResponse.json({
      success: true,
      questions: questions,
      metadata: {
        questionCount: questions.length,
        questionTypes,
        difficulty,
        bloomTaxonomy,
        learningObjectives
      },
      sourceContent: content
    });

  } catch (error) {
    console.error('Question generation error:', error);
    return NextResponse.json(
      { error: 'Failed to generate questions from content', details: error instanceof Error ? error.message : 'Unknown error' }, 
      { status: 500 }
    );
  }
} 