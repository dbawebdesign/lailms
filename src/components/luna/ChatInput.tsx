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

  // Detect mobile
  useEffect(() => {
    const checkMobile = () => {
      setIsMobile(window.innerWidth < 768);
    };

    checkMobile();
    window.addEventListener('resize', checkMobile);

    return () => {
      window.removeEventListener('resize', checkMobile);
    };
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
      
      // On mobile, blur input after sending to hide keyboard if desired
      if (isMobile && inputRef.current) {
        inputRef.current.blur();
      }
    } catch (error) {
      console.error('Error sending message:', error);
      // You could add toast notification here
    }
  };

  // Handle input focus on mobile - scroll into view
  const handleInputFocus = () => {
    if (isMobile) {
      setTimeout(() => {
        inputRef.current?.scrollIntoView({ behavior: 'smooth', block: 'center' });
      }, 300); // Delay to allow keyboard animation
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
    <form onSubmit={handleSubmit} className={`flex gap-2 items-center ${isMobile ? 'gap-3' : 'gap-2'}`}>
      <Button
        type="button"
        variant="ghost"
        size="icon"
        className={`rounded-full flex-shrink-0 ${isMobile ? 'h-12 w-12' : 'h-10 w-10'}`}
        onClick={toggleRecording}
        disabled={isLoading}
      >
        {isRecording ? (
          <MicOff size={isMobile ? 20 : 18} className="text-destructive" />
        ) : (
          <Mic size={isMobile ? 20 : 18} />
        )}
      </Button>
      
      <Input
        ref={inputRef}
        value={message}
        onChange={(e) => setMessage(e.target.value)}
        onFocus={handleInputFocus}
        placeholder={`Ask ${persona === 'tutor' ? 'your tutor' : persona === 'peer' ? 'your peer buddy' : 'your exam coach'}...`}
        className={`flex-1 focus-visible:ring-primary ${isMobile ? 'h-12 text-base' : ''}`}
        disabled={isLoading || isRecording}
        autoComplete="off"
        autoCorrect="off"
        autoCapitalize="sentences"
      />
      
      <Button
        type="submit"
        variant="default"
        size="icon"
        className={`rounded-full flex-shrink-0 ${isMobile ? 'h-12 w-12' : 'h-10 w-10'}`}
        disabled={!message.trim() || isLoading}
      >
        {isLoading ? (
          <Loader2 size={isMobile ? 20 : 18} className="animate-spin" />
        ) : (
          <Send size={isMobile ? 20 : 18} />
        )}
      </Button>
    </form>
  );
};

export default ChatInput; 