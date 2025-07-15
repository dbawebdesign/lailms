'use client';

import { PublicSurveyQuestion } from '@/types/publicSurvey';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';

interface PublicLikertScaleQuestionProps {
  question: PublicSurveyQuestion;
  value: string;
  onChange: (value: string) => void;
}

export default function PublicLikertScaleQuestion({
  question,
  value,
  onChange
}: PublicLikertScaleQuestionProps) {
  const defaultScale = [
    'Strongly Disagree',
    'Disagree',
    'Neutral',
    'Agree',
    'Strongly Agree'
  ];
  
  const scaleOptions = question.options.scale || defaultScale;

  return (
    <Card className="bg-gray-50 border border-gray-200 rounded-lg">
      <CardContent className="p-6">
        <h3 className="text-lg font-medium text-gray-900 mb-6 leading-relaxed">
          {question.question_text}
          {question.required && <span className="text-red-500 ml-1">*</span>}
        </h3>
        
        <div className="space-y-3">
          {scaleOptions.map((option: string, index: number) => (
            <Button
              key={index}
              variant={value === option ? "default" : "outline"}
              className={`w-full justify-start text-left h-auto py-3 px-4 rounded-lg transition-all duration-200 ${
                value === option
                  ? "bg-blue-50 border-blue-200 text-blue-900 hover:bg-blue-100"
                  : "bg-white border-gray-200 text-gray-700 hover:bg-gray-50 hover:border-gray-300"
              }`}
              onClick={() => onChange(option)}
            >
              {option}
            </Button>
          ))}
        </div>
      </CardContent>
    </Card>
  );
} 