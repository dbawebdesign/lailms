"use client";

import { useRef, useState, useEffect, RefObject } from 'react';
import { useLessonContext } from '@/hooks/useLessonContext';
import { useTextContent } from '@/hooks/useTextContent';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { ChevronLeft, ChevronRight } from 'lucide-react';

/**
 * Example Lesson Page that demonstrates the context system
 * This component registers itself with the Luna Context Engine
 */
export function LessonPageExample() {
  // Lesson content
  const sections = [
    {
      id: 'section-1',
      title: 'Introduction to Photosynthesis',
      content: `Photosynthesis is the process used by plants, algae and certain bacteria to harness energy from sunlight 
      and turn it into chemical energy. Here, we'll learn the basics of how this vital process works.
      
      Photosynthesis literally means "putting together with light". It is a process that converts carbon dioxide and water 
      into glucose (sugar) and oxygen using the energy from sunlight.`
    },
    {
      id: 'section-2',
      title: 'The Chemical Equation',
      content: `The basic chemical equation for photosynthesis is:
      
      6CO₂ + 6H₂O + Light Energy → C₆H₁₂O₆ + 6O₂
      
      In words, this means:
      Six carbon dioxide molecules + six water molecules + light energy produces one glucose molecule + six oxygen molecules.
      
      This equation shows that plants take in carbon dioxide and water, use energy from sunlight, and release oxygen as a byproduct.`
    },
    {
      id: 'section-3',
      title: 'Light-Dependent Reactions',
      content: `The light-dependent reactions occur in the thylakoid membrane of the chloroplast.
      
      During these reactions:
      1. Photons of light are absorbed by pigment molecules (primarily chlorophyll a and b)
      2. This excites electrons which are then passed along an electron transport chain
      3. This electron movement creates a proton gradient that powers ATP synthesis
      4. Water molecules are split to replace the lost electrons, releasing oxygen
      
      The main products of this stage are ATP (energy) and NADPH (reducing power), while oxygen is released as a waste product.`
    },
    {
      id: 'section-4',
      title: 'Calvin Cycle (Light-Independent Reactions)',
      content: `The Calvin Cycle, also known as the light-independent reactions, takes place in the stroma of the chloroplast.
      
      This cycle uses the ATP and NADPH produced during the light-dependent reactions to convert CO₂ into glucose. The process involves:
      
      1. Carbon fixation - CO₂ is attached to a 5-carbon molecule (RuBP)
      2. Reduction - The fixed carbon is reduced using NADPH to form carbohydrate
      3. Regeneration - RuBP is regenerated to allow the cycle to continue
      
      The primary product of this cycle is glucose, which the plant can use for energy or convert into other organic compounds.`
    }
  ];
  
  // Current section index
  const [currentSectionIndex, setCurrentSectionIndex] = useState(0);
  const currentSection = sections[currentSectionIndex];
  
  // Lesson time tracking
  const [timeSpent, setTimeSpent] = useState(0);
  useEffect(() => {
    const interval = setInterval(() => {
      setTimeSpent(prev => prev + 1);
    }, 1000);
    return () => clearInterval(interval);
  }, []);
  
  // Format time for display
  const formatTime = (seconds: number) => {
    const minutes = Math.floor(seconds / 60);
    const remainingSeconds = seconds % 60;
    return `${minutes}:${remainingSeconds < 10 ? '0' + remainingSeconds : remainingSeconds}`;
  };
  
  // Navigate between sections
  const goToNextSection = () => {
    if (currentSectionIndex < sections.length - 1) {
      setCurrentSectionIndex(prev => prev + 1);
    }
  };
  
  const goToPrevSection = () => {
    if (currentSectionIndex > 0) {
      setCurrentSectionIndex(prev => prev - 1);
    }
  };
  
  // Calculate progress
  const progress = Math.round(((currentSectionIndex + 1) / sections.length) * 100);
  
  // Register with Luna Context using our hooks
  const { trackSectionChange } = useLessonContext({
    lessonId: 'lesson-photosynthesis-101',
    title: 'Photosynthesis 101',
    currentSection: {
      id: currentSection.id,
      title: currentSection.title,
      content: currentSection.content,
      index: currentSectionIndex + 1
    },
    totalSections: sections.length,
    subject: 'Biology',
    gradeLevel: '9th Grade',
    learningObjectives: [
      'Understand the basic chemical equation of photosynthesis',
      'Describe the light-dependent reactions',
      'Explain the Calvin Cycle',
      'Connect photosynthesis to energy production in plants'
    ],
    timeSpent,
    progress
  });
  
  // Track section changes
  useEffect(() => {
    trackSectionChange(currentSection.id, currentSectionIndex + 1);
  }, [currentSectionIndex, currentSection.id, trackSectionChange]);
  
  // Ref for the content area
  const contentRef = useRef<HTMLDivElement>(null) as RefObject<HTMLDivElement>;
  
  // Register the text content separately for more granular tracking
  useTextContent(contentRef, {
    role: 'lesson-content',
    identifier: currentSection.id,
    trackVisibleOnly: true,
    metadata: {
      sectionIndex: currentSectionIndex,
      sectionTitle: currentSection.title
    }
  });
  
  return (
    <div className="max-w-4xl mx-auto p-6">
      <Card className="mb-4">
        <CardHeader>
          <CardTitle>
            <div className="flex justify-between items-center">
              <span>Photosynthesis 101</span>
              <span className="text-sm font-normal">Time: {formatTime(timeSpent)}</span>
            </div>
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="mb-4 flex justify-between items-center">
            <span className="text-sm text-gray-500">Progress: {progress}%</span>
            <span className="text-sm text-gray-500">Section {currentSectionIndex + 1} of {sections.length}</span>
          </div>
          
          <div className="w-full bg-gray-200 rounded-full h-2.5">
            <div className="bg-blue-600 h-2.5 rounded-full" style={{ width: `${progress}%` }}></div>
          </div>
        </CardContent>
      </Card>
      
      <Card>
        <CardHeader>
          <CardTitle>{currentSection.title}</CardTitle>
        </CardHeader>
        <CardContent>
          <div
            ref={contentRef}
            className="prose max-w-none"
            style={{ whiteSpace: 'pre-line' }}
          >
            {currentSection.content}
          </div>
          
          <div className="flex justify-between mt-6">
            <Button
              onClick={goToPrevSection}
              disabled={currentSectionIndex === 0}
              variant="outline"
              className="flex items-center gap-2"
            >
              <ChevronLeft className="h-4 w-4" />
              Previous
            </Button>
            
            <Button
              onClick={goToNextSection}
              disabled={currentSectionIndex === sections.length - 1}
              className="flex items-center gap-2"
            >
              Next
              <ChevronRight className="h-4 w-4" />
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
} 