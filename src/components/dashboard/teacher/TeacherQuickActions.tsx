'use client';

import { Button } from "@/components/ui/button";
import Link from "next/link";
import { BookOpen, ClipboardCheck, Search } from 'lucide-react';
import { useCourseCreationModal } from '@/hooks/useCourseCreationModal';

interface TeacherQuickActionsProps {
  organizationId: string;
}

export default function TeacherQuickActions({ organizationId }: TeacherQuickActionsProps) {
  const { openModal, CourseCreationModal } = useCourseCreationModal({ 
    organisationId: organizationId 
  });

  return (
    <>
      <div className="bg-card/50 backdrop-blur-sm border border-border/40 rounded-2xl p-6">
        <h3 className="text-base font-medium mb-4 text-foreground">Quick Actions</h3>
        <div className="space-y-3">
          <Button className="w-full justify-start h-10" variant="outline" onClick={openModal}>
            <BookOpen className="mr-2 h-4 w-4" />
            Create New Course
          </Button>
          <Button asChild className="w-full justify-start h-10" variant="outline">
            <Link href="/teach/gradebook">
              <ClipboardCheck className="mr-2 h-4 w-4" />
              Grade Assignments
            </Link>
          </Button>
          <Button asChild className="w-full justify-start h-10" variant="outline">
            <Link href="/teach/knowledge">
              <Search className="mr-2 h-4 w-4" />
              Search Knowledge
            </Link>
          </Button>
        </div>
      </div>
      
      <CourseCreationModal />
    </>
  );
}
