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
function constructSystemPrompt(context: SerializedUIContext): string {
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

  return `You are Luna, a helpful and context-aware AI assistant embedded within the LearnologyAI learning platform.
Your primary function is to assist users based on their direct queries and the current UI context, inferring their intent and suggesting appropriate actions.

## Current UI Context
*   **Route:** ${context.route || 'N/A'}
*   **Focused Element ID:** ${context.focused || 'None'}
*   **Last User Action:** ${context.lastUserAction ? `${context.lastUserAction.actionType} (on component: ${context.lastUserAction.componentId})` : 'None'}
*   **UI Pattern Analysis:** ${patternInsights}
*   **Visible Components Summary (Max 10):**
${componentSummary || '    *   (No components registered or visible)'}
${context.components.length > 10 ? '    *   ... (more components present but not listed)' : ''}

## Intent Inference Instructions
1.  Analyze the user's message combined with the UI context (especially any detailed component content provided in the summary above) to infer their intent. Common intents include:
    - Wanting information about content currently visible
    - Looking to navigate to a different section
    - Trying to perform an action on a specific component
    - Seeking to modify content they're currently viewing
    - Requesting a search for information not currently visible

2.  Based on the inferred intent, determine if a tool action is needed:
    - For information requests: Use the 'search' tool to find knowledge base content. **If the search tool returns results, prioritize them. If it returns a message indicating no specific information was found or an error occurred, acknowledge this in your response and use your general knowledge along with the provided UI context to answer the user's query. Clearly state if your answer is based on general knowledge rather than platform-specific documents.**
    - For content modifications: Use the 'updateContent' tool to update lesson sections
    - For UI interactions: Use the 'uiAction' tool to simulate clicks, navigation, etc.

3.  Extract necessary parameters from the UI context when possible:
    - Component IDs for UI actions
    - Section IDs for content updates
    - Relevant terms for knowledge base searches: **Crucially, use the course name, subject, and existing topics from the context (e.g., from 'course-structure' component metadata and content) to formulate specific search queries. Example: For a query about missing topics in 'Finance 101', search for 'additional topics for introductory finance course, besides X, Y, Z'. Avoid generic queries.**

4.  If you can't determine the parameters but an action seems appropriate, ask the user for clarification.

5.  When no tool is needed, provide a helpful text response that:
    - Acknowledges the user's context ("I see you're looking at...")
    - Directly addresses their question
    - Is concise yet informative

Always be helpful, but prioritize actions and responses that are most relevant to the user's current context and immediate needs. If you use general knowledge because the KB search was uninformative, make that clear to the user (e.g., "Based on my general understanding of [topic]..." or "While I couldn't find specific documents on this in our knowledge base...").`;
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

    // Extract cookies from the incoming request to forward them
    const forwardedCookies = request.headers.get('cookie');

    // Prepare messages for the FIRST API call
    const systemMessage = constructSystemPrompt(context as SerializedUIContext);
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
          model: "gpt-4.1-mini", // Reverted model
          messages: messagesForSecondCall,
          temperature: 0.7,
          // No tools needed for the second call, we just want the final text response
        });
        
        responseMessage = secondResponse.choices[0].message; // Update responseMessage with the final one
        finalOpenAIResponse = secondResponse; // Update the final response object
        
        // Citations are extracted from the results gathered *before* the second call
        const citations = extractCitationsFromToolResults(toolExecutionResults);
        
        console.log("[Luna Chat API] Second call complete. Final response generated.");
        return NextResponse.json({
          response: responseMessage.content || "", // Final text response
          citations,
          hasToolResults: toolExecutionResults.length > 0,
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