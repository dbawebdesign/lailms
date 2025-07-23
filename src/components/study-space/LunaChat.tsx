'use client';

import React, { useState, useEffect, useRef } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { 
  Send, 
  Mic, 
  Loader2, 
  Sparkles, 
  MessageCircle, 
  Copy,
  Check,
  RefreshCw,
  Map,
  FileText,
  HelpCircle,
  Lightbulb,
  BookOpen,
  Brain,
  MoreHorizontal
} from 'lucide-react';

// Simple Avatar components
const Avatar = ({ children, className }: { children: React.ReactNode; className?: string }) => (
  <div className={cn("relative flex h-10 w-10 shrink-0 overflow-hidden rounded-full", className)}>
    {children}
  </div>
);

const AvatarFallback = ({ children, className }: { children: React.ReactNode; className?: string }) => (
  <div className={cn("flex h-full w-full items-center justify-center rounded-full bg-muted", className)}>
    {children}
  </div>
);
import { createClient } from '@/lib/supabase/client';
import ReactMarkdown from 'react-markdown';
import { cn } from '@/lib/utils';

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
  className?: string;
}

export function LunaChat({ 
  selectedSources = [], 
  highlightedText, 
  onHighlightedTextUsed,
  className 
}: LunaChatProps) {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [currentMessage, setCurrentMessage] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [currentConversation, setCurrentConversation] = useState<Conversation | null>(null);
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [responseFormat, setResponseFormat] = useState<'text' | 'mindmap' | 'structured' | 'summary'>('text');
  const [copiedMessageId, setCopiedMessageId] = useState<string | null>(null);
  
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const supabase = createClient();

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  useEffect(() => {
    loadConversations();
  }, []);

  // Auto-populate message when highlighted text is provided
  useEffect(() => {
    if (highlightedText && !currentMessage) {
      setCurrentMessage(`Can you explain this: "${highlightedText}"`);
    }
  }, [highlightedText]);

  const loadConversations = async () => {
    try {
      const response = await fetch('/api/luna/conversations');
      if (response.ok) {
        const data = await response.json();
        setConversations(data.conversations || []);
        
        // Load the most recent conversation
        if (data.conversations?.length > 0) {
          setCurrentConversation(data.conversations[0]);
          loadMessages(data.conversations[0].id);
        }
      }
    } catch (error) {
      console.error('Error loading conversations:', error);
    }
  };

  const loadMessages = async (conversationId: string) => {
    try {
      const { data: messagesData, error } = await supabase
        .from('luna_messages')
        .select('*')
        .eq('conversation_id', conversationId)
        .order('created_at', { ascending: true });

      if (error) {
        console.error('Error loading messages:', error);
        return;
      }

      setMessages(messagesData || []);
    } catch (error) {
      console.error('Error loading messages:', error);
    }
  };

  const sendMessage = async (quickAction?: string) => {
    if (!currentMessage.trim() && !highlightedText) return;
    
    setIsLoading(true);
    
    try {
      const messageToSend = currentMessage.trim() || `Can you explain this: "${highlightedText}"`;
      
      const response = await fetch('/api/luna/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          message: messageToSend,
          conversationId: currentConversation?.id,
          responseFormat,
          highlightedText,
          sources: selectedSources,
          quickAction
        }),
      });

      if (!response.ok) {
        throw new Error('Failed to send message');
      }

      const data = await response.json();
      
      // Update conversation if new one was created
      if (data.conversationId && !currentConversation) {
        const newConversation: Conversation = {
          id: data.conversationId,
          title: messageToSend.slice(0, 50) + (messageToSend.length > 50 ? '...' : ''),
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString()
        };
        setCurrentConversation(newConversation);
        setConversations(prev => [newConversation, ...prev]);
      }

      // Add user message
      const userMessage: ChatMessage = {
        id: `user-${Date.now()}`,
        role: 'user',
        content: messageToSend,
        highlighted_text: highlightedText || undefined,
        sources: selectedSources,
        created_at: new Date().toISOString()
      };

      // Add assistant message
      const assistantMessage: ChatMessage = {
        id: data.messageId || `assistant-${Date.now()}`,
        role: 'assistant',
        content: data.message,
        response_format: data.responseFormat,
        created_at: new Date().toISOString(),
        quickActions: data.quickActions
      };

      setMessages(prev => [...prev, userMessage, assistantMessage]);
      setCurrentMessage('');
      
      // Clear highlighted text after using it
      if (highlightedText && onHighlightedTextUsed) {
        onHighlightedTextUsed();
      }

    } catch (error) {
      console.error('Error sending message:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleQuickAction = async (actionId: string, messageContent: string) => {
    setCurrentMessage(`${actionId}: ${messageContent}`);
    
    // Set appropriate response format based on action
    if (actionId === 'mindmap') {
      setResponseFormat('mindmap');
    } else if (actionId === 'structured') {
      setResponseFormat('structured');
    } else if (actionId === 'summarize') {
      setResponseFormat('summary');
    } else {
      setResponseFormat('text');
    }
    
    await sendMessage(actionId);
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

  const startNewConversation = () => {
    setCurrentConversation(null);
    setMessages([]);
    setCurrentMessage('');
  };

  const formatMessageContent = (content: string, format?: string) => {
    if (format === 'mindmap') {
      return (
        <div className="bg-purple-50 dark:bg-purple-900/20 rounded-lg p-4 border border-purple-200 dark:border-purple-700/50">
          <div className="flex items-center gap-2 mb-3">
            <Map className="h-4 w-4 text-purple-600 dark:text-purple-400" />
            <span className="text-sm font-medium text-purple-700 dark:text-purple-300">Mind Map</span>
          </div>
          <ReactMarkdown className="prose prose-sm prose-purple dark:prose-invert max-w-none">
            {content}
          </ReactMarkdown>
        </div>
      );
    }

    if (format === 'structured') {
      return (
        <div className="bg-blue-50 dark:bg-blue-900/20 rounded-lg p-4 border border-blue-200 dark:border-blue-700/50">
          <div className="flex items-center gap-2 mb-3">
            <FileText className="h-4 w-4 text-blue-600 dark:text-blue-400" />
            <span className="text-sm font-medium text-blue-700 dark:text-blue-300">Structured Response</span>
          </div>
          <ReactMarkdown className="prose prose-sm prose-blue dark:prose-invert max-w-none">
            {content}
          </ReactMarkdown>
        </div>
      );
    }

    if (format === 'summary') {
      return (
        <div className="bg-emerald-50 dark:bg-emerald-900/20 rounded-lg p-4 border border-emerald-200 dark:border-emerald-700/50">
          <div className="flex items-center gap-2 mb-3">
            <BookOpen className="h-4 w-4 text-emerald-600 dark:text-emerald-400" />
            <span className="text-sm font-medium text-emerald-700 dark:text-emerald-300">Summary</span>
          </div>
          <ReactMarkdown className="prose prose-sm prose-emerald dark:prose-invert max-w-none">
            {content}
          </ReactMarkdown>
        </div>
      );
    }

    return (
      <ReactMarkdown className="prose prose-sm dark:prose-invert max-w-none">
        {content}
      </ReactMarkdown>
    );
  };

  return (
    <div className={cn("flex flex-col h-full bg-white dark:bg-slate-900", className)}>
      {/* Header */}
      <div className="flex items-center justify-between p-4 border-b border-slate-200 dark:border-slate-700">
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2">
            <Avatar className="h-8 w-8 bg-gradient-to-br from-purple-500 to-pink-500">
              <AvatarFallback className="text-white font-medium">L</AvatarFallback>
            </Avatar>
            <div>
              <h3 className="font-semibold text-slate-900 dark:text-slate-100">Luna</h3>
              <p className="text-xs text-slate-500 dark:text-slate-400">AI Study Partner</p>
            </div>
          </div>
        </div>
        
        <div className="flex items-center gap-2">
          {/* Response Format Selector */}
          <div className="flex items-center gap-1 bg-slate-100 dark:bg-slate-800 rounded-lg p-1">
            <Button
              size="sm"
              variant={responseFormat === 'text' ? 'default' : 'ghost'}
              onClick={() => setResponseFormat('text')}
              className="h-7 px-2 text-xs"
            >
              Text
            </Button>
            <Button
              size="sm"
              variant={responseFormat === 'structured' ? 'default' : 'ghost'}
              onClick={() => setResponseFormat('structured')}
              className="h-7 px-2 text-xs"
            >
              Structured
            </Button>
            <Button
              size="sm"
              variant={responseFormat === 'mindmap' ? 'default' : 'ghost'}
              onClick={() => setResponseFormat('mindmap')}
              className="h-7 px-2 text-xs"
            >
              Mindmap
            </Button>
            <Button
              size="sm"
              variant={responseFormat === 'summary' ? 'default' : 'ghost'}
              onClick={() => setResponseFormat('summary')}
              className="h-7 px-2 text-xs"
            >
              Summary
            </Button>
          </div>
          
          <Button
            size="sm"
            variant="outline"
            onClick={startNewConversation}
            className="h-8 px-3"
          >
            <MessageCircle className="h-3 w-3 mr-1" />
            New
          </Button>
        </div>
      </div>

      {/* Context Indicators */}
      {(selectedSources.length > 0 || highlightedText) && (
        <div className="p-3 bg-slate-50 dark:bg-slate-800/50 border-b border-slate-200 dark:border-slate-700">
          <div className="flex items-center gap-2 text-xs text-slate-600 dark:text-slate-400">
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
            <div className="mt-2 p-2 bg-white dark:bg-slate-800 rounded border border-slate-200 dark:border-slate-700">
              <p className="text-xs text-slate-700 dark:text-slate-300 italic">
                "{highlightedText.length > 100 ? highlightedText.slice(0, 100) + '...' : highlightedText}"
              </p>
            </div>
          )}
        </div>
      )}

      {/* Messages */}
      <ScrollArea className="flex-1 p-4">
        <div className="space-y-4">
          {messages.length === 0 && (
            <div className="text-center py-8">
              <div className="w-16 h-16 mx-auto mb-4 bg-gradient-to-br from-purple-500 to-pink-500 rounded-full flex items-center justify-center">
                <Sparkles className="h-8 w-8 text-white" />
              </div>
              <h4 className="text-lg font-semibold text-slate-900 dark:text-slate-100 mb-2">
                Hi! I'm Luna, your AI study partner
              </h4>
              <p className="text-slate-600 dark:text-slate-400 max-w-md mx-auto">
                I can help explain concepts, create mind maps, summarize content, and answer questions about your study materials.
              </p>
              {selectedSources.length > 0 && (
                <div className="mt-4 flex flex-wrap gap-2 justify-center">
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => setCurrentMessage("Summarize the key points from these sources")}
                    className="text-xs"
                  >
                    <BookOpen className="h-3 w-3 mr-1" />
                    Summarize
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => setCurrentMessage("Create a mind map of these concepts")}
                    className="text-xs"
                  >
                    <Map className="h-3 w-3 mr-1" />
                    Mind Map
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => setCurrentMessage("Explain the main concepts in detail")}
                    className="text-xs"
                  >
                    <Lightbulb className="h-3 w-3 mr-1" />
                    Explain
                  </Button>
                </div>
              )}
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
              {message.role === 'assistant' && (
                <Avatar className="h-8 w-8 bg-gradient-to-br from-purple-500 to-pink-500">
                  <AvatarFallback className="text-white font-medium">L</AvatarFallback>
                </Avatar>
              )}
              
              <div
                className={cn(
                  "max-w-[80%] rounded-lg px-4 py-3",
                  message.role === 'user'
                    ? 'bg-blue-500 text-white ml-auto'
                    : 'bg-slate-100 dark:bg-slate-800 text-slate-900 dark:text-slate-100'
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
                  <div className="flex items-center justify-between mt-3 pt-2 border-t border-slate-200 dark:border-slate-700">
                    <div className="flex items-center gap-1">
                      {message.quickActions?.map((action) => (
                        <Button
                          key={action.id}
                          size="sm"
                          variant="ghost"
                          onClick={() => handleQuickAction(action.id, message.content)}
                          className="h-7 px-2 text-xs"
                        >
                          <span className="mr-1">{action.icon}</span>
                          {action.label}
                        </Button>
                      ))}
                    </div>
                    
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => copyMessage(message.id, message.content)}
                      className="h-7 w-7 p-0"
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

              {message.role === 'user' && (
                <Avatar className="h-8 w-8 bg-blue-500">
                  <AvatarFallback className="text-white font-medium">You</AvatarFallback>
                </Avatar>
              )}
            </div>
          ))}
          
          {isLoading && (
            <div className="flex gap-3">
              <Avatar className="h-8 w-8 bg-gradient-to-br from-purple-500 to-pink-500">
                <AvatarFallback className="text-white font-medium">L</AvatarFallback>
              </Avatar>
              <div className="bg-slate-100 dark:bg-slate-800 rounded-lg px-4 py-3">
                <div className="flex items-center gap-2 text-slate-600 dark:text-slate-400">
                  <Loader2 className="h-4 w-4 animate-spin" />
                  <span className="text-sm">Luna is thinking...</span>
                </div>
              </div>
            </div>
          )}
        </div>
        <div ref={messagesEndRef} />
      </ScrollArea>

      {/* Input */}
      <div className="p-4 border-t border-slate-200 dark:border-slate-700">
        <div className="flex gap-2">
          <div className="flex-1 relative">
            <Input
              placeholder={
                selectedSources.length > 0
                  ? `Ask Luna about ${selectedSources.length === 1 ? 'this source' : `${selectedSources.length} sources`}...`
                  : highlightedText
                  ? "Ask Luna about the selected text..."
                  : "Ask Luna anything..."
              }
              value={currentMessage}
              onChange={(e) => setCurrentMessage(e.target.value)}
              onKeyPress={(e) => e.key === 'Enter' && !e.shiftKey && sendMessage()}
              disabled={isLoading}
              className="pr-10"
            />
            <Button
              size="sm"
              variant="ghost"
              className="absolute right-1 top-1/2 transform -translate-y-1/2 h-6 w-6 p-0 text-slate-400 hover:text-slate-600 dark:hover:text-slate-300"
            >
              <Mic className="h-3 w-3" />
            </Button>
          </div>
          <Button
            onClick={() => sendMessage()}
            disabled={(!currentMessage.trim() && !highlightedText) || isLoading}
            className="px-4"
          >
            {isLoading ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Send className="h-4 w-4" />
            )}
          </Button>
        </div>
      </div>
    </div>
  );
} 