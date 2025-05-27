import React from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Sparkles, CheckCircle, AlertCircle } from 'lucide-react';
import { cn } from '@/lib/utils';

interface ContentUpdateIndicatorProps {
  isVisible: boolean;
  status: 'updating' | 'success' | 'error';
  message?: string;
  className?: string;
}

export const ContentUpdateIndicator: React.FC<ContentUpdateIndicatorProps> = ({
  isVisible,
  status,
  message,
  className
}) => {
  const getIcon = () => {
    switch (status) {
      case 'updating':
        return (
          <motion.div
            animate={{ rotate: 360 }}
            transition={{ duration: 2, repeat: Infinity, ease: "linear" }}
          >
            <Sparkles className="w-4 h-4 text-blue-500" />
          </motion.div>
        );
      case 'success':
        return <CheckCircle className="w-4 h-4 text-green-500" />;
      case 'error':
        return <AlertCircle className="w-4 h-4 text-red-500" />;
      default:
        return null;
    }
  };

  const getStatusColor = () => {
    switch (status) {
      case 'updating':
        return 'border-blue-200 bg-blue-50 text-blue-700';
      case 'success':
        return 'border-green-200 bg-green-50 text-green-700';
      case 'error':
        return 'border-red-200 bg-red-50 text-red-700';
      default:
        return 'border-gray-200 bg-gray-50 text-gray-700';
    }
  };

  const getDefaultMessage = () => {
    switch (status) {
      case 'updating':
        return 'Luna is updating content...';
      case 'success':
        return 'Content updated successfully!';
      case 'error':
        return 'Failed to update content';
      default:
        return '';
    }
  };

  return (
    <AnimatePresence>
      {isVisible && (
        <motion.div
          initial={{ opacity: 0, y: -20, scale: 0.95 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          exit={{ opacity: 0, y: -20, scale: 0.95 }}
          transition={{ duration: 0.3, ease: "easeOut" }}
          className={cn(
            "fixed top-4 left-1/2 transform -translate-x-1/2 z-50",
            "flex items-center gap-2 px-4 py-2 rounded-lg border shadow-lg",
            "backdrop-blur-sm",
            getStatusColor(),
            className
          )}
        >
          {getIcon()}
          <span className="text-sm font-medium">
            {message || getDefaultMessage()}
          </span>
          
          {status === 'updating' && (
            <motion.div
              className="ml-2 flex gap-1"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 0.2 }}
            >
              {[0, 1, 2].map((i) => (
                <motion.div
                  key={i}
                  className="w-1 h-1 bg-blue-400 rounded-full"
                  animate={{ scale: [1, 1.5, 1], opacity: [0.5, 1, 0.5] }}
                  transition={{
                    duration: 1,
                    repeat: Infinity,
                    delay: i * 0.2,
                  }}
                />
              ))}
            </motion.div>
          )}
        </motion.div>
      )}
    </AnimatePresence>
  );
};

export default ContentUpdateIndicator; 