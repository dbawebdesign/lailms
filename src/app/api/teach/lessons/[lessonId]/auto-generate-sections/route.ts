import { NextResponse, NextRequest } from 'next/server';
import { createSupabaseServerClient } from '@/lib/supabase/server';
import { Lesson, Path, BaseClass, GeneratedOutline } from '@/types/teach';
import { OpenAI } from 'openai';
// We'll need types for Lesson, Path, BaseClass, and the AI's response structure
// import { AISectionResponse } from '@/types/ai'; // Assuming a type for AI response

// Define a more specific type for the data we expect from the Supabase query
interface LessonContextForAI {
  lesson_id: string;
  lesson_title: string;
  lesson_objective?: string | null; // Assuming lessons have an objective or description
  path_title?: string | null;
  path_description?: string | null;
  base_class_name?: string | null;
  base_class_description?: string | null;
  base_class_subject?: string | null;
  base_class_gradeLevel?: string | null;
  base_class_settings?: { 
    generatedOutline?: GeneratedOutline;
    [key: string]: any; 
  } | null;
}

// Placeholder for the AI's response structure for a single section
interface AISection {
  title: string;
  section_type: 'introduction' | 'core_concept' | 'example' | 'activity' | 'media_suggestion' | 'quiz' | 'summary' | 'other';
  content_text: string; // Main textual content for the section
  media_description?: string; // Description of a suggested image, diagram, video, etc.
  quiz_questions?: {
    question_text: string;
    options: string[]; // Array of answer options
    correct_option_index: number; // 0-indexed
    explanation?: string; // Explanation for the correct answer
  }[];
}

// Placeholder for the array of sections from AI
type AIResponseSections = AISection[];

// Initialize OpenAI client outside the POST handler to be reused
// Ensure OPENAI_API_KEY is set in your environment variables
const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

export async function POST(
  request: NextRequest,
  { params }: { params: { lessonId: string } }
) {
  const { lessonId } = params;
  console.log(`[auto-generate-sections] Received request for lessonId: ${lessonId}`);

  if (!lessonId) {
    console.error("[auto-generate-sections] Error: Lesson ID is required.");
    return NextResponse.json({ error: 'Lesson ID is required' }, { status: 400 });
  }

  const supabase = createSupabaseServerClient();

  try {
    // 1. Authenticate user
    const { data: { user }, error: userError } = await supabase.auth.getUser();
    if (userError || !user) {
      console.error(`[auto-generate-sections] Authentication error for lessonId ${lessonId}:`, userError || 'User not found');
      return NextResponse.json(
        { 
          error: 'Authentication required', 
          details: userError?.message || 'No user session found.' 
        }, 
        { status: 401 }
      );
    }
    console.log(`[auto-generate-sections] User authenticated: ${user.id} for lessonId: ${lessonId}`);

    // 2. Fetch Lesson, Path, and BaseClass data
    const { data: lessonData, error: lessonError } = await supabase
      .from('lessons')
      .select(`
        id,
        title,
        description,
        paths (
          id,
          title,
          description,
          base_classes (
            id,
            name,
            description,
            settings
          )
        )
      `)
      .eq('id', lessonId)
      .single();

    if (lessonError || !lessonData) {
      console.error(`[auto-generate-sections] Error fetching comprehensive lesson data for ${lessonId}:`, lessonError);
      let status = 500;
      let errorMsg = 'Failed to fetch lesson data';
      if (lessonError?.code === 'PGRST116' || !lessonData) { // PGRST116: "Searched for a single row, but found no rows" or multiple rows (should not happen for .single() with ID)
        status = 404;
        errorMsg = 'Lesson not found';
      }
      return NextResponse.json({ error: errorMsg, details: lessonError?.message }, { status });
    }

    // Type assertion for stricter type checking
    const typedLessonData = lessonData as unknown as {
      id: string;
      title: string;
      description: string | null;
      paths: {
        id: string;
        title: string | null;
        description: string | null;
        base_classes: {
          id: string;
          name: string | null;
          description: string | null;
          settings: { 
            subject?: string; 
            gradeLevel?: string; 
            generatedOutline?: GeneratedOutline; 
            [key: string]: any; 
          } | null;
        } | null;
      } | null;
    };

    if (!typedLessonData.paths) {
      console.error(`[auto-generate-sections] Lesson ${lessonId} is not associated with a path.`);
      return NextResponse.json({ error: 'Lesson is not associated with a path.' }, { status: 404 });
    }

    if (!typedLessonData.paths.base_classes) {
      console.error(`[auto-generate-sections] Path ${typedLessonData.paths.id} for lesson ${lessonId} is not associated with a base class.`);
      return NextResponse.json({ error: 'Path is not associated with a base class.' }, { status: 404 });
    }

    const lessonContext: LessonContextForAI = {
      lesson_id: typedLessonData.id,
      lesson_title: typedLessonData.title,
      lesson_objective: typedLessonData.description,
      path_title: typedLessonData.paths.title,
      path_description: typedLessonData.paths.description,
      base_class_name: typedLessonData.paths.base_classes.name,
      base_class_description: typedLessonData.paths.base_classes.description,
      base_class_subject: typedLessonData.paths.base_classes.settings?.subject,
      base_class_gradeLevel: typedLessonData.paths.base_classes.settings?.gradeLevel,
      base_class_settings: typedLessonData.paths.base_classes.settings,
    };

    console.log(`[auto-generate-sections] Fetched context for lesson ${lessonId}:`, JSON.stringify(lessonContext, null, 2));

    // 3. Construct the AI Prompt
    const { 
      lesson_title, 
      lesson_objective, 
      path_title, 
      base_class_name, 
      base_class_subject, 
      base_class_gradeLevel 
    } = lessonContext;

    const aiPrompt = `# Role & Objective
You are an expert curriculum designer and subject matter specialist. Your task is to create detailed, engaging lesson sections that will take learners from beginner to mastery for the specified grade level and lesson objective.

# Lesson Context
- **Base Class**: ${base_class_name || 'N/A'}
- **Subject**: ${base_class_subject || 'N/A'}
- **Grade Level**: ${base_class_gradeLevel || 'N/A'}
- **Module Title**: ${path_title || 'N/A'}
- **Lesson Title**: ${lesson_title}
- **Lesson Objective**: ${lesson_objective || 'No specific objective provided, infer from title and context.'}

# Instructions

## Output Requirements
1. **Format**: Return ONLY a valid JSON array
2. **Structure**: Each array element must be a lesson section object
3. **Validation**: Ensure all required fields are present and properly formatted

## TypeScript Interface
\`\`\`typescript
interface AISection {
  title: string; // Clear, descriptive section title
  section_type: 'introduction' | 'core_concept' | 'example' | 'activity' | 'media_suggestion' | 'quiz' | 'summary' | 'other';
  content_text: string; // Complete educational content - write as if directly teaching the student
  media_description?: string; // Optional visual aid description (e.g., "[IMAGE: Diagram of water cycle]")
  quiz_questions?: { // Required only if section_type is 'quiz'
    question_text: string;
    options: string[]; // 2-4 answer options
    correct_option_index: number; // 0-indexed correct answer
    explanation?: string; // Optional explanation for correct answer
  }[];
}
\`\`\`

## Content Development Guidelines
1. **Comprehensive Content**: Write complete teaching material in \`content_text\`, not outlines or summaries
2. **Progressive Learning**: Structure sections to build from foundational to advanced concepts
3. **Grade Appropriateness**: Use clear, age-appropriate language for ${base_class_gradeLevel || 'target'} grade level
4. **Engagement**: Include interactive prompts and questions within content to encourage thinking
5. **Multimedia Integration**: Suggest relevant visual aids using \`media_description\` when beneficial
6. **Assessment Integration**: Include at least one quiz section with 2-4 well-crafted questions

## Section Structure Requirements
1. **Number of Sections**: Generate 5-8 detailed sections for thorough coverage
2. **Required Section Types**:
   - \`introduction\`: Lesson overview and learning objectives
   - \`core_concept\`: Detailed explanation of key theories/information (use multiple if needed)
   - \`example\`: Illustrative examples to clarify concepts
   - \`quiz\`: Assessment questions (at least one section)
   - \`summary\`: Key takeaways and lesson recap
3. **Optional Section Types**:
   - \`activity\`: Hands-on learning exercises
   - \`media_suggestion\`: Specific multimedia recommendations

## Quality Standards
- **Clarity**: Explain concepts thoroughly with appropriate examples
- **Depth**: Provide substantial content that achieves the lesson objective
- **Interactivity**: Embed questions and prompts to maintain engagement
- **Assessment**: Create meaningful quiz questions that test understanding
- **Visual Support**: Suggest diagrams, images, or videos where they enhance learning

# Output Format
Return ONLY the JSON array starting with '[' and ending with ']'. No additional text, explanations, or formatting.

Based on the lesson "${lesson_title}" with objective "${lesson_objective || 'N/A'}" for ${base_class_gradeLevel || 'N/A'} ${base_class_subject || 'N/A'}, generate the lesson sections now.`;

    console.log("[auto-generate-sections] Generated AI Prompt:", aiPrompt);

    // 4. Call AI Model
    let sectionsFromAI: AIResponseSections = [];
    try {
      console.log(`[auto-generate-sections] Calling OpenAI with model gpt-4.1-mini for lessonId: ${lessonId}`);
      const completion = await openai.chat.completions.create({
        model: 'gpt-4.1-mini', // User specified model
        messages: [
          { 
            role: 'system', 
            content: `# Role & Objective
You are an expert curriculum designer who creates comprehensive lesson sections for online learning platforms.

# Instructions
- Return ONLY a valid JSON array of lesson sections
- Follow the exact structure specified in the user prompt
- Ensure all content is grade-appropriate and educationally sound
- Create engaging, complete teaching material that achieves learning objectives
- CRITICAL: Output must be valid JSON only, no additional text or formatting` 
          },
          { 
            role: 'user', 
            content: aiPrompt 
          }
        ],
        temperature: 0.7, // Adjust for creativity vs. determinism
        max_tokens: 4000, // Ensure enough tokens for detailed sections
      });

      const aiResponseContent = completion.choices[0]?.message?.content;
      if (!aiResponseContent) {
        console.error(`[auto-generate-sections] OpenAI response content is null or empty for lessonId: ${lessonId}`);
        throw new Error('OpenAI returned empty content.');
      }

      console.log(`[auto-generate-sections] Received raw AI response for lessonId ${lessonId}:
${aiResponseContent.substring(0, 500)}...`); // Log a snippet

      // Attempt to parse the JSON response
      // The prompt strongly instructs for JSON, but let's be safe
      try {
        sectionsFromAI = JSON.parse(aiResponseContent) as AIResponseSections;
        // Basic validation if it parsed into an array
        if (!Array.isArray(sectionsFromAI)) {
          console.error(`[auto-generate-sections] AI response was not a JSON array for lessonId ${lessonId}. Content: ${aiResponseContent}`);
          throw new Error('AI response was not a valid JSON array as expected.');
        }
      } catch (parseError: any) {
        console.error(`[auto-generate-sections] Failed to parse AI JSON response for lessonId ${lessonId}:`, parseError);
        console.error(`[auto-generate-sections] Raw AI content that failed to parse for lessonId ${lessonId}: ${aiResponseContent}`);
        throw new Error(`Failed to parse AI response. Details: ${parseError.message}`);
      }

    } catch (aiError: any) {
      console.error(`[auto-generate-sections] Error calling OpenAI for lessonId ${lessonId}:`, aiError.response?.data || aiError.message);
      return NextResponse.json({ error: 'Failed to generate content from AI', details: aiError.message }, { status: 500 });
    }

    if (sectionsFromAI.length === 0) {
      console.warn(`[auto-generate-sections] AI generated no sections for lessonId: ${lessonId}`);
      // Decide if this is an error or acceptable. For now, let's return success with empty data.
      return NextResponse.json({ message: 'AI generated no sections. Process completed.', data: [] }, { status: 200 });
    }

    // 5. Process AI Response and Prepare for DB Insert
    console.log(`[auto-generate-sections] Processing ${sectionsFromAI.length} sections from AI for lessonId: ${lessonId}`);
    const lessonSectionsToInsert = sectionsFromAI.map((section, index) => {
      let sectionContent: any = { text: section.content_text }; // Default content structure

      if (section.media_description) {
        sectionContent.media_description = section.media_description;
      }

      if (section.section_type === 'quiz' && section.quiz_questions && section.quiz_questions.length > 0) {
        sectionContent = {
          instructions: section.content_text, // For quizzes, content_text can be general instructions
          questions: section.quiz_questions.map(q => ({
            question_text: q.question_text,
            options: q.options,
            correct_option_index: q.correct_option_index,
            explanation: q.explanation || null,
          })),
        };
      } else if (section.section_type === 'quiz') {
        // Handle case where AI says it's a quiz but provides no questions - log and treat as standard content
        console.warn(`[auto-generate-sections] Section marked as quiz but has no questions for lessonId ${lessonId}, title: "${section.title}". Treating as standard text.`);
        // sectionContent remains as { text: section.content_text, media_description?: ... }
      }

      return {
        lesson_id: lessonId,
        title: section.title || 'Untitled Section', // Fallback title
        content: sectionContent, // This will be JSONB
        media_url: null, // To be filled later if actual URLs are generated/found
        order_index: index,
        section_type: section.section_type,
        created_by: user.id, // Authenticated user ID
        // content_embedding will be null initially, handled by DB or another process
      };
    });

    console.log(`[auto-generate-sections] Prepared ${lessonSectionsToInsert.length} sections for DB insert for lessonId: ${lessonId}. Sample: ${JSON.stringify(lessonSectionsToInsert[0], null, 2)}`);

    // 6. Insert into lesson_sections table
    const { data: insertedSections, error: insertError } = await supabase
      .from('lesson_sections')
      .insert(lessonSectionsToInsert)
      .select(); // Optionally select the inserted data to return or log

    if (insertError) {
      console.error(`[auto-generate-sections] Error inserting lesson sections for ${lessonId}:`, insertError);
      return NextResponse.json({ error: 'Failed to save generated sections', details: insertError.message }, { status: 500 });
    }

    console.log(`[auto-generate-sections] Successfully generated and saved ${insertedSections?.length || 0} sections for lessonId: ${lessonId}`);
    return NextResponse.json(
      { 
        message: 'Lesson sections generated successfully', 
        data: insertedSections // Or the actual inserted data with IDs
      }, 
      { status: 201 }
    );

  } catch (error: any) {
    console.error(`[auto-generate-sections] Unexpected error for lessonId ${lessonId}:`, error);
    return NextResponse.json({ error: 'An unexpected error occurred', details: error.message }, { status: 500 });
  }
} 