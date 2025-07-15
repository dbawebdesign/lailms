'use client';

import { PublicSurveyQuestion } from '@/types/publicSurvey';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Card, CardContent } from '@/components/ui/card';

interface PublicTextQuestionProps {
  question: PublicSurveyQuestion;
  value: string;
  onChange: (value: string) => void;
}

export default function PublicTextQuestion({
  question,
  value,
  onChange
}: PublicTextQuestionProps) {
  const isLongText = question.options.type === 'textarea';
  const placeholder = question.options.placeholder || 'Enter your response...';

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    onChange(e.target.value);
  };

  return (
    <Card className="bg-gray-50 border border-gray-200 rounded-lg">
      <CardContent className="p-6">
        <h3 className="text-lg font-medium text-gray-900 mb-6 leading-relaxed">
          {question.question_text}
          {question.required && <span className="text-red-500 ml-1">*</span>}
        </h3>
        
        {isLongText ? (
          <Textarea
            value={value}
            onChange={handleChange}
            placeholder={placeholder}
            className="min-h-[120px] resize-none bg-white border-gray-200 focus:border-blue-300 focus:ring-blue-200 rounded-lg"
          />
        ) : (
          <Input
            type="text"
            value={value}
            onChange={handleChange}
            placeholder={placeholder}
            className="bg-white border-gray-200 focus:border-blue-300 focus:ring-blue-200 rounded-lg"
          />
        )}
      </CardContent>
    </Card>
  );
} 