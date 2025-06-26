"use client";

import React, { useState, useEffect, useCallback } from "react";
import { useRouter } from 'next/navigation';
import { BaseClass, BaseClassCreationData, GeneratedOutline } from "@/types/teach";
import { BaseClassCardGrid } from "@/components/teach/BaseClassCardGrid";
import { CreateBaseClassModal } from "@/components/teach/CreateBaseClassModal";
import { Button } from "@/components/ui/button";
import { PlusCircle, BookOpenText, Plus, Loader2 } from "lucide-react";
import { createBrowserClient } from '@supabase/ssr'; // Import Supabase client
import { Database, Tables } from '@learnologyai/types'; // Import Database types
// import { toast } from "sonner"; // Consider adding toast notifications

// --- Mock API --- (To be moved to a separate file e.g., src/lib/api/teach-mocks.ts later)
// const MOCK_BASE_CLASSES: BaseClass[] = [
//   {
//     id: "1",
//     name: "Introduction to Programming",
//     description: "Learn the fundamentals of programming using Python.",
//     subject: "Computer Science",
//     gradeLevel: "9-10",
//     lengthInWeeks: 16,
//     creationDate: new Date("2023-01-15T10:00:00Z").toISOString(),
//   },
//   {
//     id: "2",
//     name: "World History: Ancient Civilizations",
//     description: "Explore the rise and fall of ancient empires.",
//     subject: "History",
//     gradeLevel: "7-8",
//     lengthInWeeks: 12,
//     creationDate: new Date("2023-03-01T14:30:00Z").toISOString(),
//   },
//   {
//     id: "3",
//     name: "Algebra I",
//     description: "Covering linear equations, inequalities, and functions.",
//     subject: "Mathematics",
//     gradeLevel: "8-9",
//     lengthInWeeks: 38,
//     creationDate: new Date("2022-09-01T09:00:00Z").toISOString(),
//   },
// ];

// let nextId = MOCK_BASE_CLASSES.length + 1;

// const mockFetchBaseClasses = async (): Promise<BaseClass[]> => {
//   console.log("Mock API: Fetching base classes...");
//   await new Promise(resolve => setTimeout(resolve, 500)); // Simulate network delay
//   return [...MOCK_BASE_CLASSES]; // Return a copy
// };

// const mockCreateBaseClass = async (data: BaseClassCreationData): Promise<BaseClass> => {
//   console.log("Mock API: Creating base class...", data);
//   await new Promise(resolve => setTimeout(resolve, 500));
//   const newBaseClass: BaseClass = {
//     ...data,
//     id: (nextId++).toString(),
//     creationDate: new Date().toISOString(),
//   };
//   MOCK_BASE_CLASSES.push(newBaseClass); // Add to our mock "DB"
//   return newBaseClass;
// };

// // Mock delete function for now
// const mockDeleteBaseClass = async (id: string): Promise<void> => {
//   console.log(`Mock API: Deleting base class with id ${id}`);
//   await new Promise(resolve => setTimeout(resolve, 300));
//   const index = MOCK_BASE_CLASSES.findIndex(bc => bc.id === id);
//   if (index !== -1) {
//     MOCK_BASE_CLASSES.splice(index, 1);
//   }
//   // In a real API, you might return success/failure or handle errors
// };
// --- End Mock API ---

export default function TeachBaseClassesPage() {
  const router = useRouter();
  const [baseClasses, setBaseClasses] = useState<BaseClass[]>([]);
  const [isLoadingPage, setIsLoadingPage] = useState(true); // For initial page load
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [pageError, setPageError] = useState<string | null>(null); 
  
  const [isProcessingRequest, setIsProcessingRequest] = useState(false); // Overall request processing state
  const [currentProcessStatus, setCurrentProcessStatus] = useState<string | null>(null); // Granular status for modal & page

  const [userOrgId, setUserOrgId] = useState<string | null>(null);
  const [isLoadingOrg, setIsLoadingOrg] = useState(true);

  // Create Supabase client
  const supabase = createBrowserClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  );

  useEffect(() => {
    async function fetchUserOrganisation() {
      setIsLoadingOrg(true);
      try {
        const { data: { session }, error: sessionError } = await supabase.auth.getSession();
        if (sessionError) throw new Error('Authentication error: ' + sessionError.message);
        if (!session) throw new Error('User not logged in. Please log in again.');
        
        // Query 'profiles' table instead of 'members'
        const { data: profileData, error: profileError } = await supabase
          .from('profiles')
          .select('organisation_id')
          .eq('user_id', session.user.id) // Assuming 'user_id' is the column in profiles linking to auth.users.id
          .single<Tables<'profiles'>>();
        
        if (profileError) {
          console.error('Profile fetch error:', profileError);
          throw new Error('Could not retrieve your profile information: ' + profileError.message);
        }
        if (!profileData || !profileData.organisation_id) {
          throw new Error('Organisation ID not found in your profile. Please ensure your profile is complete.');
        }
        
        setUserOrgId(profileData.organisation_id);
      } catch (err: any) {
        console.error("Failed to fetch user organisation from profile:", err);
        setPageError((prevError) => prevError ? `${prevError}; ${err.message}` : err.message);
        setUserOrgId(null);
      } finally {
        setIsLoadingOrg(false);
      }
    }
    fetchUserOrganisation();
  }, [supabase]);

  const loadBaseClasses = useCallback(async () => {
    setIsLoadingPage(true);
    setPageError(null);
    try {
      const response = await fetch("/api/teach/base-classes");
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || "Failed to fetch base classes");
      }
      const data: BaseClass[] = await response.json();
      setBaseClasses(data);
    } catch (err: any) {
      console.error("Failed to load base classes:", err);
      setPageError(err.message || "An unexpected error occurred.");
      // toast.error("Failed to load base classes: " + err.message);
    } finally {
      setIsLoadingPage(false);
    }
  }, []);

  useEffect(() => {
    if (userOrgId) { // Only load base classes if org context is successfully loaded
        loadBaseClasses();
    }
  }, [loadBaseClasses, userOrgId]);

  // Skeleton Loader Components
  const SkeletonBar: React.FC<{ width?: string; height?: string; className?: string }> = ({ width = 'w-full', height = 'h-4', className = '' }) => (
    <div className={`bg-muted rounded ${width} ${height} ${className} overflow-hidden relative`}>
      {/* Shimmer element */}
      <div className="animate-shimmer absolute inset-0 -translate-x-full bg-gradient-to-r from-transparent via-muted-foreground/10 to-transparent"></div>
    </div>
  );

  const SkeletonCard: React.FC = () => (
    <div className="bg-card border rounded-lg p-4 space-y-3 shadow">
      <SkeletonBar height="h-6" width="w-3/4" />
      <SkeletonBar height="h-4" width="w-full" />
      <SkeletonBar height="h-4" width="w-5/6" />
      <div className="flex justify-between items-center pt-2">
        <SkeletonBar height="h-4" width="w-1/4" />
        <SkeletonBar height="h-8" width="w-1/4" />
      </div>
    </div>
  );

  const renderPageSkeletonState = () => (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <SkeletonBar height="h-8" width="w-64" /> {/* Title: My Base Classes */}
        <SkeletonBar height="h-10" width="w-48" /> {/* Create New Button */}
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
        {[1, 2, 3, 4, 5, 6].map((i) => <SkeletonCard key={i} />)}
      </div>
    </div>
  );

  const handleCreateBaseClassSubmit = async (formDataFromModal: BaseClassCreationData) => {
    setIsModalOpen(true); // Ensure modal is open
    setIsProcessingRequest(true);
    setCurrentProcessStatus("Initiating creation process...");
    setPageError(null);
    let newBaseClassId: string | null = null;

    try {
      setCurrentProcessStatus("Step 1/4: Creating base class record...");
      const createResponse = await fetch("/api/teach/base-classes", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(formDataFromModal), 
      });

      if (!createResponse.ok) {
        const errorData = await createResponse.json().catch(() => ({error: "Failed to create base class record and parse server error"}));
        throw new Error(errorData.error || "Failed to create base class record");
      }
      const createdBaseClass: BaseClass = await createResponse.json();
      newBaseClassId = createdBaseClass.id;

      setCurrentProcessStatus("Step 2/4: Generating course outline...");
      const prompt = `Design a comprehensive course outline for a ${formDataFromModal.lengthInWeeks}-week course titled "${formDataFromModal.name}". Subject: ${createdBaseClass.subject || 'General'}. Grade Level: ${createdBaseClass.gradeLevel || 'Not specified'}. Course Description: ${formDataFromModal.description || 'No additional description provided.'}. Ensure the outline includes distinct modules, and for each module, suggest specific lesson titles.`;
      
      const outlineResponse = await fetch("/api/teach/generate-course-outline", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ prompt }),
      });

      if (!outlineResponse.ok) {
        const errorData = await outlineResponse.json().catch(() => ({error: "Failed to generate outline and parse server error"}));
        throw new Error(errorData.error || "Failed to generate course outline");
      }
      const generatedOutline: GeneratedOutline = await outlineResponse.json(); 

      setCurrentProcessStatus("Step 3/4: Saving outline to base class...");
      const existingSettings = createdBaseClass?.settings;
      const updatedSettings = { 
          ...(existingSettings && typeof existingSettings === 'object' && !Array.isArray(existingSettings) ? existingSettings : {}), 
          generatedOutline: generatedOutline 
      };

      const updateSettingsResponse = await fetch(`/api/teach/base-classes/${newBaseClassId}`, {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ settings: updatedSettings }), 
      });

      if (!updateSettingsResponse.ok) {
          const errorData = await updateSettingsResponse.json().catch(() => ({error: "Failed to save outline and parse server error"}));
          throw new Error(errorData.error || "Failed to save generated outline");
      }

      setCurrentProcessStatus("Step 4/4: Populating paths and lessons...");
      const generateLessonsResponse = await fetch(`/api/teach/base-classes/${newBaseClassId}/generate-lessons`, {
        method: "POST", 
        headers: { "Content-Type": "application/json" },
      });

      if (!generateLessonsResponse.ok) {
        const errorData = await generateLessonsResponse.json().catch(() => ({error: "Failed to generate lessons and parse server error"}));
        throw new Error(errorData.error || "Failed to populate lessons");
      }

      setCurrentProcessStatus("Finalizing... Almost there!");
      await loadBaseClasses(); 
      router.push(`/teach/base-classes/${newBaseClassId}`); 

    } catch (err: any) {
      console.error("Multi-step base class creation failed:", err);
      const detailedErrorMessage = err.message || "An unexpected error occurred during the creation process.";
      setPageError(detailedErrorMessage); // Keep detailed error for page display if needed
      setCurrentProcessStatus(`Error: Creation failed. Please try again.`); // More generic for modal
      // Modal remains open. isProcessingRequest is set to false in finally to re-enable submit.
    } finally {
      // Only set to false if not navigating away on success. 
      // If error, this allows retry button in modal to re-enable.
      // If newBaseClassId is set AND pageError is null, it means success and navigation is about to happen or has happened.
      if (!(newBaseClassId && !pageError)) {
        setIsProcessingRequest(false); // Set to false on error or if navigation didn't initiate
      }
      // If navigation happens, this component unmounts, so resetting status might not be visible.
      // If an error occurred, currentProcessStatus already shows the error.
      // If we are here due to an error, setIsProcessingRequest(false) above is key.
    }
  };

  const handleModalOpen = () => {
    if (!userOrgId) {
      setPageError(isLoadingOrg ? "Organisation context is still loading. Please wait." : "Organisation context could not be loaded. Please refresh or check your profile.");
      return;
    }
    setIsModalOpen(true); 
    setCurrentProcessStatus(null); 
    setPageError(null); 
  };

  const handleModalClose = () => {
    if (!isProcessingRequest) { // Only allow close if not actively processing
        setIsModalOpen(false);
        // Optionally clear status if user cancels
        // setCurrentProcessStatus(null);
        // setPageError(null);
    }
    // If processing, modal close is prevented by its internal onOpenChange logic
  };

  // Placeholder action handlers - these can be implemented later
  const handleViewDetails = (id: string) => {
    console.log("View Details:", id);
    router.push(`/teach/base-classes/${id}`);
  };
  const handleEdit = (id: string) => {
    console.log("Edit:", id);
    // This might open the CreateBaseClassModal with existing data
    // const classToEdit = baseClasses.find(bc => bc.id === id);
    // if (classToEdit) {
    //   // Prefill modal - modal needs to support an initialData prop
    //   setIsModalOpen(true); 
    // }
  };
  const handleClone = (id: string) => console.log("Clone:", id);
  const handleArchive = (id: string) => console.log("Archive:", id);

  const handleDelete = async (id: string) => {
    // Optional: Add a confirmation dialog before deleting
    // if (!confirm("Are you sure you want to delete this base class? This action cannot be undone.")) {
    //   return;
    // }
    
    // Optimistically remove from UI, or wait for API response
    // const originalClasses = [...baseClasses];
    // setBaseClasses(prevClasses => prevClasses.filter(bc => bc.id !== id));
    setPageError(null);

    try {
      const response = await fetch(`/api/teach/base-classes/${id}`, {
        method: "DELETE",
      });

      if (!response.ok) {
        const errorData = await response.json();
        // setBaseClasses(originalClasses); // Rollback optimistic update
        throw new Error(errorData.error || "Failed to delete base class");
      }
      // If successful, refresh the list or remove locally if API confirms deletion
      setBaseClasses(prevClasses => prevClasses.filter(bc => bc.id !== id));
      // toast.success("Base Class deleted successfully.");
    } catch (err: any) {
      console.error("Failed to delete base class:", err);
      setPageError(err.message || "An unexpected error occurred during deletion.");
      // toast.error("Failed to delete base class: " + err.message);
    }
  };

  // Main conditional rendering based on loading and error states
  if (isLoadingOrg || (isLoadingPage && baseClasses.length === 0)) {
    return renderPageSkeletonState();
  }

  if (pageError && baseClasses.length === 0) { 
    return <div className="text-center text-red-600 container mx-auto p-6">Error: {pageError} <Button onClick={() => window.location.reload()} variant="outline" className="ml-2">Refresh</Button></div>;
  }

  return (
    <div className="container mx-auto p-4 md:p-6 space-y-6 md:space-y-8">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <h1 className="text-3xl font-semibold tracking-tight text-slate-900 dark:text-slate-50">My Base Classes</h1>
        <Button 
          onClick={handleModalOpen} 
          variant="default" 
          size="lg" 
          disabled={isProcessingRequest || isLoadingOrg || !userOrgId}
        >
          {/* Button text logic updated slightly to reflect isProcessingRequest and currentProcessStatus */}
          {isProcessingRequest && currentProcessStatus ? (
            <><Loader2 className="mr-2 h-5 w-5 animate-spin" /> {currentProcessStatus.length > 20 ? `${currentProcessStatus.substring(0,20)}...` : currentProcessStatus}</>
          ) : isLoadingOrg ? (
            <><Loader2 className="mr-2 h-5 w-5 animate-spin" /> Loading Context...</>
          ) : !userOrgId ? (
            <><PlusCircle className="mr-2 h-5 w-5" /> Org ID Missing</>
          ) : (
            <><PlusCircle className="mr-2 h-5 w-5" /> Create New Base Class</>
          )}
        </Button>
      </div>

      {pageError && (baseClasses.length > 0 || userOrgId) && (
         <div className="p-3 bg-red-100 text-red-700 border border-red-400 rounded">
           Error: {pageError}
         </div>
      )}
      {/* Show currentProcessStatus as a banner only if it's an error and modal is closed */}
      {currentProcessStatus && currentProcessStatus.toLowerCase().startsWith('error') && !isModalOpen && (
         <div className="p-3 border rounded bg-red-100 text-red-700 border-red-400">
           Last Operation Status: {currentProcessStatus}
         </div>
      )}

      <div>
        {baseClasses.length > 0 ? (
          <BaseClassCardGrid
            baseClasses={baseClasses}
            onViewDetails={handleViewDetails}
            onEdit={handleEdit}
            onClone={handleClone}
            onArchive={handleArchive}
            onDelete={handleDelete}
          />
        ) : (
          !isLoadingPage && !isLoadingOrg && !pageError && baseClasses.length === 0 && userOrgId && (
            <div className="text-center py-12">
              <BookOpenText className="mx-auto h-16 w-16 text-slate-400 dark:text-slate-500" />
              <h3 className="mt-4 text-xl font-semibold text-slate-700 dark:text-slate-300">No Base Classes Yet</h3>
              <p className="mt-2 text-sm text-slate-500 dark:text-slate-400">
                Get started by creating your first base class.
              </p>
              <Button 
                onClick={handleModalOpen} 
                variant="outline" 
                className="mt-6" 
                disabled={isProcessingRequest || isLoadingOrg || !userOrgId}
              >
                {isProcessingRequest && currentProcessStatus ? (
                  <><Loader2 className="mr-2 h-4 w-4 animate-spin" /> {currentProcessStatus.substring(0,18)}...</>
                ) : isLoadingOrg ? (
                  <><Loader2 className="mr-2 h-4 w-4 animate-spin" /> Loading Context...</>
                ) : !userOrgId ? (
                  <><Plus className="mr-2 h-4 w-4" /> Org ID Missing</>
                ) : (
                  <><Plus className="mr-2 h-4 w-4" /> Create Base Class</>
                )}
              </Button>
            </div>
          )
        )}
      </div>
      
      {isModalOpen && userOrgId && (
        <CreateBaseClassModal
          isOpen={isModalOpen}
          onClose={handleModalClose} // Use new handler
          onSubmit={handleCreateBaseClassSubmit}
          organisationId={userOrgId} 
          isProcessing={isProcessingRequest} // Pass processing state
          currentStatusMessage={currentProcessStatus} // Pass status message
        />
      )}
    </div>
  );
} 