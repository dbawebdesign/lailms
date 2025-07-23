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
  context?: 'study-tools' | 'study-tools-isolated' | 'main-app';
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
      quickAction,
      context = 'main-app'
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
          persona: 'luna',
          metadata: { context } // Store the context to distinguish conversations
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
    let systemPrompt = (context === 'study-tools' || context === 'study-tools-isolated')
      ? `You are Luna, an AI study partner integrated into the study tools environment. You help students understand their study materials, create summaries, explain concepts, and provide structured learning support.

Key characteristics:
- Friendly, encouraging, and supportive tone
- Focus on the specific study materials and sources provided
- Break down complex concepts into digestible parts
- Use examples and analogies when helpful
- Provide structured, well-formatted responses optimized for study sessions
- When highlighting text is provided, focus your response on that specific content

${contextParts.length > 0 ? `Study Context:\n${contextParts.join('\n\n')}` : ''}`
      : `You are Luna, an AI assistant designed to help with various tasks and conversations. You provide clear, structured, and engaging responses.

Key characteristics:
- Friendly, encouraging, and supportive tone
- Break down complex concepts into digestible parts
- Use examples and analogies when helpful
- Provide structured, well-formatted responses

${contextParts.length > 0 ? `Context:\n${contextParts.join('\n\n')}` : ''}`;

    // Add intelligent format selection
    systemPrompt += '\n\nChoose the most appropriate response format based on the user\'s request:\n' +
      '- Use MINDMAP format for: concept mapping, visual organization, brainstorming, showing relationships between ideas\n' +
      '- Use STRUCTURED format for: step-by-step instructions, detailed explanations, complex topics with multiple parts\n' +
      '- Use SUMMARY format for: condensing information, highlighting key points, quick overviews\n' +
      '- Use TEXT format for: conversational responses, simple explanations, direct answers\n\n' +
      'Always choose the format that best serves the user\'s learning needs and the nature of their question.';

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

    // Detect the format Luna chose based on response content
    const detectedFormat = detectResponseFormat(assistantResponse);

    // Save assistant message
    const { data: savedMessage } = await supabase
      .from('luna_messages')
      .insert({
        conversation_id: currentConversationId,
        role: 'assistant',
        content: assistantResponse,
        persona: 'luna',
        metadata: { 
          response_format: detectedFormat,
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
    const quickActions = generateQuickActions(assistantResponse, detectedFormat);

    return NextResponse.json({
      message: assistantResponse,
      conversationId: currentConversationId,
      messageId: savedMessage?.id,
      responseFormat: detectedFormat,
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

function detectResponseFormat(response: string): 'text' | 'mindmap' | 'structured' | 'summary' {
  const content = response.toLowerCase();
  
  // Check for mindmap indicators
  if (content.includes('mind map') || 
      content.includes('mindmap') ||
      (content.includes('##') && content.includes('###') && content.includes('-')) ||
      content.match(/^\s*[\-\*]\s+.*\n\s*[\-\*]\s+/m)) {
    return 'mindmap';
  }
  
  // Check for structured format indicators
  if (content.includes('step 1') || 
      content.includes('1.') ||
      content.includes('## ') ||
      content.includes('### ') ||
      (content.match(/\n\s*[\-\*]\s+/g)?.length || 0) > 3) {
    return 'structured';
  }
  
  // Check for summary indicators
  if (content.includes('summary') ||
      content.includes('key points') ||
      content.includes('in summary') ||
      content.includes('to summarize')) {
    return 'summary';
  }
  
  // Default to text format
  return 'text';
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