"use client";

import React from 'react';
import { Button } from "@/components/ui/button";
import { BookOpen, Users, GraduationCap } from 'lucide-react';

// Define available persona types
export type PersonaType = 'tutor' | 'peer' | 'examCoach';

interface PersonaSelectorProps {
  currentPersona: PersonaType;
  onChange: (persona: PersonaType) => void;
}

const PersonaSelector: React.FC<PersonaSelectorProps> = ({ currentPersona, onChange }) => {
  // Define personas with their metadata
  const personas = [
    { 
      id: 'tutor' as PersonaType, 
      name: 'Tutor', 
      icon: <BookOpen size={16} />,
      description: 'Teaching assistant that explains concepts carefully'
    },
    { 
      id: 'peer' as PersonaType, 
      name: 'Peer Buddy', 
      icon: <Users size={16} />,
      description: 'Friendly study partner for casual learning'
    },
    { 
      id: 'examCoach' as PersonaType, 
      name: 'Exam Coach', 
      icon: <GraduationCap size={16} />,
      description: 'Exam preparation and practice questions'
    }
  ];

  return (
    <div className="flex border-b p-1 bg-muted/20">
      {personas.map((persona) => (
        <Button
          key={persona.id}
          variant={currentPersona === persona.id ? "default" : "ghost"}
          size="sm"
          className={`flex-1 text-xs gap-1 h-8 ${currentPersona === persona.id ? "" : "opacity-70"}`}
          title={persona.description}
          onClick={() => onChange(persona.id)}
        >
          {persona.icon}
          <span className="hidden sm:inline">{persona.name}</span>
        </Button>
      ))}
    </div>
  );
};

export default PersonaSelector; 