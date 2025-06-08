"use client";

import React, { useState, useEffect, useRef, useCallback } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { 
  MessageSquare, 
  Bot, 
  User, 
  Mic, 
  MicOff, 
  Send, 
  Loader2, 
  Brain,
  Wand2,
  ClipboardCheck,
  Activity,
  CheckCircle,
  AlertCircle,
  Clock
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { motion, AnimatePresence } from 'framer-motion';

// Types
export interface AgentMessage {
  id: string;
  role: 'user' | 'assistant' | 'system';
  content: string;
  timestamp: Date;
  agentName?: string;
  agentType?: 'text' | 'voice';
  toolsUsed?: string[];
  isLoading?: boolean;
  citations?: Array<{ id: string; title: string; url?: string }>;
  actionButtons?: Array<{ 
    id: string; 
    label: string; 
    action: string; 
    data?: any; 
    variant?: 'primary' | 'secondary' | 'success' | 'warning' 
  }>;
  realTimeUpdates?: Array<{
    entity: string;
    entityId: string;
    type: 'create' | 'update' | 'delete';
    status: 'pending' | 'completed' | 'failed';
  }>;
}

export interface AgentPersona {
  id: string;
  name: string;
  icon: React.ReactNode;
  description: string;
  capabilities: string[];
  agentType: 'text' | 'voice' | 'hybrid';
}

export interface LunaAgentChatProps {
  userRole: 'student' | 'teacher' | 'admin';
  isMobile?: boolean;
  className?: string;
}

// Persona configurations based on user role
const getPersonasForRole = (role: 'student' | 'teacher' | 'admin'): AgentPersona[] => {
  const studentPersonas: AgentPersona[] = [
    {
      id: 'tutor',
      name: 'Luna Tutor',
      icon: <Bot size={16} className="text-accent" />,
      description: 'Your personal AI tutor for explanations and practice',
      capabilities: ['Personalized explanations', 'Practice questions', 'Progress tracking'],
      agentType: 'hybrid'
    },
    {
      id: 'examCoach',
      name: 'Exam Coach',
      icon: <ClipboardCheck size={16} className="text-accent" />,
      description: 'Test preparation and performance optimization',
      capabilities: ['Practice tests', 'Weakness analysis', 'Study strategies'],
      agentType: 'text'
    },
    {
      id: 'voiceTutor',
      name: 'Voice Tutor',
      icon: <Mic size={16} className="text-accent" />,
      description: 'Interactive voice learning sessions',
      capabilities: ['Voice interaction', 'Pronunciation help', 'Audio content'],
      agentType: 'voice'
    }
  ];

  const teacherPersonas: AgentPersona[] = [
    {
      id: 'classCoPilot',
      name: 'Class Co-Pilot',
      icon: <Wand2 size={16} className="text-accent" />,
      description: 'Course design and curriculum development assistant',
      capabilities: ['Course outlines', 'Lesson planning', 'Standards alignment'],
      agentType: 'text'
    },
    {
      id: 'contentCreator',
      name: 'Content Creator',
      icon: <Brain size={16} className="text-accent" />,
      description: 'Multi-modal educational content generation',
      capabilities: ['Content creation', 'Mind maps', 'Interactive materials'],
      agentType: 'text'
    },
    {
      id: 'assessmentBuilder',
      name: 'Assessment Builder',
      icon: <ClipboardCheck size={16} className="text-accent" />,
      description: 'Comprehensive assessment and evaluation tools',
      capabilities: ['Quiz creation', 'Rubrics', 'Performance analysis'],
      agentType: 'text'
    }
  ];

  const adminPersonas: AgentPersona[] = [
    ...teacherPersonas,
    ...studentPersonas,
    {
      id: 'analytics',
      name: 'Analytics Agent',
      icon: <Activity size={16} className="text-accent" />,
      description: 'Platform analytics and insights',
      capabilities: ['Usage analytics', 'Performance insights', 'Trend analysis'],
      agentType: 'text'
    }
  ];

  switch (role) {
    case 'student': return studentPersonas;
    case 'teacher': return teacherPersonas;
    case 'admin': return adminPersonas;
    default: return studentPersonas;
  }
};

// Real-time task visualization component
const TaskProgress: React.FC<{ 
  task: AgentMessage['realTimeUpdates'][0] 
}> = ({ task }) => {
  const getStatusIcon = () => {
    switch (task.status) {
      case 'pending': return <Clock size={14} className="text-yellow-500" />;
      case 'completed': return <CheckCircle size={14} className="text-green-500" />;
      case 'failed': return <AlertCircle size={14} className="text-red-500" />;
    }
  };

  const getStatusColor = () => {
    switch (task.status) {
      case 'pending': return 'bg-yellow-100 border-yellow-200 dark:bg-yellow-900/20 dark:border-yellow-800';
      case 'completed': return 'bg-green-100 border-green-200 dark:bg-green-900/20 dark:border-green-800';
      case 'failed': return 'bg-red-100 border-red-200 dark:bg-red-900/20 dark:border-red-800';
    }
  };

  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.9 }}
      animate={{ opacity: 1, scale: 1 }}
      className={cn(
        "flex items-center gap-2 p-3 rounded-lg border text-sm",
        getStatusColor()
      )}
    >
      {getStatusIcon()}
      <span className="font-medium capitalize">{task.type}</span>
      <span>{task.entity}</span>
      {task.status === 'pending' && (
        <Loader2 size={14} className="animate-spin text-yellow-500" />
      )}
    </motion.div>
  );
};

// Agent activity indicator
const AgentActivity: React.FC<{ 
  isActive: boolean;
  toolsInUse: string[];
}> = ({ isActive, toolsInUse }) => {
  if (!isActive) return null;

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      className="flex items-center gap-2 p-2 bg-accent/10 rounded-lg text-sm"
    >
      <div className="flex items-center gap-2">
        <div className="w-2 h-2 bg-accent rounded-full animate-pulse" />
        <span className="text-accent font-medium">Agent working...</span>
      </div>
      {toolsInUse.length > 0 && (
        <div className="flex gap-1">
          {toolsInUse.map((tool, index) => (
            <Badge key={index} variant="secondary" className="text-xs">
              {tool}
            </Badge>
          ))}
        </div>
      )}
    </motion.div>
  );
};

// Message component with real-time updates
const MessageBubble: React.FC<{ 
  message: AgentMessage;
  onActionClick?: (action: string, data?: any) => void;
}> = ({ message, onActionClick }) => {
  const isUser = message.role === 'user';
  const isSystem = message.role === 'system';

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className={cn(
        "flex gap-3 mb-4",
        isUser && "flex-row-reverse"
      )}
    >
      {/* Avatar */}
      <div className={cn(
        "flex-shrink-0 w-8 h-8 rounded-full flex items-center justify-center",
        isUser 
          ? "bg-accent text-white" 
          : isSystem 
            ? "bg-muted text-muted-foreground"
            : "bg-gradient-to-br from-accent/20 to-secondary/20 text-accent"
      )}>
        {isUser ? <User size={16} /> : <Bot size={16} />}
      </div>

      {/* Message content */}
      <div className={cn(
        "flex-1 max-w-[80%]",
        isUser && "flex flex-col items-end"
      )}>
        {/* Agent name and tools used */}
        {!isUser && !isSystem && (
          <div className="flex items-center gap-2 mb-1">
            <span className="text-sm font-medium text-accent">
              {message.agentName || 'Luna'}
            </span>
            {message.toolsUsed && message.toolsUsed.length > 0 && (
              <div className="flex gap-1">
                {message.toolsUsed.map((tool, index) => (
                  <Badge key={index} variant="outline" className="text-xs">
                    {tool}
                  </Badge>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Message bubble */}
        <div className={cn(
          "rounded-lg p-3 relative",
          isUser 
            ? "bg-accent text-white" 
            : isSystem
              ? "bg-muted/50 text-muted-foreground"
              : "bg-surface border border-divider"
        )}>
          {message.isLoading ? (
            <div className="flex items-center gap-2">
              <Loader2 size={16} className="animate-spin" />
              <span>Agent is processing...</span>
            </div>
          ) : (
            <div className="space-y-3">
              <div className="whitespace-pre-wrap">{message.content}</div>
              
              {/* Real-time updates */}
              {message.realTimeUpdates && message.realTimeUpdates.length > 0 && (
                <div className="space-y-2">
                  <div className="text-sm font-medium text-accent">Live Updates:</div>
                  {message.realTimeUpdates.map((update, index) => (
                    <TaskProgress key={index} task={update} />
                  ))}
                </div>
              )}

              {/* Action buttons */}
              {message.actionButtons && message.actionButtons.length > 0 && (
                <div className="flex flex-wrap gap-2">
                  {message.actionButtons.map((button) => (
                    <Button
                      key={button.id}
                      size="sm"
                      variant={button.variant || 'secondary'}
                      onClick={() => onActionClick?.(button.action, button.data)}
                      className="text-xs"
                    >
                      {button.label}
                    </Button>
                  ))}
                </div>
              )}

              {/* Citations */}
              {message.citations && message.citations.length > 0 && (
                <div className="border-t border-divider pt-2">
                  <div className="text-xs text-muted-foreground mb-1">Sources:</div>
                  <div className="space-y-1">
                    {message.citations.map((citation) => (
                      <div key={citation.id} className="text-xs">
                        <a 
                          href={citation.url} 
                          className="text-accent hover:underline"
                          target="_blank"
                          rel="noopener noreferrer"
                        >
                          {citation.title}
                        </a>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
        
        {/* Timestamp */}
        <div className={cn(
          "text-xs text-muted-foreground mt-1",
          isUser && "text-right"
        )}>
          {message.timestamp.toLocaleTimeString()}
        </div>
      </div>
    </motion.div>
  );
};

// Main Luna Agent Chat Component
export const LunaAgentChat: React.FC<LunaAgentChatProps> = ({ 
  userRole, 
  isMobile = false,
  className 
}) => {
  const [messages, setMessages] = useState<AgentMessage[]>([]);
  const [inputMessage, setInputMessage] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [currentPersona, setCurrentPersona] = useState<AgentPersona>();
  const [isRecording, setIsRecording] = useState(false);
  const [agentActivity, setAgentActivity] = useState<{
    isActive: boolean;
    toolsInUse: string[];
  }>({ isActive: false, toolsInUse: [] });

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const personas = getPersonasForRole(userRole);

  // Set default persona on mount
  useEffect(() => {
    if (personas.length > 0 && !currentPersona) {
      setCurrentPersona(personas[0]);
      
      // Add welcome message
      const welcomeMessage: AgentMessage = {
        id: 'welcome',
        role: 'assistant',
        content: `Hello! I'm ${personas[0].name}. ${personas[0].description}. How can I help you today?`,
        timestamp: new Date(),
        agentName: personas[0].name,
        agentType: personas[0].agentType
      };
      setMessages([welcomeMessage]);
    }
  }, [personas, currentPersona]);

  // Auto-scroll to bottom
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  // Focus input
  useEffect(() => {
    if (!isMobile) {
      inputRef.current?.focus();
    }
  }, [isMobile]);

  const handleSendMessage = useCallback(async (messageContent?: string) => {
    const content = messageContent || inputMessage.trim();
    if (!content || isLoading || !currentPersona) return;

    setInputMessage('');
    setIsLoading(true);
    setAgentActivity({ isActive: true, toolsInUse: ['Processing...'] });

    // Add user message
    const userMessage: AgentMessage = {
      id: `user_${Date.now()}`,
      role: 'user',
      content,
      timestamp: new Date()
    };

    // Add loading message
    const loadingMessage: AgentMessage = {
      id: `loading_${Date.now()}`,
      role: 'assistant',
      content: '',
      timestamp: new Date(),
      agentName: currentPersona.name,
      agentType: currentPersona.agentType,
      isLoading: true
    };

    setMessages(prev => [...prev, userMessage, loadingMessage]);

    try {
      // Call the new Luna agents API
      const response = await fetch('/api/luna/agents/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          message: content,
          agentPersona: currentPersona.id,
          userRole,
          conversationHistory: messages.filter(m => !m.isLoading).slice(-10), // Last 10 messages
          timestamp: new Date().toISOString()
        })
      });

      if (!response.ok) {
        throw new Error(`Failed to send message: ${response.status}`);
      }

      const result = await response.json();

      // Create response message
      const responseMessage: AgentMessage = {
        id: `assistant_${Date.now()}`,
        role: 'assistant',
        content: result.response,
        timestamp: new Date(),
        agentName: currentPersona.name,
        agentType: currentPersona.agentType,
        toolsUsed: result.toolsUsed || [],
        citations: result.citations || [],
        actionButtons: result.actionButtons || [],
        realTimeUpdates: result.realTimeUpdates || []
      };

      // Replace loading message with response
      setMessages(prev => prev.map(msg => 
        msg.id === loadingMessage.id ? responseMessage : msg
      ));

      // Update agent activity with tools used
      if (result.toolsUsed && result.toolsUsed.length > 0) {
        setAgentActivity({ isActive: true, toolsInUse: result.toolsUsed });
        setTimeout(() => {
          setAgentActivity({ isActive: false, toolsInUse: [] });
        }, 3000);
      }

    } catch (error) {
      console.error('Error sending message:', error);
      
      // Replace loading message with error
      setMessages(prev => prev.map(msg => 
        msg.id === loadingMessage.id 
          ? {
              ...msg,
              content: 'I encountered an error processing your request. Please try again.',
              isLoading: false
            }
          : msg
      ));
    } finally {
      setIsLoading(false);
      setAgentActivity({ isActive: false, toolsInUse: [] });
    }
  }, [inputMessage, isLoading, currentPersona, messages, userRole]);

  const handlePersonaChange = useCallback((persona: AgentPersona) => {
    setCurrentPersona(persona);
    
    // Add persona change message
    const changeMessage: AgentMessage = {
      id: `change_${Date.now()}`,
      role: 'system',
      content: `Switched to ${persona.name}. ${persona.description}`,
      timestamp: new Date()
    };
    
    setMessages(prev => [...prev, changeMessage]);
  }, []);

  const handleActionClick = useCallback(async (action: string, data?: any) => {
    // Handle action button clicks
    await handleSendMessage(`[Action: ${action}] ${JSON.stringify(data || {})}`);
  }, [handleSendMessage]);

  const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSendMessage();
    }
  }, [handleSendMessage]);

  const toggleRecording = useCallback(() => {
    if (currentPersona?.agentType === 'voice' || currentPersona?.agentType === 'hybrid') {
      setIsRecording(!isRecording);
      // TODO: Implement voice recording with RealtimeAgent
    }
  }, [isRecording, currentPersona]);

  return (
    <Card className={cn("flex flex-col h-full", className)}>
      {/* Header with persona selector */}
      <CardHeader className="flex-shrink-0 border-b border-divider">
        <div className="flex items-center justify-between">
          <CardTitle className="flex items-center gap-2">
            <Brain className="w-5 h-5 text-accent" />
            <span>Luna Agents</span>
          </CardTitle>
          <Badge variant="outline" className="text-xs">
            {userRole}
          </Badge>
        </div>
        
        {/* Persona Selection */}
        <div className="flex flex-wrap gap-2 mt-3">
          {personas.map((persona) => (
            <Button
              key={persona.id}
              size="sm"
              variant={currentPersona?.id === persona.id ? "default" : "outline"}
              onClick={() => handlePersonaChange(persona)}
              className="flex items-center gap-2 text-xs"
            >
              {persona.icon}
              <span>{persona.name}</span>
              {persona.agentType === 'voice' && (
                <Mic size={12} className="text-muted-foreground" />
              )}
            </Button>
          ))}
        </div>

        {/* Agent Activity Indicator */}
        <AgentActivity 
          isActive={agentActivity.isActive} 
          toolsInUse={agentActivity.toolsInUse} 
        />
      </CardHeader>

      {/* Messages */}
      <CardContent className="flex-1 p-0">
        <ScrollArea className="h-full p-4">
          <AnimatePresence>
            {messages.map((message) => (
              <MessageBubble
                key={message.id}
                message={message}
                onActionClick={handleActionClick}
              />
            ))}
          </AnimatePresence>
          <div ref={messagesEndRef} />
        </ScrollArea>
      </CardContent>

      {/* Input */}
      <div className="flex-shrink-0 border-t border-divider p-4">
        <div className="flex gap-2 items-end">
          {/* Voice button */}
          {(currentPersona?.agentType === 'voice' || currentPersona?.agentType === 'hybrid') && (
            <Button
              size="icon"
              variant="outline"
              onClick={toggleRecording}
              disabled={isLoading}
              className={cn(
                "flex-shrink-0",
                isRecording && "bg-red-500 text-white border-red-500"
              )}
            >
              {isRecording ? <MicOff size={18} /> : <Mic size={18} />}
            </Button>
          )}

          {/* Text input */}
          <div className="flex-1">
            <Input
              ref={inputRef}
              value={inputMessage}
              onChange={(e) => setInputMessage(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder={`Message ${currentPersona?.name || 'Luna'}...`}
              disabled={isLoading}
              className="resize-none"
            />
          </div>

          {/* Send button */}
          <Button
            size="icon"
            onClick={() => handleSendMessage()}
            disabled={!inputMessage.trim() || isLoading}
            className="flex-shrink-0"
          >
            {isLoading ? (
              <Loader2 size={18} className="animate-spin" />
            ) : (
              <Send size={18} />
            )}
          </Button>
        </div>
      </div>
    </Card>
  );
};