'use client';

import React, { useState } from 'react';
import type { StudioBaseClass, Path, Lesson, LessonSection } from '@/types/lesson';
import { ChevronRight, ChevronDown, FileText, GripVertical, Info as InfoIcon, FoldVertical, UnfoldVertical, BookOpen } from 'lucide-react';
import { UpdatedContentWrapper } from '@/components/ui/content-update-indicator';
import { Button } from '@/components/ui/button';
import HoverInsertionWrapper from './HoverInsertionWrapper';
import InsertionModal, { InsertionFormData } from './InsertionModal';
import { DeleteConfirmationModal } from './DeleteConfirmationModal';

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
  selectedItemType?: string; // NEW: Add selectedItemType for better selection highlighting
  onToggleExpandPath: (pathId: string) => Promise<void>;
  onToggleExpandLesson: (lessonId: string) => Promise<void>;
  // NEW: Prop for reordering paths
  onReorderPaths: (activeId: string, overId: string) => Promise<void>; 
  // NEW: Prop for reordering lessons
  onReorderLessons: (pathId: string, activeLessonId: string, overLessonId: string) => Promise<void>;
  // NEW: Prop for reordering sections
  onReorderSections: (lessonId: string, activeSectionId: string, overSectionId: string) => Promise<void>;
  // NEW: Prop for recently updated items
  recentlyUpdatedItems?: Set<string>;
  // NEW: Props for insertion functionality
  onInsertPath?: (data: InsertionFormData, position: 'above' | 'below', referenceId?: string) => Promise<void>;
  onInsertLesson?: (data: InsertionFormData, position: 'above' | 'below', pathId: string, referenceId?: string) => Promise<void>;
  onInsertSection?: (data: InsertionFormData, position: 'above' | 'below', lessonId: string, referenceId?: string) => Promise<void>;
  // NEW: Props for deletion functionality
  onDeletePath?: (pathId: string) => Promise<void>;
  onDeleteLesson?: (lessonId: string) => Promise<void>;
  onDeleteSection?: (sectionId: string) => Promise<void>;
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
  recentlyUpdatedItems?: Set<string>; // NEW: For visual feedback
  // NEW: Props for insertion functionality
  onInsertPath?: (data: InsertionFormData, position: 'above' | 'below', referenceId?: string) => Promise<void>;
  onInsertLesson?: (data: InsertionFormData, position: 'above' | 'below', pathId: string, referenceId?: string) => Promise<void>;
  onInsertSection?: (data: InsertionFormData, position: 'above' | 'below', lessonId: string, referenceId?: string) => Promise<void>;
  // NEW: Props for deletion functionality
  onDeletePath?: (pathId: string) => Promise<void>;
  onDeleteLesson?: (lessonId: string) => Promise<void>;
  onDeleteSection?: (sectionId: string) => Promise<void>;
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
  expandedLessons,
  recentlyUpdatedItems,
  onInsertPath,
  onInsertLesson,
  onInsertSection,
  onDeletePath,
  onDeleteLesson,
  onDeleteSection
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
    useSensor(PointerSensor, { 
      activationConstraint: { 
        distance: 15, // Require more movement for path drag
        delay: 200, // Add more delay to ensure it's intentional
        tolerance: 5
      }
    }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates })
  );

  const handleDragEndLessons = (event: DragEndEvent) => {
    const { active, over } = event;
    if (over && active.id !== over.id) {
      onReorderLessons(path.id, active.id as string, over.id as string);
    }
  };

  const isRecentlyUpdated = recentlyUpdatedItems?.has(path.id) || false;

  const handleInsertPathAbove = () => {
    onInsertPath?.(
      { title: '', description: '' },
      'above',
      path.id
    );
  };

  const handleInsertPathBelow = () => {
    onInsertPath?.(
      { title: '', description: '' },
      'below',
      path.id
    );
  };

  const handleDeletePath = async () => {
    onDeletePath?.(path.id);
  };

  return (
    <UpdatedContentWrapper isUpdated={isRecentlyUpdated}>
      <HoverInsertionWrapper
        itemType="path"
        itemId={path.id}
        onInsertAbove={handleInsertPathAbove}
        onInsertBelow={handleInsertPathBelow}
        onDelete={handleDeletePath}
        disabled={!onInsertPath}
        canDelete={!!onDeletePath}
      >
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
                    recentlyUpdatedItems={recentlyUpdatedItems}
                    onInsertLesson={onInsertLesson}
                    onInsertSection={onInsertSection}
                    onDeleteLesson={onDeleteLesson}
                    onDeleteSection={onDeleteSection}
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
      </HoverInsertionWrapper>
    </UpdatedContentWrapper>
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
  recentlyUpdatedItems?: Set<string>; // NEW: For visual feedback
  // NEW: Props for insertion functionality
  onInsertLesson?: (data: InsertionFormData, position: 'above' | 'below', pathId: string, referenceId?: string) => Promise<void>;
  onInsertSection?: (data: InsertionFormData, position: 'above' | 'below', lessonId: string, referenceId?: string) => Promise<void>;
  // NEW: Props for deletion functionality
  onDeleteLesson?: (lessonId: string) => Promise<void>;
  onDeleteSection?: (sectionId: string) => Promise<void>;
}> = ({ lesson, pathId, isExpanded, selectedItemId, onSelectItem, handleLessonHeaderClick, onReorderSections, expandedSections, onToggleExpandSection, recentlyUpdatedItems, onInsertLesson, onInsertSection, onDeleteLesson, onDeleteSection }) => {
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
    useSensor(PointerSensor, { 
      activationConstraint: { 
        distance: 8, // Require movement before drag starts
        delay: 200, // Add more delay to ensure it's intentional
        tolerance: 5
      }
    }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates })
  );

  const handleDragEndSections = (event: DragEndEvent) => {
    const { active, over } = event;
    if (over && active.id !== over.id) {
      onReorderSections(lesson.id, active.id as string, over.id as string);
    }
  };

  const isRecentlyUpdated = recentlyUpdatedItems?.has(lesson.id) || false;

  const handleInsertLessonAbove = () => {
    onInsertLesson?.(
      { title: '', description: '' },
      'above',
      pathId,
      lesson.id
    );
  };

  const handleInsertLessonBelow = () => {
    onInsertLesson?.(
      { title: '', description: '' },
      'below',
      pathId,
      lesson.id
    );
  };

  const handleDeleteLesson = async () => {
    onDeleteLesson?.(lesson.id);
  };

  return (
    <UpdatedContentWrapper isUpdated={isRecentlyUpdated}>
      <HoverInsertionWrapper
        itemType="lesson"
        itemId={lesson.id}
        onInsertAbove={handleInsertLessonAbove}
        onInsertBelow={handleInsertLessonBelow}
        onDelete={handleDeleteLesson}
        disabled={!onInsertLesson}
        canDelete={!!onDeleteLesson}
      >
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
                    onInsertSection={onInsertSection}
                    onDeleteSection={onDeleteSection}
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
      </HoverInsertionWrapper>
    </UpdatedContentWrapper>
  );
};

// NEW: SortableItem component for Lesson Sections
const SortableSectionItem: React.FC<{
  section: LessonSection;
  lessonId: string;
  selectedItemId: string | null;
  onSelectItem: (type: string, itemData: LessonSection) => void;
  // NEW: Props for insertion functionality
  onInsertSection?: (data: InsertionFormData, position: 'above' | 'below', lessonId: string, referenceId?: string) => Promise<void>;
  // NEW: Props for deletion functionality
  onDeleteSection?: (sectionId: string) => Promise<void>;
}> = ({ section, lessonId, selectedItemId, onSelectItem, onInsertSection, onDeleteSection }) => {
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

  const handleInsertSectionAbove = () => {
    onInsertSection?.(
      { title: '', description: '' },
      'above',
      lessonId,
      section.id
    );
  };

  const handleInsertSectionBelow = () => {
    onInsertSection?.(
      { title: '', description: '' },
      'below',
      lessonId,
      section.id
    );
  };

  const handleDeleteSection = async () => {
    onDeleteSection?.(section.id);
  };

  return (
    <HoverInsertionWrapper
      itemType="section"
      itemId={section.id}
      onInsertAbove={handleInsertSectionAbove}
      onInsertBelow={handleInsertSectionBelow}
      onDelete={handleDeleteSection}
      disabled={!onInsertSection}
      canDelete={!!onDeleteSection}
    >
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
    </HoverInsertionWrapper>
  );
};

const StudioNavigationTree: React.FC<StudioNavigationTreeProps> = ({ 
  baseClass, 
  onSelectItem, 
  selectedItemId,
  selectedItemType,
  onToggleExpandPath,
  onToggleExpandLesson, // This will be the main handler for lesson EXPANSION
  onReorderPaths,
  onReorderLessons, // This is the main handler for lesson REORDERING
  onReorderSections, // NEW: Main handler for section REORDERING
  recentlyUpdatedItems,
  onInsertPath,
  onInsertLesson,
  onInsertSection,
  onDeletePath,
  onDeleteLesson,
  onDeleteSection,
}) => {
  const [expandedPaths, setExpandedPaths] = useState<Set<string>>(new Set());
  const [expandedLessons, setExpandedLessons] = useState<Set<string>>(new Set());
  
  // NEW: Modal state for insertion
  const [insertionModal, setInsertionModal] = useState<{
    isOpen: boolean;
    itemType: 'path' | 'lesson' | 'section';
    position: 'above' | 'below';
    referenceId?: string;
    pathId?: string;
    lessonId?: string;
  }>({
    isOpen: false,
    itemType: 'path',
    position: 'above'
  });

  // NEW: Modal state for deletion confirmation
  const [deleteModal, setDeleteModal] = useState<{
    isOpen: boolean;
    itemType: 'path' | 'lesson' | 'section';
    itemId: string;
    itemTitle: string;
    dependentItems?: {
      lessons?: number;
      sections?: number;
    };
  }>({
    isOpen: false,
    itemType: 'path',
    itemId: '',
    itemTitle: ''
  });

  const [isDeleting, setIsDeleting] = useState(false);

  const sensors = useSensors(
    useSensor(PointerSensor, { 
      activationConstraint: { 
        distance: 10, // Require movement before drag starts
        delay: 200, // Add more delay to ensure it's intentional
        tolerance: 5
      }
    }),
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

  // NEW: Handler for Assessments item click
  const handleAssessmentsClick = () => {
    onSelectItem('assessments', baseClass);
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

  // Collapse all and expand all handlers
  const handleCollapseAll = () => {
    setExpandedPaths(new Set());
    setExpandedLessons(new Set());
  };

  const handleExpandAll = async () => {
    if (!baseClass.paths) return;
    
    // Expand all paths
    const allPathIds = new Set(baseClass.paths.map(path => path.id));
    setExpandedPaths(allPathIds);
    
    // Fetch lessons for paths that don't have them yet and expand all lessons
    const allLessonIds = new Set<string>();
    
    for (const path of baseClass.paths) {
      // Fetch lessons if they don't exist
      if (!path.lessons || path.lessons.length === 0) {
        await onToggleExpandPath(path.id);
      }
      
      // Add all lesson IDs to be expanded
      if (path.lessons) {
        path.lessons.forEach(lesson => {
          allLessonIds.add(lesson.id);
          // Fetch sections if they don't exist
          if (!lesson.sections || lesson.sections.length === 0) {
            onToggleExpandLesson(lesson.id);
          }
        });
      }
    }
    
    setExpandedLessons(allLessonIds);
  };

  // Determine if any items are currently expanded
  const getMostlyExpandedState = () => {
    if (!baseClass.paths || baseClass.paths.length === 0) return false;
    
    // Return true if ANY paths or lessons are expanded
    return expandedPaths.size > 0 || expandedLessons.size > 0;
  };

  // Toggle between expand all and collapse all
  const handleToggleExpandCollapse = async () => {
    const isMostlyExpanded = getMostlyExpandedState();
    
    if (isMostlyExpanded) {
      handleCollapseAll();
    } else {
      await handleExpandAll();
    }
  };

  // NEW: Insertion handlers that open the modal
  const handleInsertPath = async (data: InsertionFormData, position: 'above' | 'below', referenceId?: string) => {
    setInsertionModal({
      isOpen: true,
      itemType: 'path',
      position,
      referenceId
    });
  };

  const handleInsertLesson = async (data: InsertionFormData, position: 'above' | 'below', pathId: string, referenceId?: string) => {
    setInsertionModal({
      isOpen: true,
      itemType: 'lesson',
      position,
      referenceId,
      pathId
    });
  };

  const handleInsertSection = async (data: InsertionFormData, position: 'above' | 'below', lessonId: string, referenceId?: string) => {
    setInsertionModal({
      isOpen: true,
      itemType: 'section',
      position,
      referenceId,
      lessonId
    });
  };

  // NEW: Handle modal submission
  const handleModalSubmit = async (data: InsertionFormData) => {
    const { itemType, position, referenceId, pathId, lessonId } = insertionModal;
    
    try {
      switch (itemType) {
        case 'path':
          await onInsertPath?.(data, position, referenceId);
          break;
        case 'lesson':
          if (pathId) {
            await onInsertLesson?.(data, position, pathId, referenceId);
          }
          break;
        case 'section':
          if (lessonId) {
            await onInsertSection?.(data, position, lessonId, referenceId);
          }
          break;
      }
    } catch (error) {
      console.error('Error inserting item:', error);
      throw error; // Re-throw to let modal handle the error
    }
  };

  // NEW: Delete handlers that open the confirmation modal
  const handleDeletePath = async (pathId: string) => {
    const path = baseClass?.paths?.find(p => p.id === pathId);
    if (!path) return;

    const totalLessons = path.lessons?.length || 0;
    const totalSections = path.lessons?.reduce((acc, lesson) => acc + (lesson.sections?.length || 0), 0) || 0;

    setDeleteModal({
      isOpen: true,
      itemType: 'path',
      itemId: pathId,
      itemTitle: path.title,
      dependentItems: {
        lessons: totalLessons,
        sections: totalSections
      }
    });
  };

  const handleDeleteLesson = async (lessonId: string) => {
    const lesson = baseClass?.paths?.flatMap(p => p.lessons || []).find(l => l.id === lessonId);
    if (!lesson) return;

    const totalSections = lesson.sections?.length || 0;

    setDeleteModal({
      isOpen: true,
      itemType: 'lesson',
      itemId: lessonId,
      itemTitle: lesson.title,
      dependentItems: {
        sections: totalSections
      }
    });
  };

  const handleDeleteSection = async (sectionId: string) => {
    const section = baseClass?.paths?.flatMap(p => p.lessons || []).flatMap(l => l.sections || []).find(s => s.id === sectionId);
    if (!section) return;

    setDeleteModal({
      isOpen: true,
      itemType: 'section',
      itemId: sectionId,
      itemTitle: section.title
    });
  };

  // NEW: Handle delete confirmation
  const handleDeleteConfirm = async () => {
    const { itemType, itemId } = deleteModal;
    
    setIsDeleting(true);
    try {
      switch (itemType) {
        case 'path':
          await onDeletePath?.(itemId);
          break;
        case 'lesson':
          await onDeleteLesson?.(itemId);
          break;
        case 'section':
          await onDeleteSection?.(itemId);
          break;
      }
      
      setDeleteModal({ isOpen: false, itemType: 'path', itemId: '', itemTitle: '' });
    } catch (error) {
      console.error('Error deleting item:', error);
      // Error handling is done in the parent component
    } finally {
      setIsDeleting(false);
    }
  };

  return (
    <div className="space-y-1 text-sm">
      {/* Base Class Item - Not sortable */}
      <div 
        onClick={handleBaseClassClick}
        className={`font-semibold text-lg p-3 cursor-pointer rounded-md transition-colors 
          ${selectedItemType === 'baseclass' && selectedItemId === baseClass.id ? 'bg-primary text-primary-foreground' : 'hover:bg-muted'}`}
      >
        {baseClass.name} 
      </div>

      {/* NEW: Knowledge Base Item - Not sortable */}
      <div 
        onClick={handleKnowledgeBaseClick} 
        className={`flex items-center space-x-2 p-3 cursor-pointer rounded-md transition-colors 
          ${selectedItemType === 'knowledgebase' ? 'bg-primary/20 text-primary font-medium' : 'hover:bg-muted'}`}
      >
        <InfoIcon size={18} className="text-muted-foreground" />
        <span>Knowledge Base</span>
      </div>

      {/* NEW: Assessments & Questions Item - Not sortable */}
      <div 
        onClick={handleAssessmentsClick} 
        className={`flex items-center space-x-2 p-3 cursor-pointer rounded-md transition-colors 
          ${selectedItemType === 'assessments' ? 'bg-primary/20 text-primary font-medium' : 'hover:bg-muted'}`}
      >
        <BookOpen size={18} className="text-muted-foreground" />
        <span>Assessments & Questions</span>
      </div>

      {/* Collapse/Expand All Controls */}
      {baseClass.paths && baseClass.paths.length > 0 && (
        <div className="flex items-center justify-between px-3 py-2">
          <span className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
            Learning Paths
          </span>
          <div className="flex gap-1">
            <Button
              variant="ghost"
              size="sm"
              onClick={handleToggleExpandCollapse}
              className="h-7 w-7 p-0 hover:bg-muted/80"
              title={getMostlyExpandedState() ? "Collapse All Paths" : "Expand All Paths"}
            >
              {getMostlyExpandedState() ? <FoldVertical size={14} className="text-muted-foreground" /> : <UnfoldVertical size={14} className="text-muted-foreground" />}
            </Button>
          </div>
        </div>
      )}

      {/* Paths List - Sortable */}
      {baseClass.paths && baseClass.paths.length > 0 && (
        <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEndPaths}>
          <SortableContext items={baseClass.paths.map(p => p.id)} strategy={verticalListSortingStrategy}>
            <ul className="space-y-1">
              {baseClass.paths.map((path) => (
                <SortablePathItem
                  key={path.id}
                  path={path}
                  isExpanded={expandedPaths.has(path.id)}
                  selectedItemId={selectedItemId}
                  onSelectItem={onSelectItem}
                  handlePathHeaderClick={handlePathToggleExpand}
                  lessons={path.lessons || []} // Ensure lessons array is never undefined
                  onToggleExpandLesson={handleLessonToggleExpandOverall} // Pass the overall lesson toggle handler
                  onReorderLessons={onReorderLessons} // Ensure this is passed
                  onReorderSections={onReorderSections} // Ensure this is passed
                  expandedLessons={expandedLessons} // Ensure this is passed
                  recentlyUpdatedItems={recentlyUpdatedItems}
                  onInsertPath={handleInsertPath}
                  onInsertLesson={handleInsertLesson}
                  onInsertSection={handleInsertSection}
                  onDeletePath={handleDeletePath}
                  onDeleteLesson={handleDeleteLesson}
                  onDeleteSection={handleDeleteSection}
                />
              ))}
            </ul>
          </SortableContext>
        </DndContext>
      )}
      {(!baseClass.paths || baseClass.paths.length === 0) && (
        <p className="p-3 text-xs text-muted-foreground">No paths defined for this base class yet.</p>
      )}

      {/* Insertion Modal */}
      <InsertionModal
        isOpen={insertionModal.isOpen}
        onClose={() => setInsertionModal(prev => ({ ...prev, isOpen: false }))}
        itemType={insertionModal.itemType}
        position={insertionModal.position}
        onSubmit={handleModalSubmit}
      />

      <DeleteConfirmationModal
        isOpen={deleteModal.isOpen}
        onClose={() => setDeleteModal(prev => ({ ...prev, isOpen: false }))}
        onConfirm={handleDeleteConfirm}
        itemType={deleteModal.itemType}
        itemTitle={deleteModal.itemTitle}
        isDeleting={isDeleting}
        dependentItems={deleteModal.dependentItems}
      />
    </div>
  );
};

export default StudioNavigationTree; 