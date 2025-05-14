'use client';

import React from 'react';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { ArrowRight, BookOpenCheck } from 'lucide-react';
import { cn } from '@/lib/utils';

interface NextUpCardProps {
  lessonTitle?: string;
  courseTitle?: string;
  lessonHref?: string; // e.g., /learn/courses/[courseId]/lessons/[lessonId]
  isLoading?: boolean;
}

const NextUpCard: React.FC<NextUpCardProps> = ({ 
  lessonTitle = "Your Next Lesson", 
  courseTitle = "Course Name", 
  lessonHref = "#",
  isLoading = false 
}) => {

  if (isLoading) {
    return (
      <div className="bg-card p-6 rounded-lg shadow animate-pulse">
        <div className="h-6 bg-muted rounded w-3/4 mb-2"></div>
        <div className="h-4 bg-muted rounded w-1/2 mb-4"></div>
        <div className="h-10 bg-muted rounded w-full"></div>
      </div>
    );
  }

  if (!lessonTitle || lessonTitle === "Your Next Lesson") { // Indicates no specific lesson found
     return (
      <div className="bg-card p-6 rounded-lg shadow">
        <BookOpenCheck className="h-8 w-8 text-primary mb-3" />
        <h2 className="text-xl font-semibold mb-2">Ready to Learn?</h2>
        <p className="text-muted-foreground mb-4">
          Dive into your courses and pick up where you left off, or start something new!
        </p>
        <Link href="/learn/courses">
          <Button className="w-full bg-primary hover:bg-primary/90 text-primary-foreground">
            Explore My Courses <ArrowRight className="ml-2 h-4 w-4" />
          </Button>
        </Link>
      </div>
    );
  }

  return (
    <div className="bg-card p-6 rounded-lg shadow">
      <BookOpenCheck className="h-8 w-8 text-primary mb-3" />
      <h2 className="text-xl font-semibold mb-1 truncate" title={lessonTitle}>{lessonTitle}</h2>
      <p className="text-sm text-muted-foreground mb-4 truncate" title={courseTitle}>From: {courseTitle}</p>
      
      <Link href={lessonHref || "#"}>
        <Button className="w-full bg-primary hover:bg-primary/90 text-primary-foreground">
          Continue Learning <ArrowRight className="ml-2 h-4 w-4" />
        </Button>
      </Link>
    </div>
  );
};

export default NextUpCard; 