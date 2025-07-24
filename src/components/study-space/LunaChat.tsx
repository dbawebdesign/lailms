'use client';

import React, { useState, useEffect, useRef, forwardRef, useImperativeHandle } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Input } from '@/components/ui/input';
import { 
  DropdownMenu, 
  DropdownMenuContent, 
  DropdownMenuItem, 
  DropdownMenuTrigger,
  DropdownMenuSeparator
} from '@/components/ui/dropdown-menu';
import { 
  Sparkles, 
  MessageCircle, 
  Copy,
  Check,
  RefreshCw,
  Brain,
  History,
  ChevronDown,
  Trash2,
  NotebookPen,
  Plus,
  ChevronLeft,
  Clock,
  Send,
  Loader2,
  Mic
} from 'lucide-react';
import { createClient } from '@/lib/supabase/client';
import ReactMarkdown from 'react-markdown';
import { cn } from '@/lib/utils';

// Luna Avatar component using the web app manifest icon
const LunaAvatar = ({ className }: { className?: string }) => (
  <div className={cn("relative flex h-8 w-8 shrink-0 overflow-hidden rounded-full", className)}>
    <img 
      src="/web-app-manifest-512x512.png" 
      alt="Luna AI" 
      className="w-full h-full rounded-full object-cover"
    />
  </div>
);

const UserAvatar = ({ className }: { className?: string }) => (
  <div className={cn("relative flex h-8 w-8 shrink-0 overflow-hidden rounded-full bg-blue-500", className)}>
    <div className="flex h-full w-full items-center justify-center text-white font-medium text-sm">
      You
    </div>
  </div>
);

interface ChatMessage {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  response_format?: 'text' | 'mindmap' | 'structured' | 'summary';
  highlighted_text?: string;
  sources?: any[];
  created_at: string;
  quickActions?: Array<{
    id: string;
    label: string;
    icon: string;
  }>;
}

interface Conversation {
  id: string;
  title: string;
  created_at: string;
  updated_at: string;
}

interface LunaChatProps {
  selectedSources?: any[];
  highlightedText?: string | null;
  onHighlightedTextUsed?: () => void;
  onAddToNotes?: (content: string, title?: string) => void;
  onChatViewChange?: (isOpen: boolean) => void;
  chatMessage?: string;
  setChatMessage?: (message: string) => void;
  isGenerating?: boolean;
  className?: string;
}

export interface LunaChatRef {
  sendMessage: (message: string, action?: string) => Promise<void>;
}

interface StudyChatHistory {
  id: string;
  title: string;
  messages: ChatMessage[];
  lastUpdated: string;
}

type ChatView = 'list' | 'chat';

export const LunaChat = forwardRef<LunaChatRef, LunaChatProps>(({ 
  selectedSources = [], 
  highlightedText, 
  onHighlightedTextUsed,
  onAddToNotes,
  onChatViewChange,
  chatMessage = '',
  setChatMessage,
  isGenerating = false,
  className 
}, ref) => {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [copiedMessageId, setCopiedMessageId] = useState<string | null>(null);
  const [chatHistory, setChatHistory] = useState<StudyChatHistory[]>([]);
  const [currentChatId, setCurrentChatId] = useState<string | null>(null);
  const [chatView, setChatView] = useState<ChatView>('list'); // New state for view mode
  const [localChatMessage, setLocalChatMessage] = useState('');

  
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const conversationIdRef = useRef<string | null>(null);
  const isInitialLoad = useRef<boolean>(true);
  const inputRef = useRef<HTMLInputElement>(null);

  // Use local state if no external state provided
  const currentMessage = chatMessage || localChatMessage;
  const setCurrentMessage = setChatMessage || setLocalChatMessage;

  const handleSendMessage = async () => {
    if (!currentMessage.trim()) return;
    
    // Use the existing sendMessage function
    await sendMessage(currentMessage);
    
    // Clear the input
    setCurrentMessage('');
  };

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  // Load chat history from localStorage on component mount
  useEffect(() => {
    const savedHistory = localStorage.getItem('study-tools-luna-history');
    if (savedHistory) {
      try {
        const parsedHistory = JSON.parse(savedHistory);
        setChatHistory(parsedHistory);
        
        // Don't auto-load the most recent chat anymore - stay in list view
        // if (parsedHistory.length > 0) {
        //   const mostRecent = parsedHistory[0];
        //   setCurrentChatId(mostRecent.id);
        //   setMessages(mostRecent.messages);
        //   conversationIdRef.current = mostRecent.id;
        // }
      } catch (error) {
        console.error('Error loading saved chat history:', error);
      }
    }
    
    // Mark initial load as complete
    setTimeout(() => {
      isInitialLoad.current = false;
    }, 100);
  }, []);

  // Save current chat to history whenever messages change
  useEffect(() => {
    // Skip saving during initial load to prevent infinite loops
    if (isInitialLoad.current || messages.length === 0 || !currentChatId) {
      return;
    }

    setChatHistory(prevHistory => {
      const updatedHistory = prevHistory.map(chat => 
        chat.id === currentChatId 
          ? { ...chat, messages, lastUpdated: new Date().toISOString() }
          : chat
      );
      
      // If current chat doesn't exist in history, add it
      if (!prevHistory.find(chat => chat.id === currentChatId)) {
        const newChat: StudyChatHistory = {
          id: currentChatId,
          title: messages[0]?.content.slice(0, 50) + (messages[0]?.content.length > 50 ? '...' : '') || 'New Chat',
          messages,
          lastUpdated: new Date().toISOString()
        };
        updatedHistory.unshift(newChat);
      }
      
      // Sort by last updated and keep only last 10 chats
      const sortedHistory = updatedHistory
        .sort((a, b) => new Date(b.lastUpdated).getTime() - new Date(a.lastUpdated).getTime())
        .slice(0, 10);
      
      localStorage.setItem('study-tools-luna-history', JSON.stringify(sortedHistory));
      return sortedHistory;
    });
  }, [messages, currentChatId]);

  const sendMessage = async (input: string, action?: string) => {
    if (!input.trim()) return;

    // Create new chat ID if this is the first message
    if (!currentChatId) {
      const newChatId = Date.now().toString();
      setCurrentChatId(newChatId);
      conversationIdRef.current = newChatId;
    }

    const userMessage: ChatMessage = {
      id: Date.now().toString(),
      role: 'user',
      content: input,
      created_at: new Date().toISOString()
    };

    // Add user message to the chat
    setMessages(prev => [...prev, userMessage]);
    setIsLoading(true);

    // Clear highlighted text if it was used
    if (highlightedText && onHighlightedTextUsed) {
      onHighlightedTextUsed();
    }

    try {
      const response = await fetch('/api/luna/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          message: input,
          conversationId: conversationIdRef.current,
          responseFormat: 'text',
          highlightedText,
          sources: selectedSources,
          quickAction: action,
          context: 'study-tools-isolated' // Use a different context to avoid main app interference
        }),
      });

      if (!response.ok) {
        throw new Error('Failed to send message');
      }

      const data = await response.json();
      
      // Store conversation ID for future messages
      if (data.conversationId) {
        conversationIdRef.current = data.conversationId;
      }

      // Add assistant response to the chat
      const assistantMessage: ChatMessage = {
        id: (Date.now() + 1).toString(),
        role: 'assistant',
        content: data.response || data.message,
        response_format: data.responseFormat,
        created_at: new Date().toISOString(),
        quickActions: data.quickActions || []
      };

      setMessages(prev => [...prev, assistantMessage]);

    } catch (error) {
      console.error('Error sending message:', error);
      
      // Add error message
      const errorMessage: ChatMessage = {
        id: (Date.now() + 1).toString(),
        role: 'assistant',
        content: 'Sorry, I encountered an error. Please try again.',
        created_at: new Date().toISOString()
      };

      setMessages(prev => [...prev, errorMessage]);
    } finally {
      setIsLoading(false);
    }
  };

  const copyMessage = async (messageId: string, content: string) => {
    try {
      await navigator.clipboard.writeText(content);
      setCopiedMessageId(messageId);
      setTimeout(() => setCopiedMessageId(null), 2000);
    } catch (error) {
      console.error('Failed to copy message:', error);
    }
  };

  const addToNotes = (content: string, messageId: string) => {
    if (onAddToNotes) {
      // Generate a title from the first line or first 50 characters
      const title = content.split('\n')[0].slice(0, 50).replace(/[#*]/g, '').trim();
      const noteTitle = title ? `Luna: ${title}` : "Luna Response";
      onAddToNotes(content, noteTitle);
      
      // Optional: Add visual feedback that note was added
      // e.g., setAddedToNotesId(messageId); setTimeout(() => setAddedToNotesId(null), 2000);
    }
  };

  const startNewConversation = () => {
    // Clear current chat
    setMessages([]);
    setCurrentChatId(null);
    conversationIdRef.current = null;
    setChatView('chat'); // Switch to chat view for new conversation
    onChatViewChange?.(true); // Notify parent that chat interface is open
    
    // Clear highlighted text if it was used
    if (highlightedText && onHighlightedTextUsed) {
      onHighlightedTextUsed();
    }

    // Focus input after a brief delay
    setTimeout(() => {
      if (inputRef.current) {
        inputRef.current.focus();
      }
    }, 100);
  };

  const loadChat = (chatId: string) => {
    const chat = chatHistory.find(c => c.id === chatId);
    if (chat) {
      // Temporarily disable saving to prevent loops
      isInitialLoad.current = true;
      
      setCurrentChatId(chatId);
      setMessages(chat.messages);
      conversationIdRef.current = chatId;
      setChatView('chat'); // Switch to chat view when loading a conversation
    onChatViewChange?.(true); // Notify parent that chat interface is open
      
      // Re-enable saving after a brief delay
      setTimeout(() => {
        isInitialLoad.current = false;
      }, 100);
    }
  };

  const deleteChat = (chatId: string) => {
    const updatedHistory = chatHistory.filter(chat => chat.id !== chatId);
    setChatHistory(updatedHistory);
    localStorage.setItem('study-tools-luna-history', JSON.stringify(updatedHistory));
    
    // If we're deleting the current chat, go back to list view
    if (chatId === currentChatId) {
      setMessages([]);
      setCurrentChatId(null);
      conversationIdRef.current = null;
      setChatView('list');
    }
  };

  const formatChatDate = (dateString: string) => {
    const date = new Date(dateString);
    const now = new Date();
    const diffInHours = (now.getTime() - date.getTime()) / (1000 * 60 * 60);
    
    if (diffInHours < 1) return 'Just now';
    if (diffInHours < 24) return `${Math.floor(diffInHours)}h ago`;
    if (diffInHours < 48) return 'Yesterday';
    return date.toLocaleDateString();
  };

  // Expose sendMessage function via ref
  useImperativeHandle(ref, () => ({
    sendMessage
  }), [sendMessage]);

  const formatMessageContent = (content: string, format?: string) => {
    const markdownComponents = {
      h1: ({ children }: any) => <h1 className="text-xl font-bold mb-3 text-foreground">{children}</h1>,
      h2: ({ children }: any) => <h2 className="text-lg font-semibold mb-2 text-foreground">{children}</h2>,
      h3: ({ children }: any) => <h3 className="text-base font-medium mb-2 text-foreground">{children}</h3>,
      h4: ({ children }: any) => <h4 className="text-sm font-medium mb-1 text-foreground">{children}</h4>,
      p: ({ children }: any) => <p className="mb-3 leading-relaxed">{children}</p>,
      ul: ({ children }: any) => <ul className="mb-3 space-y-1 list-disc list-inside">{children}</ul>,
      ol: ({ children }: any) => <ol className="mb-3 space-y-1 list-decimal list-inside">{children}</ol>,
      li: ({ children }: any) => <li className="ml-2 leading-relaxed">{children}</li>,
      strong: ({ children }: any) => <strong className="font-semibold text-foreground">{children}</strong>,
      em: ({ children }: any) => <em className="italic text-foreground">{children}</em>,
      code: ({ children }: any) => <code className="bg-muted px-1.5 py-0.5 rounded text-sm font-mono">{children}</code>,
      pre: ({ children }: any) => <pre className="bg-muted p-3 rounded-lg overflow-x-auto text-sm font-mono mb-3">{children}</pre>,
      blockquote: ({ children }: any) => <blockquote className="border-l-4 border-border pl-4 italic my-3 text-muted-foreground">{children}</blockquote>,
      table: ({ children }: any) => <table className="w-full border-collapse border border-border mb-3">{children}</table>,
      thead: ({ children }: any) => <thead className="bg-muted">{children}</thead>,
      tbody: ({ children }: any) => <tbody>{children}</tbody>,
      tr: ({ children }: any) => <tr className="border-b border-border">{children}</tr>,
      th: ({ children }: any) => <th className="border border-border px-3 py-2 text-left font-semibold">{children}</th>,
      td: ({ children }: any) => <td className="border border-border px-3 py-2">{children}</td>,
    };

    if (format === 'mindmap') {
      return (
        <div className="bg-purple-500/10 rounded-xl p-5 border border-purple-500/20 shadow-sm">
          <ReactMarkdown 
            className="prose prose-sm prose-purple dark:prose-invert max-w-none"
            components={markdownComponents}
          >
            {content}
          </ReactMarkdown>
        </div>
      );
    }

    if (format === 'structured') {
      return (
        <div className="bg-blue-500/10 rounded-xl p-5 border border-blue-500/20 shadow-sm">
          <ReactMarkdown 
            className="prose prose-sm prose-blue dark:prose-invert max-w-none"
            components={markdownComponents}
          >
            {content}
          </ReactMarkdown>
        </div>
      );
    }

    if (format === 'summary') {
      return (
        <div className="bg-emerald-500/10 rounded-xl p-5 border border-emerald-500/20 shadow-sm">
          <ReactMarkdown 
            className="prose prose-sm prose-emerald dark:prose-invert max-w-none"
            components={markdownComponents}
          >
            {content}
          </ReactMarkdown>
        </div>
      );
    }

    return (
      <div className="prose prose-sm dark:prose-invert max-w-none">
        <ReactMarkdown components={markdownComponents}>
          {content}
        </ReactMarkdown>
      </div>
    );
  };



  // Render conversations list similar to notes interface
  const renderConversationsList = () => {
    return (
      <div className="h-full flex flex-col">
        {/* Header */}
        <div className="p-4 border-b border-border bg-surface/80 backdrop-blur-sm">
          <div className="flex items-center gap-2 mb-4">
            <LunaAvatar />
            <div>
              <h3 className="font-semibold text-foreground text-sm">Luna</h3>
              <p className="text-xs text-muted-foreground">AI Study Partner</p>
            </div>
          </div>
        </div>

        {/* Content */}
        <div className="flex-1 p-4 space-y-4">
          {/* Start New Conversation Button */}
          <Button 
            variant="outline" 
            size="sm" 
            className="w-full justify-start text-muted-foreground"
            onClick={startNewConversation}
          >
            <Plus className="h-4 w-4 mr-2" />
            Start New Conversation
          </Button>

          {/* Conversations List */}
          <div className="grid grid-cols-1 gap-3">
            {chatHistory.length === 0 ? (
              <div className="text-center py-8">
                <div className="w-16 h-16 mx-auto mb-4 rounded-full overflow-hidden">
                  <img 
                    src="/web-app-manifest-512x512.png" 
                    alt="Luna AI" 
                    className="w-full h-full rounded-full object-cover"
                  />
                </div>
                <h4 className="text-lg font-semibold text-foreground mb-2">
                  No conversations yet
                </h4>
                <p className="text-muted-foreground max-w-md mx-auto">
                  Start your first conversation with Luna to get help with your studies.
                </p>
              </div>
            ) : (
              chatHistory.map((chat) => (
                <Card 
                  key={chat.id} 
                  className="p-4 bg-card hover:bg-card/80 hover:shadow-md transition-all cursor-pointer group border border-border"
                  onClick={() => loadChat(chat.id)}
                >
                  <div className="flex items-center justify-between">
                    <div className="flex-1 min-w-0">
                      <h5 className="font-medium text-sm text-foreground group-hover:text-primary transition-colors truncate">
                        {chat.title}
                      </h5>
                      <div className="flex items-center gap-2 mt-1">
                        <div className="flex items-center gap-1 text-xs text-muted-foreground">
                          <Clock className="h-3 w-3" />
                          {formatChatDate(chat.lastUpdated)}
                        </div>
                        <div className="flex items-center gap-1 text-xs text-muted-foreground">
                          <MessageCircle className="h-3 w-3" />
                          {chat.messages.length} messages
                        </div>
                      </div>
                    </div>
                    <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={(e) => {
                          e.stopPropagation();
                          deleteChat(chat.id);
                        }}
                        className="h-6 w-6 p-0 text-red-400 hover:text-red-600"
                      >
                        <Trash2 className="h-3 w-3" />
                      </Button>
                    </div>
                  </div>
                </Card>
              ))
            )}
          </div>
        </div>
      </div>
    );
  };

  // Render full chat interface
  const renderChatInterface = () => {
    return (
      <div className={cn("flex flex-col w-full min-w-0 bg-background", className)} style={{ height: 'calc(100vh - 300px)', minHeight: 'calc(100vh - 300px)' }}>
        {/* Header - Fixed */}
        <div className="flex-shrink-0 bg-background border-b">
          <div className="flex items-center justify-between p-3 border-b border-border bg-surface/80 backdrop-blur-sm">
            <div className="flex items-center gap-2">
              <Button
                variant="ghost"
                size="sm"
                onClick={() => {
                  setChatView('list');
                  onChatViewChange?.(false); // Notify parent that chat interface is closed
                }}
                className="h-7 w-7 p-0 text-muted-foreground"
              >
                <ChevronLeft className="h-4 w-4" />
              </Button>
              <LunaAvatar />
              <div>
                <h3 className="font-semibold text-foreground text-sm">Luna</h3>
                <p className="text-xs text-muted-foreground">AI Study Partner</p>
              </div>
            </div>
            
            <div className="flex items-center gap-1">
              {/* New Chat Button */}
              <Button
                size="sm"
                variant="outline"
                onClick={startNewConversation}
                className="h-7 px-2 text-xs"
              >
                <MessageCircle className="h-3 w-3 mr-1" />
                New
              </Button>
            </div>
          </div>

          {/* Context Indicators */}
          {(selectedSources.length > 0 || highlightedText) && (
            <div className="p-3 bg-surface/80 backdrop-blur-sm border-b border-border">
              <div className="flex items-center gap-2 text-xs text-muted-foreground">
                <Sparkles className="h-3 w-3" />
                <span>Context:</span>
                {selectedSources.length > 0 && (
                  <Badge variant="secondary" className="text-xs">
                    {selectedSources.length} source{selectedSources.length !== 1 ? 's' : ''}
                  </Badge>
                )}
                {highlightedText && (
                  <Badge variant="secondary" className="text-xs">
                    Selected text
                  </Badge>
                )}
              </div>
              {highlightedText && (
                <div className="mt-2 p-2 bg-surface rounded border border-border">
                  <p className="text-xs text-muted-foreground italic">
                    "{highlightedText.length > 100 ? highlightedText.slice(0, 100) + '...' : highlightedText}"
                  </p>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Messages - Takes remaining space */}
        <div className="flex-1 min-h-0">
          <ScrollArea className="h-full">
            <div className="px-3 pt-3 pb-3 space-y-3">
              {messages.length === 0 && (
                <div className="text-center text-muted-foreground py-8">
                  <div className="w-16 h-16 mx-auto mb-4 rounded-full overflow-hidden">
                    <img 
                      src="/web-app-manifest-512x512.png" 
                      alt="Luna AI" 
                      className="w-full h-full rounded-full object-cover"
                    />
                  </div>
                  <h4 className="text-lg font-semibold text-foreground mb-2">
                    Hi! I'm Luna, your AI study partner
                  </h4>
                  <p className="text-muted-foreground max-w-md mx-auto">
                    Ask me anything about your study materials, or I can help you create summaries, mind maps, and more.
                  </p>
                </div>
              )}

              {messages.map((message) => (
                <div
                  key={message.id}
                  className={cn(
                    "flex gap-3",
                    message.role === 'user' ? 'justify-end' : 'justify-start'
                  )}
                >
                  {message.role === 'assistant' && <LunaAvatar />}
                  
                  <div
                    className={cn(
                      "max-w-[80%] rounded-lg px-4 py-3",
                      message.role === 'user'
                        ? 'bg-blue-500 text-white ml-auto'
                        : 'bg-surface text-foreground'
                    )}
                  >
                    {message.highlighted_text && message.role === 'user' && (
                      <div className="mb-2 p-2 bg-white/20 rounded text-xs italic">
                        Selected: "{message.highlighted_text.slice(0, 50)}..."
                      </div>
                    )}
                    
                    <div className="text-sm">
                      {message.role === 'assistant' 
                        ? formatMessageContent(message.content, message.response_format)
                        : message.content
                      }
                    </div>

                    {message.role === 'assistant' && (
                      <div className="flex items-center justify-end gap-2 mt-3 pt-2 border-t border-border">
                        {onAddToNotes && (
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={() => addToNotes(message.content, message.id)}
                            className="h-7 px-2 text-xs bg-blue-50 hover:bg-blue-100 dark:bg-blue-900/20 dark:hover:bg-blue-900/40 text-blue-700 dark:text-blue-300 border border-blue-200/50 dark:border-blue-700/50 rounded transition-all"
                            title="Add to notes"
                          >
                            <NotebookPen className="h-3 w-3 mr-1" />
                            Add to notes
                          </Button>
                        )}
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => copyMessage(message.id, message.content)}
                          className="h-7 w-7 p-0"
                          title="Copy message"
                        >
                          {copiedMessageId === message.id ? (
                            <Check className="h-3 w-3 text-green-500" />
                          ) : (
                            <Copy className="h-3 w-3" />
                          )}
                        </Button>
                      </div>
                    )}
                  </div>

                  {message.role === 'user' && <UserAvatar />}
                </div>
              ))}

              {isLoading && (
                <div className="flex gap-3 justify-start">
                  <LunaAvatar />
                  <div className="bg-surface rounded-lg px-4 py-3">
                    <div className="flex items-center gap-2">
                      <Loader2 className="h-4 w-4 animate-spin" />
                      <span className="text-sm text-muted-foreground">Luna is thinking...</span>
                    </div>
                  </div>
                </div>
              )}
            </div>
            <div ref={messagesEndRef} />
          </ScrollArea>
        </div>

        {/* Input - Fixed at bottom */}
                  <div className="p-3 border-t flex-shrink-0">
            <div className="flex items-center gap-2 mb-3">
              <div className="p-1.5 rounded-lg bg-gradient-to-br from-primary/80 to-accent/80 shadow-sm">
                <Sparkles className="h-3 w-3 text-primary-foreground" />
              </div>
              <span className="text-sm font-medium text-foreground">Luna AI</span>
            {(selectedSources.length > 0 || highlightedText) && (
              <div className="flex items-center gap-1 ml-auto">
                {selectedSources.length > 0 && (
                  <Badge variant="secondary" className="text-xs px-2 py-0.5">
                    {selectedSources.length} source{selectedSources.length !== 1 ? 's' : ''}
                  </Badge>
                )}
                {highlightedText && (
                  <Badge variant="secondary" className="text-xs px-2 py-0.5">
                    Selected text
                  </Badge>
                )}
              </div>
            )}
          </div>
          
                      {highlightedText && (
              <div className="mb-3 p-3 bg-purple-500/10 rounded border border-purple-500/20">
                <p className="text-sm text-purple-600 dark:text-purple-400 italic">
                  Selected: "{highlightedText.length > 100 ? highlightedText.slice(0, 100) + '...' : highlightedText}"
                </p>
              </div>
            )}
          
          <div className="flex gap-3">
            <div className="flex-1 relative">
              <Input
                ref={inputRef}
                placeholder={
                  highlightedText
                    ? "Ask Luna about the selected text..."
                    : selectedSources.length > 0
                    ? `Ask Luna about ${selectedSources.length === 1 ? 'this source' : `${selectedSources.length} sources`}...`
                    : "Ask Luna anything..."
                }
                value={currentMessage}
                onChange={(e) => setCurrentMessage(e.target.value)}
                onKeyPress={(e) => e.key === 'Enter' && handleSendMessage()}
                className="pr-12 text-sm bg-background border-border focus:ring-2 focus:ring-primary h-12"
              />
              
              <Button
                size="sm"
                variant="ghost"
                className="absolute right-12 top-1/2 transform -translate-y-1/2 h-8 w-8 p-0 text-muted-foreground hover:text-foreground"
              >
                <Mic className="h-4 w-4" />
              </Button>
            </div>
            <Button 
              onClick={handleSendMessage}
              disabled={!currentMessage.trim() || isGenerating}
              size="lg"
              className="px-6 bg-primary text-primary-foreground shadow-md hover:shadow-lg transition-all h-12"
            >
              {isGenerating ? (
                <div className="h-4 w-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
              ) : (
                <Send className="h-4 w-4" />
              )}
            </Button>
          </div>
          
                      {isGenerating && (
              <div className="mt-4 p-4 bg-muted/50 rounded-lg border border-border">
                <div className="flex items-center gap-2 mb-2">
                  <div className="p-1 rounded bg-gradient-to-br from-primary/80 to-accent/80">
                    <Sparkles className="h-3 w-3 text-primary-foreground animate-pulse" />
                  </div>
                  <span className="text-sm font-medium text-foreground">Luna is thinking...</span>
                </div>
                <div className="space-y-2">
                  <div className="h-2 bg-muted rounded animate-pulse"></div>
                  <div className="h-2 bg-muted rounded animate-pulse w-3/4"></div>
                </div>
              </div>
            )}
        </div>

      </div>
    );
  };

  // Main render - choose between list and chat view
  if (chatView === 'list') {
    return renderConversationsList();
  } else {
    return renderChatInterface();
  }
});

LunaChat.displayName = 'LunaChat'; 