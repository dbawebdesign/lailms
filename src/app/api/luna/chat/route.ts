import { NextResponse } from 'next/server';
import { SerializedUIContext } from '@/context/LunaContextProvider';
import { createOpenAI } from "@ai-sdk/openai";
// Correctly import types from 'ai'
import { 
  generateText, 
  tool, 
  ToolCallPart, 
  ToolResultPart, 
  CoreMessage 
} from 'ai'; 
import { z } from 'zod';

// Initialize OpenAI client 
// Assumes OPENAI_API_KEY is set in environment variables
const openai = createOpenAI();

// Remove explicit model typing - let SDK infer
// const model: LanguageModel = openai('gpt-4.1-mini'); 

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

// Tool definition for knowledge base search
const searchTool = tool({
  description: 'Search the LearnologyAI knowledge base for relevant documents or chunks.',
  parameters: searchKnowledgeBaseSchema,
  // execute implementation is defined below
});

// Tool definition for updating lesson content
const updateContentTool = tool({
  description: 'Updates the content of a specific lesson section based on user instructions (e.g., change grade level, expand, simplify).',
  parameters: updateLessonSectionContentSchema,
  // execute implementation is defined below
});

// --- Backend Implementations (Placeholders/Delegation) ---

// Placeholder for actual KB Search
async function performKnowledgeBaseSearch(query: string): Promise<any> {
  console.log(`---> EXECUTING KB SEARCH for query: ${query}`);
  // TODO: Replace with actual call to KB search service
  
  // Return with citations for testing
  return { 
    results: [
      { 
        id: 'doc-mock-1', 
        title: 'Introduction to Photosynthesis', 
        snippet: 'This is a mock snippet for query: ' + query,
        url: '/documents/doc-mock-1'
      },
      { 
        id: 'doc-mock-2', 
        title: 'Plant Cell Structure', 
        snippet: 'Related information about ' + query,
        url: '/documents/doc-mock-2'
      }
    ] 
  };
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

// --- Refined getAIResponse (handles prompt construction) ---
function constructSystemPrompt(context: SerializedUIContext): string {
  return `You are Luna, a helpful and concise AI assistant embedded within the LearnologyAI learning platform. 
Your primary function is to assist users based on their direct queries and the context of their current actions on the platform. You can search the knowledge base and update lesson content when requested.

## Current UI Context
*   **Route:** ${context.route || 'N/A'}
*   **Focused Element ID:** ${context.focused || 'None'}
*   **Last User Action:** ${context.lastUserAction ? `${context.lastUserAction.actionType} (on component: ${context.lastUserAction.componentId})` : 'None'}
*   **Visible Components Summary (Max 10):**
${context.components
    .filter(c => c.isVisible !== false)
    .map(c => `    *   [${c.type}] Role: ${c.role}${c.content?.title ? `, Title: \"${c.content.title}\"` : ''}${c.metadata?.lessonIdentifier ? `, LessonSectionID: ${c.metadata.lessonIdentifier}` : ''}`)
    .slice(0, 10)
    .join('\n') || '    *   (No components registered or visible)'}
${context.components.length > 10 ? '    *   ... (more components present but not listed)' : ''}

## Instructions
1.  Analyze the user's message in conjunction with the provided UI Context.
2.  If the context seems relevant, incorporate it naturally into your response.
3.  Determine if the user's request requires searching the knowledge base or updating lesson content.
4.  If an action/tool is needed, request the appropriate tool call (search or updateContent) with the necessary parameters. Extract parameters like sectionId from the context if possible.
5.  If context lacks necessary info (like sectionId for an update), ask the user for clarification before requesting the tool.
6.  If no specific tool is needed, provide a helpful text response.
7.  Be concise and focus on being helpful within the LearnologyAI environment.
8.  When you use search results, always reference them in your response with appropriate citations.`;
}

// Process tool results to extract citations for the frontend
function extractCitationsFromToolResults(result: any): { id: string; title: string; url?: string }[] {
  const citations: { id: string; title: string; url?: string }[] = [];
  
  // Extract from toolResults array if it exists
  const toolResults = result.toolResults || [];
  
  for (const toolResult of toolResults) {
    try {
      // For search tool results
      if (toolResult.type === 'tool-result' && toolResult.toolName === 'search') {
        const searchResult = toolResult.result;
        const results = searchResult?.results || [];
        
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
      if (toolResult.type === 'tool-result' && toolResult.toolName === 'updateContent') {
        const updateResult = toolResult.result;
        if (updateResult?.sectionInfo) {
          const { id, title, url } = updateResult.sectionInfo;
          if (id && title) {
            citations.push({ id, title, url });
          }
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
  try {
    const { message, context, messages: history = [] } = await request.json(); 

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

    const currentMessages: CoreMessage[] = [
        ...history, 
        { role: 'user', content: message }
    ];

    const systemPrompt = constructSystemPrompt(context as SerializedUIContext);

    // Create tool implementations with execute methods
    const tools = {
      search: {
        ...searchTool,
        execute: async (args: { query: string }) => {
          return await performKnowledgeBaseSearch(args.query);
        }
      },
      updateContent: {
        ...updateContentTool,
        execute: async (args: { sectionId: string, modificationInstruction: string }) => {
          return await performLessonUpdate(args.sectionId, args.modificationInstruction);
        }
      }
    };

    // Use maxSteps to automatically handle multiple tool calls
    const response = await generateText({
      model: openai('gpt-4.1-mini'),
      system: systemPrompt, 
      messages: currentMessages,
      tools,
      maxSteps: 3, // Allow up to 3 steps of tool calling and responses
      temperature: 0.7,
    });

    // Extract citations from tool results if any
    const citations = extractCitationsFromToolResults(response);

    // Return the final text response and any citations
    return NextResponse.json({ 
      response: response.text,
      citations,
      // Don't include raw tool results in the response to avoid type issues
      hasToolResults: response.toolResults && response.toolResults.length > 0
    });

  } catch (error) {
    console.error('Error in /api/luna/chat:', error);
    const errorMessage = error instanceof Error ? error.message : 'Internal server error';
    return NextResponse.json({ error: errorMessage }, { status: 500 });
  }
} 