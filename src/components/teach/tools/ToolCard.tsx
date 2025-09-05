'use client';

import React from 'react';
import { useRouter } from 'next/navigation';
import { TeachingTool } from '@/types/teachingTools';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { 
  ClipboardList, 
  BookOpen, 
  HelpCircle, 
  Users, 
  MessageSquare, 
  Lightbulb, 
  Zap, 
  BarChart3, 
  Brain, 
  Sparkles,
  Clock,
  ArrowRight,
  FolderOpen,
  Gamepad2
} from 'lucide-react';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';

// Icon mapping for the tools
const iconMap = {
  ClipboardList,
  BookOpen,
  HelpCircle,
  Users,
  MessageSquare,
  Lightbulb,
  Zap,
  BarChart3,
  Brain,
  Sparkles,
  Gamepad2
};

interface ToolCardProps {
  tool: TeachingTool;
  onSelect: (tool: TeachingTool) => void;
  animationDelay?: number;
}

export function ToolCard({ tool, onSelect, animationDelay = 0 }: ToolCardProps) {
  const router = useRouter();
  const IconComponent = iconMap[tool.icon as keyof typeof iconMap];

  const handleLibraryClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    router.push(`/teach/tools/${tool.id}/library`);
  };

  const getCategoryColor = (category: string) => {
    switch (category) {
      case 'assessment':
        return 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-300';
      case 'planning':
        return 'bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-300';
      case 'content-creation':
        return 'bg-emerald-100 text-emerald-800 dark:bg-emerald-900 dark:text-emerald-300';
      case 'communication':
        return 'bg-orange-100 text-orange-800 dark:bg-orange-900 dark:text-orange-300';
      case 'differentiation':
        return 'bg-pink-100 text-pink-800 dark:bg-pink-900 dark:text-pink-300';
      case 'visual-aids':
        return 'bg-indigo-100 text-indigo-800 dark:bg-indigo-900 dark:text-indigo-300';
      default:
        return 'bg-gray-100 text-gray-800 dark:bg-gray-900 dark:text-gray-300';
    }
  };

  return (
    <Card 
      className="group relative cursor-pointer border-0 shadow-sm glass-card glass-card-hover card-hover-gradient animate-premium-entrance transition-all duration-300 ease-out hover:shadow-xl hover:shadow-primary/10 overflow-visible"
      onClick={() => onSelect(tool)}
      style={{
        "--hover-gradient": "linear-gradient(135deg, rgba(107, 93, 229, 0.1) 0%, rgba(228, 93, 229, 0.05) 100%)",
        "--animation-delay": `${animationDelay}ms`
      } as React.CSSProperties}
    >
      {/* Status badges */}
      <div className="absolute top-3 right-3 flex flex-col gap-1 z-20">
        {tool.isNew && (
          <Badge 
            variant="secondary" 
            className="text-xs px-2 py-1 bg-gradient-to-r from-emerald-500 to-teal-500 text-white shadow-md font-medium rounded-md border-0 animate-fade-in"
            style={{"--animation-delay": `${animationDelay + 300}ms`} as React.CSSProperties}
          >
            New
          </Badge>
        )}
        {tool.isPopular && (
          <Badge 
            variant="secondary" 
            className="text-xs px-2 py-1 bg-gradient-to-r from-orange-500 to-red-500 text-white shadow-md font-medium rounded-md border-0 animate-fade-in"
            style={{"--animation-delay": `${animationDelay + 400}ms`} as React.CSSProperties}
          >
            Popular
          </Badge>
        )}
      </div>

      <CardHeader className="pb-3 pt-6 pr-16">
        <div className="flex items-start gap-3">
          <div 
            className="flex-shrink-0 w-12 h-12 rounded-lg bg-gradient-to-br from-primary/10 to-primary/20 flex items-center justify-center transition-all duration-300 group-hover:from-primary/20 group-hover:to-primary/30 group-hover:scale-110 animate-scale-in"
            style={{"--animation-delay": `${animationDelay + 200}ms`} as React.CSSProperties}
          >
            {IconComponent && <IconComponent className="w-6 h-6 text-primary transition-colors duration-300 icon-pulse-on-hover" />}
          </div>
          <div className="flex-1 min-w-0">
            <CardTitle className="text-lg font-semibold text-slate-800 dark:text-slate-100 leading-tight transition-colors duration-300 group-hover:text-primary text-hover">
              {tool.name}
            </CardTitle>
            <div className="flex items-center gap-2 mt-2">
              <Badge className={`text-xs px-2 py-1 transition-all duration-300 ${getCategoryColor(tool.category)}`}>
                {tool.category.replace('-', ' ')}
              </Badge>
            </div>
          </div>
        </div>
      </CardHeader>

      <CardContent className="pt-0 pb-4">
        <CardDescription 
          className="text-sm text-slate-600 dark:text-slate-400 mb-3 line-clamp-2 transition-colors duration-300 group-hover:text-slate-700 dark:group-hover:text-slate-300 animate-fade-in"
          style={{"--animation-delay": `${animationDelay + 100}ms`} as React.CSSProperties}
        >
          {tool.description}
        </CardDescription>
        
        <div className="flex items-center gap-4 text-xs text-slate-500 dark:text-slate-400 transition-colors duration-300 group-hover:text-slate-600 dark:group-hover:text-slate-300">
          <div className="flex items-center gap-1">
            <Clock className="w-3 h-3" />
            <span>{tool.estimatedTime}</span>
          </div>
          <div className="flex items-center gap-1">
            <span>•</span>
            <span>{tool.outputFormats.length} format{tool.outputFormats.length !== 1 ? 's' : ''}</span>
          </div>
        </div>
      </CardContent>

      <CardFooter className="pt-0 flex gap-2">
        <Button 
          className="flex-1 transition-all duration-300 bg-secondary text-secondary-foreground hover:bg-primary hover:text-primary-foreground group-hover:bg-primary group-hover:text-primary-foreground"
          variant="secondary"
        >
          Use Tool
          <ArrowRight className="w-4 h-4 ml-2 transition-transform duration-300 group-hover:translate-x-1" />
        </Button>
        <TooltipProvider>
          <Tooltip>
            <TooltipTrigger asChild>
              <Button 
                variant="outline"
                size="sm"
                onClick={handleLibraryClick}
                className="px-3 transition-all duration-300 hover:bg-primary hover:text-primary-foreground"
              >
                <FolderOpen className="w-4 h-4" />
              </Button>
            </TooltipTrigger>
            <TooltipContent side="right" sideOffset={8}>
              <p>View {tool.name} Library</p>
            </TooltipContent>
          </Tooltip>
        </TooltipProvider>
      </CardFooter>

      {/* Subtle hover overlay */}
      <div className="absolute inset-0 bg-gradient-to-br from-primary/0 via-primary/0 to-primary/0 group-hover:from-primary/5 group-hover:via-primary/3 group-hover:to-primary/5 transition-all duration-300 pointer-events-none" />
    </Card>
  );
} 