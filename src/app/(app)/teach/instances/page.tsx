"use client";

import React, { useState, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
// Types will be needed for ClassInstance and eventually BaseClass if we enrich data here
import { ClassInstance } from "@/types/teach"; 
// The new table component we will create
import { AllInstancesTable } from "@/components/teach/AllInstancesTable"; 
import { Button } from "@/components/ui/button";
import { PlusCircle } from "lucide-react";
import { useToast } from "@/components/ui/use-toast";

// --- Mock API Stubs --- 
// We'll need a mock function to fetch ALL instances for a teacher,
// potentially enriched with base class names.

// Example of an enriched instance type (can also be defined in types/teach.ts)
interface EnrichedClassInstance extends ClassInstance {
  baseClassName: string;
  // potentially baseClassSubject, etc.
}

const MOCK_ALL_ENRICHED_INSTANCES: EnrichedClassInstance[] = [
  // Assuming MOCK_CLASS_INSTANCES_DB and MOCK_BASE_CLASSES_DB from the other file are accessible 
  // or we redefine/import them. For simplicity, let's create a few here.
  {
    id: "inst101", baseClassId: "1", baseClassName: "Introduction to Programming", name: "Prog - Fall 2023", 
    enrollmentCode: "PROG101F23", status: "completed", creationDate: new Date("2023-08-01").toISOString(), 
    startDate: new Date("2023-09-01").toISOString(), endDate: new Date("2023-12-15").toISOString(), 
    period: "Period 1", capacity: 30
  },
  {
    id: "inst102", baseClassId: "1", baseClassName: "Introduction to Programming", name: "Prog - Spring 2024", 
    enrollmentCode: "PROG101S24", status: "active", creationDate: new Date("2023-12-01").toISOString(), 
    startDate: new Date("2024-01-15").toISOString(), endDate: new Date("2024-05-10").toISOString(), 
    period: "Period 2", capacity: 25
  },
  {
    id: "hist201", baseClassId: "2", baseClassName: "World History: Ancient Times", name: "History - Section A", 
    enrollmentCode: "HIST201A", status: "active", creationDate: new Date("2023-12-15").toISOString(), 
    startDate: new Date("2024-01-20").toISOString(), capacity: 35
  },
  {
    id: "inst103", baseClassId: "1", baseClassName: "Introduction to Programming", name: "Prog - Summer 2024", 
    enrollmentCode: "PROG101SU24", status: "upcoming", creationDate: new Date("2024-04-01").toISOString(), 
    startDate: new Date("2024-06-01").toISOString(), endDate: new Date("2024-07-30").toISOString()
  },
];

const mockFetchAllEnrichedInstances = async (): Promise<EnrichedClassInstance[]> => {
  console.log("Mock API: Fetching all enriched instances...");
  await new Promise(resolve => setTimeout(resolve, 600));
  // Sort by creation date descending by default for a timeline view
  return [...MOCK_ALL_ENRICHED_INSTANCES].sort((a,b) => new Date(b.creationDate).getTime() - new Date(a.creationDate).getTime());
};

// --- End Mock API Stubs ---

export default function AllInstancesPage() {
  const router = useRouter();
  const { toast } = useToast();
  const [instances, setInstances] = useState<EnrichedClassInstance[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  const loadInstances = useCallback(async () => {
    setIsLoading(true);
    try {
      const data = await mockFetchAllEnrichedInstances();
      setInstances(data);
    } catch (error) {
      console.error("Failed to load all instances:", error);
      toast({ title: "Error Loading Instances", description: "Could not load class instances.", variant: "destructive" });
    } finally {
      setIsLoading(false);
    }
  }, [toast]);

  useEffect(() => {
    loadInstances();
  }, [loadInstances]);

  // Placeholder action handlers - these would interact with modals or navigate
  const handleEditInstance = (instanceId: string) => {
    console.log("Edit instance:", instanceId);
    // router.push(`/teach/base-classes/${findBaseClassId(instanceId)}/instance/${instanceId}/edit`); // Or open a modal
    toast({title: "Edit Action", description: `Would edit instance ${instanceId}`});
  };

  const handleArchiveInstance = (instanceId: string) => {
    console.log("Archive instance:", instanceId);
    // Mock update status and refresh list
    setInstances(prev => prev.map(inst => inst.id === instanceId ? {...inst, status: "archived"} : inst));
    toast({title: "Archive Action", description: `Instance ${instanceId} would be archived.`});
  };

  const handleViewStudents = (instanceId: string) => {
    console.log("View students for instance:", instanceId);
    // router.push(`/teach/instances/${instanceId}/students`);
    toast({title: "View Students", description: `Would show students for ${instanceId}`});
  };
  
  const handleViewInstanceDetails = (instance: EnrichedClassInstance) => {
    console.log("View details for instance:", instance.id, "of base class:", instance.baseClassId);
    router.push(`/teach/base-classes/${instance.baseClassId}`); // Navigate to parent base class detail page
  };

  if (isLoading) {
    return <div className="container mx-auto py-10 px-4 md:px-6 lg:px-8 text-center">Loading all instances...</div>;
  }

  return (
    <div className="container mx-auto p-4 md:p-6 lg:p-8 space-y-8">
      <header className="mb-6 flex items-center justify-between">
        <h1 className="text-3xl lg:text-[36px] font-bold tracking-tight">All My Class Instances</h1>
        {/* Optional: A global "Create New Instance" button could go here, 
            but it might be better placed on the Base Class specific pages 
            or require selecting a Base Class first. For now, we omit it here. */}
      </header>

      <AllInstancesTable 
        instances={instances}
        onEditInstance={handleEditInstance}
        onArchiveInstance={handleArchiveInstance}
        onViewStudents={handleViewStudents}
        onViewInstanceDetails={handleViewInstanceDetails}
      />
    </div>
  );
} 