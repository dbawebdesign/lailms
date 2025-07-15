'use client';

import { PublicSurveyQuestion } from '@/types/publicSurvey';
import { Input } from '@/components/ui/input';
import { Card, CardContent } from '@/components/ui/card';

interface PublicNumericalQuestionProps {
  question: PublicSurveyQuestion;
  value: string;
  onChange: (value: string) => void;
}

export default function PublicNumericalQuestion({
  question,
  value,
  onChange
}: PublicNumericalQuestionProps) {
  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const inputValue = e.target.value;
    // Only allow numbers
    if (inputValue === '' || /^\d+$/.test(inputValue)) {
      onChange(inputValue);
    }
  };

  return (
    <Card className="bg-gray-50 border border-gray-200 rounded-lg">
      <CardContent className="p-6">
        <h3 className="text-lg font-medium text-gray-900 mb-6 leading-relaxed">
          {question.question_text}
          {question.required && <span className="text-red-500 ml-1">*</span>}
        </h3>
        
        <Input
          type="number"
          value={value}
          onChange={handleChange}
          placeholder={question.options.placeholder || "Enter a number"}
          min={question.options.min}
          max={question.options.max}
          className="max-w-xs bg-white border-gray-200 focus:border-blue-300 focus:ring-blue-200 rounded-lg"
        />
        
        {(question.options.min !== undefined || question.options.max !== undefined) && (
          <p className="text-sm text-gray-500 mt-3">
            {question.options.min !== undefined && question.options.max !== undefined
              ? `Please enter a number between ${question.options.min} and ${question.options.max}`
              : question.options.min !== undefined
              ? `Please enter a number greater than or equal to ${question.options.min}`
              : `Please enter a number less than or equal to ${question.options.max}`
            }
          </p>
        )}
      </CardContent>
    </Card>
  );
} 