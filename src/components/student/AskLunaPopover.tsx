'use client';

import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Textarea } from '@/components/ui/textarea';

import { 
  Bot, 
  MessageSquare, 
  Sparkles, 
  X, 
  Send,
  HelpCircle,
  BookOpen,
  Brain
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

interface AskLunaPopoverProps {
  selectedText: string;
  position: { x: number; y: number };
  isVisible: boolean;
  onAskLuna: (selectedText: string, question: string, quickAction?: string) => void;
  onClose: () => void;
}

export function AskLunaPopover({ 
  selectedText, 
  position, 
  isVisible, 
  onAskLuna, 
  onClose 
}: AskLunaPopoverProps) {
  const [question, setQuestion] = useState('');
  const [showCustomInput, setShowCustomInput] = useState(false);

  const quickActions = [
    {
      id: 'explain',
      label: 'Explain This',
      icon: <HelpCircle className="h-4 w-4" />,
      color: 'bg-blue-500 hover:bg-blue-600',
      question: 'Can you explain this concept in detail?'
    },
    {
      id: 'summarize',
      label: 'Summarize',
      icon: <BookOpen className="h-4 w-4" />,
      color: 'bg-green-500 hover:bg-green-600',
      question: 'Can you provide a brief summary of this?'
    },
    {
      id: 'examples',
      label: 'Examples',
      icon: <Sparkles className="h-4 w-4" />,
      color: 'bg-purple-500 hover:bg-purple-600',
      question: 'Can you give me some examples of this concept?'
    },
    {
      id: 'quiz',
      label: 'Quiz Me',
      icon: <Brain className="h-4 w-4" />,
      color: 'bg-orange-500 hover:bg-orange-600',
      question: 'Can you create some practice questions about this?'
    }
  ];

  const handleQuickAction = (action: typeof quickActions[0]) => {
    onAskLuna(selectedText, action.question, action.id);
    onClose();
  };

  const handleCustomQuestion = () => {
    if (question.trim()) {
      onAskLuna(selectedText, question.trim());
      setQuestion('');
      onClose();
    }
  };



  return (
    <AnimatePresence>
      {isVisible && (
        <motion.div
          initial={{ opacity: 0, scale: 0.9, y: 10 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.9, y: 10 }}
          transition={{ duration: 0.2 }}
          className="fixed z-50"
          style={{
            left: Math.min(position.x, window.innerWidth - 320),
            top: Math.max(position.y + 10, 10),
          }}
          data-luna-popover
        >
          <Card className="w-80 shadow-lg border-2 border-purple-200 dark:border-purple-700">
            <CardContent className="p-4">
              {/* Header */}
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-2">
                  <div className="p-1.5 rounded-lg bg-gradient-to-br from-purple-500 to-pink-500">
                    <Bot className="h-4 w-4 text-white" />
                  </div>
                  <span className="font-semibold text-sm">Ask Luna</span>
                </div>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={onClose}
                  className="h-6 w-6 p-0 hover:bg-gray-100 dark:hover:bg-gray-800"
                >
                  <X className="h-3 w-3" />
                </Button>
              </div>



              {/* Quick Actions */}
              {!showCustomInput && (
                <div className="space-y-2">
                  <div className="text-xs font-medium text-muted-foreground mb-2">
                    Quick Actions
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    {quickActions.map((action) => (
                      <Button
                        key={action.id}
                        variant="outline"
                        size="sm"
                        onClick={() => handleQuickAction(action)}
                        className={`${action.color} text-white border-0 hover:scale-105 transition-transform`}
                      >
                        {action.icon}
                        <span className="ml-1 text-xs">{action.label}</span>
                      </Button>
                    ))}
                  </div>
                  
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setShowCustomInput(true)}
                    className="w-full mt-3 border-dashed"
                  >
                    <MessageSquare className="h-4 w-4 mr-2" />
                    Ask Custom Question
                  </Button>
                </div>
              )}

              {/* Custom Question Input */}
              {showCustomInput && (
                <div className="space-y-3">
                  <div className="text-xs font-medium text-muted-foreground">
                    Ask Luna about the selected text
                  </div>
                  <Textarea
                    value={question}
                    onChange={(e) => setQuestion(e.target.value)}
                    placeholder="What would you like to know about this content?"
                    className="min-h-[80px] text-sm"
                    autoFocus
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) {
                        handleCustomQuestion();
                      }
                    }}
                  />
                  <div className="flex gap-2">
                    <Button
                      onClick={handleCustomQuestion}
                      disabled={!question.trim()}
                      size="sm"
                      className="flex-1"
                    >
                      <Send className="h-4 w-4 mr-2" />
                      Ask Luna
                    </Button>
                    <Button
                      variant="outline"
                      onClick={() => {
                        setShowCustomInput(false);
                        setQuestion('');
                      }}
                      size="sm"
                    >
                      Back
                    </Button>
                  </div>
                  <div className="text-xs text-muted-foreground">
                    Press Cmd/Ctrl + Enter to send
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        </motion.div>
      )}
    </AnimatePresence>
  );
} 