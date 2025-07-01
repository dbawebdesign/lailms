'use client';

import React from 'react';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { Book, ArrowRight, PlayCircle } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Progress } from "@/components/ui/progress";

export interface ActiveCourseItemProps {
  id: string;
  title: string;
  description?: string;
  progress?: number;
  href: string;
}

const ActiveCourseItem: React.FC<ActiveCourseItemProps> = ({ 
  id,
  title,
  description,
  progress = 0,
  href,
}) => {
  return (
    <Link href={href} className="block group">
      <div 
        className={cn(
          "relative bg-white/80 dark:bg-gray-900/80 backdrop-blur-sm",
          "border border-gray-200/50 dark:border-gray-700/50",
          "rounded-2xl p-4 transition-all duration-300 ease-out",
          "hover:bg-white dark:hover:bg-gray-900",
          "hover:border-gray-300/60 dark:hover:border-gray-600/60",
          "hover:shadow-lg hover:shadow-gray-200/20 dark:hover:shadow-gray-900/20",
          "hover:-translate-y-1 hover:scale-[1.02]",
          "group-active:scale-[0.98] group-active:translate-y-0"
        )}
      >
        {/* Header */}
        <div className="flex items-start justify-between mb-3">
          <div className="flex items-center space-x-3">
            <div className="flex items-center justify-center w-8 h-8 rounded-xl bg-gradient-to-br from-blue-500/10 to-purple-500/10 dark:from-blue-400/10 dark:to-purple-400/10 group-hover:from-blue-500/20 group-hover:to-purple-500/20 transition-all duration-300">
              <Book className="w-4 h-4 text-blue-600 dark:text-blue-400" />
            </div>
            <div className="flex-1 min-w-0">
              <h3 className="font-semibold text-sm text-gray-900 dark:text-gray-100 truncate group-hover:text-blue-600 dark:group-hover:text-blue-400 transition-colors duration-200">
                {title}
              </h3>
            </div>
          </div>
          <ArrowRight className="w-4 h-4 text-gray-400 group-hover:text-blue-500 group-hover:translate-x-1 transition-all duration-200 flex-shrink-0" />
        </div>

        {/* Progress */}
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-gray-600 dark:text-gray-400">Progress</span>
            <span className="text-xs font-semibold text-gray-900 dark:text-gray-100">{progress}%</span>
          </div>
          <div className="relative">
            <Progress 
              value={progress} 
              className="h-1.5 bg-gray-100 dark:bg-gray-800"
            />
            <div 
              className="absolute top-0 left-0 h-full bg-gradient-to-r from-blue-500 to-purple-500 rounded-full transition-all duration-500 ease-out"
              style={{ width: `${progress}%` }}
            />
          </div>
        </div>

        {/* Hover overlay */}
        <div className="absolute inset-0 bg-gradient-to-r from-blue-500/5 to-purple-500/5 rounded-2xl opacity-0 group-hover:opacity-100 transition-opacity duration-300 pointer-events-none" />
      </div>
    </Link>
  );
};

export default ActiveCourseItem; 