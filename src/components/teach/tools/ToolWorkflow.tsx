'use client';

import React, { useState, useEffect, useRef } from 'react';
import { useSearchParams } from 'next/navigation';
import { TeachingTool, ToolInputField } from '@/types/teachingTools';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Checkbox } from '@/components/ui/checkbox';
import { Slider } from '@/components/ui/slider';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { ScrollArea } from '@/components/ui/scroll-area';
import { 
  ArrowLeft, 
  Wand2, 
  Download, 
  Copy, 
  Check, 
  Loader2, 
  Lightbulb,
  MessageSquare,
  FileText,
  Image,
  AlertCircle,
  Sparkles,
  Send,
  RotateCcw,
  Save,
  BookOpen,
  Heart
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { useUIContext } from '@/context/UIContext';
import { RubricDisplay } from './RubricDisplay';
import { MindMapDisplay } from './MindMapDisplay';
import { BrainBytesDisplay } from './BrainBytesDisplay';
import { QuizDisplay } from './QuizDisplay';
import { ActivitiesDisplay } from './ActivitiesDisplay';
import { teacherToolLibraryService } from '@/lib/services/teacherToolLibrary';
import { 
  TeacherToolCreationInput, 
  ToolCreationContent, 
  RubricContent, 
  MindMapContent,
  TeacherToolCreation,
  BrainBytesContent
} from '@/types/teachingTools';
import { useRouter } from 'next/navigation';

interface ToolWorkflowProps {
  tool: TeachingTool;
  onBack: () => void;
}

interface FormData {
  [key: string]: any;
}

interface GenerationResult {
  content: string;
  format: string;
  metadata?: {
    wordCount?: number;
    estimatedTime?: string;
    difficulty?: string;
  };
}

interface BrainBytesResult {
  script: string;
  cleanScript: string;
  audioUrl: string;
  fileName: string;
  duration: number;
  title: string;
  metadata: {
    topic: string;
    gradeLevel: string;
    duration: number;
    generatedAt: string;
    wordCount: number;
    scriptLength: number;
    voice: string;
  };
}

interface ConversationMessage {
  role: 'user' | 'assistant';
  content: string;
  timestamp: Date;
}

export function ToolWorkflow({ tool, onBack }: ToolWorkflowProps) {
  const searchParams = useSearchParams();
  const router = useRouter();
  const editId = searchParams.get('edit');
  
  // All hooks must be called before any conditional returns
  const [activeTab, setActiveTab] = useState<'manual' | 'ai-assisted'>('ai-assisted');
  const [formData, setFormData] = useState<FormData>({});
  const [aiPrompt, setAiPrompt] = useState('');
  const [isGenerating, setIsGenerating] = useState(false);
  const [result, setResult] = useState<GenerationResult | null>(null);
  const [brainBytesResult, setBrainBytesResult] = useState<BrainBytesResult | null>(null);
  const [error, setError] = useState<string>('');
  const [copiedItems, setCopiedItems] = useState<Set<string>>(new Set());
  const [conversation, setConversation] = useState<ConversationMessage[]>([]);
  const [isInConversation, setIsInConversation] = useState(false);
  const [refinementMode, setRefinementMode] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState(false);
  const [loadedCreation, setLoadedCreation] = useState<TeacherToolCreation | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [updatedMindMapData, setUpdatedMindMapData] = useState<any>(null); // Track updated mind map data
  const { togglePanelVisible } = useUIContext();
  const resultRef = useRef<HTMLDivElement>(null);
  const conversationEndRef = useRef<HTMLDivElement>(null);

  // Initialize form data with default values
  useEffect(() => {
    const initialData: FormData = {};
    tool.inputFields.forEach(field => {
      if (field.defaultValue !== undefined) {
        initialData[field.id] = field.defaultValue;
      } else if (field.type === 'multiselect') {
        initialData[field.id] = [];
      } else if (field.type === 'range') {
        initialData[field.id] = field.min || 1;
      }
    });
    
    setFormData(initialData);
  }, [tool]);

  // Auto-scroll conversation to bottom
  useEffect(() => {
    if (isInConversation) {
      conversationEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }
  }, [conversation, isInConversation]);

  // If editId is present, redirect to the viewer instead of showing editor
  useEffect(() => {
    if (editId) {
      router.push(`/teach/tools/library/${editId}`);
      return;
    }
  }, [editId, router]);
  
  // Don't render the editor if we're redirecting
  if (editId) {
    return (
      <div className="max-w-6xl mx-auto space-y-6">
        <Card className="border-0 shadow-sm">
          <CardContent className="flex items-center justify-center py-12">
            <div className="text-center space-y-3">
              <Loader2 className="w-8 h-8 animate-spin mx-auto text-purple-500" />
              <p className="text-muted-foreground">Redirecting to viewer...</p>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  const handleInputChange = (fieldId: string, value: any) => {
    setFormData(prev => ({
      ...prev,
      [fieldId]: value
    }));
  };

  const handleMultiSelectChange = (fieldId: string, option: string, checked: boolean) => {
    const currentValues = formData[fieldId] || [];
    const newValues = checked 
      ? [...currentValues, option]
      : currentValues.filter((v: string) => v !== option);
    handleInputChange(fieldId, newValues);
  };

  const validateForm = (): boolean => {
    const requiredFields = tool.inputFields.filter(field => field.required);
    return requiredFields.every(field => {
      const value = formData[field.id];
      return value !== undefined && value !== null && value !== '';
    });
  };

  const handleManualGenerate = async () => {
    if (!validateForm()) return;

    setIsGenerating(true);
    setError('');
    
    try {
      const response = await fetch(`/api/tools/${tool.id}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formData),
      });

      if (!response.ok) {
        throw new Error('Failed to generate content');
      }

      const data = await response.json();
      
      // Handle BrainBytes special response structure
      if (tool.id === 'brain-bytes' && data.success && data.content) {
        setResult({ 
          content: JSON.stringify(data.content), 
          format: 'audio',
          metadata: data.content.metadata 
        });
      } else {
        setResult(data);
      }
      
      scrollToResults();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An error occurred');
    } finally {
      setIsGenerating(false);
    }
  };

  const handleAIChat = async () => {
    if (!aiPrompt.trim()) return;

    const userMessage: ConversationMessage = {
      role: 'user',
      content: aiPrompt,
      timestamp: new Date()
    };

    setConversation(prev => [...prev, userMessage]);
    setIsGenerating(true);
    setError('');
    setAiPrompt('');
    
    try {
      console.log('🎵 ToolWorkflow: Sending request to Luna tools API', {
        toolId: tool.id,
        prompt: userMessage.content.substring(0, 100) + '...',
        conversationLength: conversation.length,
        isRefinement: refinementMode
      });

      const response = await fetch('/api/luna/tools', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          toolId: tool.id,
          prompt: userMessage.content,
          conversationHistory: conversation.map(msg => ({
            role: msg.role,
            content: msg.content
          })),
          isRefinement: refinementMode
        }),
      });

      console.log('🎵 ToolWorkflow: Received response', {
        status: response.status,
        ok: response.ok,
        statusText: response.statusText
      });

      if (!response.ok) {
        throw new Error('Failed to generate content');
      }

      const data = await response.json();
      
      console.log('🎵 ToolWorkflow: Raw response from Luna tools API:', {
        status: response.status,
        ok: response.ok,
        dataKeys: Object.keys(data),
        isComplete: data.isComplete,
        hasAudioContent: !!data.audioContent,
        toolId: data.toolId,
        expectedToolId: tool.id,
        responseLength: data.response?.length
      });
      
      const assistantMessage: ConversationMessage = {
        role: 'assistant',
        content: data.response,
        timestamp: new Date()
      };

      setConversation(prev => [...prev, assistantMessage]);
      setIsInConversation(true);
      
      console.log('🎵 ToolWorkflow: Received response from Luna tools API', {
        isComplete: data.isComplete,
        hasAudioContent: !!data.audioContent,
        toolId: tool.id,
        responseLength: data.response?.length
      });
      
      // If Luna has completed the task, set the result
      if (data.isComplete) {
        console.log('🎵 ToolWorkflow: Task completed', { 
          toolId: tool.id, 
          hasAudioContent: !!data.audioContent,
          audioContent: data.audioContent 
        });
        
        // Handle BrainBytes audio content
        if (tool.id === 'brain-bytes' && data.audioContent) {
          console.log('🎵 ToolWorkflow: Setting BrainBytes result with audio content');
          setBrainBytesResult(data.audioContent);
        } else {
          setResult({
            content: data.response,
            format: 'text',
            metadata: {
              wordCount: data.response.split(' ').length,
              estimatedTime: '2-3 minutes',
              difficulty: 'Professional'
            }
          });
        }
        scrollToResults();
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An error occurred');
    } finally {
      setIsGenerating(false);
    }
  };

  const resetConversation = () => {
    setConversation([]);
    setIsInConversation(false);
    setAiPrompt('');
    setResult(null);
    setBrainBytesResult(null);
    setError('');
    setRefinementMode(false);
  };

  const handleRubricRefinement = (currentRubric: any) => {
    setActiveTab('ai-assisted');
    setRefinementMode(true);
    setIsInConversation(true);
    
    const refinementMessage: ConversationMessage = {
      role: 'assistant',
      content: `I can see you'd like to refine your rubric: "${currentRubric.title}". What changes would you like to make? I can help you:

• Adjust performance level descriptions
• Add or remove criteria
• Change the scoring scale
• Modify the rubric title or metadata
• Add more specific details to any section

What would you like to improve?`,
      timestamp: new Date()
    };
    
    setConversation([refinementMessage]);
  };

  const handleMindMapRefinement = (currentMindMap: any) => {
    setActiveTab('ai-assisted');
    setRefinementMode(true);
    setIsInConversation(true);
    
    const refinementMessage: ConversationMessage = {
      role: 'assistant',
      content: `I can see you'd like to refine your mind map: "${currentMindMap.title}". What changes would you like to make? I can help you:

• Add more branches or sub-topics to existing branches
• Expand on specific topics with more detail
• Add new main branches for related concepts
• Reorganize the structure or hierarchy
• Add connections between different branches
• Adjust the complexity level or grade appropriateness
• Include more examples or explanations

What would you like to improve or expand on?`,
      timestamp: new Date()
    };
    
    setConversation([refinementMessage]);
  };

  const handleMindMapUpdate = (updatedMindMap: any) => {
    // Store the updated mind map data for saving
    setUpdatedMindMapData(updatedMindMap);
  };

  // Helper function to auto-scroll to results
  const scrollToResults = () => {
    setTimeout(() => {
      resultRef.current?.scrollIntoView({ 
        behavior: 'smooth', 
        block: 'start',
        inline: 'nearest'
      });
    }, 100);
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    // Handle Enter key press for form submission
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      if (!isGenerating && validateForm()) {
        handleManualGenerate();
      }
    }
  };

  const handleAIChatKeyPress = (e: React.KeyboardEvent) => {
    // Handle Enter key press for AI chat submission
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      if (!isGenerating && aiPrompt.trim()) {
        handleAIChat();
      }
    }
  };

  const handleConversationKeyPress = (e: React.KeyboardEvent) => {
    // Handle Enter key press for conversation input
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      if (!isGenerating && aiPrompt.trim()) {
        handleAIChat();
      }
    }
  };

  const copyToClipboard = async (text: string, itemId: string) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopiedItems(prev => new Set([...prev, itemId]));
      setTimeout(() => {
        setCopiedItems(prev => {
          const newSet = new Set(prev);
          newSet.delete(itemId);
          return newSet;
        });
      }, 2000);
    } catch (err) {
      console.error('Failed to copy text:', err);
    }
  };

  const downloadResult = (format: string) => {
    if (!result) return;
    
    const blob = new Blob([result.content], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${tool.name.toLowerCase().replace(/\s+/g, '-')}.${format}`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  const saveToLibrary = async () => {
    if (!result && !brainBytesResult) return;

    setIsSaving(true);
    setSaveSuccess(false);

    try {
      // Generate title based on form data or content
      const title = generateTitle();
      
      // Handle different content types
      let contentToSave: string;
      let metadata: any;
      
      if (brainBytesResult) {
        // For BrainBytes, save the full audio content object
        contentToSave = JSON.stringify(brainBytesResult, null, 2);
        metadata = {
          ...brainBytesResult.metadata,
          gradeLevel: brainBytesResult.metadata.gradeLevel,
          subject: formData.subject,
          duration: `${brainBytesResult.duration}s`,
          difficulty: 'Professional',
          topic: brainBytesResult.metadata.topic,
          audioUrl: brainBytesResult.audioUrl,
          ...extractMetadataFromFormData()
        };
      } else if (result) {
        // For mind map generator, use updated mind map data if available, otherwise use original content
        contentToSave = result.content;
        if (tool.id === 'mindmap-generator' && updatedMindMapData) {
          // Convert the updated mind map data back to string format for saving
          contentToSave = JSON.stringify(updatedMindMapData, null, 2);
        }
        
        // Extract metadata from form data and result
        metadata = {
          ...result.metadata,
          gradeLevel: formData.gradeLevel,
          subject: formData.subject,
          duration: formData.duration,
          difficulty: formData.difficulty,
          ...extractMetadataFromFormData()
        };
      } else {
        return;
      }

      // Generate tags
      const tags = generateTags();

      const creationData: TeacherToolCreationInput = {
        tool_id: tool.id,
        tool_name: tool.name,
        title,
        description: generateDescription(),
        content: contentToSave, // Save the updated content
        metadata,
        tags
      };

      await teacherToolLibraryService.saveCreation(creationData);
      setSaveSuccess(true);
      
      // Reset success state after 3 seconds
      setTimeout(() => setSaveSuccess(false), 3000);
      
    } catch (error) {
      console.error('Failed to save to library:', error);
      setError('Failed to save to library. Please try again.');
    } finally {
      setIsSaving(false);
    }
  };

  const generateTitle = (): string => {
    // Try to generate a meaningful title based on form data and tool type
    let title = '';
    
    // Handle different tool types with their specific field names
    switch (tool.id) {
      case 'rubric-generator':
        const rubricSubject = formData.subject;
        const assessmentType = formData.assessmentType;
        const rubricGradeLevel = formData.gradeLevel;
        
        if (rubricSubject && assessmentType && rubricGradeLevel) {
          title = `${rubricSubject} ${assessmentType} Rubric - Grade ${rubricGradeLevel}`;
        } else if (rubricSubject && assessmentType) {
          title = `${rubricSubject} ${assessmentType} Rubric`;
        } else if (rubricSubject && rubricGradeLevel) {
          title = `${rubricSubject} Rubric - Grade ${rubricGradeLevel}`;
        } else if (rubricSubject) {
          title = `${rubricSubject} Rubric`;
        }
        break;
        
      case 'quiz-generator':
        const quizSubject = formData.subject;
        const quizTopic = formData.topic;
        const quizGradeLevel = formData.gradeLevel;
        
        if (quizTopic && quizGradeLevel) {
          title = `${quizTopic} Quiz - Grade ${quizGradeLevel}`;
        } else if (quizTopic) {
          title = `${quizTopic} Quiz`;
        } else if (quizSubject && quizGradeLevel) {
          title = `${quizSubject} Quiz - Grade ${quizGradeLevel}`;
        } else if (quizSubject) {
          title = `${quizSubject} Quiz`;
        }
        break;
        
      case 'mindmap-generator':
        const centralTopic = formData.centralTopic;
        const mindmapGradeLevel = formData.gradeLevel;
        
        if (centralTopic && mindmapGradeLevel) {
          title = `${centralTopic} Mind Map - Grade ${mindmapGradeLevel}`;
        } else if (centralTopic) {
          title = `${centralTopic} Mind Map`;
        }
        break;
        
      case 'activities-creator':
        const activityTopic = formData.topic;
        const activitySubject = formData.subject;
        const activityGradeLevel = formData.gradeLevel;
        const activityType = formData.activityType;
        
        if (activityTopic && activityType && activityGradeLevel) {
          title = `${activityTopic} ${activityType} - Grade ${activityGradeLevel}`;
        } else if (activityTopic && activityGradeLevel) {
          title = `${activityTopic} Activity - Grade ${activityGradeLevel}`;
        } else if (activityTopic) {
          title = `${activityTopic} Activity`;
        } else if (activitySubject && activityGradeLevel) {
          title = `${activitySubject} Activity - Grade ${activityGradeLevel}`;
        }
        break;
        
      default:
        // Generic fallback for other tools
        const topic = formData.topic || formData.centralTopic || formData.concept || formData.subject;
        const gradeLevel = formData.gradeLevel;
        
        if (topic && gradeLevel) {
          title = `${topic} - Grade ${gradeLevel}`;
        } else if (topic) {
          title = topic;
        }
        break;
    }
    
    // If no specific title was generated, use a fallback
    if (!title) {
      title = `${tool.name} - ${new Date().toLocaleDateString()}`;
    }
    
    return title;
  };

  const generateDescription = (): string => {
    const parts: string[] = [];
    
    // Add tool-specific description based on form data
    switch (tool.id) {
      case 'rubric-generator':
        if (formData.subject) parts.push(`Subject: ${formData.subject}`);
        if (formData.assessmentType) parts.push(`Assessment: ${formData.assessmentType}`);
        if (formData.gradeLevel) parts.push(`Grade: ${formData.gradeLevel}`);
        if (formData.performanceLevels) parts.push(`${formData.performanceLevels} performance levels`);
        break;
        
      case 'quiz-generator':
        if (formData.subject) parts.push(`Subject: ${formData.subject}`);
        if (formData.topic) parts.push(`Topic: ${formData.topic}`);
        if (formData.gradeLevel) parts.push(`Grade: ${formData.gradeLevel}`);
        if (formData.questionCount) parts.push(`${formData.questionCount} questions`);
        if (formData.difficulty) parts.push(`Difficulty: ${formData.difficulty}`);
        break;
        
      case 'mindmap-generator':
        if (formData.centralTopic) parts.push(`Topic: ${formData.centralTopic}`);
        if (formData.gradeLevel) parts.push(`Grade: ${formData.gradeLevel}`);
        if (formData.subject) parts.push(`Subject: ${formData.subject}`);
        break;
        
      case 'activities-creator':
        if (formData.subject) parts.push(`Subject: ${formData.subject}`);
        if (formData.topic) parts.push(`Topic: ${formData.topic}`);
        if (formData.gradeLevel) parts.push(`Grade: ${formData.gradeLevel}`);
        if (formData.activityType) parts.push(`Type: ${formData.activityType}`);
        if (formData.duration) parts.push(`Duration: ${formData.duration}`);
        if (formData.groupSize) parts.push(`Group Size: ${formData.groupSize}`);
        break;
        
      default:
        // Generic fallback
        if (formData.topic || formData.centralTopic) {
          parts.push(`Topic: ${formData.topic || formData.centralTopic}`);
        }
        if (formData.gradeLevel) parts.push(`Grade: ${formData.gradeLevel}`);
        if (formData.subject) parts.push(`Subject: ${formData.subject}`);
        if (formData.duration) parts.push(`Duration: ${formData.duration}`);
        break;
    }
    
    return parts.join(' • ');
  };

  const generateTags = (): string[] => {
    const tags: string[] = [];
    
    if (formData.gradeLevel) tags.push(`grade-${formData.gradeLevel}`);
    if (formData.subject) tags.push(formData.subject.toLowerCase());
    if (formData.category) tags.push(formData.category.toLowerCase());
    if (formData.difficulty) tags.push(formData.difficulty.toLowerCase());
    
    // Add tool-specific tags
    if (tool.keywords) {
      tags.push(...tool.keywords.slice(0, 3));
    }
    
    return [...new Set(tags)]; // Remove duplicates
  };

  const extractMetadataFromFormData = () => {
    const metadata: any = {};
    
    // Save the entire form data for future loading
    metadata.formData = formData;
    
    // Extract relevant fields from form data
    const metadataFields = [
      'gradeLevel', 'subject', 'duration', 'difficulty', 'assessmentType',
      'questionCount', 'complexity', 'style', 'learningObjectives', 'standards'
    ];
    
    metadataFields.forEach(field => {
      if (formData[field]) {
        metadata[field] = formData[field];
      }
    });
    
    return metadata;
  };

  const openLibrary = () => {
    router.push(`/teach/tools/${tool.id}/library`);
  };

  const renderFormField = (field: ToolInputField) => {
    const value = formData[field.id];

    switch (field.type) {
      case 'text':
        return (
          <div key={field.id} className="space-y-2">
            <Label htmlFor={field.id} className="text-sm font-medium">
              {field.label}
              {field.required && <span className="text-red-500 ml-1">*</span>}
            </Label>
            <Input
              id={field.id}
              type="text"
              placeholder={field.placeholder}
              value={value || ''}
              onChange={(e) => handleInputChange(field.id, e.target.value)}
              onKeyPress={handleKeyPress}
              className="w-full"
            />
            {field.description && (
              <p className="text-xs text-muted-foreground">{field.description}</p>
            )}
          </div>
        );

      case 'textarea':
        return (
          <div key={field.id} className="space-y-2">
            <Label htmlFor={field.id} className="text-sm font-medium">
              {field.label}
              {field.required && <span className="text-red-500 ml-1">*</span>}
            </Label>
            <Textarea
              id={field.id}
              placeholder={field.placeholder}
              value={value || ''}
              onChange={(e) => handleInputChange(field.id, e.target.value)}
              onKeyPress={handleKeyPress}
              className="min-h-[100px] resize-y"
            />
            {field.description && (
              <p className="text-xs text-muted-foreground">{field.description}</p>
            )}
          </div>
        );

      case 'select':
        return (
          <div key={field.id} className="space-y-2">
            <Label htmlFor={field.id} className="text-sm font-medium">
              {field.label}
              {field.required && <span className="text-red-500 ml-1">*</span>}
            </Label>
            <Select value={value || ''} onValueChange={(val) => handleInputChange(field.id, val)}>
              <SelectTrigger>
                <SelectValue placeholder={field.placeholder} />
              </SelectTrigger>
              <SelectContent>
                {field.options?.map((option) => (
                  <SelectItem key={option} value={option}>
                    {option}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {field.description && (
              <p className="text-xs text-muted-foreground">{field.description}</p>
            )}
          </div>
        );

      case 'multiselect':
        return (
          <div key={field.id} className="space-y-2">
            <Label className="text-sm font-medium">
              {field.label}
              {field.required && <span className="text-red-500 ml-1">*</span>}
            </Label>
            <div className="grid grid-cols-2 gap-2">
              {field.options?.map((option) => (
                <div key={option} className="flex items-center space-x-2">
                  <Checkbox
                    id={`${field.id}-${option}`}
                    checked={(value || []).includes(option)}
                    onCheckedChange={(checked) => 
                      handleMultiSelectChange(field.id, option, checked as boolean)
                    }
                  />
                  <Label 
                    htmlFor={`${field.id}-${option}`}
                    className="text-sm font-normal cursor-pointer"
                  >
                    {option}
                  </Label>
                </div>
              ))}
            </div>
            {field.description && (
              <p className="text-xs text-muted-foreground">{field.description}</p>
            )}
          </div>
        );

      case 'range':
        return (
          <div key={field.id} className="space-y-2">
            <div className="flex justify-between items-center">
              <Label className="text-sm font-medium">
                {field.label}
                {field.required && <span className="text-red-500 ml-1">*</span>}
              </Label>
              <Badge variant="secondary" className="text-xs">
                {value || field.min || 1}
              </Badge>
            </div>
            <Slider
              value={[value || field.min || 1]}
              onValueChange={(vals) => handleInputChange(field.id, vals[0])}
              min={field.min || 1}
              max={field.max || 10}
              step={1}
              className="w-full"
            />
            {field.description && (
              <p className="text-xs text-muted-foreground">{field.description}</p>
            )}
          </div>
        );

      default:
        return null;
    }
  };

  // Show loading state when loading existing creation
  if (isLoading) {
    return (
      <div className="max-w-6xl mx-auto space-y-6">
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="sm" onClick={onBack} className="flex items-center gap-2">
            <ArrowLeft className="w-4 h-4" />
            Back to Tools
          </Button>
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-lg bg-gradient-to-br from-blue-500 to-purple-600 flex items-center justify-center">
              <Wand2 className="w-6 h-6 text-white" />
            </div>
            <div>
              <h1 className="text-2xl font-bold">{tool.name}</h1>
              <p className="text-muted-foreground">{tool.description}</p>
            </div>
          </div>
        </div>
        
        <Card className="border-0 shadow-sm">
          <CardContent className="flex items-center justify-center py-12">
            <div className="text-center space-y-3">
              <Loader2 className="w-8 h-8 animate-spin mx-auto text-purple-500" />
              <p className="text-muted-foreground">Loading your creation...</p>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="max-w-6xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex items-center gap-4">
        <Button variant="ghost" size="sm" onClick={onBack} className="flex items-center gap-2">
          <ArrowLeft className="w-4 h-4" />
          Back to Tools
        </Button>
        <div className="flex items-center gap-3">
          <div className="w-12 h-12 rounded-lg bg-gradient-to-br from-blue-500 to-purple-600 flex items-center justify-center">
            <Wand2 className="w-6 h-6 text-white" />
          </div>
          <div>
            <h1 className="text-2xl font-bold">{tool.name}</h1>
            <p className="text-muted-foreground">
              {loadedCreation ? `Editing: ${loadedCreation.title}` : tool.description}
            </p>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Main Content */}
        <div className="lg:col-span-2">
          <Card className="border-0 shadow-sm">
            <CardHeader className="pb-4">
              <CardTitle className="flex items-center gap-2">
                <Sparkles className="w-5 h-5 text-purple-500" />
                Create Your {tool.name}
              </CardTitle>
              <CardDescription>
                Choose how you'd like to create your {tool.name.toLowerCase()}
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Tabs value={activeTab} onValueChange={(value) => setActiveTab(value as 'manual' | 'ai-assisted')}>
                <TabsList className="grid w-full grid-cols-2 mb-6">
                  <TabsTrigger value="ai-assisted" className="flex items-center gap-2">
                    <Sparkles className="w-4 h-4" />
                    Chat with Luna
                  </TabsTrigger>
                  <TabsTrigger value="manual" className="flex items-center gap-2">
                    <FileText className="w-4 h-4" />
                    Manual Form
                  </TabsTrigger>
                </TabsList>

                <TabsContent value="ai-assisted" className="space-y-4">
                  {!isInConversation ? (
                    // Initial prompt
                    <div className="space-y-4">
                      <div className="bg-gradient-to-r from-purple-50 to-blue-50 dark:from-purple-950/20 dark:to-blue-950/20 p-5 rounded-2xl border-0">
                        <div className="flex items-start gap-3">
                          <div className="w-8 h-8 rounded-full bg-gray-100 dark:bg-gray-800 flex items-center justify-center flex-shrink-0 overflow-hidden">
                            <img 
                              src="/web-app-manifest-512x512.png" 
                              alt="Luna" 
                              className="w-6 h-6 rounded-full"
                            />
                          </div>
                          <div className="flex-1">
                            <p className="font-medium text-foreground mb-1">Hi! I'm Luna 👋</p>
                            <p className="text-muted-foreground text-sm">
                              I'll help you create a {tool.name.toLowerCase()}. Just describe what you need and I'll ask follow-up questions!
                            </p>
                          </div>
                        </div>
                      </div>

                      <div className="space-y-3">
                        <Textarea
                          placeholder={`Tell me about the ${tool.name.toLowerCase()} you'd like to create...`}
                          value={aiPrompt}
                          onChange={(e) => setAiPrompt(e.target.value)}
                          onKeyPress={handleAIChatKeyPress}
                          className="min-h-[120px] resize-none border-2 focus:border-purple-300 dark:focus:border-purple-600"
                        />
                        
                        {error && (
                          <div className="flex items-center gap-2 text-sm text-red-600 bg-red-50 dark:bg-red-950/50 p-3 rounded-lg">
                            <AlertCircle className="w-4 h-4" />
                            {error}
                          </div>
                        )}

                        <Button 
                          onClick={handleAIChat}
                          disabled={isGenerating || !aiPrompt.trim()}
                          className="w-full bg-gradient-to-r from-purple-600 to-blue-600 hover:from-purple-700 hover:to-blue-700"
                          size="lg"
                        >
                          {isGenerating ? (
                            <>
                              <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                              Luna is thinking...
                            </>
                          ) : (
                            <>
                              <Send className="w-4 h-4 mr-2" />
                              Start Chat with Luna
                            </>
                          )}
                        </Button>
                      </div>
                    </div>
                  ) : (
                    // Conversation view
                    <div className="space-y-4">
                      <div className="flex items-center justify-between">
                        <h3 className="font-medium text-foreground">Conversation with Luna</h3>
                        <Button 
                          variant="outline" 
                          size="sm" 
                          onClick={resetConversation}
                          className="flex items-center gap-2"
                        >
                          <RotateCcw className="w-3 h-3" />
                          Start Over
                        </Button>
                      </div>

                      <ScrollArea className="h-[400px] pr-4">
                        <div className="space-y-4">
                          {conversation.map((message, index) => (
                            <div key={index} className={`flex gap-3 ${message.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                              {message.role === 'assistant' && (
                                <div className="w-8 h-8 rounded-full bg-gray-100 dark:bg-gray-800 flex items-center justify-center flex-shrink-0 overflow-hidden">
                                  <img 
                                    src="/web-app-manifest-512x512.png" 
                                    alt="Luna" 
                                    className="w-6 h-6 rounded-full"
                                  />
                                </div>
                              )}
                              <div className={`max-w-[85%] p-4 rounded-2xl ${
                                message.role === 'user' 
                                  ? 'bg-gradient-to-r from-purple-600 to-blue-600 text-white' 
                                  : 'bg-muted/50 text-foreground border'
                              }`}>
                                <p className="text-sm leading-relaxed whitespace-pre-wrap">{message.content}</p>
                              </div>
                              {message.role === 'user' && (
                                <div className="w-8 h-8 rounded-full bg-gray-200 dark:bg-gray-700 flex items-center justify-center text-gray-600 dark:text-gray-300 text-sm font-medium flex-shrink-0">
                                  You
                                </div>
                              )}
                            </div>
                          ))}
                          <div ref={conversationEndRef} />
                        </div>
                      </ScrollArea>

                      {(!result || refinementMode) && (
                        <div className="space-y-3">
                          <Textarea
                            placeholder="Type your response..."
                            value={aiPrompt}
                            onChange={(e) => setAiPrompt(e.target.value)}
                            onKeyPress={handleConversationKeyPress}
                            className="min-h-[80px] resize-none"
                          />
                          <Button 
                            onClick={handleAIChat}
                            disabled={isGenerating || !aiPrompt.trim()}
                            className="w-full"
                          >
                            {isGenerating ? (
                              <>
                                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                                Luna is thinking...
                              </>
                            ) : (
                              <>
                                <Send className="w-4 h-4 mr-2" />
                                Send Message
                              </>
                            )}
                          </Button>
                        </div>
                      )}
                    </div>
                  )}
                </TabsContent>

                <TabsContent value="manual" className="space-y-4">
                  <ScrollArea className="h-[500px] pr-4">
                    <div className="space-y-4">
                      {tool.inputFields.map(renderFormField)}
                    </div>
                  </ScrollArea>
                  
                  {error && (
                    <div className="flex items-center gap-2 text-sm text-red-600 bg-red-50 dark:bg-red-950/50 p-3 rounded-lg">
                      <AlertCircle className="w-4 h-4" />
                      {error}
                    </div>
                  )}

                  <Button 
                    onClick={handleManualGenerate}
                    disabled={isGenerating || !validateForm()}
                    className="w-full"
                    size="lg"
                  >
                    {isGenerating ? (
                      <>
                        <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                        Generating...
                      </>
                    ) : (
                      <>
                        <Wand2 className="w-4 h-4 mr-2" />
                        Generate {tool.name}
                      </>
                    )}
                  </Button>
                </TabsContent>
              </Tabs>
            </CardContent>
          </Card>
        </div>

        {/* Sidebar */}
        <div className="space-y-6">
          <Card className="border-0 shadow-sm">
            <CardHeader className="pb-4">
              <CardTitle className="flex items-center gap-2 text-lg">
                <Lightbulb className="w-5 h-5 text-yellow-500" />
                Tips & Examples
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-3">
                <h4 className="font-medium text-sm">Best Practices:</h4>
                <ul className="space-y-2 text-sm text-muted-foreground">
                  {tool.tips?.map((tip, index) => (
                    <li key={index} className="flex items-start gap-2">
                      <div className="w-1.5 h-1.5 rounded-full bg-blue-500 mt-2 flex-shrink-0" />
                      {tip}
                    </li>
                  ))}
                </ul>
              </div>

              {tool.examples && tool.examples.length > 0 && (
                <div className="space-y-3">
                  <h4 className="font-medium text-sm">Examples:</h4>
                  <div className="space-y-2">
                    {tool.examples.slice(0, 2).map((example, index) => (
                      <div key={index} className="p-3 bg-muted/50 rounded-lg">
                        <p className="text-xs text-muted-foreground">{example}</p>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </CardContent>
          </Card>

          {tool.outputFormats && (
            <Card className="border-0 shadow-sm">
              <CardHeader className="pb-4">
                <CardTitle className="flex items-center gap-2 text-lg">
                  <FileText className="w-5 h-5 text-green-500" />
                  Output Formats
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-2">
                  {tool.outputFormats.map((format) => (
                    <Badge key={format} variant="secondary" className="mr-2">
                      {format.toUpperCase()}
                    </Badge>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}
        </div>
      </div>

              {/* Results Section */}
              {(result || brainBytesResult) && (
        <div ref={resultRef} className="space-y-4">
          <Separator />
          <Card className="border-0 shadow-sm">
            <CardHeader>
              <div className="flex items-center justify-between">
                <CardTitle className="flex items-center gap-2">
                  <Check className="w-5 h-5 text-green-500" />
                  Your {tool.name} is Ready!
                </CardTitle>
                <div className="flex items-center gap-2">
                  {result && (
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => copyToClipboard(result.content, 'result')}
                      className="flex items-center gap-2"
                    >
                      {copiedItems.has('result') ? (
                        <Check className="w-4 h-4 text-green-500" />
                      ) : (
                        <Copy className="w-4 h-4" />
                      )}
                      Copy
                    </Button>
                  )}
                  {(result || brainBytesResult) && (
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => downloadResult('txt')}
                      className="flex items-center gap-2"
                    >
                      <Download className="w-4 h-4" />
                      Download
                    </Button>
                  )}
                  {(result || brainBytesResult) && (
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={saveToLibrary}
                      disabled={isSaving}
                      className="flex items-center gap-2"
                    >
                      {isSaving ? (
                        <Loader2 className="w-4 h-4 animate-spin" />
                      ) : saveSuccess ? (
                        <Check className="w-4 h-4 text-green-500" />
                      ) : (
                        <Save className="w-4 h-4" />
                      )}
                      {isSaving ? 'Saving...' : saveSuccess ? 'Saved!' : 'Save'}
                    </Button>
                  )}
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={openLibrary}
                    className="flex items-center gap-2"
                  >
                    <BookOpen className="w-4 h-4" />
                    Library
                  </Button>
                </div>
              </div>
              {result?.metadata && (
                <div className="flex items-center gap-4 text-sm text-muted-foreground">
                  {result.metadata.wordCount && (
                    <span>{result.metadata.wordCount} words</span>
                  )}
                  {result.metadata.estimatedTime && (
                    <span>{result.metadata.estimatedTime} read</span>
                  )}
                  {result.metadata.difficulty && (
                    <Badge variant="secondary">{result.metadata.difficulty}</Badge>
                  )}
                </div>
              )}
            </CardHeader>
            <CardContent>
              {result && tool.id === 'rubric-generator' ? (
                <RubricDisplay 
                  content={result.content} 
                  metadata={result.metadata}
                  onCopy={copyToClipboard}
                  copiedItems={copiedItems}
                  onRefineWithLuna={handleRubricRefinement}
                />
              ) : result && tool.id === 'mindmap-generator' ? (
                <MindMapDisplay 
                  content={result.content} 
                  metadata={result.metadata}
                  onCopy={copyToClipboard}
                  copiedItems={copiedItems}
                  onRefineWithLuna={handleMindMapRefinement}
                  onMindMapUpdate={handleMindMapUpdate}
                />
              ) : tool.id === 'brain-bytes' && brainBytesResult ? (
                <>
                  {console.log('🎵 ToolWorkflow: Rendering BrainBytesDisplay with:', brainBytesResult)}
                  <BrainBytesDisplay 
                    content={brainBytesResult} 
                    onCopy={copyToClipboard}
                    copiedItems={copiedItems}
                    onRefineWithLuna={handleRubricRefinement}
                  />
                </>
              ) : result && tool.id === 'brain-bytes' ? (
                <BrainBytesDisplay 
                  content={JSON.parse(result.content)} 
                  onCopy={copyToClipboard}
                  copiedItems={copiedItems}
                  onRefineWithLuna={handleRubricRefinement}
                />
              ) : result && tool.id === 'quiz-generator' ? (
                <QuizDisplay 
                  content={result.content} 
                  metadata={result.metadata}
                  onCopy={copyToClipboard}
                  copiedItems={copiedItems}
                  onRefineWithLuna={handleRubricRefinement}
                />
              ) : result && tool.id === 'activities-creator' ? (
                <ActivitiesDisplay 
                  content={result.content} 
                  metadata={result.metadata}
                  onCopy={copyToClipboard}
                  copiedItems={copiedItems}
                  onRefineWithLuna={handleRubricRefinement}
                />
              ) : result ? (
                <div className="prose dark:prose-invert max-w-none">
                  <pre className="whitespace-pre-wrap font-sans text-sm leading-relaxed bg-muted/30 p-4 rounded-lg">
                    {result.content}
                  </pre>
                </div>
              ) : null}
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  );
} 