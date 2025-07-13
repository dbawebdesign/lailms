'use client';

import { motion } from 'framer-motion';
import { DollarSign } from 'lucide-react';
import { SurveyQuestion } from '@/types/survey';
import { Input } from '@/components/ui/input';

interface NumericalQuestionProps {
  question: SurveyQuestion;
  value: string | number;
  onChange: (value: string | number) => void;
}

export function NumericalQuestion({ question, value, onChange }: NumericalQuestionProps) {
  const isCurrency = question.options.type === 'currency';
  const placeholder = question.options.placeholder || '';

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const inputValue = e.target.value;
    
    if (isCurrency) {
      // Remove non-numeric characters except decimal point
      const numericValue = inputValue.replace(/[^0-9.]/g, '');
      // Ensure only one decimal point
      const parts = numericValue.split('.');
      const cleanValue = parts[0] + (parts.length > 1 ? '.' + parts[1] : '');
      onChange(cleanValue);
    } else {
      onChange(inputValue);
    }
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
      </div>

      {/* Input */}
      <div className="max-w-md">
        <motion.div
          whileFocus={{ scale: 1.005 }}
          className="relative group"
        >
          {isCurrency && (
            <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
              <DollarSign className="h-4 w-4 text-slate-500 group-focus-within:text-slate-700 transition-colors duration-200" />
            </div>
          )}
          <Input
            type="text"
            value={value || ''}
            onChange={handleChange}
            placeholder={placeholder}
            className={`
              text-base font-normal py-3 rounded-md border transition-all duration-200 
              focus:ring-2 focus:ring-slate-500 focus:border-slate-500 
              hover:border-slate-400 hover:shadow-sm
              bg-white text-slate-900 placeholder-slate-400
              ${isCurrency ? 'pl-10' : 'pl-3'}
              ${value ? 'border-slate-400' : 'border-slate-300'}
            `}
          />
          
          {/* Focus indicator */}
          <div className="absolute inset-0 rounded-md bg-accent/5 opacity-0 group-focus-within:opacity-100 transition-opacity duration-200 pointer-events-none" />
        </motion.div>
        
        {isCurrency && (
          <p className="text-caption text-muted-foreground font-normal mt-2">
            Enter amount in USD (e.g., 29.99)
          </p>
        )}
      </div>
    </div>
  );
} 