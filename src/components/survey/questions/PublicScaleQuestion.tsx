'use client';

import { PublicSurveyQuestion } from '@/types/publicSurvey';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';

interface PublicScaleQuestionProps {
  question: PublicSurveyQuestion;
  value: string;
  onChange: (value: string) => void;
}

export default function PublicScaleQuestion({
  question,
  value,
  onChange
}: PublicScaleQuestionProps) {
  const min = question.options.min || 1;
  const max = question.options.max || 10;
  const minLabel = question.options.minLabel || '';
  const maxLabel = question.options.maxLabel || '';

  const scaleValues = Array.from({ length: max - min + 1 }, (_, i) => min + i);

  return (
    <Card className="bg-gray-50 border border-gray-200 rounded-lg">
      <CardContent className="p-4 sm:p-6">
        <h3 className="text-base sm:text-lg font-medium text-gray-900 mb-4 sm:mb-6 leading-relaxed">
          {question.question_text}
          {question.required && <span className="text-red-500 ml-1">*</span>}
        </h3>
        
        <div className="space-y-4 sm:space-y-6">
          {(minLabel || maxLabel) && (
            <div className="flex items-center justify-between text-xs sm:text-sm text-gray-600">
              <span className="text-left max-w-[40%]">{minLabel}</span>
              <span className="text-right max-w-[40%]">{maxLabel}</span>
            </div>
          )}
          
          <div className="flex flex-wrap justify-center gap-2 sm:gap-3">
            {scaleValues.map((scaleValue) => (
              <Button
                key={scaleValue}
                variant={value === scaleValue.toString() ? "default" : "outline"}
                className={`min-w-[44px] sm:min-w-[48px] h-11 sm:h-12 rounded-lg transition-all duration-200 text-sm sm:text-base font-medium ${
                  value === scaleValue.toString()
                    ? "bg-blue-50 border-blue-200 text-blue-900 hover:bg-blue-100"
                    : "bg-white border-gray-200 text-gray-700 hover:bg-gray-50 hover:border-gray-300"
                }`}
                onClick={() => onChange(scaleValue.toString())}
              >
                {scaleValue}
              </Button>
            ))}
          </div>
        </div>
      </CardContent>
    </Card>
  );
} 