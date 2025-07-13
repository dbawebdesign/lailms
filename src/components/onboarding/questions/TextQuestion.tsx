'use client';

import { motion } from 'framer-motion';
import { SurveyQuestion } from '@/types/survey';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';

interface TextQuestionProps {
  question: SurveyQuestion;
  value: string;
  onChange: (value: string) => void;
}

export function TextQuestion({ question, value, onChange }: TextQuestionProps) {
  const placeholder = question.options.placeholder || '';
  const isLongText = question.question_text.length > 100; // Use textarea for longer responses

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    onChange(e.target.value);
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
      <div className="max-w-2xl">
        <motion.div
          whileFocus={{ scale: 1.002 }}
          className="relative group"
        >
          {isLongText ? (
            <Textarea
              value={value || ''}
              onChange={handleChange}
              placeholder={placeholder}
              rows={4}
              className={`
                text-base font-normal py-3 px-3 rounded-md border transition-all duration-200 
                focus:ring-2 focus:ring-slate-500 focus:border-slate-500 
                hover:border-slate-400 hover:shadow-sm
                bg-white resize-none text-slate-900 placeholder-slate-400
                ${value ? 'border-slate-400' : 'border-slate-300'}
              `}
            />
          ) : (
            <Input
              type="text"
              value={value || ''}
              onChange={handleChange}
              placeholder={placeholder}
              className={`
                text-base font-normal py-3 px-3 rounded-md border transition-all duration-200 
                focus:ring-2 focus:ring-slate-500 focus:border-slate-500 
                hover:border-slate-400 hover:shadow-sm
                bg-white text-slate-900 placeholder-slate-400
                ${value ? 'border-slate-400' : 'border-slate-300'}
              `}
            />
          )}
          
          {/* Focus indicator */}
          <div className="absolute inset-0 rounded-md bg-accent/5 opacity-0 group-focus-within:opacity-100 transition-opacity duration-200 pointer-events-none" />
        </motion.div>
        
        {value && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="mt-2 text-caption text-muted-foreground font-normal"
          >
            {value.length} characters
          </motion.div>
        )}
      </div>
    </div>
  );
} 