'use client';

import React, { useEffect, useState, use } from 'react';
import { supabase } from '@/utils/supabase/browser'; // Corrected Supabase client import path
import type { StudioBaseClass, Path, Lesson, LessonSection } from '@/types/lesson';
import type { BaseClass } from '@/types/teach'; // NEW: Import BaseClass for casting
import { Loader2, Menu, Info } from 'lucide-react'; // For loading indicator and menu icon, added Info for Knowledge Base
import StudioNavigationTree from '@/components/teach/studio/StudioNavigationTree';
import BaseClassEditor from '@/components/teach/studio/editors/BaseClassEditor'; // Added import
import PathEditor from '@/components/teach/studio/editors/PathEditor'; // Added import
import LessonEditor from '@/components/teach/studio/editors/LessonEditor'; // Added import
import LessonSectionEditor from '@/components/teach/studio/editors/LessonSectionEditor'; // Added import
import ContentRenderer from '@/components/teach/studio/editors/ContentRenderer';
import { KnowledgeBaseEditor } from '@/components/teach/studio/editors/KnowledgeBaseEditor'; // NEW: Import KnowledgeBaseEditor
import LunaContextElement from '@/components/luna/LunaContextElement'; // NEW: Import Luna context
import { RealTimeUpdater, useRealTimeContentUpdates } from '@/components/ui/real-time-updater';

// NEW: DND Kit imports
import { arrayMove } from '@dnd-kit/sortable';
import type { Path as DndPath } from '@/types/lesson'; // Use a specific type for DND if needed, or cast

// Define the shape of the params object if it were resolved
interface ResolvedPageParams {
  id: string;
}

interface BaseClassStudioPageProps {
  // The props received by the component. As per Next.js 15, params is always a Promise
  params: Promise<ResolvedPageParams>; 
}

const BaseClassStudioPage: React.FC<BaseClassStudioPageProps> = (props) => {
  // In Next.js 15, params is always a Promise
  const resolvedParamsSignal = use(props.params);
  const { id: baseClassId } = resolvedParamsSignal;

  const [studioBaseClass, setStudioBaseClass] = useState<StudioBaseClass | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  
  // MODIFIED: selectedItem state to include title and data, and support 'knowledgebase' type
  const [selectedItem, setSelectedItem] = useState<{ type: string; id: string | null; title: string | null; data: StudioBaseClass | Path | Lesson | LessonSection | null }>({ type: 'baseclass', id: baseClassId, title: 'Loading...', data: null });

  // NEW: State to track loading of individual path's lessons
  const [isLoadingLessons, setIsLoadingLessons] = useState<Record<string, boolean>>({});

  // NEW: State to track loading of individual lesson's sections
  const [isLoadingSections, setIsLoadingSections] = useState<Record<string, boolean>>({});

  const [isNavOpen, setIsNavOpen] = useState(false); // State for mobile navigation

  // State to track recently updated items for visual feedback
  const [recentlyUpdatedItems, setRecentlyUpdatedItems] = useState<Set<string>>(new Set());

  // Real-time updates hook
  const { lastUpdate } = useRealTimeContentUpdates((entity, entityId, updatedData, eventType = 'update') => {
    console.log('Content update received in studio:', { entity, entityId, updatedData, eventType });
    
    if (!updatedData) {
      console.warn('No updated data received for entity:', entity, entityId);
      return;
    }

    // Add item to recently updated set for visual feedback
    setRecentlyUpdatedItems(prev => new Set([...prev, entityId]));
    
    // Remove from recently updated after 3 seconds
    setTimeout(() => {
      setRecentlyUpdatedItems(prev => {
        const newSet = new Set(prev);
        newSet.delete(entityId);
        return newSet;
      });
    }, 3000);
    
    // Update local state based on the entity type and event type
    if (entity === 'baseClass' && entityId === baseClassId) {
      // Update base class data
      setStudioBaseClass(prevBaseClass => {
        if (!prevBaseClass) return null;
        const updatedBaseClass = { ...prevBaseClass, ...updatedData };
        
        // Update selected item if it's the base class
        if (selectedItem.type === 'baseclass' && selectedItem.id === entityId) {
          setSelectedItem(prev => ({
            ...prev,
            title: updatedData.name || prev.title,
            data: updatedBaseClass
          }));
        }
        
        return updatedBaseClass;
      });
    } else if (entity === 'path') {
      if (eventType === 'create') {
        // Add new path to the list
        setStudioBaseClass(prevBaseClass => {
          if (!prevBaseClass) return null;
          
          const newPath = { ...updatedData, lessons: [] };
          const updatedPaths = [...(prevBaseClass.paths || []), newPath];
          
          return { ...prevBaseClass, paths: updatedPaths };
        });
      } else {
        // Update existing path data
        setStudioBaseClass(prevBaseClass => {
          if (!prevBaseClass || !prevBaseClass.paths) return prevBaseClass;
          
          const updatedPaths = prevBaseClass.paths.map(path => 
            path.id === entityId ? { ...path, ...updatedData } : path
          );
          
          // Update selected item if it's this path
          if (selectedItem.type === 'path' && selectedItem.id === entityId) {
            const updatedPath = updatedPaths.find(p => p.id === entityId);
            if (updatedPath) {
              setSelectedItem(prev => ({
                ...prev,
                title: updatedPath.title || prev.title,
                data: updatedPath
              }));
            }
          }
          
          return { ...prevBaseClass, paths: updatedPaths };
        });
      }
    } else if (entity === 'lesson') {
      if (eventType === 'create') {
        // Add new lesson to the appropriate path
        setStudioBaseClass(prevBaseClass => {
          if (!prevBaseClass || !prevBaseClass.paths) return prevBaseClass;
          
          const updatedPaths = prevBaseClass.paths.map(path => {
            // Find the path this lesson belongs to
            if (updatedData.path_id === path.id) {
              const newLesson = { ...updatedData, sections: [] };
              return {
                ...path,
                lessons: [...(path.lessons || []), newLesson]
              };
            }
            return path;
          });
          
          return { ...prevBaseClass, paths: updatedPaths };
        });
      } else {
        // Update existing lesson data
        setStudioBaseClass(prevBaseClass => {
          if (!prevBaseClass || !prevBaseClass.paths) return prevBaseClass;
          
          const updatedPaths = prevBaseClass.paths.map(path => ({
            ...path,
            lessons: path.lessons?.map(lesson => 
              lesson.id === entityId ? { ...lesson, ...updatedData } : lesson
            ) || []
          }));
          
          // Update selected item if it's this lesson
          if (selectedItem.type === 'lesson' && selectedItem.id === entityId) {
            const updatedLesson = updatedPaths
              .flatMap(p => p.lessons || [])
              .find(l => l.id === entityId);
            if (updatedLesson) {
              setSelectedItem(prev => ({
                ...prev,
                title: updatedLesson.title || prev.title,
                data: updatedLesson
              }));
            }
          }
          
          return { ...prevBaseClass, paths: updatedPaths };
        });
      }
    } else if (entity === 'section') {
      if (eventType === 'create') {
        // Add new section to the appropriate lesson
        setStudioBaseClass(prevBaseClass => {
          if (!prevBaseClass || !prevBaseClass.paths) return prevBaseClass;
          
          const updatedPaths = prevBaseClass.paths.map(path => ({
            ...path,
            lessons: path.lessons?.map(lesson => {
              // Find the lesson this section belongs to
              if (updatedData.lesson_id === lesson.id) {
                return {
                  ...lesson,
                  sections: [...(lesson.sections || []), updatedData]
                };
              }
              return lesson;
            }) || []
          }));
          
          return { ...prevBaseClass, paths: updatedPaths };
        });
      } else {
        // Update existing section data
        setStudioBaseClass(prevBaseClass => {
          if (!prevBaseClass || !prevBaseClass.paths) return prevBaseClass;
          
          const updatedPaths = prevBaseClass.paths.map(path => ({
            ...path,
            lessons: path.lessons?.map(lesson => ({
              ...lesson,
              sections: lesson.sections?.map(section => 
                section.id === entityId ? { ...section, ...updatedData } : section
              ) || []
            })) || []
          }));
          
          // Update selected item if it's this section
          if (selectedItem.type === 'section' && selectedItem.id === entityId) {
            const updatedSection = updatedPaths
              .flatMap(p => p.lessons || [])
              .flatMap(l => l.sections || [])
              .find(s => s.id === entityId);
            if (updatedSection) {
              setSelectedItem(prev => ({
                ...prev,
                title: updatedSection.title || prev.title,
                data: updatedSection
              }));
            }
          }
          
          return { ...prevBaseClass, paths: updatedPaths };
        });
      }
    }
  });

  // Skeleton Loader Component
  const SkeletonBar: React.FC<{ width?: string; height?: string; className?: string }> = ({ width = 'w-full', height = 'h-4', className = '' }) => (
    <div className={`bg-muted animate-pulse rounded ${width} ${height} ${className}`} />
  );

  // NEW: Function to render skeleton UI
  const renderSkeletonState = () => {
    return (
      <div className="flex flex-col lg:flex-row h-full min-h-0 bg-background">
        {/* Navigation Tree Panel Skeleton */}
        <div className={`lg:block w-full lg:w-[350px] xl:w-[400px] border-b lg:border-b-0 lg:border-r border-border flex flex-col flex-shrink-0 h-full lg:h-auto lg:min-h-0`}>
          <div className="flex-1 p-4 overflow-y-auto min-h-0">
            <SkeletonBar height="h-8" width="w-3/4" className="mb-6" /> {/* Base Class Title Placeholder */}
            <div className="space-y-3">
              {[1, 2, 3].map((i) => (
                <div key={i} className="p-2 space-y-2">
                  <SkeletonBar height="h-6" width="w-5/6" /> {/* Path Title Placeholder */}
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Main Content Editor Area Skeleton */}
        <div className="flex-1 flex flex-col min-h-0">
          <div className="p-6 border-b border-border">
            <SkeletonBar height="h-10" width="w-1/2" className="mb-2" /> {/* "Base Class Studio" Title Placeholder */}
            <SkeletonBar height="h-6" width="w-1/3" /> {/* "Editing: ..." Subtitle Placeholder */}
          </div>
          
          <div className="flex-1 p-6 overflow-y-auto min-h-0">
            <div className="space-y-4">
              <SkeletonBar height="h-10" /> {/* Placeholder for form field/area */}
              <SkeletonBar height="h-24" /> {/* Placeholder for larger form field/area (e.g. description) */}
              <SkeletonBar height="h-10" width="w-1/4" /> {/* Placeholder for a button */}
            </div>
          </div>
        </div>
      </div>
    );
  };

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
    if (pathExists && pathExists.lessons && pathExists.lessons.length > 0) {
      // Only skip if lessons array exists AND has actual lessons
      return;
    }

    // Prevent multiple simultaneous fetches for the same path
    if (isLoadingLessons[pathId]) return;

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
    let sectionsAlreadyLoaded = false;
    studioBaseClass.paths?.forEach(p => {
        const l = p.lessons?.find(les => les.id === lessonId);
        if (l) {
          lessonExists = true;
          if (l.sections && l.sections.length > 0) {
            sectionsAlreadyLoaded = true;
          }
        }
    });
    
    if (sectionsAlreadyLoaded) return;

    // Prevent multiple simultaneous fetches for the same lesson
    if (isLoadingSections[lessonId]) return;

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
    return renderSkeletonState(); // Use the new skeleton loader
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
  
  // MODIFIED: handleSelectItem to include data and handle 'knowledgebase'
  const handleSelectItem = (type: string, itemData: StudioBaseClass | Path | Lesson | LessonSection, itemId?: string, itemTitle?: string) => {
    if (!itemData && type !== 'knowledgebase') { // Allow itemData to be null for knowledgebase if base class is the data
      console.warn('handleSelectItem called with null itemData for type:', type);
      setSelectedItem({ type, id: itemId || null, title: itemTitle || 'Error: No data', data: null });
      return;
    }

    let idToSet: string | null = null;
    let titleToSet: string | null = null;
    let dataToSet: any = itemData; // Allow 'any' for flexibility, will be typed in specific editors

    switch (type) {
      case 'baseclass':
        idToSet = (itemData as StudioBaseClass).id;
        titleToSet = (itemData as StudioBaseClass).name;
        break;
      case 'path':
        idToSet = (itemData as Path).id;
        titleToSet = (itemData as Path).title;
        // Only fetch lessons if this is a different path than currently selected
        if (idToSet && (selectedItem.type !== 'path' || selectedItem.id !== idToSet)) {
          fetchLessonsForPath(idToSet);
        }
        break;
      case 'lesson':
        idToSet = (itemData as Lesson).id;
        titleToSet = (itemData as Lesson).title;
        // Only fetch sections if this is a different lesson than currently selected
        if (idToSet && (selectedItem.type !== 'lesson' || selectedItem.id !== idToSet)) {
          fetchSectionsForLesson(idToSet);
        }
        break;
      case 'section':
        idToSet = (itemData as LessonSection).id;
        titleToSet = (itemData as LessonSection).title;
        break;
      case 'knowledgebase': // NEW: Handle knowledgebase selection
        idToSet = (itemData as StudioBaseClass).id; // Uses baseClassId
        titleToSet = 'Knowledge Base';
        dataToSet = itemData; // Pass the whole baseClass object
        break;
      default:
        console.warn('Unknown item type selected:', type);
        setSelectedItem({ type, id: itemId || null, title: itemTitle || 'Unknown Item', data: itemData });
        return;
    }
    
    setSelectedItem({ type, id: idToSet, title: titleToSet, data: dataToSet });
    if (typeof window !== 'undefined' && window.innerWidth < 768) {
      setIsNavOpen(false); // Close mobile nav on selection
    }
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
    if (!selectedItem || selectedItem.type !== 'section' || !selectedItem.data || !updatedData.id) {
      console.error('No section selected or section ID missing for saving.');
      alert('Error: No section selected or section ID missing.');
      return;
    }

    const currentSectionId = updatedData.id;

    try {
      const { data: { user }, error: userError } = await supabase.auth.getUser();
      if (userError || !user) {
        throw new Error(userError?.message || 'User not found. Cannot save version.');
      }
      const userId = user.id;

      // 1. Determine the next version number
      let nextVersionNumber = 1;
      const { data: latestVersionData, error: latestVersionError } = await supabase
        .from('lesson_section_versions')
        .select('version_number')
        .eq('lesson_section_id', currentSectionId)
        .order('version_number', { ascending: false })
        .limit(1)
        .single();

      if (latestVersionError && latestVersionError.code !== 'PGRST116') { // PGRST116: no rows found, which is fine for the first version
        console.error('Error fetching latest version number:', latestVersionError);
        throw new Error(`Failed to determine version number: ${latestVersionError.message}`);
      }

      if (latestVersionData) {
        nextVersionNumber = latestVersionData.version_number + 1;
      }

      // 2. Create a new version in lesson_section_versions
      const { error: versionError } = await supabase
        .from('lesson_section_versions')
        .insert({
          lesson_section_id: currentSectionId,
          content: updatedData.content,
          creator_user_id: userId, // Corrected to creator_user_id
          version_number: nextVersionNumber, // Calculated version number
        });

      if (versionError) {
        console.error('Failed to save lesson section version:', versionError);
        throw new Error(`Failed to save version: ${versionError.message}`);
      }
      
      // 3. Update the main lesson_sections table
      const { error: updateError } = await supabase
        .from('lesson_sections')
        .update({ 
          title: updatedData.title, 
          content: updatedData.content, 
          section_type: updatedData.section_type 
        })
        .eq('id', currentSectionId);

      if (updateError) {
        console.error('Failed to update lesson section:', updateError);
        // Potentially roll back version insert or mark it as orphaned if critical
        throw new Error(`Failed to update section after versioning: ${updateError.message}`);
      }

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
                s.id === currentSectionId ? { ...s, ...updatedData } : s
              ) || [],
            })) || [],
          })),
        };
      });
      setSelectedItem(prev => {
        if (!prev.data || prev.data.id !== currentSectionId) return prev;
        const newTitle = updatedData.title || prev.title;
        const newData = { ...prev.data, ...updatedData };
        return { ...prev, data: newData as LessonSection, title: newTitle };
      });

      alert('Lesson Section saved successfully with versioning!');
    } catch (e: any) {
      console.error('Failed to save Lesson Section:', e);
      setError(`Failed to save Lesson Section: ${e.message}`);
      alert(`Failed to save Lesson Section: ${e.message}`);
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
    if (!selectedItem || !selectedItem.data && selectedItem.type !== 'knowledgebase') { // Allow data to be null for knowledgebase if baseClass is passed
      if (isLoading) return <p className="p-6 text-muted-foreground"><Loader2 className="mr-2 h-4 w-4 animate-spin inline-block"/>Loading editor...</p>;
      return <p className="p-6 text-muted-foreground">Select an item from the navigation tree to start editing.</p>;
    }

    switch (selectedItem.type) {
      case 'baseclass':
        return <BaseClassEditor baseClass={selectedItem.data as StudioBaseClass} onSave={handleSaveBaseClass} />;
      case 'path':
        return <PathEditor path={selectedItem.data as Path} onSave={handleSavePath} baseClassId={studioBaseClass!.id} lessons={studioBaseClass?.paths?.find(p => p.id === selectedItem.id)?.lessons || []} onReorderLessons={handleReorderLessons} fetchLessonsForPath={fetchLessonsForPath} isLoadingLessons={isLoadingLessons[selectedItem.id as string]}/>;
      case 'lesson':
        // Find the parent path for the lesson
        const parentPathForLesson = studioBaseClass?.paths?.find(p => p.lessons?.some(l => l.id === selectedItem.id));
        return <LessonEditor lesson={selectedItem.data as Lesson} onSave={handleSaveLesson} pathId={parentPathForLesson?.id || ''} sections={parentPathForLesson?.lessons?.find(l=> l.id === selectedItem.id)?.sections || []} onReorderSections={handleReorderSections} fetchSectionsForLesson={fetchSectionsForLesson} isLoadingSections={isLoadingSections[selectedItem.id as string]} baseClass={studioBaseClass} />;
      case 'section':
        return <LessonSectionEditor section={selectedItem.data as LessonSection} onSave={handleSaveLessonSection} />;
      case 'knowledgebase': // NEW: Render KnowledgeBaseEditor
        if (studioBaseClass) { // Ensure studioBaseClass is loaded
          return <KnowledgeBaseEditor baseClass={studioBaseClass} />;
        }
        return <p className="p-6 text-muted-foreground"><Loader2 className="mr-2 h-4 w-4 animate-spin inline-block"/>Loading Knowledge Base...</p>; // Fallback if studioBaseClass isn't ready
      default:
        return <p className="p-6 text-muted-foreground">Editor for type "{selectedItem.type}" not implemented yet.</p>;
    }
  };

  return (
    <>
      <RealTimeUpdater />
      <LunaContextElement
      type="base-class-studio-page"
      role="main-content"
      content={{
        pageTitle: "Base Class Studio",
        baseClassName: studioBaseClass?.name || "Loading...",
        baseClassId: baseClassId,
        baseClassDescription: studioBaseClass?.description,
        baseClassSubject: studioBaseClass?.settings?.subject,
        baseClassGradeLevel: studioBaseClass?.settings?.gradeLevel,
        selectedItemType: selectedItem.type,
        selectedItemTitle: selectedItem.title,
        selectedItemId: selectedItem.id,
        totalPaths: studioBaseClass?.paths?.length || 0,
        totalLessons: studioBaseClass?.paths?.reduce((acc, path) => acc + (path.lessons?.length || 0), 0) || 0,
        currentRoute: `/teach/base-classes/${baseClassId}`
      }}
      metadata={{
        baseClassId,
        selectedItemType: selectedItem.type,
        selectedItemId: selectedItem.id,
        isLoading,
        hasError: !!error
      }}
      actionable={true}
    >
      <div className="flex flex-col lg:flex-row h-full min-h-0 bg-background">
        {/* Mobile navigation toggle - Always visible on mobile */}
        <div className="lg:hidden border-b border-border">
          <div className="p-4">
            <button 
              onClick={() => setIsNavOpen(!isNavOpen)} 
              className="flex items-center gap-2 p-2 rounded-md hover:bg-accent focus:outline-none focus:ring-2 focus:ring-ring w-full"
            >
              <Menu className="h-5 w-5" />
              <span className="text-sm font-medium">Class Structure Nav</span>
            </button>
          </div>
        </div>

        {/* Navigation Tree Panel */}
        <LunaContextElement
          type="navigation-tree"
          role="navigation"
          content={{
            baseClassName: studioBaseClass?.name,
            paths: studioBaseClass?.paths?.map(path => ({
              id: path.id,
              title: path.title,
              description: path.description,
              lessonsCount: path.lessons?.length || 0,
              lessons: path.lessons?.map(lesson => ({
                id: lesson.id,
                title: lesson.title,
                description: lesson.description,
                sectionsCount: lesson.sections?.length || 0
              })) || []
            })) || []
          }}
          metadata={{
            selectedItemId: selectedItem.id,
            selectedItemType: selectedItem.type
          }}
          actionable={true}
        >
          <div 
            className={`
              ${isNavOpen ? 'block' : 'hidden'} lg:block 
              w-full lg:w-[350px] xl:w-[400px] 
              border-b lg:border-b-0 lg:border-r border-border 
              flex flex-col
              flex-shrink-0 
              h-full lg:h-auto lg:min-h-0
            `}
          >
            {/* Navigation content with proper scrolling */}
            <div className="flex-1 p-4 overflow-y-auto min-h-0" style={{ isolation: 'isolate' }}>
              {studioBaseClass && (
                <div className="studio-navigation-tree" style={{ position: 'relative', zIndex: 1 }}>
                  <StudioNavigationTree 
                    baseClass={studioBaseClass} 
                    onSelectItem={(type, itemData) => {
                      handleSelectItem(type, itemData);
                      if (window.innerWidth < 1024) { // lg breakpoint
                        setIsNavOpen(false); // Close nav on item selection on mobile/tablet
                      }
                    }}
                    selectedItemId={selectedItem.id}
                    onToggleExpandPath={fetchLessonsForPath}
                    onToggleExpandLesson={fetchSectionsForLesson}
                    onReorderPaths={handleReorderPaths}
                    onReorderLessons={handleReorderLessons}
                    onReorderSections={handleReorderSections}
                    recentlyUpdatedItems={recentlyUpdatedItems}
                  />
                </div>
              )}
            </div>
          </div>
        </LunaContextElement>

        {/* Main Content Editor Area */}
        <LunaContextElement
          type="content-editor"
          role="editor"
          content={{
            editorType: selectedItem.type,
            itemTitle: selectedItem.title,
            itemId: selectedItem.id,
            itemData: selectedItem.data ? {
              // Safely extract relevant data based on type
              ...(selectedItem.type === 'baseclass' && selectedItem.data ? {
                name: (selectedItem.data as StudioBaseClass).name,
                description: (selectedItem.data as StudioBaseClass).description,
                subject: (selectedItem.data as StudioBaseClass).settings?.subject,
                gradeLevel: (selectedItem.data as StudioBaseClass).settings?.gradeLevel
              } : {}),
              ...(selectedItem.type === 'path' && selectedItem.data ? {
                title: (selectedItem.data as Path).title,
                description: (selectedItem.data as Path).description
              } : {}),
              ...(selectedItem.type === 'lesson' && selectedItem.data ? {
                title: (selectedItem.data as Lesson).title,
                description: (selectedItem.data as Lesson).description
              } : {}),
              ...(selectedItem.type === 'section' && selectedItem.data ? {
                title: (selectedItem.data as LessonSection).title,
                content: (selectedItem.data as LessonSection).content,
                sectionType: (selectedItem.data as LessonSection).section_type
              } : {})
            } : null
          }}
          metadata={{
            baseClassId,
            selectedItemType: selectedItem.type,
            selectedItemId: selectedItem.id,
            canEdit: true,
            hasUnsavedChanges: false // You could track this with state
          }}
          actionable={true}
        >
          <div className="flex-1 flex flex-col min-h-0">
            <div className="p-6 border-b border-border">
              <h1 className="text-2xl md:text-3xl font-bold text-foreground">Base Class Studio</h1>
              {selectedItem && selectedItem.title && (
                <p className="text-md md:text-lg text-muted-foreground mt-1">Editing: {selectedItem.title}</p>
              )}
            </div>
            
            <div className="flex-1 p-6 overflow-y-auto min-h-0">
              {renderEditor()}
            </div>
          </div>
        </LunaContextElement>
      </div>
    </LunaContextElement>
    </>
  );
};

export default BaseClassStudioPage; 