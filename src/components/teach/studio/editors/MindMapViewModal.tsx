'use client';

import React, { useEffect } from 'react';
import { X, Download } from 'lucide-react';

interface MindMapViewModalProps {
  isOpen: boolean;
  onClose: () => void;
  mindMapId: string;
  title: string;
  urlPath?: string; // Optional custom URL path, defaults to lesson mind map path
}

export default function MindMapViewModal({
  isOpen,
  onClose,
  mindMapId,
  title,
  urlPath
}: MindMapViewModalProps) {
  // Use custom URL path if provided, otherwise default to lesson mind map path
  const mindMapUrl = urlPath || `/api/teach/media/mind-map/${mindMapId}`;

  const handleDownload = () => {
    const link = document.createElement('a');
    link.href = mindMapUrl;
    link.download = `${title.replace(/\s+/g, '_')}.html`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  useEffect(() => {
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose();
      }
    };

    if (isOpen) {
      document.addEventListener('keydown', handleEscape);
      document.body.style.overflow = 'hidden';
    }

    return () => {
      document.removeEventListener('keydown', handleEscape);
      document.body.style.overflow = 'unset';
    };
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 bg-black">
      {/* Header Bar - Fixed height for title and controls */}
      <div className="absolute top-0 left-0 right-0 z-[35] flex items-center justify-between p-3 bg-black/95 backdrop-blur-sm border-b border-white/10">
        <div className="flex-1">
          <h2 className="text-lg font-semibold text-white truncate pr-4">{title}</h2>
        </div>
        <div className="flex gap-2 shrink-0">
          <button
            onClick={handleDownload}
            className="flex items-center gap-1 px-3 py-1.5 text-sm text-white bg-white/10 hover:bg-white/20 rounded-md transition-colors"
            title="Download Mind Map"
          >
            <Download className="h-4 w-4" />
            Download
          </button>
          <button
            onClick={onClose}
            className="flex items-center justify-center w-8 h-8 text-white bg-white/10 hover:bg-white/20 rounded-md transition-colors"
            title="Close (ESC)"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
      </div>

      {/* Mind Map Content - Full iframe */}
      <div className="absolute inset-0 pt-16">
        <iframe
          src={mindMapUrl}
          title={title}
          className="w-full h-full border-0"
          style={{
            background: 'transparent',
            colorScheme: 'dark'
          }}
          sandbox="allow-scripts allow-same-origin"
        />
      </div>
    </div>
  );
} 