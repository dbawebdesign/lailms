"use client";

import React, { useState, useEffect } from 'react';
import { Check, ChevronsUpDown, User, Users } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
} from '@/components/ui/command';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';
import { Badge } from '@/components/ui/badge';
import { createClient } from '@/lib/supabase/client';

interface FamilyStudent {
  user_id: string;
  first_name: string;
  last_name: string;
  grade_level?: string;
  role: string;
}

interface FamilyStudentSelectorProps {
  selectedStudents: string[];
  onStudentsChange: (studentIds: string[]) => void;
  disabled?: boolean;
  placeholder?: string;
  className?: string;
  excludeStudents?: string[];
}

export function FamilyStudentSelector({
  selectedStudents,
  onStudentsChange,
  disabled = false,
  placeholder = "Select students...",
  className,
  excludeStudents = []
}: FamilyStudentSelectorProps) {
  const [open, setOpen] = useState(false);
  const [familyStudents, setFamilyStudents] = useState<FamilyStudent[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const supabase = createClient();

  useEffect(() => {
    loadFamilyStudents();
  }, []);

  const loadFamilyStudents = async () => {
    try {
      setIsLoading(true);
      
      // Get current user
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      // Get current user's profile to find family members
      const { data: profile } = await supabase
        .from('profiles')
        .select(`
          family_id,
          organisation_id,
          organisations (
            organisation_type
          )
        `)
        .eq('user_id', user.id)
        .single();

      if (!profile) return;

      // Check if this is a homeschool organization
      const isHomeschool = (profile.organisations as any)?.organisation_type === 'individual_family' || 
                          (profile.organisations as any)?.organisation_type === 'homeschool_coop';

      if (!isHomeschool) {
        // Not a homeschool account, no family students to show
        setFamilyStudents([]);
        return;
      }

      let students: FamilyStudent[] = [];

      // Get family members - try family_id first, then organisation_id
      if (profile.family_id) {
        const { data: familyMembers } = await supabase
          .from('profiles')
          .select('user_id, first_name, last_name, grade_level, role')
          .eq('family_id', profile.family_id)
          .eq('role', 'student')
          .order('first_name');
        
        if (familyMembers) {
          students = familyMembers;
        }
      } else if (profile.organisation_id) {
        const { data: orgMembers } = await supabase
          .from('profiles')
          .select('user_id, first_name, last_name, grade_level, role')
          .eq('organisation_id', profile.organisation_id)
          .eq('role', 'student')
          .order('first_name');
        
        if (orgMembers) {
          students = orgMembers;
        }
      }

      setFamilyStudents(students);
    } catch (error) {
      console.error('Error loading family students:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleStudentToggle = (studentId: string) => {
    const newSelection = selectedStudents.includes(studentId)
      ? selectedStudents.filter(id => id !== studentId)
      : [...selectedStudents, studentId];
    
    onStudentsChange(newSelection);
  };

  const getStudentDisplayName = (student: FamilyStudent) => {
    const name = `${student.first_name} ${student.last_name}`;
    return student.grade_level ? `${name} (Grade ${student.grade_level})` : name;
  };

  // Filter out excluded students
  const availableStudents = familyStudents.filter(student => 
    !excludeStudents.includes(student.user_id)
  );

  const selectedStudentNames = availableStudents
    .filter(student => selectedStudents.includes(student.user_id))
    .map(student => `${student.first_name} ${student.last_name}`);

  if (isLoading) {
    return (
      <div className={cn("flex items-center space-x-2", className)}>
        <div className="h-10 w-full bg-muted animate-pulse rounded-md" />
      </div>
    );
  }

  if (familyStudents.length === 0) {
    return (
      <div className={cn("text-sm text-muted-foreground p-3 border rounded-md bg-muted/50", className)}>
        <div className="flex items-center space-x-2">
          <Users className="h-4 w-4" />
          <span>No family students found. Students will need to be added to your family account first.</span>
        </div>
      </div>
    );
  }

  if (availableStudents.length === 0) {
    return (
      <div className={cn("text-sm text-muted-foreground p-3 border rounded-md bg-muted/50", className)}>
        <div className="flex items-center space-x-2">
          <Users className="h-4 w-4" />
          <span>All family students are already enrolled in this class.</span>
        </div>
      </div>
    );
  }

  return (
    <div className={cn("space-y-2", className)}>
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <Button
            variant="outline"
            role="combobox"
            aria-expanded={open}
            className="w-full justify-between"
            disabled={disabled}
          >
            <div className="flex items-center space-x-2 flex-1 min-w-0">
              <Users className="h-4 w-4 flex-shrink-0" />
              <span className="truncate">
                {selectedStudents.length === 0
                  ? placeholder
                  : selectedStudents.length === 1
                  ? selectedStudentNames[0]
                  : `${selectedStudents.length} students selected`
                }
              </span>
            </div>
            <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-full p-0" align="start">
          <Command>
            <CommandInput placeholder="Search students..." />
            <CommandEmpty>No students found.</CommandEmpty>
            <CommandGroup>
              {availableStudents.map((student) => (
                <CommandItem
                  key={student.user_id}
                  value={getStudentDisplayName(student)}
                  onSelect={() => handleStudentToggle(student.user_id)}
                >
                  <div className="flex items-center space-x-2 flex-1">
                    <User className="h-4 w-4" />
                    <div className="flex-1">
                      <div className="font-medium">
                        {student.first_name} {student.last_name}
                      </div>
                      {student.grade_level && (
                        <div className="text-sm text-muted-foreground">
                          Grade {student.grade_level}
                        </div>
                      )}
                    </div>
                    <Check
                      className={cn(
                        "ml-auto h-4 w-4",
                        selectedStudents.includes(student.user_id)
                          ? "opacity-100"
                          : "opacity-0"
                      )}
                    />
                  </div>
                </CommandItem>
              ))}
            </CommandGroup>
          </Command>
        </PopoverContent>
      </Popover>

      {/* Selected students badges */}
      {selectedStudents.length > 0 && (
        <div className="flex flex-wrap gap-1">
          {availableStudents
            .filter(student => selectedStudents.includes(student.user_id))
            .map((student) => (
              <Badge
                key={student.user_id}
                variant="secondary"
                className="text-xs"
              >
                {student.first_name} {student.last_name}
                <button
                  onClick={() => handleStudentToggle(student.user_id)}
                  className="ml-1 hover:bg-muted-foreground/20 rounded-full p-0.5"
                  disabled={disabled}
                >
                  ×
                </button>
              </Badge>
            ))}
        </div>
      )}
    </div>
  );
}
