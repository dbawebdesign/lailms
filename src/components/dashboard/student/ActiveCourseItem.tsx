'use client';

import React from 'react';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { Book, PercentCircle, PlayCircle } from 'lucide-react'; // Or other relevant icons
import { cn } from '@/lib/utils';
import { Progress } from "@/components/ui/progress"; // Assuming you have a Progress component

export interface ActiveCourseItemProps {
  id: string;
  title: string;
  // description?: string; // Optional
  // imageUrl?: string;    // Optional
  progress?: number; // e.g., 0 to 100, or lessons completed
  // totalLessons?: number;
  href: string; // e.g., /learn/courses/[instanceId]
}

const ActiveCourseItem: React.FC<ActiveCourseItemProps> = ({ 
  id,
  title,
  progress = 0, // Default to 0 if not provided
  href,
}) => {
  return (
    <Link href={href} className="block group">
      <div 
        className={cn(
          "bg-card p-4 rounded-lg shadow hover:shadow-md transition-shadow duration-200 ease-in-out h-full flex flex-col justify-between border border-border/50"
        )}
      >
        <div>
          <div className="flex items-center justify-center h-24 bg-muted/50 rounded-md mb-3 group-hover:bg-muted/70 transition-colors">
            <Book className="h-10 w-10 text-muted-foreground group-hover:text-primary transition-colors" />
            {/* Placeholder for image if you add imageUrl prop later */}
            {/* {imageUrl ? <img src={imageUrl} alt={title} className="h-full w-full object-cover rounded-md" /> : <Book className="h-12 w-12 text-muted-foreground" />} */}
          </div>
          <h3 className="text-lg font-semibold mb-1 truncate group-hover:text-primary transition-colors" title={title}>{title}</h3>
          {/* Optional: description can be added here */}
        </div>
        
        <div className="mt-3">
          {progress !== undefined && (
            <div className="mb-2">
              <div className="flex justify-between text-xs text-muted-foreground mb-1">
                <span>Progress</span>
                <span>{progress}%</span>
              </div>
              <Progress value={progress} className="h-2" />
            </div>
          )}
          <Button variant="outline" className="w-full mt-2 group-hover:bg-primary group-hover:text-primary-foreground transition-colors">
            Go to Course <PlayCircle className="ml-2 h-4 w-4" />
          </Button>
        </div>
      </div>
    </Link>
  );
};

export default ActiveCourseItem; 