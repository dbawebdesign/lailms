'use client';

import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Checkbox } from '@/components/ui/checkbox';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { 
  Tag, 
  Folder, 
  Plus, 
  Edit, 
  Trash2, 
  Move, 
  Copy, 
  Download, 
  Upload,
  Filter,
  MoreHorizontal,
  Archive,
  Star,
  FolderPlus,
  TagIcon,
  CheckSquare,
  Settings,
  BookOpen,
  HelpCircle,
  Search
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { Database } from '../../../../../packages/types/db';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { TwitterPicker } from 'react-color';
import { DragDropContext, Droppable, Draggable, DropResult } from '@hello-pangea/dnd';
import { QuestionEditor } from './QuestionEditor';

// Use the proper database types
type Question = Database['public']['Tables']['questions']['Row'];
type QuestionFolder = Database['public']['Tables']['question_folders']['Row'];

interface QuestionBankManagerProps {
  questions: Question[];
  onQuestionsUpdate: (questions: Question[]) => void;
  baseClassId: string;
}

interface QuestionPreviewProps {
  question: Question;
}

const QuestionPreview: React.FC<QuestionPreviewProps> = ({ question }) => {
  const renderAnswerChoices = () => {
    if (question.question_type === 'multiple_choice' && question.options) {
      try {
        const options = typeof question.options === 'string' 
          ? JSON.parse(question.options) 
          : question.options;
        
        if (Array.isArray(options)) {
          return (
            <div className="space-y-2">
              <h5 className="font-medium text-sm">Answer Choices:</h5>
              {options.map((option: any, index: number) => (
                <div key={index} className={`p-2 rounded border ${option.is_correct ? 'bg-green-50 dark:bg-green-900/20 border-green-200 dark:border-green-800' : 'bg-muted/50 border-border'}`}>
                  <div className="flex items-center gap-2">
                    <span className="font-medium text-xs text-muted-foreground">
                      {String.fromCharCode(65 + index)}.
                    </span>
                    <span className="text-sm">{option.option_text || option.text}</span>
                    {option.is_correct && (
                      <Badge variant="default" className="ml-auto text-xs bg-green-600 dark:bg-green-700">
                        Correct
                      </Badge>
                    )}
                  </div>
                </div>
              ))}
            </div>
          );
        }
      } catch (error) {
        console.error('Error parsing question options:', error);
      }
    }

    if (question.question_type === 'true_false') {
      return (
        <div className="space-y-2">
          <h5 className="font-medium text-sm">Answer Choices:</h5>
          <div className={`p-2 rounded border ${question.correct_answer === 'true' ? 'bg-green-50 dark:bg-green-900/20 border-green-200 dark:border-green-800' : 'bg-muted/50 border-border'}`}>
            <div className="flex items-center gap-2">
              <span className="font-medium text-xs text-muted-foreground">A.</span>
              <span className="text-sm">True</span>
              {question.correct_answer === 'true' && (
                <Badge variant="default" className="ml-auto text-xs bg-green-600 dark:bg-green-700">
                  Correct
                </Badge>
              )}
            </div>
          </div>
          <div className={`p-2 rounded border ${question.correct_answer === 'false' ? 'bg-green-50 dark:bg-green-900/20 border-green-200 dark:border-green-800' : 'bg-muted/50 border-border'}`}>
            <div className="flex items-center gap-2">
              <span className="font-medium text-xs text-muted-foreground">B.</span>
              <span className="text-sm">False</span>
              {question.correct_answer === 'false' && (
                <Badge variant="default" className="ml-auto text-xs bg-green-600 dark:bg-green-700">
                  Correct
                </Badge>
              )}
            </div>
          </div>
        </div>
      );
    }

    if ((question.question_type === 'short_answer' || question.question_type === 'long_answer') && question.correct_answer) {
      return (
        <div className="space-y-2">
          <h5 className="font-medium text-sm">Sample Answer:</h5>
          <div className="p-3 bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded">
            <p className="text-sm">{question.correct_answer}</p>
          </div>
        </div>
      );
    }

    return null;
  };

  return (
    <div className="space-y-4">
      <div>
        <h4 className="font-medium mb-2">Question</h4>
        <p className="text-sm leading-relaxed">{question.question_text || question.legacy_question_text}</p>
      </div>

      {renderAnswerChoices()}

      <div className="flex items-center gap-2 flex-wrap">
        <Badge variant="secondary">{question.question_type?.replace('_', ' ')}</Badge>
        {question.points && <Badge variant="outline">{question.points} pts</Badge>}
        {question.difficulty_score && (
          <Badge variant="outline">
            {question.difficulty_score <= 3 ? 'Easy' : 
             question.difficulty_score <= 7 ? 'Medium' : 'Hard'}
          </Badge>
        )}
        {question.cognitive_level && (
          <Badge variant="secondary">{question.cognitive_level}</Badge>
        )}
      </div>

      {question.estimated_time && (
        <div className="text-sm text-muted-foreground">
          <strong>Estimated Time:</strong> {question.estimated_time} minutes
        </div>
      )}
    </div>
  );
};

export const QuestionBankManager: React.FC<QuestionBankManagerProps> = ({
  questions,
  onQuestionsUpdate,
  baseClassId
}) => {
  const [activeQuestion, setActiveQuestion] = useState<Question | null>(null);
  const [folders, setFolders] = useState<QuestionFolder[]>([]);
  const [selectedQuestions, setSelectedQuestions] = useState<string[]>([]);
  const [selectedFolder, setSelectedFolder] = useState<string>('all');
  const [selectedTags, setSelectedTags] = useState<string[]>([]);
  const [isCreateFolderOpen, setIsCreateFolderOpen] = useState(false);
  const [isPreviewOpen, setIsPreviewOpen] = useState(false);
  const [isBulkEditOpen, setIsBulkEditOpen] = useState(false);
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [questionToEdit, setQuestionToEdit] = useState<Question | null>(null);
  const [newFolderName, setNewFolderName] = useState('');
  const [newFolderDescription, setNewFolderDescription] = useState('');
  const [newFolderColor, setNewFolderColor] = useState('#3B82F6');
  const [activeFolderId, setActiveFolderId] = useState<string | null>(null);

  // const allTags = Array.from(new Set(questions.flatMap(q => q.tags || []))).sort();
  // const allCategories = Array.from(new Set(questions.map(q => q.category).filter(Boolean))).sort() as string[];

  useEffect(() => {
    const loadFolders = async () => {
      if (!baseClassId) return;
      
      // Basic UUID validation
      const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
      if (!uuidRegex.test(baseClassId)) {
        console.error('Invalid baseClassId format:', baseClassId);
        return;
      }
      
      try {
        const response = await fetch(`/api/teach/question-folders?base_class_id=${baseClassId}`);
        const data = await response.json();
        if (response.ok) {
          setFolders(data);
        } else {
          throw new Error(data.error || 'Failed to fetch folders');
        }
      } catch (error) {
        console.error('Failed to load folders:', error);
        // Set empty folders array so UI doesn't break
        setFolders([]);
      }
    };
    loadFolders();
  }, [baseClassId]);

  useEffect(() => {
    if (questions.length > 0 && !activeQuestion) {
      setActiveQuestion(questions[0]);
    }
  }, [questions, activeQuestion]);

  const createFolder = async () => {
    if (!newFolderName.trim()) return;
    const newFolder: QuestionFolder = {
      id: `temp-folder-${Date.now()}`, name: newFolderName.trim(),
      description: newFolderDescription.trim() || null, color: newFolderColor,
      created_at: new Date().toISOString(), updated_at: new Date().toISOString(),
      base_class_id: baseClassId, created_by: 'user-1', parent_id: null,
    };
    setFolders(prev => [...prev, newFolder]);
    setNewFolderName('');
    setNewFolderDescription('');
    setIsCreateFolderOpen(false);
  };

  const handleQuestionClick = (question: Question) => {
    setActiveQuestion(question);
    setIsPreviewOpen(true);
  };

  const handleEditQuestion = (question: Question) => {
    setQuestionToEdit(question);
    setIsEditModalOpen(true);
  };

  const handleSaveQuestion = (updatedQuestion: Question) => {
    // Update the question in the list
    const updatedQuestions = questions.map(q => 
      q.id === updatedQuestion.id ? updatedQuestion : q
    );
    onQuestionsUpdate(updatedQuestions);
    setIsEditModalOpen(false);
    setQuestionToEdit(null);
  };

  const handleDeleteQuestion = async (questionId: string) => {
    if (confirm('Are you sure you want to delete this question?')) {
      try {
        // Call API to delete question
        const response = await fetch(`/api/teach/questions/${questionId}`, {
          method: 'DELETE',
        });
        
        if (response.ok) {
          // Remove from local state
          const updatedQuestions = questions.filter(q => q.id !== questionId);
          onQuestionsUpdate(updatedQuestions);
        } else {
          console.error('Failed to delete question');
        }
      } catch (error) {
        console.error('Error deleting question:', error);
      }
    }
  };

  const handleDuplicateQuestion = (question: Question) => {
    const duplicatedQuestion: Question = {
      ...question,
      id: `temp-${Date.now()}`, // Temporary ID until saved
      question_text: `${question.question_text} (Copy)`,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };
    
    const updatedQuestions = [...questions, duplicatedQuestion];
    onQuestionsUpdate(updatedQuestions);
  };

  const filteredQuestions = questions.filter(question => {
    if (selectedFolder !== 'all') {
      // if (selectedFolder === 'starred' && !question.is_starred) return false;
      // if (selectedFolder === 'archived' && !question.is_archived) return false;
      if (selectedFolder === 'unfoldered' && question.folder_id) return false;
      if (!['starred', 'archived', 'unfoldered'].includes(selectedFolder) && question.folder_id !== selectedFolder) return false;
    }
    // if (selectedFolder !== 'archived' && question.is_archived) return false;
    return true;
  });

  const folderColors = ['#3B82F6', '#059669', '#DC2626', '#7C3AED', '#EA580C', '#0891B2', '#BE123C', '#4338CA'];

  const handleDragEnd = (result: DropResult) => {
    // Handle drag end logic here if needed
    // For now, we'll just log it since it's primarily for organizing
    console.log('Drag ended:', result);
  };

  return (
    <DragDropContext onDragEnd={handleDragEnd}>
      <div className="space-y-6">
        {/* Top Actions Bar */}
        <div className="flex flex-wrap items-center justify-between gap-4 p-4 bg-muted/30 rounded-lg">
          <div className="flex flex-wrap items-center gap-2">
            <Button variant="outline" size="sm" onClick={() => { /* Implement create question */ }}>
              <Plus className="h-4 w-4 mr-2" />
              Create Question
            </Button>
            <Button variant="outline" size="sm" onClick={() => setIsCreateFolderOpen(true)}>
              <FolderPlus className="h-4 w-4 mr-2" />
              Create Folder
            </Button>
          </div>
          
          <div className="flex items-center gap-2">
            <Input 
              placeholder="Search questions..." 
              className="w-64"
              // Add search functionality here
            />
          </div>
        </div>

        {/* Main Content Layout - 2 columns */}
        <div className="grid grid-cols-1 lg:grid-cols-5 gap-6">
          {/* Left Sidebar - Filters and Folders */}
          <div className="lg:col-span-1 space-y-4">
            {/* Filters */}
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-sm font-semibold uppercase text-muted-foreground">Filters</CardTitle>
              </CardHeader>
              <CardContent className="space-y-1">
                <Button 
                  variant={selectedFolder === 'all' ? 'secondary' : 'ghost'} 
                  size="sm" 
                  className="w-full justify-start gap-2" 
                  onClick={() => setSelectedFolder('all')}
                >
                  <Folder className="h-4 w-4" />
                  All Questions
                </Button>
                <Button 
                  variant={selectedFolder === 'starred' ? 'secondary' : 'ghost'} 
                  size="sm" 
                  className="w-full justify-start gap-2" 
                  onClick={() => setSelectedFolder('starred')}
                >
                  <Star className="h-4 w-4" />
                  Starred
                </Button>
                <Button 
                  variant={selectedFolder === 'unfoldered' ? 'secondary' : 'ghost'} 
                  size="sm" 
                  className="w-full justify-start gap-2" 
                  onClick={() => setSelectedFolder('unfoldered')}
                >
                  <Folder className="h-4 w-4" />
                  Unfoldered
                </Button>
                <Button 
                  variant={selectedFolder === 'archived' ? 'secondary' : 'ghost'} 
                  size="sm" 
                  className="w-full justify-start gap-2" 
                  onClick={() => setSelectedFolder('archived')}
                >
                  <Archive className="h-4 w-4" />
                  Archived
                </Button>
              </CardContent>
            </Card>

            {/* Folders */}
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-sm font-semibold uppercase text-muted-foreground">Folders</CardTitle>
              </CardHeader>
              <CardContent className="space-y-1">
                {folders.map(folder => (
                  <Button 
                    key={folder.id} 
                    variant={selectedFolder === folder.id ? 'secondary' : 'ghost'} 
                    size="sm" 
                    className="w-full justify-start gap-2" 
                    onClick={() => setSelectedFolder(folder.id)}
                  >
                    <Folder className="h-4 w-4" style={{ color: folder.color || undefined }}/>
                    <span className="truncate">{folder.name}</span>
                  </Button>
                ))}
              </CardContent>
            </Card>
          </div>

          {/* Main Content - Questions List */}
          <div className="lg:col-span-4">
            <Card>
              <CardHeader className="pb-4">
                <div className="flex items-center justify-between">
                  <CardTitle>Questions ({filteredQuestions.length})</CardTitle>
                  <div className="flex items-center gap-2">
                    <Badge variant="secondary" className="text-xs">
                      {selectedFolder === 'all' ? 'All' : selectedFolder.charAt(0).toUpperCase() + selectedFolder.slice(1)}
                    </Badge>
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                <Droppable droppableId="question-bank" isDropDisabled={true}>
                  {(provided, snapshot) => (
                    <div 
                      ref={provided.innerRef}
                      {...provided.droppableProps}
                      className="space-y-3 max-h-[700px] overflow-y-auto"
                    >
                      {filteredQuestions.length > 0 ? (
                        filteredQuestions.map((q, index) => (
                          <Draggable key={q.id} draggableId={q.id} index={index}>
                            {(provided, snapshot) => (
                              <div
                                ref={provided.innerRef}
                                {...provided.draggableProps}
                                className={`transition-all ${
                                  snapshot.isDragging ? 'opacity-50 shadow-lg' : 'hover:shadow-md'
                                }`}
                              >
                                <Card className="cursor-pointer hover:bg-muted/50">
                                  <CardContent className="p-4">
                                    <div className="flex items-start justify-between gap-4">
                                      {/* Drag Handle */}
                                      <div 
                                        {...provided.dragHandleProps}
                                        className="mt-1 cursor-grab active:cursor-grabbing"
                                      >
                                        <div className="w-2 h-4 flex flex-col gap-0.5">
                                          <div className="w-full h-0.5 bg-muted-foreground/30 rounded"></div>
                                          <div className="w-full h-0.5 bg-muted-foreground/30 rounded"></div>
                                          <div className="w-full h-0.5 bg-muted-foreground/30 rounded"></div>
                                        </div>
                                      </div>

                                      {/* Question Content */}
                                      <div 
                                        className="flex-1 min-w-0 cursor-pointer" 
                                        onClick={() => handleQuestionClick(q)}
                                      >
                                        <p className="font-medium text-sm line-clamp-2 mb-2">
                                          {q.question_text}
                                        </p>
                                        <div className="flex items-center gap-2 flex-wrap">
                                          <Badge variant="secondary" className="text-xs">
                                            {q.question_type?.replace('_', ' ')}
                                          </Badge>
                                          {q.points && (
                                            <Badge variant="outline" className="text-xs">
                                              {q.points} pts
                                            </Badge>
                                          )}
                                          {q.difficulty_score && (
                                            <Badge variant="outline" className="text-xs">
                                              {q.difficulty_score === 1 ? 'Easy' : 
                                               q.difficulty_score === 2 ? 'Medium' : 'Hard'}
                                            </Badge>
                                          )}
                                        </div>
                                      </div>

                                      {/* Action Buttons */}
                                      <div className="flex items-center gap-1">
                                        <Button 
                                          variant="ghost" 
                                          size="icon" 
                                          className="h-8 w-8"
                                          onClick={(e) => {
                                            e.stopPropagation();
                                            handleQuestionClick(q);
                                          }}
                                          title="Preview Question"
                                        >
                                          <BookOpen className="h-4 w-4" />
                                        </Button>
                                        <Button 
                                          variant="ghost" 
                                          size="icon" 
                                          className="h-8 w-8"
                                          onClick={(e) => {
                                            e.stopPropagation();
                                            handleEditQuestion(q);
                                          }}
                                          title="Edit Question"
                                        >
                                          <Edit className="h-4 w-4" />
                                        </Button>
                                        <DropdownMenu>
                                          <DropdownMenuTrigger asChild>
                                            <Button 
                                              variant="ghost" 
                                              size="icon" 
                                              className="h-8 w-8"
                                              onClick={(e) => e.stopPropagation()}
                                              title="More Actions"
                                            >
                                              <MoreHorizontal className="h-4 w-4" />
                                            </Button>
                                          </DropdownMenuTrigger>
                                          <DropdownMenuContent align="end">
                                            <DropdownMenuItem onClick={() => handleDuplicateQuestion(q)}>
                                              <Copy className="h-4 w-4 mr-2" />
                                              Duplicate
                                            </DropdownMenuItem>
                                            <DropdownMenuItem onClick={() => handleDeleteQuestion(q.id)}>
                                              <Trash2 className="h-4 w-4 mr-2" />
                                              Delete
                                            </DropdownMenuItem>
                                            <DropdownMenuItem onClick={() => {
                                              // TODO: Implement move to folder
                                            }}>
                                              <Move className="h-4 w-4 mr-2" />
                                              Move to Folder
                                            </DropdownMenuItem>
                                            <DropdownMenuItem onClick={() => {
                                              // TODO: Implement archive
                                            }}>
                                              <Archive className="h-4 w-4 mr-2" />
                                              Archive
                                            </DropdownMenuItem>
                                          </DropdownMenuContent>
                                        </DropdownMenu>
                                      </div>
                                    </div>
                                  </CardContent>
                                </Card>
                              </div>
                            )}
                          </Draggable>
                        ))
                      ) : (
                        <div className="text-center py-12">
                          <div className="max-w-sm mx-auto">
                            <div className="bg-muted/30 rounded-full w-16 h-16 flex items-center justify-center mx-auto mb-4">
                              <HelpCircle className="h-8 w-8 text-muted-foreground" />
                            </div>
                            <h3 className="font-medium text-lg mb-2">No questions found</h3>
                            <p className="text-sm text-muted-foreground mb-4">
                              {selectedFolder === 'all' 
                                ? "Get started by creating your first question" 
                                : `No questions in ${selectedFolder}`}
                            </p>
                            <Button size="sm" onClick={() => { /* Implement create question */ }}>
                              <Plus className="h-4 w-4 mr-2" />
                              Create Question
                            </Button>
                          </div>
                        </div>
                      )}
                      {provided.placeholder}
                    </div>
                  )}
                </Droppable>
              </CardContent>
            </Card>
          </div>
        </div>

        {/* Question Preview Modal */}
        <Dialog open={isPreviewOpen} onOpenChange={setIsPreviewOpen}>
          <DialogContent className="max-w-3xl max-h-[80vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>Question Preview</DialogTitle>
            </DialogHeader>
            {activeQuestion && (
              <div className="mt-4">
                <QuestionPreview question={activeQuestion} />
              </div>
            )}
          </DialogContent>
        </Dialog>

        {/* Create Folder Dialog */}
        <Dialog open={isCreateFolderOpen} onOpenChange={setIsCreateFolderOpen}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Create New Folder</DialogTitle>
            </DialogHeader>
            <div className="grid gap-4 py-4">
              <div className="grid grid-cols-4 items-center gap-4">
                <Label htmlFor="folder-name" className="text-right">Name</Label>
                <Input 
                  id="folder-name" 
                  value={newFolderName} 
                  onChange={(e) => setNewFolderName(e.target.value)} 
                  className="col-span-3" 
                />
              </div>
              <div className="grid grid-cols-4 items-center gap-4">
                <Label htmlFor="folder-desc" className="text-right">Description</Label>
                <Input 
                  id="folder-desc" 
                  value={newFolderDescription} 
                  onChange={(e) => setNewFolderDescription(e.target.value)} 
                  className="col-span-3" 
                />
              </div>
              <div className="grid grid-cols-4 items-center gap-4">
                <Label className="text-right">Color</Label>
                <div className="col-span-3 flex gap-2 flex-wrap">
                  {folderColors.map(color => (
                    <Button
                      key={color}
                      size="icon"
                      variant={newFolderColor === color ? 'default' : 'outline'}
                      className="h-8 w-8 rounded-full"
                      style={{ backgroundColor: newFolderColor === color ? color : undefined, borderColor: color }}
                      onClick={() => setNewFolderColor(color)}
                    >
                      <div className="h-4 w-4 rounded-full" style={{ backgroundColor: color }}></div>
                    </Button>
                  ))}
                </div>
              </div>
            </div>
            <Button onClick={createFolder} className="w-full">Create Folder</Button>
          </DialogContent>
        </Dialog>

        {/* Question Editor Modal */}
        <Dialog open={isEditModalOpen} onOpenChange={setIsEditModalOpen}>
          <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>Edit Question</DialogTitle>
            </DialogHeader>
            {questionToEdit && (
              <QuestionEditor
                question={questionToEdit}
                onSave={handleSaveQuestion}
                onCancel={() => {
                  setIsEditModalOpen(false);
                  setQuestionToEdit(null);
                }}
                baseClassId={baseClassId}
              />
            )}
          </DialogContent>
        </Dialog>
      </div>
    </DragDropContext>
  );
};