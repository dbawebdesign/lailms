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
  Settings
} from 'lucide-react';
import { cn } from '@/lib/utils';

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
    estimated_time?: number;
    lesson_content_refs?: string[];
    source_content?: string;
    ai_generated?: boolean;
    validation_status?: 'draft' | 'reviewed' | 'approved' | 'needs_revision';
    category?: string;
    folder_id?: string;
    starred?: boolean;
    archived?: boolean;
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

interface QuestionFolder {
  id: string;
  name: string;
  description?: string;
  parent_id?: string;
  created_at: string;
  updated_at: string;
  color?: string;
  question_count?: number;
}

interface QuestionBankManagerProps {
  questions: Question[];
  onQuestionsUpdate: (questions: Question[]) => void;
  baseClassId: string;
}

export const QuestionBankManager: React.FC<QuestionBankManagerProps> = ({
  questions,
  onQuestionsUpdate,
  baseClassId
}) => {
  const [folders, setFolders] = useState<QuestionFolder[]>([]);
  const [selectedQuestions, setSelectedQuestions] = useState<string[]>([]);
  const [selectedFolder, setSelectedFolder] = useState<string>('all');
  const [selectedTags, setSelectedTags] = useState<string[]>([]);
  const [isCreateFolderOpen, setIsCreateFolderOpen] = useState(false);
  const [isBulkEditOpen, setIsBulkEditOpen] = useState(false);
  const [newFolderName, setNewFolderName] = useState('');
  const [newFolderDescription, setNewFolderDescription] = useState('');
  const [newFolderColor, setNewFolderColor] = useState('#3B82F6');

  // Get all unique tags from questions
  const allTags = Array.from(
    new Set(
      questions.flatMap(q => q.metadata?.tags || [])
    )
  ).sort();

  // Get all unique categories
  const allCategories = Array.from(
    new Set(
      questions.map(q => q.metadata?.category).filter(Boolean)
    )
  ).sort();

  useEffect(() => {
    loadFolders();
  }, [baseClassId]);

  const loadFolders = async () => {
    try {
      // TODO: Implement API call to fetch folders
      // const response = await fetch(`/api/teach/base-classes/${baseClassId}/question-folders`);
      // const data = await response.json();
      // setFolders(data.folders || []);
      
      // Mock folders for now
      setFolders([
        {
          id: '1',
          name: 'Chapter 1 - Introduction',
          description: 'Questions for the introduction chapter',
          color: '#3B82F6',
          question_count: 5,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString()
        },
        {
          id: '2',
          name: 'Midterm Review',
          description: 'Questions for midterm preparation',
          color: '#059669',
          question_count: 12,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString()
        }
      ]);
    } catch (error) {
      console.error('Failed to load folders:', error);
    }
  };

  const createFolder = async () => {
    if (!newFolderName.trim()) return;

    try {
      // TODO: Implement API call to create folder
      const newFolder: QuestionFolder = {
        id: `temp-folder-${Date.now()}`,
        name: newFolderName.trim(),
        description: newFolderDescription.trim() || undefined,
        color: newFolderColor,
        question_count: 0,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      };

      setFolders(prev => [...prev, newFolder]);
      setNewFolderName('');
      setNewFolderDescription('');
      setIsCreateFolderOpen(false);
    } catch (error) {
      console.error('Failed to create folder:', error);
    }
  };

  const handleBulkOperation = async (operation: string) => {
    if (selectedQuestions.length === 0) return;

    try {
      const updatedQuestions = questions.map(question => {
        if (!selectedQuestions.includes(question.id)) return question;

        switch (operation) {
          case 'star':
            return {
              ...question,
              metadata: { ...question.metadata, starred: true }
            };
          case 'unstar':
            return {
              ...question,
              metadata: { ...question.metadata, starred: false }
            };
          case 'archive':
            return {
              ...question,
              metadata: { ...question.metadata, archived: true }
            };
          case 'unarchive':
            return {
              ...question,
              metadata: { ...question.metadata, archived: false }
            };
          default:
            return question;
        }
      });

      onQuestionsUpdate(updatedQuestions);
      setSelectedQuestions([]);
    } catch (error) {
      console.error('Failed to perform bulk operation:', error);
    }
  };

  const moveQuestionsToFolder = async (folderId: string) => {
    if (selectedQuestions.length === 0) return;

    try {
      const updatedQuestions = questions.map(question => {
        if (!selectedQuestions.includes(question.id)) return question;
        
        return {
          ...question,
          metadata: { ...question.metadata, folder_id: folderId }
        };
      });

      onQuestionsUpdate(updatedQuestions);
      setSelectedQuestions([]);
    } catch (error) {
      console.error('Failed to move questions:', error);
    }
  };

  const addTagsToSelected = async (newTags: string[]) => {
    if (selectedQuestions.length === 0 || newTags.length === 0) return;

    try {
      const updatedQuestions = questions.map(question => {
        if (!selectedQuestions.includes(question.id)) return question;
        
        const existingTags = question.metadata?.tags || [];
        const combinedTags = Array.from(new Set([...existingTags, ...newTags]));
        
        return {
          ...question,
          metadata: { ...question.metadata, tags: combinedTags }
        };
      });

      onQuestionsUpdate(updatedQuestions);
      setSelectedQuestions([]);
    } catch (error) {
      console.error('Failed to add tags:', error);
    }
  };

  const filteredQuestions = questions.filter(question => {
    // Filter by folder
    if (selectedFolder !== 'all') {
      if (selectedFolder === 'starred' && !question.metadata?.starred) return false;
      if (selectedFolder === 'archived' && !question.metadata?.archived) return false;
      if (selectedFolder === 'unfoldered' && question.metadata?.folder_id) return false;
      if (selectedFolder !== 'starred' && selectedFolder !== 'archived' && selectedFolder !== 'unfoldered' && 
          question.metadata?.folder_id !== selectedFolder) return false;
    }

    // Filter by tags
    if (selectedTags.length > 0) {
      const questionTags = question.metadata?.tags || [];
      if (!selectedTags.some(tag => questionTags.includes(tag))) return false;
    }

    // Hide archived questions unless specifically viewing archived
    if (selectedFolder !== 'archived' && question.metadata?.archived) return false;

    return true;
  });

  const folderColors = [
    '#3B82F6', '#059669', '#DC2626', '#7C3AED',
    '#EA580C', '#0891B2', '#BE123C', '#4338CA'
  ];

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-semibold">Organize Questions</h3>
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => setIsCreateFolderOpen(true)}
          >
            <FolderPlus className="h-4 w-4 mr-2" />
            New Folder
          </Button>
          
          {selectedQuestions.length > 0 && (
            <Button
              variant="outline"
              size="sm"
              onClick={() => setIsBulkEditOpen(true)}
            >
              <Settings className="h-4 w-4 mr-2" />
              Bulk Edit ({selectedQuestions.length})
            </Button>
          )}
        </div>
      </div>

      <Tabs defaultValue="folders" className="space-y-4">
        <TabsList>
          <TabsTrigger value="folders">Folders</TabsTrigger>
          <TabsTrigger value="tags">Tags</TabsTrigger>
          <TabsTrigger value="categories">Categories</TabsTrigger>
        </TabsList>

        {/* Folders Tab */}
        <TabsContent value="folders" className="space-y-4">
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* Folder Sidebar */}
            <div className="space-y-3">
              <div className="font-medium text-sm text-muted-foreground">FOLDERS</div>
              
              <div 
                className={cn(
                  "flex items-center gap-3 p-3 rounded-lg cursor-pointer transition-colors",
                  selectedFolder === 'all' ? "bg-primary/10 border border-primary/20" : "hover:bg-muted/50"
                )}
                onClick={() => setSelectedFolder('all')}
              >
                <Folder className="h-4 w-4" />
                <span className="flex-1">All Questions</span>
                <Badge variant="secondary" className="text-xs">
                  {questions.filter(q => !q.metadata?.archived).length}
                </Badge>
              </div>

              <div 
                className={cn(
                  "flex items-center gap-3 p-3 rounded-lg cursor-pointer transition-colors",
                  selectedFolder === 'starred' ? "bg-primary/10 border border-primary/20" : "hover:bg-muted/50"
                )}
                onClick={() => setSelectedFolder('starred')}
              >
                <Star className="h-4 w-4" />
                <span className="flex-1">Starred</span>
                <Badge variant="secondary" className="text-xs">
                  {questions.filter(q => q.metadata?.starred && !q.metadata?.archived).length}
                </Badge>
              </div>

              <div 
                className={cn(
                  "flex items-center gap-3 p-3 rounded-lg cursor-pointer transition-colors",
                  selectedFolder === 'unfoldered' ? "bg-primary/10 border border-primary/20" : "hover:bg-muted/50"
                )}
                onClick={() => setSelectedFolder('unfoldered')}
              >
                <Folder className="h-4 w-4" />
                <span className="flex-1">Unfoldered</span>
                <Badge variant="secondary" className="text-xs">
                  {questions.filter(q => !q.metadata?.folder_id && !q.metadata?.archived).length}
                </Badge>
              </div>

              {folders.map(folder => (
                <div 
                  key={folder.id}
                  className={cn(
                    "flex items-center gap-3 p-3 rounded-lg cursor-pointer transition-colors",
                    selectedFolder === folder.id ? "bg-primary/10 border border-primary/20" : "hover:bg-muted/50"
                  )}
                  onClick={() => setSelectedFolder(folder.id)}
                >
                  <div 
                    className="w-4 h-4 rounded"
                    style={{ backgroundColor: folder.color }}
                  />
                  <span className="flex-1">{folder.name}</span>
                  <Badge variant="secondary" className="text-xs">
                    {questions.filter(q => q.metadata?.folder_id === folder.id && !q.metadata?.archived).length}
                  </Badge>
                </div>
              ))}

              <div 
                className={cn(
                  "flex items-center gap-3 p-3 rounded-lg cursor-pointer transition-colors",
                  selectedFolder === 'archived' ? "bg-primary/10 border border-primary/20" : "hover:bg-muted/50"
                )}
                onClick={() => setSelectedFolder('archived')}
              >
                <Archive className="h-4 w-4" />
                <span className="flex-1">Archived</span>
                <Badge variant="secondary" className="text-xs">
                  {questions.filter(q => q.metadata?.archived).length}
                </Badge>
              </div>
            </div>

            {/* Questions List */}
            <div className="lg:col-span-2 space-y-3">
              <div className="flex items-center justify-between">
                <div className="font-medium text-sm text-muted-foreground">
                  QUESTIONS ({filteredQuestions.length})
                </div>
                
                {filteredQuestions.length > 0 && (
                  <div className="flex items-center gap-2">
                    <Checkbox
                      checked={selectedQuestions.length === filteredQuestions.length}
                      onCheckedChange={(checked) => {
                        if (checked) {
                          setSelectedQuestions(filteredQuestions.map(q => q.id));
                        } else {
                          setSelectedQuestions([]);
                        }
                      }}
                    />
                    <Label className="text-xs text-muted-foreground">Select All</Label>
                  </div>
                )}
              </div>

              {filteredQuestions.length === 0 ? (
                <div className="text-center py-8">
                  <Folder className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
                  <p className="text-muted-foreground">No questions in this folder</p>
                </div>
              ) : (
                <div className="space-y-2">
                  {filteredQuestions.map(question => (
                    <Card key={question.id} className="p-3">
                      <div className="flex items-center gap-3">
                        <Checkbox
                          checked={selectedQuestions.includes(question.id)}
                          onCheckedChange={(checked) => {
                            if (checked) {
                              setSelectedQuestions(prev => [...prev, question.id]);
                            } else {
                              setSelectedQuestions(prev => prev.filter(id => id !== question.id));
                            }
                          }}
                        />
                        
                        <div className="flex-1">
                          <p className="font-medium text-sm line-clamp-1">
                            {question.question_text || 'Untitled Question'}
                          </p>
                          <div className="flex items-center gap-2 mt-1">
                            <Badge variant="outline" className="text-xs">
                              {question.question_type.replace('_', ' ')}
                            </Badge>
                            {question.metadata?.starred && (
                              <Star className="h-3 w-3 text-yellow-500 fill-current" />
                            )}
                            {question.metadata?.tags && question.metadata.tags.length > 0 && (
                              <div className="flex items-center gap-1">
                                <TagIcon className="h-3 w-3 text-muted-foreground" />
                                <span className="text-xs text-muted-foreground">
                                  {question.metadata.tags.slice(0, 2).join(', ')}
                                  {question.metadata.tags.length > 2 && ` +${question.metadata.tags.length - 2}`}
                                </span>
                              </div>
                            )}
                          </div>
                        </div>
                        
                        <Button variant="ghost" size="sm">
                          <MoreHorizontal className="h-4 w-4" />
                        </Button>
                      </div>
                    </Card>
                  ))}
                </div>
              )}
            </div>
          </div>
        </TabsContent>

        {/* Tags Tab */}
        <TabsContent value="tags" className="space-y-4">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <Card className="p-4">
              <CardHeader className="p-0 pb-4">
                <CardTitle className="text-base">All Tags</CardTitle>
              </CardHeader>
              <CardContent className="p-0">
                <div className="flex flex-wrap gap-2">
                  {allTags.map(tag => {
                    const questionCount = questions.filter(q => 
                      q.metadata?.tags?.includes(tag) && !q.metadata?.archived
                    ).length;
                    
                    return (
                      <div
                        key={tag}
                        className={cn(
                          "flex items-center gap-2 px-3 py-2 rounded-lg border cursor-pointer transition-colors",
                          selectedTags.includes(tag) 
                            ? "bg-primary/10 border-primary/20" 
                            : "hover:bg-muted/50"
                        )}
                        onClick={() => {
                          if (selectedTags.includes(tag)) {
                            setSelectedTags(prev => prev.filter(t => t !== tag));
                          } else {
                            setSelectedTags(prev => [...prev, tag]);
                          }
                        }}
                      >
                        <TagIcon className="h-3 w-3" />
                        <span className="text-sm">{tag}</span>
                        <Badge variant="secondary" className="text-xs">
                          {questionCount}
                        </Badge>
                      </div>
                    );
                  })}
                </div>
              </CardContent>
            </Card>

            <Card className="p-4">
              <CardHeader className="p-0 pb-4">
                <CardTitle className="text-base">Tag Analytics</CardTitle>
              </CardHeader>
              <CardContent className="p-0">
                <div className="space-y-3">
                  {allTags.slice(0, 10).map(tag => {
                    const questionCount = questions.filter(q => 
                      q.metadata?.tags?.includes(tag) && !q.metadata?.archived
                    ).length;
                    const percentage = questions.length > 0 ? (questionCount / questions.length) * 100 : 0;
                    
                    return (
                      <div key={tag} className="flex items-center gap-3">
                        <div className="flex-1">
                          <div className="flex items-center justify-between mb-1">
                            <span className="text-sm font-medium">{tag}</span>
                            <span className="text-xs text-muted-foreground">{questionCount}</span>
                          </div>
                          <div className="w-full bg-gray-200 rounded-full h-2">
                            <div 
                              className="bg-primary h-2 rounded-full" 
                              style={{ width: `${percentage}%` }}
                            />
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        {/* Categories Tab */}
        <TabsContent value="categories" className="space-y-4">
          <div className="text-center py-8">
            <Settings className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
            <p className="text-muted-foreground">Category management coming soon</p>
          </div>
        </TabsContent>
      </Tabs>

      {/* Create Folder Dialog */}
      <Dialog open={isCreateFolderOpen} onOpenChange={setIsCreateFolderOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Create New Folder</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label>Folder Name</Label>
              <Input
                value={newFolderName}
                onChange={(e) => setNewFolderName(e.target.value)}
                placeholder="Enter folder name"
              />
            </div>
            
            <div>
              <Label>Description (Optional)</Label>
              <Input
                value={newFolderDescription}
                onChange={(e) => setNewFolderDescription(e.target.value)}
                placeholder="Enter folder description"
              />
            </div>
            
            <div>
              <Label>Color</Label>
              <div className="flex gap-2 mt-2">
                {folderColors.map(color => (
                  <div
                    key={color}
                    className={cn(
                      "w-8 h-8 rounded cursor-pointer border-2",
                      newFolderColor === color ? "border-gray-900" : "border-gray-300"
                    )}
                    style={{ backgroundColor: color }}
                    onClick={() => setNewFolderColor(color)}
                  />
                ))}
              </div>
            </div>
            
            <div className="flex items-center gap-3 pt-4">
              <Button variant="outline" onClick={() => setIsCreateFolderOpen(false)}>
                Cancel
              </Button>
              <Button onClick={createFolder} disabled={!newFolderName.trim()}>
                Create Folder
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Bulk Edit Dialog */}
      <Dialog open={isBulkEditOpen} onOpenChange={setIsBulkEditOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Bulk Edit Questions ({selectedQuestions.length})</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-3">
              <Button
                variant="outline"
                onClick={() => handleBulkOperation('star')}
                className="flex items-center gap-2"
              >
                <Star className="h-4 w-4" />
                Star All
              </Button>
              <Button
                variant="outline"
                onClick={() => handleBulkOperation('unstar')}
                className="flex items-center gap-2"
              >
                <Star className="h-4 w-4" />
                Unstar All
              </Button>
              <Button
                variant="outline"
                onClick={() => handleBulkOperation('archive')}
                className="flex items-center gap-2"
              >
                <Archive className="h-4 w-4" />
                Archive All
              </Button>
              <Button
                variant="outline"
                onClick={() => handleBulkOperation('unarchive')}
                className="flex items-center gap-2"
              >
                <Archive className="h-4 w-4" />
                Unarchive All
              </Button>
            </div>
            
            <div>
              <Label>Move to Folder</Label>
              <Select onValueChange={moveQuestionsToFolder}>
                <SelectTrigger>
                  <SelectValue placeholder="Select a folder" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="">No folder</SelectItem>
                  {folders.map(folder => (
                    <SelectItem key={folder.id} value={folder.id}>
                      {folder.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
};