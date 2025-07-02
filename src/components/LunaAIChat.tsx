"use client";

import { useState, useEffect, useRef, type ChangeEvent, type KeyboardEvent } from 'react';
import { useLunaContext } from '@/hooks/useLunaContext';
import { useRealTimeUpdates } from '@/hooks/useRealTimeUpdates';
import { useChatPersistence } from '@/hooks/useChatPersistence';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Badge } from '@/components/ui/badge';
import { PremiumAnimation, AILoadingAnimation, SuccessNotification } from '@/components/ui/premium-animations';
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select";
import { 
    Loader2, Bot, User, ExternalLink, Mic, MicOff, Wand2, Brain, MessageSquare, // Teacher & Student common
    ClipboardCheck, // Student: Exam Coach
    Wrench, BarChart3, Users, // Admin icons
    SlidersHorizontal, CreditCard, ShieldCheck, // Super Admin icons
} from 'lucide-react';
import { v4 as uuidv4 } from 'uuid';
import { useRouter } from 'next/navigation';
import { CourseOutlineMessage } from '@/components/luna/CourseOutlineMessage';
import type { UserRole } from "@/config/navConfig"; // Import UserRole for the prop

// Define a structure for the course outline from the API
interface CourseOutlineModule {
  title: string;
  topics: string[];
  suggestedLessons?: { title: string; objective?: string }[];
  suggestedAssessments?: { type: string; description?: string }[];
}

interface GeneratedCourseOutline {
  baseClassName?: string;
  description?: string;
  subject?: string;
  gradeLevel?: string;
  lengthInWeeks?: number;
  modules: CourseOutlineModule[];
}

// Updated Persona types to include teacher roles
export type StudentPersonaType = 'tutor' | 'peer' | 'examCoach';
export type TeacherPersonaType = 'lunaChat' | 'classCoPilot' | 'teachingCoach';
export type AdminPersonaType = 'adminSupport' | 'dataAnalyst' | 'userManager';
export type SuperAdminPersonaType = 'platformAdmin' | 'billingSupport' | 'technicalSupport';
export type PersonaType = StudentPersonaType | TeacherPersonaType | AdminPersonaType | SuperAdminPersonaType;

// Message interface might need updates for different message types (e.g., outline)
export interface Citation {
  id: string;
  title: string;
  url?: string;
}

export interface ChatMessage {
  id: string;
  role: 'user' | 'assistant' | 'system'; // Added system role
  content: string;
  timestamp: Date;
  persona?: PersonaType; // Track which persona generated the message
  // Specific data payloads for different message types
  citations?: Citation[];
  actionButtons?: Array<{ id: string; label: string; action: string; data: Record<string, any>; style: string }>; // For action buttons

  isLoading?: boolean;
  isOutline?: boolean; // Flag to indicate this message contains an outline
  outlineData?: GeneratedCourseOutline; // The actual outline data
  actions?: Array<{ label: string; action: () => void }>; // For buttons like "Save", "Open"
}

interface LunaAIChatProps {
  userRole: UserRole;
  isMobile?: boolean; // Optional prop to control mobile behavior
}

/**
 * Luna AI Chat component - Updated for Teacher Personas
 */
export function LunaAIChat({ userRole, isMobile = false }: LunaAIChatProps) { // Destructure both props
  const router = useRouter();
  const [userMessage, setUserMessage] = useState('');
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isRecording, setIsRecording] = useState(false);
  const [showSuccessNotification, setShowSuccessNotification] = useState(false);
  const [successMessage, setSuccessMessage] = useState('');
  const [aiGeneratedContent, setAiGeneratedContent] = useState<Set<string>>(new Set());
  const [viewportHeight, setViewportHeight] = useState('100vh');
  
  // Use the passed userRole prop to set the initial currentUserRole state
  const [currentUserRole, setCurrentUserRole] = useState<UserRole>(userRole);
  
  const defaultPersona = (() => {
    switch (currentUserRole) {
      case 'student': return 'lunaChat' as PersonaType;
      case 'teacher': return 'lunaChat' as PersonaType;
      case 'admin': return 'lunaChat' as PersonaType;
      case 'super_admin': return 'lunaChat' as PersonaType;
      default: return 'lunaChat' as PersonaType;
    }
  })();
  const [currentPersona, setCurrentPersona] = useState<PersonaType>(defaultPersona);
  
  const messageHistory = useRef<{ role: 'user' | 'assistant'; content: string }[]>([]);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const { context, isReady } = useLunaContext();

  // Track viewport height changes for mobile keyboard handling
  useEffect(() => {
    if (!isMobile) return;

    const updateViewportHeight = () => {
      // Use visual viewport if available for accurate keyboard detection
      if (window.visualViewport) {
        const height = window.visualViewport.height;
        setViewportHeight(`${height}px`);
        
        // Update CSS custom property for other components
        const vh = height * 0.01;
        document.documentElement.style.setProperty('--vh', `${vh}px`);
      } else {
        // Fallback to window.innerHeight
        const height = window.innerHeight;
        setViewportHeight(`${height}px`);
        
        const vh = height * 0.01;
        document.documentElement.style.setProperty('--vh', `${vh}px`);
      }
    };

    // Initial setup
    updateViewportHeight();

    // Listen for viewport changes (keyboard open/close)
    if (window.visualViewport) {
      window.visualViewport.addEventListener('resize', updateViewportHeight);
      window.visualViewport.addEventListener('scroll', updateViewportHeight);
      
      return () => {
        window.visualViewport?.removeEventListener('resize', updateViewportHeight);
        window.visualViewport?.removeEventListener('scroll', updateViewportHeight);
      };
    } else {
      // Fallback for browsers without visual viewport API
      window.addEventListener('resize', updateViewportHeight);
      window.addEventListener('orientationchange', updateViewportHeight);
      
      return () => {
        window.removeEventListener('resize', updateViewportHeight);
        window.removeEventListener('orientationchange', updateViewportHeight);
      };
    }
  }, [isMobile]);

  // Chat persistence hook
  const { loadChatHistory, saveChatHistory, clearChatHistory, isLoaded } = useChatPersistence();

  // Real-time updates hook
  const { triggerUpdate } = useRealTimeUpdates({
    onUpdate: (event) => {
      console.log('Real-time update received:', event);
      if (event.isAIGenerated) {
        setSuccessMessage(`${event.type === 'create' ? 'Created' : 'Updated'} ${event.entity} successfully!`);
        setShowSuccessNotification(true);
        setTimeout(() => setShowSuccessNotification(false), 3000);
      }
    },
    enableAnimations: true,
    onRefreshNeeded: (entity, entityId) => {
      // Trigger page refresh or component re-render
      console.log(`Refresh needed for ${entity}: ${entityId}`);
      // You can add specific refresh logic here based on the current page
      if (typeof window !== 'undefined') {
        // Broadcast refresh event to other components
        window.dispatchEvent(new CustomEvent('lunaContentUpdate', {
          detail: { entity, entityId }
        }));
      }
    }
  });

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  // Auto-save messages whenever they change (but not on initial load)
  useEffect(() => {
    if (isLoaded && messages.length > 0) {
      // Don't save if we're just loading persisted messages
      const isInitialLoad = messages.length === 1 && messages[0].id === 'welcome';
      if (!isInitialLoad) {
        saveChatHistory(messages, currentPersona);
      }
    }
  }, [messages, currentPersona, saveChatHistory, isLoaded]);

  useEffect(() => {
    // Auto-focus the input field when the component mounts, but prevent scroll
    inputRef.current?.focus({ preventScroll: true });
  }, []); // Empty dependency array ensures this runs only once on mount

  // Listen for logout events to clear chat history
  useEffect(() => {
    const handleLogout = () => {
      clearChatHistory();
      setMessages([]);
      messageHistory.current = [];
    };

    // Listen for custom logout events
    window.addEventListener('user-logout', handleLogout);
    
    return () => {
      window.removeEventListener('user-logout', handleLogout);
    };
  }, [clearChatHistory]);

  // Load persisted chat history and add welcome message if needed
  useEffect(() => {
    if (isLoaded && messages.length === 0) {
      const { messages: persistedMessages, persona: persistedPersona } = loadChatHistory();
      
      if (persistedMessages.length > 0) {
        // Load persisted messages
        setMessages(persistedMessages);
        
        // Update persona if it was persisted and different from default
        if (persistedPersona && persistedPersona !== currentPersona) {
          setCurrentPersona(persistedPersona);
        }
        
        // Rebuild message history for API calls
        messageHistory.current = persistedMessages
          .filter(msg => msg.role === 'user' || msg.role === 'assistant')
          .map(msg => ({ role: msg.role as 'user' | 'assistant', content: msg.content }));
      } else {
        // No persisted messages, add welcome message
        const welcomeMessage: ChatMessage = {
          id: 'welcome',
          role: 'assistant',
          content: getWelcomeMessage(currentPersona),
          timestamp: new Date(),
          persona: currentPersona
        };
        setMessages([welcomeMessage]);
      }
    }
  }, [isLoaded, loadChatHistory, currentPersona, messages.length]); // Added dependencies

  useEffect(() => {
    // When userRole prop changes (e.g., if AppShell re-renders with a different role for some reason),
    // update the internal state and reset persona and messages.
    if (userRole && userRole !== currentUserRole) {
      setCurrentUserRole(userRole);
      // Recalculate default persona based on new role
      const newDefaultPersona = (() => {
        switch (userRole) {
          case 'student': return 'lunaChat' as PersonaType;
          case 'teacher': return 'lunaChat' as PersonaType;
          case 'admin': return 'lunaChat' as PersonaType;
          case 'super_admin': return 'lunaChat' as PersonaType;
          default: return 'lunaChat' as PersonaType;
        }
      })();
      setCurrentPersona(newDefaultPersona);
      setMessages([
        {
          id: 'welcome-reset',
          role: 'assistant',
          content: getWelcomeMessage(newDefaultPersona),
          timestamp: new Date(),
          persona: newDefaultPersona
        }
      ]);
      messageHistory.current = [];
    }
  }, [userRole, currentUserRole]); // Add currentUserRole to dependencies to avoid stale closure issues if needed

  // Define Personas Data (including teacher ones)
  const studentPersonas = [
    { id: 'lunaChat', name: 'Luna Chat', icon: <MessageSquare size={14} /> },
    { id: 'tutor', name: 'Tutor', icon: <Bot size={14} /> },
    { id: 'peer', name: 'Peer Buddy', icon: <User size={14} /> },
    { id: 'examCoach', name: 'Exam Coach', icon: <ClipboardCheck size={14} /> }
  ];
  const teacherPersonas = [
    { id: 'lunaChat', name: 'Luna Chat', icon: <MessageSquare size={14} /> },
    { id: 'classCoPilot', name: 'Class Co-Pilot', icon: <Wand2 size={14} /> },
    { id: 'teachingCoach', name: 'Teaching Coach', icon: <Brain size={14} /> }
  ];
  const adminPersonas = [
    { id: 'lunaChat', name: 'Luna Chat', icon: <MessageSquare size={14} /> },
    { id: 'adminSupport', name: 'Support Assistant', icon: <Wrench size={14} /> },
    { id: 'dataAnalyst', name: 'Data Analyst', icon: <BarChart3 size={14} /> },
    { id: 'userManager', name: 'User Manager', icon: <Users size={14} /> }
  ];
  const superAdminPersonas = [
    { id: 'lunaChat', name: 'Luna Chat', icon: <MessageSquare size={14} /> },
    { id: 'platformAdmin', name: 'Platform Admin', icon: <SlidersHorizontal size={14} /> },
    { id: 'billingSupport', name: 'Billing Support', icon: <CreditCard size={14} /> },
    { id: 'technicalSupport', name: 'Technical Support', icon: <ShieldCheck size={14} /> }
  ];

  const availablePersonas = (() => {
    switch (currentUserRole) {
      case 'student': return studentPersonas;
      case 'teacher': return teacherPersonas;
      case 'admin': return adminPersonas;
      case 'super_admin': return superAdminPersonas;
      default: return studentPersonas; // Fallback to student personas
    }
  })();

  const getWelcomeMessage = (persona: PersonaType): string => {
    switch (persona) {
      // Student Personas
      case 'tutor': return "Hello! I'm Luna, your AI tutor. How can I help?";
      case 'peer': return "Hi there! I'm Luna, your peer learning buddy. What are you working on?";
      case 'examCoach': return "Welcome! I'm Luna, your exam coach. Ready to practice for your exams?"; // Slightly updated
      // Teacher Personas
      case 'lunaChat': return "Hello! I'm Luna, your general AI assistant. How can I help you today?";
      case 'classCoPilot': return "Hello! I'm the Class Co-Pilot. Describe the course you want to design, and I'll help generate an outline.";
      case 'teachingCoach': return "Hi! As your Teaching Coach, I can help with teaching methods, differentiation, and lesson planning. What challenge can we tackle?";
      // Admin Personas
      case 'adminSupport': return "Hello! As your Admin Support assistant, I can help with platform features and troubleshooting. What do you need assistance with?";
      case 'dataAnalyst': return "Hi! I'm your Data Analyst assistant. Ask me about school analytics, user engagement, or course performance.";
      case 'userManager': return "Welcome! I can assist with user management, role assignments, and other user-related tasks. How can I help?";
      // Super Admin Personas
      case 'platformAdmin': return "Hello! As the Platform Admin assistant, I can help with global settings, institution management, and system configurations.";
      case 'billingSupport': return "Hi! I'm your Billing Support assistant. Ask me about subscriptions, usage reports, or billing queries.";
      case 'technicalSupport': return "Welcome! For advanced troubleshooting, system health checks, or integration support, I'm here to help.";
      default: return "Hello! I'm Luna. How can I assist?";
    }
  };

  const handlePersonaChange = (persona: PersonaType) => {
    setCurrentPersona(persona);
    const newMessages = [
      ...messages,
      {
        id: uuidv4(),
        role: 'system' as const, // Use system role for persona change notification
        content: `Switched to ${availablePersonas.find(p => p.id === persona)?.name ?? 'assistant'} mode.`,
        timestamp: new Date(),
      },
      {
        id: uuidv4(),
        role: 'assistant' as const,
        content: getWelcomeMessage(persona),
        timestamp: new Date(),
        persona
      }
    ];
    setMessages(newMessages);
    messageHistory.current = []; // Clear history on persona change
    
    // Save the updated messages with new persona
    saveChatHistory(newMessages, persona);
  };
  
  const handleSendMessage = async (overrideMessage?: string, overrideButtonData?: any) => {
    if (isLoading) return;
    
    const messageToSend = overrideMessage || userMessage.trim();
    if (!messageToSend) return;

    // Check readiness for students
    if (currentUserRole === 'student' && !isReady) {
      setError('Luna is still initializing. Please wait a moment...');
      return;
    }

    setError(null);
    setUserMessage('');
    setIsLoading(true);
    
    const userMsgId = uuidv4();
    const assistantMsgId = uuidv4();
    
    // Create user message
    const userMsg: ChatMessage = {
      id: userMsgId,
      role: 'user',
      content: messageToSend,
      timestamp: new Date(),
      persona: currentPersona
    };

    // Create loading assistant message
    const loadingMsg: ChatMessage = {
      id: assistantMsgId,
      role: 'assistant',
      content: '',
      timestamp: new Date(),
      isLoading: true,
      persona: currentPersona
    };

    // Update UI immediately
    setMessages(prev => [...prev, userMsg, loadingMsg]);
    messageHistory.current.push({ role: 'user', content: messageToSend });
    
    // Blur input on mobile to hide keyboard after sending
    if (isMobile && inputRef.current) {
      inputRef.current.blur();
    }

    try {
      const response = await fetch('/api/luna/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          message: messageToSend,
          persona: currentPersona,
          userRole: currentUserRole,
          history: messageHistory.current,
          context,
          buttonData: overrideButtonData,
          timestamp: new Date().toISOString()
        }),
      });

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`Failed to send message: ${response.status} ${errorText}`);
      }

      const result = await response.json();
      console.log('[LunaAIChat] Response received:', result);

      // Update message history
      messageHistory.current.push({ role: 'assistant', content: result.response });

      // Check if this is an outline
      const isOutlineResponse = result.isOutline || (result.outlineData && Object.keys(result.outlineData).length > 0);

      // Prepare the final assistant message
      const finalAssistantMsg: ChatMessage = {
        id: assistantMsgId,
        role: 'assistant',
        content: result.response,
        timestamp: new Date(),
        citations: result.citations,
        persona: currentPersona,
        isLoading: false,
        isOutline: isOutlineResponse,
        outlineData: result.outlineData,
        actions: isOutlineResponse ? [
          { label: 'Save Outline', action: () => handleSaveOutline(result.outlineData) },
          { label: 'Open in Designer', action: () => handleOpenInDesigner(result.outlineData) }
        ] : undefined
      };

      // Update messages to replace loading message
      setMessages(prev => prev.map(msg => 
        msg.id === assistantMsgId ? finalAssistantMsg : msg
      ));

      // Mark content as AI generated if flagged
      if (result.isAIGenerated) {
        setAiGeneratedContent(prev => new Set([...prev, assistantMsgId]));
        
        // Trigger real-time update
        if (result.entity && result.entityId) {
          triggerUpdate({
            type: result.action || 'update',
            entity: result.entity,
            entityId: result.entityId,
            isAIGenerated: true
          });
        }
      }

    } catch (error: any) {
      console.error('[LunaAIChat] Error:', error);
      setError(error.message || 'An error occurred while sending your message.');
      
      // Remove the loading message on error
      setMessages(prev => prev.filter(msg => msg.id !== assistantMsgId));
      
      // Remove the user message from history on error
      messageHistory.current.pop();
    } finally {
      setIsLoading(false);
      
      // Re-focus input on mobile after a short delay to ensure smooth UX
      if (isMobile && inputRef.current) {
        setTimeout(() => {
          inputRef.current?.focus();
        }, 150); // Slightly longer delay for better mobile UX
      }
    }
  };
  
  const handleKeyDown = (event: React.KeyboardEvent<HTMLInputElement>) => {
    if (event.key === 'Enter' && !isLoading) {
      handleSendMessage();
    }
  };

  // --- Action Handlers for Class Co-Pilot --- 

  const handleSaveOutline = async (outline: GeneratedCourseOutline | undefined) => {
    if (!outline) return null;
    console.log("Attempting to save outline:", outline);
    setIsLoading(true); // Show loading state for the save action
    let newBaseClassId: string | null = null;
    try {
      const baseClassData = {
        name: outline.baseClassName || "Untitled Generated Course",
        description: outline.description,
        subject: outline.subject,
        gradeLevel: outline.gradeLevel,
        lengthInWeeks: outline.lengthInWeeks || 10,
        // Store the full outline in settings for retrieval by the designer
        settings: { 
          generatedOutline: {
            modules: outline.modules,
            // Include any other outline-specific data we want to preserve
            // that isn't already covered in the base fields
          } 
        }
      };

      const response = await fetch('/api/teach/base-classes', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(baseClassData),
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({ error: 'Failed to parse error response' }));
        
        if (response.status === 401) {
          throw new Error('Authentication required. Please log in and try again.');
        } else if (response.status === 403) {
          throw new Error('You do not have permission to create courses. Please contact your administrator.');
        } else {
          throw new Error(errorData.error || `Server error (${response.status}): Failed to save base class`);
        }
      }
      
      const newBaseClass = await response.json();
      newBaseClassId = newBaseClass.id;
      
      // Add confirmation message to chat
      setMessages(prev => [...prev, {
        id: uuidv4(),
        role: 'system',
        content: `✅ Outline saved as Base Class: "${newBaseClass.name}" (ID: ${newBaseClassId}). You can now open it in the designer.`, 
        timestamp: new Date()
      }]);

    } catch (error: any) {
      console.error("Error saving base class:", error);
      setMessages(prev => [...prev, {
        id: uuidv4(),
        role: 'system', // Use system role for error
        content: `❌ Error saving outline: ${error.message}`,
        timestamp: new Date()
      }]);
      throw error; // Re-throw to allow the calling function to handle it
    } finally {
      setIsLoading(false);
    }
    return newBaseClassId; // Return ID for potential immediate navigation
  };

  const handleOpenInDesigner = async (outline: GeneratedCourseOutline | undefined) => {
    if (!outline) return;
    console.log("Attempting to open outline in designer:", outline);
    
    // Save the outline first, then navigate with ID
    setMessages(prev => [...prev, {
      id: uuidv4(),
      role: 'system',
      content: `Saving the outline before opening in the designer...`,
      timestamp: new Date()
    }]);
    
    try {
      const savedId = await handleSaveOutline(outline);
      
      if (savedId) {
        // Add confirmation message to chat
        setMessages(prev => [...prev, {
          id: uuidv4(),
          role: 'system',
          content: `✅ Successfully saved and opening in designer...`,
          timestamp: new Date()
        }]);
        
        // Add query parameter to ensure compatibility with both route patterns
        router.push(`/teach/base-classes/${savedId}?id=${savedId}`);
      } else {
        // Handle case where saving succeeded but no ID was returned
        setMessages(prev => [...prev, {
          id: uuidv4(),
          role: 'system',
          content: `⚠️ The outline was saved but couldn't be opened in the designer. Try accessing it from the Course Designer page.`,
          timestamp: new Date()
        }]);
      }
    } catch (error: any) {
      // Handle specific error cases
      setMessages(prev => [...prev, {
        id: uuidv4(),
        role: 'system',
        content: `❌ Error: ${error.message || 'Failed to save the outline. Please try again or check your authentication status.'}`,
        timestamp: new Date()
      }]);
    }
  };

  // --- Voice Recording Placeholder --- 
  const toggleRecording = () => {
    // Voice recording functionality would go here
    setIsRecording(!isRecording);
    // Add voice recording logic
    // Once audio is captured, append it to the user message
    // For now, just toggle the state
  };

  // Handle action button clicks


  // --- Message Formatting --- 
  const formatMessageContent = (content: string) => {
    // This is a placeholder - ideally use a markdown parser like react-markdown
    return content.split('\n').map((line, i) => (
      <p key={i} className={`${i > 0 ? 'mt-2' : ''} break-words text-wrap overflow-wrap-anywhere word-break-break-all max-w-full`}>
        {line}
      </p>
    ));
  };

  // --- Render --- 
  return (
    <div className={`flex flex-col ${isMobile ? 'h-full' : 'h-full'}`} 
         style={isMobile ? { 
           height: viewportHeight, 
           position: 'relative',
           overflow: 'hidden'
         } : {}}>
      {/* Persona Selector */}
      <div className={`flex border-b bg-muted/10 items-center space-x-2 flex-shrink-0 ${isMobile ? 'p-3' : 'p-2'}`}>
        <span className="text-sm font-medium text-muted-foreground whitespace-nowrap">Mode:</span>
        <Select
          value={currentPersona}
          onValueChange={(value: string) => handlePersonaChange(value as PersonaType)}
        >
          <SelectTrigger className={`flex-grow focus:ring-primary ${isMobile ? 'h-10' : 'h-9'}`}>
            <SelectValue placeholder="Select a mode">
              <div className="flex items-center gap-2">
                {availablePersonas.find(p => p.id === currentPersona)?.icon}
                <span>{availablePersonas.find(p => p.id === currentPersona)?.name}</span>
              </div>
            </SelectValue>
          </SelectTrigger>
          <SelectContent>
            {availablePersonas.map((persona) => (
              <SelectItem key={persona.id} value={persona.id}>
                <div className="flex items-center gap-2">
                  {persona.icon}
                  <span>{persona.name}</span>
                </div>
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
      
      {/* Chat Messages - Takes remaining space above input */}
      <div 
        className={`flex-1 min-h-0 ${isMobile ? '' : ''}`}
        style={isMobile ? { 
          height: `calc(${viewportHeight} - 120px)`, // Account for persona selector + input
          overflow: 'hidden',
          paddingBottom: '80px' // Space for fixed input
        } : {}}
      >
        <ScrollArea className={`h-full ${isMobile ? 'overscroll-contain px-3 py-4 no-bounce-scroll' : 'px-2 py-3'}`}>
          <div className={`${isMobile ? 'space-y-3 pb-4' : 'space-y-4'}`}>
            {messages.map((message) => {
              const isAIGenerated = aiGeneratedContent.has(message.id);
              
              return (
                <PremiumAnimation
                  key={message.id}
                  type={isAIGenerated ? 'glow' : 'slideUp'}
                  isAIGenerated={isAIGenerated}
                  className={`flex ${isMobile ? 'gap-2' : 'gap-2'} ${message.role === 'user' ? 'justify-end' : message.role === 'system' ? 'justify-center' : 'justify-start'}`}
                >
                  {message.role === 'assistant' && (
                    <div className={`rounded-full bg-primary flex items-center justify-center text-primary-foreground flex-shrink-0 ${isMobile ? 'h-8 w-8' : 'h-8 w-8'}`}>
                      <Bot size={16} />
                    </div>
                  )}
                  
                  {message.role === 'system' ? (
                    <div className="text-center w-full">
                      <span className="text-xs text-muted-foreground italic px-2 py-1 bg-muted rounded-full">{message.content}</span>
                    </div>
                  ) : (
                  <div 
                      className={`min-w-0 rounded-lg overflow-hidden ${ 
                        message.role === 'user' 
                          ? 'bg-primary text-primary-foreground rounded-br-sm' 
                          : 'bg-muted text-foreground rounded-bl-sm'
                      } ${message.isLoading ? 'opacity-50 pointer-events-none' : ''} ${
                        isMobile 
                          ? 'max-w-[85%] p-3 text-sm' 
                          : 'max-w-[92%] p-3 text-sm'
                      }`}
                  >
                  <div className="min-w-0 overflow-hidden break-words">
                      {message.isLoading ? (
                        <div className="flex space-x-1.5">
                          <div className="h-2 w-2 rounded-full bg-current animate-bounce"></div>
                          <div className="h-2 w-2 rounded-full bg-current animate-bounce delay-150"></div>
                          <div className="h-2 w-2 rounded-full bg-current animate-bounce delay-300"></div>
                        </div>
                      ) : (
                        message.isOutline && message.outlineData ? (
                            <CourseOutlineMessage outline={message.outlineData} />
                        ) : (
                            formatMessageContent(message.content)
                        )
                      )}
                  </div>
                  

                  
                    {/* Render Action Buttons (Displayed below content/outline) */}
                    {message.actions && message.actions.length > 0 && (
                      <div className="mt-3 pt-2 border-t border-muted-foreground/20 flex flex-wrap gap-2 w-full max-w-full overflow-hidden">
                        {message.actions.map((action, index) => (
                          <Button 
                            key={index} 
                            size={isMobile ? "default" : "sm"}
                            variant="outline" 
                            onClick={action.action} 
                            disabled={isLoading} 
                            className={`break-words text-wrap max-w-full ${isMobile ? 'text-sm px-3 py-2' : 'text-xs px-2 py-1'}`}
                          >
                            <span className="break-words text-wrap">{action.label}</span>
                          </Button>
                        ))}
                      </div>
                    )}

                    {/* Citations (Displayed below content/outline and actions) */}
                  {message.citations && message.citations.length > 0 && (
                    <div className="mt-2 pt-2 border-t border-muted-foreground/20 text-xs min-w-0 overflow-hidden">
                      <p className="font-semibold mb-1 break-words text-wrap">Sources:</p>
                      <div className="flex flex-wrap gap-1 max-w-full">
                        {message.citations.map((citation) => (
                          <Badge 
                            key={citation.id} 
                            variant="outline"
                            className={`flex items-center gap-1 break-words max-w-full min-w-0 overflow-hidden ${isMobile ? 'text-xs' : 'text-xs'}`}
                          >
                            <span className="break-words text-wrap truncate min-w-0 max-w-full">{citation.title}</span>
                            {citation.url && (
                              <a 
                                href={citation.url} 
                                target="_blank" 
                                rel="noopener noreferrer"
                                className="inline-flex flex-shrink-0 ml-1"
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
                )}
                
                {message.role === 'user' && (
                  <div className={`rounded-full bg-secondary flex items-center justify-center text-secondary-foreground flex-shrink-0 ${isMobile ? 'h-8 w-8' : 'h-8 w-8'}`}>
                    <User size={16} />
                  </div>
                )}
                </PremiumAnimation>
              );
            })}
            {error && (
              <div className="flex justify-start">
                <div className={`p-3 rounded-lg bg-destructive text-destructive-foreground ${isMobile ? 'max-w-[85%]' : 'max-w-[92%]'}`}>
                  {error}
                </div>
              </div>
            )}
            <div ref={messagesEndRef} className={isMobile ? 'h-4' : 'h-2'} />
          </div>
        </ScrollArea>
      </div>
      
      {/* AI Loading Animation */}
      {isLoading && (
        <div className={isMobile ? 'p-3' : 'p-2'}>
          <AILoadingAnimation message="Luna is working on your request..." />
        </div>
      )}

      {/* Success Notification */}
      <SuccessNotification
        message={successMessage}
        isVisible={showSuccessNotification}
        onClose={() => setShowSuccessNotification(false)}
      />

      {/* Input Area - Fixed at bottom like ChatGPT */}
      <div 
        className={`border-t bg-background flex-shrink-0 ${
          isMobile 
            ? 'mobile-chat-input p-4' 
            : 'p-2'
        }`}
        style={isMobile ? {} : {}}
      >
        <div className={`flex w-full items-end ${isMobile ? 'gap-3' : 'space-x-2'}`}>
          <Button
            type="button"
            variant="ghost"
            size="icon"
            className={`rounded-full flex-shrink-0 ${isMobile ? 'h-12 w-12' : 'h-10 w-10'}`}
            onClick={toggleRecording}
            disabled={isLoading || !isReady || isRecording}
          >
            {isRecording ? (
              <MicOff size={isMobile ? 20 : 18} className="text-destructive" />
            ) : (
              <Mic size={isMobile ? 20 : 18} />
            )}
          </Button>
          
          <div className="flex-1 relative">
            <Input
              ref={inputRef}
              type="text"
              placeholder={`Ask ${availablePersonas.find(p => p.id === currentPersona)?.name ?? 'Luna'}...`}
              value={userMessage}
              onChange={(e: React.ChangeEvent<HTMLInputElement>) => setUserMessage(e.target.value)}
              onKeyDown={handleKeyDown}
              disabled={isLoading || (currentUserRole === 'student' && !isReady) || isRecording}
              className={`focus-visible:ring-primary pr-12 no-zoom-input ${
                isMobile 
                  ? 'h-12 text-base rounded-xl border-2' 
                  : 'h-10 flex-grow'
              }`}
              autoComplete="off"
              autoCorrect="off"
              autoCapitalize="sentences"
            />
            
            <Button 
              onClick={() => handleSendMessage()} 
              disabled={isLoading || !isReady || !userMessage.trim() || isRecording}
              className={`absolute right-1 top-1/2 transform -translate-y-1/2 rounded-full flex-shrink-0 p-0 ${
                isMobile ? 'h-10 w-10' : 'h-8 w-8'
              } ${!userMessage.trim() ? 'bg-muted-foreground/50' : ''}`}
            >
              {isLoading ? (
                <Loader2 className={`animate-spin ${isMobile ? 'h-5 w-5' : 'h-4 w-4'}`} />
              ) : (
                <svg 
                  xmlns="http://www.w3.org/2000/svg" 
                  viewBox="0 0 24 24" 
                  width={isMobile ? "20" : "18"} 
                  height={isMobile ? "20" : "18"} 
                  fill="none" 
                  stroke="currentColor" 
                  strokeWidth="2" 
                  strokeLinecap="round" 
                  strokeLinejoin="round"
                >
                  <line x1="22" y1="2" x2="11" y2="13"></line>
                  <polygon points="22 2 15 22 11 13 2 9 22 2"></polygon>
                </svg>
              )}
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
} 