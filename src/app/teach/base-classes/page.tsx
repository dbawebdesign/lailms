"use client";

import React, { useState, useEffect, useCallback } from "react";
import { BaseClass, BaseClassCreationData } from "@/types/teach";
import { BaseClassCardGrid } from "@/components/teach/BaseClassCardGrid";
import { CreateBaseClassModal } from "@/components/teach/CreateBaseClassModal";
import { Button } from "@/components/ui/button";
import { PlusCircle } from "lucide-react";

// --- Mock API --- (To be moved to a separate file e.g., src/lib/api/teach-mocks.ts later)
const MOCK_BASE_CLASSES: BaseClass[] = [
  {
    id: "1",
    name: "Introduction to Programming",
    description: "Learn the fundamentals of programming using Python.",
    subject: "Computer Science",
    gradeLevel: "9-10",
    lengthInWeeks: 16,
    creationDate: new Date("2023-01-15T10:00:00Z").toISOString(),
  },
  {
    id: "2",
    name: "World History: Ancient Civilizations",
    description: "Explore the rise and fall of ancient empires.",
    subject: "History",
    gradeLevel: "7-8",
    lengthInWeeks: 12,
    creationDate: new Date("2023-03-01T14:30:00Z").toISOString(),
  },
  {
    id: "3",
    name: "Algebra I",
    description: "Covering linear equations, inequalities, and functions.",
    subject: "Mathematics",
    gradeLevel: "8-9",
    lengthInWeeks: 38,
    creationDate: new Date("2022-09-01T09:00:00Z").toISOString(),
  },
];

let nextId = MOCK_BASE_CLASSES.length + 1;

const mockFetchBaseClasses = async (): Promise<BaseClass[]> => {
  console.log("Mock API: Fetching base classes...");
  await new Promise(resolve => setTimeout(resolve, 500)); // Simulate network delay
  return [...MOCK_BASE_CLASSES]; // Return a copy
};

const mockCreateBaseClass = async (data: BaseClassCreationData): Promise<BaseClass> => {
  console.log("Mock API: Creating base class...", data);
  await new Promise(resolve => setTimeout(resolve, 500));
  const newBaseClass: BaseClass = {
    ...data,
    id: (nextId++).toString(),
    creationDate: new Date().toISOString(),
  };
  MOCK_BASE_CLASSES.push(newBaseClass); // Add to our mock "DB"
  return newBaseClass;
};

// Mock delete function for now
const mockDeleteBaseClass = async (id: string): Promise<void> => {
  console.log(`Mock API: Deleting base class with id ${id}`);
  await new Promise(resolve => setTimeout(resolve, 300));
  const index = MOCK_BASE_CLASSES.findIndex(bc => bc.id === id);
  if (index !== -1) {
    MOCK_BASE_CLASSES.splice(index, 1);
  }
  // In a real API, you might return success/failure or handle errors
};
// --- End Mock API ---

export default function TeachBaseClassesPage() {
  const [baseClasses, setBaseClasses] = useState<BaseClass[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isModalOpen, setIsModalOpen] = useState(false);

  const loadBaseClasses = useCallback(async () => {
    setIsLoading(true);
    try {
      const data = await mockFetchBaseClasses();
      setBaseClasses(data);
    } catch (error) {
      console.error("Failed to load base classes:", error);
      // Handle error state, e.g., show a toast
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    loadBaseClasses();
  }, [loadBaseClasses]);

  const handleCreateBaseClassSubmit = async (data: BaseClassCreationData) => {
    // In a real app, you would call your API service here
    const newBaseClass = await mockCreateBaseClass(data);
    setBaseClasses((prevClasses) => [...prevClasses, newBaseClass]);
    // Optionally re-sort or just append and let current sort handle it
  };

  // Placeholder action handlers
  const handleViewDetails = (id: string) => console.log("View Details:", id);
  const handleEdit = (id: string) => console.log("Edit:", id); // Later, this might open modal with data
  const handleClone = (id: string) => console.log("Clone:", id);
  const handleArchive = (id: string) => console.log("Archive:", id);
  const handleDelete = async (id: string) => {
    console.log("Delete:", id);
    await mockDeleteBaseClass(id);
    // Refresh the list from the "DB" or remove locally
    setBaseClasses(prevClasses => prevClasses.filter(bc => bc.id !== id));
    // Add toast notification for deletion
  };

  if (isLoading && baseClasses.length === 0) {
    return <div className="container mx-auto p-4 text-center">Loading base classes...</div>;
  }

  return (
    <div className="container mx-auto p-4 md:p-6 lg:p-8">
      <header className="mb-6 flex items-center justify-between">
        <h1 className="text-3xl font-bold tracking-tight">My Base Classes</h1>
        <Button onClick={() => setIsModalOpen(true)}>
          <PlusCircle className="mr-2 h-4 w-4" /> Create New Base Class
        </Button>
      </header>

      <BaseClassCardGrid
        baseClasses={baseClasses}
        onViewDetails={handleViewDetails}
        onEdit={handleEdit}
        onClone={handleClone}
        onArchive={handleArchive}
        onDelete={handleDelete}
      />

      <CreateBaseClassModal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        onSubmit={handleCreateBaseClassSubmit}
      />
    </div>
  );
} 