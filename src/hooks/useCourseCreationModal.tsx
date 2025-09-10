'use client';

import { useState } from 'react';
import { CourseCreationOptionsModal } from '@/components/teach/CourseCreationOptionsModal';

interface UseCourseCreationModalProps {
  organisationId: string;
}

export function useCourseCreationModal({ organisationId }: UseCourseCreationModalProps) {
  const [isOpen, setIsOpen] = useState(false);

  const openModal = () => setIsOpen(true);
  const closeModal = () => setIsOpen(false);

  const CourseCreationModal = () => (
    <CourseCreationOptionsModal
      isOpen={isOpen}
      onClose={closeModal}
      organisationId={organisationId}
    />
  );

  return {
    openModal,
    closeModal,
    CourseCreationModal,
    isOpen
  };
}
