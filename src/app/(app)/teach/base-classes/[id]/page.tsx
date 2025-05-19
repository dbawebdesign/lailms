'use client';

import React, { useEffect, useState, use } from 'react';
import { supabase } from '@/utils/supabase/browser'; // Corrected Supabase client import path
import type { StudioBaseClass, Path, Lesson, LessonSection } from '@/types/lesson';
import { Loader2, Menu } from 'lucide-react'; // For loading indicator and menu icon
import StudioNavigationTree from '@/components/teach/studio/StudioNavigationTree';
import BaseClassEditor from '@/components/teach/studio/editors/BaseClassEditor'; // Added import
import PathEditor from '@/components/teach/studio/editors/PathEditor'; // Added import
import LessonEditor from '@/components/teach/studio/editors/LessonEditor'; // Added import
import LessonSectionEditor from '@/components/teach/studio/editors/LessonSectionEditor'; // Added import

// NEW: DND Kit imports
import { arrayMove } from '@dnd-kit/sortable';
import type { Path as DndPath } from '@/types/lesson'; // Use a specific type for DND if needed, or cast

// Define the shape of the params object if it were resolved
interface ResolvedPageParams {
  id: string;
}

interface BaseClassStudioPageProps {
  // The props received by the component. As per Next.js warning, this `params` might be a Promise at runtime.
  params: ResolvedPageParams | Promise<ResolvedPageParams>; 
}

const BaseClassStudioPage: React.FC<BaseClassStudioPageProps> = (props) => {
  let resolvedParamsSignal: ResolvedPageParams;
  // Check if props.params is a promise (duck typing for thenable)
  if (props.params && typeof (props.params as Promise<ResolvedPageParams>)?.then === 'function') {
    resolvedParamsSignal = use(props.params as Promise<ResolvedPageParams>);
  } else {
    resolvedParamsSignal = props.params as ResolvedPageParams;
  }
  const { id: baseClassId } = resolvedParamsSignal;

  const [studioBaseClass, setStudioBaseClass] = useState<StudioBaseClass | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  
  // MODIFIED: selectedItem state to include title and data
  const [selectedItem, setSelectedItem] = useState<{ type: string; id: string | null; title: string | null; data: StudioBaseClass | Path | Lesson | LessonSection | null }>({ type: 'baseclass', id: baseClassId, title: 'Loading...', data: null });

  // NEW: State to track loading of individual path's lessons
  const [isLoadingLessons, setIsLoadingLessons] = useState<Record<string, boolean>>({});

  // NEW: State to track loading of individual lesson's sections
  const [isLoadingSections, setIsLoadingSections] = useState<Record<string, boolean>>({});

  const [isNavOpen, setIsNavOpen] = useState(false); // State for mobile navigation

  useEffect(() => {
    if (!baseClassId) {
      setError('Base Class ID is missing.');
      setIsLoading(false);
      return;
    }

    const fetchData = async () => {
      setIsLoading(true);
      setError(null);
      
      try {
        // Fetch BaseClass details
        const { data: baseClassData, error: baseClassError } = await supabase
          .from('base_classes')
          .select('*')
          .eq('id', baseClassId)
          .single();
          
        if (baseClassError) throw baseClassError;
        if (!baseClassData) throw new Error('Base class not found.');

        // Fetch associated Paths
        const { data: pathsData, error: pathsError } = await supabase
          .from('paths')
          .select('*')
          .eq('base_class_id', baseClassData.id)
          .order('order_index', { ascending: true }); // Assuming paths have an order_index
        
        if (pathsError) throw pathsError;

        const initialBaseClassData = { ...baseClassData, paths: pathsData?.map(p => ({...p, lessons: []})) || [] };
        setStudioBaseClass(initialBaseClassData);
        // MODIFIED: Set initial selectedItem title and data
        setSelectedItem({ type: 'baseclass', id: baseClassData.id, title: baseClassData.name, data: initialBaseClassData });

      } catch (e: any) {
        console.error('Error fetching base class studio data:', e);
        setError(e.message || 'Failed to load data.');
        // MODIFIED: Update title and clear data on error
        setSelectedItem(prev => ({ ...prev, title: 'Error Loading', data: null }));
      } finally {
        setIsLoading(false);
      }
    };
    
    fetchData();
  }, [baseClassId]);

  // NEW: Function to fetch lessons for a specific path
  const fetchLessonsForPath = async (pathId: string) => {
    if (!studioBaseClass) return;

    // Check if lessons for this path are already fetched and present
    const pathExists = studioBaseClass.paths?.find(p => p.id === pathId);
    if (pathExists && pathExists.lessons && pathExists.lessons.length > 0 && pathExists.lessons.every(l => l.sections !== undefined)) return;

    setIsLoadingLessons(prev => ({ ...prev, [pathId]: true }));
    try {
      const { data: lessonsData, error: lessonsError } = await supabase
        .from('lessons')
        .select('*')
        .eq('path_id', pathId)
        .order('order_index', { ascending: true });

      if (lessonsError) throw lessonsError;

      setStudioBaseClass(prevBaseClass => {
        if (!prevBaseClass || !prevBaseClass.paths) return prevBaseClass;
        return {
          ...prevBaseClass,
          paths: prevBaseClass.paths.map(p => 
            p.id === pathId ? { ...p, lessons: lessonsData?.map(l => ({...l, sections: []})) || [] } : p
          ),
        };
      });
    } catch (e: any) {
      console.error(`Error fetching lessons for path ${pathId}:`, e);
      // Optionally set a specific error for this path or a general lesson loading error
      setError(prevError => prevError ? `${prevError}\nFailed to load lessons for path ${pathId}.` : `Failed to load lessons for path ${pathId}.`);
    } finally {
      setIsLoadingLessons(prev => ({ ...prev, [pathId]: false }));
    }
  };

  // NEW: Function to fetch sections for a specific lesson
  const fetchSectionsForLesson = async (lessonId: string) => {
    if (!studioBaseClass) return;

    // Check if sections for this lesson are already fetched (deep check needed)
    let lessonExists = false;
    studioBaseClass.paths?.forEach(p => {
        const l = p.lessons?.find(les => les.id === lessonId);
        if (l && l.sections && l.sections.length > 0) lessonExists = true;
    });
    if (lessonExists) { /* console.log(`Sections for lesson ${lessonId} already loaded.`); */ return; }

    setIsLoadingSections(prev => ({ ...prev, [lessonId]: true }));
    try {
      const { data: sectionsData, error: sectionsError } = await supabase
        .from('lesson_sections')
        .select('*')
        .eq('lesson_id', lessonId)
        .order('order_index', { ascending: true });

      if (sectionsError) throw sectionsError;

      setStudioBaseClass(prevBaseClass => {
        if (!prevBaseClass || !prevBaseClass.paths) return prevBaseClass;
        return {
          ...prevBaseClass,
          paths: prevBaseClass.paths.map(p => ({
            ...p,
            lessons: p.lessons?.map(l => 
              l.id === lessonId ? { ...l, sections: sectionsData || [] } : l
            ) || [],
          })),
        };
      });
    } catch (e: any) {
      console.error(`Error fetching sections for lesson ${lessonId}:`, e);
      setError(prevError => prevError ? `${prevError}\nFailed to load sections for lesson ${lessonId}.` : `Failed to load sections for lesson ${lessonId}.`);
    } finally {
      setIsLoadingSections(prev => ({ ...prev, [lessonId]: false }));
    }
  };
  
  if (isLoading) {
    return (
      <div className="flex flex-col items-center justify-center h-screen">
        <Loader2 className="h-12 w-12 animate-spin text-primary mb-4" />
        <p className="text-lg text-muted-foreground">Loading Base Class Studio...</p>
      </div>
    );
  }
  
  if (error) {
    return (
      <div className="container mx-auto p-6 text-center">
        <h2 className="text-2xl font-semibold text-destructive mb-4">Error</h2>
        <p className="text-destructive-foreground bg-destructive/10 p-4 rounded-md">{error}</p>
        {/* TODO: Add a button to go back or retry */}
        </div>
    );
  }

  if (!studioBaseClass) {
    return (
      <div className="container mx-auto p-6 text-center">
        <p className="text-xl text-muted-foreground">Base Class not found.</p>
      </div>
    );
  }
  
  // MODIFIED: handleSelectItem to include data
  const handleSelectItem = (type: string, itemData: StudioBaseClass | Path | Lesson | LessonSection) => {
    if (!itemData) {
      console.warn('handleSelectItem called with null itemData for type:', type);
      setSelectedItem({ type, id: null, title: 'Error: No data', data: null });
      return;
    }
    // All items should have an id and name/title. For sections, 'title' might be section_title or similar.
    // We'll need a consistent way to get a display 'title' for the header if itemData.title is not standard.
    const displayTitle = (itemData as any).name || (itemData as any).title || (itemData as any).section_title || 'Untitled';
    setSelectedItem({ type, id: itemData.id, title: displayTitle, data: itemData });
    // console.log('Selected:', type, itemData.id, displayTitle, itemData);
  };

  // NEW: Placeholder save function for BaseClassEditor
  const handleSaveBaseClass = async (updatedData: Partial<StudioBaseClass>) => {
    console.log('Saving BaseClass:', updatedData);
    if (!selectedItem || selectedItem.type !== 'baseclass' || !selectedItem.data) return;

    // Optimistic update example (optional)
    // setStudioBaseClass(prev => prev ? { ...prev, ...updatedData } : null);
    // setSelectedItem(prev => ({ ...prev, data: { ...prev.data, ...updatedData } as StudioBaseClass, title: updatedData.name || prev.title }));

    // Actual save logic here (e.g., API call)
    try {
      const { error: updateError } = await supabase
        .from('base_classes')
        .update(updatedData) // Ensure updatedData only contains fields present in base_classes table
        .eq('id', selectedItem.data.id);

      if (updateError) throw updateError;

      // Re-fetch or update state more robustly
      setStudioBaseClass(prev => prev ? { ...prev, ...updatedData } as StudioBaseClass : null);
      setSelectedItem(prev => {
        const newTitle = updatedData.name || prev.title;
        const newData = prev.data ? { ...prev.data, ...updatedData } : null;
        return { ...prev, data: newData as StudioBaseClass, title: newTitle };
      });
      alert('Base Class saved successfully!'); // Replace with a proper toast notification
    } catch (e: any) {
      console.error('Failed to save BaseClass:', e);
      setError(`Failed to save BaseClass: ${e.message}`);
      // Potentially revert optimistic update here
      alert('Failed to save Base Class.'); // Replace with a proper toast notification
    }
  };

  // NEW: Placeholder save function for PathEditor
  const handleSavePath = async (updatedData: Partial<Path>) => {
    console.log('Saving Path:', updatedData);
    if (!selectedItem || selectedItem.type !== 'path' || !selectedItem.data) return;

    // Actual save logic here (e.g., API call to update the path)
    try {
      const { error: updateError } = await supabase
        .from('paths')
        .update({ title: updatedData.title, description: updatedData.description }) // Only update allowed fields
        .eq('id', selectedItem.data.id);

      if (updateError) throw updateError;

      // Update local state to reflect changes
      setStudioBaseClass(prevBaseClass => {
        if (!prevBaseClass || !prevBaseClass.paths) return prevBaseClass;
        return {
          ...prevBaseClass,
          paths: prevBaseClass.paths.map(p => 
            p.id === updatedData.id ? { ...p, ...updatedData } : p
          ),
        };
      });
      setSelectedItem(prev => {
        const newTitle = updatedData.title || prev.title;
        const newData = prev.data ? { ...prev.data, ...updatedData } : null;
        return { ...prev, data: newData as Path, title: newTitle };
      });

      alert('Path saved successfully!'); // Replace with a proper toast notification
      } catch (e: any) {
      console.error('Failed to save Path:', e);
      setError(`Failed to save Path: ${e.message}`);
      alert('Failed to save Path.'); // Replace with a proper toast notification
    }
  };

  // NEW: Placeholder save function for LessonEditor
  const handleSaveLesson = async (updatedData: Partial<Lesson>) => {
    console.log('Saving Lesson:', updatedData);
    if (!selectedItem || selectedItem.type !== 'lesson' || !selectedItem.data) return;

    try {
      const { error: updateError } = await supabase
        .from('lessons')
        .update({ title: updatedData.title, description: updatedData.description }) // Add other updatable fields
        .eq('id', selectedItem.data.id);

      if (updateError) throw updateError;

      // Update local state
      setStudioBaseClass(prevBaseClass => {
        if (!prevBaseClass || !prevBaseClass.paths) return prevBaseClass;
        return {
          ...prevBaseClass,
          paths: prevBaseClass.paths.map(p => ({
            ...p,
            lessons: p.lessons?.map(l => 
              l.id === updatedData.id ? { ...l, ...updatedData } : l
            ) || [],
          })),
        };
      });
      setSelectedItem(prev => {
        const newTitle = updatedData.title || prev.title;
        const newData = prev.data ? { ...prev.data, ...updatedData } : null;
        return { ...prev, data: newData as Lesson, title: newTitle };
      });

      alert('Lesson saved successfully!');
    } catch (e: any) {
      console.error('Failed to save Lesson:', e);
      setError(`Failed to save Lesson: ${e.message}`);
      alert('Failed to save Lesson.');
    }
  };

  // NEW: Placeholder save function for LessonSectionEditor
  const handleSaveLessonSection = async (updatedData: Partial<LessonSection>) => {
    console.log('Saving Lesson Section:', updatedData);
    if (!selectedItem || selectedItem.type !== 'section' || !selectedItem.data) return;

    try {
      const { error: updateError } = await supabase
        .from('lesson_sections')
        .update({ 
          title: updatedData.title, 
          content: updatedData.content, 
          section_type: updatedData.section_type 
          // Add other updatable fields
        })
        .eq('id', selectedItem.data.id);

      if (updateError) throw updateError;

      // Update local state
      setStudioBaseClass(prevBaseClass => {
        if (!prevBaseClass || !prevBaseClass.paths) return prevBaseClass;
        return {
          ...prevBaseClass,
          paths: prevBaseClass.paths.map(p => ({
            ...p,
            lessons: p.lessons?.map(l => ({
              ...l,
              sections: l.sections?.map(s => 
                s.id === updatedData.id ? { ...s, ...updatedData } : s
              ) || [],
            })) || [],
          })),
        };
      });
      setSelectedItem(prev => {
        const newTitle = updatedData.title || prev.title;
        const newData = prev.data ? { ...prev.data, ...updatedData } : null;
        return { ...prev, data: newData as LessonSection, title: newTitle };
      });

      alert('Lesson Section saved successfully!');
    } catch (e: any) {
      console.error('Failed to save Lesson Section:', e);
      setError(`Failed to save Lesson Section: ${e.message}`);
      alert('Failed to save Lesson Section.');
    }
  };

  // NEW: Handler for reordering paths
  const handleReorderPaths = async (activeId: string, overId: string) => {
    if (!studioBaseClass || !studioBaseClass.paths) return;
    const currentBaseClassId = studioBaseClass.id; // Parent ID for paths

    const oldPaths = studioBaseClass.paths as DndPath[];
    const oldIndex = oldPaths.findIndex((p) => p.id === activeId);
    const newIndex = oldPaths.findIndex((p) => p.id === overId);

    if (oldIndex === -1 || newIndex === -1 || oldIndex === newIndex) return;

    const newPaths = arrayMove(oldPaths, oldIndex, newIndex);

    setStudioBaseClass((prev) => {
      if (!prev) return null;
      return { ...prev, paths: newPaths as Path[] };
    });

    try {
      const orderedIds = newPaths.map((p: DndPath) => p.id);
      const response = await fetch('/api/teach/reorder-items', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          itemType: 'path', 
          orderedIds, 
          parentId: currentBaseClassId // Pass baseClassId as parentId for paths
        }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to reorder paths on server');
      }
    } catch (e: any) {
      console.error('Failed to save path reorder:', e);
      setStudioBaseClass((prev) => {
        if (!prev) return null;
        return { ...prev, paths: oldPaths as Path[] };
      });
      setError(`Failed to save path order: ${e.message}`);
    }
  };

  // NEW: Handler for reordering lessons within a path
  const handleReorderLessons = async (pathId: string, activeLessonId: string, overLessonId: string) => {
    if (!studioBaseClass || !studioBaseClass.paths) return;

    const pathIndex = studioBaseClass.paths.findIndex(p => p.id === pathId);
    if (pathIndex === -1 || !studioBaseClass.paths[pathIndex].lessons) return;

    const oldLessons = studioBaseClass.paths[pathIndex].lessons as Lesson[];
    const oldLessonIndex = oldLessons.findIndex(l => l.id === activeLessonId);
    const newLessonIndex = oldLessons.findIndex(l => l.id === overLessonId);

    if (oldLessonIndex === -1 || newLessonIndex === -1 || oldLessonIndex === newLessonIndex) return;

    const newLessons = arrayMove(oldLessons, oldLessonIndex, newLessonIndex);

    setStudioBaseClass(prev => {
      if (!prev || !prev.paths) return null;
      const newPaths = [...prev.paths];
      if (newPaths[pathIndex]) {
        newPaths[pathIndex] = { ...newPaths[pathIndex], lessons: newLessons as Lesson[] };
      }
      return { ...prev, paths: newPaths };
    });

    try {
      const orderedLessonIds = newLessons.map((l: Lesson) => l.id);
      const response = await fetch('/api/teach/reorder-items', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          itemType: 'lesson', 
          orderedIds: orderedLessonIds, 
          parentId: pathId // Pass pathId as parentId for lessons
        }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to reorder lessons on server');
      }
    } catch (e: any) {
      console.error('Failed to save lesson reorder:', e);
      setStudioBaseClass(prev => {
        if (!prev || !prev.paths) return null;
        const revertedPaths = [...prev.paths];
        if (revertedPaths[pathIndex]) {
            revertedPaths[pathIndex] = { ...revertedPaths[pathIndex], lessons: oldLessons as Lesson[] };
        }
        return { ...prev, paths: revertedPaths };
      });
      setError(`Failed to save lesson order for path ${pathId}: ${e.message}`);
    }
  };

  // NEW: Handler for reordering sections within a lesson
  const handleReorderSections = async (lessonId: string, activeSectionId: string, overSectionId: string) => {
    if (!studioBaseClass || !studioBaseClass.paths) return;

    let pathIndex = -1;
    let lessonIndex = -1;
    let oldSections: LessonSection[] = [];

    // Find the path and lesson containing the sections
    for (let i = 0; i < studioBaseClass.paths.length; i++) {
      const lIdx = studioBaseClass.paths[i].lessons?.findIndex(l => l.id === lessonId) ?? -1;
      if (lIdx !== -1) {
        pathIndex = i;
        lessonIndex = lIdx;
        oldSections = studioBaseClass.paths[i].lessons?.[lIdx]?.sections || [];
        break;
      }
    }

    if (pathIndex === -1 || lessonIndex === -1 || !oldSections || oldSections.length === 0) return; // Added check for empty oldSections

    const oldSectionIndex = oldSections.findIndex(s => s.id === activeSectionId);
    const newSectionIndex = oldSections.findIndex(s => s.id === overSectionId);

    if (oldSectionIndex === -1 || newSectionIndex === -1 || oldSectionIndex === newSectionIndex) return;

    const newSections = arrayMove(oldSections, oldSectionIndex, newSectionIndex);

    // Optimistic update
    setStudioBaseClass(prev => {
      if (!prev || !prev.paths) return null;
      const newPaths = prev.paths.map(p => ({
        ...p,
        lessons: p.lessons?.map(l => {
          if (l.id === lessonId) {
            return { ...l, sections: newSections as LessonSection[] };
          }
          return l;
        }) || [],
      }));
      return { ...prev, paths: newPaths };
    });

    try {
      const orderedSectionIds = newSections.map((s: LessonSection) => s.id);
      const response = await fetch('/api/teach/reorder-items', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          itemType: 'section',
          orderedIds: orderedSectionIds,
          parentId: lessonId, // Pass lessonId as parentId for sections
        }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to reorder sections on server');
      }
    } catch (e: any) {
      console.error('Failed to save section reorder:', e);
      // Revert optimistic update on error
      setStudioBaseClass(prev => {
        if (!prev || !prev.paths) return null;
         const revertedPaths = prev.paths.map(p => ({
            ...p,
            lessons: p.lessons?.map(l => {
              if (l.id === lessonId) {
                return { ...l, sections: oldSections as LessonSection[] }; // Revert to oldSections
              }
              return l;
            }) || [],
          }));
        return { ...prev, paths: revertedPaths };
      });
      setError(`Failed to save section order for lesson ${lessonId}: ${e.message}`);
    }
  };

  const renderEditor = () => {
    if (!selectedItem || !selectedItem.data) {
      if (selectedItem.type === 'baseclass' && studioBaseClass) {
        return <BaseClassEditor baseClass={studioBaseClass as StudioBaseClass} onSave={handleSaveBaseClass} />;
      } 
      return <div className="text-center p-6 text-muted-foreground">Select an item from the navigation tree to edit.</div>;
    }

    switch (selectedItem.type) {
      case 'baseclass':
        return <BaseClassEditor baseClass={selectedItem.data as StudioBaseClass} onSave={handleSaveBaseClass} />;
      case 'path':
        return <PathEditor path={selectedItem.data as Path} onSave={handleSavePath} />;
      case 'lesson':
        return <LessonEditor lesson={selectedItem.data as Lesson} onSave={handleSaveLesson} />;
      case 'section':
        return <LessonSectionEditor section={selectedItem.data as LessonSection} onSave={handleSaveLessonSection} />;
      default:
        return <div className="text-center p-6 text-muted-foreground">Unknown item type selected.</div>;
    }
  };

  return (
    <div className="flex flex-col md:flex-row h-screen bg-background">
      {/* Mobile Header Bar: Nav Toggle Button & Title */}
      <div className="md:hidden p-4 border-b border-border flex items-center space-x-3">
        <button 
          onClick={() => setIsNavOpen(!isNavOpen)} 
          className="p-2 rounded-md hover:bg-accent focus:outline-none focus:ring-2 focus:ring-ring flex-shrink-0"
        >
          <Menu className="h-6 w-6" />
          <span className="sr-only">Toggle Navigation</span>
        </button>
        <h2 className="text-lg font-semibold text-foreground truncate">
          Class Structure Nav
        </h2>
      </div>

      {/* Navigation Tree Panel */}
      <div 
        className={`
          ${isNavOpen ? 'block' : 'hidden'} md:block 
          w-full md:w-[300px] lg:w-[350px] xl:w-[400px] 
          border-b md:border-b-0 md:border-r border-border 
          p-4 overflow-y-auto 
          flex-shrink-0 
          h-auto md:h-screen
        `}
      >
        {studioBaseClass && (
          <StudioNavigationTree 
            baseClass={studioBaseClass} 
            onSelectItem={(type, itemData) => {
              handleSelectItem(type, itemData);
              if (window.innerWidth < 768) { // md breakpoint in Tailwind is usually 768px
                setIsNavOpen(false); // Close nav on item selection on mobile
              }
            }}
            selectedItemId={selectedItem.id}
            onToggleExpandPath={fetchLessonsForPath}
            onToggleExpandLesson={fetchSectionsForLesson}
            onReorderPaths={handleReorderPaths}
            onReorderLessons={handleReorderLessons}
            onReorderSections={handleReorderSections}
          />
        )}
      </div>

      {/* Main Content Editor Area */}
      {/* Takes remaining space, ensures it's visible even if nav is open on mobile (might be an issue if nav is not an overlay) */}
      {/* For true mobile UX, nav might be an overlay. This stacks them for now. */}
      <main 
        className={`
          flex-1 p-6 overflow-auto 
          ${(isNavOpen && window.innerWidth < 768) ? 'hidden' : 'block'} md:block
        `}
      >
        <div className="mb-6">
          <h1 className="text-2xl md:text-3xl font-bold text-foreground">Base Class Studio</h1>
          {selectedItem && selectedItem.title && (
            <p className="text-md md:text-lg text-muted-foreground mt-1">Editing: {selectedItem.title}</p>
          )}
        </div>
        
        {renderEditor()}
      </main>
    </div>
  );
};

export default BaseClassStudioPage; 