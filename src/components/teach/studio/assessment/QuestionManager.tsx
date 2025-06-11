'use client';

import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from '@/components/ui/dialog';
import { Textarea } from '@/components/ui/textarea';
import { Checkbox } from '@/components/ui/checkbox';
import { Slider } from '@/components/ui/slider';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { 
  Plus, 
  Search, 
  Filter, 
  Edit, 
  Trash2, 
  Copy, 
  BookOpen, 
  HelpCircle,
  FileText,
  CheckSquare,
  Target,
  ArrowRightLeft,
  Type,
  PenTool,
  Shuffle,
  MoreHorizontal,
  Star,
  Clock,
  Tag,
  Brain,
  Settings
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { QuestionEditor } from './QuestionEditor';
import { QuestionPreview } from './QuestionPreview';
import { QuestionBankManager } from './QuestionBankManager';
import { QuestionDistributionDialog } from './QuestionDistributionDialog';

// Types based on our existing database schema
interface Question {
  id: string;
  quiz_id?: string;
  question_text: string;
  question_type: 'multiple_choice' | 'true_false' | 'short_answer' | 'essay' | 'fill_in_blank' | 'matching' | 'drag_drop' | 'sequence';
  points: number;
  order_index: number;
  created_by: string | null;
  created_at: string;
  updated_at: string;
  options?: QuestionOption[];
  metadata?: {
    difficulty_level?: 'easy' | 'medium' | 'hard';
    bloom_taxonomy?: 'remember' | 'understand' | 'apply' | 'analyze' | 'evaluate' | 'create';
    learning_objectives?: string[];
    tags?: string[];
    estimated_time?: number; // in minutes
    lesson_content_refs?: string[]; // References to lesson content that this question tests
    source_content?: string; // Original lesson content this question was derived from
    ai_generated?: boolean;
    validation_status?: 'draft' | 'reviewed' | 'approved' | 'needs_revision';
  };
}

interface QuestionOption {
  id: string;
  question_id: string;
  option_text: string;
  is_correct: boolean;
  order_index: number;
  created_at: string;
  updated_at: string;
}

interface Quiz {
  id: string;
  lesson_id?: string;
  title: string;
  description?: string;
  time_limit?: number;
  pass_threshold?: number;
  shuffle_questions?: boolean;
  created_by?: string;
  created_at: string;
  updated_at: string;
}

interface QuestionManagerProps {
  lessonId?: string;
  baseClassId: string;
  onQuestionSelect?: (question: Question) => void;
  mode?: 'standalone' | 'lesson_builder' | 'quiz_builder';
}

export const QuestionManager: React.FC<QuestionManagerProps> = ({
  lessonId,
  baseClassId,
  onQuestionSelect,
  mode = 'standalone'
}) => {
  const [questions, setQuestions] = useState<Question[]>([]);
  const [quizzes, setQuizzes] = useState<Quiz[]>([]);
  const [availableLessons, setAvailableLessons] = useState<{id: string, title: string}[]>([]);
  const [selectedQuestion, setSelectedQuestion] = useState<Question | null>(null);
  const [isEditorOpen, setIsEditorOpen] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedQuestionType, setSelectedQuestionType] = useState<string>('all');
  const [selectedDifficulty, setSelectedDifficulty] = useState<string>('all');
  const [selectedTags, setSelectedTags] = useState<string[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [activeTab, setActiveTab] = useState<'bank' | 'create' | 'organize'>('bank');
  const [isGenerationDialogOpen, setIsGenerationDialogOpen] = useState(false);
  const [baseClassInfo, setBaseClassInfo] = useState<{
    name: string;
    totalLessons: number;
    totalSections: number;
  } | null>(null);
  const [isGenerating, setIsGenerating] = useState(false);

  // Question type configurations
  const questionTypes = [
    { id: 'multiple_choice', label: 'Multiple Choice', icon: CheckSquare, color: 'bg-blue-100 text-blue-700' },
    { id: 'true_false', label: 'True/False', icon: Target, color: 'bg-green-100 text-green-700' },
    { id: 'short_answer', label: 'Short Answer', icon: Type, color: 'bg-purple-100 text-purple-700' },
    { id: 'essay', label: 'Essay', icon: PenTool, color: 'bg-orange-100 text-orange-700' },
    { id: 'fill_in_blank', label: 'Fill in Blank', icon: FileText, color: 'bg-pink-100 text-pink-700' },
    { id: 'matching', label: 'Matching', icon: ArrowRightLeft, color: 'bg-teal-100 text-teal-700' },
    { id: 'drag_drop', label: 'Drag & Drop', icon: Shuffle, color: 'bg-indigo-100 text-indigo-700' },
    { id: 'sequence', label: 'Sequence', icon: HelpCircle, color: 'bg-yellow-100 text-yellow-700' }
  ];

  // Load questions, quizzes, and available lessons
  useEffect(() => {
    loadQuestions();
    loadQuizzes();
    if (baseClassId) {
      loadBaseClassInfo();
    }
    // Temporarily remove loadAvailableLessons to simplify debugging
    // if (baseClassId) {
    //   loadAvailableLessons();
    // }
  }, [lessonId, baseClassId]);

  const loadQuestions = async () => {
    setIsLoading(true);
    try {
      // TODO: Implement API call to fetch questions
      // const response = await fetch(`/api/teach/lessons/${lessonId}/questions`);
      // const data = await response.json();
      // setQuestions(data.questions || []);
      
      // Mock data for now
      setQuestions([]);
    } catch (error) {
      console.error('Failed to load questions:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const loadQuizzes = async () => {
    try {
      // TODO: Implement API call to fetch quizzes
      // const response = await fetch(`/api/teach/base-classes/${baseClassId}/quizzes`);
      // const data = await response.json();
      // setQuizzes(data.quizzes || []);
      
      // Mock data for now
      setQuizzes([]);
    } catch (error) {
      console.error('Failed to load quizzes:', error);
    }
  };

  const loadAvailableLessons = async () => {
    try {
      const response = await fetch(`/api/teach/base-classes/${baseClassId}/lessons`);
      if (response.ok) {
        const data = await response.json();
        setAvailableLessons(data.lessons || []);
      }
    } catch (error) {
      console.error('Failed to load available lessons:', error);
      // Set empty array on error so UI can still function
      setAvailableLessons([]);
    }
  };

  const loadBaseClassInfo = async () => {
    try {
      // Fetch base class information from the API
      const response = await fetch(`/api/teach/base-classes/${baseClassId}/info`);
      if (response.ok) {
        const data = await response.json();
        setBaseClassInfo({
          name: data.name || "Course",
          totalLessons: data.totalLessons || 0,
          totalSections: data.totalSections || 0
        });
      } else {
        // Fallback to a basic structure if API call fails
        setBaseClassInfo({
          name: "Course",
          totalLessons: 0,
          totalSections: 0
        });
      }
    } catch (error) {
      console.error('Failed to load base class info:', error);
      // Fallback to a basic structure
      setBaseClassInfo({
        name: "Course",
        totalLessons: 0,
        totalSections: 0
      });
    }
  };

  const handleCreateQuestion = (type: string) => {
    const newQuestion: Partial<Question> = {
      question_type: type as Question['question_type'],
      question_text: '',
      points: 1,
      order_index: questions.length,
      metadata: {
        difficulty_level: 'medium',
        bloom_taxonomy: 'understand',
        learning_objectives: [],
        tags: [],
        estimated_time: 2,
        lesson_content_refs: lessonId ? [lessonId] : [],
        ai_generated: false,
        validation_status: 'draft'
      }
    };
    
    setSelectedQuestion(newQuestion as Question);
    setIsEditorOpen(true);
  };

  const handleEditQuestion = (question: Question) => {
    setSelectedQuestion(question);
    setIsEditorOpen(true);
  };

  const handleDeleteQuestion = async (questionId: string) => {
    try {
      // TODO: Implement API call to delete question
      // await fetch(`/api/teach/questions/${questionId}`, { method: 'DELETE' });
      setQuestions(prev => prev.filter(q => q.id !== questionId));
    } catch (error) {
      console.error('Failed to delete question:', error);
    }
  };

  const handleSaveQuestion = async (question: Question) => {
    try {
      // TODO: Implement API call to save question
      if (question.id) {
        // Update existing question
        setQuestions(prev => prev.map(q => q.id === question.id ? question : q));
      } else {
        // Create new question
        const newQuestion = { ...question, id: `temp-${Date.now()}` };
        setQuestions(prev => [...prev, newQuestion]);
      }
      setIsEditorOpen(false);
      setSelectedQuestion(null);
    } catch (error) {
      console.error('Failed to save question:', error);
    }
  };

  const handleGenerateFromContent = async (config: {
    totalQuestions: number;
    questionTypes: string[];
    difficulty: 'easy' | 'medium' | 'hard';
    bloomTaxonomy: string;
    learningObjectives: string[];
    focusAreas: string[];
    questionDistribution?: any;
  }) => {
    try {
      setIsGenerating(true);
      
      const response = await fetch('/api/teach/questions/generate-from-content', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          // Only include lessonId if it exists, otherwise let the API generate from all base class content
          ...(lessonId && { lessonId }),
          baseClassId,
          questionTypes: config.questionTypes,
          difficulty: config.difficulty,
          numQuestions: config.totalQuestions,
          bloomTaxonomy: config.bloomTaxonomy,
          learningObjectives: config.learningObjectives,
          focusAreas: config.focusAreas,
          questionDistribution: config.questionDistribution
        })
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({ error: 'Unknown error' }));
        throw new Error(errorData.error || `Failed to generate questions: ${response.statusText}`);
      }

      const data = await response.json();
      
      if (data.success && data.questions) {
        // Add generated questions to the current list
        setQuestions(prev => [...prev, ...data.questions]);
        setIsGenerationDialogOpen(false);
        
        // Show success message or notification
        console.log(`Generated ${data.questions.length} questions from content`);
        alert(`Successfully generated ${data.questions.length} questions!`);
      } else {
        throw new Error(data.error || 'Failed to generate questions');
      }
      
    } catch (error) {
      console.error('Failed to generate questions:', error);
      alert(`Failed to generate questions: ${error instanceof Error ? error.message : 'Unknown error occurred'}`);
    } finally {
      setIsGenerating(false);
    }
  };

  const handleGenerateButtonClick = () => {
    setIsGenerationDialogOpen(true);
  };

  // Filter questions based on search and filters
  const filteredQuestions = questions.filter(question => {
    const matchesSearch = question.question_text.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         question.metadata?.tags?.some(tag => tag.toLowerCase().includes(searchTerm.toLowerCase()));
    const matchesType = selectedQuestionType === 'all' || question.question_type === selectedQuestionType;
    const matchesDifficulty = selectedDifficulty === 'all' || question.metadata?.difficulty_level === selectedDifficulty;
    const matchesTags = selectedTags.length === 0 || 
                       selectedTags.some(tag => question.metadata?.tags?.includes(tag));
    
    return matchesSearch && matchesType && matchesDifficulty && matchesTags;
  });

  const renderQuestionCard = (question: Question) => {
    const questionTypeConfig = questionTypes.find(t => t.id === question.question_type);
    const Icon = questionTypeConfig?.icon || HelpCircle;

    return (
      <Card key={question.id} className="p-4 hover:shadow-md transition-shadow">
        <div className="flex items-start justify-between">
          <div className="flex-1">
            <div className="flex items-center gap-2 mb-2">
              <div className={cn("p-1 rounded", questionTypeConfig?.color)}>
                <Icon className="h-4 w-4" />
              </div>
              <Badge variant="secondary" className="text-xs">
                {questionTypeConfig?.label}
              </Badge>
              <Badge variant="outline" className="text-xs">
                {question.points} pt{question.points !== 1 ? 's' : ''}
              </Badge>
              {question.metadata?.difficulty_level && (
                <Badge 
                  variant={question.metadata.difficulty_level === 'easy' ? 'default' : 
                          question.metadata.difficulty_level === 'medium' ? 'secondary' : 'destructive'}
                  className="text-xs"
                >
                  {question.metadata.difficulty_level}
                </Badge>
              )}
            </div>
            
            <p className="text-sm text-foreground mb-2 line-clamp-2">
              {question.question_text || 'Untitled Question'}
            </p>
            
            <div className="flex items-center gap-2 text-xs text-muted-foreground">
              {question.metadata?.estimated_time && (
                <div className="flex items-center gap-1">
                  <Clock className="h-3 w-3" />
                  {question.metadata.estimated_time}m
                </div>
              )}
              {question.metadata?.tags && question.metadata.tags.length > 0 && (
                <div className="flex items-center gap-1">
                  <Tag className="h-3 w-3" />
                  {question.metadata.tags.slice(0, 2).join(', ')}
                  {question.metadata.tags.length > 2 && ` +${question.metadata.tags.length - 2}`}
                </div>
              )}
              {question.metadata?.ai_generated && (
                <div className="flex items-center gap-1">
                  <Brain className="h-3 w-3" />
                  AI Generated
                </div>
              )}
            </div>
          </div>
          
          <div className="flex items-center gap-1 ml-2">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => handleEditQuestion(question)}
            >
              <Edit className="h-4 w-4" />
            </Button>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => {/* TODO: Implement duplicate */}}
            >
              <Copy className="h-4 w-4" />
            </Button>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => handleDeleteQuestion(question.id)}
              className="text-destructive hover:text-destructive"
            >
              <Trash2 className="h-4 w-4" />
            </Button>
          </div>
        </div>
      </Card>
    );
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-foreground">Question Management</h2>
          <p className="text-muted-foreground">
            Create and organize assessment questions {lessonId ? 'for this lesson' : 'for your course'}
          </p>
        </div>
        
        {(lessonId || baseClassId) && (
          <Button
            onClick={handleGenerateButtonClick}
            disabled={isGenerating}
            className="bg-gradient-to-r from-purple-600 to-blue-600"
          >
            <Brain className="h-4 w-4 mr-2" />
            Generate from Content
          </Button>
        )}
      </div>

      {/* Main Interface */}
      <Tabs value={activeTab} onValueChange={(value) => setActiveTab(value as any)} className="space-y-4">
        <TabsList className="grid w-full grid-cols-3">
          <TabsTrigger value="bank">Question Bank</TabsTrigger>
          <TabsTrigger value="create">Create Questions</TabsTrigger>
          <TabsTrigger value="organize">Organize & Tag</TabsTrigger>
        </TabsList>

        {/* Question Bank Tab */}
        <TabsContent value="bank" className="space-y-4">
          {/* Search and Filters */}
          <div className="flex items-center gap-4 p-4 bg-muted/30 rounded-lg">
            <div className="flex-1">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Search questions..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pl-10"
                />
              </div>
            </div>
            
            <Select value={selectedQuestionType} onValueChange={setSelectedQuestionType}>
              <SelectTrigger className="w-40">
                <SelectValue placeholder="Question Type" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Types</SelectItem>
                {questionTypes.map(type => (
                  <SelectItem key={type.id} value={type.id}>
                    {type.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            
            <Select value={selectedDifficulty} onValueChange={setSelectedDifficulty}>
              <SelectTrigger className="w-32">
                <SelectValue placeholder="Difficulty" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Levels</SelectItem>
                <SelectItem value="easy">Easy</SelectItem>
                <SelectItem value="medium">Medium</SelectItem>
                <SelectItem value="hard">Hard</SelectItem>
              </SelectContent>
            </Select>
            
            <Button variant="outline" size="sm">
              <Filter className="h-4 w-4 mr-2" />
              More Filters
            </Button>
          </div>

          {/* Questions Grid */}
          <div className="grid gap-4">
            {isGenerating ? (
              <div className="text-center py-8">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto"></div>
                <p className="text-muted-foreground mt-2">Generating questions...</p>
              </div>
            ) : filteredQuestions.length > 0 ? (
              filteredQuestions.map(renderQuestionCard)
            ) : (
              <div className="text-center py-8">
                <HelpCircle className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
                <p className="text-muted-foreground">No questions found</p>
                <p className="text-sm text-muted-foreground">Create your first question to get started</p>
              </div>
            )}
          </div>
        </TabsContent>

        {/* Create Questions Tab */}
        <TabsContent value="create" className="space-y-4">
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            {questionTypes.map(type => {
              const Icon = type.icon;
              return (
                <Card 
                  key={type.id}
                  className="p-4 cursor-pointer hover:shadow-md transition-shadow"
                  onClick={() => handleCreateQuestion(type.id)}
                >
                  <div className="text-center space-y-2">
                    <div className={cn("p-3 rounded-lg mx-auto w-fit", type.color)}>
                      <Icon className="h-6 w-6" />
                    </div>
                    <h3 className="font-medium text-sm">{type.label}</h3>
                  </div>
                </Card>
              );
            })}
          </div>
        </TabsContent>

        {/* Organize & Tag Tab */}
        <TabsContent value="organize" className="space-y-4">
          <QuestionBankManager 
            questions={questions}
            onQuestionsUpdate={setQuestions}
            baseClassId={baseClassId}
          />
        </TabsContent>
      </Tabs>

      {/* Question Editor Dialog */}
      <Dialog open={isEditorOpen} onOpenChange={setIsEditorOpen}>
        <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>
              {selectedQuestion?.id ? 'Edit Question' : 'Create New Question'}
            </DialogTitle>
          </DialogHeader>
          {selectedQuestion && (
            <QuestionEditor
              question={selectedQuestion}
              onSave={handleSaveQuestion}
              onCancel={() => {
                setIsEditorOpen(false);
                setSelectedQuestion(null);
              }}
              lessonId={lessonId}
              baseClassId={baseClassId}
            />
          )}
        </DialogContent>
      </Dialog>

      {/* AI Question Generation Configuration Dialog */}
      <QuestionDistributionDialog
        isOpen={isGenerationDialogOpen}
        onClose={() => setIsGenerationDialogOpen(false)}
        onGenerate={handleGenerateFromContent}
        baseClassInfo={baseClassInfo || undefined}
        isLoading={isGenerating}
      />
    </div>
  );
};