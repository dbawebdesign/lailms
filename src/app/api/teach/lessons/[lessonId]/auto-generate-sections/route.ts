import { NextResponse, NextRequest } from 'next/server';
import { createSupabaseServerClient } from '@/lib/supabase/server';
import { Lesson, Path, BaseClass, GeneratedOutline } from '@/types/teach';
import { OpenAI } from 'openai';

// Enhanced types for comprehensive context
interface EnhancedLessonContext {
  lesson_id: string;
  lesson_title: string;
  lesson_objective?: string | null;
  lesson_order_index?: number | null;
  
  // Path/Module context
  path_id: string;
  path_title?: string | null;
  path_description?: string | null;
  path_order_index?: number | null;
  
  // Base class context
  base_class_id: string;
  base_class_name?: string | null;
  base_class_description?: string | null;
  base_class_subject?: string | null;
  base_class_gradeLevel?: string | null;
  base_class_settings?: { 
    generatedOutline?: GeneratedOutline;
    [key: string]: any; 
  } | null;
  
  // Organization context
  organisation_id: string;
}

// Knowledge base content types
interface KnowledgeBaseChunk {
  id: string;
  document_id: string;
  content: string;
  chunk_summary?: string | null;
  section_identifier?: string | null;
  section_summary?: string | null;
  citation_key?: string | null;
  metadata: Record<string, any> | null;
  similarity: number;
  
  // Document info
  file_name: string | null;
  file_type: string | null;
  document_metadata: Record<string, any> | null;
}

interface DocumentSummary {
  id: string;
  file_name: string | null;
  file_type: string | null;
  document_summary?: string | null;
  summary_status?: string | null;
  metadata: Record<string, any> | null;
}

interface KnowledgeBaseContext {
  relevantChunks: KnowledgeBaseChunk[];
  documentSummaries: DocumentSummary[];
  totalDocuments: number;
  searchQueries: string[];
}

// AI response types
interface AISection {
  title: string;
  section_type: 'introduction' | 'core_concept' | 'example' | 'activity' | 'media_suggestion' | 'quiz' | 'summary' | 'other';
  content_text: string;
  media_description?: string;
  knowledge_base_references?: string[]; // Citation keys referenced
  quiz_questions?: {
    question_text: string;
    options: string[];
    correct_option_index: number;
    explanation?: string;
  }[];
}

type AIResponseSections = AISection[];

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
    throw new Error('Failed to generate embedding for knowledge base search');
  }
}

/**
 * Search knowledge base with multiple queries and context levels
 */
async function searchKnowledgeBase(
  context: EnhancedLessonContext,
  supabase: any
): Promise<KnowledgeBaseContext> {
  console.log(`[KB-Search] Starting knowledge base search for lesson: ${context.lesson_title}`);
  
  // Build comprehensive search queries with different specificity levels
  const searchQueries = [
    // Most specific: lesson + path + subject
    `${context.lesson_title} ${context.path_title} ${context.base_class_subject}`,
    
    // Medium specificity: lesson + subject
    `${context.lesson_title} ${context.base_class_subject}`,
    
    // Lesson objective if available
    ...(context.lesson_objective ? [`${context.lesson_objective} ${context.base_class_subject}`] : []),
    
    // Path/module level
    `${context.path_title} ${context.base_class_subject}`,
    
    // Subject + grade level for general context
    `${context.base_class_subject} ${context.base_class_gradeLevel}`,
  ].filter(Boolean);

  console.log(`[KB-Search] Generated ${searchQueries.length} search queries:`, searchQueries);

  let allRelevantChunks: KnowledgeBaseChunk[] = [];
  const seenChunkIds = new Set<string>();

  // Search with each query and combine results
  for (const query of searchQueries) {
    try {
      const embedding = await generateEmbedding(query);
      
      // Use the vector search function with base class filtering
      const { data: searchResults, error: searchError } = await supabase.rpc(
        'vector_search_with_base_class',
        {
          query_embedding: embedding,
          organisation_id: context.organisation_id,
          base_class_id: context.base_class_id,
          match_threshold: 0.6, // Higher threshold for more relevant results
          match_count: 8 // Get more results per query
        }
      );

      if (searchError) {
        console.warn(`[KB-Search] Vector search failed for query "${query}":`, searchError);
        continue;
      }

      if (searchResults && Array.isArray(searchResults)) {
        // Add unique chunks to our collection
        for (const chunk of searchResults) {
          if (!seenChunkIds.has(chunk.id)) {
            seenChunkIds.add(chunk.id);
            allRelevantChunks.push({
              ...chunk,
              similarity: 1 - (chunk.similarity || 0) // Convert distance to similarity
            });
          }
        }
      }
    } catch (error) {
      console.warn(`[KB-Search] Error searching with query "${query}":`, error);
      continue;
    }
  }

  // Sort by similarity and take top results
  allRelevantChunks.sort((a, b) => b.similarity - a.similarity);
  const topChunks = allRelevantChunks.slice(0, 15); // Top 15 most relevant chunks

  console.log(`[KB-Search] Found ${topChunks.length} relevant chunks with similarities:`, 
    topChunks.map(c => ({ id: c.id.substring(0, 8), similarity: c.similarity.toFixed(3) })));

  // Get document summaries for additional context
  const documentIds = [...new Set(topChunks.map(c => c.document_id))];
  let documentSummaries: DocumentSummary[] = [];

  if (documentIds.length > 0) {
    const { data: docSummaries, error: docError } = await supabase
      .from('documents')
      .select('id, file_name, file_type, document_summary, summary_status, metadata')
      .eq('base_class_id', context.base_class_id)
      .in('id', documentIds);

    if (!docError && docSummaries) {
      documentSummaries = docSummaries;
    }
  }

  // Get total document count for context
  const { count: totalDocuments } = await supabase
    .from('documents')
    .select('*', { count: 'exact', head: true })
    .eq('base_class_id', context.base_class_id)
    .eq('status', 'completed');

  return {
    relevantChunks: topChunks,
    documentSummaries,
    totalDocuments: totalDocuments || 0,
    searchQueries
  };
}

/**
 * Build comprehensive AI prompt with knowledge base context
 */
function buildEnhancedAIPrompt(
  lessonContext: EnhancedLessonContext,
  kbContext: KnowledgeBaseContext
): string {
  const {
    lesson_title,
    lesson_objective,
    path_title,
    path_description,
    base_class_name,
    base_class_subject,
    base_class_gradeLevel,
    base_class_description
  } = lessonContext;

  // Build knowledge base content sections
  let knowledgeBaseSection = '';
  let hasKnowledgeBase = false;
  
  if (kbContext.documentSummaries.length > 0) {
    hasKnowledgeBase = true;
    knowledgeBaseSection += `\n# Available Course Materials\n\n`;
    knowledgeBaseSection += `This course has ${kbContext.totalDocuments} documents in its knowledge base. Here are the most relevant materials:\n\n`;
    
    kbContext.documentSummaries.forEach((doc, index) => {
      knowledgeBaseSection += `## Document ${index + 1}: ${doc.file_name || 'Untitled'}\n`;
      knowledgeBaseSection += `**Type**: ${doc.file_type || 'Unknown'}\n`;
      if (doc.document_summary) {
        knowledgeBaseSection += `**Summary**: ${doc.document_summary}\n`;
      }
      knowledgeBaseSection += '\n';
    });
  }

  if (kbContext.relevantChunks.length > 0) {
    hasKnowledgeBase = true;
    knowledgeBaseSection += `\n# Relevant Content Excerpts\n\n`;
    knowledgeBaseSection += `The following content excerpts are most relevant to this lesson topic:\n\n`;
    
    kbContext.relevantChunks.slice(0, 10).forEach((chunk, index) => {
      knowledgeBaseSection += `## Excerpt ${index + 1} (Relevance: ${(chunk.similarity * 100).toFixed(1)}%)\n`;
      knowledgeBaseSection += `**Source**: ${chunk.file_name || 'Unknown'}\n`;
      if (chunk.section_identifier) {
        knowledgeBaseSection += `**Section**: ${chunk.section_identifier}\n`;
      }
      if (chunk.citation_key) {
        knowledgeBaseSection += `**Citation**: [${chunk.citation_key}]\n`;
      }
      
      // Use chunk summary if available, otherwise use content
      const contentToShow = chunk.chunk_summary || chunk.content;
      knowledgeBaseSection += `**Content**: ${contentToShow.substring(0, 500)}${contentToShow.length > 500 ? '...' : ''}\n\n`;
    });
  }
  
  // If no knowledge base materials, add a note
  if (!hasKnowledgeBase) {
    knowledgeBaseSection += `\n# Course Materials Status\n\n`;
    knowledgeBaseSection += `No specific course materials were found in the knowledge base for this lesson. Generate comprehensive content based on the course context and lesson objectives provided above.\n\n`;
  }

  return `# Role & Objective
You are an expert curriculum designer and subject matter specialist. Your task is to create detailed, engaging lesson sections that incorporate the specific course materials and knowledge base content provided below.

# Course Context
- **Course**: ${base_class_name || 'N/A'}
- **Subject**: ${base_class_subject || 'N/A'}
- **Grade Level**: ${base_class_gradeLevel || 'N/A'}
- **Course Description**: ${base_class_description || 'N/A'}

# Module Context
- **Module Title**: ${path_title || 'N/A'}
- **Module Description**: ${path_description || 'N/A'}

# Lesson Context
- **Lesson Title**: ${lesson_title}
- **Lesson Objective**: ${lesson_objective || 'No specific objective provided, infer from title and context.'}

${knowledgeBaseSection}

# Content Integration Requirements

## Primary Directive
${hasKnowledgeBase 
  ? '**CRITICAL**: You MUST incorporate and reference the specific course materials provided above. Do not create generic content - build upon the actual materials in the knowledge base.'
  : '**IMPORTANT**: No specific course materials were found in the knowledge base. Create comprehensive, educationally sound content based on the course context, subject matter, and lesson objectives provided above.'
}

## Content Integration Guidelines
${hasKnowledgeBase 
  ? `1. **Source-Based Content**: Base your lesson sections on the specific excerpts and documents provided
2. **Citation Integration**: Reference materials using their citation keys (e.g., [citation-key])
3. **Content Synthesis**: Combine information from multiple sources when relevant
4. **Factual Accuracy**: Use only information present in the provided materials
5. **Progressive Building**: Structure content to build upon the knowledge base materials`
  : `1. **Subject-Based Content**: Create comprehensive content appropriate for ${base_class_subject || 'the subject'} at ${base_class_gradeLevel || 'the target'} level
2. **Pedagogical Structure**: Use sound educational principles to structure learning
3. **Objective Alignment**: Ensure content directly addresses the lesson objective
4. **Academic Rigor**: Maintain appropriate academic standards for the grade level
5. **Progressive Learning**: Build concepts from foundational to advanced`
}

## Output Requirements
1. **Format**: Return ONLY a valid JSON array
2. **Structure**: Each array element must be a lesson section object
3. **Validation**: Ensure all required fields are present and properly formatted

## TypeScript Interface
\`\`\`typescript
interface AISection {
  title: string; // Clear, descriptive section title
  section_type: 'introduction' | 'core_concept' | 'example' | 'activity' | 'media_suggestion' | 'quiz' | 'summary' | 'other';
  content_text: string; // Complete educational content incorporating knowledge base materials
  media_description?: string; // Optional visual aid description
  knowledge_base_references?: string[]; // Array of citation keys referenced in this section
  quiz_questions?: { // Required only if section_type is 'quiz'
    question_text: string;
    options: string[]; // 2-4 answer options
    correct_option_index: number; // 0-indexed correct answer
    explanation?: string; // Optional explanation for correct answer
  }[];
}
\`\`\`

## Content Development Guidelines
1. **Knowledge Base First**: Start with the provided materials, then enhance with pedagogical structure
2. **Comprehensive Content**: Write complete teaching material incorporating specific course content
3. **Progressive Learning**: Structure sections to build from foundational to advanced concepts
4. **Grade Appropriateness**: Use clear, age-appropriate language for ${base_class_gradeLevel || 'target'} grade level
5. **Engagement**: Include interactive prompts and questions within content
6. **Source Integration**: Seamlessly weave in content from the knowledge base excerpts
7. **Citation Practice**: Include citation keys in knowledge_base_references array for each section

## Section Structure Requirements
1. **Number of Sections**: Generate 6-10 detailed sections for thorough coverage
2. **Required Section Types**:
   - \`introduction\`: Lesson overview connecting to course materials
   - \`core_concept\`: Detailed explanation based on knowledge base content (use multiple if needed)
   - \`example\`: Specific examples from the provided materials
   - \`quiz\`: Assessment questions based on the actual course content
   - \`summary\`: Key takeaways synthesizing the knowledge base materials
3. **Optional Section Types**:
   - \`activity\`: Hands-on exercises using course materials
   - \`media_suggestion\`: Specific multimedia from the knowledge base

## Quality Standards
- **Source Fidelity**: Accurately represent information from the knowledge base
- **Educational Value**: Transform raw content into structured learning experiences
- **Coherence**: Create logical flow between sections while maintaining source accuracy
- **Assessment Alignment**: Create quiz questions that test understanding of actual course materials
- **Citation Completeness**: Include all relevant citation keys in knowledge_base_references

# Output Format
Return ONLY the JSON array starting with '[' and ending with ']'. No additional text, explanations, or formatting.

Based on the lesson "${lesson_title}" with objective "${lesson_objective || 'N/A'}" for ${base_class_gradeLevel || 'N/A'} ${base_class_subject || 'N/A'}, and incorporating the specific course materials provided above, generate the lesson sections now.`;
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ lessonId: string }> }
) {
  const supabase = createSupabaseServerClient();
  const { lessonId } = await params;
  console.log(`[auto-generate-sections] Received request for lessonId: ${lessonId}`);

  if (!lessonId) {
    console.error("[auto-generate-sections] Error: Lesson ID is required.");
    return NextResponse.json({ error: 'Lesson ID is required' }, { status: 400 });
  }

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

    // 2. Fetch comprehensive lesson, path, and base class data with organization info
    const { data: lessonData, error: lessonError } = await supabase
      .from('lessons')
      .select(`
        id,
        title,
        description,
        order_index,
        paths (
          id,
          title,
          description,
          order_index,
          base_classes (
            id,
            name,
            description,
            settings,
            organisation_id
          )
        )
      `)
      .eq('id', lessonId)
      .single();

    if (lessonError || !lessonData) {
      console.error(`[auto-generate-sections] Error fetching comprehensive lesson data for ${lessonId}:`, lessonError);
      let status = 500;
      let errorMsg = 'Failed to fetch lesson data';
      if (lessonError?.code === 'PGRST116' || !lessonData) {
        status = 404;
        errorMsg = 'Lesson not found';
      }
      return NextResponse.json({ error: errorMsg, details: lessonError?.message }, { status });
    }

    // Type assertion and validation
    const typedLessonData = lessonData as unknown as {
      id: string;
      title: string;
      description: string | null;
      order_index: number | null;
      paths: {
        id: string;
        title: string | null;
        description: string | null;
        order_index: number | null;
        base_classes: {
          id: string;
          name: string | null;
          description: string | null;
          organisation_id: string;
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

    // Build enhanced lesson context
    const enhancedContext: EnhancedLessonContext = {
      lesson_id: typedLessonData.id,
      lesson_title: typedLessonData.title,
      lesson_objective: typedLessonData.description,
      lesson_order_index: typedLessonData.order_index,
      
      path_id: typedLessonData.paths.id,
      path_title: typedLessonData.paths.title,
      path_description: typedLessonData.paths.description,
      path_order_index: typedLessonData.paths.order_index,
      
      base_class_id: typedLessonData.paths.base_classes.id,
      base_class_name: typedLessonData.paths.base_classes.name,
      base_class_description: typedLessonData.paths.base_classes.description,
      base_class_subject: typedLessonData.paths.base_classes.settings?.subject,
      base_class_gradeLevel: typedLessonData.paths.base_classes.settings?.gradeLevel,
      base_class_settings: typedLessonData.paths.base_classes.settings,
      
      organisation_id: typedLessonData.paths.base_classes.organisation_id,
    };

    console.log(`[auto-generate-sections] Enhanced context for lesson ${lessonId}:`, JSON.stringify(enhancedContext, null, 2));

    // 3. Search knowledge base for relevant content
    const kbContext = await searchKnowledgeBase(enhancedContext, supabase);
    
    console.log(`[auto-generate-sections] Knowledge base context: ${kbContext.relevantChunks.length} chunks, ${kbContext.documentSummaries.length} document summaries`);
    
    // Debug: Check if we have any documents at all for this base class
    if (kbContext.relevantChunks.length === 0) {
      const { count: totalDocs } = await supabase
        .from('documents')
        .select('*', { count: 'exact', head: true })
        .eq('base_class_id', enhancedContext.base_class_id);
      
      const { count: completedDocs } = await supabase
        .from('documents')
        .select('*', { count: 'exact', head: true })
        .eq('base_class_id', enhancedContext.base_class_id)
        .eq('status', 'completed');
        
      console.log(`[auto-generate-sections] Debug - Total documents for base class: ${totalDocs || 0}, Completed: ${completedDocs || 0}`);
    }

    // 4. Build enhanced AI prompt with knowledge base integration
    const aiPrompt = buildEnhancedAIPrompt(enhancedContext, kbContext);
    
    console.log(`[auto-generate-sections] Generated enhanced AI prompt (${aiPrompt.length} chars) for lessonId: ${lessonId}`);

    // 5. Call AI Model with enhanced prompt
    let sectionsFromAI: AIResponseSections = [];
    try {
      console.log(`[auto-generate-sections] Calling OpenAI with enhanced knowledge base context for lessonId: ${lessonId}`);
      const completion = await openai.chat.completions.create({
        model: 'gpt-4.1-mini', // Use the more capable model for complex knowledge integration
        messages: [
          { 
            role: 'system', 
            content: `You are an expert curriculum designer who creates comprehensive lesson sections by integrating specific course materials from a knowledge base.

CRITICAL REQUIREMENTS:
- You MUST incorporate the specific course materials provided in the user prompt
- You MUST include citation keys in the knowledge_base_references array
- You MUST base content on the actual materials, not generic information
- Return ONLY valid JSON array format - NO markdown code blocks, NO explanations, NO additional text
- Ensure all content is educationally sound and grade-appropriate
- Create engaging, complete teaching material that achieves learning objectives

JSON FORMAT REQUIREMENTS:
- Start your response with [ and end with ]
- Do NOT wrap in \`\`\`json or \`\`\` code blocks
- Return pure JSON only` 
          },
          { 
            role: 'user', 
            content: aiPrompt 
          }
        ],
        temperature: 0.7,
        max_tokens: 6000, // Increased for more comprehensive content
      });

      const aiResponseContent = completion.choices[0]?.message?.content;
      if (!aiResponseContent) {
        console.error(`[auto-generate-sections] OpenAI response content is null or empty for lessonId: ${lessonId}`);
        throw new Error('OpenAI returned empty content.');
      }

      console.log(`[auto-generate-sections] Received AI response for lessonId ${lessonId} (${aiResponseContent.length} chars)`);

      // Parse and validate AI response
      try {
        // Extract JSON from markdown code blocks if present
        let jsonContent = aiResponseContent.trim();
        
        // Check if response is wrapped in markdown code blocks
        if (jsonContent.startsWith('```json') || jsonContent.startsWith('```')) {
          // Extract content between code blocks
          const codeBlockRegex = /```(?:json)?\s*([\s\S]*?)\s*```/;
          const match = jsonContent.match(codeBlockRegex);
          if (match && match[1]) {
            jsonContent = match[1].trim();
          } else {
            // Fallback: remove ```json and ``` manually
            jsonContent = jsonContent
              .replace(/^```json\s*/i, '')
              .replace(/^```\s*/, '')
              .replace(/\s*```$/, '')
              .trim();
          }
        }
        
        console.log(`[auto-generate-sections] Extracted JSON content for lessonId ${lessonId} (${jsonContent.length} chars)`);
        
        sectionsFromAI = JSON.parse(jsonContent) as AIResponseSections;
        if (!Array.isArray(sectionsFromAI)) {
          console.error(`[auto-generate-sections] AI response was not a JSON array for lessonId ${lessonId}`);
          throw new Error('AI response was not a valid JSON array as expected.');
        }
      } catch (parseError: any) {
        console.error(`[auto-generate-sections] Failed to parse AI JSON response for lessonId ${lessonId}:`, parseError);
        console.error(`[auto-generate-sections] Raw AI content: ${aiResponseContent.substring(0, 1000)}...`);
        throw new Error(`Failed to parse AI response. Details: ${parseError.message}`);
      }

    } catch (aiError: any) {
      console.error(`[auto-generate-sections] Error calling OpenAI for lessonId ${lessonId}:`, aiError.response?.data || aiError.message);
      return NextResponse.json({ error: 'Failed to generate content from AI', details: aiError.message }, { status: 500 });
    }

    if (sectionsFromAI.length === 0) {
      console.warn(`[auto-generate-sections] AI generated no sections for lessonId: ${lessonId}`);
      return NextResponse.json({ message: 'AI generated no sections. Process completed.', data: [] }, { status: 200 });
    }

    // 6. Process AI Response and prepare for database insertion
    console.log(`[auto-generate-sections] Processing ${sectionsFromAI.length} sections from AI for lessonId: ${lessonId}`);
    
    const lessonSectionsToInsert = sectionsFromAI.map((section, index) => {
      let sectionContent: any = { 
        text: section.content_text,
        knowledge_base_integration: {
          references: section.knowledge_base_references || [],
          search_queries_used: kbContext.searchQueries,
          relevant_documents: kbContext.documentSummaries.map(d => d.id),
          generation_timestamp: new Date().toISOString()
        }
      };

      if (section.media_description) {
        sectionContent.media_description = section.media_description;
      }

      if (section.section_type === 'quiz' && section.quiz_questions && section.quiz_questions.length > 0) {
        sectionContent = {
          instructions: section.content_text,
          questions: section.quiz_questions.map(q => ({
            question_text: q.question_text,
            options: q.options,
            correct_option_index: q.correct_option_index,
            explanation: q.explanation || null,
          })),
          knowledge_base_integration: sectionContent.knowledge_base_integration
        };
      } else if (section.section_type === 'quiz') {
        console.warn(`[auto-generate-sections] Section marked as quiz but has no questions for lessonId ${lessonId}, title: "${section.title}"`);
      }

      return {
        lesson_id: lessonId,
        title: section.title || 'Untitled Section',
        content: sectionContent,
        media_url: null,
        order_index: index,
        section_type: section.section_type,
        created_by: user.id,
      };
    });

    console.log(`[auto-generate-sections] Prepared ${lessonSectionsToInsert.length} sections for DB insert for lessonId: ${lessonId}`);

    // 7. Insert into lesson_sections table
    const { data: insertedSections, error: insertError } = await supabase
      .from('lesson_sections')
      .insert(lessonSectionsToInsert)
      .select();

    if (insertError) {
      console.error(`[auto-generate-sections] Error inserting lesson sections for ${lessonId}:`, insertError);
      return NextResponse.json({ error: 'Failed to save generated sections', details: insertError.message }, { status: 500 });
    }

    console.log(`[auto-generate-sections] Successfully generated and saved ${insertedSections?.length || 0} sections for lessonId: ${lessonId}`);
    
    // Return success with metadata about knowledge base integration
    return NextResponse.json(
      { 
        message: 'Lesson sections generated successfully with knowledge base integration', 
        data: insertedSections,
        metadata: {
          knowledge_base_chunks_used: kbContext.relevantChunks.length,
          documents_referenced: kbContext.documentSummaries.length,
          total_documents_available: kbContext.totalDocuments,
          search_queries: kbContext.searchQueries.length
        }
      }, 
      { status: 201 }
    );

  } catch (error: any) {
    console.error(`[auto-generate-sections] Unexpected error for lessonId ${lessonId}:`, error);
    return NextResponse.json({ error: 'An unexpected error occurred', details: error.message }, { status: 500 });
  }
} 