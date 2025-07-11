'use client';

import React, { useState } from 'react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Checkbox } from '@/components/ui/checkbox';
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
  const [formData, setFormData] = useState({
    name: '',
    description: '',
    type: 'assignment' as Assignment['type'],
    category: '',
    points_possible: 100,
    due_date: '',
    published: false
  });

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
    setFormData({
      name: '',
      description: '',
      type: 'assignment',
      category: '',
      points_possible: 100,
      due_date: '',
      published: false
    });
    setCreateDialogOpen(true);
  };

  const handleEditAssignment = (assignment: Assignment) => {
    setEditingAssignment(assignment);
    
    // Convert ISO date to datetime-local format
    let formattedDate = '';
    if (assignment.due_date) {
      const date = new Date(assignment.due_date);
      // Format for datetime-local input (YYYY-MM-DDTHH:mm)
      formattedDate = date.toISOString().slice(0, 16);
    }
    
    setFormData({
      name: assignment.name || '',
      description: assignment.description || '',
      type: assignment.type,
      category: assignment.category || '',
      points_possible: assignment.points_possible || 100,
      due_date: formattedDate,
      published: assignment.published || false
    });
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

  const handleSubmitAssignment = async () => {
    if (!formData.name.trim()) {
      alert('Assignment name is required');
      return;
    }

    setIsSubmitting(true);
    try {
      // Convert datetime-local format to ISO string for database
      let formattedDueDate = null;
      if (formData.due_date) {
        const date = new Date(formData.due_date);
        formattedDueDate = date.toISOString();
      }

      const assignmentData = {
        name: formData.name.trim(),
        description: formData.description.trim(),
        type: formData.type,
        category: formData.category.trim(),
        points_possible: formData.points_possible,
        due_date: formattedDueDate,
        published: formData.published,
        class_instance_id: classInstance.id
      };

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

      // Reset form
      setFormData({
        name: '',
        description: '',
        type: 'assignment',
        category: '',
        points_possible: 100,
        due_date: '',
        published: false
      });
      
      setCreateDialogOpen(false);
      setEditingAssignment(null);
      
      // Trigger data refresh - the parent should handle this properly
      onDataChange({}); 
    } catch (error) {
      console.error('Failed to save assignment:', error);
      alert('Failed to save assignment. Please try again.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleBulkAction = (action: string) => {
    console.log('Bulk action:', action, selectedAssignments);
  };

  const getTypeIcon = (type: string) => {
    switch (type) {
      case 'quiz': return <FileText className="w-4 h-4" />;
      case 'project': return <Target className="w-4 h-4" />;
      case 'lab': return <Settings className="w-4 h-4" />;
      case 'exam': return <CheckCircle className="w-4 h-4" />;
      case 'discussion': return <Users className="w-4 h-4" />;
      default: return <FileText className="w-4 h-4" />;
    }
  };

  const getStatusBadge = (assignment: Assignment) => {
    if (assignment.published) {
      return <Badge className="bg-success/10 text-success border-success/20">Published</Badge>;
    } else {
      return <Badge className="bg-warning/10 text-warning border-warning/20">Draft</Badge>;
    }
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric'
    });
  };

  const StatCard = ({ icon: Icon, title, value, subtitle, color = 'primary' }: any) => (
    <Card className="p-6 bg-surface/50 border-divider hover:shadow-lg transition-airy">
      <div className="flex items-center justify-between">
        <div>
          <p className="text-caption text-muted-foreground font-medium">{title}</p>
          <p className="text-h2 font-bold text-foreground mt-1">{value}</p>
          {subtitle && <p className="text-xs text-muted-foreground mt-1">{subtitle}</p>}
        </div>
        <div className={cn(
          "p-3 rounded-xl transition-airy",
          color === 'primary' && "bg-primary/10",
          color === 'success' && "bg-success/10",
          color === 'info' && "bg-info/10",
          color === 'warning' && "bg-warning/10"
        )}>
          <Icon className={cn(
            "w-6 h-6",
            color === 'primary' && "text-primary",
            color === 'success' && "text-success",
            color === 'info' && "text-info",
            color === 'warning' && "text-warning"
          )} />
        </div>
      </div>
    </Card>
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
            <div className="flex items-start gap-4">
              {/* Checkbox */}
              <div className="pt-1 flex-shrink-0">
                <Checkbox
                  checked={selectedAssignments.includes(assignment.id)}
                  onCheckedChange={(checked) => {
                    if (checked) {
                      setSelectedAssignments([...selectedAssignments, assignment.id]);
                    } else {
                      setSelectedAssignments(selectedAssignments.filter(id => id !== assignment.id));
                    }
                  }}
                />
              </div>
              
              {/* Type Icon */}
              <div className="p-3 bg-primary/10 rounded-xl flex-shrink-0">
                {getTypeIcon(assignment.type)}
              </div>
              
              {/* Main Content - Constrain width to prevent overflow */}
              <div className="flex-1 min-w-0 space-y-3">
                {/* Header Row */}
                <div className="flex items-start justify-between gap-4">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-3 mb-2 flex-wrap">
                      <h4 className="text-lg font-semibold text-foreground truncate max-w-[300px] lg:max-w-[400px] xl:max-w-[500px]" title={assignment.name}>
                        {assignment.name}
                      </h4>
                      {getStatusBadge(assignment)}
                      <Badge variant="outline" className="border-primary/20 text-primary bg-primary/10 text-xs flex-shrink-0">
                        {assignment.type}
                      </Badge>
                    </div>
                    <p className="text-sm text-muted-foreground leading-relaxed line-clamp-2">
                      {assignment.description}
                    </p>
                  </div>
                </div>
                
                {/* Assignment Details Grid */}
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3 py-3 px-4 bg-background/50 rounded-lg border border-divider/50">
                  <div className="flex items-center gap-2 min-w-0">
                    <Target className="w-4 h-4 text-primary flex-shrink-0" />
                    <span className="text-sm text-muted-foreground truncate">
                      <span className="font-medium text-foreground">{assignment.points_possible}</span> points
                    </span>
                  </div>
                  <div className="flex items-center gap-2 min-w-0">
                    <Calendar className="w-4 h-4 text-accent flex-shrink-0" />
                    <span className="text-sm text-muted-foreground truncate">
                      Due <span className="font-medium text-foreground">{formatDate(assignment.due_date)}</span>
                    </span>
                  </div>
                  <div className="flex items-center gap-2 min-w-0">
                    <Users className="w-4 h-4 text-info flex-shrink-0" />
                    <span className="text-sm text-muted-foreground truncate">
                      <span className="font-medium text-foreground">{assignment.submissions_count}</span>
                      /{data.students.length || 30} submitted
                    </span>
                  </div>
                  {assignment.status === 'published' && assignment.avg_score && (
                    <div className="flex items-center gap-2 min-w-0">
                      <TrendingUp className="w-4 h-4 text-success flex-shrink-0" />
                      <span className="text-sm text-muted-foreground truncate">
                        <span className="font-medium text-foreground">{assignment.avg_score}%</span> avg
                      </span>
                    </div>
                  )}
                </div>
                
                {/* Standards Row */}
                {assignment.standards && assignment.standards.length > 0 && (
                  <div className="flex items-center gap-3 pt-2">
                    <span className="text-sm text-muted-foreground font-medium flex-shrink-0">Standards:</span>
                    <div className="flex flex-wrap gap-2 min-w-0">
                      {assignment.standards.map((standard: string) => (
                        <Badge key={standard} variant="outline" className="text-xs border-info/20 text-info bg-info/5 hover:bg-info/10 transition-airy">
                          {standard}
                        </Badge>
                      ))}
                    </div>
                  </div>
                )}
              </div>
              
              {/* Action Buttons - Stacked Vertically */}
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

  const renderRubrics = () => (
    <div className="space-y-8">
      <Card className="p-12 bg-surface/50 border-divider text-center">
        <div className="max-w-md mx-auto space-y-6">
          <div className="p-4 bg-primary/10 rounded-full w-fit mx-auto">
            <Star className="w-12 h-12 text-primary" />
          </div>
          <div>
            <h3 className="text-h2 font-semibold text-foreground mb-3">Rubrics</h3>
            <p className="text-body text-muted-foreground mb-6">
              Create and manage grading rubrics for consistent assessment
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
      <div>
        <h3 className="text-h2 font-semibold text-foreground mb-2">Assignment Analytics</h3>
        <p className="text-caption text-muted-foreground">Track assignment performance and student engagement</p>
      </div>
      
      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
        <StatCard
          icon={FileText}
          title="Total Assignments"
          value={assignments.length}
          color="primary"
        />
        <StatCard
          icon={CheckCircle}
          title="Published"
          value={assignments.filter(a => a.published).length}
          color="success"
        />
        <StatCard
          icon={TrendingUp}
          title="Avg Completion"
          value="85%"
          color="info"
        />
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

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-full min-h-[400px]">
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
              { id: 'rubrics', label: 'Rubrics', icon: Star },
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
      <Dialog open={createDialogOpen} onOpenChange={setCreateDialogOpen}>
        <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto bg-background border-divider">
          <DialogHeader>
            <DialogTitle className="text-h2 text-foreground">
              {editingAssignment ? 'Edit Assignment' : 'Create New Assignment'}
            </DialogTitle>
          </DialogHeader>
          
          <div className="space-y-6 py-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="name" className="text-body font-medium text-foreground">Assignment Name</Label>
                <Input
                  id="name"
                  placeholder="Enter assignment name"
                  value={formData.name}
                  onChange={(e) => setFormData({...formData, name: e.target.value})}
                  className="border-divider focus:border-primary/50"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="type" className="text-body font-medium text-foreground">Type</Label>
                <Select value={formData.type} onValueChange={(value) => setFormData({...formData, type: value as Assignment['type']})}>
                  <SelectTrigger className="border-divider">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="quiz">Quiz</SelectItem>
                    <SelectItem value="assignment">Assignment</SelectItem>
                    <SelectItem value="project">Project</SelectItem>
                    <SelectItem value="exam">Exam</SelectItem>
                    <SelectItem value="lab">Lab</SelectItem>
                    <SelectItem value="discussion">Discussion</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            
            <div className="space-y-2">
              <Label htmlFor="description" className="text-body font-medium text-foreground">Description</Label>
              <Textarea
                id="description"
                placeholder="Describe the assignment"
                value={formData.description}
                onChange={(e) => setFormData({...formData, description: e.target.value})}
                rows={3}
                className="border-divider focus:border-primary/50"
              />
            </div>
            
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="points" className="text-body font-medium text-foreground">Points Possible</Label>
                <Input
                  id="points"
                  type="number"
                  placeholder="100"
                  value={formData.points_possible}
                  onChange={(e) => setFormData({...formData, points_possible: Number(e.target.value)})}
                  className="border-divider focus:border-primary/50"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="category" className="text-body font-medium text-foreground">Category</Label>
                <Input
                  id="category"
                  placeholder="e.g. Assessments"
                  value={formData.category}
                  onChange={(e) => setFormData({...formData, category: e.target.value})}
                  className="border-divider focus:border-primary/50"
                />
              </div>
            </div>
            
            <div className="space-y-2">
              <Label htmlFor="due_date" className="text-body font-medium text-foreground">Due Date</Label>
              <Input
                id="due_date"
                type="datetime-local"
                value={formData.due_date}
                onChange={(e) => setFormData({...formData, due_date: e.target.value})}
                className="border-divider focus:border-primary/50"
              />
            </div>
            
            <div className="flex items-center space-x-2">
              <input
                id="published"
                type="checkbox"
                checked={formData.published}
                onChange={(e) => setFormData({...formData, published: e.target.checked})}
                className="rounded border-divider"
              />
              <Label htmlFor="published" className="text-body font-medium text-foreground">
                Published (visible to students and appears in gradebook)
              </Label>
            </div>
            
            <div className="flex justify-end gap-3 pt-4">
              <Button 
                variant="outline" 
                onClick={() => setCreateDialogOpen(false)}
                className="border-divider hover:bg-surface/80"
                disabled={isSubmitting}
              >
                Cancel
              </Button>
              <Button 
                onClick={handleSubmitAssignment}
                disabled={isSubmitting}
                className="bg-brand-gradient hover:opacity-90 transition-airy shadow-md hover:shadow-lg"
              >
                {isSubmitting ? 'Saving...' : (editingAssignment ? 'Save Changes' : 'Create Assignment')}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
} 