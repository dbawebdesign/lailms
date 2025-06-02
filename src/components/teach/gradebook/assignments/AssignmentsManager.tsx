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

interface Assignment {
  id: string;
  name: string;
  description: string;
  type: 'quiz' | 'assignment' | 'project' | 'exam' | 'discussion' | 'lab';
  category: string;
  points_possible: number;
  due_date: string;
  weight: number;
  standards?: string[];
  rubric?: any;
  status: 'draft' | 'published' | 'closed';
  submissions_count?: number;
  graded_count?: number;
  avg_score?: number;
  created_at: string;
  updated_at: string;
}

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
}

export function AssignmentsManager({
  classInstance,
  data,
  onDataChange,
  isLoading
}: AssignmentsManagerProps) {
  const [activeTab, setActiveTab] = useState('assignments');
  const [searchTerm, setSearchTerm] = useState('');
  const [filterType, setFilterType] = useState('all');
  const [filterStatus, setFilterStatus] = useState('all');
  const [selectedAssignments, setSelectedAssignments] = useState<string[]>([]);
  const [editingAssignment, setEditingAssignment] = useState<Assignment | null>(null);
  const [createDialogOpen, setCreateDialogOpen] = useState(false);

  // Mock assignments data
  const mockAssignments: Assignment[] = [
    {
      id: '1',
      name: 'Chapter 5 Quiz',
      description: 'Multiple choice quiz covering key concepts from Chapter 5',
      type: 'quiz',
      category: 'Assessments',
      points_possible: 25,
      due_date: '2024-02-15T23:59:00Z',
      weight: 1.0,
      standards: ['MATH.8.A.1', 'MATH.8.A.2'],
      status: 'published',
      submissions_count: 28,
      graded_count: 25,
      avg_score: 82.5,
      created_at: '2024-02-01T10:00:00Z',
      updated_at: '2024-02-01T10:00:00Z'
    },
    {
      id: '2',
      name: 'Research Project',
      description: 'In-depth research project on renewable energy sources',
      type: 'project',
      category: 'Major Projects',
      points_possible: 100,
      due_date: '2024-02-28T23:59:00Z',
      weight: 2.0,
      standards: ['SCI.8.ESS.3', 'SCI.8.ESS.4'],
      status: 'published',
      submissions_count: 15,
      graded_count: 8,
      avg_score: 88.2,
      created_at: '2024-01-15T10:00:00Z',
      updated_at: '2024-02-10T14:30:00Z'
    },
    {
      id: '3',
      name: 'Lab Report #3',
      description: 'Chemical reactions laboratory report',
      type: 'lab',
      category: 'Lab Work',
      points_possible: 50,
      due_date: '2024-02-20T23:59:00Z',
      weight: 1.5,
      standards: ['SCI.8.PS.1'],
      status: 'draft',
      submissions_count: 0,
      graded_count: 0,
      avg_score: 0,
      created_at: '2024-02-12T09:00:00Z',
      updated_at: '2024-02-12T09:00:00Z'
    }
  ];

  const filteredAssignments = mockAssignments.filter(assignment => {
    if (searchTerm && !assignment.name.toLowerCase().includes(searchTerm.toLowerCase())) {
      return false;
    }
    if (filterType !== 'all' && assignment.type !== filterType) {
      return false;
    }
    if (filterStatus !== 'all' && assignment.status !== filterStatus) {
      return false;
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

  const handleDeleteAssignment = (assignmentId: string) => {
    // TODO: Implement delete functionality
    console.log('Delete assignment:', assignmentId);
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

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'published':
        return <Badge className="bg-success/10 text-success border-success/20">Published</Badge>;
      case 'draft':
        return <Badge className="bg-warning/10 text-warning border-warning/20">Draft</Badge>;
      case 'closed':
        return <Badge className="bg-destructive/10 text-destructive border-destructive/20">Closed</Badge>;
      default:
        return <Badge variant="outline">{status}</Badge>;
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
      {/* Header with Actions */}
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-h2 font-semibold text-foreground">Assignments</h3>
          <p className="text-caption text-muted-foreground mt-1">
            Create and manage assignments for your class
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

      {/* Filters and Search */}
      <Card className="p-6 bg-surface/50 border-divider">
        <div className="flex flex-col lg:flex-row gap-4 items-start lg:items-center justify-between">
          <div className="flex gap-4 flex-1">
            <div className="relative flex-1 max-w-sm">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground w-4 h-4" />
              <Input
                placeholder="Search assignments..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-10 border-divider focus:border-primary/50"
              />
            </div>
            <Select value={filterType} onValueChange={setFilterType}>
              <SelectTrigger className="w-40 border-divider">
                <SelectValue placeholder="All Types" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Types</SelectItem>
                <SelectItem value="quiz">Quiz</SelectItem>
                <SelectItem value="assignment">Assignment</SelectItem>
                <SelectItem value="project">Project</SelectItem>
                <SelectItem value="exam">Exam</SelectItem>
                <SelectItem value="lab">Lab</SelectItem>
                <SelectItem value="discussion">Discussion</SelectItem>
              </SelectContent>
            </Select>
            <Select value={filterStatus} onValueChange={setFilterStatus}>
              <SelectTrigger className="w-40 border-divider">
                <SelectValue placeholder="All Status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Status</SelectItem>
                <SelectItem value="published">Published</SelectItem>
                <SelectItem value="draft">Draft</SelectItem>
                <SelectItem value="closed">Closed</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>
      </Card>

      {/* Assignments List */}
      <div className="space-y-6">
        {filteredAssignments.map((assignment) => (
          <Card key={assignment.id} className="p-8 bg-surface/50 border-divider hover:shadow-lg transition-airy">
            <div className="flex items-start gap-6">
              {/* Checkbox */}
              <div className="pt-1">
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
              
              {/* Main Content */}
              <div className="flex-1 min-w-0 space-y-4">
                {/* Header Row */}
                <div className="flex items-start justify-between gap-4">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-3 mb-2">
                      <h4 className="text-h3 font-semibold text-foreground truncate">{assignment.name}</h4>
                      {getStatusBadge(assignment.status)}
                      <Badge variant="outline" className="border-primary/20 text-primary bg-primary/10 text-xs">
                        {assignment.type}
                      </Badge>
                    </div>
                    <p className="text-body text-muted-foreground leading-relaxed">{assignment.description}</p>
                  </div>
                </div>
                
                {/* Assignment Details Grid */}
                <div className="grid grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4 py-3 px-4 bg-background/50 rounded-lg border border-divider/50">
                  <div className="flex items-center gap-2">
                    <Target className="w-4 h-4 text-primary flex-shrink-0" />
                    <span className="text-caption text-muted-foreground">
                      <span className="font-medium text-foreground">{assignment.points_possible}</span> points
                    </span>
                  </div>
                  <div className="flex items-center gap-2">
                    <Calendar className="w-4 h-4 text-accent flex-shrink-0" />
                    <span className="text-caption text-muted-foreground">
                      Due <span className="font-medium text-foreground">{formatDate(assignment.due_date)}</span>
                    </span>
                  </div>
                  <div className="flex items-center gap-2">
                    <Users className="w-4 h-4 text-info flex-shrink-0" />
                    <span className="text-caption text-muted-foreground">
                      <span className="font-medium text-foreground">{assignment.submissions_count}</span>
                      /{data.students.length || 30} submitted
                    </span>
                  </div>
                  {assignment.status === 'published' && assignment.avg_score && (
                    <div className="flex items-center gap-2">
                      <TrendingUp className="w-4 h-4 text-success flex-shrink-0" />
                      <span className="text-caption text-muted-foreground">
                        <span className="font-medium text-foreground">{assignment.avg_score}%</span> avg
                      </span>
                    </div>
                  )}
                </div>
                
                {/* Standards Row */}
                {assignment.standards && assignment.standards.length > 0 && (
                  <div className="flex items-center gap-3 pt-2">
                    <span className="text-caption text-muted-foreground font-medium flex-shrink-0">Standards:</span>
                    <div className="flex flex-wrap gap-2">
                      {assignment.standards.map((standard) => (
                        <Badge key={standard} variant="outline" className="text-xs border-info/20 text-info bg-info/5 hover:bg-info/10 transition-airy">
                          {standard}
                        </Badge>
                      ))}
                    </div>
                  </div>
                )}
              </div>
              
              {/* Action Buttons - Stacked Vertically */}
              <div className="flex flex-col gap-3 flex-shrink-0">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => handleEditAssignment(assignment)}
                  className="hover:bg-surface/80 border-divider transition-airy min-w-[80px] justify-center"
                >
                  <Edit className="w-4 h-4 mr-2" />
                  Edit
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  className="hover:bg-surface/80 border-divider transition-airy min-w-[80px] justify-center"
                >
                  <Eye className="w-4 h-4 mr-2" />
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
          value={mockAssignments.length}
          color="primary"
        />
        <StatCard
          icon={CheckCircle}
          title="Published"
          value={mockAssignments.filter(a => a.status === 'published').length}
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
    <div className="flex flex-col h-full bg-background">
      {/* Header */}
      <div className="p-8 border-b border-divider bg-surface/30">
        <div>
          <h2 className="text-h1 font-bold text-foreground">Assignment Management</h2>
          <p className="text-body text-muted-foreground mt-2">
            Create, organize, and manage assignments and assessments
          </p>
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 p-8">
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
                  defaultValue={editingAssignment?.name}
                  className="border-divider focus:border-primary/50"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="type" className="text-body font-medium text-foreground">Type</Label>
                <Select defaultValue={editingAssignment?.type || 'assignment'}>
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
                defaultValue={editingAssignment?.description}
                rows={3}
                className="border-divider focus:border-primary/50"
              />
            </div>
            
            <div className="grid grid-cols-3 gap-4">
              <div className="space-y-2">
                <Label htmlFor="points" className="text-body font-medium text-foreground">Points Possible</Label>
                <Input
                  id="points"
                  type="number"
                  placeholder="100"
                  defaultValue={editingAssignment?.points_possible}
                  className="border-divider focus:border-primary/50"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="weight" className="text-body font-medium text-foreground">Weight</Label>
                <Input
                  id="weight"
                  type="number"
                  step="0.1"
                  placeholder="1.0"
                  defaultValue={editingAssignment?.weight}
                  className="border-divider focus:border-primary/50"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="category" className="text-body font-medium text-foreground">Category</Label>
                <Input
                  id="category"
                  placeholder="e.g. Assessments"
                  defaultValue={editingAssignment?.category}
                  className="border-divider focus:border-primary/50"
                />
              </div>
            </div>
            
            <div className="space-y-2">
              <Label htmlFor="due_date" className="text-body font-medium text-foreground">Due Date</Label>
              <Input
                id="due_date"
                type="datetime-local"
                defaultValue={editingAssignment?.due_date?.slice(0, 16)}
                className="border-divider focus:border-primary/50"
              />
            </div>
            
            <div className="flex justify-end gap-3 pt-4">
              <Button 
                variant="outline" 
                onClick={() => setCreateDialogOpen(false)}
                className="border-divider hover:bg-surface/80"
              >
                Cancel
              </Button>
              <Button className="bg-brand-gradient hover:opacity-90 transition-airy shadow-md hover:shadow-lg">
                {editingAssignment ? 'Save Changes' : 'Create Assignment'}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
} 