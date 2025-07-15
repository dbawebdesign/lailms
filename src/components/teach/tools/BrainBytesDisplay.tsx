'use client';

import React, { useState, useRef } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { 
  Play, 
  Pause, 
  Download, 
  Copy, 
  Check, 
  RefreshCw, 
  Brain, 
  Volume2,
  Clock,
  Mic
} from 'lucide-react';

interface BrainBytesContent {
  script: string;
  cleanScript: string;
  audioUrl: string;
  fileName: string;
  duration: number;
  title: string;
  metadata: {
    topic: string;
    gradeLevel: string;
    duration: number;
    generatedAt: string;
    wordCount: number;
    scriptLength: number;
    voice: string;
  };
}

interface BrainBytesDisplayProps {
  content: BrainBytesContent;
  onCopy: (text: string, itemId: string) => void;
  copiedItems: Set<string>;
  onRefineWithLuna?: (currentContent: BrainBytesContent) => void;
}

export function BrainBytesDisplay({ content, onCopy, copiedItems, onRefineWithLuna }: BrainBytesDisplayProps) {
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const audioRef = useRef<HTMLAudioElement>(null);

  const handlePlayPause = () => {
    if (audioRef.current) {
      if (isPlaying) {
        audioRef.current.pause();
      } else {
        audioRef.current.play();
      }
      setIsPlaying(!isPlaying);
    }
  };

  const handleTimeUpdate = () => {
    if (audioRef.current) {
      setCurrentTime(audioRef.current.currentTime);
    }
  };

  const handleLoadedMetadata = () => {
    if (audioRef.current) {
      setDuration(audioRef.current.duration);
    }
  };

  const handleDownload = () => {
    const link = document.createElement('a');
    link.href = content.audioUrl;
    link.download = content.fileName;
    link.click();
  };

  const formatTime = (time: number) => {
    const minutes = Math.floor(time / 60);
    const seconds = Math.floor(time % 60);
    return `${minutes}:${seconds.toString().padStart(2, '0')}`;
  };

  const progressPercentage = duration > 0 ? (currentTime / duration) * 100 : 0;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="p-2 bg-purple-100 dark:bg-purple-900/20 rounded-lg">
            <Brain className="h-5 w-5 text-purple-600" />
          </div>
          <div>
            <h3 className="text-lg font-semibold">{content.title}</h3>
            <p className="text-sm text-muted-foreground">
              Educational podcast hosted by Luna
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          {content.metadata?.gradeLevel && (
            <Badge variant="secondary">{content.metadata.gradeLevel}</Badge>
          )}
          <Badge variant="outline">
            <Clock className="h-3 w-3 mr-1" />
            {Math.round((content.metadata?.duration || content.duration) / 60)} min
          </Badge>
        </div>
      </div>

      {/* Audio Player */}
      <Card>
        <CardHeader>
          <div className="flex items-center gap-2">
            <Volume2 className="h-5 w-5 text-purple-600" />
            <CardTitle>Brain Bytes Podcast</CardTitle>
          </div>
        </CardHeader>
        <CardContent>
          <audio
            ref={audioRef}
            src={content.audioUrl}
            onTimeUpdate={handleTimeUpdate}
            onLoadedMetadata={handleLoadedMetadata}
            onEnded={() => setIsPlaying(false)}
            className="hidden"
          />
          
          <div className="space-y-4">
            {/* Progress Bar */}
            <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-2">
              <div 
                className="bg-purple-600 h-2 rounded-full transition-all duration-300"
                style={{ width: `${progressPercentage}%` }}
              />
            </div>
            
            {/* Controls */}
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-4">
                <Button
                  onClick={handlePlayPause}
                  size="lg"
                  className="rounded-full w-12 h-12 p-0"
                >
                  {isPlaying ? (
                    <Pause className="h-5 w-5" />
                  ) : (
                    <Play className="h-5 w-5 ml-1" />
                  )}
                </Button>
                
                <div className="text-sm text-muted-foreground">
                  {formatTime(currentTime)} / {formatTime(duration)}
                </div>
              </div>
              
              <div className="flex items-center gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handleDownload}
                >
                  <Download className="h-4 w-4 mr-1" />
                  Download
                </Button>
                
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => onCopy(content.audioUrl, 'audio-url')}
                >
                  {copiedItems.has('audio-url') ? (
                    <Check className="h-4 w-4 mr-1" />
                  ) : (
                    <Copy className="h-4 w-4 mr-1" />
                  )}
                  Copy Link
                </Button>
                
                {onRefineWithLuna && (
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => onRefineWithLuna(content)}
                  >
                    <RefreshCw className="h-4 w-4 mr-1" />
                    Refine with Luna
                  </Button>
                )}
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Metadata */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Podcast Details</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 gap-4 text-sm">
            {content.metadata?.topic && (
              <div>
                <span className="font-medium">Topic:</span>
                <p className="text-muted-foreground">{content.metadata.topic}</p>
              </div>
            )}
            {content.metadata?.gradeLevel && (
              <div>
                <span className="font-medium">Grade Level:</span>
                <p className="text-muted-foreground">Grade {content.metadata.gradeLevel}</p>
              </div>
            )}
            <div>
              <span className="font-medium">Duration:</span>
              <p className="text-muted-foreground">{Math.round((content.metadata?.duration || content.duration) / 60)} minutes</p>
            </div>
            {content.metadata?.wordCount && (
              <div>
                <span className="font-medium">Word Count:</span>
                <p className="text-muted-foreground">{content.metadata.wordCount} words</p>
              </div>
            )}
            <div>
              <span className="font-medium">Voice:</span>
              <p className="text-muted-foreground">Luna ({content.metadata?.voice || 'nova'})</p>
            </div>
            {content.metadata?.generatedAt && (
              <div>
                <span className="font-medium">Generated:</span>
                <p className="text-muted-foreground">
                  {new Date(content.metadata.generatedAt).toLocaleDateString()}
                </p>
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Script Preview */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle className="text-base">Script</CardTitle>
            <Button
              variant="outline"
              size="sm"
              onClick={() => onCopy(content.cleanScript, 'script')}
            >
              {copiedItems.has('script') ? (
                <Check className="h-4 w-4 mr-1" />
              ) : (
                <Copy className="h-4 w-4 mr-1" />
              )}
              Copy Script
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          <div className="bg-gray-50 dark:bg-gray-900 p-4 rounded-lg">
            <pre className="whitespace-pre-wrap text-sm font-mono">
              {content.cleanScript}
            </pre>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}