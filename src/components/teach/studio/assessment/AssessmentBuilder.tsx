'use client';

import React from 'react';
import { Droppable, Draggable } from '@hello-pangea/dnd';
import { Database } from '../../../../../packages/types/db';
import { Card, CardContent } from '@/components/ui/card';
import { GripVertical } from 'lucide-react';

type Question = Database['public']['Tables']['assessment_questions']['Row'];

interface AssessmentBuilderProps {
  questions: Question[];
}

export const AssessmentBuilder: React.FC<AssessmentBuilderProps> = ({ questions }) => {
  return (
    <Droppable droppableId="assessment-builder">
      {(provided, snapshot) => (
        <div
          {...provided.droppableProps}
          ref={provided.innerRef}
          className={`border-2 border-dashed rounded-lg p-4 h-full transition-colors ${
            snapshot.isDraggingOver ? 'border-primary bg-primary/10' : 'border-gray-300'
          }`}
        >
          <h3 className="text-lg font-semibold mb-4">Assessment Questions</h3>
          {questions.length === 0 ? (
            <div className="flex items-center justify-center h-full">
                <p className="text-muted-foreground mt-2">Drag questions here from the bank</p>
            </div>
          ) : (
            questions.map((question, index) => (
              <Draggable key={question.id} draggableId={question.id} index={index}>
                {(provided) => (
                  <div
                    ref={provided.innerRef}
                    {...provided.draggableProps}
                    {...provided.dragHandleProps}
                    className="mb-4"
                  >
                    <Card>
                      <CardContent className="p-4 flex items-center">
                        <GripVertical className="mr-4 text-muted-foreground" />
                        <p className="font-medium truncate">{question.question_text}</p>
                      </CardContent>
                    </Card>
                  </div>
                )}
              </Draggable>
            ))
          )}
          {provided.placeholder}
        </div>
      )}
    </Droppable>
  );
}; 