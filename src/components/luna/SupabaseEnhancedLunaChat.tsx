"use client";

import React, { useState, useEffect, useRef, useCallback } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { useLunaContext } from '@/hooks/useLunaContext';
import { PersonaType, ChatMessage } from '@/components/LunaAIChat';
import { UserRole } from '@/lib/utils/roleUtils';
import { CourseOutlineMessage } from '@/components/luna/CourseOutlineMessage';
import KBSourceCollectionMessage from '@/components/luna/KBSourceCollectionMessage';
import EnhancedCourseGenerationMessage from '@/components/luna/EnhancedCourseGenerationMessage';
import { createClient } from '@/lib/supabase/client';
import { 
  Menu, Send, Search, Plus, Bot, User, Star, Trash2, Loader2, ArrowLeft,
  MessageSquare, ClipboardCheck, Wand2, Brain, Wrench, BarChart3, Users,
  SlidersHorizontal, CreditCard, ShieldCheck, MoreHorizontal, ExternalLink,
  Paperclip, X, FileText, Link2
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { v4 as uuidv4 } from 'uuid';
import Image from 'next/image';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { 
  generateConversationTitle, 
  shouldGenerateTitle, 
  generateFallbackTitle 
} from '@/lib/utils/conversationTitleGenerator';

interface LunaConversation {
  id: string;
  title: string;
  persona: PersonaType;
  user_id: string;
  created_at: string;
  updated_at: string;
  is_pinned: boolean;
  message_count: number;
}

// Extended ChatMessage interface to support new interactive message types
interface ExtendedChatMessage extends ChatMessage {
  // KB Source Collection properties
  isKBSourceCollection?: boolean;
  kbAnalysis?: any;
  availableModes?: string[];
  recommendedMode?: string;
  
  // Enhanced Course Generation properties
  isEnhancedCourseGeneration?: boolean;
  baseClassId?: string;
  generationConfig?: any;
  
  // Tool execution results
  toolResults?: any[];
}

interface SupabaseEnhancedLunaChatProps {
  userRole: UserRole;
  userId: string;
  isMobile?: boolean;
  className?: string;
}

// Define view modes
type ViewMode = 'sidebar' | 'chat';

// File attachment types
interface AttachedFile {
  file: File;
  id: string;
}

interface AttachedUrl {
  url: string;
  id: string;
}

export const SupabaseEnhancedLunaChat: React.FC<SupabaseEnhancedLunaChatProps> = ({
  userRole,
  userId,
  isMobile = false,
  className,
}) => {
  // View state - Start with sidebar
  const [viewMode, setViewMode] = useState<ViewMode>('sidebar');
  
  // Data state
  const [conversations, setConversations] = useState<LunaConversation[]>([]);
  const [currentConversation, setCurrentConversation] = useState<LunaConversation | null>(null);
  const [messages, setMessages] = useState<ExtendedChatMessage[]>([]);
  const [message, setMessage] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [editingTitle, setEditingTitle] = useState(false);
  const [editTitle, setEditTitle] = useState('');
  const [isCreatingCourse, setIsCreatingCourse] = useState(false);
  
  // File attachment state
  const [attachedFiles, setAttachedFiles] = useState<AttachedFile[]>([]);
  const [attachedUrls, setAttachedUrls] = useState<AttachedUrl[]>([]);
  const [showUrlInput, setShowUrlInput] = useState(false);
  const [urlInput, setUrlInput] = useState('');
  
  // Persona state
  const defaultPersona = (() => {
    switch (userRole) {
      case 'student': return 'lunaChat' as PersonaType;
      case 'teacher': return 'lunaChat' as PersonaType;
      case 'admin': return 'lunaChat' as PersonaType;
      case 'super_admin': return 'lunaChat' as PersonaType;
      default: return 'lunaChat' as PersonaType;
    }
  })();
  const [currentPersona, setCurrentPersona] = useState<PersonaType>(defaultPersona);
  
  // Refs
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const messageHistory = useRef<{ role: 'user' | 'assistant'; content: string }[]>([]);
  const fileInputRef = useRef<HTMLInputElement>(null);
  
  // Hooks
  const { context, isReady } = useLunaContext();
  const supabase = createClient();

  // Define personas for each user role
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
    switch (userRole) {
      case 'student': return studentPersonas;
      case 'teacher': return teacherPersonas;
      case 'admin': return adminPersonas;
      case 'super_admin': return superAdminPersonas;
      default: return studentPersonas;
    }
  })();

  const getWelcomeMessage = (persona: PersonaType): string => {
    switch (persona) {
      // Student Personas
      case 'tutor': return "Hello! I'm Luna, your AI tutor. How can I help?";
      case 'peer': return "Hi there! I'm Luna, your peer learning buddy. What are you working on?";
      case 'examCoach': return "Welcome! I'm Luna, your exam coach. Ready to practice for your exams?";
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

  // Auto-scroll to bottom
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  // Handle component unmount (user navigating away) - trigger title generation
  useEffect(() => {
    return () => {
      // On component unmount, generate title for current conversation if needed
      if (currentConversation && messages.length > 0) {
        // Use a fire-and-forget approach since the component is unmounting
        handleConversationExit(currentConversation, messages).catch(console.error);
      }
    };
  }, []); // Empty dependency array means this effect runs only on mount/unmount

  const loadConversations = useCallback(async () => {
    try {
      console.log('🔍 Loading conversations for user:', userId);
      
      const { data, error } = await supabase
        .from('luna_conversations')
        .select('*')
        .eq('user_id', userId)
        .order('updated_at', { ascending: false });

      if (error) {
        if (error.code === 'PGRST116') {
          console.log('🔍 No conversations found (empty result)');
          setConversations([]);
          return;
        }
        
        if (error.code === '42P01') {
          console.error('❌ Luna conversations table does not exist. Please run the SQL script in Supabase dashboard:', error);
          setError('Luna conversations table not found. Please contact support.');
          return;
        }
        
        console.error('❌ Failed to load conversations:', error);
        return;
      }

      const conversations = data || [];
      setConversations(conversations);
      
      console.log('✅ Loaded conversations:', conversations.length);
    } catch (error) {
      console.error('❌ Failed to load conversations:', error);
    }
  }, [userId, supabase]);

  // Load conversations on mount
  useEffect(() => {
    if (userId) {
      loadConversations();
    }
  }, [userId, loadConversations]);

  // Check database connectivity and auth on mount
  useEffect(() => {
    const checkDatabase = async () => {
      if (!userId) return;
      
      try {
        console.log('🔍 Checking database connectivity and auth...');
        
        // Check current auth session
        const { data: { session }, error: sessionError } = await supabase.auth.getSession();
        console.log('🔐 Auth session check:', {
          hasSession: !!session,
          userId: session?.user?.id,
          expectedUserId: userId,
          sessionError
        });
        
        if (!session || session.user.id !== userId) {
          console.error('❌ Auth session mismatch!', {
            sessionUserId: session?.user?.id,
            expectedUserId: userId
          });
          setError('Authentication session mismatch. Please refresh the page.');
          return;
        }
        
        // Test basic connection with current auth
        const { data: testData, error: testError } = await supabase
          .from('luna_conversations')
          .select('count')
          .limit(1);
          
        if (testError) {
          if (testError.code === '42P01') {
            console.error('❌ Luna tables do not exist.');
            setError('Luna database tables not found. Please run the setup SQL script.');
          } else if (testError.code === 'PGRST301') {
            console.error('❌ RLS blocking access - auth.uid() might be null');
            setError('Authentication issue with database. Please refresh the page.');
          } else {
            console.error('❌ Database connection error:', testError);
            setError('Database connection error. Please check your Supabase configuration.');
          }
        } else {
          console.log('✅ Database connectivity and auth confirmed');
        }
      } catch (error) {
        console.error('❌ Database check failed:', error);
        setError('Failed to connect to database.');
      }
    };
    
    checkDatabase();
  }, [userId, supabase]);

  const loadMessages = async (conversationId: string) => {
    try {
      const { data, error } = await supabase
        .from('luna_messages')
        .select('*')
        .eq('conversation_id', conversationId)
        .order('created_at', { ascending: true });

      if (error) {
        console.error('Failed to load messages:', error);
        return;
      }

      const lunaMessages = data || [];
      const chatMessages: ChatMessage[] = lunaMessages.map(msg => ({
        id: msg.id,
        role: msg.role,
        content: msg.content,
        timestamp: new Date(msg.created_at),
        persona: msg.persona,
        isOutline: msg.is_outline || false,
        outlineData: msg.outline_data || null,
        citations: msg.citations || [],
        actionButtons: msg.action_buttons || [],
      }));

      setMessages(chatMessages);
      messageHistory.current = chatMessages
        .filter(msg => msg.role === 'user' || msg.role === 'assistant')
        .map(msg => ({
          role: msg.role as 'user' | 'assistant',
          content: msg.content
        }));
    } catch (error) {
      console.error('Failed to load messages:', error);
    }
  };

  // Track if a conversation has had its title generated
  const [titleGeneratedConversations, setTitleGeneratedConversations] = useState<Set<string>>(new Set());

  const generateTitle = (firstMessage: string): string => {
    const words = firstMessage.split(' ').slice(0, 4);
    return words.join(' ') + (firstMessage.split(' ').length > 4 ? '...' : '');
  };

  // Generate AI-powered conversation title when a user exits a conversation
  const generateAITitle = async (conversation: LunaConversation, currentMessages: ExtendedChatMessage[]) => {
    // Don't generate if we already have for this conversation or if it already has a custom title
    if (titleGeneratedConversations.has(conversation.id) || 
        (conversation.title !== 'New Conversation' && !conversation.title.endsWith('...'))) {
      return;
    }

    // Only generate if conversation has meaningful content
    if (!shouldGenerateTitle(currentMessages)) {
      return;
    }

    try {
      console.log('🤖 Generating AI title for conversation:', conversation.id);
      
      // Mark as being processed to avoid duplicate requests
      setTitleGeneratedConversations(prev => new Set(prev).add(conversation.id));
      
      const result = await generateConversationTitle(currentMessages, conversation.id);
      
      if (result.wasGenerated && result.title !== conversation.title) {
        // Update conversation title in database
        const { error } = await supabase
          .from('luna_conversations')
          .update({ title: result.title })
          .eq('id', conversation.id);
        
        if (!error) {
          console.log('✅ AI title generated and saved:', result.title);
          // Refresh conversations to show new title
          await loadConversations();
        } else {
          console.error('❌ Failed to save AI-generated title:', error);
          // Remove from processed set so we can try again later
          setTitleGeneratedConversations(prev => {
            const newSet = new Set(prev);
            newSet.delete(conversation.id);
            return newSet;
          });
        }
      }
    } catch (error) {
      console.error('❌ Error generating AI title:', error);
      // Remove from processed set so we can try again later
      setTitleGeneratedConversations(prev => {
        const newSet = new Set(prev);
        newSet.delete(conversation.id);
        return newSet;
      });
    }
  };

  // Handle conversation exit logic (when user switches away from a conversation)
  const handleConversationExit = async (exitingConversation: LunaConversation | null, currentMessages: ExtendedChatMessage[]) => {
    if (!exitingConversation || currentMessages.length === 0) {
      return;
    }

    // Generate AI title for the conversation being exited
    await generateAITitle(exitingConversation, currentMessages);
  };

  // Helper component for title with tooltip
  const TitleWithTooltip = ({ 
    title, 
    className = "", 
    maxLength = 50,
    onClick 
  }: { 
    title: string; 
    className?: string; 
    maxLength?: number;
    onClick?: () => void;
  }) => {
    const shouldShowTooltip = title.length > maxLength;
    
    const titleElement = (
      <div 
        className={cn("truncate min-w-0 max-w-full overflow-hidden text-ellipsis whitespace-nowrap", className)}
        onClick={onClick}
        style={{
          maxWidth: '100%',
          wordBreak: 'break-all'
        }}
      >
        {title}
      </div>
    );

    if (shouldShowTooltip) {
      return (
        <TooltipProvider>
          <Tooltip>
            <TooltipTrigger asChild>
              {titleElement}
            </TooltipTrigger>
            <TooltipContent>
              <p className="max-w-xs break-words">{title}</p>
            </TooltipContent>
          </Tooltip>
        </TooltipProvider>
      );
    }

    return titleElement;
  };

  const createNewConversation = async (persona: PersonaType = currentPersona) => {
    console.log('🆕 Creating new conversation in database...', { persona, userId });
    
    try {
      // Verify auth session
      const { data: sessionData } = await supabase.auth.getSession();
      if (!sessionData.session) {
        console.error('❌ No auth session for conversation creation');
        setError('Please refresh the page and try again');
        return;
      }
      
      const newConversation: LunaConversation = {
        id: uuidv4(),
        title: 'New Conversation',
        persona,
        user_id: userId,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
        is_pinned: false,
        message_count: 0,
      };

      console.log('💾 Inserting conversation into database:', newConversation.id);
      
      // Save to database first
      const { data, error } = await supabase
        .from('luna_conversations')
        .insert(newConversation)
        .select()
        .single();

      if (error) {
        console.error('❌ Failed to create conversation in database:', {
          error,
          code: error.code,
          message: error.message,
          details: error.details,
          hint: error.hint
        });
        setError(`Failed to create conversation: ${error.message}`);
        return;
      }

      if (!data) {
        console.error('❌ Conversation insert succeeded but no data returned');
        setError('Failed to create conversation: No data returned');
        return;
      }

      console.log('✅ Conversation created successfully in database:', data.id);
      
      // Now update local state
      setCurrentConversation(data);
      setCurrentPersona(persona);
      setMessages([]);
      messageHistory.current = [];
      setViewMode('chat');
      
      // Refresh conversations list to show new conversation
      await loadConversations();
      
    } catch (dbError) {
      console.error('❌ Error creating new conversation:', dbError);
      const errorMessage = dbError instanceof Error ? dbError.message : 'Unknown error';
      setError(`Failed to create conversation: ${errorMessage}`);
    }
  };

  const switchConversation = async (conversation: LunaConversation) => {
    // Handle exit of current conversation (generate AI title if needed)
    if (currentConversation && currentConversation.id !== conversation.id) {
      await handleConversationExit(currentConversation, messages);
    }
    
    setCurrentConversation(conversation);
    setCurrentPersona(conversation.persona);
    await loadMessages(conversation.id);
    setViewMode('chat');
  };

  const deleteConversation = async (conversationId: string, e: React.MouseEvent) => {
    e.stopPropagation(); // Prevent switching to the conversation
    
    try {
      // Delete messages first
      await supabase
        .from('luna_messages')
        .delete()
        .eq('conversation_id', conversationId);
      
      // Delete conversation
      await supabase
        .from('luna_conversations')
        .delete()
        .eq('id', conversationId);
      
      // If this was the current conversation, reset
      if (currentConversation?.id === conversationId) {
        setCurrentConversation(null);
        setMessages([]);
        setViewMode('sidebar');
      }
      
      // Reload conversations
      await loadConversations();
    } catch (error) {
      console.error('Failed to delete conversation:', error);
      setError('Failed to delete conversation');
    }
  };

  const handleBackToSidebar = async () => {
    // Handle exit of current conversation (generate AI title if needed)
    if (currentConversation) {
      await handleConversationExit(currentConversation, messages);
    }
    
    setViewMode('sidebar');
  };

  const handlePersonaChange = (persona: PersonaType) => {
    setCurrentPersona(persona);
    if (currentConversation) {
      // Add system message about persona change
      const systemMsg: ChatMessage = {
        id: uuidv4(),
        role: 'system',
        content: `Switched to ${availablePersonas.find(p => p.id === persona)?.name ?? 'assistant'} mode.`,
        timestamp: new Date(),
      };
      
      const welcomeMsg: ChatMessage = {
        id: uuidv4(),
        role: 'assistant',
        content: getWelcomeMessage(persona),
        timestamp: new Date(),
        persona
      };

      setMessages(prev => [...prev, systemMsg, welcomeMsg]);
    }
  };

  // Debug function - can be called from browser console
  const debugAuth = async () => {
    console.log('🐛 Debug: Starting auth and database test...');
    
    try {
      // Check session
      const { data: { session }, error: sessionError } = await supabase.auth.getSession();
      console.log('🔐 Current session:', {
        hasSession: !!session,
        userId: session?.user?.id,
        email: session?.user?.email,
        sessionError
      });
      
      if (!session) {
        console.error('❌ No auth session found');
        return;
      }
      
      // Test conversation insert
      const testConv = {
        id: `test-${Date.now()}`,
        title: 'Debug Test Conversation',
        persona: 'lunaChat' as PersonaType,
        user_id: session.user.id,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
        is_pinned: false,
        message_count: 0
      };
      
      console.log('🧪 Testing conversation insert...');
      const { data: convData, error: convError } = await supabase
        .from('luna_conversations')
        .insert(testConv)
        .select()
        .single();
        
      if (convError) {
        console.error('❌ Conversation insert failed:', convError);
        return;
      }
      
      console.log('✅ Conversation insert succeeded:', convData.id);
      
      // Test message insert
      console.log('🧪 Testing message insert...');
      const { data: msgData, error: msgError } = await supabase
        .from('luna_messages')
        .insert({
          id: `test-msg-${Date.now()}`,
          conversation_id: convData.id,
          role: 'user',
          content: 'Debug test message',
          persona: 'lunaChat',
          created_at: new Date().toISOString()
        })
        .select()
        .single();
        
      if (msgError) {
        console.error('❌ Message insert failed:', msgError);
      } else {
        console.log('✅ Message insert succeeded:', msgData.id);
      }
      
      // Clean up
      await supabase.from('luna_messages').delete().eq('conversation_id', convData.id);
      await supabase.from('luna_conversations').delete().eq('id', convData.id);
      console.log('🧹 Cleanup completed');
      
    } catch (error) {
      console.error('❌ Debug test failed:', error);
    }
  };

  // Expose debug function to window for manual testing
  if (typeof window !== 'undefined') {
    (window as any).debugLunaAuth = debugAuth;
    (window as any).debugLunaDatabase = async () => {
      console.log('🔍 Luna Database Debug Report');
      
      const { data: sessionData } = await supabase.auth.getSession();
      console.log('Auth session:', sessionData?.session?.user?.id);
      
      // Check conversations
      const { data: conversations, error: convError } = await supabase
        .from('luna_conversations')
        .select('*')
        .limit(5);
      
      console.log('Conversations query result:', { conversations, error: convError });
      
      // Check messages
      const { data: messages, error: msgError } = await supabase
        .from('luna_messages')
        .select('*')
        .limit(5);
        
      console.log('Messages query result:', { messages, error: msgError });
      
      // Test insert permission
      try {
        const testConv = {
          id: 'test-conv-' + Date.now(),
          title: 'Test Conversation',
          persona: 'teacher' as PersonaType,
          user_id: sessionData?.session?.user?.id || 'test-user',
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
          is_pinned: false,
          message_count: 0
        };
        
        const { data: testResult, error: testError } = await supabase
          .from('luna_conversations')
          .insert(testConv)
          .select()
          .single();
          
        if (testError) {
          console.log('Test insert failed:', testError);
        } else {
          console.log('Test insert succeeded:', testResult.id);
          // Clean up test conversation
          await supabase.from('luna_conversations').delete().eq('id', testResult.id);
          console.log('Test conversation cleaned up');
        }
      } catch (error) {
        console.log('Test insert error:', error);
      }
    };
    console.log('🛠️ Debug functions available: debugLunaAuth() and debugLunaDatabase() in console');
  }



  const sendDirectResponseToLuna = async (responseText: string) => {
    if (!currentConversation?.id || !responseText.trim()) return;

    try {
      setIsLoading(true);
      setError(null);

      // Add user message to state immediately
      const userMsg: ChatMessage = {
        id: Date.now().toString(),
        role: 'user',
        content: responseText,
        timestamp: new Date(),
        persona: currentPersona,
        isLoading: false
      };

      // Add loading assistant message
      const assistantMsg: ChatMessage = {
        id: (Date.now() + 1).toString(),
        role: 'assistant',
        content: '',
        timestamp: new Date(),
        persona: currentPersona,
        isLoading: true
      };

      const tempMessages = [...messages, userMsg, assistantMsg];
      setMessages(tempMessages);

      // Save user message to database - using exact pattern from handleSendMessage
      if (currentConversation) {
        console.log('💾 Attempting to save action button response message:', {
          conversationId: currentConversation.id,
          messageId: userMsg.id,
          role: 'user',
          persona: currentPersona,
          content: responseText
        });
        
        const messageData = {
          id: userMsg.id,
          conversation_id: currentConversation.id,
          role: 'user' as const,
          content: responseText,
          persona: currentPersona,
          created_at: new Date().toISOString(),
        };
        
        const { data: insertedMessage, error: messageError } = await supabase
          .from('luna_messages')
          .insert(messageData)
          .select()
          .single();
          
        if (messageError) {
          console.error('❌ Message insert failed:', {
            error: messageError,
            code: messageError.code,
            message: messageError.message,
            details: messageError.details,
            hint: messageError.hint
          });
          // Don't throw here, continue with the flow
        } else {
          console.log('✅ Action button response message saved successfully:', insertedMessage?.id);
        }
      }

      // Prepare chat history for Luna API
      const chatHistory = messageHistory.current.slice(-20);
      chatHistory.push({ role: 'user', content: responseText });

      // Call Luna API with correct parameters (matching handleSendMessage)
      const response = await fetch('/api/luna/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          message: responseText,
          persona: currentPersona,
          userRole: userRole,
          context: isReady ? context : undefined,
          history: chatHistory,
          timestamp: new Date().toISOString(),
        })
      });

      if (!response.ok) {
        throw new Error(`Luna API error: ${response.status}`);
      }

      const result = await response.json();
      
      // Update assistant message with response
      const finalAssistantMsg: ChatMessage = {
        ...assistantMsg,
        content: result.response || 'Sorry, I encountered an error.',
        isLoading: false,
        citations: result.citations || [],
        isOutline: result.isOutline || false,
        outlineData: result.outlineData || null,
        actions: result.isOutline ? [
          {
            label: 'Save Outline',
            action: () => console.log('Save outline clicked')
          },
          {
            label: 'Open in Designer',
            action: () => handleOpenInDesigner(result.outlineData)
          }
        ] : []
      };

      const finalMessages = [...messages, userMsg, finalAssistantMsg];
      setMessages(finalMessages);
      messageHistory.current.push({ role: 'assistant', content: finalAssistantMsg.content });

      // Check if Luna made any updates that should trigger UI refresh
      console.log('🔍 Checking for UI updates in Luna response:', {
        content: finalAssistantMsg.content.substring(0, 200) + '...',
        toolsUsed: result.toolsUsed,
        hasUpdated: finalAssistantMsg.content.toLowerCase().includes('updated'),
        hasSuccessfullyUpdated: finalAssistantMsg.content.toLowerCase().includes('successfully updated'),
        hasBeenUpdated: finalAssistantMsg.content.toLowerCase().includes('has been updated')
      });

      const content = finalAssistantMsg.content.toLowerCase();
      const shouldTriggerUpdate = 
        content.includes('updated') || 
        content.includes('successfully updated') ||
        content.includes('has been updated') ||
        content.includes('saved') ||
        content.includes('description has been') ||
        content.includes('description is now') ||
        content.includes('generated') ||
        content.includes('created') ||
        content.includes('modified') ||
        content.includes('changed') ||
        result.toolsUsed;

      if (shouldTriggerUpdate) {
        console.log('🔄 Luna made updates, triggering UI refresh...');
        
        // Intelligent update type detection based on content and tools used
        let updateType = 'content-area'; // default
        
        // Check if specific tools were used first (most reliable)
        if (result.toolsUsed) {
          console.log('🔧 Tools used detected:', result.toolsUsed);
          if (result.toolsUsed.includes('updatePath')) {
            updateType = 'path-description';
            console.log('🎯 Detected updatePath tool -> triggering path-description update');
          } else if (result.toolsUsed.includes('updateBaseClass')) {
            updateType = 'base-class-description';
            console.log('🎯 Detected updateBaseClass tool -> triggering base-class-description update');
          } else if (result.toolsUsed.includes('updateLesson')) {
            updateType = 'lesson-content';
            console.log('🎯 Detected updateLesson tool -> triggering lesson-content update');
          }
        }
        
        // Fallback to content-based detection
        if (updateType === 'content-area') {
          if (content.includes('path description') || content.includes('learning path description') || content.includes('module description')) {
            updateType = 'path-description';
          } else if (content.includes('path title') || content.includes('learning path title') || content.includes('module title')) {
            updateType = 'path-title';
          } else if (content.includes('base class name') || content.includes('class name')) {
            updateType = 'base-class-name';
          } else if (content.includes('base class description') || content.includes('class description')) {
            updateType = 'base-class-description';
          } else if (content.includes('lesson title')) {
            updateType = 'lesson-title';
          } else if (content.includes('lesson description')) {
            updateType = 'lesson-description';
          } else if (content.includes('lesson content') || content.includes('lesson material')) {
            updateType = 'lesson-content';
          } else if (content.includes('course outline') || content.includes('curriculum outline')) {
            updateType = 'course-outline';
          } else if (content.includes('mind map')) {
            updateType = 'mind-map';
          } else if (content.includes('section')) {
            updateType = 'section-content';
          } else if (content.includes('document') || content.includes('knowledge base')) {
            updateType = 'knowledge-base';
          }
        }
        
        console.log('🔄 Triggering UI update with type:', updateType);
        triggerUIUpdate(updateType);
      } else {
        console.log('🔍 No UI update triggers detected in response');
      }

      // Save assistant message to database - using pattern from handleSendMessage
      if (currentConversation) {
        console.log('💾 Saving assistant message to database');
        
        const assistantMessageData = {
          id: finalAssistantMsg.id,
          conversation_id: currentConversation.id,
          role: 'assistant' as const,
          content: finalAssistantMsg.content,
          persona: currentPersona,
          is_outline: finalAssistantMsg.isOutline || false,
          outline_data: finalAssistantMsg.outlineData || null,
          citations: finalAssistantMsg.citations || [],

          created_at: new Date().toISOString(),
        };
        
        const { data: insertedAssistantMsg, error: assistantMsgError } = await supabase
          .from('luna_messages')
          .insert(assistantMessageData)
          .select()
          .single();
          
        if (assistantMsgError) {
          console.error('❌ Failed to save assistant message:', {
            error: assistantMsgError,
            code: assistantMsgError.code,
            message: assistantMsgError.message,
            details: assistantMsgError.details,
            hint: assistantMsgError.hint
          });
          // Don't throw here, continue with local state
        } else {
          console.log('✅ Assistant message saved successfully:', insertedAssistantMsg?.id);
        }
        
        // Update conversation
        const { error: updateError } = await supabase
          .from('luna_conversations')
          .update({ 
            updated_at: new Date().toISOString(),
            message_count: messages.length + 2,
          })
          .eq('id', currentConversation.id);
          
        if (updateError) {
          console.error('❌ Failed to update conversation:', updateError);
        }
      }

    } catch (error: any) {
      console.error('❌ Error sending direct response to Luna:', error);
      setError(error.message || 'Failed to send response');
      
      // Remove loading message on error
      setMessages(prev => prev.filter(msg => !msg.isLoading));
    } finally {
      setIsLoading(false);
    }
  };

  const triggerUIUpdate = (elementType: string, elementId?: string) => {
    console.log('🔄 Triggering UI update for:', elementType, elementId);
    
    // Send custom event to parent components to trigger glow effect and data refresh
    const updateEvent = new CustomEvent('lunaUIUpdate', {
      detail: { 
        elementType, 
        elementId,
        action: 'glow-and-refresh',
        timestamp: Date.now()
      },
      bubbles: true,
      cancelable: true
    });
    
    // Dispatch immediately and also with a small delay to ensure components are ready
    window.dispatchEvent(updateEvent);
    
    setTimeout(() => {
      console.log('🔄 Dispatching delayed UI update event for:', elementType);
      window.dispatchEvent(updateEvent);
    }, 100);
    
    // Also try dispatching to document for broader reach
    setTimeout(() => {
      document.dispatchEvent(updateEvent);
      console.log('🔄 Sent UI update event to both window and document:', { elementType, elementId });
    }, 200);
  };

  const handleOpenInDesigner = async (outlineData: any) => {
    setIsCreatingCourse(true);
    setError(null);
    
    try {
      console.log('🚀 Creating base class from outline:', outlineData);
      
      if (!outlineData) {
        throw new Error('No outline data provided');
      }

      // Prepare the base class creation data
      const baseClassData = {
        name: outlineData.baseClassName || 'New Course',
        description: outlineData.description || '',
        subject: outlineData.subject || '',
        gradeLevel: outlineData.gradeLevel || '',
        lengthInWeeks: outlineData.lengthInWeeks || 12,
        settings: {
          generatedOutline: {
            modules: outlineData.modules || []
          },
          subject: outlineData.subject,
          gradeLevel: outlineData.gradeLevel,
          lengthInWeeks: outlineData.lengthInWeeks
        }
      };

      // Create the base class
      const response = await fetch('/api/teach/base-classes', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(baseClassData)
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to create base class');
      }

      const newBaseClass = await response.json();
      console.log('✅ Base class created successfully:', newBaseClass.id);

      // Add success message to chat
      const successMsg: ChatMessage = {
        id: uuidv4(),
        role: 'assistant',
        content: `✅ Course "${newBaseClass.name}" created successfully! Redirecting to the designer...`,
        timestamp: new Date(),
        persona: currentPersona,
      };
      
      setMessages(prev => [...prev.slice(0, -1), successMsg]);
      
      // Redirect after brief delay
      setTimeout(() => {
        const designerUrl = `/teach/base-classes/${newBaseClass.id}`;
        console.log('🔄 Redirecting to designer:', designerUrl);
        window.location.href = designerUrl;
      }, 2000);
      
    } catch (error) {
      console.error('❌ Failed to create base class:', error);
      const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
      setError(`Failed to create course: ${errorMessage}`);
      setIsCreatingCourse(false);
    }
  };

  // File attachment helper functions
  const detectUrls = (text: string): string[] => {
    const urlRegex = /(https?:\/\/[^\s]+)/g;
    return text.match(urlRegex) || [];
  };

  const handleFileUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
    const files = event.target.files;
    if (!files) return;

    Array.from(files).forEach(file => {
      const id = Math.random().toString(36).substr(2, 9);
      setAttachedFiles(prev => [...prev, { file, id }]);
    });

    // Reset file input
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  const removeFile = (id: string) => {
    setAttachedFiles(prev => prev.filter(f => f.id !== id));
  };

  const removeUrl = (id: string) => {
    setAttachedUrls(prev => prev.filter(u => u.id !== id));
  };

  const addUrl = () => {
    if (!urlInput.trim()) return;
    
    const id = Math.random().toString(36).substr(2, 9);
    setAttachedUrls(prev => [...prev, { url: urlInput.trim(), id }]);
    setUrlInput('');
    setShowUrlInput(false);
  };

  const handleUrlKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      addUrl();
    } else if (e.key === 'Escape') {
      setShowUrlInput(false);
      setUrlInput('');
    }
  };

  const handleSendMessage = async () => {
    if ((!message.trim() && attachedFiles.length === 0 && attachedUrls.length === 0) || isLoading) return;

    // Detect URLs in the message and add them to attachedUrls
    const detectedUrls = detectUrls(message);
    const newUrls = detectedUrls.map(url => ({
      url,
      id: Math.random().toString(36).substr(2, 9)
    }));
    
    // Combine message with attachment info
    let messageToSend = message.trim();
    
    if (attachedFiles.length > 0) {
      messageToSend += '\n\n[Files attached: ' + attachedFiles.map(f => f.file.name).join(', ') + ']';
    }
    
    if (attachedUrls.length > 0 || newUrls.length > 0) {
      const allUrls = [...attachedUrls, ...newUrls];
      messageToSend += '\n\n[URLs: ' + allUrls.map(u => u.url).join(', ') + ']';
    }

    setMessage('');
    setAttachedFiles([]);
    setAttachedUrls([]);
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

    const newMessages = [...messages, userMsg, loadingMsg];
    setMessages(newMessages);
    messageHistory.current.push({ role: 'user', content: messageToSend });

    // Ensure we have a conversation (should exist from "New Chat" button)
    let conversationToUse = currentConversation;
    if (!conversationToUse) {
      console.error('❌ No conversation available - this should not happen if user clicked "New Chat" first');
      setError('Please start a new conversation first');
      setIsLoading(false);
      return;
    }

    try {
      // Save user message to Supabase
      if (conversationToUse) {
        console.log('💾 Attempting to save user message:', {
          conversationId: conversationToUse.id,
          messageId: userMsg.id,
          role: 'user',
          persona: currentPersona,
          conversationExists: !!conversationToUse,
          userId: userId
        });
        
        // Verify conversation exists in database before saving message
        const { data: convCheck, error: convCheckError } = await supabase
          .from('luna_conversations')
          .select('id, user_id')
          .eq('id', conversationToUse.id)
          .single();
          
        if (convCheckError || !convCheck) {
          console.error('❌ Conversation verification failed:', {
            error: convCheckError,
            conversationId: conversationToUse.id,
            exists: !!convCheck
          });
          throw new Error(`Conversation ${conversationToUse.id} does not exist in database`);
        }
        
        console.log('✅ Conversation verified, proceeding with message save');
        
        const messageData = {
          id: userMsg.id,
          conversation_id: conversationToUse.id,
          role: 'user' as const,
          content: messageToSend,
          persona: currentPersona,
          created_at: new Date().toISOString(),
        };
        
        console.log('💾 Inserting message with data:', messageData);
        
        const { data: insertedMessage, error: messageError } = await supabase
          .from('luna_messages')
          .insert(messageData)
          .select()
          .single();
          
        if (messageError) {
          console.error('❌ Message insert failed:', {
            error: messageError,
            code: messageError.code,
            message: messageError.message,
            details: messageError.details,
            hint: messageError.hint
          });
          throw new Error(`Failed to save message: ${messageError.message} (Code: ${messageError.code})`);
        }
        
        if (!insertedMessage) {
          throw new Error('Message insert succeeded but no data returned');
        }
        
        console.log('✅ User message saved successfully:', insertedMessage.id);
      } else {
        console.error('❌ No conversation available for message saving');
        throw new Error('No conversation available to save message');
      }

      // Call Luna API
      console.log('🚀 Sending to Luna API:', {
        message: messageToSend,
        persona: currentPersona,
        historyLength: messageHistory.current.length,
        historyPreview: messageHistory.current.slice(-3),
      });
      
      const response = await fetch('/api/luna/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          message: messageToSend,
          persona: currentPersona,
          userRole: userRole,
          context: isReady ? context : undefined,
          history: messageHistory.current.slice(-20), // Increased history for better context
          timestamp: new Date().toISOString(),
        }),
      });

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const result = await response.json();

      // Check if this is an outline response
      const isOutlineResponse = result.isOutline || (result.outlineData && Object.keys(result.outlineData).length > 0);
      
      // Check for KB source collection response
      const isKBSourceCollectionResponse = result.toolsUsed?.includes('collectKnowledgeBaseSources') || 
                                         (result.kbAnalysis || result.availableModes || result.recommendedMode);
      
      // Check for enhanced course generation response  
      const isEnhancedCourseGenerationResponse = result.toolsUsed?.includes('enhancedCourseGeneration') ||
                                               (result.generationConfig || result.baseClassId);

      const assistantMsg: ExtendedChatMessage = {
        id: uuidv4(),
        role: 'assistant',
        content: result.response || 'Sorry, I encountered an error.',
        timestamp: new Date(),
        persona: currentPersona,
        citations: result.citations,

        isOutline: isOutlineResponse,
        outlineData: result.outlineData,
        // New properties for interactive message types
        isKBSourceCollection: isKBSourceCollectionResponse,
        kbAnalysis: result.kbAnalysis,
        availableModes: result.availableModes,
        recommendedMode: result.recommendedMode,
        isEnhancedCourseGeneration: isEnhancedCourseGenerationResponse,
        baseClassId: result.baseClassId,
        generationConfig: result.generationConfig,
        toolResults: result.toolResults,
        actions: isOutlineResponse ? [
          { 
            label: 'Save Outline', 
            action: async () => {
              try {
                console.log('💾 Saving outline to drafts...');
                // TODO: Implement save outline to drafts functionality
                console.log('Outline saved to drafts');
              } catch (error) {
                console.error('Failed to save outline:', error);
              }
            }
          },
          { 
            label: 'Open in Designer', 
            action: async () => {
              try {
                await handleOpenInDesigner(result.outlineData);
              } catch (error) {
                console.error('Failed to open in designer:', error);
              }
            }
          }
        ] : undefined
      };

      // Save assistant message to Supabase
      if (conversationToUse) {
        console.log('💾 Saving assistant message to database');
        
        const assistantMessageData = {
          id: assistantMsg.id,
          conversation_id: conversationToUse.id,
          role: 'assistant' as const,
          content: assistantMsg.content,
          persona: currentPersona,
          is_outline: assistantMsg.isOutline || false,
          outline_data: assistantMsg.outlineData || null,
          citations: assistantMsg.citations || [],

          created_at: new Date().toISOString(),
        };
        
        const { data: insertedAssistantMsg, error: assistantMsgError } = await supabase
          .from('luna_messages')
          .insert(assistantMessageData)
          .select()
          .single();
          
        if (assistantMsgError) {
          console.error('❌ Failed to save assistant message:', {
            error: assistantMsgError,
            code: assistantMsgError.code,
            message: assistantMsgError.message,
            details: assistantMsgError.details,
            hint: assistantMsgError.hint
          });
          // Don't throw here, continue with local state
        } else {
          console.log('✅ Assistant message saved successfully:', insertedAssistantMsg?.id);
        }
      }

      const finalMessages = [...messages, userMsg, assistantMsg];
      setMessages(finalMessages);
      messageHistory.current.push({ role: 'assistant', content: assistantMsg.content });

      // Enhanced update detection with better logging
      const content = assistantMsg.content.toLowerCase();
      console.log('🔍 Checking for UI updates in response:', {
        content: content.substring(0, 200) + '...',
        hasUpdated: content.includes('updated'),
        hasSaved: content.includes('saved'),
        hasDescriptionBeen: content.includes('description has been'),
        hasGenerated: content.includes('generated'),
        hasToolsUsed: !!result.toolsUsed,
        toolsUsed: result.toolsUsed
      });

      const updateTriggers = [
        content.includes('updated'),
        content.includes('saved'),
        content.includes('description has been'),
        content.includes('description is now'),
        content.includes('generated'),
        content.includes('created'),
        content.includes('modified'),
        content.includes('changed'),
        !!result.toolsUsed
      ];

      if (updateTriggers.some(trigger => trigger)) {
        console.log('🔄 Luna made updates, triggering UI refresh...');
        
        // Enhanced update type detection
        let updateType = 'content-area'; // default
        
        // Check for module/path descriptions (common in base class studio)
        if (content.includes('module description') || 
            content.includes('path description') || 
            content.includes('learning path description') ||
            content.includes('description') && content.includes('module')) {
          updateType = 'path-description';
          console.log('🎯 Detected path/module description update');
        } else if (content.includes('module title') ||
                   content.includes('path title') || 
                   content.includes('learning path title') ||
                   content.includes('title') && content.includes('module')) {
          updateType = 'path-title';
          console.log('🎯 Detected path/module title update');
        } else if (content.includes('base class name') || content.includes('class name')) {
          updateType = 'base-class-name';
          console.log('🎯 Detected base class name update');
        } else if (content.includes('base class description') || content.includes('class description')) {
          updateType = 'base-class-description';
          console.log('🎯 Detected base class description update');
        } else if (content.includes('lesson title')) {
          updateType = 'lesson-title';
          console.log('🎯 Detected lesson title update');
        } else if (content.includes('lesson description')) {
          updateType = 'lesson-description';
          console.log('🎯 Detected lesson description update');
        } else if (content.includes('lesson content') || content.includes('lesson material')) {
          updateType = 'lesson-content';
          console.log('🎯 Detected lesson content update');
        } else if (content.includes('course outline') || content.includes('curriculum outline')) {
          updateType = 'course-outline';
          console.log('🎯 Detected course outline update');
        } else if (content.includes('mind map')) {
          updateType = 'mind-map';
          console.log('🎯 Detected mind map update');
        } else if (content.includes('section')) {
          updateType = 'section-content';
          console.log('🎯 Detected section content update');
        } else if (content.includes('document') || content.includes('knowledge base')) {
          updateType = 'knowledge-base';
          console.log('🎯 Detected knowledge base update');
        } else {
          console.log('🎯 Using default content-area update type');
        }
        
        console.log('🚀 Triggering UI update with type:', updateType);
        triggerUIUpdate(updateType);
      } else {
        console.log('❌ No update triggers detected, skipping UI update');
      }

      // Update conversation
      if (conversationToUse) {
        const newTitle = conversationToUse.title === 'New Conversation' ? generateTitle(messageToSend) : conversationToUse.title;
        
        try {
          await supabase
            .from('luna_conversations')
            .update({ 
              title: newTitle,
              updated_at: new Date().toISOString(),
              message_count: finalMessages.length,
            })
            .eq('id', conversationToUse.id);
          
          // Update local conversation object
          setCurrentConversation(prev => prev ? {
            ...prev,
            title: newTitle,
            updated_at: new Date().toISOString(),
            message_count: finalMessages.length,
          } : null);
        } catch (dbError) {
          console.log('DB not available for conversation update');
        }
      }

      // Refresh conversations list
      await loadConversations();

    } catch (error) {
      console.error('Failed to send message:', error);
      const errorMessage = error instanceof Error ? error.message : 'Failed to send message. Please try again.';
      setError(errorMessage);
      setMessages(prev => prev.slice(0, -1));
      messageHistory.current.pop();
    } finally {
      setIsLoading(false);
    }
  };

  const filteredConversations = conversations.filter(conv => {
    if (!searchQuery) return true;
    return conv.title.toLowerCase().includes(searchQuery.toLowerCase());
  });

  // Sidebar View
  const renderSidebar = () => (
    <div className="flex flex-col h-full w-full max-w-full overflow-hidden">
      <div className="p-4 border-b flex-shrink-0">
        <div className="flex items-center gap-2 mb-3 min-w-0">
          <Image 
            src="/web-app-manifest-512x512.png" 
            alt="Luna" 
            width={20} 
            height={20} 
            className="rounded-full flex-shrink-0"
          />
          <h2 className="font-semibold truncate">Luna Conversations</h2>
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

      <ScrollArea className="flex-1 w-full max-w-full overflow-hidden">
        <div className="p-2 space-y-1" style={{ width: '320px', maxWidth: '320px', overflow: 'hidden' }}>
          {filteredConversations.map((conversation) => (
            <div
              key={conversation.id}
              className="cursor-pointer transition-colors hover:bg-muted/50 rounded-lg px-3 py-2 group"
              onClick={() => switchConversation(conversation)}
              style={{ 
                width: '296px', // 320px - 16px (p-2) - 8px (margin)
                maxWidth: '296px',
                minWidth: '296px',
                overflow: 'hidden',
                boxSizing: 'border-box'
              }}
            >
              <div 
                className="flex items-center gap-2"
                style={{ 
                  width: '272px', // 296px - 24px (px-3 padding)
                  maxWidth: '272px',
                  minWidth: 0,
                  overflow: 'hidden'
                }}
              >
                <div 
                  className="flex-1 overflow-hidden"
                  style={{ 
                    minWidth: 0,
                    maxWidth: '220px', // 272px - 50px (actions) - 2px (gap)
                    overflow: 'hidden'
                  }}
                >
                  <div 
                    className="font-medium text-sm leading-tight"
                    style={{
                      overflow: 'hidden',
                      textOverflow: 'ellipsis',
                      whiteSpace: 'nowrap',
                      maxWidth: '220px',
                      width: '220px'
                    }}
                    title={conversation.title}
                  >
                    {conversation.title}
                  </div>
                </div>
                <div 
                  className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity flex-shrink-0"
                  style={{ 
                    width: '50px', 
                    maxWidth: '50px',
                    minWidth: '50px',
                    justifyContent: 'flex-end',
                    overflow: 'hidden'
                  }}
                >
                  {conversation.is_pinned && <Star size={12} className="text-yellow-500 flex-shrink-0" />}
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-6 w-6 p-0 hover:bg-muted-foreground/20 flex-shrink-0"
                        onClick={(e) => e.stopPropagation()}
                      >
                        <MoreHorizontal size={12} />
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end" className="w-40">
                      <DropdownMenuLabel className="text-xs">Options</DropdownMenuLabel>
                      <DropdownMenuItem 
                        onClick={(e) => deleteConversation(conversation.id, e)}
                        className="text-destructive focus:text-destructive text-xs"
                      >
                        <Trash2 size={12} className="mr-2" />
                        Delete
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                </div>
              </div>
            </div>
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

  // Chat View
  const renderChat = () => (
    <div className="flex flex-col h-full w-full min-w-0">
      {/* Fixed Header Section */}
      <div className="flex-shrink-0 bg-background border-b">
        {/* Header */}
        <div className="flex items-center justify-between p-3 border-b bg-muted/5">
          <div className="flex items-center gap-2 min-w-0 flex-1">
            <Button
              variant="ghost"
              size="sm"
              onClick={handleBackToSidebar}
              className="h-8 w-8 p-0 flex-shrink-0"
            >
              <ArrowLeft size={14} />
            </Button>
            
            <div className="flex items-center gap-2 min-w-0 flex-1">
              <Image 
                src="/web-app-manifest-512x512.png" 
                alt="Luna" 
                width={20} 
                height={20} 
                className="rounded-full"
              />
              <div className="min-w-0 flex-1">
                {editingTitle ? (
                  <Input
                    value={editTitle}
                    onChange={(e) => setEditTitle(e.target.value)}
                    onBlur={async () => {
                      if (editTitle.trim() && editTitle !== currentConversation?.title) {
                        // Update conversation title
                        if (currentConversation) {
                          try {
                            await supabase
                              .from('luna_conversations')
                              .update({ title: editTitle.trim() })
                              .eq('id', currentConversation.id);
                            
                            setCurrentConversation(prev => prev ? { ...prev, title: editTitle.trim() } : null);
                            await loadConversations();
                          } catch (error) {
                            console.error('Failed to update title:', error);
                          }
                        }
                      }
                      setEditingTitle(false);
                    }}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') {
                        e.currentTarget.blur();
                      } else if (e.key === 'Escape') {
                        setEditingTitle(false);
                        setEditTitle(currentConversation?.title || '');
                      }
                    }}
                    className="h-6 text-sm font-medium p-1"
                    autoFocus
                  />
                ) : (
                  <div className="text-sm font-medium cursor-pointer hover:bg-muted/50 rounded px-1 py-0.5 min-w-0 flex-1">
                    <TitleWithTooltip 
                      title={currentConversation?.title || 'New Conversation'}
                      maxLength={40}
                      onClick={() => {
                        setEditingTitle(true);
                        setEditTitle(currentConversation?.title || '');
                      }}
                    />
                  </div>
                )}
                <p className="text-xs text-muted-foreground truncate">
                  {availablePersonas.find(p => p.id === currentPersona)?.name}
                </p>
              </div>
            </div>
          </div>
        </div>

        {/* Persona Selector */}
        <div className="flex bg-muted/10 items-center space-x-2 flex-shrink-0 px-3 py-2">
          <span className="text-xs font-medium text-muted-foreground whitespace-nowrap">Mode:</span>
          <Select
            value={currentPersona}
            onValueChange={(value: string) => handlePersonaChange(value as PersonaType)}
          >
            <SelectTrigger className="flex-grow focus:ring-primary h-8 text-sm">
              <SelectValue placeholder="Select a mode">
                <div className="flex items-center gap-1.5">
                  {availablePersonas.find(p => p.id === currentPersona)?.icon}
                  <span className="text-sm">{availablePersonas.find(p => p.id === currentPersona)?.name}</span>
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
      </div>

      {/* Messages */}
      <div className="flex-1 min-h-0">
        <ScrollArea className="h-full">
          <div className="px-3 pt-3 pb-3 space-y-3">
          {messages.length === 0 && (
            <div className="text-center text-muted-foreground py-8">
              <Image 
                src="/web-app-manifest-512x512.png" 
                alt="Luna" 
                width={48} 
                height={48} 
                className="mx-auto mb-4 opacity-50"
              />
              <p>Start a conversation with {availablePersonas.find(p => p.id === currentPersona)?.name}!</p>
            </div>
          )}
          
          {messages.map((msg) => (
            <div
              key={msg.id}
              className={cn(
                "flex gap-3 animate-in slide-in-from-bottom-2 w-full",
                msg.role === 'user' ? 'justify-end' : msg.role === 'system' ? 'justify-center' : 'justify-start'
              )}
            >
              {msg.role === 'assistant' && (
                <div className="w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0">
                  <Image 
                    src="/web-app-manifest-512x512.png" 
                    alt="Luna" 
                    width={20} 
                    height={20} 
                    className="rounded-full"
                  />
                </div>
              )}
              
              {msg.role === 'system' ? (
                <div className="text-center w-full">
                  <span className="text-xs text-muted-foreground italic px-2 py-1 bg-muted rounded-full">{msg.content}</span>
                </div>
              ) : (
                <div
                  className={cn(
                    "max-w-[80%] rounded-lg px-3 py-2 min-w-0 break-words",
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
                    <div className="break-words">
                      {msg.isKBSourceCollection ? (
                        <div>
                          <div className="whitespace-pre-wrap break-words overflow-wrap-anywhere mb-4">{msg.content}</div>
                          <KBSourceCollectionMessage
                            baseClassId={msg.baseClassId || 'unknown'}
                            onSourcesCollected={(sources: any) => {
                              console.log('KB sources collected:', sources);
                              sendDirectResponseToLuna(`I've collected ${sources.documents?.length || 0} documents and ${sources.urls?.length || 0} URLs. Please proceed with enhanced course generation.`);
                            }}
                            onSkipSources={() => {
                              console.log('KB source collection skipped');
                              sendDirectResponseToLuna('I\'ve chosen to skip knowledge base sources and proceed with general course generation.');
                            }}
                          />
                        </div>
                      ) : msg.isEnhancedCourseGeneration ? (
                        <div>
                          <div className="whitespace-pre-wrap break-words overflow-wrap-anywhere mb-4">{msg.content}</div>
                          <EnhancedCourseGenerationMessage
                            baseClassId={msg.baseClassId || 'unknown'}
                            generationModes={msg.generationConfig?.modes}
                            recommendedMode={msg.recommendedMode}
                            onGenerateCourse={(params: any) => {
                              console.log('Enhanced course generation params:', params);
                              sendDirectResponseToLuna(`I've configured the enhanced course generation with title: "${params.title}", mode: ${params.generationMode}, duration: ${params.estimatedDurationWeeks} weeks.`);
                            }}
                          />
                        </div>
                      ) : msg.isOutline && msg.outlineData ? (
                        <CourseOutlineMessage 
                          outline={msg.outlineData}
                          onSaveAndContinue={async (outline) => {
                            try {
                              console.log('💾 Saving course outline and continuing to studio...', outline);
                              
                              // Create base class from outline
                              const response = await fetch('/api/teach/base-classes/create-from-outline', {
                                method: 'POST',
                                headers: {
                                  'Content-Type': 'application/json',
                                },
                                body: JSON.stringify({
                                  outline,
                                  title: outline.baseClassName || 'New Course',
                                  description: outline.description || '',
                                  subject: outline.subject || '',
                                  gradeLevel: outline.gradeLevel || '',
                                  lengthInWeeks: outline.lengthInWeeks || 12
                                })
                              });
                              
                              if (!response.ok) {
                                throw new Error('Failed to create base class');
                              }
                              
                              const result = await response.json();
                              console.log('✅ Base class created:', result);
                              
                              // Redirect to studio
                              const studioUrl = `/teach/base-classes/${result.baseClassId}/studio`;
                              window.open(studioUrl, '_blank');
                              
                              // Add success message to chat
                              const successMsg: ExtendedChatMessage = {
                                id: uuidv4(),
                                role: 'assistant',
                                content: `✅ Course "${outline.baseClassName}" has been created successfully! I've opened the Base Class Studio in a new tab where you can use the "Create All Lesson Content" button to generate the full course content including lessons, assessments, quizzes, and exams.`,
                                timestamp: new Date(),
                                persona: currentPersona
                              };
                              
                              setMessages(prev => [...prev, successMsg]);
                              
                            } catch (error) {
                              console.error('❌ Error saving course outline:', error);
                              // Add error message to chat
                              const errorMsg: ExtendedChatMessage = {
                                id: uuidv4(),
                                role: 'assistant',
                                content: `❌ Sorry, there was an error creating the course. Please try again or contact support if the issue persists.`,
                                timestamp: new Date(),
                                persona: currentPersona
                              };
                              
                              setMessages(prev => [...prev, errorMsg]);
                            }
                          }}
                          onSaveAsDraft={async (outline) => {
                            try {
                              console.log('💾 Saving course outline as draft...', outline);
                              
                              // Save as draft (you might want to implement a drafts API)
                              const response = await fetch('/api/teach/base-classes/save-draft', {
                                method: 'POST',
                                headers: {
                                  'Content-Type': 'application/json',
                                },
                                body: JSON.stringify({
                                  outline,
                                  title: outline.baseClassName || 'Draft Course',
                                  description: outline.description || '',
                                  isDraft: true
                                })
                              });
                              
                              if (!response.ok) {
                                throw new Error('Failed to save draft');
                              }
                              
                              const result = await response.json();
                              console.log('✅ Draft saved:', result);
                              
                              // Add success message to chat
                              const successMsg: ExtendedChatMessage = {
                                id: uuidv4(),
                                role: 'assistant',
                                content: `✅ Course outline "${outline.baseClassName}" has been saved as a draft. You can find it in your base classes list and continue working on it later.`,
                                timestamp: new Date(),
                                persona: currentPersona
                              };
                              
                              setMessages(prev => [...prev, successMsg]);
                              
                            } catch (error) {
                              console.error('❌ Error saving draft:', error);
                              // Add error message to chat
                              const errorMsg: ExtendedChatMessage = {
                                id: uuidv4(),
                                role: 'assistant',
                                content: `❌ Sorry, there was an error saving the draft. Please try again or contact support if the issue persists.`,
                                timestamp: new Date(),
                                persona: currentPersona
                              };
                              
                              setMessages(prev => [...prev, errorMsg]);
                            }
                          }}
                        />
                      ) : (
                        <div className="whitespace-pre-wrap break-words overflow-wrap-anywhere">{msg.content}</div>
                      )}
                    </div>
                  )}

                  {/* Action Buttons (like Save Outline, Open in Designer) */}
                  {msg.actions && msg.actions.length > 0 && (
                    <div className="mt-3 pt-2 border-t border-muted-foreground/20 flex flex-wrap gap-2">
                      {msg.actions.map((action, index) => {
                        const isOpenInDesigner = action.label === 'Open in Designer';
                        const isDisabled = isLoading || isCreatingCourse;
                        
                        return (
                          <Button 
                            key={index} 
                            size="sm"
                            variant={isOpenInDesigner ? "default" : "outline"}
                            onClick={action.action} 
                            disabled={isDisabled}
                            className="text-xs px-3 py-1.5 min-w-[100px] flex items-center gap-1.5"
                          >
                            {isCreatingCourse && isOpenInDesigner ? (
                              <>
                                <Loader2 size={12} className="animate-spin" />
                                Creating...
                              </>
                            ) : (
                              action.label
                            )}
                          </Button>
                        );
                      })}
                    </div>
                  )}



                  {/* Citations */}
                  {msg.citations && msg.citations.length > 0 && (
                    <div className="mt-2 pt-2 border-t border-muted-foreground/20 text-xs min-w-0 overflow-hidden">
                      <p className="font-semibold mb-1 break-words text-wrap">Sources:</p>
                      <div className="flex flex-wrap gap-1 max-w-full">
                        {msg.citations.map((citation: any) => (
                          <Badge 
                            key={citation.id} 
                            variant="outline"
                            className="flex items-center gap-1 break-words max-w-full min-w-0 overflow-hidden text-xs"
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
      </div>

      {/* Input */}
      <div className="p-3 border-t flex-shrink-0">
        {error && (
          <div className="mb-3 p-2 bg-destructive/10 text-destructive text-sm rounded break-words">
            {error}
          </div>
        )}
        
        {/* File and URL attachments display */}
        {(attachedFiles.length > 0 || attachedUrls.length > 0) && (
          <div className="mb-3 flex flex-wrap gap-2">
            {attachedFiles.map((file) => (
              <Badge key={file.id} variant="secondary" className="flex items-center gap-1">
                <FileText size={12} />
                <span className="max-w-[100px] truncate">{file.file.name}</span>
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-4 w-4 p-0 hover:bg-destructive hover:text-destructive-foreground"
                  onClick={() => removeFile(file.id)}
                >
                  <X size={10} />
                </Button>
              </Badge>
            ))}
            {attachedUrls.map((urlItem) => (
              <Badge key={urlItem.id} variant="secondary" className="flex items-center gap-1">
                <Link2 size={12} />
                <span className="max-w-[120px] truncate">{urlItem.url}</span>
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-4 w-4 p-0 hover:bg-destructive hover:text-destructive-foreground"
                  onClick={() => removeUrl(urlItem.id)}
                >
                  <X size={10} />
                </Button>
              </Badge>
            ))}
          </div>
        )}
        
        {/* URL input field */}
        {showUrlInput && (
          <div className="mb-3">
            <Input
              value={urlInput}
              onChange={(e) => setUrlInput(e.target.value)}
              onKeyDown={handleUrlKeyPress}
              placeholder="Enter URL and press Enter..."
              className="text-sm"
              autoFocus
            />
          </div>
        )}
        
        {/* Hidden file input */}
        <input
          ref={fileInputRef}
          type="file"
          accept=".pdf,.doc,.docx,.txt,.md"
          multiple
          onChange={handleFileUpload}
          className="hidden"
        />
        
        <div className="flex gap-2 w-full min-w-0">
          {/* File upload button */}
          <Button
            variant="ghost"
            size="icon"
            onClick={() => fileInputRef.current?.click()}
            disabled={isLoading}
            className="flex-shrink-0"
            title="Attach files"
          >
            <Paperclip size={16} />
          </Button>
          
          {/* URL button */}
          <Button
            variant="ghost"
            size="icon"
            onClick={() => setShowUrlInput(!showUrlInput)}
            disabled={isLoading}
            className="flex-shrink-0"
            title="Add URL"
          >
            <Link2 size={16} />
          </Button>
          
          <Input
            value={message}
            onChange={(e) => setMessage(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                handleSendMessage();
              }
            }}
            placeholder={`Ask ${availablePersonas.find(p => p.id === currentPersona)?.name}... (attach files or paste URLs)`}
            disabled={isLoading}
            className="flex-1 min-w-0"
          />
          <Button 
            onClick={handleSendMessage} 
            disabled={(!message.trim() && attachedFiles.length === 0 && attachedUrls.length === 0) || isLoading}
            size="icon"
            className="flex-shrink-0"
          >
            {isLoading ? <Loader2 size={16} className="animate-spin" /> : <Send size={16} />}
          </Button>
        </div>
      </div>
    </div>
  );

  return (
    <div className={cn("flex h-full w-full", className)}>
      {viewMode === 'sidebar' ? renderSidebar() : renderChat()}
    </div>
  );
}; 