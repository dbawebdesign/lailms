"use client";

import { useState, useEffect, useRef, ChangeEvent, KeyboardEvent } from 'react';
import { useLunaContext } from '@/hooks/useLunaContext';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Badge } from '@/components/ui/badge';
import { Loader2, Bot, User, ExternalLink, Mic, MicOff } from 'lucide-react';
import { v4 as uuidv4 } from 'uuid';

// Persona types
export type PersonaType = 'tutor' | 'peer' | 'examCoach';

// Message with citations interface
export interface Citation {
  id: string;
  title: string;
  url?: string;
}

export interface ChatMessage {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  timestamp: Date;
  citations?: Citation[];
  isLoading?: boolean;
  persona?: PersonaType;
}

/**
 * Luna AI Chat component that uses the UI context system
 * Implements persona selection, context-aware responses, and citation support
 */
export function LunaAIChat() {
  const [userMessage, setUserMessage] = useState('');
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isRecording, setIsRecording] = useState(false);
  const [currentPersona, setCurrentPersona] = useState<PersonaType>('tutor');
  
  // Message history for API calls
  const messageHistory = useRef<{ role: 'user' | 'assistant'; content: string }[]>([]);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  
  // Get the current UI context
  const { context, isReady } = useLunaContext();

  // Auto scroll to the bottom when messages change
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  // Auto-focus the input field when component mounts
  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  // Add welcome message based on persona when component mounts
  useEffect(() => {
    if (messages.length === 0) {
      setMessages([{
        id: 'welcome',
        role: 'assistant',
        content: getWelcomeMessage(currentPersona),
        timestamp: new Date(),
        persona: currentPersona
      }]);
    }
  }, []);

  const getWelcomeMessage = (persona: PersonaType): string => {
    switch (persona) {
      case 'tutor':
        return "Hello! I'm Luna, your AI tutor. How can I help with your learning today?";
      case 'peer':
        return "Hi there! I'm Luna, your peer learning buddy. Let's study together! What are you working on?";
      case 'examCoach':
        return "Welcome! I'm Luna, your exam coach. Need help preparing for a test or practicing questions?";
      default:
        return "Hello! I'm Luna, your AI assistant. How can I help you today?";
    }
  };
  
  // Handle persona change
  const handlePersonaChange = (persona: PersonaType) => {
    setCurrentPersona(persona);
    
    // Add a system message about the persona change
    setMessages(prev => [
      ...prev,
      {
        id: uuidv4(),
        role: 'assistant',
        content: `I've switched to ${persona === 'tutor' ? 'Tutor' : persona === 'peer' ? 'Peer Buddy' : 'Exam Coach'} mode. ${getWelcomeMessage(persona)}`,
        timestamp: new Date(),
        persona
      }
    ]);
  };
  
  // Handle sending a message to Luna
  const handleSendMessage = async () => {
    if (!userMessage.trim() || !context || isLoading) return;
    
    const currentMessage = userMessage.trim();
    
    // Create a new user message
    const userMsg: ChatMessage = {
      id: uuidv4(),
      role: 'user',
      content: currentMessage,
      timestamp: new Date()
    };
    
    // Add user message to conversation
    setMessages(prev => [...prev, userMsg]);
    
    // Clear input
    setUserMessage('');
    
    // Set loading state
    setIsLoading(true);
    setError(null);
    
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
        persona: currentPersona
      }
    ]);
    
    // Add message to history for API
    messageHistory.current.push({ role: 'user', content: currentMessage });
    
    try {
      // Send user message and current context to the backend API
      const response = await fetch('/api/luna/chat', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ 
          message: currentMessage, 
          context, 
          messages: messageHistory.current 
        }),
      });

      // Check if response is ok and contains valid JSON
      let data;
      try {
        const contentType = response.headers.get('content-type');
        if (contentType && contentType.includes('application/json')) {
          data = await response.json();
        } else {
          // Handle non-JSON responses (like HTML error pages)
          const text = await response.text();
          throw new Error(`Received non-JSON response: Status ${response.status}`);
        }
      } catch (parseError) {
        throw new Error(`Failed to parse response: ${parseError instanceof Error ? parseError.message : 'Unknown parse error'}`);
      }

      if (!response.ok) {
        throw new Error(data.error || `API error: ${response.status}`);
      }
      
      // Add assistant message to history
      messageHistory.current.push({ role: 'assistant', content: data.response });
      
      // Remove temporary loading message and add the real response
      setMessages(prev => {
        // Filter out the loading message
        const filteredMessages = prev.filter(msg => msg.id !== tempBotMessageId);
        
        // Add the assistant's response
        return [
          ...filteredMessages,
          {
            id: uuidv4(),
            role: 'assistant',
            content: data.response,
            timestamp: new Date(),
            persona: currentPersona,
            // Add citations if they exist in the response
            citations: data.citations || []
          }
        ];
      });

    } catch (err) {
      console.error("Failed to get response from Luna:", err);
      const message = err instanceof Error ? err.message : "An unknown error occurred";
      setError(`Error: ${message}`);
      
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
            content: `Sorry, I encountered an error while processing your request. Technical details: ${message}. Please try again later.`,
            timestamp: new Date(),
            persona: currentPersona
          }
        ];
      });
    } finally {
      setIsLoading(false);
    }
  };
  
  // Handle Enter key press in input
  const handleKeyDown = (event: KeyboardEvent<HTMLInputElement>) => {
    if (event.key === 'Enter' && !isLoading) {
      handleSendMessage();
    }
  };

  // Toggle voice recording (placeholder implementation)
  const toggleRecording = () => {
    if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
      alert('Your browser does not support voice recording');
      return;
    }

    if (isRecording) {
      setIsRecording(false);
      // Stop recording logic would go here
    } else {
      setIsRecording(true);
      // Start recording logic would go here
      navigator.mediaDevices.getUserMedia({ audio: true })
        .then((stream) => {
          // Voice recording implementation would go here
          console.log('Recording started', stream);
        })
        .catch((err) => {
          console.error('Error accessing microphone:', err);
          setIsRecording(false);
        });
    }
  };

  // Render markdown content
  const formatMessageContent = (content: string) => {
    // This is a placeholder - ideally use a markdown parser like react-markdown
    return content.split('\n').map((line, i) => (
      <p key={i} className={i > 0 ? 'mt-2' : ''}>
        {line}
      </p>
    ));
  };

  return (
    <div className="flex flex-col h-full">
      {/* Persona Selector */}
      <div className="flex border-b p-1 bg-muted/10">
        {[
          { id: 'tutor', name: 'Tutor', icon: <Bot size={14} /> },
          { id: 'peer', name: 'Peer Buddy', icon: <User size={14} /> },
          { id: 'examCoach', name: 'Exam Coach', icon: <Loader2 size={14} /> }
        ].map((persona) => (
          <Button
            key={persona.id}
            variant={currentPersona === persona.id ? "default" : "ghost"}
            size="sm"
            className={`flex-1 text-xs gap-1 h-8 ${currentPersona === persona.id ? "" : "opacity-70"}`}
            title={`Switch to ${persona.name} mode`}
            onClick={() => handlePersonaChange(persona.id as PersonaType)}
          >
            {persona.icon}
            <span>{persona.name}</span>
          </Button>
        ))}
      </div>
      
      {/* Chat Messages */}
      <div className="flex-grow overflow-hidden">
        <ScrollArea className="h-full px-2 py-3">
          <div className="space-y-4">
            {messages.map((message) => (
              <div 
                key={message.id}
                className={`flex gap-2 ${message.role === 'user' ? 'justify-end' : 'justify-start'}`}
              >
                {/* Avatar/Icon for the assistant */}
                {message.role === 'assistant' && (
                  <div className="h-8 w-8 rounded-full bg-primary flex items-center justify-center text-primary-foreground flex-shrink-0">
                    <Bot size={16} />
                  </div>
                )}
                
                {/* Message bubble */}
                <div 
                  className={`max-w-[80%] rounded-lg p-3 ${
                    message.role === 'user' 
                      ? 'bg-primary text-primary-foreground' 
                      : 'bg-muted text-foreground'
                  } ${message.isLoading ? 'animate-pulse' : ''}`}
                >
                  <div className="text-sm">
                    {formatMessageContent(message.content)}
                  </div>
                  
                  {/* Citations if any */}
                  {message.citations && message.citations.length > 0 && (
                    <div className="mt-2 pt-2 border-t border-muted-foreground/20 text-xs">
                      <p className="font-semibold mb-1">Sources:</p>
                      <div className="flex flex-wrap gap-1">
                        {message.citations.map((citation) => (
                          <Badge 
                            key={citation.id} 
                            variant="outline"
                            className="flex items-center gap-1 text-xs"
                          >
                            {citation.title}
                            {citation.url && (
                              <a 
                                href={citation.url} 
                                target="_blank" 
                                rel="noopener noreferrer"
                                className="inline-flex"
                              >
                                <ExternalLink size={10} />
                              </a>
                            )}
                          </Badge>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
                
                {/* Avatar/Icon for the user */}
                {message.role === 'user' && (
                  <div className="h-8 w-8 rounded-full bg-secondary flex items-center justify-center text-secondary-foreground flex-shrink-0">
                    <User size={16} />
                  </div>
                )}
              </div>
            ))}
            
            {/* Loading indicator */}
            {isLoading && !messages.some(m => m.isLoading) && (
              <div className="flex gap-2 justify-start">
                <div className="h-8 w-8 rounded-full bg-primary flex items-center justify-center text-primary-foreground flex-shrink-0">
                  <Bot size={16} />
                </div>
                <div className="max-w-[80%] rounded-lg p-3 bg-muted text-foreground animate-pulse">
                  <div className="flex space-x-2">
                    <div className="h-2 w-2 rounded-full bg-current animate-bounce"></div>
                    <div className="h-2 w-2 rounded-full bg-current animate-bounce delay-150"></div>
                    <div className="h-2 w-2 rounded-full bg-current animate-bounce delay-300"></div>
                  </div>
                </div>
              </div>
            )}
            
            {/* Error display */}
            {error && (
              <div className="flex justify-start">
                <div className="p-3 rounded-lg bg-destructive text-destructive-foreground max-w-[80%]">
                  {error}
                </div>
              </div>
            )}
            
            {/* Invisible element to scroll to */}
            <div ref={messagesEndRef} />
          </div>
        </ScrollArea>
      </div>
      
      {/* Input Area */}
      <div className="p-2 border-t">
        <div className="flex w-full items-center space-x-2">
          <Button
            type="button"
            variant="ghost"
            size="icon"
            className="h-10 w-10 rounded-full flex-shrink-0"
            onClick={toggleRecording}
            disabled={isLoading || !isReady}
          >
            {isRecording ? <MicOff size={18} className="text-destructive" /> : <Mic size={18} />}
          </Button>
          
          <Input
            ref={inputRef}
            type="text"
            placeholder={`Ask ${currentPersona === 'tutor' ? 'your tutor' : currentPersona === 'peer' ? 'your peer buddy' : 'your exam coach'}...`}
            value={userMessage}
            onChange={(e: ChangeEvent<HTMLInputElement>) => setUserMessage(e.target.value)}
            onKeyDown={handleKeyDown}
            disabled={isLoading || !isReady || isRecording}
            className="flex-grow focus-visible:ring-primary"
          />
          
          <Button 
            onClick={handleSendMessage} 
            disabled={isLoading || !isReady || !userMessage.trim() || isRecording}
            className="h-10 w-10 rounded-full flex-shrink-0 p-0"
          >
            {isLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : (
              <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <line x1="22" y1="2" x2="11" y2="13"></line>
                <polygon points="22 2 15 22 11 13 2 9 22 2"></polygon>
              </svg>
            )}
          </Button>
        </div>
      </div>
    </div>
  );
} 