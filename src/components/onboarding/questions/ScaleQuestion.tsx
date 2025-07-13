'use client';

import { motion } from 'framer-motion';
import { SurveyQuestion } from '@/types/survey';

interface ScaleQuestionProps {
  question: SurveyQuestion;
  value: number;
  onChange: (value: number) => void;
}

export function ScaleQuestion({ question, value, onChange }: ScaleQuestionProps) {
  const min = question.options.min || 1;
  const max = question.options.max || 10;
  const minLabel = question.options.minLabel || '';
  const maxLabel = question.options.maxLabel || '';

  const scaleNumbers = Array.from({ length: max - min + 1 }, (_, i) => min + i);

  return (
    <div className="space-y-6">
      {/* Question Header */}
      <div className="space-y-2">
        <h3 className="text-lg font-medium text-slate-900 leading-relaxed">
          {question.question_text}
        </h3>
        {question.required && (
          <span className="text-red-600 text-sm font-normal">Required</span>
        )}
      </div>

      {/* Scale */}
      <div className="space-y-4">
        {/* Scale Labels */}
        {(minLabel || maxLabel) && (
          <div className="flex justify-between text-sm text-slate-600 font-normal">
            <span>{minLabel}</span>
            <span>{maxLabel}</span>
          </div>
        )}

        {/* Scale Numbers */}
        <div className="flex justify-between items-center space-x-2">
          {scaleNumbers.map((number) => (
            <motion.button
              key={number}
              whileHover={{ scale: 1.05, y: -1 }}
              whileTap={{ scale: 0.95 }}
              onClick={() => onChange(number)}
              className={`
                relative w-10 h-10 rounded-lg border font-medium transition-all duration-200 flex items-center justify-center text-sm
                ${value === number
                  ? 'border-slate-900 bg-slate-900 text-white shadow-md'
                  : 'border-slate-300 bg-white text-slate-700 hover:border-slate-500 hover:shadow-md'
                }
              `}
            >
              <span className={`relative z-10 ${
                value === number ? 'text-white' : 'text-slate-700'
              }`}>
                {number}
              </span>
              
              {/* Selected state background */}
              {value === number && (
                <motion.div
                  layoutId={`selected-scale-${question.id}`}
                  className="absolute inset-0 rounded-lg bg-slate-900 z-0"
                  initial={false}
                  transition={{ type: 'spring', stiffness: 500, damping: 30 }}
                />
              )}
            </motion.button>
          ))}
        </div>

        {/* Current Selection Display */}
        {value && (
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            className="text-center"
          >
            <p className="text-sm text-slate-600 font-normal">
              You selected: <span className="font-medium text-slate-900">{value}</span>
            </p>
          </motion.div>
        )}
      </div>
    </div>
  );
} 