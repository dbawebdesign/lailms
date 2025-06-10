"use client";

import React, { useState, useEffect, useRef } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Sheet, SheetContent, SheetTrigger } from '@/components/ui/sheet';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { useLunaContext } from '@/hooks/useLunaContext';
import { useRealTimeUpdates } from '@/hooks/useRealTimeUpdates';
import { PersonaType, ChatMessage } from '@/components/LunaAIChat';
import { UserRole } from '@/config/navConfig';
import { createClient } from '@/lib/supabase/client';
import { 
  Menu, 
  Send, 
  Search,
  Plus,
  Bot,
  User,
  History,
  Star,
  Archive,
  Trash2,
  Download,
  MessageSquare,
  Loader2
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { v4 as uuidv4 } from 'uuid';

interface StoredConversation {
  id: string;
  title: string;
  persona: PersonaType;
  messages: ChatMessage[];
  createdAt: string;
  updatedAt: string;
  isPinned: boolean;
  isArchived: boolean;
}

interface SimplifiedEnhancedLunaChatProps {
  userRole: UserRole;
  userId: string;
  isMobile?: boolean;
  className?: string;
}

const LOCAL_STORAGE_KEY = 'luna-enhanced-conversations';

export const SimplifiedEnhancedLunaChat: React.FC<SimplifiedEnhancedLunaChatProps> = ({
  userRole,
  userId,
  isMobile = false,
  className,
}) => {
  // State
  const [conversations, setConversations] = useState<StoredConversation[]>([]);
  const [currentConversation, setCurrentConversation] = useState<StoredConversation | null>(null);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [message, setMessage] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [sidebarOpen, setSidebarOpen] = useState(!isMobile);
  const [currentPersona, setCurrentPersona] = useState<PersonaType>('lunaChat');
  const [searchQuery, setSearchQuery] = useState('');
  
  // Refs
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const messageHistory = useRef<{ role: 'user' | 'assistant'; content: string }[]>([]);
  
  // Hooks
  const { context, isReady } = useLunaContext();
  const { triggerUpdate } = useRealTimeUpdates({
    onUpdate: (event) => {
      console.log('Real-time update received:', event);
    },
    enableAnimations: true,
    onRefreshNeeded: () => {},
  });

  // Auto-scroll to bottom
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  // Load conversations from localStorage
  useEffect(() => {
    const loadConversations = () => {
      try {
        const stored = localStorage.getItem(`${LOCAL_STORAGE_KEY}-${userId}`);
        if (stored) {
          const parsedConversations = JSON.parse(stored) as StoredConversation[];
          setConversations(parsedConversations);
          
          // Load the most recent conversation
          if (parsedConversations.length > 0) {
            const recent = parsedConversations[0];
            setCurrentConversation(recent);
            setMessages(recent.messages);
            setCurrentPersona(recent.persona);
            messageHistory.current = recent.messages.map(msg => ({
              role: msg.role as 'user' | 'assistant',
              content: msg.content
            }));
          }
        }
      } catch (error) {
        console.error('Failed to load conversations:', error);
      }
    };

    if (userId) {
      loadConversations();
    }
  }, [userId]);

  // Save conversations to localStorage
  const saveConversations = (convs: StoredConversation[]) => {
    try {
      localStorage.setItem(`${LOCAL_STORAGE_KEY}-${userId}`, JSON.stringify(convs));
      setConversations(convs);
    } catch (error) {
      console.error('Failed to save conversations:', error);
    }
  };

  // Generate conversation title from first message
  const generateTitle = (firstMessage: string): string => {
    const words = firstMessage.split(' ').slice(0, 5);
    return words.join(' ') + (firstMessage.split(' ').length > 5 ? '...' : '');
  };

  // Create new conversation
  const createNewConversation = (persona: PersonaType = 'lunaChat') => {
    const newConversation: StoredConversation = {
      id: uuidv4(),
      title: 'New Conversation',
      persona,
      messages: [],
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      isPinned: false,
      isArchived: false,
    };

    const updated = [newConversation, ...conversations];
    saveConversations(updated);
    setCurrentConversation(newConversation);
    setMessages([]);
    setCurrentPersona(persona);
    messageHistory.current = [];
    setSidebarOpen(false);
  };

  // Switch conversation
  const switchConversation = (conversation: StoredConversation) => {
    setCurrentConversation(conversation);
    setMessages(conversation.messages);
    setCurrentPersona(conversation.persona);
    messageHistory.current = conversation.messages.map(msg => ({
      role: msg.role as 'user' | 'assistant',
      content: msg.content
    }));
    setSidebarOpen(false);
  };

  // Update current conversation
  const updateCurrentConversation = (updates: Partial<StoredConversation>) => {
    if (!currentConversation) return;

    const updatedConversation = {
      ...currentConversation,
      ...updates,
      updatedAt: new Date().toISOString(),
    };

    const updatedConversations = conversations.map(conv =>
      conv.id === currentConversation.id ? updatedConversation : conv
    );

    saveConversations(updatedConversations);
    setCurrentConversation(updatedConversation);
  };

  // Send message
  const handleSendMessage = async () => {
    if (!message.trim() || isLoading) return;

    const messageToSend = message.trim();
    setMessage('');
    setError(null);
    setIsLoading(true);

    const userMsg: ChatMessage = {
      id: uuidv4(),
      role: 'user',
      content: messageToSend,
      timestamp: new Date(),
      persona: currentPersona,
    };

    const loadingMsg: ChatMessage = {
      id: uuidv4(),
      role: 'assistant',
      content: '',
      timestamp: new Date(),
      isLoading: true,
      persona: currentPersona,
    };

    // Update UI immediately
    const newMessages = [...messages, userMsg, loadingMsg];
    setMessages(newMessages);
    messageHistory.current.push({ role: 'user', content: messageToSend });

    // Create conversation if this is the first message
    let conversationToUpdate = currentConversation;
    if (!currentConversation) {
      const newConv: StoredConversation = {
        id: uuidv4(),
        title: generateTitle(messageToSend),
        persona: currentPersona,
        messages: [userMsg],
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        isPinned: false,
        isArchived: false,
      };
      conversationToUpdate = newConv;
      setCurrentConversation(newConv);
    }

    try {
      // Call Luna API
      const response = await fetch('/api/luna/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          message: messageToSend,
          persona: currentPersona,
          context: isReady ? context : undefined,
          history: messageHistory.current.slice(-10), // Last 10 messages for context
        }),
      });

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const result = await response.json();

      // Create assistant message
      const assistantMsg: ChatMessage = {
        id: uuidv4(),
        role: 'assistant',
        content: result.response || 'Sorry, I encountered an error.',
        timestamp: new Date(),
        persona: currentPersona,
        citations: result.citations,
        actionButtons: result.actionButtons,
      };

      // Update messages
      const finalMessages = [...messages, userMsg, assistantMsg];
      setMessages(finalMessages);
      messageHistory.current.push({ role: 'assistant', content: assistantMsg.content });

      // Update or create conversation
      if (conversationToUpdate) {
        const updatedConversation = {
          ...conversationToUpdate,
          messages: finalMessages,
          title: conversationToUpdate.title === 'New Conversation' ? generateTitle(messageToSend) : conversationToUpdate.title,
          updatedAt: new Date().toISOString(),
        };

        const updatedConversations = currentConversation
          ? conversations.map(conv => conv.id === conversationToUpdate!.id ? updatedConversation : conv)
          : [updatedConversation, ...conversations];

        saveConversations(updatedConversations);
        setCurrentConversation(updatedConversation);
      }

      // Trigger real-time updates
      if (result.realTimeUpdates) {
        result.realTimeUpdates.forEach(triggerUpdate);
      }

    } catch (error) {
      console.error('Failed to send message:', error);
      setError('Failed to send message. Please try again.');
      
      // Remove loading message on error
      setMessages(prev => prev.slice(0, -1));
      messageHistory.current.pop();
    } finally {
      setIsLoading(false);
    }
  };

  // Filter conversations based on search
  const filteredConversations = conversations.filter(conv => {
    if (!searchQuery) return true;
    return conv.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
           conv.messages.some(msg => msg.content.toLowerCase().includes(searchQuery.toLowerCase()));
  });

  // Sidebar content
  const sidebarContent = (
    <div className="flex flex-col h-full">
      <div className="p-4 border-b">
        <div className="flex items-center gap-2 mb-3">
          <Bot size={20} className="text-primary" />
          <h2 className="font-semibold">Luna Conversations</h2>
        </div>
        
        <Button 
          onClick={() => createNewConversation()} 
          className="w-full mb-3"
          size="sm"
        >
          <Plus size={16} className="mr-2" />
          New Chat
        </Button>

        <div className="relative">
          <Search size={16} className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder="Search conversations..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-9"
          />
        </div>
      </div>

      <ScrollArea className="flex-1">
        <div className="p-2 space-y-2">
          {filteredConversations.map((conversation) => (
            <Card
              key={conversation.id}
              className={cn(
                "cursor-pointer transition-colors hover:bg-muted/50",
                currentConversation?.id === conversation.id && "bg-muted border-primary"
              )}
              onClick={() => switchConversation(conversation)}
            >
              <CardContent className="p-3">
                <div className="flex items-start justify-between gap-2">
                  <div className="flex-1 min-w-0">
                    <h3 className="font-medium text-sm truncate">{conversation.title}</h3>
                    <p className="text-xs text-muted-foreground mt-1">
                      {conversation.messages.length} messages
                    </p>
                  </div>
                  <div className="flex flex-col items-end gap-1">
                    {conversation.isPinned && <Star size={12} className="text-yellow-500" />}
                    <Badge variant="outline" className="text-xs">
                      {conversation.persona}
                    </Badge>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
          
          {filteredConversations.length === 0 && (
            <div className="text-center text-muted-foreground py-8">
              {searchQuery ? 'No conversations found' : 'No conversations yet'}
            </div>
          )}
        </div>
      </ScrollArea>
    </div>
  );

  return (
    <div className={cn("flex h-full", className)}>
      {/* Desktop Sidebar */}
      {!isMobile && sidebarOpen && (
        <div className="w-80 border-r border-border">
          {sidebarContent}
        </div>
      )}

      {/* Mobile Sidebar Sheet */}
      {isMobile && (
        <Sheet open={sidebarOpen} onOpenChange={setSidebarOpen}>
          <SheetContent side="left" className="p-0 w-80">
            {sidebarContent}
          </SheetContent>
        </Sheet>
      )}

      {/* Main Chat Area */}
      <div className="flex-1 flex flex-col min-w-0">
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b">
          <div className="flex items-center gap-3">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setSidebarOpen(!sidebarOpen)}
            >
              <Menu size={16} />
            </Button>
            
            <div className="flex items-center gap-2">
              <Bot size={20} className="text-primary" />
              <div>
                <h1 className="font-semibold">
                  {currentConversation?.title || 'Luna Assistant'}
                </h1>
                <p className="text-xs text-muted-foreground">
                  {currentPersona} • {messages.length} messages
                </p>
              </div>
            </div>
          </div>
        </div>

        {/* Messages */}
        <ScrollArea className="flex-1 p-4">
          <div className="space-y-4 max-w-4xl mx-auto">
            {messages.length === 0 && (
              <div className="text-center text-muted-foreground py-8">
                <Bot size={48} className="mx-auto mb-4 opacity-50" />
                <p>Start a conversation with Luna!</p>
              </div>
            )}
            
            {messages.map((msg) => (
              <div
                key={msg.id}
                className={cn(
                  "flex gap-3 animate-in slide-in-from-bottom-2",
                  msg.role === 'user' ? 'justify-end' : 'justify-start'
                )}
              >
                {msg.role === 'assistant' && (
                  <div className="w-8 h-8 rounded-full bg-primary flex items-center justify-center flex-shrink-0">
                    <Bot size={16} className="text-primary-foreground" />
                  </div>
                )}
                
                <div
                  className={cn(
                    "max-w-[80%] rounded-lg px-4 py-2",
                    msg.role === 'user'
                      ? 'bg-primary text-primary-foreground'
                      : 'bg-muted'
                  )}
                >
                  {msg.isLoading ? (
                    <div className="flex items-center gap-2">
                      <Loader2 size={16} className="animate-spin" />
                      <span>Thinking...</span>
                    </div>
                  ) : (
                    <div className="whitespace-pre-wrap">{msg.content}</div>
                  )}
                </div>
                
                {msg.role === 'user' && (
                  <div className="w-8 h-8 rounded-full bg-secondary flex items-center justify-center flex-shrink-0">
                    <User size={16} className="text-secondary-foreground" />
                  </div>
                )}
              </div>
            ))}
            <div ref={messagesEndRef} />
          </div>
        </ScrollArea>

        {/* Input */}
        <div className="p-4 border-t">
          {error && (
            <div className="mb-3 p-2 bg-destructive/10 text-destructive text-sm rounded">
              {error}
            </div>
          )}
          
          <div className="flex gap-2">
            <Input
              ref={inputRef}
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && !e.shiftKey) {
                  e.preventDefault();
                  handleSendMessage();
                }
              }}
              placeholder="Type your message..."
              disabled={isLoading}
              className="flex-1"
            />
            <Button 
              onClick={handleSendMessage} 
              disabled={!message.trim() || isLoading}
              size="icon"
            >
              <Send size={16} />
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}; 