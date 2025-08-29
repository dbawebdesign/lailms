import { NextResponse, NextRequest } from 'next/server';
import { createSupabaseServerClient } from '@/lib/supabase/server';
import { OpenAI } from 'openai';

// Types for the single section generation
interface SingleSectionRequest {
  lessonId: string;
  sectionTitle: string;
  sectionDescription?: string;
  insertPosition: 'above' | 'below';
  referenceItemId?: string; // ID of the item we're inserting relative to
}

interface LessonContext {
  lesson_id: string;
  lesson_title: string;
  lesson_description?: string | null;
  lesson_order_index?: number | null;
  
  // Path context
  path_id: string;
  path_title?: string | null;
  path_description?: string | null;
  
  // Base class context
  base_class_id: string;
  base_class_name?: string | null;
  base_class_description?: string | null;
  base_class_subject?: string | null;
  base_class_gradeLevel?: string | null;
  
  // Organization context
  organisation_id: string;
}

interface KnowledgeBaseChunk {
  id: string;
  document_id: string;
  content: string;
  chunk_summary?: string | null;
  section_identifier?: string | null;
  citation_key?: string | null;
  metadata: Record<string, any> | null;
  similarity: number;
  file_name: string | null;
  file_type: string | null;
}

interface AIGeneratedSection {
  sectionTitle: string;
  introduction: string;
  expertTeachingContent: {
    conceptIntroduction: string;
    detailedExplanation: string;
    expertInsights: string[];
    practicalExamples: Array<{
      title: string;
      context: string;
      walkthrough: string;
      keyTakeaways: string[];
    }>;
    realWorldConnections: string[];
    commonMisconceptions: Array<{
      misconception: string;
      correction: string;
      prevention: string;
    }>;
  };
  checkForUnderstanding: string[];
  expertSummary: string;
  bridgeToNext: string;
}

// Initialize OpenAI client
const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

/**
 * Generate embeddings for search queries
 */
async function generateEmbedding(text: string): Promise<number[]> {
  try {
    const response = await openai.embeddings.create({
      model: 'text-embedding-3-small',
      input: text,
      dimensions: 1536
    });
    return response.data[0].embedding;
  } catch (error) {
    console.error('Error generating embedding:', error);
    throw new Error('Failed to generate embedding for search');
  }
}

/**
 * Get relevant knowledge base content for the lesson section
 */
async function getRelevantKnowledgeBaseContent(
  supabase: any,
  lessonContext: LessonContext,
  sectionTitle: string,
  sectionDescription?: string
): Promise<KnowledgeBaseChunk[]> {
  try {
    // Create search queries based on lesson and section context
    const searchQueries = [
      `${sectionTitle} ${lessonContext.lesson_title}`,
      `${sectionTitle} ${lessonContext.base_class_subject || ''}`,
      sectionDescription || sectionTitle
    ].filter(Boolean);

    const allChunks: KnowledgeBaseChunk[] = [];

    for (const query of searchQueries) {
      try {
        const queryEmbedding = await generateEmbedding(query);
        
        const { data: chunks, error } = await supabase.rpc('vector_search_for_lesson_generation', {
          query_embedding: queryEmbedding,
          base_class_id: lessonContext.base_class_id,
          organisation_id: lessonContext.organisation_id,
          match_threshold: 0.7,
          match_count: 5
        });

        if (error) {
          console.error('Error searching knowledge base:', error);
          continue;
        }

        if (chunks && chunks.length > 0) {
          allChunks.push(...chunks);
        }
      } catch (searchError) {
        console.error('Error in individual search query:', searchError);
        continue;
      }
    }

    // Remove duplicates and return top matches
    const uniqueChunks = allChunks.filter((chunk, index, self) => 
      index === self.findIndex(c => c.id === chunk.id)
    );

    return uniqueChunks.slice(0, 8); // Limit to top 8 chunks
  } catch (error) {
    console.error('Error getting knowledge base content:', error);
    return [];
  }
}

/**
 * Generate AI content for a single lesson section
 */
async function generateSectionContent(
  lessonContext: LessonContext,
  sectionTitle: string,
  sectionDescription: string,
  knowledgeBaseChunks: KnowledgeBaseChunk[]
): Promise<AIGeneratedSection> {
  const kbContext = knowledgeBaseChunks.length > 0 
    ? knowledgeBaseChunks.map((chunk, index) => 
        `[${chunk.citation_key || `REF${index + 1}`}] ${chunk.content}`
      ).join('\n\n')
    : '';

  const citations = knowledgeBaseChunks.map(chunk => chunk.citation_key || chunk.id);

  const systemPrompt = `You are an expert educational content creator specializing in ${lessonContext.base_class_subject || 'academic subjects'} for ${lessonContext.base_class_gradeLevel || 'students'}.

Your task is to create a comprehensive lesson section that teaches like a 1-on-1 tutor with deep expertise.

CONTEXT:
- Base Class: ${lessonContext.base_class_name}
- Subject: ${lessonContext.base_class_subject || 'General'}
- Grade Level: ${lessonContext.base_class_gradeLevel || 'Not specified'}
- Learning Path: ${lessonContext.path_title}
- Lesson: ${lessonContext.lesson_title}
- Section Title: ${sectionTitle}
- Section Description: ${sectionDescription}

${kbContext ? `KNOWLEDGE BASE REFERENCES:\n${kbContext}\n` : ''}

REQUIREMENTS:
1. Create engaging, educational content that builds understanding progressively
2. Use clear explanations with concrete examples
3. Include interactive elements where appropriate
4. Reference knowledge base content when relevant using citation keys
5. Adapt complexity to the specified grade level
6. Focus on practical application and real-world connections

Create comprehensive educational content as JSON using the EXACT same format as our existing system:
{
  "sectionTitle": "${sectionTitle}",
  "introduction": "2-3 sentences that connect to prior learning and preview what this section will accomplish",
  "expertTeachingContent": {
    "conceptIntroduction": "Clear, engaging introduction to the core concept(s) with expert context",
    "detailedExplanation": "Comprehensive explanation that builds understanding progressively. Multiple detailed paragraphs that teach the concept thoroughly, as if you're sitting with the student explaining it personally.",
    "expertInsights": [
      "Professional insights that only an expert would know",
      "Common pitfalls and how to avoid them",
      "Connections to broader field knowledge"
    ],
    "practicalExamples": [
      {
        "title": "Example 1 Title",
        "context": "Why this example matters",
        "walkthrough": "Step-by-step explanation showing expert thinking",
        "keyTakeaways": ["What students should learn from this example"]
      }
    ],
    "realWorldConnections": [
      "How this concept applies in professional/real-world contexts",
      "Why experts care about this concept"
    ],
    "commonMisconceptions": [
      {
        "misconception": "What students often get wrong",
        "correction": "The correct understanding with clear explanation",
        "prevention": "How to avoid this misunderstanding"
      }
    ]
  },
  "checkForUnderstanding": [
    "Thought-provoking question that tests comprehension",
    "Application scenario to verify understanding"
  ],
  "expertSummary": "Synthesis that helps students see the big picture and connect to learning objectives",
  "bridgeToNext": "How this section connects to what comes next in the lesson"
}

CRITICAL: This content should feel like learning from a master teacher who is passionate about the subject and deeply cares about student understanding. Make it engaging, authoritative, and genuinely educational.`;

  const userPrompt = `Create a comprehensive lesson section titled "${sectionTitle}" with the description: "${sectionDescription}"

This section should:
- Build upon the lesson context: "${lessonContext.lesson_title}"
- Fit within the learning path: "${lessonContext.path_title}"
- Be appropriate for ${lessonContext.base_class_gradeLevel || 'the target grade level'}
- Include practical examples and clear explanations
- Reference relevant knowledge base content when available

Focus on creating content that truly helps students understand and apply the concepts.`;

  try {
    const response = await openai.chat.completions.create({
      model: 'gpt-4o-mini', // Using the preferred model from memory
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userPrompt }
      ],
      temperature: 0.7,
      max_tokens: 2000,
      response_format: { type: 'json_object' }
    });

    const content = response.choices[0]?.message?.content;
    if (!content) {
      throw new Error('No content generated by AI');
    }

    const generatedSection = JSON.parse(content) as AIGeneratedSection;
    
    // Ensure we have the required fields
    if (!generatedSection.sectionTitle || !generatedSection.expertTeachingContent) {
      throw new Error('AI response missing required fields');
    }

    return generatedSection;
  } catch (error) {
    console.error('Error generating section content:', error);
    throw new Error('Failed to generate section content with AI');
  }
}

/**
 * Calculate the appropriate order_index for the new section
 */
async function calculateOrderIndex(
  supabase: any,
  lessonId: string,
  insertPosition: 'above' | 'below',
  referenceItemId?: string
): Promise<number> {
  try {
    // Get all existing sections for this lesson
    const { data: sections, error } = await supabase
      .from('lesson_sections')
      .select('id, order_index')
      .eq('lesson_id', lessonId)
      .order('order_index', { ascending: true });

    if (error) {
      console.error('Error fetching sections for order calculation:', error);
      // Fallback: append to end
      return 1000;
    }

    if (!sections || sections.length === 0) {
      // First section in the lesson
      return 0;
    }

    if (!referenceItemId) {
      // No reference item, append to end
      const maxOrder = Math.max(...sections.map(s => s.order_index || 0));
      return maxOrder + 1;
    }

    // Find the reference section
    const referenceSection = sections.find(s => s.id === referenceItemId);
    if (!referenceSection) {
      // Reference not found, append to end
      const maxOrder = Math.max(...sections.map(s => s.order_index || 0));
      return maxOrder + 1;
    }

    const referenceIndex = referenceSection.order_index || 0;

    if (insertPosition === 'above') {
      // Insert above: use reference index minus 1, but ensure it's not negative
      return Math.max(0, referenceIndex - 1);
    } else {
      // Insert below: use reference index plus 1
      return referenceIndex + 1;
    }
  } catch (error) {
    console.error('Error calculating order index:', error);
    return 1000; // Fallback
  }
}

export async function POST(request: NextRequest) {
  try {
    const supabase = createSupabaseServerClient();
    
    // Get authenticated user
    const { data: { user }, error: userError } = await supabase.auth.getUser();
    if (userError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Parse request body
    const body: SingleSectionRequest = await request.json();
    const { lessonId, sectionTitle, sectionDescription = '', insertPosition, referenceItemId } = body;

    if (!lessonId || !sectionTitle) {
      return NextResponse.json({ 
        error: 'Missing required fields: lessonId and sectionTitle' 
      }, { status: 400 });
    }

    // Get comprehensive lesson context
    const { data: lessonContextData, error: contextError } = await supabase
      .from('lessons')
      .select(`
        id,
        title,
        description,
        order_index,
        path_id,
        paths!inner (
          id,
          title,
          description,
          base_class_id,
          base_classes!inner (
            id,
            name,
            description,
            organisation_id,
            settings
          )
        )
      `)
      .eq('id', lessonId)
      .single();

    if (contextError || !lessonContextData) {
      console.error('Error fetching lesson context:', contextError);
      return NextResponse.json({ 
        error: 'Lesson not found or access denied' 
      }, { status: 404 });
    }

    // Build lesson context
    const lessonContext: LessonContext = {
      lesson_id: lessonContextData.id,
      lesson_title: lessonContextData.title,
      lesson_description: lessonContextData.description,
      lesson_order_index: lessonContextData.order_index,
      path_id: lessonContextData.paths.id,
      path_title: lessonContextData.paths.title,
      path_description: lessonContextData.paths.description,
      base_class_id: lessonContextData.paths.base_classes.id,
      base_class_name: lessonContextData.paths.base_classes.name,
      base_class_description: lessonContextData.paths.base_classes.description,
      base_class_subject: lessonContextData.paths.base_classes.settings?.subject,
      base_class_gradeLevel: lessonContextData.paths.base_classes.settings?.gradeLevel,
      organisation_id: lessonContextData.paths.base_classes.organisation_id
    };

    // Get relevant knowledge base content
    const knowledgeBaseChunks = await getRelevantKnowledgeBaseContent(
      supabase,
      lessonContext,
      sectionTitle,
      sectionDescription
    );

    // Generate AI content
    const generatedSection = await generateSectionContent(
      lessonContext,
      sectionTitle,
      sectionDescription,
      knowledgeBaseChunks
    );

    // Calculate order index
    const orderIndex = await calculateOrderIndex(
      supabase,
      lessonId,
      insertPosition,
      referenceItemId
    );

    // Determine section type - default to core_concept for generated sections
    const sectionType = 'core_concept';

    // Use the structured content directly - it matches the expected database format
    const sectionContent = generatedSection;

    // Insert the new section
    const { data: insertedSection, error: insertError } = await supabase
      .from('lesson_sections')
      .insert({
        lesson_id: lessonId,
        title: generatedSection.sectionTitle,
        content: sectionContent,
        section_type: sectionType,
        order_index: orderIndex,
        created_by: user.id
      })
      .select()
      .single();

    if (insertError) {
      console.error('Error inserting lesson section:', insertError);
      return NextResponse.json({ 
        error: 'Failed to create lesson section',
        details: insertError.message 
      }, { status: 500 });
    }

    console.log(`Successfully generated and saved lesson section: ${generatedSection.title} for lesson ${lessonId}`);

    return NextResponse.json({
      message: 'Lesson section generated successfully',
      data: insertedSection,
      metadata: {
        knowledge_base_chunks_used: knowledgeBaseChunks.length,
        ai_generated: true,
        insert_position: insertPosition
      }
    }, { status: 201 });

  } catch (error: any) {
    console.error('Unexpected error in single section generation:', error);
    return NextResponse.json({ 
      error: 'An unexpected error occurred',
      details: error.message 
    }, { status: 500 });
  }
}
