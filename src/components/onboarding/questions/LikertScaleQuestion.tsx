'use client';

import { motion } from 'framer-motion';
import { SurveyQuestion } from '@/types/survey';

interface LikertScaleQuestionProps {
  question: SurveyQuestion;
  value: string;
  onChange: (value: string) => void;
}

export function LikertScaleQuestion({ question, value, onChange }: LikertScaleQuestionProps) {
  const scale = question.options.scale || [];

  return (
    <div className="space-y-6">
      {/* Question Header */}
      <div className="space-y-2">
        <h3 className="text-base font-medium text-slate-900 leading-relaxed">
          {question.question_text}
        </h3>
      </div>

      {/* Scale Options */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3">
        {scale.map((option, index) => (
          <motion.button
            key={index}
            whileHover={{ scale: 1.02, y: -1 }}
            whileTap={{ scale: 0.98 }}
            onClick={() => onChange(option)}
            className={`
              group relative px-4 py-3 rounded-lg border transition-all duration-200 text-xs font-medium
              ${value === option
                ? 'border-slate-900 bg-slate-900 text-white shadow-md'
                : 'border-slate-300 bg-white text-slate-700 hover:border-slate-500 hover:shadow-md'
              }
            `}
          >
            <span className={`relative z-10 block text-center leading-tight ${
              value === option ? 'text-white' : 'text-slate-700'
            }`}>
              {option}
            </span>
            
            {/* Selection indicator */}
            {value === option && (
              <motion.div
                layoutId={`selected-likert-${question.id}`}
                className="absolute inset-0 rounded-lg bg-primary"
                initial={false}
                transition={{ type: 'spring', stiffness: 500, damping: 30 }}
              />
            )}
            
            {/* Hover state background */}
            <div className="absolute inset-0 rounded-lg bg-accent/5 opacity-0 group-hover:opacity-100 transition-opacity duration-200" />
          </motion.button>
        ))}
      </div>
    </div>
  );
} 