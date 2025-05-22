'use client';

import React, { useState } from 'react';
import type { StudioBaseClass, Path, Lesson, LessonSection } from '@/types/lesson';
import { ChevronRight, ChevronDown, FileText, GripVertical, Info as InfoIcon } from 'lucide-react';

// NEW: DND Kit imports
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  DragEndEvent,
} from '@dnd-kit/core';
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  verticalListSortingStrategy,
  useSortable,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';

interface StudioNavigationTreeProps {
  baseClass: StudioBaseClass | null;
  onSelectItem: (type: string, itemData: StudioBaseClass | Path | Lesson | LessonSection) => void;
  selectedItemId: string | null;
  onToggleExpandPath: (pathId: string) => Promise<void>;
  onToggleExpandLesson: (lessonId: string) => Promise<void>;
  // NEW: Prop for reordering paths
  onReorderPaths: (activeId: string, overId: string) => Promise<void>; 
  // NEW: Prop for reordering lessons
  onReorderLessons: (pathId: string, activeLessonId: string, overLessonId: string) => Promise<void>;
  // NEW: Prop for reordering sections
  onReorderSections: (lessonId: string, activeSectionId: string, overSectionId: string) => Promise<void>;
}

// NEW: SortableItem component for Paths
const SortablePathItem: React.FC<{
  path: Path;
  isExpanded: boolean;
  selectedItemId: string | null;
  onSelectItem: (type: string, itemData: Path | Lesson | LessonSection) => void; // Broaden for children later
  handlePathHeaderClick: (path: Path) => void;
  // NEW: Props for lesson reordering
  lessons: Lesson[]; // Pass lessons directly for DND context
  onToggleExpandLesson: (lesson: Lesson) => void;
  onReorderLessons: (pathId: string, activeLessonId: string, overLessonId: string) => Promise<void>;
  onReorderSections: (lessonId: string, activeSectionId: string, overSectionId: string) => Promise<void>; // Pass down
  expandedLessons: Set<string>; // To manage lesson expansion state
}> = ({ 
  path, 
  isExpanded, 
  selectedItemId, 
  onSelectItem, 
  handlePathHeaderClick, 
  lessons, 
  onToggleExpandLesson,
  onReorderLessons,
  onReorderSections,
  expandedLessons
}) => {
  const { 
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: path.id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
    zIndex: isDragging ? 100 : undefined, // Higher zIndex for path dragging
  };

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }), // Require some movement before drag starts
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates })
  );

  const handleDragEndLessons = (event: DragEndEvent) => {
    const { active, over } = event;
    if (over && active.id !== over.id) {
      onReorderLessons(path.id, active.id as string, over.id as string);
    }
  };

  return (
    <li ref={setNodeRef} style={style} className="py-0.5 bg-background rounded-md shadow-sm mb-1 list-none">
      <div className="flex items-center justify-between hover:bg-muted/50 rounded-t-md">
        <div className="flex items-center flex-grow">
          <button 
            {...attributes} 
            {...listeners} 
            className="p-2 cursor-grab touch-none text-muted-foreground hover:text-foreground"
            aria-label="Drag to reorder path"
          >
            <GripVertical size={18} />
          </button>
          <div 
            className={`flex-grow text-md cursor-pointer p-2 ${selectedItemId === path.id ? 'bg-primary/20 text-primary font-medium' : 'hover:bg-muted/80'}`}
            onClick={() => onSelectItem('path', path)}
          >
            {path.title}
          </div>
        </div>
        <button 
          onClick={(e) => {
            e.stopPropagation();
            handlePathHeaderClick(path);
          }}
          className="p-1 rounded hover:bg-muted-foreground/20 focus:outline-none mr-2"
          aria-label={isExpanded ? 'Collapse path' : 'Expand path'}
        >
          {isExpanded ? <ChevronDown size={18} /> : <ChevronRight size={18} />}
        </button>
      </div>
      {isExpanded && (
        <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEndLessons}>
          <SortableContext items={lessons.map(l => l.id)} strategy={verticalListSortingStrategy}>
            <ul className="pl-3 mt-1 space-y-0.5 border-l border-border ml-2">
              {lessons.map((lesson) => (
                <SortableLessonItem
                  key={lesson.id}
                  lesson={lesson}
                  pathId={path.id} // Pass pathId for context if needed by SortableLessonItem or its interactions
                  isExpanded={expandedLessons.has(lesson.id)}
                  selectedItemId={selectedItemId}
                  onSelectItem={onSelectItem as (type: string, itemData: Lesson | LessonSection) => void}
                  handleLessonHeaderClick={onToggleExpandLesson} // Pass the main toggle handler
                  onReorderSections={onReorderSections}
                  expandedSections={new Set()} // Placeholder for when sections are sortable
                  onToggleExpandSection={() => {}} // Placeholder
                />
              ))}
              {lessons.length === 0 && (
                <p className="pl-1 pt-1 text-xs text-muted-foreground">No lessons in this path yet, or still loading.</p>
              )}
            </ul>
          </SortableContext>
        </DndContext>
      )}
    </li>
  );
};

// NEW: SortableItem component for Lessons
const SortableLessonItem: React.FC<{
  lesson: Lesson;
  pathId: string;
  isExpanded: boolean;
  selectedItemId: string | null;
  onSelectItem: (type: string, itemData: Lesson | LessonSection) => void;
  handleLessonHeaderClick: (lesson: Lesson) => void;
  onReorderSections: (lessonId: string, activeSectionId: string, overSectionId: string) => Promise<void>; // NEW
  children?: React.ReactNode; // For sections if any
  // Props for section reordering and expansion (to be added later)
  expandedSections: Set<string>;
  onToggleExpandSection: (section: LessonSection) => void;
}> = ({ lesson, pathId, isExpanded, selectedItemId, onSelectItem, handleLessonHeaderClick, onReorderSections, expandedSections, onToggleExpandSection }) => {
  const { 
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: lesson.id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
    zIndex: isDragging ? 50 : undefined, // Lower zIndex than paths
    listStyle: 'none', // ensure li styles are clean
  };

  // Sensors for section DND context
  const sectionSensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates })
  );

  const handleDragEndSections = (event: DragEndEvent) => {
    const { active, over } = event;
    if (over && active.id !== over.id) {
      onReorderSections(lesson.id, active.id as string, over.id as string);
    }
  };

  return (
    <li ref={setNodeRef} style={style} className="py-0.5 rounded-md mb-0.5 list-none bg-background">
        <div className="flex items-center justify-between hover:bg-muted/30 rounded-t-md">
            <div className="flex items-center flex-grow">
                <button 
                    {...attributes} 
                    {...listeners} 
                    className="p-1.5 cursor-grab touch-none text-muted-foreground/80 hover:text-foreground"
                    aria-label="Drag to reorder lesson"
                >
                    <GripVertical size={16} />
                </button>
                <div 
                    className={`flex-grow text-sm cursor-pointer p-1.5 ${selectedItemId === lesson.id ? 'bg-accent text-accent-foreground font-medium' : 'hover:bg-muted/60'}`}
                    onClick={() => onSelectItem('lesson', lesson)}
                >
                    {lesson.title}
                </div>
            </div>
            <button 
                onClick={(e) => {
                    e.stopPropagation();
                    handleLessonHeaderClick(lesson);
                }}
                className="p-1 rounded hover:bg-muted-foreground/20 focus:outline-none mr-1.5"
                aria-label={isExpanded ? 'Collapse lesson' : 'Expand lesson'}
            >
                {isExpanded ? <ChevronDown size={16} /> : <ChevronRight size={16} />}
            </button>
        </div>
      {/* Placeholder for rendering sections if lesson is expanded */}
      {isExpanded && lesson.sections && lesson.sections.length > 0 && (
        <DndContext sensors={sectionSensors} collisionDetection={closestCenter} onDragEnd={handleDragEndSections}>
          <SortableContext items={lesson.sections.map(s => s.id)} strategy={verticalListSortingStrategy}>
            <ul className="pl-3 mt-1 space-y-0.5 border-l border-border ml-1">
              {lesson.sections.map((section) => (
                <SortableSectionItem
                  key={section.id}
                  section={section}
                  lessonId={lesson.id}
                  selectedItemId={selectedItemId}
                  onSelectItem={onSelectItem}
                />
              ))}
            </ul>
          </SortableContext>
        </DndContext>
      )}
      {isExpanded && (!lesson.sections || lesson.sections.length === 0) && (
          <p className="pl-5 pt-1 text-xs text-muted-foreground">No sections in this lesson yet, or still loading.</p>
      )}
    </li>
  );
};

// NEW: SortableItem component for Lesson Sections
const SortableSectionItem: React.FC<{
  section: LessonSection;
  lessonId: string;
  selectedItemId: string | null;
  onSelectItem: (type: string, itemData: LessonSection) => void;
}> = ({ section, lessonId, selectedItemId, onSelectItem }) => {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: section.id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
    zIndex: isDragging ? 25 : undefined, // Lower zIndex than lessons
    listStyle: 'none',
  };

  return (
    <li ref={setNodeRef} style={style} className="py-0.5 list-none rounded-md bg-background/80 hover:bg-muted/50 mb-0.5">
      <div className={`flex items-center text-xs cursor-pointer rounded ${selectedItemId === section.id ? 'bg-accent/70 text-accent-foreground font-medium' : ''}`}>
        <button
          {...attributes}
          {...listeners}
          className="p-1 cursor-grab touch-none text-muted-foreground/70 hover:text-foreground"
          aria-label="Drag to reorder section"
        >
          <GripVertical size={14} />
        </button>
        <div 
          className="flex-grow p-1.5"
          onClick={() => onSelectItem('section', section)}
        >
          <FileText size={14} className="inline-block mr-1.5 text-muted-foreground/60" />
          {section.title}
        </div>
      </div>
    </li>
  );
};

const StudioNavigationTree: React.FC<StudioNavigationTreeProps> = ({ 
  baseClass, 
  onSelectItem, 
  selectedItemId,
  onToggleExpandPath,
  onToggleExpandLesson, // This will be the main handler for lesson EXPANSION
  onReorderPaths,
  onReorderLessons, // This is the main handler for lesson REORDERING
  onReorderSections, // NEW: Main handler for section REORDERING
}) => {
  const [expandedPaths, setExpandedPaths] = useState<Set<string>>(new Set());
  const [expandedLessons, setExpandedLessons] = useState<Set<string>>(new Set());

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 10 } }), // Require more movement for path drag
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates })
  );

  if (!baseClass) {
    return <div className="p-4 text-muted-foreground">Loading navigation...</div>;
  }

  const handleBaseClassClick = () => {
    onSelectItem('baseclass', baseClass);
  };

  // NEW: Handler for Knowledge Base item click
  const handleKnowledgeBaseClick = () => {
    onSelectItem('knowledgebase', baseClass);
  };

  const handlePathToggleExpand = async (path: Path) => {
    const newExpandedPaths = new Set(expandedPaths);
    if (newExpandedPaths.has(path.id)) {
      newExpandedPaths.delete(path.id);
    } else {
      newExpandedPaths.add(path.id);
      if (!path.lessons || path.lessons.length === 0) { 
        await onToggleExpandPath(path.id); // Fetch lessons if not already present
      }
    }
    setExpandedPaths(newExpandedPaths);
  };

  // This is the central handler for toggling lesson expansion, passed to SortablePathItem
  const handleLessonToggleExpandOverall = async (lesson: Lesson) => {
    const newExpandedLessons = new Set(expandedLessons);
    if (newExpandedLessons.has(lesson.id)) {
      newExpandedLessons.delete(lesson.id);
    } else {
      newExpandedLessons.add(lesson.id);
      if (!lesson.sections || lesson.sections.length === 0) {
        await onToggleExpandLesson(lesson.id); // Fetch sections if not already present
      }
    }
    setExpandedLessons(newExpandedLessons);
  };

  const handleDragEndPaths = (event: DragEndEvent) => {
    const { active, over } = event;
    if (over && active.id !== over.id) {
      onReorderPaths(active.id as string, over.id as string);
    }
  };

  return (
    <div className="space-y-1 text-sm">
      {/* Base Class Item - Not sortable */}
      <div 
        onClick={handleBaseClassClick}
        className={`font-semibold text-lg p-3 cursor-pointer rounded-md transition-colors 
          ${selectedItemId === baseClass.id ? 'bg-primary text-primary-foreground' : 'hover:bg-muted'}`}
      >
        {baseClass.name} 
      </div>

      {/* NEW: Knowledge Base Item - Not sortable */}
      <div 
        onClick={handleKnowledgeBaseClick} 
        className={`flex items-center space-x-2 p-3 cursor-pointer rounded-md transition-colors 
          ${selectedItemId === baseClass.id && onSelectItem.toString().includes("'knowledgebase'") /* Crude check for KB selection, improve if selectedItem type is 'knowledgebase' */ 
            ? 'bg-primary/20 text-primary font-medium' 
            : 'hover:bg-muted'}`}
      >
        <InfoIcon size={18} className="text-muted-foreground" />
        <span>Knowledge Base</span>
      </div>

      {/* Paths List - Sortable */}
      {baseClass.paths && baseClass.paths.length > 0 && (
        <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEndPaths}>
          <SortableContext 
            items={baseClass.paths.map(p => p.id)} // Safe now due to the check above
            strategy={verticalListSortingStrategy}
          >
            <ul className="pl-1 mt-1 space-y-0 list-none">
              {baseClass.paths.map((path) => (
                  <SortablePathItem 
                    key={path.id} 
                    path={path} 
                    isExpanded={expandedPaths.has(path.id)}
                    selectedItemId={selectedItemId} // Ensure this is passed
                    onSelectItem={onSelectItem as (type: string, itemData: Path | Lesson | LessonSection) => void} // Ensure this is passed
                    handlePathHeaderClick={handlePathToggleExpand} // Ensure this is passed
                    lessons={path.lessons || []} // Ensure this is passed (already was)
                    onToggleExpandLesson={handleLessonToggleExpandOverall} // Ensure this is passed
                    onReorderLessons={onReorderLessons} // Ensure this is passed
                    onReorderSections={onReorderSections} // Ensure this is passed
                    expandedLessons={expandedLessons} // Ensure this is passed
                  />
              ))}
            </ul>
          </SortableContext>
        </DndContext>
      )}
      {(!baseClass.paths || baseClass.paths.length === 0) && (
        <p className="p-3 text-xs text-muted-foreground">No paths defined for this base class yet.</p>
      )}
    </div>
  );
};

export default StudioNavigationTree; 