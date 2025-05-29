"use client";

import { useState, useEffect, useCallback, useContext, useRef } from 'react';
import { v4 as uuidv4 } from 'uuid';
import { LunaContext, SerializedUIContext, UIComponentConfig, UIComponentData } from '@/context/LunaContextProvider';
import { ChatMessage } from '@/components/luna/ChatThread';
import { PersonaType } from '@/components/luna/PersonaSelector';

interface LunaChatContextValue {
  // UI Context methods
  registerComponent: (data: UIComponentConfig) => string;
  updateComponent: (id: string, updates: Partial<UIComponentData>) => void;
  unregisterComponent: (id: string) => void;
  recordUserAction: (componentId: string, actionType: string) => void;
  setFocusedComponent: (componentId: string | null) => void;
  
  // Chat-specific methods and state
  messages: ChatMessage[];
  isLoading: boolean;
  sendMessage: (message: string, persona: PersonaType, buttonData?: any) => Promise<void>;
  context: SerializedUIContext | null;
  isReady: boolean;
  
  // Helper methods
  getComponentContent: (type: string, role: string) => Record<string, any> | null;
  getComponentsByType: (type: string) => UIComponentData[];
  getVisibleComponents: () => UIComponentData[];
  getLastUserAction: () => { componentId: string; actionType: string; timestamp: number } | null;
}

export function useLunaContext(): LunaChatContextValue {
  // Get Luna Context - this is from the LunaContextProvider
  const lunaContext = useContext(LunaContext);
  
  if (!lunaContext) {
    throw new Error('useLunaContext must be used within a LunaContextProvider');
  }
  
  // Chat state
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [context, setContext] = useState<SerializedUIContext | null>(null);
  const [isReady, setIsReady] = useState(false);
  
  // Message history for API calls
  const messageHistory = useRef<{ role: 'user' | 'assistant'; content: string }[]>([]);
  
  // Listen for context updates from broadcast channel
  useEffect(() => {
    if (typeof window === 'undefined') return;
    
    // Try to get context from sessionStorage first
    const storedContext = sessionStorage.getItem('luna-latest-ui-context');
    if (storedContext) {
      try {
        setContext(JSON.parse(storedContext));
        setIsReady(true);
      } catch (error) {
        console.error('Error parsing stored context:', error);
      }
    }
    
    // Listen for context updates
    const channel = new BroadcastChannel('luna-ui-context');
    
    channel.onmessage = (event) => {
      setContext(event.data);
      setIsReady(true);
    };
    
    return () => {
      channel.close();
    };
  }, []);
  
  // For debugging
  useEffect(() => {
    if (lunaContext) {
      // This allows us to see the current context from the provider
      const currentContext = lunaContext.debug.getCurrentContext();
      if (currentContext && !context) {
        setContext(currentContext);
        setIsReady(true);
      }
    }
  }, [lunaContext, context]);
  
  // Send message to Luna API
  const sendMessage = useCallback(async (message: string, persona: PersonaType, buttonData?: any) => {
    if (!message.trim()) return;
    
    // Use our current context if available, or the one from the provider
    const currentContext = context || (lunaContext ? lunaContext.debug.getCurrentContext() : null);
    if (!currentContext) {
      console.error('No context available for Luna');
      return;
    }
    
    // Parse message if it's a button response
    let actualMessage = message;
    let parsedButtonData = buttonData;
    
    try {
      const parsed = JSON.parse(message);
      if (parsed.text && parsed.buttonData) {
        actualMessage = parsed.text;
        parsedButtonData = parsed.buttonData;
      }
    } catch {
      // Not a JSON message, use as-is
    }
    
    // Create a new user message object
    const userMessage: ChatMessage = {
      id: uuidv4(),
      role: 'user',
      content: actualMessage,
      timestamp: new Date(),
    };
    
    // Update messages state with the new user message
    setMessages(prev => [...prev, userMessage]);
    
    // Add temporary loading message
    const tempBotMessageId = uuidv4();
    setMessages(prev => [
      ...prev,
      {
        id: tempBotMessageId,
        role: 'assistant',
        content: '...',
        timestamp: new Date(),
        isLoading: true,
        persona
      }
    ]);
    
    // Set loading state
    setIsLoading(true);
    
    // Add message to history for API
    messageHistory.current.push({ role: 'user', content: actualMessage });
    
    try {
      // Prepare request body
      const requestBody: any = {
        message: actualMessage,
        context: currentContext,
        messages: messageHistory.current,
        persona
      };
      
      // Include button data if available
      if (parsedButtonData) {
        requestBody.buttonData = parsedButtonData;
      }
      
      // Send request to API
      console.log('[Luna Frontend] Sending API request:', {
        url: '/api/luna/chat',
        method: 'POST',
        hasContext: !!currentContext,
        messageLength: actualMessage.length,
        hasButtonData: !!parsedButtonData,
        buttonData: parsedButtonData
      });

      const response = await fetch('/api/luna/chat', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(requestBody),
      });
      
      console.log('[Luna Frontend] API response received:', {
        ok: response.ok,
        status: response.status,
        statusText: response.statusText,
        headers: Object.fromEntries(response.headers.entries())
      });

      if (!response.ok) {
        throw new Error(`API responded with status ${response.status}`);
      }
      
      const data = await response.json();
      
      // Add debugging for action buttons
      console.log('[Luna Frontend] API response data:', {
        hasResponse: !!data.response,
        responseLength: data.response?.length || 0,
        hasCitations: !!data.citations,
        citationsLength: data.citations?.length || 0,
        hasActionButtons: !!data.actionButtons,
        actionButtonsLength: data.actionButtons?.length || 0,
        actionButtons: data.actionButtons,
        fullResponseKeys: Object.keys(data),
        fullData: data
      });
      
      // Add assistant message to history
      messageHistory.current.push({ role: 'assistant', content: data.response });
      
      // Remove temporary loading message and add the real response
      setMessages(prev => {
        // Filter out the loading message
        const filteredMessages = prev.filter(msg => msg.id !== tempBotMessageId);
        
        const newMessage = {
          id: uuidv4(),
          role: 'assistant' as const,
          content: data.response,
          timestamp: new Date(),
          persona,
          citations: data.citations || [],
          actionButtons: data.actionButtons || []
        };
        
        console.log('[Luna Frontend] Creating new message with actionButtons:', {
          messageId: newMessage.id,
          hasActionButtons: !!newMessage.actionButtons,
          actionButtonsLength: newMessage.actionButtons?.length || 0,
          actionButtons: newMessage.actionButtons
        });
        
        // Add the real response with action buttons if available
        return [
          ...filteredMessages,
          newMessage
        ];
      });
      
    } catch (error) {
      console.error('Error sending message:', error);
      
      // Remove temporary loading message and add error message
      setMessages(prev => {
        // Filter out the loading message
        const filteredMessages = prev.filter(msg => msg.id !== tempBotMessageId);
        
        // Add an error message
        return [
          ...filteredMessages,
          {
            id: uuidv4(),
            role: 'assistant',
            content: 'Sorry, I encountered an error processing your request. Please try again.',
            timestamp: new Date(),
            persona
          }
        ];
      });
      
    } finally {
      setIsLoading(false);
    }
  }, [context, lunaContext]);
  
  // Helper methods for accessing context
  const getComponentContent = useCallback((type: string, role: string): Record<string, any> | null => {
    if (context?.components) {
      const component = context.components.find(c => c.type === type && c.role === role);
      return component?.content || null;
    }
    return null;
  }, [context]);
  
  const getComponentsByType = useCallback((type: string): UIComponentData[] => {
    if (context?.components) {
      return context.components.filter(c => c.type === type);
    }
    return [];
  }, [context]);
  
  const getVisibleComponents = useCallback((): UIComponentData[] => {
    if (context?.components) {
      return context.components.filter(c => c.isVisible !== false);
    }
    return [];
  }, [context]);
  
  const getLastUserAction = useCallback(() => {
    return context?.lastUserAction || null;
  }, [context]);
  
  return {
    // Pass through methods from LunaContextProvider
    registerComponent: lunaContext.registerComponent,
    updateComponent: lunaContext.updateComponent,
    unregisterComponent: lunaContext.unregisterComponent,
    recordUserAction: lunaContext.recordUserAction,
    setFocusedComponent: lunaContext.setFocusedComponent,
    
    // Chat-specific state and methods
    messages,
    isLoading,
    sendMessage,
    context,
    isReady,
    
    // Helper methods
    getComponentContent,
    getComponentsByType,
    getVisibleComponents,
    getLastUserAction,
  };
} 