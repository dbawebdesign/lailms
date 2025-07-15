'use client';

import type { PublicSurveySection as PublicSurveySectionType, PublicSurveyQuestion } from '@/types/publicSurvey';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import PublicLikertScaleQuestion from './questions/PublicLikertScaleQuestion';
import PublicMultipleChoiceQuestion from './questions/PublicMultipleChoiceQuestion';
import PublicNumericalQuestion from './questions/PublicNumericalQuestion';
import PublicScaleQuestion from './questions/PublicScaleQuestion';
import PublicTextQuestion from './questions/PublicTextQuestion';

interface PublicSurveySectionProps {
  section: PublicSurveySectionType;
  questions: PublicSurveyQuestion[];
  responses: Record<string, any>;
  onResponseChange: (questionId: number, value: any) => void;
}

export default function PublicSurveySection({
  section,
  questions,
  responses,
  onResponseChange
}: PublicSurveySectionProps) {
  const renderQuestion = (question: PublicSurveyQuestion) => {
    const value = responses[question.id] || '';
    const onChange = (newValue: any) => onResponseChange(question.id, newValue);

    switch (question.question_type) {
      case 'likert':
        return (
          <PublicLikertScaleQuestion
            key={question.id}
            question={question}
            value={value}
            onChange={onChange}
          />
        );
      case 'multiple_choice':
        return (
          <PublicMultipleChoiceQuestion
            key={question.id}
            question={question}
            value={value}
            onChange={onChange}
          />
        );
      case 'numerical':
        return (
          <PublicNumericalQuestion
            key={question.id}
            question={question}
            value={value}
            onChange={onChange}
          />
        );
      case 'scale':
        return (
          <PublicScaleQuestion
            key={question.id}
            question={question}
            value={value}
            onChange={onChange}
          />
        );
      case 'text':
        return (
          <PublicTextQuestion
            key={question.id}
            question={question}
            value={value}
            onChange={onChange}
          />
        );
      default:
        return null;
    }
  };

  return (
    <div className="max-w-4xl mx-auto p-8 space-y-8">
      <Card className="bg-white shadow-sm border border-gray-200 rounded-xl">
        <CardHeader className="px-8 py-6">
          <CardTitle className="text-2xl font-semibold text-gray-900 text-center">
            {section.title}
          </CardTitle>
          {section.description && (
            <p className="text-center text-gray-600 mt-3 text-base leading-relaxed">
              {section.description}
            </p>
          )}
        </CardHeader>
        <CardContent className="px-8 pb-8 space-y-8">
          {questions.map(renderQuestion)}
        </CardContent>
      </Card>
    </div>
  );
} 