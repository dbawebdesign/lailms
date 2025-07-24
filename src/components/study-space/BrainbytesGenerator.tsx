'use client';

import React, { useState, useRef, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { 
  Headphones, 
  Play, 
  Pause, 
  Download, 
  Loader2, 
  Sparkles,
  Volume2,
  RefreshCw,
  FileText,
  Brain,
  Clock,
  Wand2,
  Trash2
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { createClient } from '@/lib/supabase/client';

interface BrainbytesData {
  id: string;
  audioUrl: string;
  script: string;
  title: string;
  duration: number;
  createdAt: string;
}

interface BrainbytesGeneratorProps {
  selectedContent: any[];
  selectedText?: {
    text: string;
    source: string;
  };
  baseClassId?: string;
  studySpaceId: string;
  className?: string;
}

export function BrainbytesGenerator({
  selectedContent,
  selectedText,
  baseClassId,
  studySpaceId,
  className
}: BrainbytesGeneratorProps) {
  const [isGenerating, setIsGenerating] = useState(false);
  const [instructions, setInstructions] = useState('');
  const [currentBrainbytes, setCurrentBrainbytes] = useState<BrainbytesData | null>(null);
  const [previousBrainbytes, setPreviousBrainbytes] = useState<BrainbytesData[]>([]);
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [error, setError] = useState<string | null>(null);
  
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const supabase = createClient();

  // Load previous brainbytes on component mount
  useEffect(() => {
    loadPreviousBrainbytes();
  }, [baseClassId, studySpaceId]);

  // Audio event handlers
  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) return;

    const updateTime = () => setCurrentTime(audio.currentTime);
    const updateDuration = () => setDuration(audio.duration);
    const handleEnded = () => setIsPlaying(false);

    audio.addEventListener('timeupdate', updateTime);
    audio.addEventListener('loadedmetadata', updateDuration);
    audio.addEventListener('ended', handleEnded);

    return () => {
      audio.removeEventListener('timeupdate', updateTime);
      audio.removeEventListener('loadedmetadata', updateDuration);
      audio.removeEventListener('ended', handleEnded);
    };
  }, [currentBrainbytes]);

  const loadPreviousBrainbytes = async () => {
    try {
      const { data, error } = await (supabase as any)
        .from('study_space_brainbytes')
        .select('*')
        .eq('study_space_id', studySpaceId)
        .order('created_at', { ascending: false })
        .limit(5);

      if (error) throw error;

      const formattedData: BrainbytesData[] = (data || []).map((item: any) => ({
        id: item.id,
        audioUrl: item.audio_url,
        script: item.script,
        title: item.title,
        duration: item.duration_minutes * 60, // Convert minutes to seconds
        createdAt: item.created_at
      }));

      setPreviousBrainbytes(formattedData);
    } catch (err) {
      console.error('Error loading previous brainbytes:', err);
    }
  };

  const generateBrainbytes = async () => {
    if (!selectedContent.length && !selectedText) {
      setError('Please select some content to generate a Brainbytes podcast.');
      return;
    }

    setIsGenerating(true);
    setError(null);

    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('User not authenticated');

      // Build context like mind map does - prioritize selected text
      const studyContext = {
        selectedContent: selectedText ? [] : (selectedContent || []), // Don't use selected content if we have selected text
        selectedText: selectedText || null // Selected text takes priority when available
      };

      const response = await fetch('/api/study-space/brainbytes/generate', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          studyContext,
          baseClassId,
          studySpaceId,
          instructions: instructions.trim() || undefined,
          gradeLevel: 'college' // Default for now, could be made configurable
        }),
      });

      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.error || 'Failed to generate Brainbytes');
      }

      const newBrainbytes: BrainbytesData = {
        id: result.id || 'temp-' + Date.now(),
        audioUrl: result.audioUrl,
        script: result.script,
        title: result.title || 'New Brainbytes Podcast',
        duration: 180, // 3 minutes
        createdAt: new Date().toISOString()
      };

      setCurrentBrainbytes(newBrainbytes);
      setInstructions(''); // Clear instructions after successful generation
      
      // Reload previous brainbytes to include the new one
      await loadPreviousBrainbytes();

    } catch (err) {
      console.error('Error generating Brainbytes:', err);
      setError(err instanceof Error ? err.message : 'Failed to generate Brainbytes podcast');
    } finally {
      setIsGenerating(false);
    }
  };

  const togglePlayPause = () => {
    const audio = audioRef.current;
    if (!audio || !currentBrainbytes) return;

    if (isPlaying) {
      audio.pause();
      setIsPlaying(false);
    } else {
      audio.play();
      setIsPlaying(true);
    }
  };

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  const downloadAudio = (audioUrl: string, title: string) => {
    const link = document.createElement('a');
    link.href = audioUrl;
    link.download = `${title.replace(/[^a-zA-Z0-9]/g, '_')}.mp3`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const deleteBrainbytes = async (brainbytesData: BrainbytesData) => {
    if (!confirm(`Are you sure you want to delete "${brainbytesData.title}"? This action cannot be undone.`)) {
      return;
    }

    try {
      const { error } = await (supabase as any)
        .from('study_space_brainbytes')
        .delete()
        .eq('id', brainbytesData.id);

      if (error) throw error;

      // Remove from state
      setPreviousBrainbytes(prev => prev.filter(item => item.id !== brainbytesData.id));
      
      // If this was the currently playing brainbytes, clear it
      if (currentBrainbytes?.id === brainbytesData.id) {
        setCurrentBrainbytes(null);
      }

    } catch (err) {
      console.error('Error deleting brainbytes:', err);
      alert('Failed to delete the podcast. Please try again.');
    }
  };

  const hasContent = selectedContent.length > 0 || selectedText;

  return (
    <div className={cn("space-y-4", className)}>
      {/* Generation Interface */}
      <Card className="bg-gradient-to-br from-purple-50 to-blue-50 dark:from-purple-950/20 dark:to-blue-950/20 border-purple-200 dark:border-purple-800">
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2 text-sm">
            <div className="p-1.5 rounded-lg bg-purple-500/10">
              <Brain className="h-4 w-4 text-purple-600 dark:text-purple-400" />
            </div>
            Generate Brainbytes Podcast
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Content Status */}
          <div className="flex flex-wrap gap-2">
            {selectedContent.length > 0 && (
              <Badge variant="secondary" className="text-xs bg-blue-100 dark:bg-blue-900/50">
                <FileText className="h-3 w-3 mr-1" />
                {selectedContent.length} source{selectedContent.length !== 1 ? 's' : ''}
              </Badge>
            )}
            {selectedText && (
              <Badge variant="secondary" className="text-xs bg-green-100 dark:bg-green-900/50">
                <FileText className="h-3 w-3 mr-1" />
                Selected text
              </Badge>
            )}

            {!hasContent && (
              <Badge variant="outline" className="text-xs text-muted-foreground">
                No content selected
              </Badge>
            )}
          </div>

          {/* Instructions Input */}
          <div className="space-y-2">
            <label className="text-xs font-medium text-muted-foreground">
              Instructions (optional)
            </label>
            <Textarea
              placeholder="Add any specific focus or instructions for the podcast (e.g., 'Focus on practical examples', 'Explain concepts simply')..."
              value={instructions}
              onChange={(e) => setInstructions(e.target.value)}
              className="resize-none text-sm h-20"
              disabled={isGenerating}
            />
          </div>

          {/* Error Display */}
          {error && (
            <div className="p-3 bg-red-50 dark:bg-red-950/20 border border-red-200 dark:border-red-800 rounded-lg">
              <p className="text-sm text-red-600 dark:text-red-400">{error}</p>
            </div>
          )}

          {/* Generate Button */}
          <Button 
            onClick={generateBrainbytes}
            disabled={isGenerating || !hasContent}
            className="w-full bg-gradient-to-r from-purple-500 to-blue-500 hover:from-purple-600 hover:to-blue-600"
          >
            {isGenerating ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                Creating Podcast...
              </>
            ) : (
              <>
                <Sparkles className="h-4 w-4 mr-2" />
                Generate 3-Minute Podcast
              </>
            )}
          </Button>
        </CardContent>
      </Card>

      {/* Current Brainbytes Player */}
      {currentBrainbytes && (
        <Card className="bg-gradient-to-br from-indigo-50 to-purple-50 dark:from-indigo-950/20 dark:to-purple-950/20 border-indigo-200 dark:border-indigo-800">
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center gap-2 text-sm">
              <div className="p-1.5 rounded-lg bg-indigo-500/10">
                <Headphones className="h-4 w-4 text-indigo-600 dark:text-indigo-400" />
              </div>
              {currentBrainbytes.title}
              <Badge className="ml-auto bg-green-100 text-green-700 dark:bg-green-900 dark:text-green-300">
                <Clock className="h-3 w-3 mr-1" />
                3 min
              </Badge>
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {/* Audio Controls */}
            <div className="flex items-center gap-3">
              <Button
                size="sm"
                onClick={togglePlayPause}
                className="h-8 w-8 p-0 rounded-full"
                variant="default"
              >
                {isPlaying ? <Pause className="h-4 w-4" /> : <Play className="h-4 w-4" />}
              </Button>
              
              <div className="flex-1 text-xs text-muted-foreground">
                {formatTime(currentTime)} / {formatTime(duration)}
              </div>
              
              <Button
                size="sm"
                variant="outline"
                onClick={() => downloadAudio(currentBrainbytes.audioUrl, currentBrainbytes.title)}
                className="h-8 w-8 p-0"
              >
                <Download className="h-3 w-3" />
              </Button>
            </div>

            {/* Progress Bar */}
            <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-2">
              <div 
                className="bg-indigo-500 h-2 rounded-full transition-all duration-300"
                style={{ width: duration > 0 ? `${(currentTime / duration) * 100}%` : '0%' }}
              />
            </div>

            {/* Script Preview */}
            <details className="group">
              <summary className="cursor-pointer text-xs font-medium text-muted-foreground hover:text-foreground transition-colors">
                View Script
              </summary>
              <ScrollArea className="h-32 mt-2">
                <div className="text-xs text-muted-foreground leading-relaxed p-3 bg-background/50 rounded-lg">
                  {currentBrainbytes.script}
                </div>
              </ScrollArea>
            </details>

            {/* Hidden audio element */}
            {currentBrainbytes.audioUrl && (
              <audio
                ref={audioRef}
                src={currentBrainbytes.audioUrl}
                preload="metadata"
              />
            )}
          </CardContent>
        </Card>
      )}

      {/* Previous Brainbytes */}
      {previousBrainbytes.length > 0 && (
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center gap-2 text-sm">
              <div className="p-1.5 rounded-lg bg-gray-500/10">
                <Volume2 className="h-4 w-4 text-gray-600 dark:text-gray-400" />
              </div>
              Recent Podcasts
            </CardTitle>
          </CardHeader>
          <CardContent>
            <ScrollArea className="h-40">
              <div className="space-y-2">
                {previousBrainbytes.map((brainbytes) => (
                  <div 
                    key={brainbytes.id}
                    className="flex items-center justify-between p-2 rounded-lg hover:bg-muted/50 transition-colors"
                  >
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium truncate">{brainbytes.title}</p>
                      <p className="text-xs text-muted-foreground">
                        {new Date(brainbytes.createdAt).toLocaleDateString()}
                      </p>
                    </div>
                    <div className="flex items-center gap-1">
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => setCurrentBrainbytes(brainbytes)}
                        className="h-6 w-6 p-0"
                      >
                        <Play className="h-3 w-3" />
                      </Button>
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => downloadAudio(brainbytes.audioUrl, brainbytes.title)}
                        className="h-6 w-6 p-0"
                      >
                        <Download className="h-3 w-3" />
                      </Button>
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => deleteBrainbytes(brainbytes)}
                        className="h-6 w-6 p-0 text-red-500 hover:text-red-700 hover:bg-red-50 dark:hover:bg-red-950/20"
                      >
                        <Trash2 className="h-3 w-3" />
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            </ScrollArea>
          </CardContent>
        </Card>
      )}

      {/* Empty State */}
      {!currentBrainbytes && previousBrainbytes.length === 0 && !isGenerating && (
        <div className="text-center py-8">
          <div className="p-6 rounded-2xl bg-gradient-to-br from-purple-50 to-blue-50 dark:from-purple-950/20 dark:to-blue-950/20 mb-4 inline-block">
            <Headphones className="h-8 w-8 text-purple-500 mx-auto" />
          </div>
          <h3 className="font-medium mb-2">Create Your First Brainbytes</h3>
          <p className="text-sm text-muted-foreground mb-4 max-w-sm mx-auto">
            Generate an educational podcast from your selected study materials and notes.
          </p>
          {!hasContent && (
            <p className="text-xs text-orange-600 dark:text-orange-400">
              Select some content from the sources panel to get started.
            </p>
          )}
        </div>
      )}
    </div>
  );
} 