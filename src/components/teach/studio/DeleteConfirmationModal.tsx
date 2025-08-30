'use client';

import React from 'react';
import { AlertTriangle, X } from 'lucide-react';
import { cn } from '@/lib/utils';

interface DeleteConfirmationModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: () => void;
  itemType: 'path' | 'lesson' | 'section';
  itemTitle: string;
  isDeleting?: boolean;
  dependentItems?: {
    lessons?: number;
    sections?: number;
  };
}

export const DeleteConfirmationModal: React.FC<DeleteConfirmationModalProps> = ({
  isOpen,
  onClose,
  onConfirm,
  itemType,
  itemTitle,
  isDeleting = false,
  dependentItems
}) => {
  if (!isOpen) return null;

  const getItemTypeLabel = () => {
    switch (itemType) {
      case 'path': return 'Learning Path';
      case 'lesson': return 'Lesson';
      case 'section': return 'Lesson Section';
      default: return 'Item';
    }
  };

  const getDependentItemsWarning = () => {
    if (!dependentItems) return null;
    
    const warnings = [];
    if (dependentItems.lessons && dependentItems.lessons > 0) {
      warnings.push(`${dependentItems.lessons} lesson${dependentItems.lessons > 1 ? 's' : ''}`);
    }
    if (dependentItems.sections && dependentItems.sections > 0) {
      warnings.push(`${dependentItems.sections} section${dependentItems.sections > 1 ? 's' : ''}`);
    }
    
    if (warnings.length === 0) return null;
    
    return (
      <div className="mt-4 p-3 bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 rounded-lg">
        <div className="flex items-start space-x-2">
          <AlertTriangle className="w-4 h-4 text-amber-600 dark:text-amber-400 mt-0.5 flex-shrink-0" />
          <div className="text-sm text-amber-800 dark:text-amber-200">
            <p className="font-medium">This will also delete:</p>
            <p>{warnings.join(' and ')}</p>
          </div>
        </div>
      </div>
    );
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white dark:bg-gray-900 rounded-xl shadow-xl max-w-md w-full border border-gray-200 dark:border-gray-800">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-gray-200 dark:border-gray-800">
          <div className="flex items-center space-x-3">
            <div className="w-10 h-10 bg-red-100 dark:bg-red-900/30 rounded-lg flex items-center justify-center">
              <AlertTriangle className="w-5 h-5 text-red-600 dark:text-red-400" />
            </div>
            <div>
              <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100">
                Delete {getItemTypeLabel()}
              </h3>
              <p className="text-sm text-gray-500 dark:text-gray-400">
                This action cannot be undone
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            disabled={isDeleting}
            className="p-2 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-lg transition-colors disabled:opacity-50"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Content */}
        <div className="p-6">
          <p className="text-gray-700 dark:text-gray-300 mb-4">
            Are you sure you want to delete <span className="font-medium">"{itemTitle}"</span>?
          </p>
          
          {getDependentItemsWarning()}
        </div>

        {/* Actions */}
        <div className="flex items-center justify-end space-x-3 p-6 border-t border-gray-200 dark:border-gray-800">
          <button
            onClick={onClose}
            disabled={isDeleting}
            className="px-4 py-2 text-sm font-medium text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-lg transition-colors disabled:opacity-50"
          >
            Cancel
          </button>
          <button
            onClick={onConfirm}
            disabled={isDeleting}
            className={cn(
              "px-4 py-2 text-sm font-medium text-white rounded-lg transition-colors",
              "bg-red-600 hover:bg-red-700 focus:outline-none focus:ring-2 focus:ring-red-500 focus:ring-offset-2",
              "disabled:opacity-50 disabled:cursor-not-allowed",
              isDeleting && "bg-red-400"
            )}
          >
            {isDeleting ? 'Deleting...' : `Delete ${getItemTypeLabel()}`}
          </button>
        </div>
      </div>
    </div>
  );
};

