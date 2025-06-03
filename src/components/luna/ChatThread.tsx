"use client";

import React, { useEffect, useRef, useState } from 'react';
import { PersonaType } from './PersonaSelector';
import { useLunaContext } from '@/hooks/useLunaContext';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Bot, User, ExternalLink } from 'lucide-react';

// Action button interface
interface ActionButton {
  id: string;
  label: string;
  action: 'confirm' | 'deny' | 'select' | 'navigate' | 'complete' | 'cancel' | 'skip' | 'edit';
  data: Record<string, any>;
  style: 'primary' | 'secondary' | 'success' | 'warning' | 'danger';
}

// Citation interface
interface Citation {
  id: string;
  title: string;
  url?: string;
}

// Message interface
export interface ChatMessage {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  timestamp: Date;
  citations?: Citation[];
  actionButtons?: ActionButton[];
  isLoading?: boolean;
  persona?: PersonaType;
}

interface ChatThreadProps {
  persona: PersonaType;
}

const ActionButtons: React.FC<{ buttons: ActionButton[]; onButtonClick: (button: ActionButton) => void; isLoading: boolean; isMobile: boolean }> = ({ 
  buttons, 
  onButtonClick, 
  isLoading,
  isMobile
}) => {
  if (!buttons || buttons.length === 0) {
    return null;
  }

  // Map action button styles to Tailwind button variants
  const getButtonVariant = (style: ActionButton['style']) => {
    switch (style) {
      case 'primary': return 'default';
      case 'secondary': return 'secondary';
      case 'success': return 'default';
      case 'warning': return 'destructive';
      case 'danger': return 'destructive';
      default: return 'secondary';
    }
  };

  const getButtonClassName = (style: ActionButton['style']) => {
    switch (style) {
      case 'success': return 'bg-green-600 hover:bg-green-700 text-white';
      case 'warning': return 'bg-yellow-600 hover:bg-yellow-700 text-white';
      default: return '';
    }
  };

  return (
    <div className={`mt-3 flex flex-wrap gap-2 ${isMobile ? 'gap-3' : 'gap-2'}`}>
      {buttons.map((button) => {
        return (
          <Button
            key={button.id}
            variant={getButtonVariant(button.style)}
            size={isMobile ? "default" : "sm"}
            className={`${getButtonClassName(button.style)} ${isMobile ? 'min-h-[44px] px-4' : ''}`}
            onClick={() => onButtonClick(button)}
            disabled={isLoading}
          >
            {button.label}
          </Button>
        );
      })}
    </div>
  );
};

export default function ChatThread({ persona }: ChatThreadProps) {
  const { messages, sendMessage, isLoading } = useLunaContext();
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const [isMobile, setIsMobile] = useState(false);

  // Detect mobile
  useEffect(() => {
    const checkMobile = () => {
      setIsMobile(window.innerWidth < 768);
    };

    checkMobile();
    window.addEventListener('resize', checkMobile);

    return () => {
      window.removeEventListener('resize', checkMobile);
    };
  }, []);

  // Debug: Log messages to see if action buttons are present
  console.log('[ChatThread] Current messages:', messages.map(msg => ({
    id: msg.id,
    role: msg.role,
    hasActionButtons: !!msg.actionButtons,
    actionButtonsLength: msg.actionButtons?.length || 0,
    actionButtons: msg.actionButtons,
    isLoading: msg.isLoading,
    contentLength: msg.content?.length || 0
  })));

  console.log('[ChatThread] Full messages array length:', messages.length);
  console.log('[ChatThread] Messages with action buttons:', messages.filter(msg => msg.actionButtons && msg.actionButtons.length > 0).length);

  // Check if we have any recent non-loading messages with action buttons
  const recentMessagesWithButtons = messages.filter(msg => 
    !msg.isLoading && 
    msg.actionButtons && 
    msg.actionButtons.length > 0
  );
  console.log('[ChatThread] Recent messages with action buttons:', recentMessagesWithButtons.length, recentMessagesWithButtons);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  // Auto scroll to the bottom when messages change
  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  // Handle action button clicks
  const handleActionButtonClick = async (button: ActionButton) => {
    // Create a message that includes the button data
    const buttonResponse = `[Action: ${button.action}] ${button.label}`;
    
    // Add the button data to the message context
    const messageWithButtonData = {
      text: buttonResponse,
      buttonData: button.data,
      buttonAction: button.action,
      buttonId: button.id
    };

    // Send the button response as a message
    // The backend will receive this and can use the button data to continue the workflow
    await sendMessage(JSON.stringify(messageWithButtonData), persona);
  };

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
    <div className={`flex flex-col ${isMobile ? 'space-y-6' : 'space-y-4'}`}>
      {displayMessages.map((message) => (
        <div 
          key={message.id}
          className={`flex gap-3 ${message.role === 'user' ? 'justify-end' : 'justify-start'}`}
        >
          {/* Avatar/Icon for the assistant */}
          {message.role === 'assistant' && (
            <div className={`rounded-full bg-primary flex items-center justify-center text-primary-foreground flex-shrink-0 ${isMobile ? 'h-10 w-10' : 'h-8 w-8'}`}>
              <Bot size={isMobile ? 18 : 16} />
            </div>
          )}
          
          {/* Message bubble */}
          <div 
            className={`max-w-[85%] rounded-lg ${isMobile ? 'p-4' : 'p-3'} ${
              message.role === 'user' 
                ? 'bg-primary text-primary-foreground' 
                : 'bg-muted text-foreground'
            } ${message.isLoading ? 'animate-pulse' : ''}`}
          >
            <div className={isMobile ? 'text-base leading-relaxed' : 'text-sm'}>
              {formatMessageContent(message.content)}
            </div>
            
            {/* Citations if any */}
            {message.citations && message.citations.length > 0 && (
              <div className={`mt-3 pt-3 border-t border-muted-foreground/20 ${isMobile ? 'text-sm' : 'text-xs'}`}>
                <p className="font-semibold mb-2">Sources:</p>
                <div className="flex flex-wrap gap-2">
                  {message.citations.map((citation) => (
                    <Badge 
                      key={citation.id} 
                      variant="outline"
                      className={`flex items-center gap-1 ${isMobile ? 'text-sm px-3 py-1' : 'text-xs'}`}
                    >
                      {citation.title}
                      {citation.url && (
                        <a 
                          href={citation.url} 
                          target="_blank" 
                          rel="noopener noreferrer"
                          className="inline-flex"
                        >
                          <ExternalLink size={isMobile ? 12 : 10} />
                        </a>
                      )}
                    </Badge>
                  ))}
                </div>
              </div>
            )}

            {/* Action Buttons */}
            {(() => {
              const hasActionButtons = message.actionButtons && message.actionButtons.length > 0;
              console.log('[ChatThread] Checking action buttons for message:', {
                messageId: message.id,
                role: message.role,
                hasActionButtons,
                actionButtonsArray: message.actionButtons,
                actionButtonsLength: message.actionButtons?.length || 0,
                isLoading: message.isLoading
              });
              
              if (hasActionButtons) {
                console.log('[ChatThread] RENDERING action buttons for message:', message.id);
                return (
                  <ActionButtons
                    buttons={message.actionButtons!}
                    onButtonClick={handleActionButtonClick}
                    isLoading={isLoading}
                    isMobile={isMobile}
                  />
                );
              } else {
                console.log('[ChatThread] NOT rendering action buttons for message:', message.id, 'Reason:', 
                  !message.actionButtons ? 'No actionButtons property' : 
                  message.actionButtons.length === 0 ? 'Empty actionButtons array' : 'Unknown'
                );
                return null;
              }
            })()}
          </div>
          
          {/* Avatar/Icon for the user */}
          {message.role === 'user' && (
            <div className={`rounded-full bg-secondary flex items-center justify-center text-secondary-foreground flex-shrink-0 ${isMobile ? 'h-10 w-10' : 'h-8 w-8'}`}>
              <User size={isMobile ? 18 : 16} />
            </div>
          )}
        </div>
      ))}
      
      {/* Loading indicator */}
      {isLoading && (
        <div className="flex gap-3 justify-start">
          <div className={`rounded-full bg-primary flex items-center justify-center text-primary-foreground flex-shrink-0 ${isMobile ? 'h-10 w-10' : 'h-8 w-8'}`}>
            <Bot size={isMobile ? 18 : 16} />
          </div>
          <div className={`max-w-[85%] rounded-lg bg-muted text-foreground animate-pulse ${isMobile ? 'p-4' : 'p-3'}`}>
            <div className="flex space-x-2">
              <div className={`rounded-full bg-current animate-bounce ${isMobile ? 'h-3 w-3' : 'h-2 w-2'}`}></div>
              <div className={`rounded-full bg-current animate-bounce delay-150 ${isMobile ? 'h-3 w-3' : 'h-2 w-2'}`}></div>
              <div className={`rounded-full bg-current animate-bounce delay-300 ${isMobile ? 'h-3 w-3' : 'h-2 w-2'}`}></div>
            </div>
          </div>
        </div>
      )}
      
      {/* Invisible element to scroll to */}
      <div ref={messagesEndRef} />
    </div>
  );
} 