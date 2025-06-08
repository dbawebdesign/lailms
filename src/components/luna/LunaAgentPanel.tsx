"use client";

import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Separator } from '@/components/ui/separator';
import { 
  Brain, 
  MessageSquare, 
  Activity, 
  Settings, 
  Maximize2, 
  Minimize2, 
  X,
  Bot,
  Mic,
  MicOff,
  Volume2,
  VolumeX,
  BarChart3,
  Clock,
  CheckCircle,
  AlertCircle,
  Zap
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { motion, AnimatePresence } from 'framer-motion';
import { LunaAgentChat } from './LunaAgentChat';
import { AgentTaskMonitor } from './AgentTaskMonitor';

// Types
interface LunaAgentPanelProps {
  userRole: 'student' | 'teacher' | 'admin';
  initialOpen?: boolean;
  className?: string;
}

interface PanelSettings {
  soundEnabled: boolean;
  voiceEnabled: boolean;
  realTimeUpdates: boolean;
  showTaskMonitor: boolean;
  autoExpand: boolean;
}

interface QuickAction {
  id: string;
  label: string;
  icon: React.ReactNode;
  action: () => void;
  variant?: 'default' | 'secondary' | 'outline';
  badge?: string;
}

// Real-time status component
const AgentStatus: React.FC<{ 
  isActive: boolean; 
  activeAgents: string[];
  totalTasks: number;
}> = ({ isActive, activeAgents, totalTasks }) => {
  return (
    <div className="flex items-center gap-2 text-sm">
      <div className={cn(
        "w-2 h-2 rounded-full",
        isActive ? "bg-green-500 animate-pulse" : "bg-gray-400"
      )} />
      <span className="text-muted-foreground">
        {isActive ? `${activeAgents.length} agents active` : 'Agents ready'}
      </span>
      {totalTasks > 0 && (
        <Badge variant="secondary" className="text-xs">
          {totalTasks} tasks
        </Badge>
      )}
    </div>
  );
};

// Quick actions for different user roles
const getQuickActionsForRole = (role: 'student' | 'teacher' | 'admin'): QuickAction[] => {
  const studentActions: QuickAction[] = [
    {
      id: 'ask_tutor',
      label: 'Ask Tutor',
      icon: <Bot size={16} />,
      action: () => console.log('Ask tutor'),
      variant: 'default'
    },
    {
      id: 'practice_quiz',
      label: 'Practice Quiz',
      icon: <Brain size={16} />,
      action: () => console.log('Practice quiz'),
      variant: 'secondary'
    },
    {
      id: 'voice_session',
      label: 'Voice Session',
      icon: <Mic size={16} />,
      action: () => console.log('Voice session'),
      variant: 'outline'
    }
  ];

  const teacherActions: QuickAction[] = [
    {
      id: 'create_course',
      label: 'Create Course',
      icon: <Brain size={16} />,
      action: () => console.log('Create course'),
      variant: 'default'
    },
    {
      id: 'generate_content',
      label: 'Generate Content',
      icon: <Zap size={16} />,
      action: () => console.log('Generate content'),
      variant: 'secondary'
    },
    {
      id: 'analyze_class',
      label: 'Analyze Class',
      icon: <BarChart3 size={16} />,
      action: () => console.log('Analyze class'),
      variant: 'outline'
    }
  ];

  const adminActions: QuickAction[] = [
    {
      id: 'system_analytics',
      label: 'System Analytics',
      icon: <Activity size={16} />,
      action: () => console.log('System analytics'),
      variant: 'default'
    },
    {
      id: 'agent_performance',
      label: 'Agent Performance',
      icon: <BarChart3 size={16} />,
      action: () => console.log('Agent performance'),
      variant: 'secondary'
    }
  ];

  switch (role) {
    case 'student': return studentActions;
    case 'teacher': return teacherActions;
    case 'admin': return adminActions;
    default: return studentActions;
  }
};

// Panel header component
const PanelHeader: React.FC<{
  isExpanded: boolean;
  onToggleExpand: () => void;
  onClose: () => void;
  userRole: string;
  agentStatus: {
    isActive: boolean;
    activeAgents: string[];
    totalTasks: number;
  };
}> = ({ isExpanded, onToggleExpand, onClose, userRole, agentStatus }) => {
  return (
    <CardHeader className="pb-3 border-b border-divider">
      <div className="flex items-center justify-between">
        <CardTitle className="flex items-center gap-2">
          <div className="relative">
            <Brain className="w-5 h-5 text-accent" />
            {agentStatus.isActive && (
              <div className="absolute -top-1 -right-1 w-2 h-2 bg-green-500 rounded-full animate-pulse" />
            )}
          </div>
          <span className="text-base">Luna Agents</span>
          <Badge variant="outline" className="text-xs capitalize">
            {userRole}
          </Badge>
        </CardTitle>
        
        <div className="flex items-center gap-1">
          <Button
            variant="ghost"
            size="sm"
            onClick={onToggleExpand}
            className="h-8 w-8 p-0"
          >
            {isExpanded ? <Minimize2 size={16} /> : <Maximize2 size={16} />}
          </Button>
          <Button
            variant="ghost"
            size="sm"
            onClick={onClose}
            className="h-8 w-8 p-0"
          >
            <X size={16} />
          </Button>
        </div>
      </div>
      
      <AgentStatus 
        isActive={agentStatus.isActive}
        activeAgents={agentStatus.activeAgents}
        totalTasks={agentStatus.totalTasks}
      />
    </CardHeader>
  );
};

// Settings panel component
const SettingsPanel: React.FC<{
  settings: PanelSettings;
  onSettingsChange: (settings: Partial<PanelSettings>) => void;
}> = ({ settings, onSettingsChange }) => {
  return (
    <div className="space-y-4 p-4">
      <h3 className="font-medium text-sm">Panel Settings</h3>
      
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            {settings.soundEnabled ? <Volume2 size={16} /> : <VolumeX size={16} />}
            <span className="text-sm">Sound Notifications</span>
          </div>
          <Button
            variant="outline"
            size="sm"
            onClick={() => onSettingsChange({ soundEnabled: !settings.soundEnabled })}
          >
            {settings.soundEnabled ? 'On' : 'Off'}
          </Button>
        </div>
        
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            {settings.voiceEnabled ? <Mic size={16} /> : <MicOff size={16} />}
            <span className="text-sm">Voice Interactions</span>
          </div>
          <Button
            variant="outline"
            size="sm"
            onClick={() => onSettingsChange({ voiceEnabled: !settings.voiceEnabled })}
          >
            {settings.voiceEnabled ? 'On' : 'Off'}
          </Button>
        </div>
        
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Activity size={16} />
            <span className="text-sm">Real-time Updates</span>
          </div>
          <Button
            variant="outline"
            size="sm"
            onClick={() => onSettingsChange({ realTimeUpdates: !settings.realTimeUpdates })}
          >
            {settings.realTimeUpdates ? 'On' : 'Off'}
          </Button>
        </div>
        
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <BarChart3 size={16} />
            <span className="text-sm">Task Monitor</span>
          </div>
          <Button
            variant="outline"
            size="sm"
            onClick={() => onSettingsChange({ showTaskMonitor: !settings.showTaskMonitor })}
          >
            {settings.showTaskMonitor ? 'On' : 'Off'}
          </Button>
        </div>
      </div>
    </div>
  );
};

// Main Luna Agent Panel Component
export const LunaAgentPanel: React.FC<LunaAgentPanelProps> = ({
  userRole,
  initialOpen = false,
  className
}) => {
  const [isOpen, setIsOpen] = useState(initialOpen);
  const [isExpanded, setIsExpanded] = useState(false);
  const [activeTab, setActiveTab] = useState('chat');
  const [settings, setSettings] = useState<PanelSettings>({
    soundEnabled: true,
    voiceEnabled: true,
    realTimeUpdates: true,
    showTaskMonitor: true,
    autoExpand: false
  });

  // Mock agent status - in production this would come from real-time monitoring
  const [agentStatus, setAgentStatus] = useState({
    isActive: false,
    activeAgents: [] as string[],
    totalTasks: 0
  });

  const quickActions = getQuickActionsForRole(userRole);

  // Simulate agent activity
  useEffect(() => {
    const interval = setInterval(() => {
      setAgentStatus(prev => ({
        isActive: Math.random() > 0.3,
        activeAgents: Math.random() > 0.5 ? ['Luna Tutor', 'Content Creator'] : [],
        totalTasks: Math.floor(Math.random() * 5)
      }));
    }, 5000);

    return () => clearInterval(interval);
  }, []);

  const handleSettingsChange = (newSettings: Partial<PanelSettings>) => {
    setSettings(prev => ({ ...prev, ...newSettings }));
  };

  const handleToggleExpand = () => {
    setIsExpanded(!isExpanded);
  };

  const handleClose = () => {
    setIsOpen(false);
  };

  const handleOpen = () => {
    setIsOpen(true);
  };

  // Panel trigger when closed
  if (!isOpen) {
    return (
      <motion.div
        initial={{ x: 300 }}
        animate={{ x: 0 }}
        className={cn(
          "fixed right-4 top-1/2 -translate-y-1/2 z-50",
          className
        )}
      >
        <Button
          onClick={handleOpen}
          className="h-12 w-12 rounded-full shadow-lg bg-accent hover:bg-accent/90 text-white"
          size="icon"
        >
          <div className="relative">
            <Brain size={20} />
            {agentStatus.isActive && (
              <div className="absolute -top-1 -right-1 w-3 h-3 bg-green-400 rounded-full animate-pulse border-2 border-white" />
            )}
          </div>
        </Button>
      </motion.div>
    );
  }

  return (
    <motion.div
      initial={{ x: 400, opacity: 0 }}
      animate={{ x: 0, opacity: 1 }}
      exit={{ x: 400, opacity: 0 }}
      className={cn(
        "fixed right-4 top-4 bottom-4 z-50 flex flex-col",
        isExpanded ? "w-[480px]" : "w-[360px]",
        className
      )}
    >
      <Card className="flex flex-col h-full shadow-2xl bg-background/95 backdrop-blur-sm border border-divider">
        <PanelHeader
          isExpanded={isExpanded}
          onToggleExpand={handleToggleExpand}
          onClose={handleClose}
          userRole={userRole}
          agentStatus={agentStatus}
        />

        {/* Quick Actions */}
        <div className="p-3 border-b border-divider">
          <div className="flex flex-wrap gap-2">
            {quickActions.map((action) => (
              <Button
                key={action.id}
                variant={action.variant || 'outline'}
                size="sm"
                onClick={action.action}
                className="flex items-center gap-2 text-xs"
              >
                {action.icon}
                <span>{action.label}</span>
                {action.badge && (
                  <Badge variant="secondary" className="text-xs">
                    {action.badge}
                  </Badge>
                )}
              </Button>
            ))}
          </div>
        </div>

        {/* Tabs */}
        <Tabs value={activeTab} onValueChange={setActiveTab} className="flex-1 flex flex-col">
          <TabsList className="grid w-full grid-cols-3 mx-3 mt-3">
            <TabsTrigger value="chat" className="text-xs">
              <MessageSquare size={14} className="mr-1" />
              Chat
            </TabsTrigger>
            <TabsTrigger value="monitor" className="text-xs">
              <Activity size={14} className="mr-1" />
              Monitor
            </TabsTrigger>
            <TabsTrigger value="settings" className="text-xs">
              <Settings size={14} className="mr-1" />
              Settings
            </TabsTrigger>
          </TabsList>

          {/* Chat Tab */}
          <TabsContent value="chat" className="flex-1 mt-3 mx-3 mb-3">
            <LunaAgentChat
              userRole={userRole}
              isMobile={false}
              className="h-full"
            />
          </TabsContent>

          {/* Monitor Tab */}
          <TabsContent value="monitor" className="flex-1 mt-3 mx-0 mb-0">
            <ScrollArea className="h-full px-3 pb-3">
              {settings.showTaskMonitor ? (
                <AgentTaskMonitor
                  showPerformanceMetrics={userRole === 'admin'}
                  maxTasksToShow={5}
                />
              ) : (
                <Card>
                  <CardContent className="text-center py-8">
                    <Activity className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
                    <h3 className="text-lg font-medium mb-2">Task Monitor Disabled</h3>
                    <p className="text-muted-foreground text-sm">
                      Enable task monitoring in settings to see agent activity.
                    </p>
                  </CardContent>
                </Card>
              )}
            </ScrollArea>
          </TabsContent>

          {/* Settings Tab */}
          <TabsContent value="settings" className="flex-1 mt-3 mx-0 mb-0">
            <ScrollArea className="h-full">
              <SettingsPanel
                settings={settings}
                onSettingsChange={handleSettingsChange}
              />
            </ScrollArea>
          </TabsContent>
        </Tabs>

        {/* Footer with system status */}
        <div className="border-t border-divider p-2">
          <div className="flex items-center justify-between text-xs text-muted-foreground">
            <div className="flex items-center gap-2">
              <Clock size={12} />
              <span>Last sync: {new Date().toLocaleTimeString()}</span>
            </div>
            <div className="flex items-center gap-1">
              {settings.realTimeUpdates && (
                <CheckCircle size={12} className="text-green-500" />
              )}
              {!settings.realTimeUpdates && (
                <AlertCircle size={12} className="text-yellow-500" />
              )}
              <span className="capitalize">System {settings.realTimeUpdates ? 'Online' : 'Offline'}</span>
            </div>
          </div>
        </div>
      </Card>
    </motion.div>
  );
};