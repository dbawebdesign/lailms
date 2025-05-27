import { NextResponse } from 'next/server';
import { SerializedUIContext } from '@/context/LunaContextProvider';
import OpenAI from 'openai';
import { z } from 'zod';

// Hard-code the API key directly for development
// In production, use environment variables properly
// const OPENAI_API_KEY = "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";

// Initialize OpenAI client directly with the hard-coded key
// const openaiClient = new OpenAI({
// apiKey: OPENAI_API_KEY,
// });
// console.log("OpenAI client initialized with API key:", OPENAI_API_KEY.substring(0, 10) + "***");

// --- Environment Variable and OpenAI Client Initialization ---
console.log('[Luna Chat API] Environment check:');
console.log('[Luna Chat API] OPENAI_API_KEY defined:', !!process.env.OPENAI_API_KEY);
console.log('[Luna Chat API] OPENAI_API_KEY first 10 chars:', process.env.OPENAI_API_KEY ? process.env.OPENAI_API_KEY.substring(0, 10) + '...' : 'undefined');
console.log('[Luna Chat API] NODE_ENV:', process.env.NODE_ENV);

let openaiClient: OpenAI | null = null;
const apiKey = process.env.OPENAI_API_KEY;

if (!apiKey) {
  console.error("[Luna Chat API] WARNING: OPENAI_API_KEY environment variable is not set or empty. API may not function correctly.");
} else {
  try {
    openaiClient = new OpenAI({ apiKey });
    console.log('[Luna Chat API] OpenAI client initialized successfully.');
  } catch (error) {
    console.error("[Luna Chat API] Failed to initialize OpenAI client:", error);
  }
}
// --- End of Environment Variable and OpenAI Client Initialization ---

// --- Tool Definitions ---

// Schema for searchKnowledgeBase tool parameters
const searchKnowledgeBaseSchema = z.object({
  query: z.string().describe("The search query for the knowledge base"),
});

// Schema for updateLessonSectionContent tool parameters
const updateLessonSectionContentSchema = z.object({
  sectionId: z.string().describe("The ID of the lesson section to update. Extract this from context if possible, or ask the user."),
  modificationInstruction: z.string().describe("The user's instruction for how to modify the content (e.g., 'make it 5th grade level', 'expand on this topic', 'simplify this paragraph')."),
});

// Schema for performing UI actions
const performUIActionSchema = z.object({
  componentId: z.string().describe("The ID of the component to interact with"),
  actionType: z.string().describe("The type of action to perform (e.g., 'click', 'navigate', 'open', 'close', 'submit')"),
  additionalParams: z.record(z.any()).optional().describe("Additional parameters needed for the action"),
});

// --- Backend Implementations (Placeholders/Delegation) ---

// Updated function to accept cookies
async function performKnowledgeBaseSearch(query: string, forwardedCookies: string | null): Promise<any> {
  console.log(`---> EXECUTING KB SEARCH for query: ${query}`);
  
  const baseURL = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000';
  const searchURL = `${baseURL}/api/knowledge-base/search`;

  // Prepare headers, including the forwarded cookie if available
  const headers: HeadersInit = {
    'Content-Type': 'application/json',
  };
  if (forwardedCookies) {
    headers['Cookie'] = forwardedCookies;
  }

  try {
    const response = await fetch(searchURL, {
      method: 'POST',
      headers: headers, // Use the prepared headers
      body: JSON.stringify({ query, limit: 5 }),
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({ error: "Failed to fetch or parse error from KB search." }));
      console.error('Knowledge base search failed:', response.status, errorData);
      return {
        results: [],
        message: `I tried searching the knowledge base, but encountered an error: ${errorData.error || response.statusText}. I'll try to answer based on my general knowledge.`
      };
    }

    const searchResults = await response.json();

    // Determine where the actual results array is located
    let actualResultsArray = [];
    let kbSearchMethod = 'unknown';

    if (Array.isArray(searchResults)) {
      // Fallback case: searchResults is the array itself
      actualResultsArray = searchResults;
      kbSearchMethod = 'basic_fallback'; // Assuming fallback if it's a direct array
    } else if (searchResults && typeof searchResults === 'object' && searchResults.results) {
      // Successful vector search case: results are in searchResults.results
      actualResultsArray = searchResults.results;
      kbSearchMethod = searchResults.method || 'vector_search';
    }

    if (!actualResultsArray || actualResultsArray.length === 0) {
      return {
        results: [],
        message: "I couldn't find specific information in the knowledge base for your query. I'll answer based on my general knowledge and the current context."
      };
    }

    // Transform results to the format expected by extractCitationsFromToolResults
    const formattedResults = actualResultsArray.map((item: any) => ({
      id: item.chunk_id || item.id, 
      title: item.title || 'Untitled Document',
      snippet: item.snippet || 'No snippet available.',
      url: item.url, // Assuming the search API returns a direct URL for citation
      // We might need to construct the URL if it's not directly provided:
      // url: `/knowledge-base/documents/${item.document_id}?chunk=${item.chunk_id}`
    }));

    return { 
      results: formattedResults 
    };

  } catch (error) {
    console.error('Error calling knowledge base search API:', error);
    return {
      results: [],
      message: "I encountered an unexpected issue while trying to search the knowledge base. I'll answer based on my general knowledge and the current context."
    };
  }
}

// Placeholder for actual Lesson Content Update
async function performLessonUpdate(sectionId: string, instruction: string): Promise<any> {
  console.log(`---> EXECUTING LESSON UPDATE for sectionId: ${sectionId} with instruction: ${instruction}`);
  // TODO: Replace with actual call to lesson service (src/lib/services/lessons.ts)
  // This service would handle: Permissions, Fetching current content, Calling OpenAI for modification, Updating DB
  return { 
    success: true, 
    message: `Placeholder: Section ${sectionId} content update initiated with instruction: ${instruction}.`,
    sectionInfo: {
      id: sectionId,
      title: 'Updated Section Title',
      url: `/lessons/${sectionId}`
    }
  };
}

// Generate course outline when explicitly requested
async function performCourseOutlineGeneration(prompt: string, gradeLevel?: string, lengthInWeeks?: number, forwardedCookies?: string | null): Promise<any> {
  console.log(`---> EXECUTING COURSE OUTLINE GENERATION for prompt: ${prompt}`);
  
  const baseURL = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000';
  const generateURL = `${baseURL}/api/teach/generate-course-outline`;

  // Prepare headers, including the forwarded cookie if available
  const headers: HeadersInit = {
    'Content-Type': 'application/json',
  };
  if (forwardedCookies) {
    headers['Cookie'] = forwardedCookies;
  }

  try {
    const response = await fetch(generateURL, {
      method: 'POST',
      headers: headers,
      body: JSON.stringify({ 
        prompt, 
        gradeLevel, 
        lengthInWeeks 
      }),
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({ error: "Failed to generate course outline." }));
      console.error('Course outline generation failed:', response.status, errorData);
      return {
        success: false,
        message: `I tried to generate a course outline, but encountered an error: ${errorData.error || response.statusText}. Please try again or contact support.`
      };
    }

    const outlineData = await response.json();
    
    return {
      success: true,
      message: `I've generated a course outline for "${outlineData.baseClassName || 'your course'}". You can save this as a base class or open it in the designer for detailed editing.`,
      outlineData: outlineData,
      isOutline: true, // Flag to indicate this should be displayed as an outline
      actions: [
        { type: 'saveOutline', label: 'Save as Base Class' },
        { type: 'openInDesigner', label: 'Open in Designer' }
      ]
    };

  } catch (error) {
    console.error('Error calling course outline generation API:', error);
    return {
      success: false,
      message: "I encountered an unexpected issue while trying to generate the course outline. Please try again later."
    };
  }
}

// Add a new lesson section with AI-generated content
async function performAddLessonSection(lessonId: string, title: string, contentDescription: string, sectionType: string = 'text-editor', orderIndex?: number, forwardedCookies?: string | null): Promise<any> {
  console.log(`---> EXECUTING ADD LESSON SECTION for lesson: ${lessonId}, title: ${title}`);
  
  if (!openaiClient) {
    return {
      success: false,
      message: "AI content generation is not available. Please check the server configuration."
    };
  }

  try {
    // First, generate the content using OpenAI
    console.log(`[Luna] Generating content for section: ${title}`);
    const contentGenerationResponse = await openaiClient.chat.completions.create({
      model: "gpt-4.1-mini",
      messages: [
        {
          role: "system",
          content: `You are an expert educational content creator. Generate rich, engaging educational content for a lesson section.

**Instructions:**
- Create comprehensive, well-structured content appropriate for the lesson context
- Use clear headings, bullet points, and organized formatting
- Include relevant examples, explanations, and key concepts
- Make the content engaging and educational
- Format the response as structured text that can be converted to rich text format
- Focus on educational value and clarity

**Content Requirements:**
- Title: ${title}
- Content Description: ${contentDescription}

Generate detailed educational content that fulfills these requirements. Structure it with clear headings and well-organized information.`
        }
      ],
      temperature: 0.7,
      max_tokens: 2000
    });

    const generatedContent = contentGenerationResponse.choices[0].message.content || '';
    
    // Convert the generated text content to a basic rich text format (TipTap/ProseMirror JSON)
    const richTextContent = {
      type: 'doc',
      content: generatedContent.split('\n\n').map(paragraph => {
        const trimmed = paragraph.trim();
        if (!trimmed) return null;
        
        // Check if it's a heading (starts with #)
        if (trimmed.startsWith('#')) {
          const level = (trimmed.match(/^#+/) || [''])[0].length;
          const text = trimmed.replace(/^#+\s*/, '');
          return {
            type: 'heading',
            attrs: { level: Math.min(level, 6) },
            content: [{ type: 'text', text }]
          };
        }
        
        // Check if it's a bullet point
        if (trimmed.startsWith('- ') || trimmed.startsWith('* ')) {
          return {
            type: 'bulletList',
            content: [{
              type: 'listItem',
              content: [{
                type: 'paragraph',
                content: [{ type: 'text', text: trimmed.replace(/^[-*]\s*/, '') }]
              }]
            }]
          };
        }
        
        // Regular paragraph
        return {
          type: 'paragraph',
          content: [{ type: 'text', text: trimmed }]
        };
      }).filter(Boolean)
    };

    // Now create the lesson section via the API
    const baseURL = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000';
    const sectionsURL = `${baseURL}/api/teach/lessons/${lessonId}/sections`;

    const headers: HeadersInit = {
      'Content-Type': 'application/json',
    };
    if (forwardedCookies) {
      headers['Cookie'] = forwardedCookies;
    }

    const sectionData = {
      title,
      content: richTextContent,
      section_type: sectionType,
      ...(orderIndex !== undefined && { order_index: orderIndex })
    };

    const response = await fetch(sectionsURL, {
      method: 'POST',
      headers: headers,
      body: JSON.stringify(sectionData),
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({ error: "Failed to create lesson section." }));
      console.error('Lesson section creation failed:', response.status, errorData);
      return {
        success: false,
        message: `I tried to add the lesson section, but encountered an error: ${errorData.error || response.statusText}. Please try again or contact support.`
      };
    }

    const newSection = await response.json();
    
    return {
      success: true,
      message: `I've successfully added the section "${title}" to your lesson with comprehensive content about ${contentDescription.toLowerCase()}. The section has been created and should now appear in your lesson.`,
      sectionInfo: {
        id: newSection.id,
        title: newSection.title,
        url: `/lessons/${lessonId}#section-${newSection.id}`
      }
    };

  } catch (error) {
    console.error('Error adding lesson section:', error);
    return {
      success: false,
      message: "I encountered an unexpected issue while trying to add the lesson section. Please try again later."
    };
  }
}

// Update base class properties
async function performUpdateBaseClass(baseClassId: string, updates: any, forwardedCookies?: string | null): Promise<any> {
  console.log(`---> UPDATING BASE CLASS ${baseClassId}:`, updates);
  
  const baseURL = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000';
  const updateURL = `${baseURL}/api/teach/base-classes/${baseClassId}`;

  const headers: HeadersInit = { 'Content-Type': 'application/json' };
  if (forwardedCookies) headers['Cookie'] = forwardedCookies;

  try {
    const response = await fetch(updateURL, {
      method: 'PATCH',
      headers,
      body: JSON.stringify(updates),
    });

    if (!response.ok) {
      const errorData = await response.json();
      throw new Error(errorData.error || `Failed to update base class: ${response.status}`);
    }

    const result = await response.json();
    return {
      success: true,
      message: `Base class updated successfully`,
      baseClass: result
    };
  } catch (error) {
    console.error('Error updating base class:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error updating base class'
    };
  }
}

// Create new path
async function performCreatePath(baseClassId: string, title: string, description: string, orderIndex?: number, forwardedCookies?: string | null): Promise<any> {
  console.log(`---> CREATING PATH in base class ${baseClassId}:`, { title, description });
  
  const baseURL = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000';
  const createURL = `${baseURL}/api/teach/base-classes/${baseClassId}/paths`;

  const headers: HeadersInit = { 'Content-Type': 'application/json' };
  if (forwardedCookies) headers['Cookie'] = forwardedCookies;

  try {
    const response = await fetch(createURL, {
      method: 'POST',
      headers,
      body: JSON.stringify({ title, description, order_index: orderIndex }),
    });

    if (!response.ok) {
      const errorData = await response.json();
      throw new Error(errorData.error || `Failed to create path: ${response.status}`);
    }

    const result = await response.json();
    return {
      success: true,
      message: `Path "${title}" created successfully`,
      path: result
    };
  } catch (error) {
    console.error('Error creating path:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error creating path'
    };
  }
}

// Update path properties
async function performUpdatePath(pathId: string, updates: any, forwardedCookies?: string | null): Promise<any> {
  console.log(`---> UPDATING PATH ${pathId}:`, updates);
  
  const baseURL = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000';
  const updateURL = `${baseURL}/api/teach/paths/${pathId}`;

  const headers: HeadersInit = { 'Content-Type': 'application/json' };
  if (forwardedCookies) headers['Cookie'] = forwardedCookies;

  try {
    const response = await fetch(updateURL, {
      method: 'PATCH',
      headers,
      body: JSON.stringify(updates),
    });

    if (!response.ok) {
      const errorData = await response.json();
      throw new Error(errorData.error || `Failed to update path: ${response.status}`);
    }

    const result = await response.json();
    return {
      success: true,
      message: `Path updated successfully`,
      path: result
    };
  } catch (error) {
    console.error('Error updating path:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error updating path'
    };
  }
}

// Delete path
async function performDeletePath(pathId: string, forwardedCookies?: string | null): Promise<any> {
  console.log(`---> DELETING PATH ${pathId}`);
  
  const baseURL = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000';
  const deleteURL = `${baseURL}/api/teach/paths/${pathId}`;

  const headers: HeadersInit = { 'Content-Type': 'application/json' };
  if (forwardedCookies) headers['Cookie'] = forwardedCookies;

  try {
    const response = await fetch(deleteURL, {
      method: 'DELETE',
      headers,
    });

    if (!response.ok) {
      const errorData = await response.json();
      throw new Error(errorData.error || `Failed to delete path: ${response.status}`);
    }

    return {
      success: true,
      message: `Path deleted successfully`
    };
  } catch (error) {
    console.error('Error deleting path:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error deleting path'
    };
  }
}

// Create new lesson
async function performCreateLesson(pathId: string, title: string, description: string, objectives?: string, orderIndex?: number, forwardedCookies?: string | null): Promise<any> {
  console.log(`---> CREATING LESSON in path ${pathId}:`, { title, description, objectives });
  
  const baseURL = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000';
  const createURL = `${baseURL}/api/teach/paths/${pathId}/lessons`;

  const headers: HeadersInit = { 'Content-Type': 'application/json' };
  if (forwardedCookies) headers['Cookie'] = forwardedCookies;

  try {
    const response = await fetch(createURL, {
      method: 'POST',
      headers,
      body: JSON.stringify({ 
        title, 
        description: objectives ? `${description}\n\nLearning Objectives:\n${objectives}` : description, 
        order_index: orderIndex 
      }),
    });

    if (!response.ok) {
      const errorData = await response.json();
      throw new Error(errorData.error || `Failed to create lesson: ${response.status}`);
    }

    const result = await response.json();
    return {
      success: true,
      message: `Lesson "${title}" created successfully`,
      lesson: result
    };
  } catch (error) {
    console.error('Error creating lesson:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error creating lesson'
    };
  }
}

// Update lesson properties
async function performUpdateLesson(lessonId: string, updates: any, forwardedCookies?: string | null): Promise<any> {
  console.log(`---> UPDATING LESSON ${lessonId}:`, updates);
  
  const baseURL = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000';
  const updateURL = `${baseURL}/api/teach/lessons/${lessonId}`;

  const headers: HeadersInit = { 'Content-Type': 'application/json' };
  if (forwardedCookies) headers['Cookie'] = forwardedCookies;

  try {
    const response = await fetch(updateURL, {
      method: 'PATCH',
      headers,
      body: JSON.stringify(updates),
    });

    if (!response.ok) {
      const errorData = await response.json();
      throw new Error(errorData.error || `Failed to update lesson: ${response.status}`);
    }

    const result = await response.json();
    return {
      success: true,
      message: `Lesson updated successfully`,
      lesson: result
    };
  } catch (error) {
    console.error('Error updating lesson:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error updating lesson'
    };
  }
}

// Delete lesson
async function performDeleteLesson(lessonId: string, forwardedCookies?: string | null): Promise<any> {
  console.log(`---> DELETING LESSON ${lessonId}`);
  
  const baseURL = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000';
  const deleteURL = `${baseURL}/api/teach/lessons/${lessonId}`;

  const headers: HeadersInit = { 'Content-Type': 'application/json' };
  if (forwardedCookies) headers['Cookie'] = forwardedCookies;

  try {
    const response = await fetch(deleteURL, {
      method: 'DELETE',
      headers,
    });

    if (!response.ok) {
      const errorData = await response.json();
      throw new Error(errorData.error || `Failed to delete lesson: ${response.status}`);
    }

    return {
      success: true,
      message: `Lesson deleted successfully`
    };
  } catch (error) {
    console.error('Error deleting lesson:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error deleting lesson'
    };
  }
}

// Update lesson section properties
async function performUpdateLessonSection(sectionId: string, updates: any, forwardedCookies?: string | null): Promise<any> {
  console.log(`---> UPDATING LESSON SECTION ${sectionId}:`, updates);
  
  const baseURL = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000';
  const updateURL = `${baseURL}/api/teach/sections/${sectionId}`;

  const headers: HeadersInit = { 'Content-Type': 'application/json' };
  if (forwardedCookies) headers['Cookie'] = forwardedCookies;

  try {
    // If contentDescription is provided, generate new content
    let contentToUpdate = updates.content;
    if (updates.contentDescription && !updates.content && openaiClient) {
      const contentGenerationResponse = await openaiClient.chat.completions.create({
        model: "gpt-4.1-mini",
        messages: [
          {
            role: "system",
            content: "You are an educational content creator. Generate rich, engaging educational content in TipTap JSON format based on the user's description."
          },
          {
            role: "user",
            content: `Generate educational content for: ${updates.contentDescription}`
          }
        ],
        temperature: 0.7,
      });

      const generatedContent = contentGenerationResponse.choices[0].message.content;
      if (generatedContent) {
        try {
          contentToUpdate = {
            type: 'doc',
            content: [
              {
                type: 'paragraph',
                content: [
                  {
                    type: 'text',
                    text: generatedContent
                  }
                ]
              }
            ]
          };
        } catch (e) {
          contentToUpdate = generatedContent;
        }
      }
    }

    const updateData = {
      ...(updates.title && { title: updates.title }),
      ...(updates.sectionType && { section_type: updates.sectionType }),
      ...(contentToUpdate && { content: contentToUpdate })
    };

    const response = await fetch(updateURL, {
      method: 'PATCH',
      headers,
      body: JSON.stringify(updateData),
    });

    if (!response.ok) {
      const errorData = await response.json();
      throw new Error(errorData.error || `Failed to update section: ${response.status}`);
    }

    const result = await response.json();
    return {
      success: true,
      message: `Section updated successfully`,
      section: result
    };
  } catch (error) {
    console.error('Error updating section:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error updating section'
    };
  }
}

// Delete lesson section
async function performDeleteLessonSection(sectionId: string, forwardedCookies?: string | null): Promise<any> {
  console.log(`---> DELETING LESSON SECTION ${sectionId}`);
  
  const baseURL = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000';
  const deleteURL = `${baseURL}/api/teach/sections/${sectionId}`;

  const headers: HeadersInit = { 'Content-Type': 'application/json' };
  if (forwardedCookies) headers['Cookie'] = forwardedCookies;

  try {
    const response = await fetch(deleteURL, {
      method: 'DELETE',
      headers,
    });

    if (!response.ok) {
      const errorData = await response.json();
      throw new Error(errorData.error || `Failed to delete section: ${response.status}`);
    }

    return {
      success: true,
      message: `Section deleted successfully`
    };
  } catch (error) {
    console.error('Error deleting section:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error deleting section'
    };
  }
}

// Reorder content (paths, lessons, sections)
async function performReorderContent(itemType: string, parentId: string, orderedIds: string[], forwardedCookies?: string | null): Promise<any> {
  console.log(`---> REORDERING ${itemType.toUpperCase()}S in ${parentId}:`, orderedIds);
  
  const baseURL = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000';
  const reorderURL = `${baseURL}/api/teach/reorder-items`;

  const headers: HeadersInit = { 'Content-Type': 'application/json' };
  if (forwardedCookies) headers['Cookie'] = forwardedCookies;

  try {
    const response = await fetch(reorderURL, {
      method: 'POST',
      headers,
      body: JSON.stringify({ itemType, parentId, orderedIds }),
    });

    if (!response.ok) {
      const errorData = await response.json();
      throw new Error(errorData.error || `Failed to reorder ${itemType}s: ${response.status}`);
    }

    return {
      success: true,
      message: `${itemType}s reordered successfully`
    };
  } catch (error) {
    console.error(`Error reordering ${itemType}s:`, error);
    return {
      success: false,
      error: error instanceof Error ? error.message : `Unknown error reordering ${itemType}s`
    };
  }
}

// Placeholder for actual UI action execution
async function performUIAction(componentId: string, actionType: string, additionalParams?: Record<string, any>): Promise<any> {
  console.log(`---> EXECUTING UI ACTION on component: ${componentId}, action: ${actionType}`, additionalParams);
  
  // Broadcast the action to all UI components
  if (typeof window !== 'undefined') {
    try {
      const actionChannel = new BroadcastChannel('luna-ui-actions');
      actionChannel.postMessage({
        componentId,
        actionType,
        additionalParams,
        timestamp: Date.now()
      });
      actionChannel.close();
    } catch (error) {
      console.error('Error broadcasting UI action:', error);
    }
  }
  
  return {
    success: true,
    message: `Action ${actionType} performed on component ${componentId}`,
    details: {
      componentId,
      actionType,
      params: additionalParams
    }
  };
}

// --- Intent Analysis Functions ---

// Identify common UI patterns that suggest user intent
function analyzeUIPatterns(context: SerializedUIContext): string {
  const insights = [];
  
  // Check if user is on a lesson page
  const isOnLessonPage = context.route?.includes('/lesson') || false;
  if (isOnLessonPage) {
    insights.push('User is viewing a lesson page');
  }
  
  // Check if user is on knowledge base page
  const isOnKnowledgeBase = context.route?.includes('/knowledge-base') || false;
  if (isOnKnowledgeBase) {
    insights.push('User is in the knowledge base section');
  }
  
  // Check for form components that might indicate the user is trying to submit something
  const formComponents = context.components.filter(c => 
    c.type === 'form' || c.role === 'form' || c.role === 'input'
  );
  if (formComponents.length > 0) {
    insights.push(`User has access to ${formComponents.length} form/input components`);
  }
  
  // Check for navigation components
  const navComponents = context.components.filter(c => c.role === 'navigation');
  if (navComponents.length > 0) {
    insights.push(`User has access to ${navComponents.length} navigation components`);
  }
  
  // Check for user's last action to provide context
  if (context.lastUserAction) {
    insights.push(`User last interacted with component ${context.lastUserAction.componentId} (${context.lastUserAction.actionType})`);
  }
  
  // Check for focused component
  if (context.focused) {
    const focusedComponent = context.components.find(c => c.id === context.focused);
    if (focusedComponent) {
      insights.push(`User's focus is on a ${focusedComponent.type} (${focusedComponent.role})`);
    }
  }
  
  return insights.join('. ') || 'No specific UI patterns detected';
}

// Define minimal interface needed for prompt construction
interface CourseModule {
  title: string;
  topics: string[];
}

// --- Refined System Prompt Construction ---
function constructSystemPrompt(context: SerializedUIContext, persona: string, message: string): string {
  // Generate UI pattern analysis
  const patternInsights = analyzeUIPatterns(context);

  // Serialize components, giving special treatment to course-structure
  const componentSummary = context.components
    .filter(c => c.isVisible !== false)
    .map(c => {
      let summary = `    *   [${c.type}] Role: ${c.role}, ID: ${c.id}`;
      
      // Add metadata if present
      if (c.metadata?.baseClassName) {
         summary += `, Name: "${c.metadata.baseClassName}"`;
      }
      if (c.metadata?.lessonIdentifier) {
         summary += `, LessonSectionID: ${c.metadata.lessonIdentifier}`;
      }
      if (c.content?.title) {
        summary += `, Title: "${c.content.title}"`;
      }

      // Special handling for course structure content
      if (c.type === 'course-structure' && c.content?.modules && Array.isArray(c.content.modules)) {
        try {
          const modules = c.content.modules as CourseModule[]; // Type assertion
          const modulesContent = modules
            .map(m => `${m.title}: (${(m.topics || []).join(', ') || 'No topics listed'})`)
            .join('; ');
          summary += `, Current Modules: ${modulesContent.substring(0, 300)}${modulesContent.length > 300 ? '...' : ''}`; // Limit length
        } catch (e) {
          console.warn('Error formatting course modules for prompt:', e);
          summary += ', (Error processing modules)';
        }
      }
      
      return summary;
    })
    .slice(0, 10) // Keep the limit for overall summary brevity
    .join('\\n');

  return `# Role & Objective
You are Luna, an intelligent AI assistant integrated into the LearnologyAI platform. Your role is to provide contextual help, insights, and assistance based on what the user is currently viewing and working with on their screen.

# Current UI Context
${context ? `
**Current Page**: ${context.route}
**Active Components**: ${context.components?.length || 0} UI elements detected
**Focused Element**: ${context.focused ? 'Yes' : 'None'}
**Last User Action**: ${context.lastUserAction ? `${context.lastUserAction.actionType} on ${context.lastUserAction.componentId}` : 'None'}

## Page Content Analysis
${context.components?.map(comp => {
  let analysis = `- **${comp.type}** (${comp.role}): `;
  
  // Provide specific analysis based on component type and content
  if (comp.type === 'base-class-studio-page' && comp.content) {
    analysis += `User is in the Base Class Studio editing "${comp.content.baseClassName || 'a class'}"`;
    if (comp.content.baseClassSubject) analysis += ` (${comp.content.baseClassSubject})`;
    if (comp.content.baseClassGradeLevel) analysis += ` for ${comp.content.baseClassGradeLevel}`;
    if (comp.content.selectedItemType && comp.content.selectedItemTitle) {
      analysis += `. Currently editing ${comp.content.selectedItemType}: "${comp.content.selectedItemTitle}"`;
      // Extract lesson ID if available
      if (comp.content.selectedItemId) {
        analysis += ` (ID: ${comp.content.selectedItemId})`;
      }
    }
    if (comp.content.totalPaths) analysis += `. Contains ${comp.content.totalPaths} learning paths`;
    if (comp.content.totalLessons) analysis += ` with ${comp.content.totalLessons} total lessons`;
  } else if (comp.type === 'navigation-tree' && comp.content) {
    analysis += `Navigation showing class structure`;
    if (comp.content.baseClassName) analysis += ` for "${comp.content.baseClassName}"`;
    if (comp.content.paths) {
      analysis += ` with ${comp.content.paths.length} paths: ${comp.content.paths.map((p: any) => p.title).join(', ')}`;
    }
  } else if (comp.type === 'content-editor' && comp.content) {
    analysis += `Editor for ${comp.content.editorType}`;
    if (comp.content.itemTitle) analysis += `: "${comp.content.itemTitle}"`;
    if (comp.content.itemData) {
      const data = comp.content.itemData;
      if (data.description) analysis += `. Description: ${data.description.substring(0, 100)}${data.description.length > 100 ? '...' : ''}`;
      if (data.subject) analysis += `. Subject: ${data.subject}`;
      if (data.gradeLevel) analysis += `. Grade Level: ${data.gradeLevel}`;
      if (data.sectionType) analysis += `. Section Type: ${data.sectionType}`;
      // Extract lesson ID if available
      if (data.id || data.lessonId || data.lesson_id) {
        analysis += `. Lesson ID: ${data.id || data.lessonId || data.lesson_id}`;
      }
    }
  } else if (comp.content && typeof comp.content === 'object') {
    // Generic content analysis with ID extraction
    const contentKeys = Object.keys(comp.content);
    if (contentKeys.length > 0) {
      analysis += `Contains: ${contentKeys.slice(0, 3).join(', ')}${contentKeys.length > 3 ? '...' : ''}`;
      // Look for lesson-related IDs
      const lessonId = comp.content.lessonId || comp.content.lesson_id || comp.content.id;
      if (lessonId && (comp.type.includes('lesson') || comp.role.includes('lesson'))) {
        analysis += `. Lesson ID: ${lessonId}`;
      }
    }
  }
  
  return analysis;
}).join('\n') || 'No detailed content available'}

## Available Context IDs for Tools
${(() => {
  const ids: string[] = [];
  context.components?.forEach(comp => {
    // Extract lesson IDs from various sources
    if (comp.content?.lessonId || comp.content?.lesson_id) {
      ids.push(`Lesson ID: ${comp.content.lessonId || comp.content.lesson_id}`);
    }
    if (comp.content?.selectedItemId && comp.content?.selectedItemType === 'lesson') {
      ids.push(`Selected Lesson ID: ${comp.content.selectedItemId}`);
    }
    if (comp.content?.itemData?.id && comp.type === 'content-editor') {
      ids.push(`Editor Item ID: ${comp.content.itemData.id}`);
    }
    // Extract base class IDs
    if (comp.content?.baseClassId || comp.content?.base_class_id) {
      ids.push(`Base Class ID: ${comp.content.baseClassId || comp.content.base_class_id}`);
    }
  });
  return ids.length > 0 ? ids.join(', ') : 'No specific IDs detected in current context';
})()}
` : 'No UI context available - user may be on a page without context registration'}

# Instructions

## Context-Aware Response Guidelines
1. **Always acknowledge what you can see**: Start by confirming what page/content the user is currently viewing
2. **Be specific about the current context**: Reference the actual class name, lesson title, or content they're working with
3. **Provide relevant suggestions**: Offer help that's directly applicable to their current task
4. **Use the actual data**: When discussing their content, use the real titles, descriptions, and data you can see

## Response Approach Based on Context
- **Base Class Studio**: Help with course design, curriculum structure, lesson planning, content organization
- **Lesson/Path Editing**: Assist with educational content creation, learning objectives, assessment strategies
- **Knowledge Base**: Help with document management, content organization, search strategies
- **General Navigation**: Guide users to relevant features and explain platform capabilities

## Persona-Specific Behavior
**Current Persona**: ${persona}

${persona === 'lunaChat' ? `
- Provide general assistance and platform guidance
- Help users understand features and navigate the interface
- Offer suggestions for improving their educational content
` : persona === 'classCoPilot' ? `
# Class Co-Pilot Behavior Framework

## Primary Directive
Analyze the current UI context to determine the appropriate level of educational assistance needed, then provide targeted, actionable guidance.

## Context Analysis & Response Strategy

### 1. Lesson-Level Context (When viewing specific lessons/sections)
**Trigger**: User is viewing lesson details, lesson editor, or specific lesson content
**Response Approach**:
- **Content Analysis**: Examine the current lesson structure, objectives, and sections
- **Section Management**: When user asks to "add a section" or "create a section", use the addLessonSection tool with the lesson ID from context
- **Content Enhancement**: For requests like "add content about X" or "include a section on Y", extract the lesson ID and create new sections
- **Improvement Focus**: Suggest specific enhancements to existing content
- **Pedagogical Optimization**: Recommend evidence-based teaching strategies for the current topic
- **Assessment Integration**: Propose relevant formative and summative assessments
- **Engagement Enhancement**: Suggest interactive elements, multimedia, or activities
- **Differentiation**: Recommend adaptations for diverse learning needs
- **Scope**: Keep suggestions focused on the current lesson being viewed

**Section Addition Guidelines**:
- Extract lesson ID from UI context (look for lesson_id, lessonId, or lesson identifier in component metadata)
- Parse user requests for section titles and content requirements
- Use addLessonSection tool when user explicitly requests new sections or content areas

### 2. Path/Module-Level Context (When viewing learning paths or course modules)
**Trigger**: User is viewing course navigation, module overview, or path structure
**Response Approach**:
- **Sequence Analysis**: Evaluate the logical flow and progression of lessons
- **Coherence Review**: Assess how lessons build upon each other
- **Gap Identification**: Identify missing concepts or transitions
- **Pacing Recommendations**: Suggest optimal lesson timing and spacing
- **Milestone Planning**: Recommend key checkpoints and assessments
- **Scope**: Focus on the current path/module structure and organization

### 3. Course-Level Context (When viewing full course structure)
**Trigger**: User is in base class studio, course overview, or full curriculum view
**Response Approach**:
- **Curriculum Architecture**: Analyze overall course design and structure
- **Learning Outcomes Alignment**: Ensure activities align with stated objectives
- **Prerequisite Mapping**: Verify logical skill and knowledge progression
- **Assessment Strategy**: Recommend comprehensive evaluation approaches
- **Resource Planning**: Suggest supporting materials and tools
- **Scope**: Address broad curriculum design and organizational elements

### 4. Creation Requests (When user explicitly requests new content)
**Trigger**: User explicitly asks to "create," "design," "build," or "generate" new courses/classes
**Response Approach**:
- **Use generateCourseOutline tool**: ONLY when user explicitly requests course/class creation
- **Needs Assessment**: Clarify learning objectives, audience, and constraints
- **Structural Framework**: Propose logical course organization and module breakdown
- **Content Scaffolding**: Suggest detailed lesson sequences and learning activities
- **Assessment Planning**: Design comprehensive evaluation strategies
- **Implementation Roadmap**: Provide step-by-step development guidance
- **Scope**: Full course creation from concept to implementation

**IMPORTANT**: Do NOT use the generateCourseOutline tool for improving existing content. Only use it when the user explicitly wants to create something new.

## Response Guidelines

### Always Include:
1. **Context Acknowledgment**: Explicitly state what educational content you can see
2. **Specific References**: Use actual titles, descriptions, and content from the current view
3. **Actionable Recommendations**: Provide concrete, implementable suggestions
4. **Pedagogical Rationale**: Briefly explain why each suggestion improves learning
5. **Prioritized Suggestions**: Order recommendations by impact and feasibility

### Content Quality Standards:
- **Evidence-Based**: Ground suggestions in established educational research
- **Grade-Appropriate**: Ensure all recommendations match the specified grade level
- **Inclusive Design**: Consider diverse learning styles and accessibility needs
- **Technology Integration**: Leverage platform features and digital tools effectively
- **Assessment Alignment**: Ensure activities support stated learning objectives

### Communication Style:
- **Professional Educator Tone**: Knowledgeable yet approachable
- **Structured Presentation**: Use clear headings and bullet points
- **Practical Focus**: Emphasize implementable strategies over theory
- **Encouraging Language**: Support teacher confidence and creativity
- **Concise Delivery**: Respect teacher time with focused, relevant advice

## Specialized Knowledge Areas:
- Curriculum design and backward design principles
- Formative and summative assessment strategies
- Differentiated instruction and UDL principles
- Educational technology integration
- Student engagement and motivation techniques
- Learning objective writing and alignment
- Scaffolding and prerequisite skill development
- Classroom management in digital environments
` : persona === 'teachingCoach' ? `
- Provide pedagogical guidance and teaching strategies
- Help with differentiation and student engagement
- Suggest assessment methods and learning activities
` : `
- Provide assistance appropriate to the ${persona} role
- Focus on the specific needs of this persona
`}

## Response Format
- Be conversational and helpful
- Use bullet points for lists or multiple suggestions
- Reference specific content the user is working with
- Provide actionable advice when possible
- Keep responses concise but comprehensive

# User Message
"${message}"

# Response
Provide a helpful, context-aware response that acknowledges what the user is currently viewing and offers relevant assistance based on their specific situation and the persona they've selected.`;
}

// Process tool results to extract citations for the frontend
function extractCitationsFromToolResults(toolResults: any[]): { id: string; title: string; url?: string }[] {
  const citations: { id: string; title: string; url?: string }[] = [];
  let kbMessage: string | null = null; // To capture any message from performKnowledgeBaseSearch
  
  if (!toolResults || !Array.isArray(toolResults)) {
    return citations; // Return empty citations, message will be handled by AI response
  }
  
  for (const toolResult of toolResults) {
    try {
      // For search tool results
      if (toolResult.type === 'function' && toolResult.name === 'search') {
        const searchCallResult = toolResult.args; // This is the object returned by performKnowledgeBaseSearch
        
        if (searchCallResult?.message && !searchCallResult?.results?.length) {
          // If there's a message and no results, we store it. 
          // The AI will be responsible for relaying this to the user based on new prompt instructions.
          // We don't create a "citation" for this message itself.
          kbMessage = searchCallResult.message; 
        }

        const results = searchCallResult?.results || [];
        for (const doc of results) {
          if (doc.id && doc.title) {
            citations.push({
              id: doc.id,
              title: doc.title,
              url: doc.url
            });
          }
        }
      }
      
      // For content update tool results
      if (toolResult.type === 'function' && toolResult.name === 'updateContent') {
        const updateResult = toolResult.args;
        if (updateResult?.sectionInfo) {
          const { id, title, url } = updateResult.sectionInfo;
          if (id && title) {
            citations.push({ id, title, url });
          }
        }
      }
      
      // For course outline generation tool results
      if (toolResult.type === 'function' && toolResult.name === 'generateCourseOutline') {
        const outlineResult = toolResult.args;
        if (outlineResult?.success && outlineResult?.outlineData) {
          citations.push({
            id: 'generated-outline',
            title: `Generated Course: ${outlineResult.outlineData.baseClassName || 'New Course'}`,
            url: undefined
          });
        }
      }
      
      // For add lesson section tool results
      if (toolResult.type === 'function' && toolResult.name === 'addLessonSection') {
        const sectionResult = toolResult.args;
        if (sectionResult?.success && sectionResult?.sectionInfo) {
          const { id, title, url } = sectionResult.sectionInfo;
          if (id && title) {
            citations.push({ id, title, url });
          }
        }
      }
      
      // For base class update tool results
      if (toolResult.type === 'function' && toolResult.name === 'updateBaseClass') {
        const baseClassResult = toolResult.args;
        if (baseClassResult?.success && baseClassResult?.baseClass) {
          citations.push({
            id: baseClassResult.baseClass.id,
            title: `Updated Base Class: ${baseClassResult.baseClass.name || 'Class'}`,
            url: undefined
          });
        }
      }
      
      // For path creation tool results
      if (toolResult.type === 'function' && toolResult.name === 'createPath') {
        const pathResult = toolResult.args;
        if (pathResult?.success && pathResult?.path) {
          citations.push({
            id: pathResult.path.id,
            title: `New Path: ${pathResult.path.title}`,
            url: undefined
          });
        }
      }
      
      // For path update tool results
      if (toolResult.type === 'function' && toolResult.name === 'updatePath') {
        const pathResult = toolResult.args;
        if (pathResult?.success && pathResult?.path) {
          citations.push({
            id: pathResult.path.id,
            title: `Updated Path: ${pathResult.path.title}`,
            url: undefined
          });
        }
      }
      
      // For lesson creation tool results
      if (toolResult.type === 'function' && toolResult.name === 'createLesson') {
        const lessonResult = toolResult.args;
        if (lessonResult?.success && lessonResult?.lesson) {
          citations.push({
            id: lessonResult.lesson.id,
            title: `New Lesson: ${lessonResult.lesson.title}`,
            url: undefined
          });
        }
      }
      
      // For lesson update tool results
      if (toolResult.type === 'function' && toolResult.name === 'updateLesson') {
        const lessonResult = toolResult.args;
        if (lessonResult?.success && lessonResult?.lesson) {
          citations.push({
            id: lessonResult.lesson.id,
            title: `Updated Lesson: ${lessonResult.lesson.title}`,
            url: undefined
          });
        }
      }
      
      // For section update tool results
      if (toolResult.type === 'function' && toolResult.name === 'updateLessonSection') {
        const sectionResult = toolResult.args;
        if (sectionResult?.success && sectionResult?.section) {
          citations.push({
            id: sectionResult.section.id,
            title: `Updated Section: ${sectionResult.section.title}`,
            url: undefined
          });
        }
      }
      
      // For deletion operations
      if (toolResult.type === 'function' && ['deletePath', 'deleteLesson', 'deleteLessonSection'].includes(toolResult.name)) {
        const deleteResult = toolResult.args;
        if (deleteResult?.success) {
          citations.push({
            id: 'deleted-item',
            title: `Deleted ${toolResult.name.replace('delete', '').replace('LessonSection', 'Section')}`,
            url: undefined
          });
        }
      }
      
      // For reorder operations
      if (toolResult.type === 'function' && toolResult.name === 'reorderContent') {
        const reorderResult = toolResult.args;
        if (reorderResult?.success) {
          citations.push({
            id: 'reordered-content',
            title: `Reordered Content`,
            url: undefined
          });
        }
      }
      
      // For UI action tool results
      if (toolResult.type === 'function' && toolResult.name === 'uiAction') {
        const actionResult = toolResult.args;
        if (actionResult?.details) {
          citations.push({
            id: actionResult.details.componentId,
            title: `UI Action: ${actionResult.details.actionType}`,
            url: undefined
          });
        }
      }
    } catch (error) {
      console.error('Error processing tool result:', error);
      // Continue processing other results
    }
  }
  
  return citations;
}

export async function POST(request: Request) {
  if (!openaiClient) {
    console.error("[Luna Chat API] OpenAI client is not initialized. Check API key.");
    return NextResponse.json(
      { error: "OpenAI client is not initialized. Administrator, please check the server logs and API key configuration." },
      { status: 500 }
    );
  }

  try {
    // Parse the request body
    let requestBody;
    try {
      requestBody = await request.json();
    } catch (error) {
      console.error('Error parsing request JSON:', error);
      return NextResponse.json({ error: 'Invalid JSON in request' }, { status: 400 });
    }
    
    const { message, context, messages: history = [], persona = 'lunaChat' } = requestBody;

    // Validate input
    if (!message || typeof message !== 'string') {
      return NextResponse.json({ error: 'Invalid message' }, { status: 400 });
    }
    if (!context || typeof context !== 'object') {
      return NextResponse.json({ error: 'Invalid context' }, { status: 400 });
    }
    if (!Array.isArray(history)) {
      return NextResponse.json({ error: 'Invalid history format' }, { status: 400 });
    }

    // --- Authentication/Authorization Check (TODO) ---

    // Extract cookies from the incoming request to forward them
    const forwardedCookies = request.headers.get('cookie');

    // Prepare messages for the FIRST API call
    const systemMessage = constructSystemPrompt(context as SerializedUIContext, persona, message);
    const userMessagesForFirstCall: OpenAI.Chat.ChatCompletionMessageParam[] = [
      { role: "system", content: systemMessage },
      ...history.map((msg: { role: string, content: string }) => ({ 
        role: msg.role as "user" | "assistant", // Assuming history roles are valid
        content: msg.content 
      })),
      { role: 'user', content: message }
    ];

    // Define function tools for OpenAI (same as before)
    const tools: OpenAI.Chat.ChatCompletionTool[] = [
      {
        type: "function",
        function: {
          name: "search",
          description: "Search the LearnologyAI knowledge base. Use specific details from the current UI context (course name, subject, visible topics) in the query for relevant results.",
          parameters: {
            type: "object",
            properties: { query: { type: "string", description: "The search query for the knowledge base" } },
            required: ["query"]
          }
        }
      },
      {
        type: "function",
        function: {
          name: "updateContent",
          description: "Updates the content of a specific lesson section based on user instructions (e.g., change grade level, expand, simplify).",
          parameters: {
            type: "object",
            properties: {
              sectionId: { type: "string", description: "The ID of the lesson section to update. Extract this from context if possible, or ask the user." },
              modificationInstruction: { type: "string", description: "The user\\'s instruction for how to modify the content (e.g., \\'make it 5th grade level\\', \\'expand on this topic\\', \\'simplify this paragraph\\')." }
            },
            required: ["sectionId", "modificationInstruction"]
          }
        }
      },
      {
        type: "function",
        function: {
          name: "generateCourseOutline",
          description: "Generate a new course outline. ONLY use this when the user explicitly requests to create, design, build, or generate a new course or class. Do NOT use for improving existing content.",
          parameters: {
            type: "object",
            properties: {
              prompt: { type: "string", description: "The user's description of the course they want to create" },
              gradeLevel: { type: "string", description: "Target grade level if specified" },
              lengthInWeeks: { type: "number", description: "Course duration in weeks if specified" }
            },
            required: ["prompt"]
          }
        }
      },
      {
        type: "function",
        function: {
          name: "addLessonSection",
          description: "Add a new section to a lesson with AI-generated content. Use this when the user asks to add a section to a lesson with specific content requirements.",
          parameters: {
            type: "object",
            properties: {
              lessonId: { type: "string", description: "The ID of the lesson to add the section to. Extract this from the current UI context." },
              title: { type: "string", description: "The title for the new section" },
              contentDescription: { type: "string", description: "Description of what content should be generated for this section" },
              sectionType: { type: "string", description: "The type of section (default: 'text-editor')", default: "text-editor" },
              orderIndex: { type: "number", description: "Position where to insert the section (optional, will append to end if not specified)" }
            },
            required: ["lessonId", "title", "contentDescription"]
          }
        }
      },
      {
        type: "function",
        function: {
          name: "updateBaseClass",
          description: "Update specific properties of a base class (name, description, subject, grade level, etc.).",
          parameters: {
            type: "object",
            properties: {
              baseClassId: { type: "string", description: "The ID of the base class to update. Extract from UI context." },
              name: { type: "string", description: "New name for the base class (optional)" },
              description: { type: "string", description: "New description (optional)" },
              subject: { type: "string", description: "New subject area (optional)" },
              gradeLevel: { type: "string", description: "New grade level (optional)" }
            },
            required: ["baseClassId"]
          }
        }
      },
      {
        type: "function",
        function: {
          name: "createPath",
          description: "Create a new learning path within a base class.",
          parameters: {
            type: "object",
            properties: {
              baseClassId: { type: "string", description: "The ID of the base class to add the path to. Extract from UI context." },
              title: { type: "string", description: "The title of the new path" },
              description: { type: "string", description: "Description of what this path will cover" },
              orderIndex: { type: "number", description: "Position where to insert the path (optional, defaults to end)" }
            },
            required: ["baseClassId", "title", "description"]
          }
        }
      },
      {
        type: "function",
        function: {
          name: "updatePath",
          description: "Update specific properties of a learning path (title, description, etc.).",
          parameters: {
            type: "object",
            properties: {
              pathId: { type: "string", description: "The ID of the path to update. Extract from UI context." },
              title: { type: "string", description: "New title for the path (optional)" },
              description: { type: "string", description: "New description (optional)" }
            },
            required: ["pathId"]
          }
        }
      },
      {
        type: "function",
        function: {
          name: "deletePath",
          description: "Delete a learning path and all its associated lessons.",
          parameters: {
            type: "object",
            properties: {
              pathId: { type: "string", description: "The ID of the path to delete" }
            },
            required: ["pathId"]
          }
        }
      },
      {
        type: "function",
        function: {
          name: "createLesson",
          description: "Create a new lesson within a learning path.",
          parameters: {
            type: "object",
            properties: {
              pathId: { type: "string", description: "The ID of the path to add the lesson to. Extract from UI context." },
              title: { type: "string", description: "The title of the new lesson" },
              description: { type: "string", description: "Description of what this lesson will cover" },
              objectives: { type: "string", description: "Learning objectives for this lesson (optional) - will be appended to the description" },
              orderIndex: { type: "number", description: "Position where to insert the lesson (optional, defaults to end)" }
            },
            required: ["pathId", "title", "description"]
          }
        }
      },
      {
        type: "function",
        function: {
          name: "updateLesson",
          description: "Update specific properties of a lesson (title, description, etc.). Note: objectives should be included in the description field.",
          parameters: {
            type: "object",
            properties: {
              lessonId: { type: "string", description: "The ID of the lesson to update. Extract from UI context." },
              title: { type: "string", description: "New title for the lesson (optional)" },
              description: { type: "string", description: "New description including any learning objectives (optional)" }
            },
            required: ["lessonId"]
          }
        }
      },
      {
        type: "function",
        function: {
          name: "deleteLesson",
          description: "Delete a lesson and all its associated sections.",
          parameters: {
            type: "object",
            properties: {
              lessonId: { type: "string", description: "The ID of the lesson to delete" }
            },
            required: ["lessonId"]
          }
        }
      },
      {
        type: "function",
        function: {
          name: "updateLessonSection",
          description: "Update specific properties of a lesson section (title, content, type, etc.).",
          parameters: {
            type: "object",
            properties: {
              sectionId: { type: "string", description: "The ID of the section to update. Extract from UI context." },
              title: { type: "string", description: "New title for the section (optional)" },
              contentDescription: { type: "string", description: "Description of how to modify the content (optional)" },
              sectionType: { type: "string", enum: ["text", "video_url", "quiz", "document_embed"], description: "New section type (optional)" }
            },
            required: ["sectionId"]
          }
        }
      },
      {
        type: "function",
        function: {
          name: "deleteLessonSection",
          description: "Delete a lesson section.",
          parameters: {
            type: "object",
            properties: {
              sectionId: { type: "string", description: "The ID of the section to delete" }
            },
            required: ["sectionId"]
          }
        }
      },
      {
        type: "function",
        function: {
          name: "reorderContent",
          description: "Reorder paths, lessons, or sections within their parent container.",
          parameters: {
            type: "object",
            properties: {
              itemType: { type: "string", enum: ["path", "lesson", "section"], description: "The type of items being reordered" },
              parentId: { type: "string", description: "The ID of the parent container (baseClassId for paths, pathId for lessons, lessonId for sections)" },
              orderedIds: { type: "array", items: { type: "string" }, description: "Array of item IDs in the new order" }
            },
            required: ["itemType", "parentId", "orderedIds"]
          }
        }
      },
      {
        type: "function",
        function: {
          name: "uiAction",
          description: "Perform an action on a UI component based on user intent (e.g., clicking a button, navigating to a page, submitting a form).",
          parameters: {
            type: "object",
            properties: {
              componentId: { type: "string", description: "The ID of the component to interact with" },
              actionType: { type: "string", description: "The type of action to perform (e.g., \\'click\\', \\'navigate\\', \\'open\\', \\'close\\', \\'submit\\')" },
              additionalParams: { type: "object", description: "Additional parameters needed for the action" }
            },
            required: ["componentId", "actionType"]
          }
        }
      }
    ];

    // Make the FIRST direct API call to OpenAI
    let responseMessage: OpenAI.Chat.ChatCompletionMessage;
    let finalOpenAIResponse: OpenAI.Chat.Completions.ChatCompletion;

    try {
      console.log("[Luna Chat API] Making first OpenAI call...");
      const firstResponse = await openaiClient.chat.completions.create({
        model: "gpt-4.1-mini", // Reverted model
        messages: userMessagesForFirstCall,
        tools: tools,
        tool_choice: "auto",
        temperature: 0.7,
      });
      
      responseMessage = firstResponse.choices[0].message;
      finalOpenAIResponse = firstResponse; // Store the first response initially

      // Check if the model decided to call a tool
      const toolCalls = responseMessage.tool_calls;

      if (toolCalls && toolCalls.length > 0) {
        console.log(`[Luna Chat API] First response included ${toolCalls.length} tool call(s). Executing...`);
        
        // Prepare messages for the second call: original history + assistant's response (with tool_calls) + tool results
        const messagesForSecondCall: OpenAI.Chat.ChatCompletionMessageParam[] = [
          ...userMessagesForFirstCall, // Includes system prompt and user history + current message
          responseMessage, // Assistant's first message asking to call tools
        ];
        
        const toolExecutionResults = []; // Store results for citation extraction later

        // Execute tools and gather results
        for (const toolCall of toolCalls) {
          if (toolCall.type === 'function') {
            const functionName = toolCall.function.name;
            const functionArgs = JSON.parse(toolCall.function.arguments);
            let result: any; // To store the result of the function call

            console.log(`[Luna Chat API] Executing tool: ${functionName}`);

            try {
              // Execute the appropriate function based on the tool call
              if (functionName === 'search') {
                result = await performKnowledgeBaseSearch(functionArgs.query, forwardedCookies);
              } else if (functionName === 'updateContent') {
                result = await performLessonUpdate(functionArgs.sectionId, functionArgs.modificationInstruction);
              } else if (functionName === 'generateCourseOutline') {
                result = await performCourseOutlineGeneration(functionArgs.prompt, functionArgs.gradeLevel, functionArgs.lengthInWeeks, forwardedCookies);
              } else if (functionName === 'addLessonSection') {
                result = await performAddLessonSection(functionArgs.lessonId, functionArgs.title, functionArgs.contentDescription, functionArgs.sectionType, functionArgs.orderIndex, forwardedCookies);
              } else if (functionName === 'updateBaseClass') {
                result = await performUpdateBaseClass(functionArgs.baseClassId, functionArgs, forwardedCookies);
              } else if (functionName === 'createPath') {
                result = await performCreatePath(functionArgs.baseClassId, functionArgs.title, functionArgs.description, functionArgs.orderIndex, forwardedCookies);
              } else if (functionName === 'updatePath') {
                result = await performUpdatePath(functionArgs.pathId, functionArgs, forwardedCookies);
              } else if (functionName === 'deletePath') {
                result = await performDeletePath(functionArgs.pathId, forwardedCookies);
              } else if (functionName === 'createLesson') {
                result = await performCreateLesson(functionArgs.pathId, functionArgs.title, functionArgs.description, functionArgs.objectives, functionArgs.orderIndex, forwardedCookies);
              } else if (functionName === 'updateLesson') {
                result = await performUpdateLesson(functionArgs.lessonId, functionArgs, forwardedCookies);
              } else if (functionName === 'deleteLesson') {
                result = await performDeleteLesson(functionArgs.lessonId, forwardedCookies);
              } else if (functionName === 'updateLessonSection') {
                result = await performUpdateLessonSection(functionArgs.sectionId, functionArgs, forwardedCookies);
              } else if (functionName === 'deleteLessonSection') {
                result = await performDeleteLessonSection(functionArgs.sectionId, forwardedCookies);
              } else if (functionName === 'reorderContent') {
                result = await performReorderContent(functionArgs.itemType, functionArgs.parentId, functionArgs.orderedIds, forwardedCookies);
              } else if (functionName === 'uiAction') {
                result = await performUIAction(functionArgs.componentId, functionArgs.actionType, functionArgs.additionalParams);
              } else {
                console.warn(`[Luna Chat API] Unknown tool called: ${functionName}`);
                result = { error: `Unknown tool: ${functionName}` };
              }
            } catch (toolError) {
               console.error(`[Luna Chat API] Error executing tool ${functionName}:`, toolError);
               result = { error: `Error executing tool ${functionName}`, details: toolError instanceof Error ? toolError.message : String(toolError) };
            }
            
            // Add the result for the second API call
            messagesForSecondCall.push({
              tool_call_id: toolCall.id,
              role: 'tool',
              content: JSON.stringify(result), // Send the result back to the model
            });
            
            // Store result for citation processing
            toolExecutionResults.push({
              type: 'function',
              name: functionName,
              args: result // Use the actual result object here
            });
          }
        }
        
        // Make the SECOND API call with the tool results
        console.log("[Luna Chat API] Making second OpenAI call with tool results...");
        const secondResponse = await openaiClient.chat.completions.create({
          model: "gpt-4.1-mini", // Using correct model name
          messages: messagesForSecondCall,
          temperature: 0.7,
          // No tools needed for the second call, we just want the final text response
        });
        
        responseMessage = secondResponse.choices[0].message; // Update responseMessage with the final one
        finalOpenAIResponse = secondResponse; // Update the final response object
        
        // Citations are extracted from the results gathered *before* the second call
        const citations = extractCitationsFromToolResults(toolExecutionResults);
        
        // Check if any tool result contains course outline data
        let outlineData = null;
        let isOutline = false;
        for (const toolResult of toolExecutionResults) {
          if (toolResult.name === 'generateCourseOutline' && toolResult.args?.success && toolResult.args?.outlineData) {
            outlineData = toolResult.args.outlineData;
            isOutline = true;
            break;
          }
        }
        
        console.log("[Luna Chat API] Second call complete. Final response generated.");
        return NextResponse.json({
          response: responseMessage.content || "", // Final text response
          citations,
          hasToolResults: toolExecutionResults.length > 0,
          isOutline,
          outlineData
        });
        
      } else {
         // No tool calls, use the first response directly
         console.log("[Luna Chat API] First response did not include tool calls. Using direct response.");
         return NextResponse.json({
           response: responseMessage.content || "",
           citations: [], // No tools called, so no citations from tools
           hasToolResults: false,
         });
      }

    } catch (openaiError) {
      console.error('[Luna Chat API] Error during OpenAI API interaction:', openaiError);
      return NextResponse.json({ 
        error: 'Error communicating with AI service',
        details: openaiError instanceof Error ? openaiError.message : 'Unknown error'
      }, { status: 500 });
    }

  } catch (error) {
    console.error('Error in /api/luna/chat POST handler:', error);
    const errorMessage = error instanceof Error ? error.message : 'Internal server error';
    return NextResponse.json({ error: errorMessage }, { status: 500 });
  }
} 