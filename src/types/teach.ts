export interface BaseClass {
  id: string;
  name: string;
  description?: string; // Optional
  subject?: string;     // Optional
  gradeLevel?: string;  // Optional
  lengthInWeeks: number; // e.g., 1 to 52
  creationDate: string;  // ISO date string
  // Add other relevant fields later, e.g., status (active, archived)
}

export interface BaseClassCreationData extends Omit<BaseClass, 'id' | 'creationDate'> {
  // Any specific fields for creation if different, but likely the same as BaseClass minus id/creationDate
}

export interface ClassInstance {
  id: string;
  baseClassId: string;
  name: string; // e.g., "Spring 2024 - Section A", "Period 3 Class"
  enrollmentCode: string;
  startDate?: string; // ISO date string
  endDate?: string;   // ISO date string
  period?: string;    // e.g., "Period 3", "Mon/Wed/Fri 10:00 AM"
  capacity?: number;
  status: "active" | "archived" | "upcoming" | "completed";
  creationDate: string; // ISO date string
  createdAt: string; // ISO Date string
  updatedAt: string; // ISO Date string
  // studentCount?: number; // Could be added later
}

export interface ClassInstanceCreationData extends Omit<ClassInstance, "id" | "enrollmentCode" | "creationDate" | "status"> {
  // baseClassId is already part of Omit, but explicitly stating it is fine if needed for clarity
  // status will likely be set server-side or defaulted to 'upcoming'/'active'
}

// Basic placeholder interfaces for content structure - to be expanded later
export interface Path {
  id: string;
  baseClassId: string;
  title: string;
  description?: string;
  // order?: number;
}

export interface Lesson {
  id: string;
  baseClassId: string; // or pathId if lessons belong to paths
  title: string;
  description?: string;
  // content?: any; // To be defined: Rich text, video links, etc.
  // order?: number;
}

export interface Quiz {
  id: string;
  baseClassId: string; // or lessonId if quizzes are tied to lessons
  title: string;
  description?: string;
  // questions?: any[]; // To be defined
  // order?: number;
}

// New type for the AllInstancesTable
export interface EnrichedClassInstance extends ClassInstance {
  baseClassName: string;
  baseClassSubject?: string; // Optional, if you want to show subject from base class
  // studentCount?: number; // Placeholder for future data
} 