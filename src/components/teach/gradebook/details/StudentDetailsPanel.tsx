'use client';

import React, { useState } from 'react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { 
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet';
import { 
  X, 
  User, 
  Mail,
  Calendar,
  TrendingUp,
  TrendingDown,
  Target,
  AlertCircle,
  CheckCircle,
  Clock,
  MessageSquare,
  Award
} from 'lucide-react';
import { cn } from '@/lib/utils';

interface StudentDetailsPanelProps {
  studentId: string;
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
  open: boolean;
  onClose: () => void;
}

export function StudentDetailsPanel({
  studentId,
  classInstance,
  data,
  open,
  onClose
}: StudentDetailsPanelProps) {
  const [activeTab, setActiveTab] = useState<'overview' | 'grades' | 'feedback' | 'analytics'>('overview');

  // Mock student data
  const mockStudent = {
    id: studentId,
    name: 'Alice Johnson',
    email: 'alice.johnson@email.com',
    avatar: null,
    overall_grade: 92.5,
    grade_letter: 'A-',
    missing_assignments: 0,
    late_assignments: 1,
    completed_assignments: 15,
    total_assignments: 16,
    mastery_level: 'advanced',
    trend: 'up',
    last_activity: '2024-01-10T10:30:00Z',
    enrollment_date: '2024-01-01T00:00:00Z'
  };

  const mockGradeHistory = [
    { assignment: 'Chapter 1 Quiz', score: 94, max_score: 100, date: '2024-01-15', status: 'graded' },
    { assignment: 'Homework Set 1', score: 92, max_score: 100, date: '2024-01-18', status: 'graded' },
    { assignment: 'Mid-term Project', score: 92, max_score: 100, date: '2024-01-25', status: 'graded' },
    { assignment: 'Final Exam', score: null, max_score: 100, date: '2024-02-15', status: 'missing' }
  ];

  const mockFeedback = [
    {
      assignment: 'Chapter 1 Quiz',
      feedback: 'Excellent work! Your understanding of linear equations is very strong.',
      date: '2024-01-16',
      teacher: 'Ms. Smith'
    },
    {
      assignment: 'Homework Set 1',
      feedback: 'Good work overall. Consider reviewing problem #5 for better understanding.',
      date: '2024-01-19',
      teacher: 'Ms. Smith'
    }
  ];

  const mockStandardsProgress = [
    { id: 'MATH.1.A', name: 'Linear Equations', mastery: 95, level: 'advanced' },
    { id: 'MATH.1.B', name: 'Quadratic Functions', mastery: 88, level: 'proficient' },
    { id: 'MATH.1.C', name: 'Systems of Equations', mastery: 75, level: 'approaching' }
  ];

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString();
  };

  const getMasteryBadge = (level: string) => {
    const variants = {
      'advanced': { className: 'bg-success/10 text-success border-success/20' },
      'proficient': { className: 'bg-info/10 text-info border-info/20' },
      'approaching': { className: 'bg-warning/10 text-warning border-warning/20' },
      'below': { className: 'bg-destructive/10 text-destructive border-destructive/20' }
    };
    const config = variants[level as keyof typeof variants] || variants.approaching;
    return (
      <Badge className={config.className}>
        {level.charAt(0).toUpperCase() + level.slice(1)}
      </Badge>
    );
  };

  const renderOverview = () => (
    <div className="space-y-6">
      {/* Student Info */}
      <Card className="p-6 bg-surface/50 backdrop-blur-sm border-divider shadow-card">
        <div className="flex items-center space-x-4 mb-6">
          <div className="h-16 w-16 bg-brand-gradient rounded-full flex items-center justify-center text-white text-xl font-bold shadow-md">
            {mockStudent.name.split(' ').map(n => n[0]).join('')}
          </div>
          <div>
            <h3 className="text-h2 font-semibold text-foreground">{mockStudent.name}</h3>
            <p className="text-muted-foreground flex items-center text-body">
              <Mail className="h-4 w-4 mr-2" />
              {mockStudent.email}
            </p>
            <p className="text-muted-foreground flex items-center mt-1 text-caption">
              <Calendar className="h-4 w-4 mr-2" />
              Enrolled: {formatDate(mockStudent.enrollment_date)}
            </p>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-6">
          <div>
            <div className="text-center p-4 bg-background/50 rounded-xl border border-divider shadow-sm">
              <div className={cn(
                "text-3xl font-bold mb-1",
                mockStudent.overall_grade >= 90 ? 'text-success' :
                mockStudent.overall_grade >= 80 ? 'text-info' :
                mockStudent.overall_grade >= 70 ? 'text-warning' : 'text-destructive'
              )}>
                {mockStudent.overall_grade}%
              </div>
              <div className="text-caption text-muted-foreground">Overall Grade</div>
              <div className="text-body font-medium text-foreground">{mockStudent.grade_letter}</div>
            </div>
          </div>
          <div>
            <div className="text-center p-4 bg-background/50 rounded-xl border border-divider shadow-sm">
              <div className="mb-2">
                {getMasteryBadge(mockStudent.mastery_level)}
              </div>
              <div className="text-caption text-muted-foreground">Mastery Level</div>
              <div className="flex items-center justify-center mt-2">
                {mockStudent.trend === 'up' ? (
                  <TrendingUp className="h-4 w-4 text-success" />
                ) : (
                  <TrendingDown className="h-4 w-4 text-destructive" />
                )}
                <span className="ml-1 text-caption text-muted-foreground">Trending</span>
              </div>
            </div>
          </div>
        </div>
      </Card>

      {/* Progress Stats */}
      <Card className="p-6 bg-surface/50 backdrop-blur-sm border-divider shadow-card">
        <h4 className="text-h3 font-semibold text-foreground mb-4">Assignment Progress</h4>
        <div className="space-y-4">
          <div>
            <div className="flex items-center justify-between mb-2">
              <span className="text-caption text-muted-foreground">Completion Rate</span>
              <span className="text-caption font-medium text-foreground">
                {mockStudent.completed_assignments}/{mockStudent.total_assignments}
              </span>
            </div>
            <Progress 
              value={(mockStudent.completed_assignments / mockStudent.total_assignments) * 100} 
              className="h-2"
            />
          </div>

          <div className="grid grid-cols-3 gap-4 mt-6">
            <div className="text-center">
              <div className="flex items-center justify-center mb-2">
                <CheckCircle className="h-5 w-5 text-success" />
              </div>
              <div className="text-body font-semibold text-foreground">{mockStudent.completed_assignments}</div>
              <div className="text-caption text-muted-foreground">Completed</div>
            </div>
            <div className="text-center">
              <div className="flex items-center justify-center mb-2">
                <AlertCircle className="h-5 w-5 text-destructive" />
              </div>
              <div className="text-body font-semibold text-foreground">{mockStudent.missing_assignments}</div>
              <div className="text-caption text-muted-foreground">Missing</div>
            </div>
            <div className="text-center">
              <div className="flex items-center justify-center mb-2">
                <Clock className="h-5 w-5 text-warning" />
              </div>
              <div className="text-body font-semibold text-foreground">{mockStudent.late_assignments}</div>
              <div className="text-caption text-muted-foreground">Late</div>
            </div>
          </div>
        </div>
      </Card>

      {/* Standards Progress */}
      <Card className="p-6 bg-surface/50 backdrop-blur-sm border-divider shadow-card">
        <h4 className="text-h3 font-semibold text-foreground mb-4">Standards Mastery</h4>
        <div className="space-y-4">
          {mockStandardsProgress.map((standard) => (
            <div key={standard.id} className="border border-divider rounded-xl p-4 bg-background/30">
              <div className="flex items-center justify-between mb-2">
                <div>
                  <h5 className="font-medium text-foreground text-body">{standard.name}</h5>
                  <p className="text-caption text-muted-foreground">{standard.id}</p>
                </div>
                {getMasteryBadge(standard.level)}
              </div>
              <Progress value={standard.mastery} className="h-2" />
              <div className="text-caption text-muted-foreground mt-1">{standard.mastery}% mastery</div>
            </div>
          ))}
        </div>
      </Card>
    </div>
  );

  const renderGrades = () => (
    <div className="space-y-4">
      {mockGradeHistory.map((grade, index) => (
        <Card key={index} className="p-4 bg-surface/50 backdrop-blur-sm border-divider shadow-card">
          <div className="flex items-center justify-between">
            <div>
              <h4 className="font-medium text-foreground text-body">{grade.assignment}</h4>
              <p className="text-caption text-muted-foreground">{formatDate(grade.date)}</p>
            </div>
            <div className="text-right">
              {grade.status === 'graded' ? (
                <>
                  <div className={cn(
                    "text-h3 font-semibold",
                    (grade.score! / grade.max_score) >= 0.9 ? 'text-success' :
                    (grade.score! / grade.max_score) >= 0.8 ? 'text-info' :
                    (grade.score! / grade.max_score) >= 0.7 ? 'text-warning' : 'text-destructive'
                  )}>
                    {grade.score}/{grade.max_score}
                  </div>
                  <div className="text-caption text-muted-foreground">
                    {Math.round((grade.score! / grade.max_score) * 100)}%
                  </div>
                </>
              ) : (
                <Badge variant="destructive">Missing</Badge>
              )}
            </div>
          </div>
        </Card>
      ))}
    </div>
  );

  const renderFeedback = () => (
    <div className="space-y-4">
      {mockFeedback.map((feedback, index) => (
        <Card key={index} className="p-4 bg-surface/50 backdrop-blur-sm border-divider shadow-card">
          <div className="flex items-start space-x-3">
            <div className="p-2 bg-info/10 rounded-lg">
              <MessageSquare className="h-4 w-4 text-info" />
            </div>
            <div className="flex-1">
              <div className="flex items-center justify-between mb-2">
                <h4 className="font-medium text-foreground text-body">{feedback.assignment}</h4>
                <span className="text-caption text-muted-foreground">{formatDate(feedback.date)}</span>
              </div>
              <p className="text-foreground text-body">{feedback.feedback}</p>
              <p className="text-caption text-muted-foreground mt-2">From: {feedback.teacher}</p>
            </div>
          </div>
        </Card>
      ))}
    </div>
  );

  return (
    <Sheet open={open} onOpenChange={onClose}>
      <SheetContent side="right" className="w-[480px] sm:max-w-[480px] bg-background/95 backdrop-blur-sm border-divider">
        <SheetHeader className="border-b border-divider pb-4">
          <SheetTitle className="text-h2 font-semibold text-foreground">Student Details</SheetTitle>
        </SheetHeader>

        {/* Tabs */}
        <div className="border-b border-divider mt-6">
          <div className="flex">
            {[
              { id: 'overview', label: 'Overview', icon: User },
              { id: 'grades', label: 'Grades', icon: Award },
              { id: 'feedback', label: 'Feedback', icon: MessageSquare }
            ].map((tab) => {
              const IconComponent = tab.icon;
              return (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id as any)}
                  className={cn(
                    "flex-1 px-4 py-3 text-caption font-medium border-b-2 transition-airy",
                    activeTab === tab.id
                      ? "border-primary text-primary"
                      : "border-transparent text-muted-foreground hover:text-foreground"
                  )}
                >
                  <div className="flex items-center justify-center space-x-2">
                    <IconComponent className="h-4 w-4" />
                    <span>{tab.label}</span>
                  </div>
                </button>
              );
            })}
          </div>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-auto py-6">
          {activeTab === 'overview' && renderOverview()}
          {activeTab === 'grades' && renderGrades()}
          {activeTab === 'feedback' && renderFeedback()}
        </div>
      </SheetContent>
    </Sheet>
  );
} 