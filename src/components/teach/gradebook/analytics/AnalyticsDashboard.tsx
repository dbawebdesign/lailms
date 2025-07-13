'use client';

import React, { useState } from 'react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { 
  BarChart3, 
  TrendingUp, 
  TrendingDown, 
  Users, 
  Target,
  AlertTriangle,
  CheckCircle,
  Calendar,
  Award,
  Activity,
  Filter,
  Download,
  Eye,
  Brain,
  FileText,
  Monitor,
  BookOpen
} from 'lucide-react';
import { cn } from '@/lib/utils';

interface AnalyticsDashboardProps {
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
  isLoading: boolean;
}

export function AnalyticsDashboard({
  classInstance,
  data,
  isLoading
}: AnalyticsDashboardProps) {
  const [timeRange, setTimeRange] = useState<'week' | 'month' | 'semester' | 'year'>('month');
  const [viewType, setViewType] = useState<'overview' | 'trends' | 'standards' | 'predictions'>('overview');

  // Calculate real analytics data from the gradebook data
  const calculateAnalytics = () => {
    const { students, assignments, grades } = data;
    
    if (!students?.length || !assignments?.length) {
      return {
        overview: {
          totalStudents: 0,
          classAverage: 0,
          averageTrend: 0,
          completionRate: 0,
          atRiskStudents: 0,
          excellingStudents: 0,
          gradingProgress: 0
        },
        gradeDistribution: [],
        assignmentTypes: [],
        standards: [],
        recentActivity: [],
        predictions: []
      };
    }

    // Calculate class average using the overall_grade from students (already calculated in useGradebook)
    const studentGrades = students.map(student => student.overall_grade || 0);
    const classAverage = studentGrades.length > 0 ? 
      studentGrades.reduce((sum, grade) => sum + grade, 0) / studentGrades.length : 0;

    // Calculate completion rate using the correct key format (student_id-assignment_id)
    const totalPossibleSubmissions = students.length * assignments.length;
    const actualSubmissions = students.flatMap(student => 
      assignments.map(assignment => grades[`${student.id}-${assignment.id}`])
    ).filter(grade => grade && grade.points_earned !== null && grade.status !== 'missing').length;
    const completionRate = totalPossibleSubmissions > 0 ? 
      (actualSubmissions / totalPossibleSubmissions) * 100 : 0;

    // Use the already calculated student overall grades for distribution
    const gradeDistribution = [
      { grade: 'A', count: studentGrades.filter(avg => avg >= 90).length, percentage: 0 },
      { grade: 'B', count: studentGrades.filter(avg => avg >= 80 && avg < 90).length, percentage: 0 },
      { grade: 'C', count: studentGrades.filter(avg => avg >= 70 && avg < 80).length, percentage: 0 },
      { grade: 'D', count: studentGrades.filter(avg => avg >= 60 && avg < 70).length, percentage: 0 },
      { grade: 'F', count: studentGrades.filter(avg => avg < 60).length, percentage: 0 }
    ].map((item: { grade: string; count: number; percentage: number }) => ({
      ...item,
      percentage: students.length > 0 ? (item.count / students.length) * 100 : 0
    }));

    // Calculate at-risk and excelling students using overall grades
    const atRiskStudents = studentGrades.filter(avg => avg < 70).length;
    const excellingStudents = studentGrades.filter(avg => avg >= 90).length;

    // Calculate assignment types averages using correct key format
    const assignmentTypes = assignments.reduce((acc, assignment) => {
      const type = assignment.type || 'Assignment';
      const assignmentGrades = students.map(student => {
        const grade = grades[`${student.id}-${assignment.id}`];
        if (!grade || grade.points_earned === null || grade.status === 'missing') return null;
        // Calculate percentage for this assignment
        const percentage = assignment.points_possible > 0 ? 
          (grade.points_earned / assignment.points_possible) * 100 : 0;
        return percentage;
      }).filter(grade => grade !== null);
      
      // Skip if no valid grades for this assignment
      if (assignmentGrades.length === 0) return acc;
      
      const average = assignmentGrades.reduce((sum, grade) => sum + grade, 0) / assignmentGrades.length;
      
      // Ensure average is a valid number
      if (isNaN(average) || !isFinite(average)) return acc;

      const existing = acc.find((item: { type: string; average: number; count: number; total: number }) => item.type === type);
      if (existing) {
        existing.total += average;
        existing.count += 1;
        existing.average = existing.total / existing.count;
      } else {
        acc.push({ type, average, count: 1, total: average });
      }
      return acc;
    }, [] as Array<{ type: string; average: number; count: number; total: number }>);

    // Calculate grading progress using correct key format
    const gradedSubmissions = students.flatMap(student => 
      assignments.map(assignment => grades[`${student.id}-${assignment.id}`])
    ).filter(grade => grade && grade.points_earned !== null && grade.graded_at).length;
    const gradingProgress = totalPossibleSubmissions > 0 ? 
      (gradedSubmissions / totalPossibleSubmissions) * 100 : 0;

    return {
      overview: {
        totalStudents: students.length,
        classAverage: Math.round(classAverage * 10) / 10,
        averageTrend: 0, // Would need historical data to calculate
        completionRate: Math.round(completionRate * 10) / 10,
        atRiskStudents,
        excellingStudents,
        gradingProgress: Math.round(gradingProgress * 10) / 10
      },
      gradeDistribution,
      assignmentTypes: assignmentTypes.map(({ total, ...rest }: { total: number; type: string; average: number; count: number }) => ({
        ...rest,
        average: isNaN(rest.average) || !isFinite(rest.average) ? 0 : Math.round(rest.average * 10) / 10
      })),
      standards: data.standards || [],
      recentActivity: [] as Array<{ type: string; student?: string; teacher?: string; assignment: string; time: string }>,
      predictions: [] as Array<{ student: string; current_grade: number; predicted_final: number; confidence: number; risk_level: string }>
    };
  };

  const analytics = calculateAnalytics();

  const StatCard = ({ icon: Icon, title, value, subtitle, trend, className, color = 'primary' }: {
    icon: React.ComponentType<{ className?: string }>;
    title: string;
    value: string | number;
    subtitle?: string;
    trend?: number;
    className?: string;
    color?: 'primary' | 'success' | 'warning' | 'info';
  }) => (
    <Card className={cn("p-4 lg:p-6 bg-surface/50 border-divider hover:shadow-lg transition-airy", className)}>
      <div className="flex items-center gap-3 lg:gap-4">
        <div className={cn(
          "p-2 lg:p-3 rounded-xl transition-airy",
          color === 'primary' && "bg-primary/10",
          color === 'success' && "bg-success/10",
          color === 'warning' && "bg-warning/10",
          color === 'info' && "bg-info/10"
        )}>
          <Icon className={cn(
            "w-5 h-5 lg:w-6 lg:h-6",
            color === 'primary' && "text-primary",
            color === 'success' && "text-success",
            color === 'warning' && "text-warning",
            color === 'info' && "text-info"
          )} />
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-xs lg:text-caption text-muted-foreground font-medium">{title}</p>
          <p className="text-lg lg:text-h2 font-bold text-foreground mt-1">{value}</p>
          {subtitle && (
            <div className="flex items-center gap-2 mt-1 lg:mt-2">
              {trend && (
                trend > 0 ? 
                  <TrendingUp className="w-3 h-3 lg:w-4 lg:h-4 text-success" /> :
                  <TrendingDown className="w-3 h-3 lg:w-4 lg:h-4 text-destructive" />
              )}
              <p className="text-xs lg:text-caption text-muted-foreground truncate">{subtitle}</p>
            </div>
          )}
        </div>
      </div>
    </Card>
  );

  // Desktop-only message for smaller screens
  const DesktopOnlyMessage = () => (
    <div className="flex items-center justify-center min-h-screen bg-background p-8">
      <Card className="p-12 bg-surface/50 border-divider text-center max-w-md mx-auto">
        <div className="space-y-6">
          <div className="p-4 bg-primary/10 rounded-full w-fit mx-auto">
            <Monitor className="w-12 h-12 text-primary" />
          </div>
          <div>
            <h3 className="text-h2 font-semibold text-foreground mb-3">Desktop Required</h3>
            <p className="text-body text-muted-foreground mb-6">
              The Gradebook Analytics Dashboard is optimized for desktop viewing. Please use a larger screen to access these advanced analytics features.
            </p>
          </div>
          <Badge variant="outline" className="bg-info/10 text-info border-info/20">
            Minimum width: 1024px
          </Badge>
        </div>
      </Card>
    </div>
  );

  const renderOverview = () => (
    <div className="space-y-6 lg:space-y-8">
      {/* Key Metrics Grid - Responsive for different desktop sizes */}
      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-2 lg:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4 gap-4 lg:gap-6">
        <StatCard
          icon={Users}
          title="Total Students"
          value={analytics.overview.totalStudents}
          subtitle="Active enrollment"
          color="info"
        />
        <StatCard
          icon={BarChart3}
          title="Class Average"
          value={`${analytics.overview.classAverage}%`}
          subtitle={`+${analytics.overview.averageTrend}% this ${timeRange}`}
          trend={analytics.overview.averageTrend}
          color="primary"
        />
        <StatCard
          icon={CheckCircle}
          title="Completion Rate"
          value={`${analytics.overview.completionRate}%`}
          subtitle="Assignment submissions"
          color="success"
        />
        <StatCard
          icon={AlertTriangle}
          title="At-Risk Students"
          value={analytics.overview.atRiskStudents}
          subtitle="Below 70% average"
          color="warning"
        />
      </div>

      {/* Grade Distribution Chart */}
      <Card className="p-6 lg:p-8 bg-surface/50 border-divider">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between mb-6 gap-4">
          <div>
            <h3 className="text-lg lg:text-h3 font-semibold text-foreground">Grade Distribution</h3>
            <p className="text-xs lg:text-caption text-muted-foreground mt-1">Current grade breakdown across all students</p>
          </div>
          <Badge variant="secondary" className="bg-info/10 text-info border-info/20 w-fit">
            {analytics.overview.totalStudents} students
          </Badge>
        </div>
        <div className="space-y-4 lg:space-y-5">
          {analytics.gradeDistribution.map((grade) => (
            <div key={grade.grade} className="flex items-center gap-4 lg:gap-6">
              <div className="w-7 h-7 lg:w-8 lg:h-8 rounded-lg bg-primary/10 flex items-center justify-center flex-shrink-0">
                <span className="font-bold text-primary text-sm lg:text-base">{grade.grade}</span>
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center justify-between mb-2 gap-2">
                  <span className="text-xs lg:text-caption font-medium text-foreground">Grade {grade.grade}</span>
                  <span className="text-xs lg:text-caption text-muted-foreground whitespace-nowrap">
                    {grade.count} students ({grade.percentage}%)
                  </span>
                </div>
                <Progress 
                  value={grade.percentage} 
                  className="h-2 lg:h-3 bg-muted/50"
                />
              </div>
            </div>
          ))}
        </div>
      </Card>

      {/* Assignment Type Performance */}
      <Card className="p-6 lg:p-8 bg-surface/50 border-divider">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between mb-6 gap-4">
          <div>
            <h3 className="text-lg lg:text-h3 font-semibold text-foreground">Performance by Assignment Type</h3>
            <p className="text-xs lg:text-caption text-muted-foreground mt-1">Average scores across different assignment categories</p>
          </div>
        </div>
        {analytics.assignmentTypes.length > 0 ? (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 lg:gap-6">
            {analytics.assignmentTypes.map((type: { type: string; average: number; count: number }) => (
              <div key={type.type} className="p-4 lg:p-6 bg-background rounded-xl border border-divider hover:shadow-md transition-airy">
                <div className="flex items-center justify-between mb-3 lg:mb-4">
                  <h4 className="text-sm lg:text-body font-semibold text-foreground">{type.type}</h4>
                  <Badge variant="outline" className="border-divider text-xs">
                    {type.count} assignments
                  </Badge>
                </div>
                <div className="text-xl lg:text-h2 font-bold text-primary mb-1 lg:mb-2">{type.average}%</div>
                <div className="text-xs lg:text-caption text-muted-foreground">Average score</div>
              </div>
            ))}
          </div>
        ) : (
          <div className="text-center py-8">
            <BookOpen className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
            <h4 className="text-body font-medium text-foreground mb-2">No Graded Assignments Yet</h4>
            <p className="text-caption text-muted-foreground">
              Assignment type performance will appear here once students complete and receive grades on assignments.
            </p>
          </div>
        )}
      </Card>
    </div>
  );

  const renderStandards = () => (
    <div className="space-y-6 lg:space-y-8">
      <Card className="p-6 lg:p-8 bg-surface/50 border-divider">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between mb-6 gap-4">
          <div>
            <h3 className="text-lg lg:text-h3 font-semibold text-foreground">Standards Mastery Overview</h3>
            <p className="text-xs lg:text-caption text-muted-foreground mt-1">Track student progress on learning standards</p>
          </div>
          <Badge variant="secondary" className="bg-primary/10 text-primary border-primary/20 w-fit">
            {analytics.standards.length} standards tracked
          </Badge>
        </div>
        
        <div className="space-y-4 lg:space-y-6">
          {analytics.standards.map((standard) => (
            <div key={standard.id} className="p-4 lg:p-6 bg-background rounded-xl border border-divider">
              <div className="flex flex-col lg:flex-row lg:items-center justify-between mb-4 gap-3">
                <div className="min-w-0 flex-1">
                  <h4 className="text-sm lg:text-body font-semibold text-foreground">{standard.name}</h4>
                  <p className="text-xs lg:text-caption text-muted-foreground">{standard.id}</p>
                </div>
                <div className="flex items-center gap-3">
                  {standard.trend === 'up' && <TrendingUp className="w-4 h-4 lg:w-5 lg:h-5 text-success" />}
                  {standard.trend === 'down' && <TrendingDown className="w-4 h-4 lg:w-5 lg:h-5 text-destructive" />}
                  {standard.trend === 'stable' && <div className="w-4 h-4 lg:w-5 lg:h-5 rounded-full bg-muted-foreground/20" />}
                  <Badge 
                    variant="outline" 
                    className={cn(
                      "text-xs",
                      standard.mastery >= 80 ? "border-success/20 text-success bg-success/10" :
                      standard.mastery >= 60 ? "border-warning/20 text-warning bg-warning/10" :
                      "border-destructive/20 text-destructive bg-destructive/10"
                    )}
                  >
                    {standard.mastery}% mastery
                  </Badge>
                </div>
              </div>
              
              <div className="space-y-3">
                <div className="flex items-center justify-between text-xs lg:text-caption text-muted-foreground">
                  <span>{standard.students_mastered} of {standard.total_students} students mastered</span>
                  <span>{standard.mastery}%</span>
                </div>
                <Progress 
                  value={standard.mastery} 
                  className="h-2 lg:h-3 bg-muted/50"
                />
              </div>
            </div>
          ))}
        </div>
      </Card>
    </div>
  );

  const renderPredictions = () => (
    <div className="space-y-6 lg:space-y-8">
      <Card className="p-6 lg:p-8 bg-surface/50 border-divider">
        <div className="flex flex-col lg:flex-row lg:items-center gap-3 mb-6">
          <div className="p-2 bg-accent/10 rounded-lg w-fit">
            <Brain className="w-5 h-5 lg:w-6 lg:h-6 text-accent" />
          </div>
          <div className="flex-1 min-w-0">
            <h3 className="text-lg lg:text-h3 font-semibold text-foreground">AI-Powered Predictions</h3>
            <p className="text-xs lg:text-caption text-muted-foreground mt-1">
              Predictive analytics based on current performance trends and historical data
            </p>
          </div>
          <Badge variant="secondary" className="bg-accent/10 text-accent border-accent/20 w-fit">
            Beta
          </Badge>
        </div>
        
        <div className="space-y-4 lg:space-y-6">
          {analytics.predictions.map((prediction, index) => (
            <div key={index} className="p-4 lg:p-6 bg-background rounded-xl border border-divider">
              <div className="flex flex-col lg:flex-row lg:items-center justify-between mb-4 gap-3">
                <div className="min-w-0 flex-1">
                  <h4 className="text-sm lg:text-body font-semibold text-foreground">{prediction.student}</h4>
                  <div className="flex items-center gap-2 mt-1">
                    <span className="text-xs lg:text-caption text-muted-foreground">Risk Level:</span>
                    <Badge 
                      variant="outline"
                      className={cn(
                        "text-xs",
                        prediction.risk_level === 'high' ? "border-destructive/20 text-destructive bg-destructive/10" :
                        prediction.risk_level === 'medium' ? "border-warning/20 text-warning bg-warning/10" : 
                        "border-success/20 text-success bg-success/10"
                      )}
                    >
                      {prediction.risk_level.charAt(0).toUpperCase() + prediction.risk_level.slice(1)}
                    </Badge>
                  </div>
                </div>
                <Badge variant="outline" className="border-info/20 text-info bg-info/10 text-xs w-fit">
                  {prediction.confidence}% confidence
                </Badge>
              </div>
              
              <div className="grid grid-cols-2 gap-4 lg:gap-6 mb-4">
                <div>
                  <p className="text-xs lg:text-caption text-muted-foreground font-medium">Current Grade</p>
                  <p className="text-lg lg:text-h3 font-bold text-foreground mt-1">{prediction.current_grade}%</p>
                </div>
                <div>
                  <p className="text-xs lg:text-caption text-muted-foreground font-medium">Predicted Final</p>
                  <p className={cn(
                    "text-lg lg:text-h3 font-bold mt-1",
                    prediction.predicted_final >= prediction.current_grade ? 'text-success' : 'text-destructive'
                  )}>
                    {prediction.predicted_final}%
                    {prediction.predicted_final >= prediction.current_grade ? (
                      <TrendingUp className="w-3 h-3 lg:w-4 lg:h-4 inline ml-1" />
                    ) : (
                      <TrendingDown className="w-3 h-3 lg:w-4 lg:h-4 inline ml-1" />
                    )}
                  </p>
                </div>
              </div>
              
              {prediction.risk_level === 'high' && (
                <div className="p-3 lg:p-4 bg-destructive/5 border border-destructive/20 rounded-lg">
                  <div className="flex items-start gap-3">
                    <AlertTriangle className="w-4 h-4 lg:w-5 lg:h-5 text-destructive mt-0.5 flex-shrink-0" />
                    <div className="min-w-0">
                      <p className="text-xs lg:text-caption font-medium text-destructive">Intervention Recommended</p>
                      <p className="text-xs lg:text-caption text-destructive/80 mt-1">
                        Consider extra help sessions, modified assignments, or parent contact.
                      </p>
                    </div>
                  </div>
                </div>
              )}
            </div>
          ))}
        </div>
      </Card>
    </div>
  );

  const renderRecentActivity = () => (
    <Card className="p-4 lg:p-6 bg-surface/50 border-divider">
      <h3 className="text-base lg:text-h3 font-semibold text-foreground mb-4">Recent Activity</h3>
      <div className="space-y-3 lg:space-y-4">
        {analytics.recentActivity.map((activity, index) => (
          <div key={index} className="flex items-center gap-3 lg:gap-4 p-3 lg:p-4 bg-background rounded-lg border border-divider">
            <div className={cn(
              "p-1.5 lg:p-2 rounded-lg flex-shrink-0",
              activity.type === 'submission' ? 'bg-success/10' :
              activity.type === 'grade' ? 'bg-info/10' :
              activity.type === 'late' ? 'bg-warning/10' : 'bg-muted/50'
            )}>
              {activity.type === 'submission' && <CheckCircle className="w-3 h-3 lg:w-4 lg:h-4 text-success" />}
              {activity.type === 'grade' && <Award className="w-3 h-3 lg:w-4 lg:h-4 text-info" />}
              {activity.type === 'late' && <AlertTriangle className="w-3 h-3 lg:w-4 lg:h-4 text-warning" />}
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-xs lg:text-caption font-medium text-foreground">
                {activity.type === 'submission' && `${activity.student} submitted ${activity.assignment}`}
                {activity.type === 'grade' && `${activity.teacher} graded ${activity.assignment}`}
                {activity.type === 'late' && `${activity.student} submitted ${activity.assignment} late`}
              </p>
              <p className="text-xs text-muted-foreground mt-1">{activity.time}</p>
            </div>
          </div>
        ))}
      </div>
    </Card>
  );

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-full min-h-[400px]">
        <div className="text-center space-y-4">
          <BarChart3 className="w-16 h-16 text-muted-foreground mx-auto animate-pulse" />
          <div>
            <h3 className="text-h3 font-medium text-foreground">Loading Analytics</h3>
            <p className="text-caption text-muted-foreground mt-1">Gathering insights from your data...</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <>
      {/* Show desktop-only message for screens smaller than lg (1024px) */}
      <div className="lg:hidden">
        <DesktopOnlyMessage />
      </div>

      {/* Main desktop layout */}
      <div className="hidden lg:flex flex-col h-full bg-background">
        {/* Header */}
        <div className="p-6 xl:p-8 border-b border-divider bg-surface/30">
          <div className="flex flex-col xl:flex-row xl:items-center justify-between mb-6 gap-4">
            <div>
              <h2 className="text-xl xl:text-h1 font-bold text-foreground">Analytics Dashboard</h2>
              <p className="text-sm xl:text-body text-muted-foreground mt-2">
                Insights and performance analytics for your class
              </p>
            </div>
            <Button 
              variant="outline" 
              className="hover:bg-surface/80 border-divider transition-airy w-fit"
            >
              <Download className="w-4 h-4 mr-2" />
              Export Report
            </Button>
          </div>

          {/* Navigation Tabs */}
          <div className="flex flex-col lg:flex-row lg:items-center gap-4 lg:gap-6">
            <div className="flex items-center gap-1 p-1 bg-background rounded-lg border border-divider">
              {[
                { id: 'overview', label: 'Overview', icon: BarChart3 },
                { id: 'standards', label: 'Standards', icon: Target },
                { id: 'predictions', label: 'AI Insights', icon: Brain }
              ].map((tab) => (
                <button
                  key={tab.id}
                  onClick={() => setViewType(tab.id as any)}
                  className={cn(
                    "flex items-center gap-2 px-3 lg:px-4 py-2 rounded-md text-xs lg:text-caption font-medium transition-airy",
                    viewType === tab.id 
                      ? "bg-primary text-primary-foreground shadow-sm" 
                      : "text-muted-foreground hover:text-foreground hover:bg-surface/50"
                  )}
                >
                  <tab.icon className="w-3 h-3 lg:w-4 lg:h-4" />
                  {tab.label}
                </button>
              ))}
            </div>
            
            <Select value={timeRange} onValueChange={(value) => setTimeRange(value as any)}>
              <SelectTrigger className="w-full lg:w-40 border-divider">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="week">This Week</SelectItem>
                <SelectItem value="month">This Month</SelectItem>
                <SelectItem value="semester">This Semester</SelectItem>
                <SelectItem value="year">This Year</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-auto p-6 xl:p-8">
          <div className="grid grid-cols-1 2xl:grid-cols-4 gap-6 lg:gap-8">
            {/* Main Content - Takes full width on smaller desktop, 3/4 on larger */}
            <div className="2xl:col-span-3">
              {viewType === 'overview' && renderOverview()}
              {viewType === 'standards' && renderStandards()}
              {viewType === 'predictions' && renderPredictions()}
            </div>

            {/* Sidebar - Stacks below main content on smaller desktop, side-by-side on larger */}
            <div className="space-y-6 lg:space-y-8">
              {renderRecentActivity()}
              
              {/* Quick Stats */}
              <Card className="p-4 lg:p-6 bg-surface/50 border-divider">
                <h3 className="text-base lg:text-h3 font-semibold text-foreground mb-4 lg:mb-6">Quick Stats</h3>
                <div className="space-y-4 lg:space-y-6">
                  <div>
                    <div className="flex items-center justify-between mb-3">
                      <span className="text-xs lg:text-caption text-muted-foreground font-medium">Grading Progress</span>
                      <span className="text-xs lg:text-caption font-bold text-foreground">{analytics.overview.gradingProgress}%</span>
                    </div>
                    <Progress value={analytics.overview.gradingProgress} className="h-2 lg:h-3 bg-muted/50" />
                  </div>
                  
                  <div className="flex items-center justify-between pt-2 border-t border-divider">
                    <span className="text-xs lg:text-caption text-muted-foreground font-medium">Excelling Students</span>
                    <Badge className="bg-success/10 text-success border-success/20 text-xs">
                      {analytics.overview.excellingStudents}
                    </Badge>
                  </div>
                  
                  <div className="flex items-center justify-between">
                    <span className="text-xs lg:text-caption text-muted-foreground font-medium">Need Attention</span>
                    <Badge className="bg-warning/10 text-warning border-warning/20 text-xs">
                      {analytics.overview.atRiskStudents}
                    </Badge>
                  </div>
                </div>
              </Card>
            </div>
          </div>
        </div>
      </div>
    </>
  );
} 