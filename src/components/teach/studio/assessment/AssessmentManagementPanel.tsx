'use client';

import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { 
  BookOpen, 
  FileText, 
  GraduationCap,
  Plus,
  Search,
  Filter,
  Clock,
  Users,
  BarChart3,
  Settings,
  Edit,
  Trash2,
  Copy,
  Eye,
  Loader2
} from 'lucide-react';
import { NewSchemaAssessment } from '@/components/assessments/v2/types/newSchemaTypes';

interface AssessmentManagementPanelProps {
  baseClassId: string;
  onCreateAssessment: (type: 'lesson_assessment' | 'path_quiz' | 'class_exam') => void;
  onEditAssessment: (assessmentId: string) => void;
}

interface AssessmentWithStats extends NewSchemaAssessment {
  questionCount: number;
  attemptCount: number;
  averageScore: number;
  completionRate: number;
  // Additional metadata from joins
  lessonTitle?: string;
  pathTitle?: string;
}

export default function AssessmentManagementPanel({ 
  baseClassId, 
  onCreateAssessment, 
  onEditAssessment 
}: AssessmentManagementPanelProps) {
  const [assessments, setAssessments] = useState<AssessmentWithStats[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [typeFilter, setTypeFilter] = useState<string>('all');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [activeTab, setActiveTab] = useState('overview');

  useEffect(() => {
    fetchAssessments();
  }, [baseClassId]);

  const fetchAssessments = async () => {
    setLoading(true);
    try {
      const response = await fetch(`/api/teach/assessments?baseClassId=${baseClassId}&includeStats=true`);
      if (!response.ok) throw new Error('Failed to fetch assessments');
      
      const data = await response.json();
      setAssessments(data.assessments || []);
    } catch (error) {
      console.error('Error fetching assessments:', error);
    } finally {
      setLoading(false);
    }
  };

  const filteredAssessments = assessments.filter(assessment => {
    const matchesSearch = assessment.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         assessment.description?.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesType = typeFilter === 'all' || assessment.assessment_type === typeFilter;
    const matchesStatus = statusFilter === 'all'; // TODO: Add status filtering when needed
    
    return matchesSearch && matchesType && matchesStatus;
  });

  const getAssessmentsByType = (type: string) => {
    return filteredAssessments.filter(a => a.assessment_type === type);
  };

  const handleDeleteAssessment = async (assessmentId: string) => {
    if (!confirm('Are you sure you want to delete this assessment? This action cannot be undone.')) {
      return;
    }

    try {
      const response = await fetch(`/api/teach/assessments/${assessmentId}`, {
        method: 'DELETE',
      });

      if (!response.ok) throw new Error('Failed to delete assessment');
      
      // Refresh assessments list
      fetchAssessments();
    } catch (error) {
      console.error('Error deleting assessment:', error);
      alert('Failed to delete assessment. Please try again.');
    }
  };

  const handleDuplicateAssessment = async (assessmentId: string) => {
    try {
      const response = await fetch(`/api/teach/assessments/${assessmentId}/duplicate`, {
        method: 'POST',
      });

      if (!response.ok) throw new Error('Failed to duplicate assessment');
      
      // Refresh assessments list
      fetchAssessments();
    } catch (error) {
      console.error('Error duplicating assessment:', error);
      alert('Failed to duplicate assessment. Please try again.');
    }
  };

  const AssessmentCard = ({ assessment }: { assessment: AssessmentWithStats }) => (
    <Card key={assessment.id} className="hover:shadow-md transition-shadow">
      <CardHeader className="pb-3">
        <div className="flex items-start justify-between">
          <div className="space-y-1">
            <CardTitle className="text-lg">{assessment.title}</CardTitle>
            <CardDescription className="line-clamp-2">
              {assessment.description}
            </CardDescription>
            <div className="flex items-center space-x-2 text-sm text-muted-foreground">
              {assessment.lessonTitle && (
                <span>Lesson: {assessment.lessonTitle}</span>
              )}
              {assessment.pathTitle && (
                <span>Path: {assessment.pathTitle}</span>
              )}
              {assessment.time_limit_minutes && (
                <span className="flex items-center">
                  <Clock className="h-3 w-3 mr-1" />
                  {assessment.time_limit_minutes} min
                </span>
              )}
            </div>
          </div>
          <div className="flex flex-col space-y-1">
            <Badge variant={assessment.assessment_type === 'class_exam' ? 'default' : 'secondary'}>
              {assessment.assessment_type.replace('_', ' ').replace(/\b\w/g, l => l.toUpperCase())}
            </Badge>
            {assessment.ai_grading_enabled && (
              <Badge variant="outline" className="text-xs">
                AI Grading
              </Badge>
            )}
          </div>
        </div>
      </CardHeader>
      <CardContent className="pt-0">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-4 text-sm">
          <div className="text-center">
            <div className="font-semibold">{assessment.questionCount}</div>
            <div className="text-muted-foreground">Questions</div>
          </div>
          <div className="text-center">
            <div className="font-semibold">{assessment.attemptCount}</div>
            <div className="text-muted-foreground">Attempts</div>
          </div>
          <div className="text-center">
            <div className="font-semibold">{assessment.averageScore.toFixed(1)}%</div>
            <div className="text-muted-foreground">Avg Score</div>
          </div>
          <div className="text-center">
            <div className="font-semibold">{assessment.completionRate.toFixed(1)}%</div>
            <div className="text-muted-foreground">Completion</div>
          </div>
        </div>
        
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => onEditAssessment(assessment.id)}
            >
              <Edit className="h-3 w-3 mr-1" />
              Edit
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => handleDuplicateAssessment(assessment.id)}
            >
              <Copy className="h-3 w-3 mr-1" />
              Duplicate
            </Button>
          </div>
          <div className="flex items-center space-x-2">
            <Button
              variant="outline"
              size="sm"
            >
              <Eye className="h-3 w-3 mr-1" />
              Preview
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => handleDeleteAssessment(assessment.id)}
              className="text-destructive hover:text-destructive"
            >
              <Trash2 className="h-3 w-3" />
            </Button>
          </div>
        </div>
      </CardContent>
    </Card>
  );

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="h-8 w-8 animate-spin" />
        <span className="ml-2">Loading assessments...</span>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold">Assessments & Questions</h2>
          <p className="text-muted-foreground">
            Manage lesson assessments, path quizzes, and class exams
          </p>
        </div>
        <div className="flex items-center space-x-2">
          <Button
            variant="outline"
            onClick={() => onCreateAssessment('lesson_assessment')}
          >
            <Plus className="h-4 w-4 mr-2" />
            Lesson Assessment
          </Button>
          <Button
            variant="outline"
            onClick={() => onCreateAssessment('path_quiz')}
          >
            <Plus className="h-4 w-4 mr-2" />
            Path Quiz
          </Button>
          <Button
            onClick={() => onCreateAssessment('class_exam')}
          >
            <Plus className="h-4 w-4 mr-2" />
            Class Exam
          </Button>
        </div>
      </div>

      {/* Overview Stats */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Lesson Assessments</CardTitle>
            <FileText className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{getAssessmentsByType('lesson_assessment').length}</div>
            <p className="text-xs text-muted-foreground">
              Quick knowledge checks after lessons
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Path Quizzes</CardTitle>
            <BookOpen className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{getAssessmentsByType('path_quiz').length}</div>
            <p className="text-xs text-muted-foreground">
              Comprehensive path evaluations
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Class Exams</CardTitle>
            <GraduationCap className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{getAssessmentsByType('class_exam').length}</div>
            <p className="text-xs text-muted-foreground">
              Major course evaluations
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Filters */}
      <div className="flex flex-col sm:flex-row gap-4">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search assessments..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="pl-10"
          />
        </div>
        <Select value={typeFilter} onValueChange={setTypeFilter}>
          <SelectTrigger className="w-[200px]">
            <SelectValue placeholder="Filter by type" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Types</SelectItem>
            <SelectItem value="lesson_assessment">Lesson Assessments</SelectItem>
            <SelectItem value="path_quiz">Path Quizzes</SelectItem>
            <SelectItem value="class_exam">Class Exams</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Assessments List */}
      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList className="grid w-full grid-cols-4">
          <TabsTrigger value="overview">All ({filteredAssessments.length})</TabsTrigger>
          <TabsTrigger value="lesson_assessment">
            Lessons ({getAssessmentsByType('lesson_assessment').length})
          </TabsTrigger>
          <TabsTrigger value="path_quiz">
            Paths ({getAssessmentsByType('path_quiz').length})
          </TabsTrigger>
          <TabsTrigger value="class_exam">
            Exams ({getAssessmentsByType('class_exam').length})
          </TabsTrigger>
        </TabsList>

        <TabsContent value="overview" className="space-y-4">
          {filteredAssessments.length === 0 ? (
            <Alert>
              <AlertDescription>
                No assessments found. Create your first assessment to get started.
              </AlertDescription>
            </Alert>
          ) : (
            <div className="grid gap-4">
              {filteredAssessments.map(assessment => (
                <AssessmentCard key={assessment.id} assessment={assessment} />
              ))}
            </div>
          )}
        </TabsContent>

        <TabsContent value="lesson_assessment" className="space-y-4">
          <div className="grid gap-4">
            {getAssessmentsByType('lesson_assessment').map(assessment => (
              <AssessmentCard key={assessment.id} assessment={assessment} />
            ))}
          </div>
        </TabsContent>

        <TabsContent value="path_quiz" className="space-y-4">
          <div className="grid gap-4">
            {getAssessmentsByType('path_quiz').map(assessment => (
              <AssessmentCard key={assessment.id} assessment={assessment} />
            ))}
          </div>
        </TabsContent>

        <TabsContent value="class_exam" className="space-y-4">
          <div className="grid gap-4">
            {getAssessmentsByType('class_exam').map(assessment => (
              <AssessmentCard key={assessment.id} assessment={assessment} />
            ))}
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
} 