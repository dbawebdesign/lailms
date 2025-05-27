'use client';

import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { 
  Brain, 
  Mic, 
  Play, 
  Pause, 
  Download, 
  Eye, 
  Loader2, 
  CheckCircle, 
  AlertCircle 
} from 'lucide-react';
import MindMapViewModal from './MindMapViewModal';

interface MediaAsset {
  id: string;
  type: 'mind_map' | 'podcast';
  title: string;
  status: 'generating' | 'completed' | 'error';
  url?: string;
  duration?: number; // for podcasts
  createdAt: string;
  progress?: number;
}

interface MediaAssetsPanelProps {
  lessonId: string;
  lessonContent: string;
  gradeLevel?: string;
  className?: string;
  onAssetGenerated?: () => void;
}

export default function MediaAssetsPanel({
  lessonId,
  lessonContent,
  gradeLevel = '8',
  className,
  onAssetGenerated
}: MediaAssetsPanelProps) {
  const [assets, setAssets] = useState<MediaAsset[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [audioPlaying, setAudioPlaying] = useState<string | null>(null);
  const [mindMapModalOpen, setMindMapModalOpen] = useState(false);
  const [selectedMindMap, setSelectedMindMap] = useState<MediaAsset | null>(null);
  const [currentAudio, setCurrentAudio] = useState<HTMLAudioElement | null>(null);

  // Load existing assets on mount
  useEffect(() => {
    loadExistingAssets();
  }, [lessonId]);

  // Clean up audio when component unmounts
  useEffect(() => {
    return () => {
      if (currentAudio) {
        currentAudio.pause();
        currentAudio.src = '';
      }
    };
  }, [currentAudio]);

  const loadExistingAssets = async () => {
    try {
      const response = await fetch(`/api/teach/lessons/${lessonId}/media-assets`);
      if (response.ok) {
        const data = await response.json();
        setAssets(data.assets || []);
      }
    } catch (err) {
      console.error('Failed to load existing assets:', err);
    }
  };

  const generateMindMap = async (regenerate = false) => {
    if (!lessonContent.trim()) {
      setError('Lesson content is required to generate a mind map');
      return;
    }

    // Check if mind map already exists (allow regeneration)
    const existingMindMap = assets.find(asset => asset.type === 'mind_map');
    if (existingMindMap && existingMindMap.status === 'completed' && !regenerate) {
      setError('A mind map already exists for this lesson. Use the "Regenerate" button to create a new version.');
      return;
    }

    setLoading(true);
    setError(null);

    // Create placeholder asset
    const tempId = Date.now().toString();
    const newAsset: MediaAsset = {
      id: tempId,
      type: 'mind_map',
      title: 'Lesson Mind Map',
      status: 'generating',
      createdAt: new Date().toISOString(),
      progress: 0
    };

    setAssets(prev => [...prev.filter(a => a.type !== 'mind_map'), newAsset]);

    try {
      const url = `/api/teach/media/generate/mind-map${regenerate ? '?regenerate=true' : ''}`;
      const response = await fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          lessonId,
          content: lessonContent,
          gradeLevel
        }),
      });

      if (!response.ok) {
        throw new Error('Failed to generate mind map');
      }

      const result = await response.json();
      
      setAssets(prev => prev.map(asset => 
        asset.id === tempId 
          ? { ...asset, ...result.asset, status: 'completed' }
          : asset
      ));

    } catch (err) {
      console.error('Mind map generation failed:', err);
      setAssets(prev => prev.map(asset => 
        asset.id === tempId 
          ? { ...asset, status: 'error' }
          : asset
      ));
      setError('Failed to generate mind map. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const generatePodcast = async (regenerate = false) => {
    if (!lessonContent.trim()) {
      setError('Lesson content is required to generate a Brain Bytes podcast');
      return;
    }

    // Check if podcast already exists (allow regeneration)
    const existingPodcast = assets.find(asset => asset.type === 'podcast');
    if (existingPodcast && existingPodcast.status === 'completed' && !regenerate) {
      setError('A Brain Bytes podcast already exists for this lesson. Use the "Regenerate" button to create a new version.');
      return;
    }

    setLoading(true);
    setError(null);

    // Create placeholder asset
    const tempId = Date.now().toString();
    const newAsset: MediaAsset = {
      id: tempId,
      type: 'podcast',
      title: 'Brain Bytes Podcast',
      status: 'generating',
      createdAt: new Date().toISOString(),
      progress: 0
    };

    setAssets(prev => [...prev.filter(a => a.type !== 'podcast'), newAsset]);

    try {
      const url = `/api/teach/media/generate/podcast${regenerate ? '?regenerate=true' : ''}`;
      const response = await fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          lessonId,
          content: lessonContent,
          gradeLevel
        }),
      });

      if (!response.ok) {
        throw new Error('Failed to generate podcast');
      }

      const result = await response.json();
      
      setAssets(prev => prev.map(asset => 
        asset.id === tempId 
          ? { ...asset, ...result.asset, status: 'completed' }
          : asset
      ));

    } catch (err) {
      console.error('Podcast generation failed:', err);
      setAssets(prev => prev.map(asset => 
        asset.id === tempId 
          ? { ...asset, status: 'error' }
          : asset
      ));
      setError('Failed to generate Brain Bytes podcast. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const toggleAudioPlayback = (assetId: string, url: string) => {
    if (audioPlaying === assetId) {
      // Pause current audio
      if (currentAudio) {
        currentAudio.pause();
      }
      setAudioPlaying(null);
    } else {
      // Stop any currently playing audio
      if (currentAudio) {
        currentAudio.pause();
        currentAudio.currentTime = 0;
      }

      // Create new audio instance
      const audio = new Audio(url);
      
      // Set up event listeners
      audio.addEventListener('loadstart', () => {
        console.log('Audio loading started');
      });
      
      audio.addEventListener('canplay', () => {
        console.log('Audio can play');
      });
      
      audio.addEventListener('ended', () => {
        setAudioPlaying(null);
      });
      
      audio.addEventListener('error', (e) => {
        console.error('Audio playback error:', e);
        setError('Failed to play audio. Please try again or download the file.');
        setAudioPlaying(null);
      });

      // Start playing
      audio.play().then(() => {
        setAudioPlaying(assetId);
        setCurrentAudio(audio);
        setError(null);
      }).catch((error) => {
        console.error('Audio play failed:', error);
        setError('Failed to play audio. Please try again or download the file.');
        setAudioPlaying(null);
      });
    }
  };

  const downloadAsset = (asset: MediaAsset) => {
    if (asset.url) {
      const link = document.createElement('a');
      link.href = asset.url;
      link.download = `${asset.title.replace(/\s+/g, '_')}.${asset.type === 'podcast' ? 'mp3' : 'png'}`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
    }
  };

  const viewAsset = (asset: MediaAsset) => {
    if (asset.type === 'mind_map') {
      setSelectedMindMap(asset);
      setMindMapModalOpen(true);
    } else if (asset.url) {
      window.open(asset.url, '_blank');
    }
  };

  const handleRegenerateMindMap = () => {
    void generateMindMap(true);
  };

  const handleGenerateMindMap = () => {
    void generateMindMap(false);
  };

  const handleRegeneratePodcast = () => {
    void generatePodcast(true);
  };

  const mindMapAsset = assets.find(asset => asset.type === 'mind_map');
  const podcastAsset = assets.find(asset => asset.type === 'podcast');

  return (
    <div className={`space-y-6 ${className}`}>
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-gray-900 dark:text-white">AI Media Generation</h2>
          <p className="text-sm text-gray-600 dark:text-gray-300">
            Generate educational content based on your lesson
          </p>
        </div>
        {gradeLevel && (
          <Badge variant="outline" className="text-sm">
            Grade {gradeLevel}
          </Badge>
        )}
      </div>

      {error && (
        <Alert variant="destructive">
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      {/* Mind Map Section */}
      <Card>
        <CardHeader>
          <div className="flex items-center gap-2">
            <Brain className="h-5 w-5 text-blue-600" />
            <CardTitle>Lesson Mind Map</CardTitle>
          </div>
          <CardDescription>
            Visual representation of key concepts and relationships in your lesson
          </CardDescription>
        </CardHeader>
        <CardContent>
          {mindMapAsset ? (
            <div className="space-y-4">
              <div className="flex items-center gap-2">
                {mindMapAsset.status === 'generating' && (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin" />
                    <span className="text-sm text-gray-600 dark:text-gray-300">Generating mind map...</span>
                  </>
                )}
                {mindMapAsset.status === 'completed' && (
                  <>
                    <CheckCircle className="h-4 w-4 text-green-600" />
                    <span className="text-sm text-gray-600 dark:text-gray-300">Mind map ready</span>
                  </>
                )}
                {mindMapAsset.status === 'error' && (
                  <>
                    <AlertCircle className="h-4 w-4 text-red-600" />
                    <span className="text-sm text-gray-600 dark:text-gray-300">Generation failed</span>
                  </>
                )}
              </div>

              {mindMapAsset.status === 'generating' && mindMapAsset.progress !== undefined && (
                <Progress value={mindMapAsset.progress} className="w-full" />
              )}

              {mindMapAsset.status === 'completed' && (
                <div className="flex gap-2">
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => viewAsset(mindMapAsset)}
                  >
                    <Eye className="h-4 w-4 mr-1" />
                    View
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => downloadAsset(mindMapAsset)}
                  >
                    <Download className="h-4 w-4 mr-1" />
                    Download
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={handleRegenerateMindMap}
                    disabled={loading}
                  >
                    <Brain className="h-4 w-4 mr-1" />
                    Regenerate
                  </Button>
                </div>
              )}

              {mindMapAsset.status === 'error' && (
                <Button
                  size="sm"
                  onClick={handleRegenerateMindMap}
                  disabled={loading}
                >
                  Retry Generation
                </Button>
              )}
            </div>
          ) : (
            <Button
              onClick={handleGenerateMindMap}
              disabled={loading || !lessonContent.trim()}
              className="w-full"
            >
              <Brain className="h-4 w-4 mr-2" />
              Generate Mind Map
            </Button>
          )}
        </CardContent>
      </Card>

      {/* Brain Bytes Podcast Section */}
      <Card>
        <CardHeader>
          <div className="flex items-center gap-2">
            <Mic className="h-5 w-5 text-purple-600" />
            <CardTitle>Brain Bytes Podcast</CardTitle>
          </div>
          <CardDescription>
            AI-generated educational podcast hosted by Luna, tailored to your lesson content
          </CardDescription>
        </CardHeader>
        <CardContent>
          {podcastAsset ? (
            <div className="space-y-4">
              <div className="flex items-center gap-2">
                {podcastAsset.status === 'generating' && (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin" />
                    <span className="text-sm text-gray-600 dark:text-gray-300">Generating podcast...</span>
                  </>
                )}
                {podcastAsset.status === 'completed' && (
                  <>
                    <CheckCircle className="h-4 w-4 text-green-600" />
                    <span className="text-sm text-gray-600 dark:text-gray-300">
                      Podcast ready {podcastAsset.duration && `(${Math.round(podcastAsset.duration / 60)} min)`}
                    </span>
                  </>
                )}
                {podcastAsset.status === 'error' && (
                  <>
                    <AlertCircle className="h-4 w-4 text-red-600" />
                    <span className="text-sm text-gray-600 dark:text-gray-300">Generation failed</span>
                  </>
                )}
              </div>

              {podcastAsset.status === 'generating' && podcastAsset.progress !== undefined && (
                <Progress value={podcastAsset.progress} className="w-full" />
              )}

              {podcastAsset.status === 'completed' && (
                <div className="flex gap-2">
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => toggleAudioPlayback(podcastAsset.id, podcastAsset.url!)}
                  >
                    {audioPlaying === podcastAsset.id ? (
                      <Pause className="h-4 w-4 mr-1" />
                    ) : (
                      <Play className="h-4 w-4 mr-1" />
                    )}
                    {audioPlaying === podcastAsset.id ? 'Pause' : 'Play'}
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => downloadAsset(podcastAsset)}
                  >
                    <Download className="h-4 w-4 mr-1" />
                    Download
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={handleRegeneratePodcast}
                    disabled={loading}
                  >
                    <Mic className="h-4 w-4 mr-1" />
                    Regenerate
                  </Button>
                </div>
              )}

              {podcastAsset.status === 'error' && (
                <Button
                  size="sm"
                  onClick={handleRegeneratePodcast}
                  disabled={loading}
                >
                  Retry Generation
                </Button>
              )}
            </div>
          ) : (
            <Button 
              onClick={() => generatePodcast(false)}
              disabled={loading || !lessonContent.trim()}
              className="w-full"
            >
              <Mic className="h-4 w-4 mr-2" />
              Generate Brain Bytes Podcast
            </Button>
          )}
        </CardContent>
      </Card>

      {(!lessonContent.trim()) && (
        <Alert>
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>
            Add content to your lesson to enable AI media generation.
          </AlertDescription>
        </Alert>
      )}

      {/* Mind Map View Modal */}
      {selectedMindMap && (
        <MindMapViewModal
          isOpen={mindMapModalOpen}
          onClose={() => {
            setMindMapModalOpen(false);
            setSelectedMindMap(null);
          }}
          mindMapId={selectedMindMap.id}
          title={selectedMindMap.title}
        />
      )}
    </div>
  );
} 