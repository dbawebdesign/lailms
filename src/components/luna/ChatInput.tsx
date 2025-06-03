"use client";

import React, { useState, useRef, useEffect } from 'react';
import { Send, Mic, MicOff, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { PersonaType } from './PersonaSelector';
import { useLunaContext } from '@/hooks/useLunaContext';

interface ChatInputProps {
  persona: PersonaType;
}

const ChatInput: React.FC<ChatInputProps> = ({ persona }) => {
  const [message, setMessage] = useState('');
  const [isRecording, setIsRecording] = useState(false);
  const [isMobile, setIsMobile] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
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

  // Handle form submission
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!message.trim() || isLoading) return;
    
    try {
      await sendMessage(message, persona);
      setMessage('');
      
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
    <form 
      onSubmit={handleSubmit} 
      className={`flex gap-2 items-end ${isMobile ? 'gap-3' : 'gap-2'}`}
    >
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
        placeholder={`Ask ${persona === 'tutor' ? 'your tutor' : persona === 'peer' ? 'your peer buddy' : 'your exam coach'}...`}
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
  );
};

export default ChatInput; 