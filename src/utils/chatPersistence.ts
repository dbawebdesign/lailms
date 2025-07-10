/**
 * Utility functions for managing Luna chat persistence
 */

/**
 * Triggers a logout event that will clear chat history
 * Call this before any logout operation
 */
export function triggerChatLogout(): void {
  if (typeof window !== 'undefined') {
    window.dispatchEvent(new CustomEvent('user-logout'));
  }
}

/**
 * Manually clear chat history from localStorage
 * Useful for cleanup operations or manual clearing
 */
export function clearChatHistory(): void {
  if (typeof window !== 'undefined') {
    try {
      localStorage.removeItem('luna_chat_history');
    } catch (error) {
      console.error('Error clearing chat history:', error);
    }
  }
}

/**
 * Check if chat history exists in localStorage
 */
export function hasChatHistory(): boolean {
  if (typeof window === 'undefined') return false;
  
  try {
    const stored = localStorage.getItem('luna_chat_history');
    return stored !== null;
  } catch (error) {
    console.error('Error checking chat history:', error);
    return false;
  }
}

/**
 * Get the timestamp of the last chat message
 * Returns null if no chat history exists
 */
export function getLastChatTimestamp(): Date | null {
  if (typeof window === 'undefined') return null;
  
  try {
    const stored = localStorage.getItem('luna_chat_history');
    if (!stored) return null;
    
    const data = JSON.parse(stored);
    if (!data.messages || data.messages.length === 0) return null;
    
    // Get the most recent message timestamp
    const lastMessage = data.messages[data.messages.length - 1];
    return new Date(lastMessage.timestamp);
  } catch (error) {
    console.error('Error getting last chat timestamp:', error);
    return null;
  }
}

/**
 * Check if chat history has expired (older than 2 hours)
 */
export function isChatHistoryExpired(): boolean {
  const lastTimestamp = getLastChatTimestamp();
  if (!lastTimestamp) return true;
  
  const now = new Date();
  const twoHoursAgo = new Date(now.getTime() - (2 * 60 * 60 * 1000));
  
  return lastTimestamp < twoHoursAgo;
} 