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

  // Find the actual student from the data
  const student = data.students.find(s => s.id === studentId);
  
  // If student not found, return early
  if (!student) {
    return null;
  }

  // Use actual student data
  const studentData = {
    id: student.id,
    name: student.name || 'Unknown Student',
    email: student.email || 'No email provided',
    avatar: student.avatar_url || null,
    overall_grade: student.overall_grade || 0,
    grade_letter: student.grade_letter || 'N/A',
    missing_assignments: student.missing_assignments || 0,
    late_assignments: student.late_assignments || 0,
    completed_assignments: student.completed_assignments || 0,
    total_assignments: student.total_assignments || 0,
    mastery_level: student.mastery_level || 'approaching',
    trend: student.trend || 'stable',
    last_activity: student.last_activity || new Date().toISOString(),
    enrollment_date: student.enrollment_date || student.created_at || new Date().toISOString()
  };

  // Get real grade history for this student
  const gradeHistory = data.assignments.map(assignment => {
    const grade = data.grades[`${studentId}-${assignment.id}`];
    
    let status = 'missing';
    if (grade) {
      if (grade.status === 'graded' || (grade.points_earned !== null && grade.points_earned !== undefined)) {
        status = 'graded';
      } else if (grade.status === 'late') {
        status = 'late';
      } else if (grade.status === 'excused') {
        status = 'excused';
      } else if (grade.status === 'missing') {
        status = 'missing';
      }
    }
    
    return {
      assignment: assignment.name,
      score: grade?.points_earned || null,
      max_score: assignment.points_possible || 100,
      date: assignment.due_date || assignment.created_at,
      status: status,
      feedback: grade?.feedback || null
    };
  }).filter(item => item.assignment); // Filter out any invalid entries

  // Get real feedback for this student
  const feedbackData = gradeHistory
    .filter(item => item.feedback && item.feedback.trim().length > 0)
    .map(item => ({
      assignment: item.assignment,
      feedback: item.feedback,
      date: item.date,
      teacher: 'Teacher' // TODO: Get actual teacher name from assignment or grade data
    }));

  // Get real standards progress for this student
  const standardsProgress = data.standards.map(standard => {
    // TODO: Calculate actual mastery percentage based on student's performance
    // For now, use a placeholder calculation
    const mastery = Math.floor(Math.random() * 100); // This should be replaced with real calculation
    const level = mastery >= 90 ? 'advanced' : 
                  mastery >= 80 ? 'proficient' : 
                  mastery >= 70 ? 'approaching' : 'below';
    
    return {
      id: standard.id || standard.standard_id,
      name: standard.name || standard.title,
      mastery: mastery,
      level: level
    };
  }).filter(item => item.id && item.name); // Filter out invalid entries

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
            {studentData.name.split(' ').map((n: string) => n[0]).join('')}
          </div>
          <div>
            <h3 className="text-h2 font-semibold text-foreground">{studentData.name}</h3>
            <p className="text-muted-foreground flex items-center text-body">
              <Mail className="h-4 w-4 mr-2" />
              {studentData.email}
            </p>
            <p className="text-muted-foreground flex items-center mt-1 text-caption">
              <Calendar className="h-4 w-4 mr-2" />
              Enrolled: {formatDate(studentData.enrollment_date)}
            </p>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-6">
          <div>
            <div className="text-center p-4 bg-background/50 rounded-xl border border-divider shadow-sm">
              <div className={cn(
                "text-3xl font-bold mb-1",
                studentData.overall_grade >= 90 ? 'text-success' :
                studentData.overall_grade >= 80 ? 'text-info' :
                studentData.overall_grade >= 70 ? 'text-warning' : 'text-destructive'
              )}>
                {studentData.overall_grade}%
              </div>
              <div className="text-caption text-muted-foreground">Overall Grade</div>
              <div className="text-body font-medium text-foreground">{studentData.grade_letter}</div>
            </div>
          </div>
          <div>
            <div className="text-center p-4 bg-background/50 rounded-xl border border-divider shadow-sm">
              <div className="mb-2">
                {getMasteryBadge(studentData.mastery_level)}
              </div>
              <div className="text-caption text-muted-foreground">Mastery Level</div>
              <div className="flex items-center justify-center mt-2">
                {studentData.trend === 'up' ? (
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
                {studentData.completed_assignments}/{studentData.total_assignments}
              </span>
            </div>
            <Progress 
              value={(studentData.completed_assignments / studentData.total_assignments) * 100} 
              className="h-2"
            />
          </div>

          <div className="grid grid-cols-3 gap-4 mt-6">
            <div className="text-center">
              <div className="flex items-center justify-center mb-2">
                <CheckCircle className="h-5 w-5 text-success" />
              </div>
              <div className="text-body font-semibold text-foreground">{studentData.completed_assignments}</div>
              <div className="text-caption text-muted-foreground">Completed</div>
            </div>
            <div className="text-center">
              <div className="flex items-center justify-center mb-2">
                <AlertCircle className="h-5 w-5 text-destructive" />
              </div>
              <div className="text-body font-semibold text-foreground">{studentData.missing_assignments}</div>
              <div className="text-caption text-muted-foreground">Missing</div>
            </div>
            <div className="text-center">
              <div className="flex items-center justify-center mb-2">
                <Clock className="h-5 w-5 text-warning" />
              </div>
              <div className="text-body font-semibold text-foreground">{studentData.late_assignments}</div>
              <div className="text-caption text-muted-foreground">Late</div>
            </div>
          </div>
        </div>
      </Card>

      {/* Standards Progress */}
      <Card className="p-6 bg-surface/50 backdrop-blur-sm border-divider shadow-card">
        <h4 className="text-h3 font-semibold text-foreground mb-4">Standards Mastery</h4>
        <div className="space-y-4">
          {standardsProgress.map((standard: any) => (
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
      {gradeHistory.map((grade: any, index: number) => (
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
              ) : grade.status === 'late' ? (
                <Badge variant="outline" className="bg-warning/10 text-warning border-warning/20">
                  Late
                </Badge>
              ) : grade.status === 'excused' ? (
                <Badge variant="outline" className="bg-muted/10 text-muted-foreground border-muted/20">
                  Excused
                </Badge>
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
      {feedbackData.map((feedback: any, index: number) => (
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