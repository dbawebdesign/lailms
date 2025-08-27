'use client';

import { HelpCircle, BookOpen } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useQuickGuide } from '@/hooks/use-quick-guide';
import { cn } from '@/lib/utils';

interface QuickGuideButtonProps {
  variant?: 'default' | 'outline' | 'ghost' | 'link';
  size?: 'default' | 'sm' | 'lg' | 'icon';
  className?: string;
  showLabel?: boolean;
  icon?: React.ElementType;
}

export function QuickGuideButton({ 
  variant = 'ghost', 
  size = 'default',
  className,
  showLabel = true,
  icon: Icon = HelpCircle
}: QuickGuideButtonProps) {
  const { openQuickGuide } = useQuickGuide();

  return (
    <Button
      variant={variant}
      size={size}
      onClick={openQuickGuide}
      className={cn("gap-2", className)}
    >
      <Icon className="h-4 w-4" />
      {showLabel && <span>Quick Guide</span>}
    </Button>
  );
}

