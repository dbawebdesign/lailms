"use client";

import React, { useState, useEffect, useCallback } from "react";
import { BaseClass, BaseClassCreationData } from "@/types/teach";
import { BaseClassCardGrid } from "@/components/teach/BaseClassCardGrid";
import { CreateBaseClassModal } from "@/components/teach/CreateBaseClassModal";
import { Button } from "@/components/ui/button";
import { PlusCircle, BookOpenText, Plus } from "lucide-react";
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
  const [baseClasses, setBaseClasses] = useState<BaseClass[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [error, setError] = useState<string | null>(null); // For displaying errors

  const loadBaseClasses = useCallback(async () => {
    setIsLoading(true);
    setError(null);
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
      setError(err.message || "An unexpected error occurred.");
      // toast.error("Failed to load base classes: " + err.message);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    loadBaseClasses();
  }, [loadBaseClasses]);

  const handleCreateBaseClassSubmit = async (data: BaseClassCreationData) => {
    setIsLoading(true); // Indicate loading state for creation
    setError(null);
    try {
      const response = await fetch("/api/teach/base-classes", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(data),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || "Failed to create base class");
      }

      const newBaseClass: BaseClass = await response.json();
      setBaseClasses((prevClasses) => [...prevClasses, newBaseClass].sort((a, b) => new Date(b.creationDate).getTime() - new Date(a.creationDate).getTime()));
      setIsModalOpen(false); // Close modal on success
      // toast.success("Base Class created successfully!");
    } catch (err: any) {
      console.error("Failed to create base class:", err);
      setError(err.message || "An unexpected error occurred during creation.");
      // toast.error("Failed to create base class: " + err.message);
      // Optionally, keep the modal open if creation fails and display error within modal
    } finally {
      setIsLoading(false);
    }
  };

  // Placeholder action handlers - these can be implemented later
  const handleViewDetails = (id: string) => {
    console.log("View Details:", id);
    // Potentially navigate to /teach/base-classes/[id]
    // router.push(`/teach/base-classes/${id}`); // Make sure to import and setup useRouter from 'next/navigation'
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
    setError(null);

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
      setError(err.message || "An unexpected error occurred during deletion.");
      // toast.error("Failed to delete base class: " + err.message);
    }
  };

  if (isLoading && baseClasses.length === 0) {
    return <div className="container mx-auto p-4 text-center">Loading base classes...</div>;
  }
  
  // Display error message if any
  if (error && baseClasses.length === 0) { // Only show full page error if no data loaded
    return <div className="container mx-auto p-4 text-center text-red-600">Error: {error}</div>;
  }


  return (
    <div className="container mx-auto p-6">
      <div className="flex justify-between items-center mb-8">
        <h1 className="text-3xl font-semibold tracking-tight text-slate-900 dark:text-slate-50">My Base Classes</h1>
        <Button onClick={() => setIsModalOpen(true)} variant="default" size="lg">
          <PlusCircle className="mr-2 h-5 w-5" /> Create New Base Class
        </Button>
      </div>

      {/* Display general error here if some classes loaded but an error occurred later e.g. on delete */}
      {error && baseClasses.length > 0 && (
         <div className="mb-4 p-3 bg-red-100 text-red-700 border border-red-400 rounded">\
           Error: {error}\
         </div>
      )}

      {baseClasses.length > 0 ? (
        <BaseClassCardGrid
          baseClasses={baseClasses}
          onViewDetails={handleViewDetails}
          onEdit={handleEdit}
          onClone={handleClone}
          onArchive={handleArchive}
          onDelete={handleDelete} // Pass the real delete handler
        />
      ) : (
        // This block is shown if not loading and no base classes (and no initial loading error)
        !isLoading && !error && baseClasses.length === 0 && (
          <div className="text-center py-12">
            <BookOpenText className="mx-auto h-16 w-16 text-slate-400 dark:text-slate-500" />
            <h3 className="mt-4 text-xl font-semibold text-slate-700 dark:text-slate-300\">No Base Classes Yet</h3>
            <p className="mt-2 text-sm text-slate-500 dark:text-slate-400">
              Get started by creating your first base class. It will serve as a template for your course instances.
            </p>
            <Button onClick={() => setIsModalOpen(true)} variant="outline" className="mt-6">
              <Plus className="mr-2 h-4 w-4" /> Create Base Class
            </Button>
          </div>
        )
      )}
      
      <CreateBaseClassModal
        isOpen={isModalOpen}
        onClose={() => {
          setIsModalOpen(false);
          setError(null); // Clear error when closing modal
        }}
        onSubmit={handleCreateBaseClassSubmit}
        // error={error} // Optionally pass error to be displayed within the modal
      />
    </div>
  );
} 