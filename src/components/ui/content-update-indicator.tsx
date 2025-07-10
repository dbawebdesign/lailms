import React from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { CheckCircle, AlertCircle, Sparkles } from 'lucide-react';
import { cn } from '@/lib/utils';

interface ContentUpdateIndicatorProps {
  isVisible: boolean;
  status: 'updating' | 'success' | 'error';
  message?: string;
  className?: string;
  entity?: string;
  entityName?: string;
}

export const ContentUpdateIndicator: React.FC<ContentUpdateIndicatorProps> = ({
  isVisible,
  status,
  message,
  className,
  entity,
  entityName
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
        return 'border-blue-200 bg-blue-50 text-blue-700 dark:border-blue-800 dark:bg-blue-950 dark:text-blue-300';
      case 'success':
        return 'border-green-200 bg-green-50 text-green-700 dark:border-green-800 dark:bg-green-950 dark:text-green-300';
      case 'error':
        return 'border-red-200 bg-red-50 text-red-700 dark:border-red-800 dark:bg-red-950 dark:text-red-300';
      default:
        return 'border-gray-200 bg-gray-50 text-gray-700 dark:border-gray-800 dark:bg-gray-950 dark:text-gray-300';
    }
  };

  const getDefaultMessage = () => {
    if (entity && entityName) {
      switch (status) {
        case 'updating':
          return `Luna is updating ${entity}: ${entityName}...`;
        case 'success':
          return `${entity.charAt(0).toUpperCase() + entity.slice(1)} "${entityName}" updated successfully!`;
        case 'error':
          return `Failed to update ${entity}: ${entityName}`;
        default:
          return '';
      }
    }
    
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
            "backdrop-blur-sm max-w-md",
            getStatusColor(),
            className
          )}
        >
          {getIcon()}
          <span className="text-sm font-medium truncate">
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

// Component to add a subtle pulse animation to updated content
export const UpdatedContentWrapper: React.FC<{
  children: React.ReactNode;
  isUpdated: boolean;
  className?: string;
}> = ({ children, isUpdated, className }) => {
  return (
    <motion.div
      className={className}
      animate={isUpdated ? {
        scale: [1, 1.02, 1],
        boxShadow: [
          "0 0 0 0 rgba(59, 130, 246, 0)",
          "0 0 0 4px rgba(59, 130, 246, 0.1)",
          "0 0 0 0 rgba(59, 130, 246, 0)"
        ]
      } : {}}
      transition={{ duration: 0.6, ease: "easeOut" }}
    >
      {children}
    </motion.div>
  );
};

export default ContentUpdateIndicator; 