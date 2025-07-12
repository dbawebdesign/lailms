'use client';

import React, { useState } from 'react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Checkbox } from '@/components/ui/checkbox';
import { AssignmentModal } from '../shared/AssignmentModal';
import { 
  Plus, 
  Edit, 
  Trash2, 
  Calendar, 
  Clock, 
  FileText, 
  Target, 
  Settings,
  Search,
  Filter,
  MoreHorizontal,
  Copy,
  Eye,
  Users,
  CheckCircle,
  AlertCircle,
  TrendingUp,
  BookOpen,
  Star
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { Tables } from '../../../../../packages/types/db';

type Assignment = Tables<'assignments'>;

interface AssignmentsManagerProps {
  classInstance: {
    id: string;
    name: string;
    base_class_id: string;
    enrollment_code: string;
    settings?: any;
  };
  data: {
    students: any[];
    assignments: any[];
    grades: Record<string, any>;
    standards: any[];
    settings: any;
  };
  onDataChange: (data: any) => void;
  isLoading: boolean;
  onCreateAssignment?: (assignmentData: Partial<Assignment>) => Promise<void>;
  onUpdateAssignment?: (assignmentId: string, updates: Partial<Assignment>) => Promise<void>;
  onDeleteAssignment?: (assignmentId: string) => Promise<void>;
}

export function AssignmentsManager({
  classInstance,
  data,
  onDataChange,
  isLoading,
  onCreateAssignment,
  onUpdateAssignment,
  onDeleteAssignment
}: AssignmentsManagerProps) {
  const [activeTab, setActiveTab] = useState('assignments');
  const [searchTerm, setSearchTerm] = useState('');
  const [filterType, setFilterType] = useState('all');
  const [filterStatus, setFilterStatus] = useState('all');
  const [selectedAssignments, setSelectedAssignments] = useState<string[]>([]);
  const [editingAssignment, setEditingAssignment] = useState<Assignment | null>(null);
  const [createDialogOpen, setCreateDialogOpen] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Use live data from props
  const assignments = data.assignments;

  const filteredAssignments = assignments.filter(assignment => {
    if (searchTerm && !assignment.name.toLowerCase().includes(searchTerm.toLowerCase())) {
      return false;
    }
    if (filterType !== 'all' && assignment.type !== filterType) {
      return false;
    }
    if (filterStatus !== 'all') {
      if (filterStatus === 'published' && !assignment.published) {
        return false;
      }
      if (filterStatus === 'draft' && assignment.published) {
        return false;
      }
    }
    return true;
  });

  const handleCreateAssignment = () => {
    setEditingAssignment(null);
    setCreateDialogOpen(true);
  };

  const handleEditAssignment = (assignment: Assignment) => {
    setEditingAssignment(assignment);
    setCreateDialogOpen(true);
  };

  const handleDeleteAssignment = async (assignmentId: string) => {
    if (!onDeleteAssignment) return;
    
    if (confirm('Are you sure you want to delete this assignment? This action cannot be undone.')) {
      try {
        await onDeleteAssignment(assignmentId);
        onDataChange({}); // Trigger refresh
      } catch (error) {
        console.error('Failed to delete assignment:', error);
        alert('Failed to delete assignment. Please try again.');
      }
    }
  };

  const handleSubmitAssignment = async (assignmentData: Partial<Assignment>) => {
    if (!onCreateAssignment && !onUpdateAssignment) return;
    
    setIsSubmitting(true);
    try {
      if (editingAssignment) {
        // Update existing assignment
        if (onUpdateAssignment) {
          await onUpdateAssignment(editingAssignment.id, assignmentData);
        }
      } else {
        // Create new assignment
        if (onCreateAssignment) {
          await onCreateAssignment(assignmentData);
        }
      }
      
      setCreateDialogOpen(false);
      setEditingAssignment(null);
      
      // Trigger data refresh - the parent should handle this properly
      onDataChange({}); 
    } catch (error) {
      console.error('Failed to save assignment:', error);
      throw error; // Re-throw to let the modal handle the error
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleBulkAction = (action: string) => {
    console.log('Bulk action:', action, selectedAssignments);
  };

  const renderRubrics = () => (
    <div className="space-y-8">
      <Card className="p-12 bg-surface/50 border-divider text-center">
        <div className="max-w-md mx-auto space-y-6">
          <div className="p-4 bg-accent/10 rounded-full w-fit mx-auto">
            <Target className="w-12 h-12 text-accent" />
          </div>
          <div>
            <h3 className="text-h2 font-semibold text-foreground mb-3">Rubric Builder</h3>
            <p className="text-body text-muted-foreground mb-6">
              Create detailed rubrics for consistent and fair grading
            </p>
          </div>
          <Badge variant="outline" className="bg-accent/10 text-accent border-accent/20">
            Coming Soon
          </Badge>
        </div>
      </Card>
    </div>
  );

  const renderAnalytics = () => (
    <div className="space-y-8">
      {/* Quick Stats */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <Card className="p-6 bg-surface/50 border-divider">
          <div className="flex items-center gap-4">
            <div className="p-3 bg-primary/10 rounded-lg">
              <FileText className="w-6 h-6 text-primary" />
            </div>
            <div>
              <p className="text-caption text-muted-foreground">Total Assignments</p>
              <p className="text-h3 font-semibold text-foreground">{assignments.length}</p>
            </div>
          </div>
        </Card>
        <Card className="p-6 bg-surface/50 border-divider">
          <div className="flex items-center gap-4">
            <div className="p-3 bg-success/10 rounded-lg">
              <CheckCircle className="w-6 h-6 text-success" />
            </div>
            <div>
              <p className="text-caption text-muted-foreground">Published</p>
              <p className="text-h3 font-semibold text-foreground">
                {assignments.filter(a => a.published).length}
              </p>
            </div>
          </div>
        </Card>
        <Card className="p-6 bg-surface/50 border-divider">
          <div className="flex items-center gap-4">
            <div className="p-3 bg-warning/10 rounded-lg">
              <AlertCircle className="w-6 h-6 text-warning" />
            </div>
            <div>
              <p className="text-caption text-muted-foreground">Draft</p>
              <p className="text-h3 font-semibold text-foreground">
                {assignments.filter(a => !a.published).length}
              </p>
            </div>
          </div>
        </Card>
        <Card className="p-6 bg-surface/50 border-divider">
          <div className="flex items-center gap-4">
            <div className="p-3 bg-info/10 rounded-lg">
              <TrendingUp className="w-6 h-6 text-info" />
            </div>
            <div>
              <p className="text-caption text-muted-foreground">Avg Completion</p>
              <p className="text-h3 font-semibold text-foreground">85%</p>
            </div>
          </div>
        </Card>
      </div>
      
      <Card className="p-12 bg-surface/50 border-divider text-center">
        <div className="max-w-md mx-auto space-y-6">
          <div className="p-4 bg-info/10 rounded-full w-fit mx-auto">
            <TrendingUp className="w-12 h-12 text-info" />
          </div>
          <div>
            <h3 className="text-h2 font-semibold text-foreground mb-3">Detailed Analytics</h3>
            <p className="text-body text-muted-foreground mb-6">
              Comprehensive assignment performance and engagement analytics
            </p>
          </div>
          <Badge variant="outline" className="bg-accent/10 text-accent border-accent/20">
            Coming Soon
          </Badge>
        </div>
      </Card>
    </div>
  );

  const renderAssignmentsList = () => (
    <div className="space-y-8">
      {/* Search and Filter Bar */}
      <Card className="p-6 bg-surface/50 border-divider">
        <div className="flex flex-col lg:flex-row gap-4 items-start lg:items-center">
          <div className="flex-1 min-w-0">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search assignments..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-10 border-divider focus:border-primary/50 bg-background"
              />
            </div>
          </div>
          <div className="flex flex-col sm:flex-row gap-3 w-full lg:w-auto">
            <Select value={filterType} onValueChange={setFilterType}>
              <SelectTrigger className="w-full sm:w-[180px] border-divider">
                <SelectValue placeholder="Filter by type" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Types</SelectItem>
                <SelectItem value="quiz">Quiz</SelectItem>
                <SelectItem value="assignment">Assignment</SelectItem>
                <SelectItem value="homework">Homework</SelectItem>
                <SelectItem value="project">Project</SelectItem>
                <SelectItem value="exam">Exam</SelectItem>
              </SelectContent>
            </Select>
            <Select value={filterStatus} onValueChange={setFilterStatus}>
              <SelectTrigger className="w-full sm:w-[180px] border-divider">
                <SelectValue placeholder="Filter by status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Status</SelectItem>
                <SelectItem value="draft">Draft</SelectItem>
                <SelectItem value="published">Published</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>
      </Card>

      {/* Bulk Actions */}
      {selectedAssignments.length > 0 && (
        <Card className="p-4 bg-accent/5 border-accent/20">
          <div className="flex items-center justify-between">
            <span className="text-body font-medium text-foreground">
              {selectedAssignments.length} assignment{selectedAssignments.length > 1 ? 's' : ''} selected
            </span>
            <div className="flex gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => handleBulkAction('publish')}
                className="hover:bg-surface/80 border-divider transition-airy"
              >
                Publish
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={() => handleBulkAction('unpublish')}
                className="hover:bg-surface/80 border-divider transition-airy"
              >
                Unpublish
              </Button>
              <Button
                variant="destructive"
                size="sm"
                onClick={() => handleBulkAction('delete')}
                className="hover:bg-destructive/90 transition-airy"
              >
                Delete
              </Button>
            </div>
          </div>
        </Card>
      )}

      {/* Assignments List */}
      <div className="space-y-6">
        {filteredAssignments.map((assignment) => (
          <Card key={assignment.id} className="p-6 bg-surface/50 border-divider hover:shadow-lg transition-airy">
            <div className="flex items-start justify-between">
              <div className="flex items-start gap-4 flex-1">
                <Checkbox
                  checked={selectedAssignments.includes(assignment.id)}
                  onCheckedChange={(checked) => {
                    if (checked) {
                      setSelectedAssignments([...selectedAssignments, assignment.id]);
                    } else {
                      setSelectedAssignments(selectedAssignments.filter(id => id !== assignment.id));
                    }
                  }}
                  className="mt-1"
                />
                
                <div className="flex-1 space-y-4">
                  <div className="flex items-start justify-between">
                    <div className="space-y-2">
                      <div className="flex items-center gap-3">
                        <h3 className="text-h3 font-semibold text-foreground">{assignment.name}</h3>
                        <Badge 
                          variant={assignment.published ? "default" : "secondary"}
                          className={cn(
                            "text-xs",
                            assignment.published 
                              ? "bg-success/10 text-success border-success/20" 
                              : "bg-muted/50 text-muted-foreground border-muted/20"
                          )}
                        >
                          {assignment.published ? 'Published' : 'Draft'}
                        </Badge>
                        <Badge variant="outline" className="text-xs capitalize">
                          {assignment.type}
                        </Badge>
                      </div>
                      {assignment.description && (
                        <p className="text-body text-muted-foreground leading-relaxed">
                          {assignment.description}
                        </p>
                      )}
                    </div>
                  </div>
                  
                  <div className="flex items-center gap-6 text-caption text-muted-foreground">
                    <div className="flex items-center gap-1">
                      <Target className="w-4 h-4" />
                      <span>{assignment.points_possible} points</span>
                    </div>
                    {assignment.due_date && (
                      <div className="flex items-center gap-1">
                        <Calendar className="w-4 h-4" />
                        <span>Due {new Date(assignment.due_date).toLocaleDateString()}</span>
                      </div>
                    )}
                    <div className="flex items-center gap-1">
                      <Clock className="w-4 h-4" />
                      <span>Created {new Date(assignment.created_at).toLocaleDateString()}</span>
                    </div>
                    {assignment.category && (
                      <div className="flex items-center gap-1">
                        <FileText className="w-4 h-4" />
                        <span>{assignment.category}</span>
                      </div>
                    )}
                  </div>
                </div>
              </div>
              
              <div className="flex flex-col gap-2 flex-shrink-0">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => handleEditAssignment(assignment)}
                  className="hover:bg-surface/80 border-divider transition-airy min-w-[70px] justify-center"
                >
                  <Edit className="w-4 h-4 mr-1" />
                  Edit
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  className="hover:bg-surface/80 border-divider transition-airy min-w-[70px] justify-center"
                >
                  <Eye className="w-4 h-4 mr-1" />
                  View
                </Button>
              </div>
            </div>
          </Card>
        ))}
      </div>
    </div>
  );

  if (isLoading) {
    return (
      <div className="flex-1 flex items-center justify-center bg-background">
        <div className="text-center space-y-4">
          <BookOpen className="w-16 h-16 text-muted-foreground mx-auto animate-pulse" />
          <div>
            <h3 className="text-h3 font-medium text-foreground">Loading Assignments</h3>
            <p className="text-caption text-muted-foreground mt-1">Gathering assignment data...</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full bg-background overflow-hidden">
      {/* Header */}
      <div className="p-8 border-b border-divider bg-surface/30 flex-shrink-0">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-h1 font-bold text-foreground">Assignment Management</h2>
            <p className="text-body text-muted-foreground mt-2">
              Create, organize, and manage assignments and assessments
            </p>
          </div>
          <Button 
            onClick={handleCreateAssignment}
            className="bg-brand-gradient hover:opacity-90 transition-airy shadow-md hover:shadow-lg"
          >
            <Plus className="w-4 h-4 mr-2" />
            New Assignment
          </Button>
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 p-8 overflow-y-auto min-h-0">
        <Tabs value={activeTab} onValueChange={setActiveTab} className="h-full">
          <div className="flex items-center gap-1 p-1 bg-background rounded-lg border border-divider w-fit mb-8">
            {[
              { id: 'assignments', label: 'Assignments', icon: FileText },
              { id: 'rubrics', label: 'Rubrics', icon: Target },
              { id: 'analytics', label: 'Analytics', icon: TrendingUp }
            ].map((tab) => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={cn(
                  "flex items-center gap-2 px-4 py-2 rounded-md text-caption font-medium transition-airy",
                  activeTab === tab.id 
                    ? "bg-primary text-primary-foreground shadow-sm" 
                    : "text-muted-foreground hover:text-foreground hover:bg-surface/50"
                )}
              >
                <tab.icon className="w-4 h-4" />
                {tab.label}
              </button>
            ))}
          </div>
          
          <TabsContent value="assignments" className="flex-1 mt-0">
            {renderAssignmentsList()}
          </TabsContent>
          
          <TabsContent value="rubrics" className="flex-1 mt-0">
            {renderRubrics()}
          </TabsContent>
          
          <TabsContent value="analytics" className="flex-1 mt-0">
            {renderAnalytics()}
          </TabsContent>
        </Tabs>
      </div>

      {/* Create/Edit Assignment Dialog */}
      <AssignmentModal
        open={createDialogOpen}
        onOpenChange={setCreateDialogOpen}
        assignment={editingAssignment}
        classInstanceId={classInstance.id}
        onSubmit={handleSubmitAssignment}
        isSubmitting={isSubmitting}
      />
    </div>
  );
} 