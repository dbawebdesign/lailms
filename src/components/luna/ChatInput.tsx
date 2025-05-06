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
  const inputRef = useRef<HTMLInputElement>(null);
  const { sendMessage, isLoading } = useLunaContext();

  // Auto-focus the input field when component mounts
  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  // Handle form submission
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!message.trim() || isLoading) return;
    
    try {
      await sendMessage(message, persona);
      setMessage('');
    } catch (error) {
      console.error('Error sending message:', error);
      // You could add toast notification here
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
    <form onSubmit={handleSubmit} className="flex gap-2 items-center">
      <Button
        type="button"
        variant="ghost"
        size="icon"
        className="h-10 w-10 rounded-full flex-shrink-0"
        onClick={toggleRecording}
        disabled={isLoading}
      >
        {isRecording ? <MicOff size={18} className="text-destructive" /> : <Mic size={18} />}
      </Button>
      
      <Input
        ref={inputRef}
        value={message}
        onChange={(e) => setMessage(e.target.value)}
        placeholder={`Ask ${persona === 'tutor' ? 'your tutor' : persona === 'peer' ? 'your peer buddy' : 'your exam coach'}...`}
        className="flex-1 focus-visible:ring-primary"
        disabled={isLoading || isRecording}
      />
      
      <Button
        type="submit"
        variant="default"
        size="icon"
        className="h-10 w-10 rounded-full flex-shrink-0"
        disabled={!message.trim() || isLoading}
      >
        {isLoading ? <Loader2 size={18} className="animate-spin" /> : <Send size={18} />}
      </Button>
    </form>
  );
};

export default ChatInput; 