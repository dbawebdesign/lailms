'use client';

import React, { useState, useEffect } from 'react';
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
  const [syncStatus, setSyncStatus] = useState<'synced' | 'syncing' | 'error'>('synced');
  const [useMockData, setUseMockData] = useState(false); // Default to false now
  const [gradebookData, setGradebookData] = useState({
    students: [],
    assignments: [],
    grades: {},
    standards: [],
    settings: {}
  });
  const [isLoading, setIsLoading] = useState(false);
  const [bulkFeedbackOpen, setBulkFeedbackOpen] = useState(false);
  const [exportDialogOpen, setExportDialogOpen] = useState(false);

  // Mock data for demonstration
  const mockGradebookData = {
    students: [
      {
        id: '1',
        name: 'Alice Johnson',
        email: 'alice.johnson@email.com',
        overall_grade: 92.5,
        grade_letter: 'A-',
        missing_assignments: 0,
        late_assignments: 1,
        mastery_level: 'advanced' as const
      },
      {
        id: '2',
        name: 'Bob Smith',
        email: 'bob.smith@email.com',
        overall_grade: 87.3,
        grade_letter: 'B+',
        missing_assignments: 1,
        late_assignments: 0,
        mastery_level: 'proficient' as const
      },
      {
        id: '3',
        name: 'Carol Williams',
        email: 'carol.williams@email.com',
        overall_grade: 94.8,
        grade_letter: 'A',
        missing_assignments: 0,
        late_assignments: 0,
        mastery_level: 'advanced' as const
      },
      {
        id: '4',
        name: 'David Brown',
        email: 'david.brown@email.com',
        overall_grade: 76.2,
        grade_letter: 'C+',
        missing_assignments: 2,
        late_assignments: 1,
        mastery_level: 'approaching' as const
      },
    ],
    assignments: [
      {
        id: '1',
        name: 'Chapter 1 Quiz',
        type: 'quiz' as const,
        points_possible: 50,
        due_date: '2024-01-15',
        published: true
      },
      {
        id: '2',
        name: 'Homework Set 1',
        type: 'homework' as const,
        points_possible: 25,
        due_date: '2024-01-20',
        published: true
      },
      {
        id: '3',
        name: 'Mid-term Project',
        type: 'project' as const,
        points_possible: 100,
        due_date: '2024-02-01',
        published: true
      },
      {
        id: '4',
        name: 'Final Exam',
        type: 'exam' as const,
        points_possible: 200,
        due_date: '2024-02-15',
        published: false
      },
    ],
    grades: {
      '1-1': { student_id: '1', assignment_id: '1', points_earned: 47, percentage: 94, status: 'graded' as const },
      '1-2': { student_id: '1', assignment_id: '2', points_earned: 23, percentage: 92, status: 'graded' as const },
      '1-3': { student_id: '1', assignment_id: '3', points_earned: 92, percentage: 92, status: 'graded' as const },
      '2-1': { student_id: '2', assignment_id: '1', points_earned: 42, percentage: 84, status: 'graded' as const },
      '2-2': { student_id: '2', assignment_id: '2', points_earned: 22, percentage: 88, status: 'graded' as const },
      '2-3': { student_id: '2', assignment_id: '3', points_earned: 88, percentage: 88, status: 'graded' as const },
      '3-1': { student_id: '3', assignment_id: '1', points_earned: 50, percentage: 100, status: 'graded' as const },
      '3-2': { student_id: '3', assignment_id: '2', points_earned: 25, percentage: 100, status: 'graded' as const },
      '3-3': { student_id: '3', assignment_id: '3', points_earned: 96, percentage: 96, status: 'graded' as const },
      '4-1': { student_id: '4', assignment_id: '1', points_earned: 35, percentage: 70, status: 'graded' as const },
      '4-2': { student_id: '4', assignment_id: '2', status: 'missing' as const },
      '4-3': { student_id: '4', assignment_id: '3', points_earned: 75, percentage: 75, status: 'graded' as const },
    },
    standards: [],
    settings: {}
  };

  // Use mock data if enabled, otherwise use real data
  const currentData = useMockData ? mockGradebookData : gradebookData;

  // Load gradebook data
  useEffect(() => {
    const loadGradebookData = async () => {
      if (useMockData) {
        // No need to load when using mock data
        return;
      }

      setIsLoading(true);
      setSyncStatus('syncing');
      
      try {
        // Fetch real data from API
        const response = await fetch(`/api/teach/grading/gradebook/${classInstance.id}`);
        
        if (!response.ok) {
          throw new Error('Failed to fetch gradebook data');
        }
        
        const data = await response.json();
        
        setGradebookData(data);
        setSyncStatus('synced');
      } catch (error) {
        console.error('Error loading gradebook data:', error);
        setSyncStatus('error');
      } finally {
        setIsLoading(false);
      }
    };

    loadGradebookData();
  }, [classInstance.id, useMockData]);

  const handleRefresh = async () => {
    setSyncStatus('syncing');
    try {
      if (useMockData) {
        // Just simulate refresh for mock data
        await new Promise(resolve => setTimeout(resolve, 500));
        setSyncStatus('synced');
        return;
      }

      // Fetch fresh data from API
      const response = await fetch(`/api/teach/grading/gradebook/${classInstance.id}`);
      
      if (!response.ok) {
        throw new Error('Failed to refresh gradebook data');
      }
      
      const data = await response.json();
      setGradebookData(data);
      setSyncStatus('synced');
    } catch (error) {
      console.error('Error refreshing gradebook data:', error);
      setSyncStatus('error');
    }
  };

  const handleBulkFeedback = () => {
    if (selectedStudents.length > 0) {
      setBulkFeedbackOpen(true);
    }
  };

  const handleExport = () => {
    setExportDialogOpen(true);
  };

  const toggleMockData = () => {
    setUseMockData(!useMockData);
    setSelectedStudents([]); // Clear selections when switching
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
    <div className="flex flex-col h-full bg-background transition-airy">
      {/* Header */}
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-h1 text-foreground mb-2">Gradebook</h1>
          <p className="text-body text-muted-foreground">
            Manage grades and track student progress for <span className="font-medium">{classInstance.name}</span>
          </p>
        </div>
        
        <div className="flex items-center gap-4">
          {/* Mock Data Toggle */}
          <Card className="p-4 bg-info/5 border-info/20">
            <div className="flex items-center gap-3">
              <div className="flex items-center gap-2">
                <div className={`w-2 h-2 rounded-full ${useMockData ? 'bg-info' : 'bg-muted-foreground/30'}`} />
                <span className="text-caption text-info font-medium">Mock Data</span>
              </div>
              <Button
                variant="outline"
                size="sm"
                onClick={toggleMockData}
                className="text-xs border-info/30 hover:bg-info/10 transition-airy"
              >
                {useMockData ? 'Switch to Real Data' : 'Switch to Mock Data'}
              </Button>
            </div>
          </Card>

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
      <div className="flex-1 flex min-h-0">
        {/* Sidebar Navigation - Following style guide: clean, spacious */}
        <div className="w-72 border-r border-divider bg-surface/30 backdrop-blur-sm">
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
                        <div className={cn(
                          "p-2.5 rounded-lg transition-airy",
                          activeTab === tab.id 
                            ? "bg-brand-gradient text-white shadow-sm" 
                            : "bg-muted text-muted-foreground"
                        )}>
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
          <Tabs value={activeTab} className="flex-1 flex flex-col">
            <TabsContent value="gradebook" className="flex-1 m-0 data-[state=active]:flex data-[state=active]:flex-col">
              <GradebookGrid
                classInstance={classInstance}
                data={currentData}
                selectedStudents={selectedStudents}
                onSelectedStudentsChange={setSelectedStudents}
                onStudentSelect={setSelectedStudent}
                isLoading={isLoading}
              />
            </TabsContent>
            
            <TabsContent value="students" className="flex-1 m-0 data-[state=active]:flex data-[state=active]:flex-col">
              <StudentsOverview
                classInstance={classInstance}
                data={currentData}
                onStudentSelect={setSelectedStudent}
                isLoading={isLoading}
              />
            </TabsContent>
            
            <TabsContent value="analytics" className="flex-1 m-0 data-[state=active]:flex data-[state=active]:flex-col">
              <AnalyticsDashboard
                classInstance={classInstance}
                data={currentData}
                isLoading={isLoading}
              />
            </TabsContent>
            
            <TabsContent value="assignments" className="flex-1 m-0 data-[state=active]:flex data-[state=active]:flex-col">
              <AssignmentsManager
                classInstance={classInstance}
                data={currentData}
                onDataChange={setGradebookData}
                isLoading={isLoading}
              />
            </TabsContent>
            
            <TabsContent value="standards" className="flex-1 m-0 data-[state=active]:flex data-[state=active]:flex-col">
              <StandardsTracker
                classInstance={classInstance}
                data={currentData}
                isLoading={isLoading}
              />
            </TabsContent>
            
            <TabsContent value="settings" className="flex-1 m-0 data-[state=active]:flex data-[state=active]:flex-col">
              <GradebookSettings
                classInstance={classInstance}
                data={currentData}
                onDataChange={setGradebookData}
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
      />

      <StudentDetailsPanel
        studentId={selectedStudent || ''}
        classInstance={classInstance}
        data={currentData}
        open={!!selectedStudent}
        onClose={() => setSelectedStudent(null)}
      />

      <ExportDialog
        open={exportDialogOpen}
        onOpenChange={(open) => setExportDialogOpen(open)}
        classInstance={classInstance}
        data={currentData}
      />
    </div>
  );
} 