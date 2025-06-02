"use client";

import React, { useState, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
// Types will be needed for ClassInstance and eventually BaseClass if we enrich data here
import { EnrichedClassInstance } from "@/types/teach"; 
// The new table component we will create
import { AllInstancesTable } from "@/components/teach/AllInstancesTable"; 
import { Button } from "@/components/ui/button";
import { PlusCircle } from "lucide-react";
import { useToast } from "@/components/ui/use-toast";

// Real API function to fetch enriched instances
const fetchAllEnrichedInstances = async (): Promise<EnrichedClassInstance[]> => {
  const response = await fetch('/api/teach/instances', {
    method: 'GET',
    headers: {
      'Content-Type': 'application/json',
    },
  });

  if (!response.ok) {
    const errorData = await response.json();
    throw new Error(errorData.error || 'Failed to fetch instances');
  }

  return response.json();
};

export default function AllInstancesPage() {
  const router = useRouter();
  const { toast } = useToast();
  const [instances, setInstances] = useState<EnrichedClassInstance[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  const loadInstances = useCallback(async () => {
    setIsLoading(true);
    try {
      const data = await fetchAllEnrichedInstances();
      setInstances(data);
    } catch (error) {
      console.error("Failed to load all instances:", error);
      toast({ 
        title: "Error Loading Instances", 
        description: error instanceof Error ? error.message : "Could not load class instances.", 
        variant: "destructive" 
      });
    } finally {
      setIsLoading(false);
    }
  }, [toast]);

  useEffect(() => {
    loadInstances();
  }, [loadInstances]);

  // Action handlers
  const handleEditInstance = (instanceId: string, baseClassId: string) => {
    console.log("Edit instance:", instanceId, "from base class:", baseClassId);
    router.push(`/teach/base-classes/${baseClassId}`);
  };

  const handleArchiveInstance = async (instanceId: string) => {
    try {
      // This would call an API to update the instance status
      // For now, we'll just update the local state
      setInstances(prev => prev.map(inst => 
        inst.id === instanceId ? {...inst, status: "archived" as const} : inst
      ));
      toast({
        title: "Instance Archived", 
        description: `Instance has been archived successfully.`
      });
    } catch (error) {
      toast({
        title: "Archive Failed", 
        description: "Could not archive instance.", 
        variant: "destructive"
      });
    }
  };

  const handleViewStudents = (instanceId: string) => {
    router.push(`/teach/instances/${instanceId}/students`);
  };
  
  const handleViewInstanceDetails = (instance: EnrichedClassInstance) => {
    router.push(`/teach/base-classes/${instance.baseClassId}`);
  };

  if (isLoading) {
    return (
      <div className="container mx-auto py-10 px-4 md:px-6 lg:px-8">
        <div className="flex items-center justify-center py-12">
          <div className="text-center space-y-4">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto"></div>
            <p className="text-muted-foreground">Loading class instances...</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="container mx-auto p-4 md:p-6 lg:p-8 space-y-8">
      <header className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-3xl lg:text-[36px] font-bold tracking-tight">My Class Instances</h1>
          <p className="text-muted-foreground mt-2">Manage all your active and past class instances</p>
        </div>
        <Button 
          onClick={() => router.push('/teach/base-classes')}
          className="bg-brand-gradient hover:opacity-90 transition-airy"
        >
          <PlusCircle className="w-4 h-4 mr-2" />
          Create New Instance
        </Button>
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