"use client";

import React, { useState, useEffect } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";

import { BaseClassCreationData } from "@/types/teach";
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
import { Textarea } from "@/components/ui/textarea";
import { Slider } from "@/components/ui/slider";
import { useToast } from "@/components/ui/use-toast";

const PRESET_WEEKS = {
  QUARTER: 10,
  SEMESTER: 16, // Adjusted from 15 to 16 for common semester length
  FULL_YEAR: 38, // Adjusted from 36 to 38 for a typical school year
};

const baseClassFormSchema = z.object({
  name: z.string().min(3, { message: "Name must be at least 3 characters." }),
  description: z.string().optional(),
  subject: z.string().optional(),
  gradeLevel: z.string().optional(),
  lengthInWeeks: z.number().min(1).max(52),
});

type BaseClassFormValues = z.infer<typeof baseClassFormSchema>;

interface CreateBaseClassModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (data: BaseClassCreationData) => Promise<void>;
}

export const CreateBaseClassModal: React.FC<CreateBaseClassModalProps> = ({
  isOpen,
  onClose,
  onSubmit,
}) => {
  const { toast } = useToast();
  const [currentLengthWeeks, setCurrentLengthWeeks] = useState(PRESET_WEEKS.SEMESTER); // Default to semester

  const form = useForm<BaseClassFormValues>({
    resolver: zodResolver(baseClassFormSchema),
    defaultValues: {
      name: "",
      description: "",
      subject: "",
      gradeLevel: "",
      lengthInWeeks: currentLengthWeeks,
    },
  });

  useEffect(() => {
    // Reset form and slider when modal opens/closes or default changes
    form.reset({
      name: "",
      description: "",
      subject: "",
      gradeLevel: "",
      lengthInWeeks: currentLengthWeeks,
    });
  }, [isOpen, currentLengthWeeks, form]);

  const handleSliderChange = (value: number[]) => {
    const weeks = value[0];
    setCurrentLengthWeeks(weeks);
    form.setValue("lengthInWeeks", weeks, { shouldValidate: true });
  };

  const setPresetWeeks = (preset: keyof typeof PRESET_WEEKS) => {
    const weeks = PRESET_WEEKS[preset];
    setCurrentLengthWeeks(weeks);
    form.setValue("lengthInWeeks", weeks, { shouldValidate: true });
    // Manually trigger focus/blur on slider to reflect change visually if needed, 
    // though direct value set should be sufficient for react-hook-form.
  };

  const handleFormSubmit = async (values: BaseClassFormValues) => {
    try {
      await onSubmit(values); // BaseClassCreationData is compatible with BaseClassFormValues here
      toast({
        title: "Base Class Created!",
        description: `Successfully created ${values.name}.`,
      });
      onClose(); // Close modal on success
    } catch (error) {
      console.error("Failed to create base class:", error);
      toast({
        title: "Error",
        description: "Failed to create base class. Please try again.",
        variant: "destructive",
      });
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-[525px]">
        <DialogHeader>
          <DialogTitle className="text-lg font-medium">Create New Base Class</DialogTitle>
          <DialogDescription className="text-sm text-muted-foreground">
            Fill in the details below to create a new base class.
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={form.handleSubmit(handleFormSubmit)} className="space-y-6 py-2 pb-4">
          <div className="space-y-1.5">
            <Label htmlFor="name">Name</Label>
            <Input id="name" {...form.register("name")} placeholder="e.g., Introduction to Algebra" />
            {form.formState.errors.name && (
              <p className="text-sm text-red-500">{form.formState.errors.name.message}</p>
            )}
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="description">Description (Optional)</Label>
            <Textarea
              id="description"
              {...form.register("description")}
              placeholder="A brief overview of the class content and goals."
              rows={3}
            />
          </div>

          <div className="grid grid-cols-2 gap-x-6 gap-y-6">
            <div className="space-y-1.5">
              <Label htmlFor="subject">Subject (Optional)</Label>
              <Input id="subject" {...form.register("subject")} placeholder="e.g., Mathematics" />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="gradeLevel">Grade Level (Optional)</Label>
              <Input id="gradeLevel" {...form.register("gradeLevel")} placeholder="e.g., 9th Grade" />
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="lengthInWeeks" className="block mb-1">Length of Class (Weeks: {currentLengthWeeks})</Label>
            <Slider
              id="lengthInWeeks"
              min={1}
              max={52}
              step={1}
              value={[currentLengthWeeks]}
              onValueChange={handleSliderChange}
              className="my-3"
            />
            {form.formState.errors.lengthInWeeks && (
              <p className="text-sm text-red-500">{form.formState.errors.lengthInWeeks.message}</p>
            )}
            <div className="flex justify-around space-x-2 pt-1">
              {(Object.keys(PRESET_WEEKS) as Array<keyof typeof PRESET_WEEKS>).map((preset) => (
                <Button
                  type="button"
                  variant="outline"
                  key={preset}
                  onClick={() => setPresetWeeks(preset)}
                  className="flex-1 text-xs px-2 py-1.5 h-auto"
                >
                  {preset.charAt(0) + preset.slice(1).toLowerCase().replace("_", " ")} ({PRESET_WEEKS[preset]}w)
                </Button>
              ))}
            </div>
          </div>

          <DialogFooter className="pt-6">
            <Button type="button" variant="outline" onClick={onClose} className="px-6 py-3">
              Cancel
            </Button>
            <Button type="submit" disabled={form.formState.isSubmitting} className="px-6 py-3">
              {form.formState.isSubmitting ? "Creating..." : "Create Base Class"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}; 