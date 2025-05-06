import { NextResponse } from 'next/server';
import { SerializedUIContext } from '@/context/LunaContextProvider';
import OpenAI from 'openai';
import { z } from 'zod';

// Hard-code the API key directly for development
// In production, use environment variables properly
const OPENAI_API_KEY = "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";

// Initialize OpenAI client directly with the hard-coded key
const openaiClient = new OpenAI({
  apiKey: OPENAI_API_KEY,
});

console.log("OpenAI client initialized with API key:", OPENAI_API_KEY.substring(0, 10) + "***");

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

// --- Refined System Prompt Construction ---
function constructSystemPrompt(context: SerializedUIContext): string {
  // Generate UI pattern analysis
  const patternInsights = analyzeUIPatterns(context);
  
  return `You are Luna, a helpful and context-aware AI assistant embedded within the LearnologyAI learning platform. 
Your primary function is to assist users based on their direct queries and the current UI context, inferring their intent and suggesting appropriate actions.

## Current UI Context
*   **Route:** ${context.route || 'N/A'}
*   **Focused Element ID:** ${context.focused || 'None'}
*   **Last User Action:** ${context.lastUserAction ? `${context.lastUserAction.actionType} (on component: ${context.lastUserAction.componentId})` : 'None'}
*   **UI Pattern Analysis:** ${patternInsights}
*   **Visible Components Summary (Max 10):**
${context.components
    .filter(c => c.isVisible !== false)
    .map(c => `    *   [${c.type}] Role: ${c.role}, ID: ${c.id}${c.content?.title ? `, Title: \"${c.content.title}\"` : ''}${c.metadata?.lessonIdentifier ? `, LessonSectionID: ${c.metadata.lessonIdentifier}` : ''}`)
    .slice(0, 10)
    .join('\n') || '    *   (No components registered or visible)'}
${context.components.length > 10 ? '    *   ... (more components present but not listed)' : ''}

## Intent Inference Instructions
1.  Analyze the user's message combined with the UI context to infer their intent. Common intents include:
    - Wanting information about content currently visible
    - Looking to navigate to a different section
    - Trying to perform an action on a specific component
    - Seeking to modify content they're currently viewing
    - Requesting a search for information not currently visible

2.  Based on the inferred intent, determine if a tool action is needed:
    - For information requests: Use the 'search' tool to find knowledge base content
    - For content modifications: Use the 'updateContent' tool to update lesson sections
    - For UI interactions: Use the 'uiAction' tool to simulate clicks, navigation, etc.

3.  Extract necessary parameters from the UI context when possible:
    - Component IDs for UI actions
    - Section IDs for content updates
    - Relevant terms for knowledge base searches

4.  If you can't determine the parameters but an action seems appropriate, ask the user for clarification.

5.  When no tool is needed, provide a helpful text response that:
    - Acknowledges the user's context ("I see you're looking at...")
    - Directly addresses their question
    - Is concise yet informative

Always be helpful, but prioritize actions and responses that are most relevant to the user's current context and immediate needs.`;
}

// Process tool results to extract citations for the frontend
function extractCitationsFromToolResults(toolResults: any[]): { id: string; title: string; url?: string }[] {
  const citations: { id: string; title: string; url?: string }[] = [];
  
  if (!toolResults || !Array.isArray(toolResults)) {
    return citations;
  }
  
  for (const toolResult of toolResults) {
    try {
      // For search tool results
      if (toolResult.type === 'function' && toolResult.name === 'search') {
        const searchResult = toolResult.args;
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
      if (toolResult.type === 'function' && toolResult.name === 'updateContent') {
        const updateResult = toolResult.args;
        if (updateResult?.sectionInfo) {
          const { id, title, url } = updateResult.sectionInfo;
          if (id && title) {
            citations.push({ id, title, url });
          }
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
  try {
    // Parse the request body
    let requestBody;
    try {
      requestBody = await request.json();
    } catch (error) {
      console.error('Error parsing request JSON:', error);
      return NextResponse.json({ error: 'Invalid JSON in request' }, { status: 400 });
    }
    
    const { message, context, messages: history = [] } = requestBody;

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

    // Prepare messages for the API call
    const systemMessage = constructSystemPrompt(context as SerializedUIContext);
    const userMessages = [...history, { role: 'user', content: message }];

    // Define function tools for OpenAI
    const tools = [
      {
        type: "function" as const,
        function: {
          name: "search",
          description: "Search the LearnologyAI knowledge base for relevant documents or chunks.",
          parameters: {
            type: "object",
            properties: {
              query: {
                type: "string",
                description: "The search query for the knowledge base"
              }
            },
            required: ["query"]
          }
        }
      },
      {
        type: "function" as const,
        function: {
          name: "updateContent",
          description: "Updates the content of a specific lesson section based on user instructions (e.g., change grade level, expand, simplify).",
          parameters: {
            type: "object",
            properties: {
              sectionId: {
                type: "string",
                description: "The ID of the lesson section to update. Extract this from context if possible, or ask the user."
              },
              modificationInstruction: {
                type: "string",
                description: "The user's instruction for how to modify the content (e.g., 'make it 5th grade level', 'expand on this topic', 'simplify this paragraph')."
              }
            },
            required: ["sectionId", "modificationInstruction"]
          }
        }
      },
      {
        type: "function" as const,
        function: {
          name: "uiAction",
          description: "Perform an action on a UI component based on user intent (e.g., clicking a button, navigating to a page, submitting a form).",
          parameters: {
            type: "object",
            properties: {
              componentId: {
                type: "string",
                description: "The ID of the component to interact with"
              },
              actionType: {
                type: "string",
                description: "The type of action to perform (e.g., 'click', 'navigate', 'open', 'close', 'submit')"
              },
              additionalParams: {
                type: "object",
                description: "Additional parameters needed for the action"
              }
            },
            required: ["componentId", "actionType"]
          }
        }
      }
    ];

    // Make direct API call to OpenAI
    try {
      const response = await openaiClient.chat.completions.create({
        model: "gpt-4.1-mini",
        messages: [
          { role: "system", content: systemMessage },
          ...userMessages.map(msg => ({ 
            role: msg.role as "user" | "assistant" | "system", 
            content: msg.content 
          }))
        ],
        tools: tools,
        tool_choice: "auto",
        temperature: 0.7,
      });

      // Get the assistant's response
      const responseMessage = response.choices[0].message;
      let finalText = responseMessage.content || '';
      const toolCalls = responseMessage.tool_calls || [];

      // Process tool calls if any
      const toolResults = [];
      for (const toolCall of toolCalls) {
        if (toolCall.type === 'function') {
          const functionName = toolCall.function.name;
          const functionArgs = JSON.parse(toolCall.function.arguments);
          
          let result;
          // Execute the appropriate function based on the tool call
          if (functionName === 'search') {
            result = await performKnowledgeBaseSearch(functionArgs.query);
          } else if (functionName === 'updateContent') {
            result = await performLessonUpdate(
              functionArgs.sectionId, 
              functionArgs.modificationInstruction
            );
          } else if (functionName === 'uiAction') {
            result = await performUIAction(
              functionArgs.componentId,
              functionArgs.actionType,
              functionArgs.additionalParams
            );
          }
          
          // Add the result to our collection
          toolResults.push({
            type: 'function',
            name: functionName,
            args: result
          });
        }
      }

      // Extract citations from tool results
      const citations = extractCitationsFromToolResults(toolResults);

      // Return the response
      return NextResponse.json({
        response: finalText,
        citations,
        hasToolResults: toolResults.length > 0
      });
    } catch (openaiError) {
      console.error('Error calling OpenAI API:', openaiError);
      return NextResponse.json({ 
        error: 'Error communicating with AI service',
        details: openaiError instanceof Error ? openaiError.message : 'Unknown error'
      }, { status: 500 });
    }

  } catch (error) {
    console.error('Error in /api/luna/chat:', error);
    const errorMessage = error instanceof Error ? error.message : 'Internal server error';
    return NextResponse.json({ error: errorMessage }, { status: 500 });
  }
} 