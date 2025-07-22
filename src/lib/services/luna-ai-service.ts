import { createClient } from '@/lib/supabase/client';
import OpenAI from 'openai';

export interface LunaMessage {
  id: string;
  conversation_id: string;
  role: 'user' | 'assistant' | 'system';
  content: string;
  context_data?: any;
  created_at: string;
  metadata?: any;
}

export interface LunaConversation {
  id: string;
  title: string;
  persona: string;
  user_id: string;
  created_at: string;
  updated_at: string;
  is_pinned: boolean;
  is_archived: boolean;
  message_count: number;
  tags: string[];
  summary?: string;
  metadata?: any;
}

export interface StudyContext {
  selectedCourse?: {
    id: string;
    title: string;
    type: 'course' | 'space';
  };
  selectedContent?: Array<{
    id: string;
    title: string;
    type: string;
    content?: string;
  }>;
  currentNotes?: Array<{
    id: string;
    title: string;
    content: string;
  }>;
  selectedText?: {
    text: string;
    source: string;
  };
}

export interface LunaResponse {
  message: LunaMessage;
  actionButtons?: Array<{
    id: string;
    label: string;
    action: string;
    data: any;
    style: string;
  }>;
  citations?: Array<{
    id: string;
    title: string;
    url?: string;
  }>;
}

export class LunaAIService {
  private supabase = createClient();

  constructor() {
    // OpenAI calls are now handled by API routes
  }

  // Conversation Management
  async createConversation(
    userId: string,
    persona: string = 'lunaChat',
    title?: string
  ): Promise<LunaConversation> {
    const { data, error } = await this.supabase
      .from('luna_conversations')
      .insert({
        title: title || 'New Conversation',
        persona,
        user_id: userId,
      })
      .select()
      .single();

    if (error) throw error;
    return data;
  }

  async getConversations(userId: string): Promise<LunaConversation[]> {
    const { data, error } = await this.supabase
      .from('luna_conversations')
      .select('*')
      .eq('user_id', userId)
      .eq('is_archived', false)
      .order('updated_at', { ascending: false });

    if (error) throw error;
    return data || [];
  }

  async getConversation(conversationId: string): Promise<LunaConversation | null> {
    const { data, error } = await this.supabase
      .from('luna_conversations')
      .select('*')
      .eq('id', conversationId)
      .single();

    if (error) return null;
    return data;
  }

  async updateConversation(
    conversationId: string,
    updates: Partial<LunaConversation>
  ): Promise<void> {
    const { error } = await this.supabase
      .from('luna_conversations')
      .update({
        ...updates,
        updated_at: new Date().toISOString(),
      })
      .eq('id', conversationId);

    if (error) throw error;
  }

  // Message Management
  async getMessages(conversationId: string): Promise<LunaMessage[]> {
    const { data, error } = await this.supabase
      .from('luna_messages')
      .select('*')
      .eq('conversation_id', conversationId)
      .order('created_at', { ascending: true });

    if (error) throw error;
    return data || [];
  }

  async saveMessage(message: Omit<LunaMessage, 'id' | 'created_at'>): Promise<LunaMessage> {
    const { data, error } = await this.supabase
      .from('luna_messages')
      .insert(message)
      .select()
      .single();

    if (error) throw error;
    return data;
  }

  // AI Chat Generation
  async generateResponse(
    conversationId: string,
    userMessage: string,
    studyContext?: StudyContext,
    persona: string = 'lunaChat'
  ): Promise<LunaResponse> {
    try {
      // Call the API route instead of using OpenAI directly
      const response = await fetch('/api/luna/chat', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          conversationId,
          userMessage,
          studyContext,
          persona,
        }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to generate response');
      }

      const result = await response.json();
      return result;

    } catch (error) {
      console.error('Error generating Luna response:', error);
      throw new Error('Failed to generate AI response');
    }
  }

  // Context Building
  private buildSystemPrompt(persona: string, studyContext?: StudyContext): string {
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
        studyContext.selectedContent.forEach((content, index) => {
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
        studyContext.currentNotes.forEach((note, index) => {
          basePrompt += `${index + 1}. ${note.title}: ${note.content.substring(0, 200)}...\n`;
        });
      }
    }

    basePrompt += `\n\nAlways be helpful, encouraging, and focused on promoting learning. When explaining concepts, use examples and analogies to make them clear. If you're unsure about something, say so rather than guessing.`;

    return basePrompt;
  }

  private buildConversationHistory(messages: LunaMessage[]): Array<{ role: 'user' | 'assistant'; content: string }> {
    // Get last 10 messages to maintain context without overwhelming the model
    const recentMessages = messages.slice(-10);
    
    return recentMessages
      .filter(msg => msg.role !== 'system')
      .map(msg => ({
        role: msg.role as 'user' | 'assistant',
        content: msg.content
      }));
  }

  private async updateConversationAfterMessage(conversationId: string, lastMessage: string): Promise<void> {
    // Generate a title if this is the first AI response
    const messages = await this.getMessages(conversationId);
    const conversation = await this.getConversation(conversationId);
    
    if (!conversation) return;

    const updates: Partial<LunaConversation> = {
      message_count: messages.length,
    };

    // Auto-generate title for new conversations
    if (conversation.title === 'New Conversation' && messages.length >= 2) {
      const firstUserMessage = messages.find(m => m.role === 'user')?.content || '';
      updates.title = this.generateConversationTitle(firstUserMessage);
    }

    await this.updateConversation(conversationId, updates);
  }

  private generateConversationTitle(firstMessage: string): string {
    // Simple title generation based on first message
    const title = firstMessage.length > 50 
      ? firstMessage.substring(0, 47) + '...'
      : firstMessage;
    
    return title || 'Study Session';
  }

  private generateActionButtons(aiContent: string, studyContext?: StudyContext): Array<any> {
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

  private extractCitations(studyContext?: StudyContext): Array<{ id: string; title: string; url?: string }> {
    const citations: Array<{ id: string; title: string; url?: string }> = [];

    if (studyContext?.selectedContent) {
      studyContext.selectedContent.forEach((content, index) => {
        citations.push({
          id: content.id,
          title: content.title,
          url: content.type === 'lesson' ? `/learn/lesson/${content.id}` : undefined
        });
      });
    }

    return citations;
  }

  // Utility methods for study space integration
  async searchStudyContent(query: string, baseClassId?: string): Promise<Array<any>> {
    if (!baseClassId) return [];

    try {
      // Search lesson sections and study content
      const { data, error } = await this.supabase
        .from('lesson_sections')
        .select(`
          id,
          title,
          content,
          section_type,
          lessons!inner(
            id,
            title,
            class_instances!inner(
              base_class_id
            )
          )
        `)
        .ilike('title', `%${query}%`)
        .eq('lessons.class_instances.base_class_id', baseClassId)
        .limit(10);

      if (error) throw error;
      return data || [];
    } catch (error) {
      console.error('Error searching study content:', error);
      return [];
    }
  }

  async getStudyContextForUser(userId: string): Promise<StudyContext | null> {
    try {
      // Get user's current study session or recent activity
      const { data: sessions, error } = await this.supabase
        .from('study_sessions')
        .select(`
          *,
          study_notes(id, title, content),
          base_classes(id, title)
        `)
        .eq('user_id', userId)
        .order('created_at', { ascending: false })
        .limit(1);

      if (error || !sessions || sessions.length === 0) return null;

      const session = sessions[0];
      return {
        selectedCourse: session.base_classes ? {
          id: session.base_classes.id,
          title: session.base_classes.title,
          type: 'course' as const
        } : undefined,
        currentNotes: session.study_notes || []
      };
    } catch (error) {
      console.error('Error getting study context:', error);
      return null;
    }
  }
}

export const lunaAIService = new LunaAIService(); 