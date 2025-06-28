import { ChatMessage } from '@/components/LunaAIChat';

export interface TitleGenerationResult {
  title: string;
  wasGenerated: boolean;
  fallback: boolean;
  error?: string;
}

/**
 * Generate an AI-powered conversation title based on the messages
 * @param messages Array of chat messages
 * @param conversationId Optional conversation ID for logging
 * @returns Promise<TitleGenerationResult>
 */
export async function generateConversationTitle(
  messages: ChatMessage[], 
  conversationId?: string
): Promise<TitleGenerationResult> {
  try {
    // Only attempt AI generation if we have meaningful messages
    const meaningfulMessages = messages.filter(msg => 
      msg.content && 
      msg.content.trim() && 
      !msg.isLoading &&
      (msg.role === 'user' || msg.role === 'assistant')
    );

    if (meaningfulMessages.length === 0) {
      return {
        title: 'New Conversation',
        wasGenerated: false,
        fallback: true,
        error: 'No meaningful messages found'
      };
    }

    // Call the title generation API
    const response = await fetch('/api/luna/generate-title', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        messages: meaningfulMessages.map(msg => ({
          role: msg.role,
          content: msg.content,
          isLoading: msg.isLoading
        })),
        conversationId
      }),
    });

    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }

    const result = await response.json();
    return result;

  } catch (error) {
    console.error('Error generating conversation title:', error);
    
    // Fallback to simple title generation
    const firstUserMessage = messages.find(msg => msg.role === 'user' && msg.content?.trim());
    const fallbackTitle = firstUserMessage?.content?.split(' ').slice(0, 4).join(' ') + '...' || 'Conversation';
    
    return {
      title: fallbackTitle,
      wasGenerated: false,
      fallback: true,
      error: error instanceof Error ? error.message : 'Unknown error'
    };
  }
}

/**
 * Generate a simple fallback title from the first user message
 * @param messages Array of chat messages
 * @returns Simple title based on first message
 */
export function generateFallbackTitle(messages: ChatMessage[]): string {
  const firstUserMessage = messages.find(msg => msg.role === 'user' && msg.content?.trim());
  if (!firstUserMessage?.content) {
    return 'New Conversation';
  }
  
  const words = firstUserMessage.content.split(' ').slice(0, 4);
  return words.join(' ') + (firstUserMessage.content.split(' ').length > 4 ? '...' : '');
}

/**
 * Determine if a conversation should get an AI-generated title
 * @param messages Array of chat messages
 * @returns boolean indicating if title generation is worthwhile
 */
export function shouldGenerateTitle(messages: ChatMessage[]): boolean {
  const meaningfulMessages = messages.filter(msg => 
    msg.content && 
    msg.content.trim() && 
    !msg.isLoading &&
    (msg.role === 'user' || msg.role === 'assistant')
  );

  // Only generate if we have at least 2 meaningful exchanges (user + assistant response)
  return meaningfulMessages.length >= 2;
}

/**
 * Check if a title should be truncated based on character length
 * @param title The title to check
 * @param maxLength Maximum allowed length (default: 50)
 * @returns boolean indicating if truncation is needed
 */
export function shouldTruncateTitle(title: string, maxLength: number = 50): boolean {
  return title.length > maxLength;
}

/**
 * Truncate a title to a specific length with ellipsis
 * @param title The title to truncate
 * @param maxLength Maximum allowed length (default: 50)
 * @returns Truncated title with ellipsis if needed
 */
export function truncateTitle(title: string, maxLength: number = 50): string {
  if (title.length <= maxLength) {
    return title;
  }
  return title.substring(0, maxLength - 3) + '...';
} 