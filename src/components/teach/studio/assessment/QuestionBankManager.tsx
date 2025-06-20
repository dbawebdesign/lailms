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
import { Database } from '../../../../../packages/types/db';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { TwitterPicker } from 'react-color';
import { QuestionPreview } from './QuestionPreview';
import { DragDropContext, Droppable, Draggable, DropResult } from '@hello-pangea/dnd';

type Question = Database['public']['Tables']['questions']['Row'];
type QuestionOption = Database['public']['Tables']['question_options']['Row'];
type QuestionFolder = Database['public']['Tables']['question_folders']['Row'];

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
  const [activeQuestion, setActiveQuestion] = useState<Question | null>(null);
  const [folders, setFolders] = useState<QuestionFolder[]>([]);
  const [selectedQuestions, setSelectedQuestions] = useState<string[]>([]);
  const [selectedFolder, setSelectedFolder] = useState<string>('all');
  const [selectedTags, setSelectedTags] = useState<string[]>([]);
  const [isCreateFolderOpen, setIsCreateFolderOpen] = useState(false);
  const [isBulkEditOpen, setIsBulkEditOpen] = useState(false);
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
      <div className="flex h-full min-h-[calc(100vh-200px)]">
        {/* Sidebar */}
        <div className="w-64 border-r p-4 flex flex-col gap-4">
          {/* Actions */}
          <div>
            <h3 className="text-xs font-semibold uppercase text-muted-foreground mb-2">Actions</h3>
            <Button variant="outline" size="sm" className="w-full justify-start gap-2" onClick={() => { /* Implement create question */ }}>
              <Plus className="h-4 w-4" /> Create Question
            </Button>
            <Button variant="outline" size="sm" className="w-full justify-start gap-2 mt-2" onClick={() => setIsCreateFolderOpen(true)}>
              <FolderPlus className="h-4 w-4" /> Create Folder
            </Button>
          </div>

          {/* Filters */}
          <div>
            <h3 className="text-xs font-semibold uppercase text-muted-foreground mb-2">Filters</h3>
            <div className="flex flex-col gap-1 text-sm">
              <Button variant={selectedFolder === 'all' ? 'secondary' : 'ghost'} size="sm" className="w-full justify-start gap-2" onClick={() => setSelectedFolder('all')}>
                <Folder className="h-4 w-4" />
                <span className="flex-1">All Questions</span>
                {/* <Badge variant="secondary" className="text-xs">{questions.filter(q => !q.is_archived).length}</Badge> */}
              </Button>
              <Button variant={selectedFolder === 'starred' ? 'secondary' : 'ghost'} size="sm" className="w-full justify-start gap-2" onClick={() => setSelectedFolder('starred')}>
                <Star className="h-4 w-4" />
                <span className="flex-1">Starred</span>
                {/* <Badge variant="secondary" className="text-xs">{questions.filter(q => q.is_starred && !q.is_archived).length}</Badge> */}
              </Button>
              <Button variant={selectedFolder === 'unfoldered' ? 'secondary' : 'ghost'} size="sm" className="w-full justify-start gap-2" onClick={() => setSelectedFolder('unfoldered')}>
                <Folder className="h-4 w-4" />
                <span className="flex-1">Unfoldered</span>
                {/* <Badge variant="secondary" className="text-xs">{questions.filter(q => !q.folder_id && !q.is_archived).length}</Badge> */}
              </Button>
              <Button variant={selectedFolder === 'archived' ? 'secondary' : 'ghost'} size="sm" className="w-full justify-start gap-2" onClick={() => setSelectedFolder('archived')}>
                <Archive className="h-4 w-4" />
                <span className="flex-1">Archived</span>
                {/* <Badge variant="secondary" className="text-xs">{questions.filter(q => q.is_archived).length}</Badge> */}
              </Button>
            </div>
          </div>

          {/* Folders */}
          <div>
            <h3 className="text-xs font-semibold uppercase text-muted-foreground mb-2">Folders</h3>
            <div className="flex flex-col gap-1 text-sm">
              {folders.map(folder => (
                <Button key={folder.id} variant={selectedFolder === folder.id ? 'secondary' : 'ghost'} size="sm" className="w-full justify-start gap-2" onClick={() => setSelectedFolder(folder.id)}>
                  <Folder className="h-4 w-4" style={{ color: folder.color || undefined }}/>
                  <span className="flex-1">{folder.name}</span>
                  {/* <Badge variant="secondary" className="text-xs">{questions.filter(q => q.folder_id === folder.id && !q.is_archived).length}</Badge> */}
                </Button>
              ))}
            </div>
          </div>
        </div>

        {/* Main Content */}
        <div className="flex-1 p-6">
          <Card className="h-full flex flex-col">
            <CardHeader>
              <CardTitle>All Questions</CardTitle>
              <div className="flex items-center gap-2 mt-2">
                <Input placeholder="Search questions..." className="max-w-xs" />
                {/* Add more filters (type, difficulty, etc.) here */}
              </div>
            </CardHeader>
            <CardContent className="flex-1 overflow-y-auto">
              <h3 className="text-lg font-semibold p-4">Questions</h3>
              <Droppable droppableId="question-bank" isDropDisabled={true}>
                {(provided, snapshot) => (
                  <div 
                    ref={provided.innerRef}
                    {...provided.droppableProps}
                    className="space-y-2 p-4"
                  >
                    {filteredQuestions.map((q, index) => (
                      <Draggable key={q.id} draggableId={q.id} index={index}>
                        {(provided, snapshot) => (
                          <div
                            ref={provided.innerRef}
                            {...provided.draggableProps}
                            {...provided.dragHandleProps}
                            onClick={() => setActiveQuestion(q)}
                            className={`cursor-pointer ${activeQuestion?.id === q.id ? 'border-primary' : ''} ${snapshot.isDragging ? 'opacity-50' : ''}`}
                          >
                            <Card>
                              <CardContent className="p-4">
                                <p className="font-medium truncate">{q.question_text}</p>
                                <p className="text-xs text-muted-foreground">{q.question_type?.replace('_', ' ')}</p>
                              </CardContent>
                            </Card>
                          </div>
                        )}
                      </Draggable>
                    ))}
                    {provided.placeholder}
                  </div>
                )}
              </Droppable>
            </CardContent>
          </Card>
        </div>

        {/* Side Panel for Tags/Analytics */}
        <div className="w-72 border-l p-4">
          <Tabs defaultValue="tags" className="w-full">
            <TabsList className="grid w-full grid-cols-2">
              <TabsTrigger value="tags">Tags</TabsTrigger>
              <TabsTrigger value="analytics">Analytics</TabsTrigger>
            </TabsList>
            <TabsContent value="tags">
              <div className="space-y-2 mt-4">
                <h4 className="text-sm font-semibold">Top Tags</h4>
                {/* {allTags.slice(0, 10).map(tag => {
                  const count = questions.filter(q => (q.tags || []).includes(tag) && !q.is_archived).length;
                  const percentage = questions.length > 0 ? (count / questions.length) * 100 : 0;
                  return (
                    <div key={tag}>
                      <div className="flex justify-between items-center text-sm">
                        <span>{tag}</span>
                        <span>{count}</span>
                      </div>
                      <div className="w-full bg-muted rounded-full h-1.5">
                        <div className="bg-primary h-1.5 rounded-full" style={{ width: `${percentage}%` }}></div>
                      </div>
                    </div>
                  );
                })} */}
              </div>
            </TabsContent>
            <TabsContent value="analytics">
              <p className="text-sm text-muted-foreground mt-4">Analytics are coming soon.</p>
            </TabsContent>
          </Tabs>
        </div>

        {/* Create Folder Dialog */}
        <Dialog open={isCreateFolderOpen} onOpenChange={setIsCreateFolderOpen}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Create New Folder</DialogTitle>
            </DialogHeader>
            <div className="grid gap-4 py-4">
              <div className="grid grid-cols-4 items-center gap-4">
                <Label htmlFor="folder-name" className="text-right">Name</Label>
                <Input id="folder-name" value={newFolderName} onChange={(e) => setNewFolderName(e.target.value)} className="col-span-3" />
              </div>
              <div className="grid grid-cols-4 items-center gap-4">
                <Label htmlFor="folder-desc" className="text-right">Description</Label>
                <Input id="folder-desc" value={newFolderDescription} onChange={(e) => setNewFolderDescription(e.target.value)} className="col-span-3" />
              </div>
              <div className="grid grid-cols-4 items-center gap-4">
                <Label className="text-right">Color</Label>
                <div className="col-span-3 flex gap-2">
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

        <div className="w-1/2 border-l p-4 flex flex-col">
          {activeQuestion ? (
            <QuestionPreview question={activeQuestion} />
          ) : (
            <div className="flex items-center justify-center h-full">
              <p>Select a question to see the preview</p>
            </div>
          )}
        </div>
      </div>
    </DragDropContext>
  );
};