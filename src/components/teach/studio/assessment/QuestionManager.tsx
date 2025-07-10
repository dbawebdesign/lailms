'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { Database } from '../../../../../packages/types/db';
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
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';

type Question = Database['public']['Tables']['assessment_questions']['Row'] & {
  // Legacy fields that may not exist in current DB schema but are expected by UI
  difficulty_score?: number;
  cognitive_level?: string;
  tags?: string[];
  learning_objectives?: string[];
  estimated_time?: number;
  folder_id?: string;
  ai_generated?: boolean;
  legacy_question_text?: string;
  lesson_content_refs?: any;
  validation_status?: string;
};
// Quizzes table doesn't exist in current schema, use assessments instead
type Quiz = Database['public']['Tables']['assessments']['Row'];

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

  const loadQuestions = useCallback(async () => {
    setIsLoading(true);
    try {
      // Fetch questions for this base class
      const response = await fetch(`/api/teach/base-classes/${baseClassId}/questions`);
      if (response.ok) {
        const data = await response.json();
        setQuestions(data.questions || []);
      } else {
        console.error('Failed to fetch questions:', response.statusText);
        setQuestions([]);
      }
    } catch (error) {
      console.error('Failed to load questions:', error);
      setQuestions([]);
    } finally {
      setIsLoading(false);
    }
  }, [baseClassId]);

  const loadQuizzes = useCallback(async () => {
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
  }, []);

  const loadBaseClassInfo = useCallback(async () => {
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
  }, [baseClassId]);

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
  }, [baseClassId, loadQuestions, loadQuizzes, loadBaseClassInfo]);

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

  const handleCreateQuestion = (type: string) => {
    const newQuestion: Partial<Question> = {
      question_type: type as Question['question_type'],
      question_text: '',
      points: 1,
      order_index: questions.length,
      difficulty_score: 2, // Corresponds to medium
      cognitive_level: 'understand',
      learning_objectives: [],
      tags: [],
      estimated_time: 2,
      lesson_content_refs: lessonId ? [lessonId] : [],
      ai_generated: false,
      validation_status: 'draft'
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

  const handleSaveQuestion = async (questionData: Partial<Question>) => {
    try {
      const questionToSave = { ...selectedQuestion, ...questionData };
      
      const response = await fetch(
        questionToSave.id 
          ? `/api/teach/questions/${questionToSave.id}` 
          : '/api/teach/questions', 
        {
          method: questionToSave.id ? 'PUT' : 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ ...questionToSave, base_class_id: baseClassId }),
        }
      );

      if (response.ok) {
        const savedQuestion = await response.json();
        if (questionToSave.id) {
          setQuestions(questions.map(q => q.id === savedQuestion.id ? savedQuestion : q));
        } else {
          setQuestions([...questions, savedQuestion]);
        }
        setIsEditorOpen(false);
        setSelectedQuestion(null);
      } else {
        // TODO: Add user-facing error handling
        console.error('Failed to save question');
      }
    } catch (error) {
      console.error('Error saving question:', error);
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
    const searchTermMatch = question.question_text?.toLowerCase().includes(searchTerm.toLowerCase());
    const typeMatch = selectedQuestionType === 'all' || question.question_type === selectedQuestionType;
    const difficultyMatch = selectedDifficulty === 'all' || (question.difficulty_score && difficultyMap[question.difficulty_score] === selectedDifficulty);
    const tagsMatch = selectedTags.length === 0 || selectedTags.every(tag => question.tags?.includes(tag));
    return searchTermMatch && typeMatch && difficultyMatch && tagsMatch;
  });

  const difficultyMap: { [key: number]: string } = {
    1: 'easy',
    2: 'medium',
    3: 'hard'
  };

  const allTags = Array.from(new Set(questions.flatMap(q => q.tags || [])));

  const renderQuestionCard = (question: Question) => {
    const typeInfo = questionTypes.find(t => t.id === question.question_type);

    return (
      <Card key={question.id} className="mb-4 group hover:shadow-lg transition-shadow duration-200">
        <CardContent className="p-4">
          <div className="flex justify-between items-start">
            <div className="flex-grow">
              <p className="font-semibold">{question.question_text || 'Untitled Question'}</p>
              <div className="flex items-center text-sm text-muted-foreground mt-2 flex-wrap">
                {typeInfo && (
                  <Badge variant="outline" className={cn('mr-2 mb-1', typeInfo.color)}>
                    <typeInfo.icon className="w-3 h-3 mr-1" />
                    {typeInfo.label}
                  </Badge>
                )}
                <Badge variant="secondary" className="mr-2 mb-1">
                  <Star className="w-3 h-3 mr-1" />
                  {question.points} pts
                </Badge>
                {question.tags && question.tags.map((tag: string, index: number) => (
                  <Badge key={index} variant="secondary" className="mr-2 mb-1">
                    <Tag className="w-3 h-3 mr-1" />
                    {tag}
                  </Badge>
                ))}
                {question.estimated_time && (
                   <Badge variant="secondary" className="mr-2 mb-1">
                    <Clock className="w-3 h-3 mr-1" />
                    {question.estimated_time} min
                  </Badge>
                )}
                {question.cognitive_level && (
                  <Badge variant="secondary" className="mr-2 mb-1">
                    <Brain className="w-3 h-3 mr-1" />
                    {question.cognitive_level}
                  </Badge>
                )}
              </div>
            </div>
            <div className="flex-shrink-0 flex items-center space-x-1 opacity-0 group-hover:opacity-100 transition-opacity">
              <Button variant="ghost" size="icon" onClick={() => handleEditQuestion(question)}>
                <Edit className="w-4 h-4" />
              </Button>
              <Button variant="ghost" size="icon" onClick={() => { /* copy logic */ }}>
                <Copy className="w-4 h-4" />
              </Button>
              <Button variant="ghost" size="icon" onClick={() => handleDeleteQuestion(question.id)}>
                <Trash2 className="w-4 h-4" />
              </Button>
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="ghost" size="icon">
                    <MoreHorizontal className="w-4 h-4" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent>
                  <DropdownMenuItem onClick={() => setSelectedQuestion(question)}>
                    <BookOpen className="w-4 h-4 mr-2" />
                    Preview
                  </DropdownMenuItem>
                  <DropdownMenuItem>
                    <Settings className="w-4 h-4 mr-2" />
                    Advanced Settings
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
          </div>
        </CardContent>
      </Card>
    );
  };

  return (
    <div className="space-y-4 lg:space-y-6 w-full min-w-0">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div className="min-w-0 flex-1">
          <h2 className="text-xl lg:text-2xl font-bold text-foreground truncate">Question Management</h2>
          <p className="text-sm lg:text-base text-muted-foreground">
            Create and organize assessment questions {lessonId ? 'for this lesson' : 'for your course'}
          </p>
        </div>
        
        {(lessonId || baseClassId) && (
          <Button
            onClick={handleGenerateButtonClick}
            disabled={isGenerating}
            className="bg-gradient-to-r from-purple-600 to-blue-600 flex-shrink-0"
            size="sm"
          >
            <Brain className="h-4 w-4 mr-2" />
            <span className="hidden sm:inline">Generate from Content</span>
            <span className="sm:hidden">Generate</span>
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
          <div className="flex flex-col lg:flex-row gap-4 p-4 bg-muted/30 rounded-lg">
            <div className="flex-1 min-w-0">
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
            
            <div className="flex flex-wrap gap-2 lg:gap-4">
              <Select value={selectedQuestionType} onValueChange={setSelectedQuestionType}>
                <SelectTrigger className="w-full sm:w-40">
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
                <SelectTrigger className="w-full sm:w-32">
                  <SelectValue placeholder="Difficulty" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Levels</SelectItem>
                  <SelectItem value="easy">Easy</SelectItem>
                  <SelectItem value="medium">Medium</SelectItem>
                  <SelectItem value="hard">Hard</SelectItem>
                </SelectContent>
              </Select>
              
              <Button variant="outline" size="sm" className="flex-shrink-0">
                <Filter className="h-4 w-4 mr-2" />
                <span className="hidden sm:inline">More Filters</span>
                <span className="sm:hidden">Filters</span>
              </Button>
            </div>
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
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
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
            baseClassId={baseClassId}
            questions={questions}
            onQuestionsUpdate={setQuestions}
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
              key={selectedQuestion.id}
              question={selectedQuestion}
              onSave={handleSaveQuestion}
              onCancel={() => {
                setIsEditorOpen(false);
                setSelectedQuestion(null);
              }}
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