"use client";

import React, { useState, useRef, useEffect } from 'react';
import { Send, Mic, MicOff, Loader2, Paperclip, X, FileText, Link2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { PersonaType } from './PersonaSelector';
import { useLunaContext } from '@/hooks/useLunaContext';

interface ChatInputProps {
  persona: PersonaType;
}

interface AttachedFile {
  file: File;
  id: string;
}

interface AttachedUrl {
  url: string;
  id: string;
}

const ChatInput: React.FC<ChatInputProps> = ({ persona }) => {
  const [message, setMessage] = useState('');
  const [isRecording, setIsRecording] = useState(false);
  const [isMobile, setIsMobile] = useState(false);
  const [attachedFiles, setAttachedFiles] = useState<AttachedFile[]>([]);
  const [attachedUrls, setAttachedUrls] = useState<AttachedUrl[]>([]);
  const [showUrlInput, setShowUrlInput] = useState(false);
  const [urlInput, setUrlInput] = useState('');
  const inputRef = useRef<HTMLInputElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const { sendMessage, isLoading } = useLunaContext();

  // Detect mobile on mount and window resize
  useEffect(() => {
    const checkMobile = () => {
      setIsMobile(window.innerWidth < 768);
    };
    
    checkMobile();
    window.addEventListener('resize', checkMobile);
    
    return () => window.removeEventListener('resize', checkMobile);
  }, []);

  // Auto-focus the input field when component mounts (desktop only)
  useEffect(() => {
    if (!isMobile) {
      inputRef.current?.focus();
    }
  }, [isMobile]);

  // Detect URLs in message
  const detectUrls = (text: string): string[] => {
    const urlRegex = /(https?:\/\/[^\s]+)/g;
    return text.match(urlRegex) || [];
  };

  // Handle file upload
  const handleFileUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
    const files = event.target.files;
    if (!files) return;

    Array.from(files).forEach(file => {
      const id = Math.random().toString(36).substr(2, 9);
      setAttachedFiles(prev => [...prev, { file, id }]);
    });

    // Reset file input
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  // Remove attached file
  const removeFile = (id: string) => {
    setAttachedFiles(prev => prev.filter(f => f.id !== id));
  };

  // Remove attached URL
  const removeUrl = (id: string) => {
    setAttachedUrls(prev => prev.filter(u => u.id !== id));
  };

  // Add URL manually
  const addUrl = () => {
    if (!urlInput.trim()) return;
    
    const id = Math.random().toString(36).substr(2, 9);
    setAttachedUrls(prev => [...prev, { url: urlInput.trim(), id }]);
    setUrlInput('');
    setShowUrlInput(false);
  };

  // Handle URL input key press
  const handleUrlKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      addUrl();
    } else if (e.key === 'Escape') {
      setShowUrlInput(false);
      setUrlInput('');
    }
  };

  // Handle form submission
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if ((!message.trim() && attachedFiles.length === 0 && attachedUrls.length === 0) || isLoading) return;
    
    try {
      // Detect URLs in the message and add them to attachedUrls
      const detectedUrls = detectUrls(message);
      const newUrls = detectedUrls.map(url => ({
        url,
        id: Math.random().toString(36).substr(2, 9)
      }));
      
      // For now, combine message with attachment info as text
      // TODO: Update useLunaContext to handle structured message data
      let fullMessage = message;
      
      if (attachedFiles.length > 0) {
        fullMessage += '\n\n[Files attached: ' + attachedFiles.map(f => f.file.name).join(', ') + ']';
      }
      
      if (attachedUrls.length > 0 || newUrls.length > 0) {
        const allUrls = [...attachedUrls, ...newUrls];
        fullMessage += '\n\n[URLs: ' + allUrls.map(u => u.url).join(', ') + ']';
      }

      await sendMessage(fullMessage, persona);
      setMessage('');
      setAttachedFiles([]);
      setAttachedUrls([]);
      
      // Blur input on mobile to hide keyboard after sending
      if (isMobile && inputRef.current) {
        inputRef.current.blur();
        // Re-focus after a short delay to maintain UX
        setTimeout(() => {
          inputRef.current?.focus();
        }, 100);
      }
    } catch (error) {
      console.error('Error sending message:', error);
      // You could add toast notification here
    }
  };

  // Handle Enter key press for mobile
  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSubmit(e as any);
    }
  };

  // Toggle voice recording (placeholder implementation)
  const toggleRecording = () => {
    if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
      alert('Your browser does not support voice recording');
      return;
    }

    if (isRecording) {
      setIsRecording(false);
      // Stop recording logic would go here
    } else {
      setIsRecording(true);
      // Start recording logic would go here
      navigator.mediaDevices.getUserMedia({ audio: true })
        .then((stream) => {
          // Voice recording implementation would go here
          console.log('Recording started', stream);
        })
        .catch((err) => {
          console.error('Error accessing microphone:', err);
          setIsRecording(false);
        });
    }
  };

  return (
    <div className="space-y-2">
      {/* Attachments Display */}
      {(attachedFiles.length > 0 || attachedUrls.length > 0) && (
        <div className="flex flex-wrap gap-2 p-2 bg-muted/50 rounded-lg">
          {attachedFiles.map(({ file, id }) => (
            <Badge key={id} variant="secondary" className="flex items-center gap-1">
              <FileText size={12} />
              <span className="text-xs truncate max-w-[100px]">{file.name}</span>
              <Button
                size="sm"
                variant="ghost"
                className="h-4 w-4 p-0 hover:bg-destructive/20"
                onClick={() => removeFile(id)}
              >
                <X size={10} />
              </Button>
            </Badge>
          ))}
          {attachedUrls.map(({ url, id }) => (
            <Badge key={id} variant="secondary" className="flex items-center gap-1">
              <Link2 size={12} />
              <span className="text-xs truncate max-w-[120px]">{url}</span>
              <Button
                size="sm"
                variant="ghost"
                className="h-4 w-4 p-0 hover:bg-destructive/20"
                onClick={() => removeUrl(id)}
              >
                <X size={10} />
              </Button>
            </Badge>
          ))}
        </div>
      )}

      {/* URL Input */}
      {showUrlInput && (
        <div className="flex gap-2 p-2 bg-muted/50 rounded-lg">
          <Input
            value={urlInput}
            onChange={(e) => setUrlInput(e.target.value)}
            onKeyDown={handleUrlKeyPress}
            placeholder="Enter URL (e.g., https://example.com)"
            className="flex-1"
            autoFocus
          />
          <Button
            type="button"
            size="sm"
            onClick={addUrl}
            disabled={!urlInput.trim()}
          >
            Add
          </Button>
          <Button
            type="button"
            size="sm"
            variant="ghost"
            onClick={() => {
              setShowUrlInput(false);
              setUrlInput('');
            }}
          >
            Cancel
          </Button>
        </div>
      )}

      <form 
        onSubmit={handleSubmit} 
        className={`flex gap-2 items-end ${isMobile ? 'gap-3' : 'gap-2'}`}
      >
        {/* File Upload Button */}
        <Button
          type="button"
          variant="ghost"
          size="icon"
          className={`rounded-full flex-shrink-0 ${
            isMobile 
              ? 'h-12 w-12 md:h-10 md:w-10' 
              : 'h-10 w-10'
          }`}
          onClick={() => fileInputRef.current?.click()}
          disabled={isLoading}
          title="Upload files"
        >
          <Paperclip size={isMobile ? 20 : 18} />
        </Button>

        {/* Hidden file input */}
        <input
          ref={fileInputRef}
          type="file"
          multiple
          accept=".pdf,.doc,.docx,.txt,.md"
          onChange={handleFileUpload}
          className="hidden"
        />

        {/* URL Button */}
        <Button
          type="button"
          variant="ghost"
          size="icon"
          className={`rounded-full flex-shrink-0 ${
            isMobile 
              ? 'h-12 w-12 md:h-10 md:w-10' 
              : 'h-10 w-10'
          }`}
          onClick={() => setShowUrlInput(!showUrlInput)}
          disabled={isLoading}
          title="Add URL"
        >
          <Link2 size={isMobile ? 20 : 18} />
        </Button>

        {/* Voice Recording Button */}
        <Button
          type="button"
          variant="ghost"
          size="icon"
          className={`rounded-full flex-shrink-0 ${
            isMobile 
              ? 'h-12 w-12 md:h-10 md:w-10' 
              : 'h-10 w-10'
          }`}
          onClick={toggleRecording}
          disabled={isLoading}
        >
          {isRecording ? (
            <MicOff size={isMobile ? 20 : 18} className="text-destructive" />
          ) : (
            <Mic size={isMobile ? 20 : 18} />
          )}
        </Button>
      
      {/* Text Input */}
      <div className="flex-1 relative">
      <Input
        ref={inputRef}
        value={message}
        onChange={(e) => setMessage(e.target.value)}
          onKeyPress={handleKeyPress}
        placeholder={`Ask ${persona === 'tutor' ? 'your tutor' : persona === 'peer' ? 'your peer buddy' : 'your exam coach'}... (attach files or paste URLs)`}
          className={`focus-visible:ring-primary pr-12 ${
            isMobile 
              ? 'h-12 text-base rounded-xl md:h-10 md:text-sm md:rounded-md' 
              : 'h-10'
          }`}
        disabled={isLoading || isRecording}
          autoComplete="off"
          autoCorrect="off"
          autoCapitalize="sentences"
      />
      
        {/* Send Button - Positioned inside input on mobile */}
      <Button
        type="submit"
        variant="default"
        size="icon"
          className={`absolute right-1 top-1/2 transform -translate-y-1/2 rounded-full flex-shrink-0 ${
            isMobile 
              ? 'h-10 w-10 md:h-8 md:w-8' 
              : 'h-8 w-8'
          } ${!message.trim() ? 'bg-muted-foreground/50' : ''}`}
        disabled={!message.trim() || isLoading}
      >
          {isLoading ? (
            <Loader2 size={isMobile ? 18 : 16} className="animate-spin" />
          ) : (
            <Send size={isMobile ? 18 : 16} />
          )}
      </Button>
      </div>
      </form>
    </div>
  );
};

export default ChatInput; 