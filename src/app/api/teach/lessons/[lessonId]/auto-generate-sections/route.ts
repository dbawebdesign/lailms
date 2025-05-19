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

    const aiPrompt = `
      You are an expert curriculum designer and subject matter specialist tasked with creating detailed, engaging, and comprehensive lesson sections for an online learning platform.
      Your goal is to generate the actual teaching content that will take a learner from beginner to mastery for the specified grade level and lesson objective.

      **Lesson Context:**
      - Base Class Name: ${base_class_name || 'N/A'}
      - Subject: ${base_class_subject || 'N/A'}
      - Grade Level: ${base_class_gradeLevel || 'N/A'}
      - Path (Module) Title: ${path_title || 'N/A'}
      - Lesson Title: ${lesson_title}
      - Lesson Objective: ${lesson_objective || 'No specific objective provided, infer from title and context.'}

      **Instructions for Generating Lesson Sections:**
      1.  **Output Format:** STRICTLY provide your response as a single JSON array. Each element in the array must be an object representing a lesson section, adhering to the following TypeScript interface:
          \`\`\`typescript
          interface AISection {
            title: string; // Clear, descriptive title for the section.
            section_type: 'introduction' | 'core_concept' | 'example' | 'activity' | 'media_suggestion' | 'quiz' | 'summary' | 'other'; // Type of the section.
            content_text: string; // The FULL educational content for this section. Write as if directly teaching the student. Make it comprehensive and clear for the grade level.
            media_description?: string; // Optional. If relevant, describe a suggested visual aid (e.g., "[IMAGE: Diagram of the water cycle with labels]", "[VIDEO: Short animation of cell division]").
            quiz_questions?: { // Required if section_type is 'quiz'.
              question_text: string;
              options: string[]; // Array of 2-4 answer options.
              correct_option_index: number; // 0-indexed integer indicating the correct option.
              explanation?: string; // Optional. Brief explanation for why the answer is correct.
            }[];
          }
          \`\`\`
          Your entire response must be ONLY this JSON array, starting with '[' and ending with ']'.

      2.  **Number of Sections:** Generate approximately 5-8 detailed sections for this lesson to ensure thorough coverage.

      3.  **Content Quality & Pedagogy:**
          *   **Comprehensive Content:** The \`content_text\` for each section must be the actual, complete teaching material. Do not provide outlines or summaries instead of full content.
          *   **Progressive Learning:** Structure the sections to logically guide the learner from foundational concepts to more advanced understanding, achieving the lesson objective.
          *   **Engagement:** Write in an engaging, clear, and age-appropriate tone for the specified \`${base_class_gradeLevel || 'target'}\` grade level.
          *   **Clarity:** Explain concepts thoroughly. Use examples where appropriate ('example' section_type).
          *   **Active Learning:** Subtly embed questions or brief interactive prompts within the \`content_text\` of relevant sections to encourage student thinking, even if not a formal quiz section.
          *   **Multimedia Integration:** For \`media_suggestion\` sections, or when appropriate in other sections, provide a \`media_description\` for relevant images, diagrams, or video ideas that would enhance understanding. Use placeholders like "[IMAGE: Description]" or "[VIDEO: Description]".
          *   **Assessment:** Include AT LEAST ONE section with \`section_type: 'quiz'\'. This quiz should assess understanding of key concepts from the lesson. Provide 2-4 questions, each with options, the correct answer index, and optionally an explanation.

      4.  **Section Types:** Utilize a mix of \`section_type\` values to create a well-rounded lesson. Essential types include:
          *   \`introduction\`: Overview of the lesson, what students will learn, and its importance.
          *   \`core_concept\`: Detailed explanation of key theories, ideas, or information.
          *   \`example\`: Illustrative examples to clarify core concepts.
          *   \`activity\` (optional): Suggest a simple activity students can do.
          *   \`media_suggestion\` (optional): Specifically call out a point where media would be highly beneficial.
          *   \`quiz\`: A set of questions to assess understanding.
          *   \`summary\`: Recap of key takeaways from the lesson.

      Provide ONLY the JSON array of lesson sections as your response.
      Based on the lesson title "${lesson_title}" and objective "${lesson_objective || 'N/A'}" for a ${base_class_gradeLevel || 'N/A'} ${base_class_subject || 'N/A'} class, generate the lesson sections now.
    `;

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
            content: 'You are an expert curriculum designer. Your response MUST be a valid JSON array of lesson sections, adhering to the structure previously defined. Do not include any text outside of this JSON array.' 
          },
          { 
            role: 'user', 
            content: aiPrompt 
          }
        ],
        // Some OpenAI models support a response_format parameter for JSON output, e.g., response_format: { type: "json_object" }
        // However, for complex array structures, it's often more reliable to instruct via prompt and parse, as we are doing.
        // If gpt-4.1-mini specifically supports a JSON mode that guarantees array output, that could be used.
        temperature: 0.7, // Adjust for creativity vs. determinism
        // max_tokens: 4000, // Adjust as needed, ensure it's enough for detailed sections
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