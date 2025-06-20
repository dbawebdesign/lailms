'use client';

import React, { useState, useEffect, Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
import { QuestionBankManager } from '@/components/teach/studio/assessment/QuestionBankManager';
import { AssessmentBuilder } from '@/components/teach/studio/assessment/AssessmentBuilder';
import { Database } from '../../../../../packages/types/db';
import { DragDropContext, DropResult } from '@hello-pangea/dnd';

type Question = Database['public']['Tables']['questions']['Row'];

const CreateAssessmentContent = () => {
    const searchParams = useSearchParams();
    const baseClassId = searchParams.get('baseClassId');
  
    const [bankQuestions, setBankQuestions] = useState<Question[]>([]);
    const [assessmentQuestions, setAssessmentQuestions] = useState<Question[]>([]);
    const [loadingQuestions, setLoadingQuestions] = useState(true);

    useEffect(() => {
      if (!baseClassId) return;
  
      const fetchQuestions = async () => {
        setLoadingQuestions(true);
        try {
          const response = await fetch(`/api/teach/questions?base_class_id=${baseClassId}`);
          const data = await response.json();
          if(response.ok) {
            setBankQuestions(data);
          } else {
            throw new Error(data.error || 'Failed to fetch questions');
          }
        } catch (error) {
          console.error("Failed to fetch questions:", error);
        } finally {
          setLoadingQuestions(false);
        }
      };
      
      fetchQuestions();
    }, [baseClassId]);

    const onDragEnd = (result: DropResult) => {
        const { source, destination } = result;
    
        if (!destination) {
          return;
        }
    
        // Moving from bank to builder
        if (source.droppableId === 'question-bank' && destination.droppableId === 'assessment-builder') {
            const questionToMove = bankQuestions[source.index];
            const newAssessmentQuestions = Array.from(assessmentQuestions);
            newAssessmentQuestions.splice(destination.index, 0, questionToMove);
            setAssessmentQuestions(newAssessmentQuestions);

            // Optional: remove from bank if you don't want duplicates
            // const newBankQuestions = Array.from(bankQuestions);
            // newBankQuestions.splice(source.index, 1);
            // setBankQuestions(newBankQuestions);
        }

        // Reordering within builder
        if (source.droppableId === 'assessment-builder' && destination.droppableId === 'assessment-builder') {
            const items = Array.from(assessmentQuestions);
            const [reorderedItem] = items.splice(source.index, 1);
            items.splice(destination.index, 0, reorderedItem);
            setAssessmentQuestions(items);
        }
    };

    // Show error message if no baseClassId is provided (after all hooks)
    if (!baseClassId) {
        return (
            <div className="flex items-center justify-center h-screen">
                <div className="text-center">
                    <h1 className="text-2xl font-bold text-red-600 mb-4">Missing Base Class ID</h1>
                    <p className="text-gray-600">
                        Please provide a valid baseClassId parameter in the URL.
                    </p>
                    <p className="text-sm text-gray-500 mt-2">
                        Example: /teach/assessments/create?baseClassId=your-class-id
                    </p>
                </div>
            </div>
        );
    }

    return (
        <DragDropContext onDragEnd={onDragEnd}>
            <div className="flex h-screen overflow-hidden">
                <div className="w-1/2 overflow-y-auto">
                    <QuestionBankManager 
                        questions={bankQuestions}
                        onQuestionsUpdate={setBankQuestions}
                        baseClassId={baseClassId}
                    />
                </div>
                <div className="w-1/2 p-4 overflow-y-auto">
                    <AssessmentBuilder questions={assessmentQuestions} />
                </div>
            </div>
        </DragDropContext>
    );
};

const CreateAssessmentPage = () => {
    return (
        <Suspense fallback={<div className="flex items-center justify-center h-screen">Loading...</div>}>
            <CreateAssessmentContent />
        </Suspense>
    );
};

export default CreateAssessmentPage; 