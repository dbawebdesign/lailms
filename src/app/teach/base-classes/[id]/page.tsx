"use client";

import React, { useState, useEffect, useCallback } from "react";
import { useParams, useRouter } from "next/navigation"; // For accessing route params
import { format } from "date-fns"; // Added import for format

import { BaseClass, ClassInstance, ClassInstanceCreationData } from "@/types/teach";
import { Button } from "@/components/ui/button";
import { ArrowLeft, PlusCircle, Edit3, Trash2, Archive } from "lucide-react"; // More icons

import { StructureTabs } from "@/components/teach/StructureTabs";
import { InstanceTable } from "@/components/teach/InstanceTable";
import { CreateInstanceModal } from "@/components/teach/CreateInstanceModal";
import { useToast } from "@/components/ui/use-toast";
import { Badge } from "@/components/ui/badge"; // For displaying base class status if available

// --- Mock API Stubs --- (Assume these would live in a proper API service layer)
// For BaseClass (extending previous mocks slightly)
const MOCK_BASE_CLASSES_DB: BaseClass[] = [
  {
    id: "1", name: "Introduction to Programming", description: "Learn Python basics.", 
    subject: "CS", gradeLevel: "9-10", lengthInWeeks: 16, creationDate: new Date("2023-01-15").toISOString(),
  },
  {
    id: "2", name: "World History: Ancient Times", description: "From early humans to empires.", 
    subject: "History", gradeLevel: "7-8", lengthInWeeks: 12, creationDate: new Date("2023-03-01").toISOString(),
  },
];

const mockFetchBaseClassById = async (id: string): Promise<BaseClass | null> => {
  await new Promise(resolve => setTimeout(resolve, 300));
  const found = MOCK_BASE_CLASSES_DB.find(bc => bc.id === id) || null;
  console.log(`Mock: Fetching BaseClass by ID ${id}, Found:`, found);
  return found;
};

// For ClassInstances
const MOCK_CLASS_INSTANCES_DB: ClassInstance[] = [
  { 
    id: "inst101", baseClassId: "1", name: "Prog - Fall 2023", enrollmentCode: "PROG101F23", 
    status: "completed", creationDate: new Date().toISOString(), startDate: new Date("2023-09-01").toISOString(), endDate: new Date("2023-12-15").toISOString(), period: "Period 1", capacity: 30
  },
  { 
    id: "inst102", baseClassId: "1", name: "Prog - Spring 2024", enrollmentCode: "PROG101S24", 
    status: "active", creationDate: new Date().toISOString(), startDate: new Date("2024-01-15").toISOString(), endDate: new Date("2024-05-10").toISOString(), period: "Period 2", capacity: 25
  },
  { 
    id: "inst103", baseClassId: "1", name: "Prog - Summer 2024", enrollmentCode: "PROG101SU24", 
    status: "upcoming", creationDate: new Date().toISOString(), startDate: new Date("2024-06-01").toISOString(), endDate: new Date("2024-07-30").toISOString()
  },
  { 
    id: "hist201", baseClassId: "2", name: "History - Section A", enrollmentCode: "HIST201A", 
    status: "active", creationDate: new Date().toISOString(), startDate: new Date("2024-01-20").toISOString(), capacity: 35
  },
];
let nextInstanceId = 300;

const mockFetchInstancesForBaseClass = async (baseClassId: string): Promise<ClassInstance[]> => {
  await new Promise(resolve => setTimeout(resolve, 400));
  const instances = MOCK_CLASS_INSTANCES_DB.filter(inst => inst.baseClassId === baseClassId);
  console.log(`Mock: Fetching instances for BaseClass ID ${baseClassId}, Found:`, instances);
  return instances;
};

const mockCreateClassInstance = async (data: ClassInstanceCreationData): Promise<ClassInstance> => {
  await new Promise(resolve => setTimeout(resolve, 500));
  const newInstance: ClassInstance = {
    ...data,
    id: `inst${nextInstanceId++}`,
    enrollmentCode: Math.random().toString(36).substring(2, 8).toUpperCase(), // Random code
    creationDate: new Date().toISOString(),
    status: data.startDate && new Date(data.startDate) > new Date() ? "upcoming" : "active",
  };
  MOCK_CLASS_INSTANCES_DB.push(newInstance);
  console.log("Mock: Created ClassInstance", newInstance);
  return newInstance;
};

const mockUpdateClassInstance = async (instanceData: ClassInstance): Promise<ClassInstance> => {
  await new Promise(resolve => setTimeout(resolve, 300));
  const index = MOCK_CLASS_INSTANCES_DB.findIndex(i => i.id === instanceData.id);
  if (index !== -1) {
    MOCK_CLASS_INSTANCES_DB[index] = { ...MOCK_CLASS_INSTANCES_DB[index], ...instanceData };
    console.log("Mock: Updated ClassInstance", MOCK_CLASS_INSTANCES_DB[index]);
    return MOCK_CLASS_INSTANCES_DB[index];
  }
  throw new Error("Instance not found for update");
};

const mockArchiveClassInstance = async (instanceId: string): Promise<ClassInstance> => {
  await new Promise(resolve => setTimeout(resolve, 300));
  const index = MOCK_CLASS_INSTANCES_DB.findIndex(i => i.id === instanceId);
  if (index !== -1) {
    MOCK_CLASS_INSTANCES_DB[index].status = "archived";
    console.log("Mock: Archived ClassInstance", MOCK_CLASS_INSTANCES_DB[index]);
    return MOCK_CLASS_INSTANCES_DB[index];
  }
  throw new Error("Instance not found for archive");
};
// --- End Mock API Stubs ---

export default function BaseClassDetailPage() {
  const router = useRouter();
  const params = useParams();
  const { toast } = useToast();
  const baseClassId = params.id as string;

  const [baseClass, setBaseClass] = useState<BaseClass | null>(null);
  const [instances, setInstances] = useState<ClassInstance[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isInstanceModalOpen, setIsInstanceModalOpen] = useState(false);
  const [editingInstance, setEditingInstance] = useState<ClassInstance | null>(null);

  const loadData = useCallback(async () => {
    if (!baseClassId) return;
    setIsLoading(true);
    try {
      const [bcData, instData] = await Promise.all([
        mockFetchBaseClassById(baseClassId),
        mockFetchInstancesForBaseClass(baseClassId),
      ]);
      setBaseClass(bcData);
      setInstances(instData);
    } catch (error) {
      console.error("Failed to load base class details:", error);
      toast({ title: "Error Loading Data", description: "Could not load base class details.", variant: "destructive" });
      // router.push("/teach/base-classes"); // Optional: redirect if base class not found
    } finally {
      setIsLoading(false);
    }
  }, [baseClassId, toast]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const handleCreateInstanceSubmit = async (data: ClassInstanceCreationData) => {
    try {
      const newInstance = await mockCreateClassInstance(data);
      setInstances(prev => [...prev, newInstance].sort((a,b) => new Date(b.creationDate).getTime() - new Date(a.creationDate).getTime()));
      setIsInstanceModalOpen(false);
    } catch (error) {
      console.error("Error creating instance:", error);
      toast({ title: "Instance Creation Failed", description: String(error), variant: "destructive" });
    }
  };
  
  const handleEditInstanceSubmit = async (data: ClassInstanceCreationData) => {
    if (!editingInstance) return;
    try {
      // Simulate update by creating a new object with merged data
      const updatedInstanceData: ClassInstance = { 
        ...editingInstance, 
        ...data,
        // Ensure baseClassId is from the original editingInstance if not in `data` (though it should be)
        baseClassId: editingInstance.baseClassId 
      };

      const updatedInstance = await mockUpdateClassInstance(updatedInstanceData);
      setInstances(prev => prev.map(inst => inst.id === updatedInstance.id ? updatedInstance : inst));
      setIsInstanceModalOpen(false);
      setEditingInstance(null);
      toast({ title: "Instance Updated", description: `Instance ${updatedInstance.name} updated.` });
    } catch (error) {
      console.error("Error updating instance:", error);
      toast({ title: "Instance Update Failed", description: String(error), variant: "destructive" });
    }
  };

  const handleOpenEditModal = (instance: ClassInstance) => {
    setEditingInstance(instance);
    setIsInstanceModalOpen(true);
  };

  const handleArchiveInstance = async (instanceId: string) => {
    try {
      const archivedInstance = await mockArchiveClassInstance(instanceId);
      setInstances(prev => prev.map(inst => inst.id === archivedInstance.id ? archivedInstance : inst));
      toast({ title: "Instance Archived", description: `Instance ${archivedInstance.name} has been archived.` });
    } catch (error) {
      console.error("Error archiving instance:", error);
      toast({ title: "Archiving Failed", description: String(error), variant: "destructive" });
    }
  };
  
  const handleModalClose = () => {
    setIsInstanceModalOpen(false);
    setEditingInstance(null); // Clear editing state when modal closes
  }

  if (isLoading) {
    return <div className="container mx-auto py-10 px-4 md:px-6 lg:px-8 text-center">Loading details...</div>;
  }

  if (!baseClass) {
    return (
      <div className="container mx-auto py-10 px-4 md:px-6 lg:px-8 text-center">
        <h2 className="text-2xl font-semibold mb-6">Base Class Not Found</h2>
        <Button onClick={() => router.push("/teach/base-classes")}>
          <ArrowLeft className="mr-2 h-4 w-4" /> Back to Base Classes
        </Button>
      </div>
    );
  }

  return (
    <div className="container mx-auto p-4 md:p-6 lg:p-8 space-y-8">
      <header className="space-y-4">
        <Button variant="outline" size="sm" onClick={() => router.push("/teach/base-classes")} className="mb-4 text-sm">
          <ArrowLeft className="mr-2 h-4 w-4" /> Back to All Base Classes
        </Button>
        <div className="flex flex-col sm:flex-row justify-between sm:items-center gap-2">
            <h1 className="text-3xl lg:text-[36px] font-bold tracking-tight flex items-center gap-2">
                {baseClass.name}
            </h1>
        </div>
        {baseClass.description && (
          <p className="text-base text-muted-foreground max-w-3xl leading-relaxed pt-1">{baseClass.description}</p>
        )}
        <div className="text-sm text-muted-foreground flex flex-wrap gap-x-6 gap-y-2 pt-3">
            <span><strong>Subject:</strong> {baseClass.subject || "N/A"}</span>
            <span><strong>Grade:</strong> {baseClass.gradeLevel || "N/A"}</span>
            <span><strong>Length:</strong> {baseClass.lengthInWeeks} weeks</span>
            <span><strong>Created:</strong> {format(new Date(baseClass.creationDate), "MMM d, yyyy")}</span>
        </div>
      </header>
      
      <section className="pt-6">
        <div className="flex justify-between items-center mb-6">
            <h2 className="text-2xl font-semibold">Class Instances</h2>
            <Button onClick={() => {
                setEditingInstance(null);
                setIsInstanceModalOpen(true);
            }} className="px-6 py-3">
                <PlusCircle className="mr-2 h-4 w-4" /> Create New Instance
            </Button>
        </div>
        <InstanceTable 
            instances={instances} 
            baseClassId={baseClassId}
            onEditInstance={handleOpenEditModal}
            onArchiveInstance={handleArchiveInstance}
            onViewStudents={(id) => console.log("View students for instance:", id)}
        />
      </section>

      <section className="pt-8">
        <h2 className="text-2xl font-semibold mb-6">Class Structure & Content</h2>
        <StructureTabs baseClassId={baseClassId} />
      </section>

      {(isInstanceModalOpen) && (
        <CreateInstanceModal
          isOpen={isInstanceModalOpen}
          onClose={handleModalClose}
          onSubmit={editingInstance ? handleEditInstanceSubmit : handleCreateInstanceSubmit}
          baseClassId={baseClassId}
        />
      )}
    </div>
  );
} 