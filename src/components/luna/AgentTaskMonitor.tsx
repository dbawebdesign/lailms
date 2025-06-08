"use client";

import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { 
  Activity, 
  CheckCircle, 
  AlertCircle, 
  Clock, 
  Loader2,
  Brain,
  Database,
  FileText,
  Users,
  Search,
  Wand2
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { motion, AnimatePresence } from 'framer-motion';

// Types for agent task monitoring
export interface AgentTask {
  id: string;
  agentName: string;
  taskType: string;
  description: string;
  status: 'pending' | 'running' | 'completed' | 'failed';
  progress: number;
  startTime: Date;
  endTime?: Date;
  toolsUsed: string[];
  metadata?: Record<string, any>;
}

export interface AgentPerformance {
  agentName: string;
  totalTasks: number;
  completedTasks: number;
  averageExecutionTime: number;
  successRate: number;
  lastActivity: Date;
}

interface AgentTaskMonitorProps {
  className?: string;
  showPerformanceMetrics?: boolean;
  maxTasksToShow?: number;
}

// Mock data for demonstration - in production this would come from your real-time system
const generateMockTasks = (): AgentTask[] => {
  const agents = ['Luna Tutor', 'Class Co-Pilot', 'Content Creator', 'Assessment Builder'];
  const taskTypes = ['Knowledge Search', 'Content Generation', 'Assessment Creation', 'Progress Analysis'];
  const tools = ['search_knowledge_base', 'create_content', 'update_content', 'generate_explanation'];
  
  return Array.from({ length: 5 }, (_, i) => ({
    id: `task_${i + 1}`,
    agentName: agents[Math.floor(Math.random() * agents.length)],
    taskType: taskTypes[Math.floor(Math.random() * taskTypes.length)],
    description: `Processing user request for ${taskTypes[Math.floor(Math.random() * taskTypes.length)].toLowerCase()}`,
    status: ['pending', 'running', 'completed', 'failed'][Math.floor(Math.random() * 4)] as any,
    progress: Math.floor(Math.random() * 100),
    startTime: new Date(Date.now() - Math.floor(Math.random() * 300000)), // Last 5 minutes
    endTime: Math.random() > 0.5 ? new Date() : undefined,
    toolsUsed: tools.slice(0, Math.floor(Math.random() * 3) + 1),
    metadata: {
      userId: 'user_123',
      requestId: `req_${i + 1}`
    }
  }));
};

const generateMockPerformance = (): AgentPerformance[] => {
  return [
    {
      agentName: 'Luna Tutor',
      totalTasks: 45,
      completedTasks: 42,
      averageExecutionTime: 2.3,
      successRate: 93.3,
      lastActivity: new Date(Date.now() - 60000)
    },
    {
      agentName: 'Class Co-Pilot',
      totalTasks: 23,
      completedTasks: 21,
      averageExecutionTime: 4.7,
      successRate: 91.3,
      lastActivity: new Date(Date.now() - 120000)
    },
    {
      agentName: 'Content Creator',
      totalTasks: 18,
      completedTasks: 17,
      averageExecutionTime: 8.2,
      successRate: 94.4,
      lastActivity: new Date(Date.now() - 300000)
    }
  ];
};

// Status icon component
const StatusIcon: React.FC<{ status: AgentTask['status'] }> = ({ status }) => {
  switch (status) {
    case 'pending':
      return <Clock size={16} className="text-yellow-500" />;
    case 'running':
      return <Loader2 size={16} className="text-blue-500 animate-spin" />;
    case 'completed':
      return <CheckCircle size={16} className="text-green-500" />;
    case 'failed':
      return <AlertCircle size={16} className="text-red-500" />;
    default:
      return <Activity size={16} className="text-gray-500" />;
  }
};

// Tool icon component
const ToolIcon: React.FC<{ toolName: string }> = ({ toolName }) => {
  const iconMap = {
    search_knowledge_base: <Search size={14} />,
    create_content: <FileText size={14} />,
    update_content: <Wand2 size={14} />,
    generate_explanation: <Brain size={14} />,
    get_user_data: <Users size={14} />,
    get_class_data: <Database size={14} />
  };
  
  return iconMap[toolName as keyof typeof iconMap] || <Activity size={14} />;
};

// Individual task card
const TaskCard: React.FC<{ task: AgentTask }> = ({ task }) => {
  const getStatusColor = () => {
    switch (task.status) {
      case 'pending': return 'border-yellow-200 bg-yellow-50 dark:border-yellow-800 dark:bg-yellow-900/20';
      case 'running': return 'border-blue-200 bg-blue-50 dark:border-blue-800 dark:bg-blue-900/20';
      case 'completed': return 'border-green-200 bg-green-50 dark:border-green-800 dark:bg-green-900/20';
      case 'failed': return 'border-red-200 bg-red-50 dark:border-red-800 dark:bg-red-900/20';
      default: return 'border-gray-200 bg-gray-50 dark:border-gray-800 dark:bg-gray-900/20';
    }
  };

  const formatDuration = () => {
    const endTime = task.endTime || new Date();
    const duration = endTime.getTime() - task.startTime.getTime();
    return `${(duration / 1000).toFixed(1)}s`;
  };

  return (
    <motion.div
      layout
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -20 }}
      className={cn(
        "border rounded-lg p-3 space-y-2",
        getStatusColor()
      )}
    >
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <StatusIcon status={task.status} />
          <span className="font-medium text-sm">{task.agentName}</span>
          <Badge variant="outline" className="text-xs">
            {task.taskType}
          </Badge>
        </div>
        <span className="text-xs text-muted-foreground">
          {formatDuration()}
        </span>
      </div>

      {/* Description */}
      <p className="text-sm text-muted-foreground">
        {task.description}
      </p>

      {/* Progress bar (only for running tasks) */}
      {task.status === 'running' && (
        <div className="space-y-1">
          <div className="flex justify-between text-xs">
            <span>Progress</span>
            <span>{task.progress}%</span>
          </div>
          <Progress value={task.progress} className="h-2" />
        </div>
      )}

      {/* Tools used */}
      {task.toolsUsed.length > 0 && (
        <div className="flex items-center gap-1 flex-wrap">
          <span className="text-xs text-muted-foreground">Tools:</span>
          {task.toolsUsed.map((tool, index) => (
            <div key={index} className="flex items-center gap-1">
              <ToolIcon toolName={tool} />
              <span className="text-xs">{tool.replace(/_/g, ' ')}</span>
            </div>
          ))}
        </div>
      )}
    </motion.div>
  );
};

// Performance metrics card
const PerformanceCard: React.FC<{ performance: AgentPerformance }> = ({ performance }) => {
  return (
    <Card className="w-full">
      <CardHeader className="pb-2">
        <CardTitle className="text-sm flex items-center gap-2">
          <Brain size={16} className="text-accent" />
          {performance.agentName}
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        <div className="grid grid-cols-2 gap-4 text-sm">
          <div>
            <div className="text-muted-foreground">Tasks</div>
            <div className="font-medium">
              {performance.completedTasks}/{performance.totalTasks}
            </div>
          </div>
          <div>
            <div className="text-muted-foreground">Success Rate</div>
            <div className="font-medium text-green-600">
              {performance.successRate.toFixed(1)}%
            </div>
          </div>
          <div>
            <div className="text-muted-foreground">Avg Time</div>
            <div className="font-medium">
              {performance.averageExecutionTime.toFixed(1)}s
            </div>
          </div>
          <div>
            <div className="text-muted-foreground">Last Active</div>
            <div className="font-medium text-xs">
              {performance.lastActivity.toLocaleTimeString()}
            </div>
          </div>
        </div>
        
        <div className="space-y-1">
          <div className="flex justify-between text-xs">
            <span>Completion Rate</span>
            <span>{((performance.completedTasks / performance.totalTasks) * 100).toFixed(1)}%</span>
          </div>
          <Progress 
            value={(performance.completedTasks / performance.totalTasks) * 100} 
            className="h-2" 
          />
        </div>
      </CardContent>
    </Card>
  );
};

// Main component
export const AgentTaskMonitor: React.FC<AgentTaskMonitorProps> = ({
  className,
  showPerformanceMetrics = true,
  maxTasksToShow = 10
}) => {
  const [tasks, setTasks] = useState<AgentTask[]>([]);
  const [performance, setPerformance] = useState<AgentPerformance[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  // Simulate real-time updates
  useEffect(() => {
    // Initial load
    setTasks(generateMockTasks());
    setPerformance(generateMockPerformance());
    setIsLoading(false);

    // Simulate real-time updates every 3 seconds
    const interval = setInterval(() => {
      setTasks(prev => {
        // Randomly update existing tasks or add new ones
        const updated = [...prev];
        
        // Update progress for running tasks
        updated.forEach(task => {
          if (task.status === 'running' && task.progress < 100) {
            task.progress = Math.min(100, task.progress + Math.floor(Math.random() * 20));
            if (task.progress === 100) {
              task.status = Math.random() > 0.1 ? 'completed' : 'failed';
              task.endTime = new Date();
            }
          }
        });
        
        // Occasionally add a new task
        if (Math.random() > 0.7 && updated.length < maxTasksToShow) {
          const newTasks = generateMockTasks();
          updated.unshift(newTasks[0]);
        }
        
        // Remove old completed tasks
        return updated
          .filter(task => {
            if (task.status === 'completed' || task.status === 'failed') {
              return task.endTime ? Date.now() - task.endTime.getTime() < 30000 : true;
            }
            return true;
          })
          .slice(0, maxTasksToShow);
      });
    }, 3000);

    return () => clearInterval(interval);
  }, [maxTasksToShow]);

  if (isLoading) {
    return (
      <Card className={className}>
        <CardContent className="flex items-center justify-center py-8">
          <Loader2 className="w-6 h-6 animate-spin" />
        </CardContent>
      </Card>
    );
  }

  const activeTasks = tasks.filter(task => task.status === 'running' || task.status === 'pending');
  const recentTasks = tasks.filter(task => task.status === 'completed' || task.status === 'failed');

  return (
    <div className={cn("space-y-6", className)}>
      {/* Performance Metrics */}
      {showPerformanceMetrics && (
        <div className="space-y-4">
          <h3 className="text-lg font-semibold flex items-center gap-2">
            <Activity className="w-5 h-5 text-accent" />
            Agent Performance
          </h3>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {performance.map((perf, index) => (
              <PerformanceCard key={index} performance={perf} />
            ))}
          </div>
        </div>
      )}

      {/* Active Tasks */}
      {activeTasks.length > 0 && (
        <div className="space-y-4">
          <h3 className="text-lg font-semibold flex items-center gap-2">
            <Loader2 className="w-5 h-5 text-accent animate-spin" />
            Active Tasks ({activeTasks.length})
          </h3>
          <AnimatePresence>
            <div className="space-y-3">
              {activeTasks.map(task => (
                <TaskCard key={task.id} task={task} />
              ))}
            </div>
          </AnimatePresence>
        </div>
      )}

      {/* Recent Tasks */}
      {recentTasks.length > 0 && (
        <div className="space-y-4">
          <h3 className="text-lg font-semibold flex items-center gap-2">
            <CheckCircle className="w-5 h-5 text-green-500" />
            Recent Activity ({recentTasks.length})
          </h3>
          <AnimatePresence>
            <div className="space-y-3">
              {recentTasks.slice(0, 5).map(task => (
                <TaskCard key={task.id} task={task} />
              ))}
            </div>
          </AnimatePresence>
        </div>
      )}

      {/* No Activity */}
      {tasks.length === 0 && (
        <Card>
          <CardContent className="text-center py-8">
            <Activity className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
            <h3 className="text-lg font-medium mb-2">No Agent Activity</h3>
            <p className="text-muted-foreground">
              Agent tasks and performance metrics will appear here when Luna agents are active.
            </p>
          </CardContent>
        </Card>
      )}
    </div>
  );
};