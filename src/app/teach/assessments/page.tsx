'use client';

import React, { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { PlusCircle } from 'lucide-react';
import AssessmentManager from '@/components/teach/studio/assessment/AssessmentManager';
import { QuestionBankManager } from '@/components/teach/studio/assessment/QuestionBankManager';
import { Database } from '../../../../packages/types/db';

type Question = Database['public']['Tables']['assessment_questions']['Row'];

const AssessmentsPage = () => {
  const [questions, setQuestions] = useState<Question[]>([]);
  const [loadingQuestions, setLoadingQuestions] = useState(true);
  const baseClassId = "cls-1"; // Example baseClassId

  useEffect(() => {
    if (!baseClassId) return;

    const fetchQuestions = async () => {
      setLoadingQuestions(true);
      try {
        const response = await fetch(`/api/teach/questions?base_class_id=${baseClassId}`);
        const data = await response.json();
        if(response.ok) {
          setQuestions(data);
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

  // Mock function for onQuestionsUpdate
  const handleQuestionsUpdate = (updatedQuestions: Question[]) => {
    setQuestions(updatedQuestions);
  };

  return (
    <div className="container mx-auto p-4 sm:p-6 lg:p-8">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-3xl font-bold tracking-tight">Assessment Management</h1>
        <Button>
          <PlusCircle className="mr-2 h-4 w-4" />
          Create New Assessment
        </Button>
      </div>

      <Tabs defaultValue="assessments" className="w-full">
        <TabsList className="grid w-full grid-cols-2">
          <TabsTrigger value="assessments">My Assessments</TabsTrigger>
          <TabsTrigger value="bank">Question Bank</TabsTrigger>
        </TabsList>
        <TabsContent value="assessments">
          <Card>
            <CardHeader>
              <CardTitle>Your Assessments</CardTitle>
            </CardHeader>
            <CardContent>
              <AssessmentManager baseClassId={baseClassId} />
            </CardContent>
          </Card>
        </TabsContent>
        <TabsContent value="bank">
          <Card>
            <CardHeader>
              <CardTitle>Question Bank</CardTitle>
            </CardHeader>
            <CardContent>
              <QuestionBankManager 
                questions={questions}
                onQuestionsUpdate={handleQuestionsUpdate}
                baseClassId={baseClassId}
              />
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
};

export default AssessmentsPage; 