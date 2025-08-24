'use client';

import React, { useState } from 'react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Badge } from '@/components/ui/badge';
import { GradebookGrid } from './grid/GradebookGrid';
import { StudentsOverview } from './overview/StudentsOverview';
import { AnalyticsDashboard } from './analytics/AnalyticsDashboard';
import { AssignmentsManager } from './assignments/AssignmentsManager';
import { StandardsTracker } from './standards/StandardsTracker';
import { GradebookSettings } from './settings/GradebookSettings';
import { BulkFeedbackDrawer } from './feedback/BulkFeedbackDrawer';
import { StudentDetailsPanel } from './details/StudentDetailsPanel';
import { ExportDialog } from './export/ExportDialog';
import { useGradebook } from '@/hooks/useGradebook';
import { 
  Calculator, 
  Users, 
  BarChart3, 
  BookOpen, 
  Target, 
  Settings, 
  Download,
  MessageSquare,
  RefreshCw,
  Sparkles,
  Check,
  AlertCircle
} from 'lucide-react';
import { cn } from '@/lib/utils';

interface GradebookShellProps {
  classInstance: {
    id: string;
    name: string;
    base_class_id: string;
    enrollment_code: string;
    settings?: any;
  };
}

export function GradebookShell({ classInstance }: GradebookShellProps) {
  const [activeTab, setActiveTab] = useState('gradebook');
  const [selectedStudents, setSelectedStudents] = useState<string[]>([]);
  const [selectedStudent, setSelectedStudent] = useState<string | null>(null);
  const [bulkFeedbackOpen, setBulkFeedbackOpen] = useState(false);
  const [exportDialogOpen, setExportDialogOpen] = useState(false);

  // Use the new gradebook hook for live data
  const { 
    data: gradebookData, 
    isLoading, 
    error, 
    syncStatus, 
    refresh,
    updateGrade,
    createAssignment,
    updateAssignment,
    deleteAssignment,
    updateSettings
  } = useGradebook(classInstance.id);

  // Transform data for components that expect different interfaces
  const transformedData = {
    students: gradebookData.students.map(student => ({
      id: student.id,
      name: student.name,
      email: student.email,
      avatar: student.avatar_url,
      overall_grade: student.overall_grade,
      grade_letter: student.grade_letter,
      missing_assignments: student.missing_assignments,
      late_assignments: student.late_assignments,
      mastery_level: student.mastery_level,
      completed_assignments: student.completed_assignments,
      total_assignments: student.total_assignments
    })),
    assignments: gradebookData.assignments.map(assignment => ({
      id: assignment.id,
      name: assignment.name,
      type: assignment.type,
      points_possible: assignment.points_possible,
      due_date: assignment.due_date,
      published: assignment.published,
      description: assignment.description,
      category: assignment.category,
      created_at: assignment.created_at,
      updated_at: assignment.updated_at,
      class_instance_id: assignment.class_instance_id,
      created_by: assignment.created_by
    })),
    grades: Object.fromEntries(
      Object.entries(gradebookData.grades).map(([key, grade]) => [
        key,
        {
          student_id: grade.student_id || '',
          assignment_id: grade.assignment_id || '',
          points_earned: grade.points_earned ?? undefined,
          percentage: grade.percentage ?? undefined,
          status: grade.status as 'graded' | 'missing' | 'late' | 'excused' | 'pending',
          feedback: grade.feedback ?? undefined,
          submitted_at: grade.submitted_at ?? undefined,
          graded_at: grade.graded_at ?? undefined
        }
      ])
    ),
    standards: gradebookData.standards,
    settings: gradebookData.settings || {}
  };

  const handleRefresh = async () => {
    await refresh();
  };

  const handleBulkFeedback = () => {
    if (selectedStudents.length > 0) {
      setBulkFeedbackOpen(true);
    }
  };

  const handleExport = () => {
    setExportDialogOpen(true);
  };

  // Handle data change for components that need to refresh
  const handleDataChange = async () => {
    await refresh();
  };

  // Handle tab change and clear selected student
  const handleTabChange = (newTab: string) => {
    setActiveTab(newTab);
    setSelectedStudent(null); // Clear selected student when switching tabs
  };

  // Desktop-only protection component
  const DesktopOnlyMessage = () => (
    <div className="flex items-center justify-center min-h-screen bg-background p-6">
      <div className="max-w-md mx-auto text-center space-y-6">
        <div className="w-24 h-24 mx-auto bg-brand-gradient rounded-full flex items-center justify-center shadow-lg">
          <Calculator className="w-12 h-12 text-white" />
        </div>
        
        <div className="space-y-3">
          <h2 className="text-h1 font-bold text-foreground">Desktop Required</h2>
          <p className="text-body text-muted-foreground leading-relaxed">
            The gradebook feature is optimized for desktop use to provide the best experience for managing grades and student data.
          </p>
        </div>
        
        <div className="p-4 bg-surface/50 rounded-xl border border-divider">
          <p className="text-caption text-muted-foreground">
            Please access this feature from a desktop computer with a screen width of at least 1024px.
          </p>
        </div>
        
        <div className="pt-2">
          <Badge variant="outline" className="bg-primary/10 text-primary border-primary/20">
            Premium Feature
          </Badge>
        </div>
      </div>
    </div>
  );

  // Check if screen is too small (less than 1024px width)
  const [isDesktop, setIsDesktop] = React.useState(true);

  React.useEffect(() => {
    const checkScreenSize = () => {
      setIsDesktop(window.innerWidth >= 1024);
    };

    // Check on mount
    checkScreenSize();

    // Add event listener for resize
    window.addEventListener('resize', checkScreenSize);

    // Cleanup
    return () => window.removeEventListener('resize', checkScreenSize);
  }, []);

  // Show desktop-only message on smaller screens
  if (!isDesktop) {
    return <DesktopOnlyMessage />;
  }

  const tabs = [
    {
      id: 'gradebook',
      label: 'Gradebook',
      icon: Calculator,
      description: 'Grade tracking and management'
    },
    {
      id: 'students',
      label: 'Students',
      icon: Users,
      description: 'Student overview and progress'
    },
    {
      id: 'analytics',
      label: 'Analytics',
      icon: BarChart3,
      description: 'Performance insights and trends'
    },
    {
      id: 'assignments',
      label: 'Assignments',
      icon: BookOpen,
      description: 'Create and manage assignments'
    },
    {
      id: 'standards',
      label: 'Standards',
      icon: Target,
      description: 'Standards-based grading'
    },
    {
      id: 'settings',
      label: 'Settings',
      icon: Settings,
      description: 'Gradebook configuration'
    }
  ];

  return (
    <div className="flex flex-col min-h-0 bg-background transition-airy">
      {/* Header */}
      <div className="flex items-center justify-between px-8 py-4 mb-4">
        <div>
          <h1 className="text-h1 text-foreground mb-2">Gradebook</h1>
          <p className="text-body text-muted-foreground">
            Manage grades and track student progress for <span className="font-medium">{classInstance.name}</span>
          </p>
        </div>
        
        <div className="flex items-center gap-4">
          {/* Sync Status */}
          <div className="flex items-center gap-2">
            <Badge 
              variant={syncStatus === 'synced' ? 'default' : syncStatus === 'syncing' ? 'secondary' : 'destructive'}
              className={`
                backdrop-blur-sm transition-airy
                ${syncStatus === 'synced' ? 'bg-success/10 text-success border-success/20' : ''}
                ${syncStatus === 'syncing' ? 'bg-info/10 text-info border-info/20' : ''}
                ${syncStatus === 'error' ? 'bg-destructive/10 text-destructive border-destructive/20' : ''}
              `}
            >
              {syncStatus === 'synced' && <Check className="w-3 h-3 mr-1" />}
              {syncStatus === 'syncing' && <RefreshCw className="w-3 h-3 mr-1 animate-spin" />}
              {syncStatus === 'error' && <AlertCircle className="w-3 h-3 mr-1" />}
              {syncStatus.charAt(0).toUpperCase() + syncStatus.slice(1)}
            </Badge>
            <Button
              variant="outline"
              size="sm"
              onClick={handleRefresh}
              disabled={syncStatus === 'syncing'}
              className="hover:bg-surface/80 border-divider transition-airy"
            >
              <RefreshCw className={`w-4 h-4 ${syncStatus === 'syncing' ? 'animate-spin' : ''}`} />
            </Button>
          </div>

          {/* Action Buttons */}
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={handleBulkFeedback}
              disabled={selectedStudents.length === 0}
              className="hover:bg-surface/80 border-divider transition-airy"
            >
              <MessageSquare className="w-4 h-4 mr-2" />
              Bulk Feedback ({selectedStudents.length})
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={handleExport}
              className="hover:bg-surface/80 border-divider transition-airy"
            >
              <Download className="w-4 h-4 mr-2" />
              Export
            </Button>
          </div>
        </div>
      </div>

      {/* Main Content - Following style guide: airy layout with generous spacing */}
      <div className="flex-1 flex min-h-0 overflow-hidden">
        {/* Sidebar Navigation - Following style guide: clean, spacious */}
        <div className="w-72 border-r border-divider bg-surface/30 backdrop-blur-sm flex-shrink-0">
          <div className="p-2">
            <Tabs value={activeTab} onValueChange={handleTabChange} orientation="vertical" className="w-full">
              <TabsList className="flex flex-col w-full bg-transparent p-0 space-y-2 h-auto">
                {tabs.map((tab) => {
                  const IconComponent = tab.icon;
                  return (
                    <TabsTrigger
                      key={tab.id}
                      value={tab.id}
                      className={cn(
                        "w-full justify-start p-4 rounded-xl transition-airy",
                        "data-[state=active]:bg-background data-[state=active]:shadow-card",
                        "data-[state=active]:border data-[state=active]:border-divider",
                        "hover:bg-background/50 hover:shadow-sm",
                        "data-[state=active]:text-foreground text-muted-foreground",
                        "border border-transparent"
                      )}
                    >
                      <div className="flex items-center space-x-4 w-full">
                        <div className={
                          activeTab === tab.id 
                            ? "p-2.5 rounded-lg transition-airy bg-brand-gradient text-white shadow-sm" 
                            : "p-2.5 rounded-lg transition-airy bg-muted text-muted-foreground"
                        }>
                          <IconComponent className="h-4 w-4" />
                        </div>
                        <div className="flex-1 text-left">
                          <div className="font-medium text-sm">{tab.label}</div>
                          <div className="text-xs text-muted-foreground leading-relaxed">
                            {tab.description}
                          </div>
                        </div>
                      </div>
                    </TabsTrigger>
                  );
                })}
              </TabsList>
            </Tabs>
          </div>
        </div>

        {/* Content Area - Following style guide: flowing, spacious layout */}
        <div className="flex-1 flex flex-col min-w-0">
          <Tabs value={activeTab} className="flex-1 flex flex-col min-h-0">
            <TabsContent value="gradebook" className="flex-1 m-0 data-[state=active]:flex data-[state=active]:flex-col">
              <GradebookGrid
                classInstance={classInstance}
                data={transformedData}
                selectedStudents={selectedStudents}
                onSelectedStudentsChange={setSelectedStudents}
                onStudentSelect={setSelectedStudent}
                onDataChange={handleDataChange}
                isLoading={isLoading}
                onCreateAssignment={createAssignment}
              />
            </TabsContent>
            
            <TabsContent value="students" className="flex-1 m-0 data-[state=active]:flex data-[state=active]:flex-col overflow-y-auto">
              <StudentsOverview
                classInstance={classInstance}
                data={transformedData}
                onStudentSelect={setSelectedStudent}
                isLoading={isLoading}
              />
            </TabsContent>
            
            <TabsContent value="analytics" className="flex-1 m-0 data-[state=active]:flex data-[state=active]:flex-col overflow-y-auto">
              <AnalyticsDashboard
                classInstance={classInstance}
                data={transformedData}
                isLoading={isLoading}
              />
            </TabsContent>
            
            <TabsContent value="assignments" className="flex-1 m-0 data-[state=active]:flex data-[state=active]:flex-col overflow-y-auto">
              <AssignmentsManager
                classInstance={classInstance}
                data={transformedData}
                onDataChange={handleDataChange}
                isLoading={isLoading}
                onCreateAssignment={createAssignment}
                onUpdateAssignment={updateAssignment}
                onDeleteAssignment={deleteAssignment}
              />
            </TabsContent>
            
            <TabsContent value="standards" className="flex-1 m-0 data-[state=active]:flex data-[state=active]:flex-col overflow-y-auto">
              <StandardsTracker
                classInstance={classInstance}
                data={transformedData}
                isLoading={isLoading}
              />
            </TabsContent>
            
            <TabsContent value="settings" className="flex-1 m-0 data-[state=active]:flex data-[state=active]:flex-col overflow-y-auto">
              <GradebookSettings
                classInstance={classInstance}
                data={transformedData}
                onDataChange={handleDataChange}
                onUpdateSettings={updateSettings}
                isLoading={isLoading}
              />
            </TabsContent>
          </Tabs>
        </div>
      </div>

      {/* Modals and Drawers */}
      <BulkFeedbackDrawer
        open={bulkFeedbackOpen}
        onOpenChange={(open) => setBulkFeedbackOpen(open)}
        selectedStudents={selectedStudents}
        classInstance={classInstance}
        data={transformedData}
      />

      <StudentDetailsPanel
        studentId={selectedStudent || ''}
        classInstance={classInstance}
        data={gradebookData}
        open={!!selectedStudent}
        onClose={() => setSelectedStudent(null)}
      />

      <ExportDialog
        open={exportDialogOpen}
        onOpenChange={(open) => setExportDialogOpen(open)}
        classInstance={classInstance}
        data={gradebookData}
      />
    </div>
  );
} 