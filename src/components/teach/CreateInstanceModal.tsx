"use client";

import React, { useState, useEffect } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { format } from "date-fns";
import { CalendarIcon } from "lucide-react";

import { cn } from "@/lib/utils"; // Assuming you have a utility for classnames
import { ClassInstance, ClassInstanceCreationData } from "@/types/teach";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Calendar } from "@/components/ui/calendar";
import { useToast } from "@/components/ui/use-toast";

// Schema for form validation
const instanceFormSchema = z.object({
  name: z.string().min(3, { message: "Instance name must be at least 3 characters." }),
  startDate: z.date().optional(),
  endDate: z.date().optional(),
  period: z.string().optional(),
  capacity: z.coerce.number().int().positive().optional(), // Ensure it's a positive integer if provided
  baseClassId: z.string(), // Required, but will be passed as a prop, not a form field typically
}).refine(data => {
  // Optional: Add validation for endDate being after startDate if both are provided
  if (data.startDate && data.endDate && data.endDate < data.startDate) {
    return false;
  }
  return true;
}, {
  message: "End date cannot be before start date.",
  path: ["endDate"], // Point error to endDate field
});

type InstanceFormValues = z.infer<typeof instanceFormSchema>;

interface CreateInstanceModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (data: ClassInstanceCreationData) => Promise<void>;
  baseClassId: string;
  initialData?: ClassInstance | null;
}

export const CreateInstanceModal: React.FC<CreateInstanceModalProps> = ({
  isOpen,
  onClose,
  onSubmit,
  baseClassId,
  initialData,
}) => {
  const { toast } = useToast();
  const isEditing = !!initialData;

  const form = useForm<InstanceFormValues>({
    resolver: zodResolver(instanceFormSchema),
  });

  useEffect(() => {
    if (isOpen) {
      if (isEditing && initialData) {
        form.reset({
          name: initialData.name,
          startDate: initialData.startDate ? new Date(initialData.startDate) : undefined,
          endDate: initialData.endDate ? new Date(initialData.endDate) : undefined,
          period: initialData.period || "",
          capacity: initialData.capacity || undefined,
          baseClassId: initialData.baseClassId,
        });
      } else {
        form.reset({
          name: "",
          startDate: undefined,
          endDate: undefined,
          period: "",
          capacity: undefined,
          baseClassId: baseClassId,
        });
      }
    }
  }, [isOpen, isEditing, initialData, baseClassId, form]);

  const handleFormSubmit = async (values: InstanceFormValues) => {
    const submissionData: ClassInstanceCreationData = {
      ...values,
      startDate: values.startDate ? values.startDate.toISOString() : undefined,
      endDate: values.endDate ? values.endDate.toISOString() : undefined,
    };

    try {
      await onSubmit(submissionData);
      toast({
        title: isEditing ? "Instance Updated!" : "Instance Created!",
        description: `Successfully ${isEditing ? 'updated' : 'created'} instance: ${values.name}.`,
      });
      onClose();
    } catch (error) {
      console.error(`Failed to ${isEditing ? 'update' : 'create'} class instance:`, error);
      toast({
        title: "Error",
        description: `Failed to ${isEditing ? 'update' : 'create'} class instance. Please try again.`,
        variant: "destructive",
      });
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{isEditing ? "Edit" : "Create New"} Class Instance</DialogTitle>
          <DialogDescription>
            {isEditing ? "Update the details for this class instance." : "Fill in the details for the new instance of this base class."}
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={form.handleSubmit(handleFormSubmit)} className="space-y-4 py-2 pb-4">
          <input type="hidden" {...form.register("baseClassId")} />
          
          <div className="space-y-2">
            <Label htmlFor="name">Instance Name</Label>
            <Input id="name" {...form.register("name")} placeholder="e.g., Fall 2024 - Period 1" />
            {form.formState.errors.name && (
              <p className="text-sm text-red-500">{form.formState.errors.name.message}</p>
            )}
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="startDate">Start Date (Optional)</Label>
              <Popover>
                <PopoverTrigger asChild>
                  <Button
                    variant={"outline"}
                    className={cn(
                      "w-full justify-start text-left font-normal",
                      !form.watch("startDate") && "text-muted-foreground"
                    )}
                  >
                    <CalendarIcon className="mr-2 h-4 w-4" />
                    {form.watch("startDate") ? format(form.watch("startDate")!, "PPP") : <span>Pick a date</span>}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0">
                  <Calendar
                    mode="single"
                    selected={form.watch("startDate")}
                    onSelect={(date) => form.setValue("startDate", date || undefined, { shouldValidate: true })}
                    initialFocus
                  />
                </PopoverContent>
              </Popover>
            </div>

            <div className="space-y-2">
              <Label htmlFor="endDate">End Date (Optional)</Label>
              <Popover>
                <PopoverTrigger asChild>
                  <Button
                    variant={"outline"}
                    className={cn(
                      "w-full justify-start text-left font-normal",
                      !form.watch("endDate") && "text-muted-foreground"
                    )}
                  >
                    <CalendarIcon className="mr-2 h-4 w-4" />
                    {form.watch("endDate") ? format(form.watch("endDate")!, "PPP") : <span>Pick a date</span>}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0">
                  <Calendar
                    mode="single"
                    selected={form.watch("endDate")}
                    onSelect={(date) => form.setValue("endDate", date || undefined, { shouldValidate: true })}
                    disabled={(date) =>
                      form.watch("startDate") ? date < form.watch("startDate")! : false
                    }
                    initialFocus
                  />
                </PopoverContent>
              </Popover>
               {form.formState.errors.endDate && (
                <p className="text-sm text-red-500">{form.formState.errors.endDate.message}</p>
              )}
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="period">Period (Optional)</Label>
              <Input id="period" {...form.register("period")} placeholder="e.g., Period 3, MWF 10am" />
            </div>
            <div className="space-y-2">
              <Label htmlFor="capacity">Capacity (Optional)</Label>
              <Input id="capacity" type="number" {...form.register("capacity")} placeholder="e.g., 30" />
              {form.formState.errors.capacity && (
                <p className="text-sm text-red-500">{form.formState.errors.capacity.message}</p>
              )}
            </div>
          </div>

          <DialogFooter className="pt-4">
            <Button type="button" variant="outline" onClick={onClose}>
              Cancel
            </Button>
            <Button type="submit" disabled={form.formState.isSubmitting}>
              {form.formState.isSubmitting ? (isEditing ? "Saving..." : "Creating...") : (isEditing ? "Save Changes" : "Create Instance")}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}; 