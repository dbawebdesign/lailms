'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { ScrollArea } from '@/components/ui/scroll-area';
import { useCourseGenerationRecovery } from '@/hooks/useCourseGenerationRecovery';
import { 
  Activity, 
  AlertCircle, 
  CheckCircle2, 
  Clock, 
  RefreshCw, 
  SkipForward,
  Pause,
  Play,
  Download,
  ChevronRight,
  Zap,
  TrendingUp,
  AlertTriangle,
  FileText,
  Brain,
  TestTube,
  BookOpen
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { formatDistanceToNow } from 'date-fns';

interface Task {
  id: string;
  task_identifier: string;
  task_type: string;
  status: 'pending' | 'queued' | 'running' | 'completed' | 'failed' | 'skipped' | 'retrying' | 'cancelled';
  lesson_id?: string;
  section_title?: string;
  section_index?: number;
  dependencies: string[];
  execution_priority: number;
  current_retry_count: number;
  max_retry_count: number;
  error_message?: string;
  error_severity?: 'low' | 'medium' | 'high' | 'critical';
  recovery_suggestions?: string[];
  started_at?: string;
  completed_at?: string;
  actual_duration_seconds?: number;
  estimated_duration_seconds?: number;
}

interface ErrorLog {
  id: string;
  error_type: string;
  error_severity: 'low' | 'medium' | 'high' | 'critical';
  error_message: string;
  suggested_actions: string[];
  created_at: string;
  task_id?: string;
}

interface Analytics {
  total_generation_time_seconds: number;
  average_task_time_seconds: number;
  api_calls_made: number;
  api_calls_failed: number;
  tokens_consumed: number;
  estimated_cost_usd: number;
  success_rate: number;
  peak_memory_usage_mb: number;
}

interface EnhancedCourseGenerationMonitorProps {
  jobId: string;
  onComplete?: (courseOutlineId: string) => void;
  onCancel?: () => void;
}

export default function EnhancedCourseGenerationMonitor({ 
  jobId, 
  onComplete, 
  onCancel 
}: EnhancedCourseGenerationMonitorProps) {
  const [job, setJob] = useState<any>(null);
  const [tasks, setTasks] = useState<Task[]>([]);
  const [errors, setErrors] = useState<ErrorLog[]>([]);
  const [analytics, setAnalytics] = useState<Analytics | null>(null);
  const [selectedTask, setSelectedTask] = useState<Task | null>(null);
  const [isRetrying, setIsRetrying] = useState<string | null>(null);
  const [isPaused, setIsPaused] = useState(false);

  // Recovery hook for user actions
  const recovery = useCourseGenerationRecovery(jobId, {
    onSuccess: (response) => {
      console.log('Recovery action successful:', response);
      fetchJobDetails(); // Refresh data after successful action
    },
    onError: (error) => {
      console.error('Recovery action failed:', error);
    },
    showNotifications: true
  });

  // Fetch job details and tasks
  const fetchJobDetails = useCallback(async () => {
    try {
      const [jobRes, tasksRes, errorsRes, analyticsRes] = await Promise.all([
        fetch(`/api/course-generation/v2/job/${jobId}`),
        fetch(`/api/course-generation/v2/tasks/${jobId}`),
        fetch(`/api/course-generation/v2/errors/${jobId}`),
        fetch(`/api/course-generation/v2/analytics/${jobId}`)
      ]);

      if (jobRes.ok) {
        const jobData = await jobRes.json();
        setJob(jobData.job);
        
        if (jobData.job.status === 'completed' && jobData.job.course_outline_id) {
          onComplete?.(jobData.job.course_outline_id);
        }
      }

      if (tasksRes.ok) {
        const tasksData = await tasksRes.json();
        setTasks(tasksData.tasks || []);
      }

      if (errorsRes.ok) {
        const errorsData = await errorsRes.json();
        setErrors(errorsData.errors || []);
      }

      if (analyticsRes.ok) {
        const analyticsData = await analyticsRes.json();
        setAnalytics(analyticsData.analytics);
      }
    } catch (error) {
      console.error('Failed to fetch job details:', error);
    }
  }, [jobId, onComplete]);

  // Set up polling
  useEffect(() => {
    fetchJobDetails();
          const interval = setInterval(fetchJobDetails, 5000);
    return () => clearInterval(interval);
  }, [fetchJobDetails]);

  // Retry a specific task using recovery hook
  const retryTask = async (taskId: string) => {
    setIsRetrying(taskId);
    try {
      await recovery.retryTask(taskId);
    } catch (error) {
      console.error('Failed to retry task:', error);
    } finally {
      setIsRetrying(null);
    }
  };

  // Skip a failed task using recovery hook
  const skipTask = async (taskId: string) => {
    try {
      await recovery.skipTask(taskId);
    } catch (error) {
      console.error('Failed to skip task:', error);
    }
  };

  // Pause/Resume job using recovery hook
  const togglePause = async () => {
    try {
      if (isPaused) {
        await recovery.resumeJob();
      } else {
        await recovery.pauseJob();
      }
      setIsPaused(!isPaused);
    } catch (error) {
      console.error('Failed to toggle pause:', error);
    }
  };

  // Smart recovery function
  const handleSmartRecover = async () => {
    try {
      const result = await recovery.smartRecover(tasks as any);
      console.log('Smart recovery completed:', result);
    } catch (error) {
      console.error('Smart recovery failed:', error);
    }
  };

  // Get recovery suggestions
  const recoverySuggestions = job && tasks.length > 0 
    ? recovery.getRecoverySuggestions(job, tasks as any)
    : [];

  // Export report function
  const handleExportReport = async (format: 'json' | 'csv' | 'pdf') => {
    try {
      const response = await fetch(`/api/course-generation/v2/export/${jobId}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          format,
          includeAnalytics: true,
          includeTasks: true,
          includeErrors: true,
          includePerformance: true
        })
      });

      if (response.ok) {
        const blob = await response.blob();
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.style.display = 'none';
        a.href = url;
        a.download = `course-generation-report-${jobId}.${format}`;
        document.body.appendChild(a);
        a.click();
        window.URL.revokeObjectURL(url);
        document.body.removeChild(a);
      }
    } catch (error) {
      console.error('Failed to export report:', error);
    }
  };

  // Calculate progress metrics
  const calculateProgress = () => {
    if (!tasks.length) return { percentage: 0, completed: 0, total: 0 };
    
    const completed = tasks.filter(t => 
      ['completed', 'skipped'].includes(t.status)
    ).length;
    
    return {
      percentage: Math.round((completed / tasks.length) * 100),
      completed,
      total: tasks.length
    };
  };

  const progress = calculateProgress();

  // Get task icon
  const getTaskIcon = (taskType: string) => {
    switch (taskType) {
      case 'lesson_section': return <FileText className="w-4 h-4" />;
      case 'lesson_assessment': return <TestTube className="w-4 h-4" />;
      case 'lesson_mind_map': return <Brain className="w-4 h-4" />;
      case 'lesson_brainbytes': return <Zap className="w-4 h-4" />;
      case 'path_quiz': return <BookOpen className="w-4 h-4" />;
      default: return <Activity className="w-4 h-4" />;
    }
  };

  // Get status color
  const getStatusColor = (status: string) => {
    switch (status) {
      case 'completed': return 'text-green-600 bg-green-50';
      case 'failed': return 'text-red-600 bg-red-50';
      case 'running': return 'text-blue-600 bg-blue-50';
      case 'retrying': return 'text-yellow-600 bg-yellow-50';
      case 'skipped': return 'text-gray-600 bg-gray-50';
      default: return 'text-gray-600 bg-gray-50';
    }
  };

  // Get severity badge
  const getSeverityBadge = (severity?: string) => {
    if (!severity) return null;
    
    const colors = {
      low: 'bg-blue-100 text-blue-800',
      medium: 'bg-yellow-100 text-yellow-800',
      high: 'bg-orange-100 text-orange-800',
      critical: 'bg-red-100 text-red-800'
    };

    return (
      <Badge className={cn('ml-2', colors[severity as keyof typeof colors])}>
        {severity}
      </Badge>
    );
  };

  if (!job) {
    return (
      <Card>
        <CardContent className="p-6">
          <div className="flex items-center justify-center">
            <RefreshCw className="w-6 h-6 animate-spin mr-2" />
            <span>Loading generation details...</span>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header with controls */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle>Course Generation Monitor</CardTitle>
              <p className="text-sm text-muted-foreground mt-1">
                Job ID: {jobId}
              </p>
            </div>
            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={togglePause}
                disabled={job.status !== 'processing'}
              >
                {isPaused ? (
                  <>
                    <Play className="w-4 h-4 mr-1" />
                    Resume
                  </>
                ) : (
                  <>
                    <Pause className="w-4 h-4 mr-1" />
                    Pause
                  </>
                )}
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={() => window.open(`/api/course-generation/v2/export/${jobId}`, '_blank')}
              >
                <Download className="w-4 h-4 mr-1" />
                Export Report
              </Button>
              {onCancel && (
                <Button
                  variant="destructive"
                  size="sm"
                  onClick={onCancel}
                  disabled={['completed', 'failed', 'cancelled'].includes(job.status)}
                >
                  Cancel
                </Button>
              )}
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {/* Overall progress */}
          <div className="space-y-4">
            <div>
              <div className="flex justify-between items-center mb-2">
                <span className="text-sm font-medium">Overall Progress</span>
                <span className="text-sm font-medium">
                  {progress.completed} / {progress.total} tasks ({progress.percentage}%)
                </span>
              </div>
              <Progress value={progress.percentage} className="h-3" />
            </div>

            {/* Quick stats */}
            <div className="grid grid-cols-4 gap-4">
              <div className="text-center">
                <div className="text-2xl font-bold text-green-600">
                  {tasks.filter(t => t.status === 'completed').length}
                </div>
                <div className="text-xs text-muted-foreground">Completed</div>
              </div>
              <div className="text-center">
                <div className="text-2xl font-bold text-blue-600">
                  {tasks.filter(t => t.status === 'running').length}
                </div>
                <div className="text-xs text-muted-foreground">Running</div>
              </div>
              <div className="text-center">
                <div className="text-2xl font-bold text-red-600">
                  {tasks.filter(t => t.status === 'failed').length}
                </div>
                <div className="text-xs text-muted-foreground">Failed</div>
              </div>
              <div className="text-center">
                <div className="text-2xl font-bold text-gray-600">
                  {tasks.filter(t => t.status === 'skipped').length}
                </div>
                <div className="text-xs text-muted-foreground">Skipped</div>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Recovery Suggestions */}
      {recoverySuggestions.length > 0 && (
        <Card className="border-orange-200 bg-orange-50">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-orange-800">
              <AlertTriangle className="h-5 w-5" />
              Recovery Suggestions
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {recoverySuggestions.map((suggestion, index) => (
                <div key={index} className="flex items-start justify-between p-3 bg-white rounded-lg border">
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-1">
                      <Badge variant={suggestion.priority === 'high' ? 'destructive' : suggestion.priority === 'medium' ? 'default' : 'secondary'}>
                        {suggestion.priority}
                      </Badge>
                      <span className="font-medium">{suggestion.label}</span>
                    </div>
                    <p className="text-sm text-muted-foreground mb-2">{suggestion.description}</p>
                    <p className="text-xs text-blue-600">Impact: {suggestion.estimatedImpact}</p>
                  </div>
                  <Button
                    size="sm"
                    onClick={async () => {
                      if (suggestion.action === 'retry_task' && suggestion.taskIds) {
                        await recovery.retryTasks(suggestion.taskIds);
                      } else if (suggestion.action === 'skip_task' && suggestion.taskIds) {
                        await recovery.skipTasks(suggestion.taskIds);
                      } else {
                        await recovery.executeAction(suggestion.action, suggestion.taskIds);
                      }
                    }}
                    disabled={recovery.isLoading}
                  >
                    {recovery.isLoading ? <RefreshCw className="h-4 w-4 animate-spin" /> : 'Apply'}
                  </Button>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Main content tabs */}
      <Tabs defaultValue="tasks" className="space-y-4">
        <TabsList className="grid w-full grid-cols-4">
          <TabsTrigger value="tasks">
            Tasks ({tasks.length})
          </TabsTrigger>
          <TabsTrigger value="errors" className="relative">
            Errors
            {errors.length > 0 && (
              <Badge variant="destructive" className="ml-2 h-5 w-5 p-0 justify-center">
                {errors.length}
              </Badge>
            )}
          </TabsTrigger>
          <TabsTrigger value="analytics">Analytics</TabsTrigger>
          <TabsTrigger value="timeline">Timeline</TabsTrigger>
        </TabsList>

        {/* Tasks Tab */}
        <TabsContent value="tasks" className="space-y-4">
          <Card>
            <CardContent className="p-0">
              <ScrollArea className="h-[600px]">
                <div className="space-y-2 p-4">
                  {tasks.map((task) => (
                    <div
                      key={task.id}
                      className={cn(
                        "border rounded-lg p-4 cursor-pointer transition-colors",
                        selectedTask?.id === task.id && "border-primary bg-accent"
                      )}
                      onClick={() => setSelectedTask(task)}
                    >
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-3">
                          {getTaskIcon(task.task_type)}
                          <div>
                            <div className="font-medium">
                              {task.section_title || task.task_identifier}
                            </div>
                            <div className="text-sm text-muted-foreground">
                              {task.task_type.replace(/_/g, ' ')}
                            </div>
                          </div>
                        </div>
                        <div className="flex items-center gap-2">
                          <Badge className={cn('capitalize', getStatusColor(task.status))}>
                            {task.status}
                          </Badge>
                          {task.error_severity && getSeverityBadge(task.error_severity)}
                          {task.status === 'failed' && (
                            <div className="flex gap-1">
                              <Button
                                size="sm"
                                variant="outline"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  retryTask(task.id);
                                }}
                                disabled={isRetrying === task.id}
                              >
                                {isRetrying === task.id ? (
                                  <RefreshCw className="w-3 h-3 animate-spin" />
                                ) : (
                                  'Retry'
                                )}
                              </Button>
                              <Button
                                size="sm"
                                variant="ghost"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  skipTask(task.id);
                                }}
                              >
                                <SkipForward className="w-3 h-3" />
                              </Button>
                            </div>
                          )}
                        </div>
                      </div>

                      {/* Task details when selected */}
                      {selectedTask?.id === task.id && (
                        <div className="mt-4 space-y-3 border-t pt-3">
                          {task.error_message && (
                            <Alert variant="destructive">
                              <AlertCircle className="h-4 w-4" />
                              <AlertTitle>Error</AlertTitle>
                              <AlertDescription>{task.error_message}</AlertDescription>
                            </Alert>
                          )}

                          {task.recovery_suggestions && task.recovery_suggestions.length > 0 && (
                            <div>
                              <h4 className="text-sm font-medium mb-2">Recovery Suggestions:</h4>
                              <ul className="text-sm space-y-1">
                                {task.recovery_suggestions.map((suggestion, idx) => (
                                  <li key={idx} className="flex items-start gap-2">
                                    <ChevronRight className="w-3 h-3 mt-0.5 flex-shrink-0" />
                                    <span>{suggestion}</span>
                                  </li>
                                ))}
                              </ul>
                            </div>
                          )}

                          <div className="grid grid-cols-2 gap-4 text-sm">
                            <div>
                              <span className="text-muted-foreground">Priority:</span>
                              <span className="ml-2 font-medium">{task.execution_priority}</span>
                            </div>
                            <div>
                              <span className="text-muted-foreground">Retries:</span>
                              <span className="ml-2 font-medium">
                                {task.current_retry_count} / {task.max_retry_count}
                              </span>
                            </div>
                            {task.actual_duration_seconds && (
                              <div>
                                <span className="text-muted-foreground">Duration:</span>
                                <span className="ml-2 font-medium">
                                  {task.actual_duration_seconds}s
                                </span>
                              </div>
                            )}
                            {task.dependencies.length > 0 && (
                              <div>
                                <span className="text-muted-foreground">Dependencies:</span>
                                <span className="ml-2 font-medium">{task.dependencies.length}</span>
                              </div>
                            )}
                          </div>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              </ScrollArea>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Errors Tab */}
        <TabsContent value="errors" className="space-y-4">
          {errors.length === 0 ? (
            <Card>
              <CardContent className="p-12 text-center">
                <CheckCircle2 className="w-12 h-12 text-green-600 mx-auto mb-4" />
                <p className="text-lg font-medium">No errors detected</p>
                <p className="text-sm text-muted-foreground mt-1">
                  Your course generation is running smoothly
                </p>
              </CardContent>
            </Card>
          ) : (
            <Card>
              <CardContent className="p-0">
                <ScrollArea className="h-[600px]">
                  <div className="space-y-3 p-4">
                    {errors.map((error) => (
                      <Alert key={error.id} variant="destructive">
                        <AlertCircle className="h-4 w-4" />
                        <AlertTitle className="flex items-center gap-2">
                          {error.error_type}
                          {getSeverityBadge(error.error_severity)}
                        </AlertTitle>
                        <AlertDescription>
                          <p className="mb-2">{error.error_message}</p>
                          {error.suggested_actions.length > 0 && (
                            <div className="mt-3">
                              <p className="font-medium mb-1">Suggested Actions:</p>
                              <ul className="space-y-1">
                                {error.suggested_actions.map((action, idx) => (
                                  <li key={idx} className="flex items-start gap-2">
                                    <ChevronRight className="w-3 h-3 mt-0.5 flex-shrink-0" />
                                    <span className="text-sm">{action}</span>
                                  </li>
                                ))}
                              </ul>
                            </div>
                          )}
                          <p className="text-xs text-muted-foreground mt-2">
                            {formatDistanceToNow(new Date(error.created_at), { addSuffix: true })}
                          </p>
                        </AlertDescription>
                      </Alert>
                    ))}
                  </div>
                </ScrollArea>
              </CardContent>
            </Card>
          )}
        </TabsContent>

        {/* Analytics Tab */}
        <TabsContent value="analytics" className="space-y-4">
          {/* Export Controls */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center justify-between">
                <span className="flex items-center gap-2">
                  <Download className="h-5 w-5" />
                  Export Report
                </span>
                <div className="flex gap-2">
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => handleExportReport('json')}
                  >
                    JSON
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => handleExportReport('csv')}
                  >
                    CSV
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => handleExportReport('pdf')}
                  >
                    PDF
                  </Button>
                </div>
              </CardTitle>
            </CardHeader>
          </Card>

          {analytics ? (
            <div className="grid gap-4 md:grid-cols-2">
              <Card>
                <CardHeader>
                  <CardTitle className="text-base">Performance Metrics</CardTitle>
                </CardHeader>
                <CardContent className="space-y-3">
                  <div className="flex justify-between">
                    <span className="text-sm text-muted-foreground">Total Time</span>
                    <span className="font-medium">
                      {Math.round(analytics.total_generation_time_seconds / 60)} min
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-sm text-muted-foreground">Avg Task Time</span>
                    <span className="font-medium">
                      {analytics.average_task_time_seconds.toFixed(1)}s
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-sm text-muted-foreground">Success Rate</span>
                    <span className="font-medium text-green-600">
                      {analytics.success_rate.toFixed(1)}%
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-sm text-muted-foreground">Memory Usage</span>
                    <span className="font-medium">{analytics.peak_memory_usage_mb} MB</span>
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle className="text-base">API Usage</CardTitle>
                </CardHeader>
                <CardContent className="space-y-3">
                  <div className="flex justify-between">
                    <span className="text-sm text-muted-foreground">Total API Calls</span>
                    <span className="font-medium">{analytics.api_calls_made}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-sm text-muted-foreground">Failed Calls</span>
                    <span className="font-medium text-red-600">
                      {analytics.api_calls_failed}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-sm text-muted-foreground">Tokens Used</span>
                    <span className="font-medium">
                      {(analytics.tokens_consumed / 1000).toFixed(1)}k
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-sm text-muted-foreground">Estimated Cost</span>
                    <span className="font-medium">
                      ${analytics.estimated_cost_usd.toFixed(2)}
                    </span>
                  </div>
                </CardContent>
              </Card>
            </div>
          ) : (
            <Card>
              <CardContent className="p-12 text-center">
                <TrendingUp className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
                <p className="text-lg font-medium">Analytics loading...</p>
                <p className="text-sm text-muted-foreground mt-1">
                  Performance metrics will appear once generation progresses
                </p>
              </CardContent>
            </Card>
          )}
        </TabsContent>

        {/* Timeline Tab */}
        <TabsContent value="timeline" className="space-y-4">
          <Card>
            <CardContent className="p-0">
              <ScrollArea className="h-[600px]">
                <div className="p-4">
                  <div className="space-y-4">
                    {tasks
                      .filter(t => t.started_at || t.completed_at)
                      .sort((a, b) => {
                        const timeA = new Date(a.started_at || a.completed_at || '').getTime();
                        const timeB = new Date(b.started_at || b.completed_at || '').getTime();
                        return timeB - timeA;
                      })
                      .map((task, index) => (
                        <div key={task.id} className="flex gap-4">
                          <div className="flex flex-col items-center">
                            <div className={cn(
                              "w-3 h-3 rounded-full",
                              task.status === 'completed' ? 'bg-green-600' :
                              task.status === 'failed' ? 'bg-red-600' :
                              task.status === 'running' ? 'bg-blue-600' :
                              'bg-gray-400'
                            )} />
                            {index < tasks.length - 1 && (
                              <div className="w-0.5 h-16 bg-gray-200" />
                            )}
                          </div>
                          <div className="flex-1 pb-8">
                            <div className="flex items-center gap-2 mb-1">
                              {getTaskIcon(task.task_type)}
                              <span className="font-medium">
                                {task.section_title || task.task_identifier}
                              </span>
                              <Badge className={cn('capitalize', getStatusColor(task.status))}>
                                {task.status}
                              </Badge>
                            </div>
                            <p className="text-sm text-muted-foreground">
                              {task.started_at && (
                                <>Started {formatDistanceToNow(new Date(task.started_at), { addSuffix: true })}</>
                              )}
                              {task.completed_at && task.started_at && ' • '}
                              {task.completed_at && (
                                <>Completed in {task.actual_duration_seconds}s</>
                              )}
                            </p>
                            {task.error_message && (
                              <p className="text-sm text-red-600 mt-1">{task.error_message}</p>
                            )}
                          </div>
                        </div>
                      ))}
                  </div>
                </div>
              </ScrollArea>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
} 