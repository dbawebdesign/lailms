'use client';

import React, { useState } from 'react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { 
  Search, 
  Filter, 
  User, 
  TrendingUp, 
  TrendingDown, 
  Target,
  AlertCircle,
  CheckCircle,
  Clock,
  BookOpen,
  GraduationCap,
  Mail,
  Activity
} from 'lucide-react';
import { cn } from '@/lib/utils';

interface Student {
  id: string;
  name: string;
  email: string;
  avatar?: string;
  overall_grade?: number;
  grade_letter?: string;
  missing_assignments?: number;
  late_assignments?: number;
  mastery_level?: 'below' | 'approaching' | 'proficient' | 'advanced';
  completed_assignments?: number;
  total_assignments?: number;
  trend?: 'up' | 'down' | 'stable';
  last_activity?: string;
}

interface StudentsOverviewProps {
  classInstance: {
    id: string;
    name: string;
    base_class_id: string;
    enrollment_code: string;
    settings?: any;
  };
  data: {
    students: Student[];
    assignments: any[];
    grades: Record<string, any>;
    standards: any[];
    settings: any;
  };
  onStudentSelect: (studentId: string) => void;
  isLoading: boolean;
}

export function StudentsOverview({
  classInstance,
  data,
  onStudentSelect,
  isLoading
}: StudentsOverviewProps) {
  const [searchTerm, setSearchTerm] = useState('');
  const [sortBy, setSortBy] = useState<'name' | 'grade' | 'progress' | 'activity'>('name');
  const [filterBy, setFilterBy] = useState<'all' | 'at-risk' | 'excelling' | 'missing-work'>('all');

  // Use live data from props
  const students = data.students;

  const filteredStudents = students.filter(student => {
    const matchesSearch = student.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         student.email.toLowerCase().includes(searchTerm.toLowerCase());
    
    const matchesFilter = filterBy === 'all' ||
                         (filterBy === 'at-risk' && (student.overall_grade || 0) < 70) ||
                         (filterBy === 'excelling' && (student.overall_grade || 0) >= 90) ||
                         (filterBy === 'missing-work' && (student.missing_assignments || 0) > 0);
    
    return matchesSearch && matchesFilter;
  });

  const sortedStudents = [...filteredStudents].sort((a, b) => {
    switch (sortBy) {
      case 'name':
        return a.name.localeCompare(b.name);
      case 'grade':
        return (b.overall_grade || 0) - (a.overall_grade || 0);
      case 'progress':
        const aProgress = (a.completed_assignments || 0) / (a.total_assignments || 1);
        const bProgress = (b.completed_assignments || 0) / (b.total_assignments || 1);
        return bProgress - aProgress;
      case 'activity':
        return new Date(b.last_activity || 0).getTime() - new Date(a.last_activity || 0).getTime();
      default:
        return 0;
    }
  });

  const getMasteryBadge = (level: string) => {
    switch (level) {
      case 'advanced':
        return <Badge className="bg-success/10 text-success border-success/20">Advanced</Badge>;
      case 'proficient':
        return <Badge className="bg-info/10 text-info border-info/20">Proficient</Badge>;
      case 'approaching':
        return <Badge className="bg-warning/10 text-warning border-warning/20">Approaching</Badge>;
      case 'below':
        return <Badge className="bg-destructive/10 text-destructive border-destructive/20">Below</Badge>;
      default:
        return <Badge variant="secondary">Unknown</Badge>;
    }
  };

  const getTrendIcon = (trend: string) => {
    switch (trend) {
      case 'up':
        return <TrendingUp className="h-4 w-4 text-success" />;
      case 'down':
        return <TrendingDown className="h-4 w-4 text-destructive" />;
      default:
        return <div className="h-4 w-4" />;
    }
  };

  const formatLastActivity = (dateString?: string) => {
    if (!dateString) return 'Never';
    
    const date = new Date(dateString);
    const now = new Date();
    const diffInHours = Math.floor((now.getTime() - date.getTime()) / (1000 * 60 * 60));
    
    if (diffInHours < 1) return 'Just now';
    if (diffInHours < 24) return `${diffInHours}h ago`;
    if (diffInHours < 48) return 'Yesterday';
    return `${Math.floor(diffInHours / 24)}d ago`;
  };

  const getRiskLevel = (student: Student) => {
    const grade = student.overall_grade || 0;
    const missing = student.missing_assignments || 0;
    
    if (grade < 60 || missing > 3) return 'high';
    if (grade < 75 || missing > 1) return 'medium';
    return 'low';
  };

  const getRiskBadge = (risk: string) => {
    switch (risk) {
      case 'high':
        return <Badge className="bg-destructive/10 text-destructive border-destructive/20">High Risk</Badge>;
      case 'medium':
        return <Badge className="bg-warning/10 text-warning border-warning/20">At Risk</Badge>;
      default:
        return null;
    }
  };

  if (isLoading) {
    return (
      <div className="flex-1 flex items-center justify-center bg-background">
        <div className="text-center space-y-4">
          <User className="h-16 w-16 text-muted-foreground mx-auto animate-pulse" />
          <div className="space-y-2">
            <h3 className="text-h3 font-medium text-foreground">Loading students...</h3>
            <p className="text-caption text-muted-foreground">Please wait while we load student data</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="flex-1 flex flex-col bg-background">
      {/* Header and Controls - Following style guide: generous spacing, clean layout */}
      <div className="border-b border-divider bg-surface/50 backdrop-blur-sm">
        <div className="p-6 space-y-6">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-h2 font-semibold text-foreground tracking-wide">Students Overview</h2>
              <p className="text-caption text-muted-foreground mt-1">Track individual student progress and performance</p>
            </div>
            <div className="flex items-center space-x-4">
              <div className="text-caption text-muted-foreground">
                {filteredStudents.length} of {students.length} students
              </div>
            </div>
          </div>

          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-4">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Search students..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pl-10 w-80 bg-background border-input-border focus:border-ring focus:ring-2 focus:ring-ring/20 transition-airy"
                />
              </div>
              
              <select
                value={filterBy}
                onChange={(e) => setFilterBy(e.target.value as any)}
                className="px-4 py-2 border border-input-border rounded-lg bg-background text-foreground focus:border-ring focus:ring-2 focus:ring-ring/20 transition-airy"
              >
                <option value="all">All Students</option>
                <option value="at-risk">At Risk</option>
                <option value="excelling">Excelling</option>
                <option value="missing-work">Missing Work</option>
              </select>
            </div>

            <div className="flex items-center space-x-2">
              <span className="text-caption text-muted-foreground">Sort by:</span>
              <select
                value={sortBy}
                onChange={(e) => setSortBy(e.target.value as any)}
                className="px-3 py-1.5 border border-input-border rounded-lg bg-background text-foreground text-sm focus:border-ring transition-airy"
              >
                <option value="name">Name</option>
                <option value="grade">Grade</option>
                <option value="progress">Progress</option>
                <option value="activity">Last Activity</option>
              </select>
            </div>
          </div>
        </div>
      </div>

      {/* Students Grid - Following style guide: spacious, clean cards */}
      <div className="flex-1 overflow-auto p-6">
        {sortedStudents.length === 0 ? (
          <div className="flex items-center justify-center h-full">
            <div className="text-center space-y-4">
              <User className="h-16 w-16 text-muted-foreground mx-auto" />
              <div className="space-y-2">
                <h3 className="text-h3 font-medium text-foreground">No students found</h3>
                <p className="text-caption text-muted-foreground">
                  {searchTerm ? 'Try adjusting your search or filter criteria' : 'No students match your current filters'}
                </p>
              </div>
            </div>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-2 xl:grid-cols-2 2xl:grid-cols-3 gap-6">
            {sortedStudents.map((student) => {
              const progressPercentage = ((student.completed_assignments || 0) / (student.total_assignments || 1)) * 100;
              const riskLevel = getRiskLevel(student);
              
              return (
                <Card 
                  key={student.id}
                  className="group cursor-pointer transition-airy hover:shadow-lg hover:-translate-y-1 bg-surface border-divider"
                  onClick={() => onStudentSelect(student.id)}
                >
                  <div className="p-6 space-y-5">
                    {/* Student Header */}
                    <div className="flex items-start justify-between">
                      <div className="flex items-center space-x-4">
                        <div className="h-12 w-12 bg-brand-gradient rounded-full flex items-center justify-center text-white text-sm font-medium shadow-sm">
                          {student.name.split(' ').map(n => n[0]).join('')}
                        </div>
                        <div className="space-y-1">
                          <h3 className="text-body font-semibold text-foreground group-hover:text-primary transition-airy">
                            {student.name}
                          </h3>
                          <div className="flex items-center space-x-1 text-caption text-muted-foreground">
                            <Mail className="h-3 w-3" />
                            <span>{student.email}</span>
                          </div>
                        </div>
                      </div>
                      {getTrendIcon(student.trend || 'stable')}
                    </div>

                    {/* Grade and Mastery */}
                    <div className="space-y-3">
                      <div className="flex items-center justify-between">
                        <div className="space-y-1">
                          <div className="text-caption text-muted-foreground">Overall Grade</div>
                          <div className={cn(
                            "text-h3 font-bold",
                            (student.overall_grade || 0) >= 90 ? 'text-success' :
                            (student.overall_grade || 0) >= 80 ? 'text-info' :
                            (student.overall_grade || 0) >= 70 ? 'text-warning' : 'text-destructive'
                          )}>
                            {student.overall_grade ? `${student.overall_grade}%` : 'N/A'}
                          </div>
                          <div className="text-caption text-muted-foreground">
                            {student.grade_letter || '-'}
                          </div>
                        </div>
                        <div className="text-right space-y-2">
                          {getMasteryBadge(student.mastery_level || 'approaching')}
                          {getRiskBadge(riskLevel)}
                        </div>
                      </div>
                    </div>

                    {/* Progress Bar */}
                    <div className="space-y-2">
                      <div className="flex items-center justify-between text-caption">
                        <span className="text-muted-foreground">Assignment Progress</span>
                        <span className="font-medium text-foreground">
                          {student.completed_assignments || 0}/{student.total_assignments || 0}
                        </span>
                      </div>
                      <Progress 
                        value={progressPercentage} 
                        className="h-2 bg-muted"
                      />
                    </div>

                    {/* Stats Grid */}
                    <div className="grid grid-cols-2 gap-4">
                      <div className="space-y-1">
                        <div className="flex items-center space-x-1">
                          <AlertCircle className="h-3 w-3 text-destructive" />
                          <span className="text-caption text-muted-foreground">Missing</span>
                        </div>
                        <div className="text-body font-semibold text-destructive">
                          {student.missing_assignments || 0}
                        </div>
                      </div>
                      <div className="space-y-1">
                        <div className="flex items-center space-x-1">
                          <Clock className="h-3 w-3 text-warning" />
                          <span className="text-caption text-muted-foreground">Late</span>
                        </div>
                        <div className="text-body font-semibold text-warning">
                          {student.late_assignments || 0}
                        </div>
                      </div>
                    </div>

                    {/* Last Activity */}
                    <div className="border-t border-divider pt-4">
                      <div className="flex items-center justify-between text-caption">
                        <div className="flex items-center space-x-1 text-muted-foreground">
                          <Activity className="h-3 w-3" />
                          <span>Last activity</span>
                        </div>
                        <span className="font-medium text-foreground">
                          {formatLastActivity(student.last_activity)}
                        </span>
                      </div>
                    </div>
                  </div>
                </Card>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
} 