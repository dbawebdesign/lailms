'use client';

import { PublicSurveyQuestion } from '@/types/publicSurvey';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';

interface PublicMultipleChoiceQuestionProps {
  question: PublicSurveyQuestion;
  value: string | string[];
  onChange: (value: string | string[]) => void;
}

export default function PublicMultipleChoiceQuestion({
  question,
  value,
  onChange
}: PublicMultipleChoiceQuestionProps) {
  const options = question.options.options || [];
  const isMultiple = question.options.multiple || false;

  const handleSingleChoice = (option: string) => {
    onChange(option);
  };

  const handleMultipleChoice = (option: string) => {
    const currentValues = Array.isArray(value) ? value : [];
    const newValues = currentValues.includes(option)
      ? currentValues.filter(v => v !== option)
      : [...currentValues, option];
    onChange(newValues);
  };

  return (
    <Card className="bg-gray-50 border border-gray-200 rounded-lg">
      <CardContent className="p-6">
        <h3 className="text-lg font-medium text-gray-900 mb-6 leading-relaxed">
          {question.question_text}
          {question.required && <span className="text-red-500 ml-1">*</span>}
        </h3>
        
        <div className="space-y-3">
          {options.map((option: string, index: number) => {
            const isSelected = isMultiple
              ? (Array.isArray(value) && value.includes(option))
              : (value === option);
            
            return (
              <Button
                key={index}
                variant={isSelected ? "default" : "outline"}
                className={`w-full justify-start text-left h-auto py-3 px-4 rounded-lg transition-all duration-200 ${
                  isSelected
                    ? "bg-blue-50 border-blue-200 text-blue-900 hover:bg-blue-100"
                    : "bg-white border-gray-200 text-gray-700 hover:bg-gray-50 hover:border-gray-300"
                }`}
                onClick={() => isMultiple ? handleMultipleChoice(option) : handleSingleChoice(option)}
              >
                {option}
              </Button>
            );
          })}
        </div>
        
        {isMultiple && (
          <p className="text-sm text-gray-500 mt-4">
            Select all that apply
          </p>
        )}
      </CardContent>
    </Card>
  );
}