"use client";

import React, { useEffect, useRef } from 'react';
import { PersonaType } from './PersonaSelector';
import { useLunaContext } from '@/hooks/useLunaContext';
import { Badge } from '@/components/ui/badge';
import { Bot, User, ExternalLink } from 'lucide-react';

// Message interfaces
interface Citation {
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

interface ChatThreadProps {
  persona: PersonaType;
}

const ChatThread: React.FC<ChatThreadProps> = ({ persona }) => {
  const { messages, isLoading } = useLunaContext();
  const messagesEndRef = useRef<HTMLDivElement>(null);

  // Auto scroll to the bottom when messages change
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  // Placeholder messages if no real messages yet
  const placeholderMessages: ChatMessage[] = [
    {
      id: 'welcome',
      role: 'assistant',
      content: `Hello! I'm Luna, your ${persona === 'tutor' ? 'AI tutor' : persona === 'peer' ? 'peer learning buddy' : 'exam coach'}. How can I help you today?`,
      timestamp: new Date(),
      persona
    }
  ];

  const displayMessages = messages && messages.length > 0 ? messages : placeholderMessages;

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
    <div className="flex flex-col space-y-4">
      {displayMessages.map((message) => (
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
      {isLoading && (
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
      
      {/* Invisible element to scroll to */}
      <div ref={messagesEndRef} />
    </div>
  );
};

export default ChatThread; 