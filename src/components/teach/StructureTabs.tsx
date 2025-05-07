"use client";

import React from "react";
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from "@/components/ui/tabs";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ListChecks, Presentation, FileQuestion, Construction } from "lucide-react"; // Icons for tabs

interface StructureTabsProps {
  baseClassId: string;
  // Potentially pass down data for paths, lessons, quizzes in the future
  // paths: Path[];
  // lessons: Lesson[];
  // quizzes: Quiz[];
}

// Placeholder component for tab content
const PlaceholderTabContent: React.FC<{ title: string; baseClassId: string }> = ({ title, baseClassId }) => {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center">
          <Construction className="mr-2 h-5 w-5 text-muted-foreground" />
          {title} Management
        </CardTitle>
      </CardHeader>
      <CardContent>
        <p className="text-muted-foreground">
          Management interface for {title.toLowerCase()} will be available here soon.
        </p>
        <p className="text-sm text-muted-foreground mt-2">
          (Content related to Base Class ID: {baseClassId})
        </p>
        {/* Future: List {title}, Add New {title} Button, etc. */}
      </CardContent>
    </Card>
  );
};

export const StructureTabs: React.FC<StructureTabsProps> = ({ baseClassId }) => {
  return (
    <Tabs defaultValue="paths" className="w-full">
      <TabsList className="grid w-full grid-cols-3">
        <TabsTrigger value="paths">
          <ListChecks className="mr-2 h-4 w-4" /> Paths
        </TabsTrigger>
        <TabsTrigger value="lessons">
          <Presentation className="mr-2 h-4 w-4" /> Lessons
        </TabsTrigger>
        <TabsTrigger value="quizzes">
          <FileQuestion className="mr-2 h-4 w-4" /> Quizzes
        </TabsTrigger>
      </TabsList>
      <TabsContent value="paths" className="mt-4">
        <PlaceholderTabContent title="Paths" baseClassId={baseClassId} />
      </TabsContent>
      <TabsContent value="lessons" className="mt-4">
        <PlaceholderTabContent title="Lessons" baseClassId={baseClassId} />
      </TabsContent>
      <TabsContent value="quizzes" className="mt-4">
        <PlaceholderTabContent title="Quizzes" baseClassId={baseClassId} />
      </TabsContent>
    </Tabs>
  );
}; 