import { NextRequest, NextResponse } from 'next/server';
import { createSupabaseServerClient } from '@/lib/supabase/server';
import OpenAI from 'openai';

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

export async function POST(request: NextRequest) {
  try {
    const { conversationId, userMessage, studyContext, persona = 'lunaChat' } = await request.json();

    if (!conversationId || !userMessage) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
    }

    const supabase = createSupabaseServerClient();

    // Get current user
    const { data: { user }, error: userError } = await supabase.auth.getUser();
    if (userError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Save user message
    const { data: userMsg, error: userMsgError } = await supabase
      .from('luna_messages')
      .insert({
        conversation_id: conversationId,
        role: 'user',
        content: userMessage,
        context_data: studyContext,
      })
      .select()
      .single();

    if (userMsgError) {
      return NextResponse.json({ error: 'Failed to save user message' }, { status: 500 });
    }

    // Get conversation history
    const { data: messages, error: messagesError } = await supabase
      .from('luna_messages')
      .select('*')
      .eq('conversation_id', conversationId)
      .order('created_at', { ascending: true });

    if (messagesError) {
      return NextResponse.json({ error: 'Failed to get conversation history' }, { status: 500 });
    }

    // Build system prompt
    const systemPrompt = buildSystemPrompt(persona, studyContext);
    
    // Build conversation history
    const conversationHistory = (messages || [])
      .slice(-10) // Last 10 messages
      .filter((msg: any) => msg.role !== 'system')
      .map((msg: any) => ({
        role: msg.role as 'user' | 'assistant',
        content: msg.content
      }));

    // Generate AI response
    const completion = await openai.chat.completions.create({
      model: 'gpt-4.1-mini',
      messages: [
        { role: 'system', content: systemPrompt },
        ...conversationHistory,
        { role: 'user', content: userMessage }
      ],
      temperature: 0.7,
      max_tokens: 2000,
    });

    const aiContent = completion.choices[0]?.message?.content || 'I apologize, but I encountered an issue generating a response.';

    // Save AI message
    const { data: aiMessage, error: aiMsgError } = await supabase
      .from('luna_messages')
      .insert({
        conversation_id: conversationId,
        role: 'assistant',
        content: aiContent,
        context_data: studyContext,
      })
      .select()
      .single();

    if (aiMsgError) {
      return NextResponse.json({ error: 'Failed to save AI message' }, { status: 500 });
    }

    // Update conversation
    await supabase
      .from('luna_conversations')
      .update({
        message_count: (messages?.length || 0) + 2, // +2 for user and AI messages
        updated_at: new Date().toISOString(),
      })
      .eq('id', conversationId);

    // Generate action buttons and citations
    const actionButtons = generateActionButtons(aiContent, studyContext);
    const citations = extractCitations(studyContext);

    return NextResponse.json({
      message: aiMessage,
      actionButtons,
      citations,
    });

  } catch (error) {
    console.error('Error in Luna chat API:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

function buildSystemPrompt(persona: string, studyContext?: any): string {
  let basePrompt = '';

  switch (persona) {
    case 'lunaChat':
      basePrompt = `You are Luna, an intelligent AI study assistant. You help students learn by explaining concepts, answering questions, and providing study guidance. You are knowledgeable, patient, and encouraging.`;
        break;
    case 'teacher':
      basePrompt = `You are Luna in teacher mode, acting as a knowledgeable instructor. You provide structured explanations, ask probing questions, and guide learning through pedagogical techniques.`;
        break;
    case 'tutor':
      basePrompt = `You are Luna in tutor mode, providing one-on-one academic support. You adapt to the student's pace, identify knowledge gaps, and provide personalized explanations.`;
        break;
      default:
      basePrompt = `You are Luna, an AI assistant focused on helping with learning and studying.`;
  }

  if (studyContext) {
    if (studyContext.selectedCourse) {
      basePrompt += `\n\nThe student is currently studying: ${studyContext.selectedCourse.title}`;
    }

    if (studyContext.selectedContent && studyContext.selectedContent.length > 0) {
      basePrompt += `\n\nRelevant study materials:\n`;
      studyContext.selectedContent.forEach((content: any, index: number) => {
        basePrompt += `${index + 1}. ${content.title} (${content.type})\n`;
        if (content.content && content.content.length > 0) {
          basePrompt += `   Content: ${content.content.substring(0, 500)}...\n`;
        }
      });
    }

    if (studyContext.selectedText) {
      basePrompt += `\n\nThe student has selected this text: "${studyContext.selectedText.text}"`;
      basePrompt += `\nFrom source: ${studyContext.selectedText.source}`;
    }

    if (studyContext.currentNotes && studyContext.currentNotes.length > 0) {
      basePrompt += `\n\nStudent's current notes:\n`;
      studyContext.currentNotes.forEach((note: any, index: number) => {
        basePrompt += `${index + 1}. ${note.title}: ${note.content.substring(0, 200)}...\n`;
      });
    }
  }

  basePrompt += `\n\nAlways be helpful, encouraging, and focused on promoting learning. When explaining concepts, use examples and analogies to make them clear. If you're unsure about something, say so rather than guessing.`;

  return basePrompt;
}

function generateActionButtons(aiContent: string, studyContext?: any): Array<any> {
  const buttons: Array<any> = [];

  // Add context-specific action buttons
  if (studyContext?.selectedText) {
    buttons.push({
      id: 'save-note',
      label: 'Save as Note',
      action: 'save_note',
      data: { text: studyContext.selectedText.text },
      style: 'primary'
    });
  }

  if (studyContext?.selectedContent && studyContext.selectedContent.length > 0) {
    buttons.push({
      id: 'create-mindmap',
      label: 'Create Mind Map',
      action: 'create_mindmap',
      data: { content: studyContext.selectedContent },
      style: 'secondary'
    });
  }

  // Add general study action buttons
  if (aiContent.toLowerCase().includes('quiz') || aiContent.toLowerCase().includes('test')) {
    buttons.push({
      id: 'create-quiz',
      label: 'Generate Practice Quiz',
      action: 'create_quiz',
      data: { topic: studyContext?.selectedCourse?.title || 'Current Topic' },
      style: 'success'
    });
  }

  return buttons;
}

function extractCitations(studyContext?: any): Array<{ id: string; title: string; url?: string }> {
  const citations: Array<{ id: string; title: string; url?: string }> = [];

  if (studyContext?.selectedContent) {
    studyContext.selectedContent.forEach((content: any, index: number) => {
            citations.push({
        id: content.id,
        title: content.title,
        url: content.type === 'lesson' ? `/learn/lesson/${content.id}` : undefined
      });
    });
  }
  
  return citations;
} 