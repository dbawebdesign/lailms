"use client";

import { useState, useEffect, useRef, ChangeEvent, KeyboardEvent } from 'react';
import { useLunaContext } from '@/hooks/useLunaContext';
import { useRealTimeUpdates } from '@/hooks/useRealTimeUpdates';
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
  isLoading?: boolean;
  isOutline?: boolean; // Flag to indicate this message contains an outline
  outlineData?: GeneratedCourseOutline; // The actual outline data
  actions?: Array<{ label: string; action: () => void }>; // For buttons like "Save", "Open"
}

interface LunaAIChatProps {
  userRole: UserRole;
}

/**
 * Luna AI Chat component - Updated for Teacher Personas
 */
export function LunaAIChat({ userRole }: LunaAIChatProps) { // Destructure userRole from props
  const router = useRouter();
  const [userMessage, setUserMessage] = useState('');
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isRecording, setIsRecording] = useState(false);
  const [showSuccessNotification, setShowSuccessNotification] = useState(false);
  const [successMessage, setSuccessMessage] = useState('');
  const [aiGeneratedContent, setAiGeneratedContent] = useState<Set<string>>(new Set());
  
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

  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  // Add initial welcome message
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
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []); // Run only once on mount

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
    setMessages(prev => [
      ...prev,
      {
        id: uuidv4(),
        role: 'system', // Use system role for persona change notification
        content: `Switched to ${availablePersonas.find(p => p.id === persona)?.name ?? 'assistant'} mode.`,
        timestamp: new Date(),
      },
      {
        id: uuidv4(),
        role: 'assistant',
        content: getWelcomeMessage(persona),
        timestamp: new Date(),
        persona
      }
    ]);
    messageHistory.current = []; // Clear history on persona change
  };
  
  const handleSendMessage = async () => {
    if (!userMessage.trim() || isLoading || (currentUserRole === 'student' && !isReady)) return; // Student needs context ready
    
    const currentInput = userMessage.trim();
    const userMsg: ChatMessage = { id: uuidv4(), role: 'user', content: currentInput, timestamp: new Date() };
    setMessages(prev => [...prev, userMsg]);
    setUserMessage('');
    setIsLoading(true);
    setError(null);
    
    const tempBotMessageId = uuidv4();
    setMessages(prev => [...prev, { id: tempBotMessageId, role: 'assistant', content: '', timestamp: new Date(), isLoading: true, persona: currentPersona }]);

    try {
      let assistantResponse: ChatMessage;

      // --- All Personas Use Luna Chat API --- 
      messageHistory.current.push({ role: 'user', content: currentInput });
      const response = await fetch('/api/luna/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message: currentInput, context, messages: messageHistory.current, persona: currentPersona }), // Pass persona to backend
      });

      let data;
      try {
        const contentType = response.headers.get('content-type');
        if (contentType && contentType.includes('application/json')) {
          data = await response.json();
        } else {
          const text = await response.text();
          throw new Error(`Received non-JSON response: Status ${response.status}`);
        }
      } catch (parseError) {
        throw new Error(`Failed to parse response: ${parseError instanceof Error ? parseError.message : 'Unknown parse error'}`);
      }

      if (!response.ok) {
        throw new Error(data.error || `API error: ${response.status}`);
      }
      messageHistory.current.push({ role: 'assistant', content: data.response });
      
      assistantResponse = {
        id: uuidv4(),
        role: 'assistant',
        content: data.response,
        timestamp: new Date(),
        persona: currentPersona,
        citations: data.citations || [],
        isOutline: data.isOutline || false,
        outlineData: data.outlineData || undefined,
        // Add action buttons for course outlines
        actions: data.isOutline && data.outlineData ? [
          { 
            label: 'Save as Base Class', 
            action: () => handleSaveOutline(data.outlineData) 
          },
          { 
            label: 'Open in Designer', 
            action: () => handleOpenInDesigner(data.outlineData) 
          }
        ] : undefined
      };

      // Check if Luna performed any actions that need real-time updates
      if (data.hasToolResults && data.citations) {
        // Mark this content as AI-generated for animations
        setAiGeneratedContent(prev => new Set([...prev, assistantResponse.id]));
        
        // Trigger real-time updates based on citations
        data.citations.forEach((citation: Citation) => {
          if (citation.id && citation.title) {
            // Determine entity type and trigger update
            let entityType: 'baseClass' | 'path' | 'lesson' | 'section' = 'section';
            let updateType: 'create' | 'update' | 'delete' = 'create';
            
            if (citation.title.includes('Base Class')) {
              entityType = 'baseClass';
            } else if (citation.title.includes('Path')) {
              entityType = 'path';
            } else if (citation.title.includes('Lesson')) {
              entityType = 'lesson';
            } else if (citation.title.includes('Section')) {
              entityType = 'section';
            }
            
            if (citation.title.includes('Updated')) {
              updateType = 'update';
            } else if (citation.title.includes('Deleted')) {
              updateType = 'delete';
            }
            
            triggerUpdate({
              type: updateType,
              entity: entityType,
              entityId: citation.id,
              data: citation,
              isAIGenerated: true
            });
          }
        });
      }

      // Update messages state with the final assistant response
      setMessages(prev => prev.filter(msg => msg.id !== tempBotMessageId).concat(assistantResponse));

    } catch (err) {
      console.error("Chat Error:", err);
      const message = err instanceof Error ? err.message : "An unknown error occurred";
      setError(`Error: ${message}`);
      setMessages(prev => prev.filter(msg => msg.id !== tempBotMessageId).concat({
        id: uuidv4(), role: 'assistant', content: `Sorry, an error occurred: ${message}`, timestamp: new Date(), persona: currentPersona
      }));
    } finally {
      setIsLoading(false);
    }
  };
  
  const handleKeyDown = (event: KeyboardEvent<HTMLInputElement>) => {
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

  // --- Message Formatting --- 
  const formatMessageContent = (content: string) => {
    // This is a placeholder - ideally use a markdown parser like react-markdown
    return content.split('\n').map((line, i) => (
      <p key={i} className={i > 0 ? 'mt-2' : ''}>
        {line}
      </p>
    ));
  };

  // --- Render --- 
  return (
    <div className="flex flex-col h-full">
      {/* Persona Selector */}
      <div className="flex border-b p-2 bg-muted/10 items-center space-x-2">
        <span className="text-sm font-medium text-muted-foreground whitespace-nowrap">Mode:</span>
        <Select
          value={currentPersona}
          onValueChange={(value: string) => handlePersonaChange(value as PersonaType)}
        >
          <SelectTrigger className="flex-grow h-9 focus:ring-primary">
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
      
      {/* Chat Messages */}
      <div className="flex-grow overflow-hidden">
        <ScrollArea className="h-full px-2 py-3">
          <div className="space-y-4">
            {messages.map((message) => {
              const isAIGenerated = aiGeneratedContent.has(message.id);
              
              return (
                <PremiumAnimation
                  key={message.id}
                  type={isAIGenerated ? 'glow' : 'slideUp'}
                  isAIGenerated={isAIGenerated}
                  className={`flex gap-2 ${message.role === 'user' ? 'justify-end' : message.role === 'system' ? 'justify-center' : 'justify-start'}`}
                >
                  {message.role === 'assistant' && (
                    <div className="h-8 w-8 rounded-full bg-primary flex items-center justify-center text-primary-foreground flex-shrink-0">
                      <Bot size={16} />
                    </div>
                  )}
                  
                  {message.role === 'system' ? (
                    <div className="text-center w-full">
                      <span className="text-xs text-muted-foreground italic px-2 py-1 bg-muted rounded-full">{message.content}</span>
                    </div>
                  ) : (
                  <div 
                      className={`max-w-[85%] rounded-lg p-3 ${ message.role === 'user' ? 'bg-primary text-primary-foreground' : 'bg-muted text-foreground' } ${message.isLoading ? 'opacity-50 pointer-events-none' : ''}`}
                  >
                  <div className="text-sm">
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
                      <div className="mt-3 pt-2 border-t border-muted-foreground/20 flex flex-wrap gap-2">
                        {message.actions.map((action, index) => (
                          <Button key={index} size="sm" variant="outline" onClick={action.action} disabled={isLoading}>
                            {action.label}
                          </Button>
                        ))}
                      </div>
                    )}

                    {/* Citations (Displayed below content/outline and actions) */}
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
                )}
                
                {message.role === 'user' && (
                  <div className="h-8 w-8 rounded-full bg-secondary flex items-center justify-center text-secondary-foreground flex-shrink-0">
                    <User size={16} />
                  </div>
                )}
                </PremiumAnimation>
              );
            })}
            {error && (
              <div className="flex justify-start">
                <div className="p-3 rounded-lg bg-destructive text-destructive-foreground max-w-[80%]">
                  {error}
                </div>
              </div>
            )}
            <div ref={messagesEndRef} />
          </div>
        </ScrollArea>
      </div>
      
      {/* AI Loading Animation */}
      {isLoading && (
        <div className="p-2">
          <AILoadingAnimation message="Luna is working on your request..." />
        </div>
      )}

      {/* Success Notification */}
      <SuccessNotification
        message={successMessage}
        isVisible={showSuccessNotification}
        onClose={() => setShowSuccessNotification(false)}
      />

      {/* Input Area */}
      <div className="p-2 border-t">
        <div className="flex w-full items-center space-x-2">
          <Button
            type="button"
            variant="ghost"
            size="icon"
            className="h-10 w-10 rounded-full flex-shrink-0"
            onClick={toggleRecording}
            disabled={isLoading || !isReady || isRecording}
          >
            {isRecording ? <MicOff size={18} className="text-destructive" /> : <Mic size={18} />}
          </Button>
          
          <Input
            ref={inputRef}
            type="text"
            placeholder={`Ask ${availablePersonas.find(p => p.id === currentPersona)?.name ?? 'Luna'}...`}
            value={userMessage}
            onChange={(e: ChangeEvent<HTMLInputElement>) => setUserMessage(e.target.value)}
            onKeyDown={handleKeyDown}
            disabled={isLoading || (currentUserRole === 'student' && !isReady) || isRecording}
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