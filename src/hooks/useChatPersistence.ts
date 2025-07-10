import { useState, useEffect, useCallback } from 'react';
import { ChatMessage, PersonaType } from '@/components/LunaAIChat';

interface StoredChatData {
  messages: ChatMessage[];
  persona: PersonaType;
  timestamp: number;
}

const STORAGE_KEY = 'luna_chat_history';
const MESSAGE_EXPIRY_TIME = 2 * 60 * 60 * 1000; // 2 hours in milliseconds

export function useChatPersistence() {
  const [isLoaded, setIsLoaded] = useState(false);

  // Load chat history from localStorage
  const loadChatHistory = useCallback((): { messages: ChatMessage[]; persona?: PersonaType } => {
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      if (!stored) {
        return { messages: [] };
      }

      const data: StoredChatData = JSON.parse(stored);
      const now = Date.now();

      // Check if any messages are older than 2 hours
      const validMessages = data.messages.filter(message => {
        const messageTime = new Date(message.timestamp).getTime();
        return (now - messageTime) < MESSAGE_EXPIRY_TIME;
      });

      // If no valid messages remain, clear storage
      if (validMessages.length === 0) {
        localStorage.removeItem(STORAGE_KEY);
        return { messages: [] };
      }

      // Convert timestamp strings back to Date objects
      const messagesWithDates = validMessages.map(msg => ({
        ...msg,
        timestamp: new Date(msg.timestamp)
      }));

      return {
        messages: messagesWithDates,
        persona: data.persona
      };
    } catch (error) {
      console.error('Error loading chat history:', error);
      localStorage.removeItem(STORAGE_KEY);
      return { messages: [] };
    }
  }, []);

  // Save chat history to localStorage
  const saveChatHistory = useCallback((messages: ChatMessage[], persona: PersonaType) => {
    try {
      const now = Date.now();
      
      // Filter out messages older than 2 hours before saving
      const validMessages = messages.filter(message => {
        const messageTime = new Date(message.timestamp).getTime();
        return (now - messageTime) < MESSAGE_EXPIRY_TIME;
      });

      if (validMessages.length === 0) {
        localStorage.removeItem(STORAGE_KEY);
        return;
      }

      const dataToStore: StoredChatData = {
        messages: validMessages,
        persona,
        timestamp: now
      };

      localStorage.setItem(STORAGE_KEY, JSON.stringify(dataToStore));
    } catch (error) {
      console.error('Error saving chat history:', error);
    }
  }, []);

  // Clear chat history
  const clearChatHistory = useCallback(() => {
    try {
      localStorage.removeItem(STORAGE_KEY);
    } catch (error) {
      console.error('Error clearing chat history:', error);
    }
  }, []);

  // Clean up expired messages
  const cleanupExpiredMessages = useCallback(() => {
    const { messages, persona } = loadChatHistory();
    if (messages.length > 0 && persona) {
      saveChatHistory(messages, persona);
    }
  }, [loadChatHistory, saveChatHistory]);

  // Set up periodic cleanup and logout listener
  useEffect(() => {
    // Initial load
    setIsLoaded(true);

    // Set up periodic cleanup every 10 minutes
    const cleanupInterval = setInterval(cleanupExpiredMessages, 10 * 60 * 1000);

    // Listen for logout events
    const handleLogout = () => {
      clearChatHistory();
    };

    // Listen for custom logout events
    window.addEventListener('user-logout', handleLogout);

    // Listen for beforeunload to save current state
    const handleBeforeUnload = () => {
      // This will be handled by the component using this hook
    };

    window.addEventListener('beforeunload', handleBeforeUnload);

    // Cleanup on unmount
    return () => {
      clearInterval(cleanupInterval);
      window.removeEventListener('user-logout', handleLogout);
      window.removeEventListener('beforeunload', handleBeforeUnload);
    };
  }, [cleanupExpiredMessages, clearChatHistory]);

  return {
    loadChatHistory,
    saveChatHistory,
    clearChatHistory,
    cleanupExpiredMessages,
    isLoaded
  };
} 