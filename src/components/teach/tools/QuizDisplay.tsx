'use client';

import React, { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Textarea } from '@/components/ui/textarea';
import { Input } from '@/components/ui/input';
import { Copy, Download, Check, MessageCircle, HelpCircle, Edit3 } from 'lucide-react';

interface QuizQuestion {
  id: string;
  type: 'multiple-choice' | 'true-false' | 'short-answer' | 'fill-blank' | 'matching';
  question: string;
  options?: string[];
  correctAnswer: string | string[];
  explanation?: string;
  points: number;
}

interface ParsedQuiz {
  title: string;
  description?: string;
  questions: QuizQuestion[];
  totalPoints: number;
  answerKey: boolean;
  instructions?: string;
}

interface QuizDisplayProps {
  content: string;
  metadata?: {
    subject?: string;
    gradeLevel?: string;
    difficulty?: string;
    generatedAt?: string;
    wordCount?: number;
    estimatedTime?: string;
    questionCount?: number;
  };
  onCopy: (text: string, itemId: string) => void;
  copiedItems: Set<string>;
  onRefineWithLuna?: (currentQuiz: ParsedQuiz) => void;
}

export function QuizDisplay({ content, metadata, onCopy, copiedItems, onRefineWithLuna }: QuizDisplayProps) {
  const [editingQuestion, setEditingQuestion] = useState<string | null>(null);
  const [editedQuiz, setEditedQuiz] = useState<ParsedQuiz | null>(null);
  const [editingTitle, setEditingTitle] = useState(false);
  const [showAnswers, setShowAnswers] = useState(false);

  const parseQuizContent = (content: string): ParsedQuiz => {
    const lines = content.split('\n');
    const questions: QuizQuestion[] = [];
    let currentQuestion: Partial<QuizQuestion> | null = null;
    let questionCounter = 0;
    let title = 'Quiz';
    let totalPoints = 0;

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i].trim();
      
      // Extract title
      if (line.startsWith('# ') || (line.startsWith('**') && line.endsWith('**') && i < 5)) {
        title = line.replace(/^#\s*/, '').replace(/\*\*/g, '');
        continue;
      }

      // Question pattern
      if (line.match(/^\d+\.\s+(.+)/)) {
        // Save previous question
        if (currentQuestion && currentQuestion.question) {
          const question: QuizQuestion = {
            id: `q${questionCounter + 1}`,
            type: currentQuestion.type || 'multiple-choice',
            question: currentQuestion.question,
            options: currentQuestion.options || [],
            correctAnswer: currentQuestion.correctAnswer || '',
            explanation: currentQuestion.explanation,
            points: currentQuestion.points || 1
          };
          questions.push(question);
          totalPoints += question.points;
          questionCounter++;
        }

        // Start new question
        const questionText = line.replace(/^\d+\.\s+/, '');
        currentQuestion = {
          question: questionText,
          type: 'multiple-choice',
          options: [],
          points: 1
        };
      }
      // Options pattern (a), b), c), etc.)
      else if (line.match(/^[a-z]\)\s+(.+)/i) && currentQuestion) {
        if (!currentQuestion.options) currentQuestion.options = [];
        const optionText = line.replace(/^[a-z]\)\s+/i, '');
        currentQuestion.options.push(optionText);
      }
      // Answer pattern
      else if ((line.toLowerCase().startsWith('answer:') || line.toLowerCase().startsWith('correct:')) && currentQuestion) {
        currentQuestion.correctAnswer = line.replace(/^(answer|correct):\s*/i, '');
      }
      // True/False questions
      else if (line.toLowerCase().includes('true or false') && currentQuestion) {
        currentQuestion.type = 'true-false';
        currentQuestion.options = ['True', 'False'];
      }
    }

    // Add the last question
    if (currentQuestion && currentQuestion.question) {
      const question: QuizQuestion = {
        id: `q${questionCounter + 1}`,
        type: currentQuestion.type || 'multiple-choice',
        question: currentQuestion.question,
        options: currentQuestion.options || [],
        correctAnswer: currentQuestion.correctAnswer || '',
        explanation: currentQuestion.explanation,
        points: currentQuestion.points || 1
      };
      questions.push(question);
      totalPoints += question.points;
    }

    return {
      title,
      questions,
      totalPoints,
      answerKey: true,
      instructions: 'Choose the best answer for each question.'
    };
  };

  const currentQuiz = editedQuiz || parseQuizContent(content);

  const copyQuizText = () => {
    let quizText = `# ${currentQuiz.title}\n\n`;
    
    if (currentQuiz.instructions) {
      quizText += `**Instructions:** ${currentQuiz.instructions}\n\n`;
    }

    currentQuiz.questions.forEach((question, index) => {
      quizText += `${index + 1}. ${question.question}\n`;
      
      if (question.options && question.options.length > 0) {
        question.options.forEach((option, optIndex) => {
          const letter = String.fromCharCode(97 + optIndex); // a, b, c, etc.
          quizText += `   ${letter}) ${option}\n`;
        });
      }
      
      if (showAnswers) {
        quizText += `   **Answer:** ${question.correctAnswer}\n`;
        if (question.explanation) {
          quizText += `   **Explanation:** ${question.explanation}\n`;
        }
      }
      
      quizText += '\n';
    });

    if (showAnswers) {
      quizText += `\n**Total Points:** ${currentQuiz.totalPoints}`;
    }

    onCopy(quizText, 'quiz-full');
  };

  const getQuestionTypeIcon = (type: string) => {
    switch (type) {
      case 'multiple-choice':
        return '○';
      case 'true-false':
        return '✓/✗';
      case 'short-answer':
        return '✎';
      case 'fill-blank':
        return '___';
      case 'matching':
        return '↔';
      default:
        return '?';
    }
  };

  const getQuestionTypeColor = (type: string) => {
    switch (type) {
      case 'multiple-choice':
        return 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-300';
      case 'true-false':
        return 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-300';
      case 'short-answer':
        return 'bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-300';
      case 'fill-blank':
        return 'bg-orange-100 text-orange-800 dark:bg-orange-900 dark:text-orange-300';
      case 'matching':
        return 'bg-pink-100 text-pink-800 dark:bg-pink-900 dark:text-pink-300';
      default:
        return 'bg-gray-100 text-gray-800 dark:bg-gray-900 dark:text-gray-300';
    }
  };

  return (
    <div className="space-y-6">
      {/* Quiz Header */}
      <div className="text-center space-y-4">
        <div className="flex items-center justify-center gap-2">
          <HelpCircle className="w-6 h-6 text-blue-600" />
          <h2 className="text-2xl font-bold text-foreground">
            {editingTitle ? (
              <Input
                value={currentQuiz.title}
                onChange={(e) => {
                  const newQuiz = { ...currentQuiz, title: e.target.value };
                  setEditedQuiz(newQuiz);
                }}
                onBlur={() => setEditingTitle(false)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' || e.key === 'Escape') {
                    setEditingTitle(false);
                  }
                }}
                autoFocus
                className="text-2xl font-bold text-center"
              />
            ) : (
              <span 
                className="cursor-pointer hover:bg-muted/50 px-2 py-1 rounded"
                onClick={() => setEditingTitle(true)}
              >
                {currentQuiz.title}
              </span>
            )}
          </h2>
        </div>
        
        <div className="flex items-center justify-center gap-4 text-sm">
          <Badge variant="outline">{metadata?.subject || 'Subject'}</Badge>
          <Badge variant="outline">Grade {metadata?.gradeLevel || 'N/A'}</Badge>
          <Badge variant="secondary">{currentQuiz.questions.length} Questions</Badge>
          <Badge variant="secondary">{currentQuiz.totalPoints} Points</Badge>
        </div>

        {currentQuiz.instructions && (
          <p className="text-muted-foreground italic">{currentQuiz.instructions}</p>
        )}
      </div>

      {/* Action Buttons */}
      <div className="flex justify-center gap-2">
        <Button variant="outline" size="sm" onClick={copyQuizText} className="gap-2">
          <Copy className="w-4 h-4" />
          {copiedItems.has('quiz-full') ? 'Copied!' : 'Copy Quiz'}
        </Button>
        
        <Button 
          variant="outline" 
          size="sm" 
          onClick={() => setShowAnswers(!showAnswers)}
          className="gap-2"
        >
          {showAnswers ? 'Hide Answers' : 'Show Answers'}
        </Button>
        
        {onRefineWithLuna && (
          <Button variant="outline" size="sm" onClick={() => onRefineWithLuna(currentQuiz)} className="gap-2">
            <MessageCircle className="w-4 h-4" />
            Refine with Luna
          </Button>
        )}
      </div>

      {/* Quiz Questions */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center justify-between">
            <span>Quiz Questions</span>
            <div className="text-xs text-muted-foreground">
              Click any question to edit
            </div>
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-6">
          {currentQuiz.questions.map((question, index) => (
            <div key={question.id} className="border rounded-lg p-4 space-y-3">
              {/* Question Header */}
              <div className="flex items-start justify-between gap-3">
                <div className="flex items-start gap-3 flex-1">
                  <Badge 
                    variant="secondary" 
                    className={`text-xs ${getQuestionTypeColor(question.type)} shrink-0`}
                  >
                    {getQuestionTypeIcon(question.type)} {question.type}
                  </Badge>
                  <div className="flex-1">
                    <div className="flex items-start gap-2">
                      <span className="font-semibold text-sm shrink-0">Q{index + 1}.</span>
                      {editingQuestion === question.id ? (
                        <Textarea
                          value={question.question}
                          onChange={(e) => {
                            const newQuiz = { ...currentQuiz };
                            const questionIndex = newQuiz.questions.findIndex(q => q.id === question.id);
                            if (questionIndex !== -1) {
                              newQuiz.questions[questionIndex].question = e.target.value;
                              setEditedQuiz(newQuiz);
                            }
                          }}
                          onBlur={() => setEditingQuestion(null)}
                          className="min-h-[60px] resize-none"
                          autoFocus
                        />
                      ) : (
                        <p 
                          className="text-foreground cursor-pointer hover:bg-muted/50 p-2 rounded transition-colors flex-1"
                          onClick={() => setEditingQuestion(question.id)}
                        >
                          {question.question}
                        </p>
                      )}
                    </div>
                  </div>
                </div>
                <Badge variant="outline" className="text-xs shrink-0">
                  {question.points} pt{question.points !== 1 ? 's' : ''}
                </Badge>
              </div>

              {/* Question Options */}
              {question.options && question.options.length > 0 && (
                <div className="ml-6 space-y-2">
                  {question.options.map((option, optIndex) => {
                    const letter = String.fromCharCode(97 + optIndex);
                    const isCorrect = showAnswers && (
                      question.correctAnswer === option || 
                      question.correctAnswer === letter ||
                      (typeof question.correctAnswer === 'string' && question.correctAnswer.toLowerCase() === letter)
                    );
                    
                    return (
                      <div 
                        key={optIndex} 
                        className={`flex items-center gap-2 p-2 rounded ${
                          isCorrect ? 'bg-green-100 dark:bg-green-900/30 border border-green-300 dark:border-green-700' : 'bg-muted/30'
                        }`}
                      >
                        <span className="font-medium text-sm w-6">{letter})</span>
                        <span className="flex-1">{option}</span>
                        {isCorrect && showAnswers && (
                          <Check className="w-4 h-4 text-green-600" />
                        )}
                      </div>
                    );
                  })}
                </div>
              )}

              {/* Answer for non-multiple choice */}
              {(!question.options || question.options.length === 0) && showAnswers && (
                <div className="ml-6 p-3 bg-green-100 dark:bg-green-900/30 border border-green-300 dark:border-green-700 rounded">
                  <div className="flex items-center gap-2">
                    <Check className="w-4 h-4 text-green-600" />
                    <span className="font-medium text-sm">Answer:</span>
                    <span>{question.correctAnswer}</span>
                  </div>
                </div>
              )}

              {/* Explanation */}
              {question.explanation && showAnswers && (
                <div className="ml-6 p-3 bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded">
                  <div className="flex items-start gap-2">
                    <span className="font-medium text-sm text-blue-700 dark:text-blue-300 shrink-0">Explanation:</span>
                    <span className="text-sm text-blue-600 dark:text-blue-400">{question.explanation}</span>
                  </div>
                </div>
              )}
            </div>
          ))}
        </CardContent>
      </Card>

      {/* Quiz Summary */}
      <Card>
        <CardContent className="pt-6">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-center">
            <div>
              <div className="text-2xl font-bold text-blue-600">{currentQuiz.questions.length}</div>
              <div className="text-sm text-muted-foreground">Questions</div>
            </div>
            <div>
              <div className="text-2xl font-bold text-green-600">{currentQuiz.totalPoints}</div>
              <div className="text-sm text-muted-foreground">Total Points</div>
            </div>
            <div>
              <div className="text-2xl font-bold text-purple-600">
                {Math.round(currentQuiz.questions.reduce((acc, q) => acc + (q.points || 1), 0) / currentQuiz.questions.length * 10) / 10}
              </div>
              <div className="text-sm text-muted-foreground">Avg Points/Q</div>
            </div>
            <div>
              <div className="text-2xl font-bold text-orange-600">
                {metadata?.estimatedTime || `${Math.ceil(currentQuiz.questions.length * 1.5)} min`}
              </div>
              <div className="text-sm text-muted-foreground">Est. Time</div>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
} 