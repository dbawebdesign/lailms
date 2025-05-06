"use client";

import React, { useState } from 'react';
import LunaPanel from '@/components/luna/LunaPanel';
import { LunaContextProvider } from '@/context/LunaContextProvider';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import LunaContextElement from '@/components/luna/LunaContextElement';

export default function LunaDemoPage() {
  // State for quiz answers
  const [selectedAnswers, setSelectedAnswers] = useState<Record<string, string>>({});
  
  // Handle quiz answer selection
  const handleAnswerSelect = (questionId: string, answer: string) => {
    setSelectedAnswers(prev => ({
      ...prev,
      [questionId]: answer
    }));
  };
  
  return (
    <LunaContextProvider>
      <div className="container mx-auto py-10 min-h-screen">
        <h1 className="text-4xl font-bold mb-6">Luna AI Assistant Demo</h1>
        <p className="text-lg mb-8">
          This page demonstrates the Luna AI assistant with context-aware capabilities. 
          Try interacting with the page elements below and then asking Luna about them.
        </p>
        
        <div className="grid grid-cols-1 md:grid-cols-2 gap-8 mb-12">
          {/* Example lesson content */}
          <LunaContextElement
            type="lesson-content"
            role="content"
            content={{
              title: "Introduction to Photosynthesis",
              lessonId: "photo-101",
              summary: "Basic lesson on photosynthesis process and components"
            }}
            metadata={{
              lessonIdentifier: "photo-101",
              gradeLevel: "middle-school",
              subject: "science"
            }}
            registerEvents={true}
          >
            <Card className="p-6">
              <h2 className="text-2xl font-semibold mb-4">Sample Lesson: Introduction to Photosynthesis</h2>
              <div 
                id="lesson-content"
                data-lesson-id="photo-101"
                className="prose max-w-none"
              >
                <p>
                  Photosynthesis is the process used by plants, algae and certain bacteria to harness energy from sunlight 
                  and turn it into chemical energy.
                </p>
                <h3>Key Components:</h3>
                <ul>
                  <li><strong>Chlorophyll:</strong> The green pigment that captures light energy</li>
                  <li><strong>Carbon Dioxide:</strong> Absorbed from the air</li>
                  <li><strong>Water:</strong> Absorbed through the roots</li>
                  <li><strong>Sunlight:</strong> Provides the energy for the reaction</li>
                </ul>
                <p>
                  During photosynthesis, plants take in carbon dioxide (CO₂) from the air and water (H₂O) from the soil. 
                  Using the energy from sunlight, these are converted into glucose (C₆H₁₂O₆) and oxygen (O₂) is released.
                </p>
                <div className="bg-muted p-3 rounded-md text-center">
                  <p className="font-mono">6 CO₂ + 6 H₂O + Light Energy → C₆H₁₂O₆ + 6 O₂</p>
                </div>
              </div>
              <div className="mt-4 flex gap-2">
                <LunaContextElement
                  type="button"
                  role="action"
                  content={{ label: "Save Notes", action: "save_notes" }}
                  registerEvents={true}
                >
                  <Button variant="outline" size="sm">Save Notes</Button>
                </LunaContextElement>
                
                <LunaContextElement
                  type="button"
                  role="action"
                  content={{ label: "Ask Question", action: "ask_question" }}
                  registerEvents={true}
                >
                  <Button variant="outline" size="sm">Ask Question</Button>
                </LunaContextElement>
              </div>
            </Card>
          </LunaContextElement>
          
          {/* Interactive quiz element */}
          <LunaContextElement
            type="quiz"
            role="assessment"
            content={{
              title: "Photosynthesis Knowledge Check",
              quizId: "photosynthesis-quiz-1",
              questions: [
                {
                  id: "q1",
                  text: "What is the primary pigment involved in photosynthesis?",
                  options: ["Melanin", "Chlorophyll", "Carotene", "Hemoglobin"],
                  correctAnswer: "Chlorophyll"
                },
                {
                  id: "q2",
                  text: "Which gas is released as a byproduct of photosynthesis?",
                  options: ["Carbon Dioxide", "Nitrogen", "Oxygen", "Hydrogen"],
                  correctAnswer: "Oxygen"
                }
              ]
            }}
            state={{
              selectedAnswers
            }}
            registerEvents={true}
          >
            <Card className="p-6">
              <h2 className="text-2xl font-semibold mb-4">Quiz: Test Your Knowledge</h2>
              <div className="space-y-4">
                <div className="space-y-2">
                  <p className="font-medium">1. What is the primary pigment involved in photosynthesis?</p>
                  <div className="flex flex-col gap-2">
                    {["Melanin", "Chlorophyll", "Carotene", "Hemoglobin"].map((answer, index) => (
                      <LunaContextElement
                        key={index}
                        type="quiz-option"
                        role="input"
                        content={{ 
                          question: "What is the primary pigment involved in photosynthesis?", 
                          answer, 
                          selected: selectedAnswers["q1"] === answer
                        }}
                        registerEvents={true}
                      >
                        <Button 
                          variant={selectedAnswers["q1"] === answer ? "default" : "outline"} 
                          className="justify-start"
                          onClick={() => handleAnswerSelect("q1", answer)}
                        >
                          {String.fromCharCode(65 + index)}. {answer}
                        </Button>
                      </LunaContextElement>
                    ))}
                  </div>
                </div>
                <div className="space-y-2">
                  <p className="font-medium">2. Which gas is released as a byproduct of photosynthesis?</p>
                  <div className="flex flex-col gap-2">
                    {["Carbon Dioxide", "Nitrogen", "Oxygen", "Hydrogen"].map((answer, index) => (
                      <LunaContextElement
                        key={index}
                        type="quiz-option"
                        role="input"
                        content={{ 
                          question: "Which gas is released as a byproduct of photosynthesis?", 
                          answer, 
                          selected: selectedAnswers["q2"] === answer
                        }}
                        registerEvents={true}
                      >
                        <Button 
                          variant={selectedAnswers["q2"] === answer ? "default" : "outline"} 
                          className="justify-start"
                          onClick={() => handleAnswerSelect("q2", answer)}
                        >
                          {String.fromCharCode(65 + index)}. {answer}
                        </Button>
                      </LunaContextElement>
                    ))}
                  </div>
                </div>
              </div>
              <LunaContextElement
                type="button"
                role="action"
                content={{ label: "Submit Answers", action: "submit_quiz" }}
                registerEvents={true}
              >
                <Button className="mt-6 w-full">Submit Answers</Button>
              </LunaContextElement>
            </Card>
          </LunaContextElement>
        </div>
        
        {/* Luna AI Panel */}
        <LunaPanel initialOpen={true} />
      </div>
    </LunaContextProvider>
  );
} 