'use client';

import { motion } from 'framer-motion';
import { Check } from 'lucide-react';
import { SurveyQuestion } from '@/types/survey';

interface MultipleChoiceQuestionProps {
  question: SurveyQuestion;
  value: string | string[];
  onChange: (value: string | string[]) => void;
}

export function MultipleChoiceQuestion({ question, value, onChange }: MultipleChoiceQuestionProps) {
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

  const isSelected = (option: string) => {
    if (isMultiple) {
      return Array.isArray(value) && value.includes(option);
    }
    return value === option;
  };

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
        {isMultiple && (
          <p className="text-sm text-slate-600 font-normal">Select all that apply</p>
        )}
      </div>

      {/* Options */}
      <div className="grid grid-cols-1 gap-3">
        {options.map((option, index) => (
          <motion.button
            key={index}
            whileHover={{ scale: 1.005, y: -1 }}
            whileTap={{ scale: 0.995 }}
            onClick={() => isMultiple ? handleMultipleChoice(option) : handleSingleChoice(option)}
            className={`
              group relative px-4 py-4 rounded-lg border transition-all duration-200 text-left
              ${isSelected(option)
                ? 'border-slate-900 bg-slate-900 text-white shadow-md'
                : 'border-slate-300 bg-white text-slate-700 hover:border-slate-500 hover:shadow-md'
              }
            `}
          >
            <div className="flex items-center justify-between">
              <span className={`relative z-10 text-base font-normal leading-relaxed ${
                isSelected(option) ? 'text-white' : 'text-slate-700'
              }`}>
                {option}
              </span>
              
              {/* Check indicator */}
              <div className={`
                relative z-10 flex items-center justify-center w-5 h-5 rounded-full border-2 transition-all duration-200
                ${isSelected(option)
                  ? 'border-white bg-white'
                  : 'border-slate-400 group-hover:border-slate-500'
                }
              `}>
                {isSelected(option) && (
                  <motion.div
                    initial={{ scale: 0 }}
                    animate={{ scale: 1 }}
                    transition={{ type: 'spring', stiffness: 500, damping: 30 }}
                  >
                    <Check className="w-3 h-3 text-slate-900" />
                  </motion.div>
                )}
              </div>
            </div>
            
            {/* Selection background */}
            {isSelected(option) && (
              <motion.div
                layoutId={`selected-choice-${question.id}`}
                className="absolute inset-0 rounded-lg bg-slate-900 z-0"
                initial={false}
                transition={{ type: 'spring', stiffness: 500, damping: 30 }}
              />
            )}
          </motion.button>
        ))}
      </div>
    </div>
  );
} 