import React from 'react';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Users } from 'lucide-react';

interface ActiveClassItemProps {
  id: string;
  name: string;
  baseClassName: string;
  studentCount: number;
  manageClassUrl?: string; // Optional: URL to the specific class management page
}

export function ActiveClassItem({
  id,
  name,
  baseClassName,
  studentCount,
  manageClassUrl,
}: ActiveClassItemProps) {
  const displayClassName = name || baseClassName; // Prefer instance name, fallback to base class name

  return (
    <div className={
      "group hover-card hover-bg-light cursor-pointer " +
      "p-4 bg-background/80 rounded-xl border border-border/20 " +
      "hover:border-border/40 hover:bg-background/95 transition-all duration-200 " +
      "hover:shadow-lg hover:shadow-primary/5 dark:hover:shadow-primary/10 dark:hover:border-primary/20"
    }>
      <div className="flex items-start justify-between mb-3">
        <div className="flex-1 min-w-0">
          <h3 className="font-medium text-foreground text-sm truncate hover-text-highlight" title={displayClassName}>
            {displayClassName}
          </h3>
          {name && baseClassName && name !== baseClassName && (
            <p className="text-xs text-muted-foreground truncate mt-1" title={baseClassName}>
              Based on: {baseClassName}
            </p>
          )}
        </div>
      </div>
      
      <div className="flex items-center justify-between">
        <div className="flex items-center text-sm text-muted-foreground">
          <Users className="mr-2 h-4 w-4 hover-icon" />
          <span className="hover-text-highlight">{studentCount} Student{studentCount !== 1 ? 's' : ''}</span>
        </div>
        
        {manageClassUrl ? (
          <Button asChild size="sm" variant="outline" className="opacity-0 group-hover:opacity-100 transition-opacity hover-button-glow">
            <Link href={manageClassUrl}>Manage</Link>
          </Button>
        ) : (
          <Button size="sm" variant="outline" disabled className="opacity-0 group-hover:opacity-100 transition-opacity">
            Manage
          </Button>
        )}
      </div>
    </div>
  );
} 