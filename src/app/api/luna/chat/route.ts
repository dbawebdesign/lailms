import { NextRequest, NextResponse } from 'next/server';
import { createSupabaseServerClient } from '@/lib/supabase/server';
import OpenAI from 'openai';

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY!,
});

interface ChatMessage {
  role: 'user' | 'assistant';
  content: string;
  response_format?: 'text' | 'mindmap' | 'structured' | 'summary';
  highlighted_text?: string;
  sources?: any[];
}

interface ChatRequest {
  message: string;
  conversationId?: string;
  responseFormat?: 'text' | 'mindmap' | 'structured' | 'summary';
  highlightedText?: string;
  sources?: any[];
  quickAction?: string;
}

export async function POST(request: NextRequest) {
  try {
    const supabase = createSupabaseServerClient();
    
    // Check authentication
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body: ChatRequest = await request.json();
    const { 
      message, 
      conversationId, 
      responseFormat = 'text',
      highlightedText,
      sources = [],
      quickAction
    } = body;

    if (!message?.trim()) {
      return NextResponse.json({ error: 'Message is required' }, { status: 400 });
    }

    let currentConversationId = conversationId;
    let conversationHistory: ChatMessage[] = [];

    // Get or create conversation
    if (currentConversationId) {
      // Fetch existing conversation and messages
      const { data: conversation } = await supabase
        .from('luna_conversations')
        .select('*')
        .eq('id', currentConversationId)
        .eq('user_id', user.id)
        .single();

      if (conversation) {
        const { data: messages } = await supabase
          .from('luna_messages')
          .select('*')
          .eq('conversation_id', currentConversationId)
          .order('created_at', { ascending: true });

        conversationHistory = messages?.map((msg: any) => ({
          role: msg.role as 'user' | 'assistant',
          content: msg.content,
          response_format: msg.metadata?.response_format,
          highlighted_text: msg.metadata?.highlighted_text,
          sources: msg.metadata?.sources || []
        })) || [];
      }
    } else {
      // Create new conversation
      const { data: newConversation, error: conversationError } = await supabase
        .from('luna_conversations')
        .insert({
          user_id: user.id,
          title: message.slice(0, 50) + (message.length > 50 ? '...' : ''),
          persona: 'luna'
        })
        .select()
        .single();

      if (conversationError) {
        console.error('Error creating conversation:', conversationError);
        return NextResponse.json({ error: 'Failed to create conversation' }, { status: 500 });
      }

      currentConversationId = newConversation.id;
    }

    // Save user message
    await supabase
      .from('luna_messages')
      .insert({
        conversation_id: currentConversationId,
        role: 'user',
        content: message,
        persona: 'luna',
        highlighted_text: highlightedText,
        metadata: { sources, quickAction }
      });

    // Build context for Luna
    const contextParts: string[] = [];
    
    // Add highlighted text context
    if (highlightedText) {
      contextParts.push(`Selected text from study material: "${highlightedText}"`);
    }

    // Add sources context
    if (sources.length > 0) {
      const sourceContext = sources.map(source => {
        if (source.type === 'document') {
          return `Document: ${source.title} (${source.pages} pages)`;
        } else if (source.type === 'video') {
          return `Video: ${source.title} (${source.duration})`;
        } else if (source.type === 'note') {
          return `Note: ${source.title}`;
        }
        return `Source: ${source.title}`;
      }).join('\n');
      contextParts.push(`Active study sources:\n${sourceContext}`);
    }

    // Build system prompt based on response format and quick action
    let systemPrompt = `You are Luna, an AI study partner designed to help students learn effectively. You provide clear, structured, and engaging responses.

Key characteristics:
- Friendly, encouraging, and supportive tone
- Break down complex concepts into digestible parts
- Use examples and analogies when helpful
- Encourage active learning and critical thinking
- Provide structured, well-formatted responses

${contextParts.length > 0 ? `Context:\n${contextParts.join('\n\n')}` : ''}`;

    // Adjust prompt based on response format
    switch (responseFormat) {
      case 'mindmap':
        systemPrompt += '\n\nFormat your response as a structured mindmap using markdown with clear hierarchical organization, bullet points, and logical connections between concepts.';
        break;
      case 'structured':
        systemPrompt += '\n\nFormat your response with clear headings, bullet points, numbered lists, and structured sections for maximum readability and comprehension.';
        break;
      case 'summary':
        systemPrompt += '\n\nProvide a concise, well-organized summary with key points highlighted and essential information clearly presented.';
        break;
      default:
        systemPrompt += '\n\nProvide a clear, well-formatted response with good structure and readability.';
    }

    // Handle quick actions
    if (quickAction) {
      switch (quickAction) {
        case 'explain':
          systemPrompt += '\n\nFocus on providing a clear, detailed explanation of the concept or topic.';
          break;
        case 'summarize':
          systemPrompt += '\n\nProvide a concise summary of the key points and main ideas.';
          break;
        case 'quiz':
          systemPrompt += '\n\nCreate practice questions or a quiz based on the content to help with learning.';
          break;
        case 'examples':
          systemPrompt += '\n\nProvide relevant examples and practical applications of the concept.';
          break;
      }
    }

    // Prepare messages for OpenAI
    const messages: OpenAI.Chat.Completions.ChatCompletionMessageParam[] = [
      { role: 'system', content: systemPrompt },
      ...conversationHistory.map(msg => ({
        role: msg.role,
        content: msg.content
      })),
      { role: 'user', content: message }
    ];

    // Call OpenAI with GPT-4.1-mini
    const completion = await openai.chat.completions.create({
      model: 'gpt-4o-mini', // Using the latest available model
      messages,
      temperature: 0.7,
      max_tokens: 2000,
      stream: false
    });

    const assistantResponse = completion.choices[0]?.message?.content || 'I apologize, but I encountered an error generating a response.';

    // Save assistant message
    const { data: savedMessage } = await supabase
      .from('luna_messages')
      .insert({
        conversation_id: currentConversationId,
        role: 'assistant',
        content: assistantResponse,
        persona: 'luna',
        metadata: { 
          response_format: responseFormat,
          model: 'gpt-4o-mini',
          tokens_used: completion.usage?.total_tokens || 0
        }
      })
      .select()
      .single();

    // Update conversation timestamp
    await supabase
      .from('luna_conversations')
      .update({ updated_at: new Date().toISOString() })
      .eq('id', currentConversationId);

    // Generate quick action buttons based on the response
    const quickActions = generateQuickActions(assistantResponse, responseFormat);

    return NextResponse.json({
      message: assistantResponse,
      conversationId: currentConversationId,
      messageId: savedMessage?.id,
      responseFormat,
      quickActions,
      sources: sources
    });

  } catch (error) {
    console.error('Error in Luna chat:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

function generateQuickActions(response: string, format: string) {
  const baseActions = [
    { id: 'explain', label: 'Explain Further', icon: '💡' },
    { id: 'examples', label: 'Show Examples', icon: '📋' },
    { id: 'quiz', label: 'Quiz Me', icon: '❓' },
    { id: 'summarize', label: 'Summarize', icon: '📝' }
  ];

  // Add format-specific actions
  const formatActions: Record<string, any[]> = {
    text: [
      { id: 'mindmap', label: 'As Mindmap', icon: '🗺️' },
      { id: 'structured', label: 'Structure This', icon: '📊' }
    ],
    mindmap: [
      { id: 'text', label: 'As Text', icon: '📄' },
      { id: 'expand', label: 'Expand Nodes', icon: '🔍' }
    ],
    structured: [
      { id: 'mindmap', label: 'As Mindmap', icon: '🗺️' },
      { id: 'simplify', label: 'Simplify', icon: '✨' }
    ]
  };

  return [...baseActions.slice(0, 3), ...(formatActions[format] || [])];
} 