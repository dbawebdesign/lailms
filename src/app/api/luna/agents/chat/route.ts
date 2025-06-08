import { NextResponse } from 'next/server';
import { LunaAgentRegistry } from '@/lib/luna/agents/AgentRegistry';
import { BaseLunaAgent, BaseLunaRealtimeAgent } from '@/lib/luna/agents/core/BaseLunaAgent';
import { AgentContext } from '@/lib/luna/agents/core/SupabaseAgentClient';
import { createClient } from '@supabase/supabase-js';

// Helper to get user context from request
async function getUserContext(request: Request): Promise<AgentContext | null> {
  try {
    // Extract cookies from request to get user session
    const cookies = request.headers.get('cookie');
    if (!cookies) return null;

    // Create Supabase client with user context
    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      {
        auth: {
          persistSession: false
        }
      }
    );

    // Get user from session (you'll need to implement this based on your auth)
    // For now, return a mock context
    return {
      userId: 'user_123',
      orgId: 'org_123',
      role: 'student',
      sessionId: `session_${Date.now()}`,
      agentName: 'luna-agent'
    };
  } catch (error) {
    console.error('Failed to get user context:', error);
    return null;
  }
}

// Helper to create real-time updates based on agent actions
function createRealTimeUpdates(agentResponse: any): Array<{
  entity: string;
  entityId: string;
  type: 'create' | 'update' | 'delete';
  status: 'pending' | 'completed' | 'failed';
}> {
  const updates = [];
  
  // Parse agent response for real-time updates
  if (agentResponse.metadata?.createdContent) {
    updates.push({
      entity: agentResponse.metadata.createdContent.type,
      entityId: agentResponse.metadata.createdContent.id,
      type: 'create',
      status: 'completed'
    });
  }
  
  if (agentResponse.metadata?.updatedContent) {
    updates.push({
      entity: agentResponse.metadata.updatedContent.type,
      entityId: agentResponse.metadata.updatedContent.id,
      type: 'update',
      status: 'completed'
    });
  }
  
  return updates;
}

// Helper to extract action buttons from agent response
function extractActionButtons(response: string, agentType: string): Array<{
  id: string;
  label: string;
  action: string;
  data?: any;
  variant?: 'primary' | 'secondary' | 'success' | 'warning';
}> {
  const buttons = [];
  
  // Look for action indicators in response
  if (response.includes('course outline') && agentType === 'classCoPilot') {
    buttons.push({
      id: 'save_outline',
      label: 'Save Course Outline',
      action: 'save_course_outline',
      variant: 'primary'
    });
    buttons.push({
      id: 'open_designer',
      label: 'Open in Designer',
      action: 'open_designer',
      variant: 'secondary'
    });
  }
  
  if (response.includes('practice') && agentType === 'tutor') {
    buttons.push({
      id: 'create_practice',
      label: 'Create Practice Quiz',
      action: 'create_practice_quiz',
      variant: 'secondary'
    });
  }
  
  if (response.includes('assessment') && agentType === 'assessmentBuilder') {
    buttons.push({
      id: 'create_assessment',
      label: 'Generate Assessment',
      action: 'create_assessment',
      variant: 'primary'
    });
  }
  
  return buttons;
}

// Helper to extract citations from agent response
function extractCitations(response: string): Array<{
  id: string;
  title: string;
  url?: string;
}> {
  const citations = [];
  
  // Look for citation patterns in response
  const citationRegex = /\[source:\s*([^\]]+)\]/gi;
  let match;
  let citationIndex = 1;
  
  while ((match = citationRegex.exec(response)) !== null) {
    citations.push({
      id: `citation_${citationIndex}`,
      title: match[1],
      url: `/knowledge-base/documents?search=${encodeURIComponent(match[1])}`
    });
    citationIndex++;
  }
  
  return citations;
}

export async function POST(request: Request) {
  try {
    // Parse request body
    const body = await request.json();
    const { 
      message, 
      agentPersona, 
      userRole, 
      conversationHistory = [],
      timestamp 
    } = body;

    // Validate required fields
    if (!message || !agentPersona || !userRole) {
      return NextResponse.json(
        { error: 'Missing required fields: message, agentPersona, userRole' },
        { status: 400 }
      );
    }

    // Get user context
    const userContext = await getUserContext(request);
    if (!userContext) {
      return NextResponse.json(
        { error: 'Failed to authenticate user' },
        { status: 401 }
      );
    }

    // Update user context with current role
    userContext.role = userRole;

    console.log(`[Luna Agents API] Processing message for ${agentPersona} agent`);
    console.log(`[Luna Agents API] User role: ${userRole}`);
    console.log(`[Luna Agents API] Message: ${message.substring(0, 100)}...`);

    // Get the appropriate agent based on persona
    let agent: BaseLunaAgent | BaseLunaRealtimeAgent;
    
    try {
      switch (agentPersona) {
        case 'tutor':
          agent = LunaAgentRegistry.tutorAgent;
          break;
        case 'examCoach':
          agent = LunaAgentRegistry.examCoachAgent;
          break;
        case 'classCoPilot':
          agent = LunaAgentRegistry.classCoPilotAgent;
          break;
        case 'contentCreator':
          agent = LunaAgentRegistry.contentCreatorAgent;
          break;
        case 'assessmentBuilder':
          agent = LunaAgentRegistry.assessmentBuilderAgent;
          break;
        case 'voiceTutor':
          agent = LunaAgentRegistry.voiceTutorAgent;
          break;
        default:
          agent = LunaAgentRegistry.tutorAgent; // Default fallback
      }
    } catch (error) {
      console.error('[Luna Agents API] Failed to get agent:', error);
      return NextResponse.json(
        { error: 'Agent not available' },
        { status: 500 }
      );
    }

    // Prepare enhanced message with conversation context
    const enhancedMessage = `
      User Role: ${userRole}
      Current Time: ${new Date().toLocaleString()}
      
      Recent Conversation Context:
      ${conversationHistory.slice(-3).map((msg: any) => 
        `${msg.role}: ${msg.content}`
      ).join('\n')}
      
      Current Message: ${message}
      
      Please provide a helpful response based on your role as ${agentPersona} and the user's role as ${userRole}.
    `;

    // Execute agent
    console.log(`[Luna Agents API] Executing ${agentPersona} agent...`);
    const startTime = Date.now();
    
    let agentResponse;
    try {
      if (agent instanceof BaseLunaAgent) {
        agentResponse = await agent.runWithContext(enhancedMessage, userContext);
      } else {
        // Handle RealtimeAgent differently
        agentResponse = await agent.runWithVoiceContext(enhancedMessage, userContext);
      }
    } catch (agentError) {
      console.error('[Luna Agents API] Agent execution failed:', agentError);
      return NextResponse.json(
        { 
          error: 'Agent processing failed',
          details: agentError instanceof Error ? agentError.message : 'Unknown error'
        },
        { status: 500 }
      );
    }

    const executionTime = Date.now() - startTime;
    console.log(`[Luna Agents API] Agent execution completed in ${executionTime}ms`);

    // Extract response content
    const responseContent = agentResponse.finalOutput || agentResponse.content || 'I apologize, but I encountered an issue processing your request.';

    // Extract tools used (if available)
    const toolsUsed = agentResponse.toolCalls?.map((call: any) => call.toolName) || [];

    // Generate real-time updates
    const realTimeUpdates = createRealTimeUpdates(agentResponse);

    // Extract action buttons
    const actionButtons = extractActionButtons(responseContent, agentPersona);

    // Extract citations
    const citations = extractCitations(responseContent);

    // Prepare response
    const response = {
      response: responseContent,
      agentName: agent.name || agentPersona,
      agentType: agent.agentType || 'text',
      toolsUsed,
      citations,
      actionButtons,
      realTimeUpdates,
      executionTime,
      timestamp: new Date().toISOString(),
      metadata: {
        agentPersona,
        userRole,
        conversationLength: conversationHistory.length
      }
    };

    console.log(`[Luna Agents API] Response prepared:`, {
      responseLength: responseContent.length,
      toolsUsed: toolsUsed.length,
      citations: citations.length,
      actionButtons: actionButtons.length,
      realTimeUpdates: realTimeUpdates.length
    });

    return NextResponse.json(response);

  } catch (error) {
    console.error('[Luna Agents API] Unexpected error:', error);
    return NextResponse.json(
      { 
        error: 'Internal server error',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    );
  }
}

// Handle OPTIONS for CORS
export async function OPTIONS() {
  return new NextResponse(null, {
    status: 200,
    headers: {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, Authorization',
    },
  });
}