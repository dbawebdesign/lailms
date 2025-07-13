'use client';

import { motion } from 'framer-motion';
import { SurveySection as SurveySectionType, SurveyQuestion } from '@/types/survey';
import { LikertScaleQuestion } from './questions/LikertScaleQuestion';
import { MultipleChoiceQuestion } from './questions/MultipleChoiceQuestion';
import { NumericalQuestion } from './questions/NumericalQuestion';
import { ScaleQuestion } from './questions/ScaleQuestion';
import { TextQuestion } from './questions/TextQuestion';

interface SurveySectionProps {
  section: SurveySectionType;
  questions: SurveyQuestion[];
  responses: Record<string, any>;
  onResponse: (questionId: number, value: any) => void;
}

export function SurveySection({ section, questions, responses, onResponse }: SurveySectionProps) {
  const renderQuestion = (question: SurveyQuestion, index: number) => {
    const response = responses[question.id];
    
    const questionProps = {
      question,
      value: response,
      onChange: (value: any) => onResponse(question.id, value),
    };

    switch (question.question_type) {
      case 'likert':
        return <LikertScaleQuestion key={question.id} {...questionProps} />;
      case 'multiple_choice':
        return <MultipleChoiceQuestion key={question.id} {...questionProps} />;
      case 'numerical':
        return <NumericalQuestion key={question.id} {...questionProps} />;
      case 'scale':
        return <ScaleQuestion key={question.id} {...questionProps} />;
      case 'text':
        return <TextQuestion key={question.id} {...questionProps} />;
      default:
        return null;
    }
  };

  return (
    <div className="space-y-8">
      {/* Section Header */}
      <div className="text-center space-y-4 max-w-2xl mx-auto">
        <h2 className="text-2xl font-semibold text-slate-900">
          {section.title}
        </h2>
        {section.description && (
          <p className="text-base text-slate-700 leading-relaxed">
            {section.description}
          </p>
        )}
      </div>

      {/* Questions */}
      <div className="space-y-6">
        {questions.map((question, index) => (
          <motion.div
            key={question.id}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ 
              duration: 0.2, 
              delay: index * 0.05,
              ease: [0.4, 0.0, 0.2, 1]
            }}
            className="bg-slate-50 rounded-xl p-6 border border-slate-200 shadow-sm"
          >
            {renderQuestion(question, index)}
          </motion.div>
        ))}
      </div>
    </div>
  )
} 