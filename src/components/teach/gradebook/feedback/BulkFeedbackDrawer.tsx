'use client';

import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { 
  X, 
  MessageSquare, 
  Send,
  Users,
  Sparkles
} from 'lucide-react';
import { cn } from '@/lib/utils';

interface BulkFeedbackDrawerProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  selectedStudents: string[];
  classInstance: {
    id: string;
    name: string;
    base_class_id: string;
    enrollment_code: string;
    settings?: any;
  };
}

export function BulkFeedbackDrawer({
  open,
  onOpenChange,
  selectedStudents,
  classInstance
}: BulkFeedbackDrawerProps) {
  const [feedbackText, setFeedbackText] = useState('');
  const [assignmentId, setAssignmentId] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const mockStudents = [
    { id: '1', name: 'Alice Johnson' },
    { id: '2', name: 'Bob Smith' },
    { id: '3', name: 'Carol Williams' },
    { id: '4', name: 'David Brown' }
  ];

  const mockAssignments = [
    { id: '1', name: 'Chapter 1 Quiz' },
    { id: '2', name: 'Homework Set 1' },
    { id: '3', name: 'Mid-term Project' },
    { id: '4', name: 'Final Exam' }
  ];

  const selectedStudentNames = mockStudents
    .filter(student => selectedStudents.includes(student.id))
    .map(student => student.name);

  const handleSubmit = async () => {
    if (!feedbackText.trim() || !assignmentId) return;
    
    setIsSubmitting(true);
    try {
      // TODO: Implement API call to submit bulk feedback
      await new Promise(resolve => setTimeout(resolve, 1000));
      
      setFeedbackText('');
      setAssignmentId('');
      onOpenChange(false);
    } catch (error) {
      console.error('Failed to submit feedback:', error);
    } finally {
      setIsSubmitting(false);
    }
  };

  const generateAIFeedback = () => {
    const sampleFeedback = [
      "Great work on this assignment! Your understanding of the concepts is clearly demonstrated.",
      "Good effort! Consider reviewing the practice problems to strengthen your understanding.",
      "Excellent analysis! Your approach shows deep thinking about the topic.",
      "Nice progress! Focus on showing more detailed work for full credit.",
      "Outstanding work! Your explanation is clear and well-organized."
    ];
    
    const randomFeedback = sampleFeedback[Math.floor(Math.random() * sampleFeedback.length)];
    setFeedbackText(randomFeedback);
  };

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 bg-black bg-opacity-50 flex items-center justify-center">
      <div className="bg-white rounded-lg w-full max-w-2xl max-h-[80vh] flex flex-col">
        {/* Header */}
        <div className="border-b border-gray-200 p-6">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-3">
              <div className="p-2 bg-blue-100 rounded-lg">
                <MessageSquare className="h-5 w-5 text-blue-600" />
              </div>
              <div>
                <h2 className="text-xl font-semibold text-gray-900">Bulk Feedback</h2>
                <p className="text-sm text-gray-500">
                  Send feedback to {selectedStudents.length} selected student{selectedStudents.length !== 1 ? 's' : ''}
                </p>
              </div>
            </div>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => onOpenChange(false)}
            >
              <X className="h-4 w-4" />
            </Button>
          </div>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-auto p-6 space-y-6">
          {/* Selected Students */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-3">
              Selected Students ({selectedStudents.length})
            </label>
            <div className="flex flex-wrap gap-2">
              {selectedStudentNames.map((name, index) => (
                <Badge key={index} variant="secondary" className="bg-blue-100 text-blue-800">
                  <Users className="h-3 w-3 mr-1" />
                  {name}
                </Badge>
              ))}
            </div>
          </div>

          {/* Assignment Selection */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Assignment
            </label>
            <select
              value={assignmentId}
              onChange={(e) => setAssignmentId(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="">Select an assignment...</option>
              {mockAssignments.map((assignment) => (
                <option key={assignment.id} value={assignment.id}>
                  {assignment.name}
                </option>
              ))}
            </select>
          </div>

          {/* Feedback Text */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <label className="block text-sm font-medium text-gray-700">
                Feedback Message
              </label>
              <Button
                variant="outline"
                size="sm"
                onClick={generateAIFeedback}
                className="text-purple-600 border-purple-300 hover:bg-purple-50"
              >
                <Sparkles className="h-4 w-4 mr-1" />
                AI Suggest
              </Button>
            </div>
            <textarea
              value={feedbackText}
              onChange={(e) => setFeedbackText(e.target.value)}
              placeholder="Enter your feedback message that will be sent to all selected students..."
              className="w-full h-32 px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none"
            />
            <p className="text-xs text-gray-500 mt-1">
              {feedbackText.length}/500 characters
            </p>
          </div>

          {/* Preview */}
          {feedbackText && (
            <div className="border border-gray-200 rounded-lg p-4 bg-gray-50">
              <h4 className="text-sm font-medium text-gray-900 mb-2">Preview</h4>
              <div className="text-sm text-gray-700 whitespace-pre-wrap">
                {feedbackText}
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="border-t border-gray-200 p-6">
          <div className="flex items-center justify-between">
            <div className="text-sm text-gray-500">
              This feedback will be added to each selected student's record
            </div>
            <div className="flex items-center space-x-3">
              <Button
                variant="outline"
                onClick={() => onOpenChange(false)}
                disabled={isSubmitting}
              >
                Cancel
              </Button>
              <Button
                onClick={handleSubmit}
                disabled={!feedbackText.trim() || !assignmentId || isSubmitting}
                className="bg-gradient-to-r from-blue-600 to-purple-600"
              >
                {isSubmitting ? (
                  'Sending...'
                ) : (
                  <>
                    <Send className="h-4 w-4 mr-2" />
                    Send Feedback
                  </>
                )}
              </Button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
} 