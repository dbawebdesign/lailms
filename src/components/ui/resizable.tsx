'use client';

import * as React from 'react';
import { cn } from '@/lib/utils';

interface ResizablePanelGroupProps extends React.HTMLAttributes<HTMLDivElement> {
  direction: 'horizontal' | 'vertical';
}

interface ResizablePanelProps extends React.HTMLAttributes<HTMLDivElement> {
  defaultSize?: number;
  minSize?: number;
  maxSize?: number;
  onResize?: (size: number) => void;
}

interface ResizableHandleProps extends React.HTMLAttributes<HTMLDivElement> {
  withHandle?: boolean;
}

const ResizablePanelGroup = React.forwardRef<HTMLDivElement, ResizablePanelGroupProps>(
  ({ className, direction, children, ...props }, ref) => {
    const containerRef = React.useRef<HTMLDivElement>(null);
    const [panels, setPanels] = React.useState<Array<{ size: number; minSize: number; maxSize: number }>>([]);
    const [isDragging, setIsDragging] = React.useState(false);
    const [dragIndex, setDragIndex] = React.useState<number>(-1);

    // Initialize panels when children mount
    React.useEffect(() => {
      const childrenArray = React.Children.toArray(children);
      const panelChildren = childrenArray.filter(child => 
        React.isValidElement(child) && child.type === ResizablePanel
      );
      
      const initialPanels = panelChildren.map((child) => {
        if (React.isValidElement(child) && typeof child.props === 'object' && child.props) {
          const props = child.props as any;
          return {
            size: props.defaultSize || 33.33,
            minSize: props.minSize || 10,
            maxSize: props.maxSize || 90
          };
        }
        return { size: 33.33, minSize: 10, maxSize: 90 };
      });

      setPanels(initialPanels);
    }, [children]);

    const handleMouseDown = React.useCallback((handleIndex: number) => (e: React.MouseEvent) => {
      e.preventDefault();
      setIsDragging(true);
      setDragIndex(handleIndex);
      
      const container = containerRef.current;
      if (!container) return;

      const containerRect = container.getBoundingClientRect();
      const startX = e.clientX;
      const startSizes = [...panels];

      const handleMouseMove = (e: MouseEvent) => {
        if (!container) return;
        
        const deltaX = e.clientX - startX;
        const containerWidth = containerRect.width;
        const deltaPercentage = (deltaX / containerWidth) * 100;

        const newSizes = [...startSizes];
        const leftPanelIndex = handleIndex;
        const rightPanelIndex = handleIndex + 1;

        if (leftPanelIndex >= 0 && rightPanelIndex < newSizes.length) {
          const leftPanel = newSizes[leftPanelIndex];
          const rightPanel = newSizes[rightPanelIndex];

          const newLeftSize = Math.max(
            leftPanel.minSize,
            Math.min(leftPanel.maxSize, leftPanel.size + deltaPercentage)
          );
          const newRightSize = Math.max(
            rightPanel.minSize,
            Math.min(rightPanel.maxSize, rightPanel.size - deltaPercentage)
          );

          // Only update if both panels can accommodate the change
          const totalChange = (newLeftSize - leftPanel.size) + (newRightSize - rightPanel.size);
          if (Math.abs(totalChange) < 0.1) { // Allow small rounding errors
            newSizes[leftPanelIndex] = { ...leftPanel, size: newLeftSize };
            newSizes[rightPanelIndex] = { ...rightPanel, size: newRightSize };
            setPanels(newSizes);
          }
        }
      };

      const handleMouseUp = () => {
        setIsDragging(false);
        setDragIndex(-1);
        document.removeEventListener('mousemove', handleMouseMove);
        document.removeEventListener('mouseup', handleMouseUp);
      };

      document.addEventListener('mousemove', handleMouseMove);
      document.addEventListener('mouseup', handleMouseUp);
    }, [panels]);

    // Clone children with updated sizes
    const childrenWithSizes = React.Children.map(children, (child, index) => {
      if (React.isValidElement(child)) {
        if (child.type === ResizablePanel) {
          const panelData = panels[Math.floor(index / 2)]; // Account for handles between panels
          const props = child.props as any;
          return React.cloneElement(child, {
            ...props,
            size: panelData?.size || props.defaultSize || 33.33
          });
        } else if (child.type === ResizableHandle) {
          const handleIndex = Math.floor(index / 2);
          const props = child.props as any;
          return React.cloneElement(child, {
            ...props,
            onMouseDown: handleMouseDown(handleIndex)
          });
        }
      }
      return child;
    });

    return (
      <div
        ref={containerRef}
        className={cn(
          'flex h-full select-none',
          direction === 'horizontal' ? 'flex-row' : 'flex-col',
          isDragging && 'cursor-col-resize',
          className
        )}
        {...props}
      >
        {childrenWithSizes}
      </div>
    );
  }
);
ResizablePanelGroup.displayName = 'ResizablePanelGroup';

const ResizablePanel = React.forwardRef<HTMLDivElement, ResizablePanelProps & { size?: number }>(
  ({ className, defaultSize = 33.33, minSize = 10, maxSize = 90, size, children, onResize, ...props }, ref) => {
    const actualSize = size || defaultSize;

    React.useEffect(() => {
      onResize?.(actualSize);
    }, [actualSize, onResize]);

    return (
      <div
        ref={ref}
        className={cn('flex-shrink-0 transition-all duration-200 ease-out', className)}
        style={{ 
          width: `${actualSize}%`,
          minWidth: `${minSize}%`,
          maxWidth: `${maxSize}%`,
        }}
        {...props}
      >
        {children}
      </div>
    );
  }
);
ResizablePanel.displayName = 'ResizablePanel';

const ResizableHandle = React.forwardRef<HTMLDivElement, ResizableHandleProps & { onMouseDown?: (e: React.MouseEvent) => void }>(
  ({ className, withHandle = true, onMouseDown, ...props }, ref) => {
    const [isHovered, setIsHovered] = React.useState(false);

    return (
      <div
        ref={ref}
        className={cn(
          'relative flex items-center justify-center group flex-shrink-0',
          'w-1 bg-slate-200/60 dark:bg-slate-700/60 hover:bg-blue-400/40 dark:hover:bg-blue-500/40',
          'transition-all duration-200 cursor-col-resize select-none',
          'hover:w-2',
          className
        )}
        onMouseDown={onMouseDown}
        onMouseEnter={() => setIsHovered(true)}
        onMouseLeave={() => setIsHovered(false)}
        {...props}
      >
        {withHandle && (
          <div className={cn(
            'absolute inset-y-0 left-1/2 transform -translate-x-1/2 w-5 flex items-center justify-center',
            'opacity-0 group-hover:opacity-100 transition-opacity duration-200',
            isHovered && 'opacity-100'
          )}>
            <div className="flex flex-col gap-0.5">
              <div className="w-0.5 h-1 bg-slate-400 dark:bg-slate-500 rounded-full" />
              <div className="w-0.5 h-1 bg-slate-400 dark:bg-slate-500 rounded-full" />
              <div className="w-0.5 h-1 bg-slate-400 dark:bg-slate-500 rounded-full" />
            </div>
          </div>
        )}
      </div>
    );
  }
);
ResizableHandle.displayName = 'ResizableHandle';

export { ResizablePanelGroup, ResizablePanel, ResizableHandle }; 