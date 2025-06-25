'use client';

import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { 
  ArrowLeft, 
  Edit, 
  Save, 
  Download, 
  Copy, 
  Heart,
  Trash2,
  RefreshCw,
  Loader2,
  CheckCircle,
  AlertCircle
} from 'lucide-react';
import { RubricDisplay } from './RubricDisplay';
import { MindMapDisplay } from './MindMapDisplay';
import { BrainBytesDisplay } from './BrainBytesDisplay';
import { QuizDisplay } from './QuizDisplay';
import { teacherToolLibraryService } from '@/lib/services/teacherToolLibrary';
import { TeacherToolCreation, ToolCreationContent } from '@/types/teachingTools';

interface CreationViewerProps {
  creationId: string;
  onBack?: () => void;
}

export function CreationViewer({ creationId, onBack }: CreationViewerProps) {
  const router = useRouter();
  const [creation, setCreation] = useState<TeacherToolCreation | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [copiedItems, setCopiedItems] = useState<Set<string>>(new Set());

  useEffect(() => {
    loadCreation();
  }, [creationId]);

  const loadCreation = async () => {
    try {
      setLoading(true);
      const data = await teacherToolLibraryService.getCreation(creationId);
      setCreation(data);
    } catch (err) {
      setError('Failed to load creation');
      console.error('Error loading creation:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleBack = () => {
    if (onBack) {
      onBack();
    } else {
      router.back();
    }
  };

  const handleToggleFavorite = async () => {
    if (!creation) return;

    try {
      const updatedCreation = await teacherToolLibraryService.toggleFavorite(
        creation.id, 
        !creation.is_favorite
      );
      setCreation(updatedCreation);
    } catch (err) {
      setError('Failed to update favorite status');
      console.error('Error updating favorite:', err);
    }
  };

  const handleDelete = async () => {
    if (!creation) return;
    
    if (confirm('Are you sure you want to delete this creation? This action cannot be undone.')) {
      try {
        await teacherToolLibraryService.deleteCreation(creation.id);
        router.push(`/teach/tools/${creation.tool_id}/library`);
      } catch (err) {
        setError('Failed to delete creation');
        console.error('Error deleting creation:', err);
      }
    }
  };

  const copyToClipboard = async (text: string, itemId: string) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopiedItems(prev => new Set([...prev, itemId]));
      setTimeout(() => {
        setCopiedItems(prev => {
          const newSet = new Set(prev);
          newSet.delete(itemId);
          return newSet;
        });
      }, 2000);
    } catch (err) {
      console.error('Failed to copy to clipboard:', err);
    }
  };

  const handleRefineWithLuna = (currentData: any) => {
    // Since we removed the editor, we could either:
    // 1. Disable refinement entirely
    // 2. Create a new creation based on this one
    // For now, let's create a new creation
    router.push(`/teach/tools/${creation?.tool_id}?refine=${creation?.id}`);
  };

  const renderCreationContent = () => {
    if (!creation) return null;

    // Convert content to string for display components
    const contentString = typeof creation.content === 'string' 
      ? creation.content 
      : JSON.stringify(creation.content, null, 2);

    switch (creation.tool_id) {
      case 'rubric-generator':
        return (
          <RubricDisplay
            content={contentString}
            metadata={creation.metadata}
            onCopy={copyToClipboard}
            copiedItems={copiedItems}
            onRefineWithLuna={handleRefineWithLuna}
          />
        );

      case 'mindmap-generator':
        return (
          <MindMapDisplay
            content={contentString}
            metadata={creation.metadata}
            onCopy={copyToClipboard}
            copiedItems={copiedItems}
            onRefineWithLuna={handleRefineWithLuna}
          />
        );

      case 'brain-bytes':
        return (
          <BrainBytesDisplay
            content={contentString}
            metadata={creation.metadata}
            onCopy={copyToClipboard}
            copiedItems={copiedItems}
            onRefineWithLuna={handleRefineWithLuna}
          />
        );

      case 'quiz-generator':
        return (
          <QuizDisplay
            content={contentString}
            metadata={creation.metadata}
            onCopy={copyToClipboard}
            copiedItems={copiedItems}
            onRefineWithLuna={handleRefineWithLuna}
          />
        );

      default:
        // Generic display for other tool types
        return (
          <Card>
            <CardHeader>
              <CardTitle>{creation.title}</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="prose dark:prose-invert max-w-none">
                <pre className="whitespace-pre-wrap font-sans text-sm leading-relaxed bg-muted/30 p-4 rounded-lg">
                  {contentString}
                </pre>
              </div>
            </CardContent>
          </Card>
        );
    }
  };

  if (loading) {
    return (
      <div className="max-w-6xl mx-auto space-y-6">
        <Card className="border-0 shadow-sm">
          <CardContent className="flex items-center justify-center py-12">
            <div className="text-center space-y-3">
              <Loader2 className="w-8 h-8 animate-spin mx-auto text-purple-500" />
              <p className="text-muted-foreground">Loading creation...</p>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (error || !creation) {
    return (
      <div className="max-w-6xl mx-auto space-y-6">
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="sm" onClick={handleBack} className="flex items-center gap-2">
            <ArrowLeft className="w-4 h-4" />
            Back
          </Button>
        </div>
        
        <Card className="border-0 shadow-sm">
          <CardContent className="flex items-center justify-center py-12">
            <div className="text-center space-y-3">
              <AlertCircle className="w-8 h-8 mx-auto text-red-500" />
              <p className="text-muted-foreground">{error || 'Creation not found'}</p>
              <Button onClick={loadCreation} variant="outline">
                Try Again
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="max-w-6xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="sm" onClick={handleBack} className="flex items-center gap-2">
            <ArrowLeft className="w-4 h-4" />
            Back to Library
          </Button>
          <div>
            <h1 className="text-2xl font-bold">{creation.title}</h1>
            <div className="flex items-center gap-2 mt-1">
              <Badge variant="secondary">{creation.tool_name}</Badge>
              {creation.metadata?.subject && (
                <Badge variant="outline">{creation.metadata.subject}</Badge>
              )}
              {creation.metadata?.gradeLevel && (
                <Badge variant="outline">Grade {creation.metadata.gradeLevel}</Badge>
              )}
              <span className="text-sm text-muted-foreground">
                Created {new Date(creation.created_at).toLocaleDateString()}
              </span>
            </div>
          </div>
        </div>

        {/* Action Buttons */}
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={handleToggleFavorite}
            className={creation.is_favorite ? 'text-red-500' : ''}
          >
            <Heart className={`w-4 h-4 ${creation.is_favorite ? 'fill-current' : ''}`} />
          </Button>
          
          <Button variant="outline" size="sm" onClick={handleDelete} className="text-red-600 hover:text-red-700">
            <Trash2 className="w-4 h-4" />
          </Button>
        </div>
      </div>

      {/* Description */}
      {creation.description && (
        <Card>
          <CardContent className="pt-6">
            <p className="text-muted-foreground">{creation.description}</p>
          </CardContent>
        </Card>
      )}

      {/* Tags */}
      {creation.tags && creation.tags.length > 0 && (
        <div className="flex items-center gap-2">
          <span className="text-sm font-medium">Tags:</span>
          {creation.tags.map((tag, index) => (
            <Badge key={index} variant="outline" className="text-xs">
              {tag}
            </Badge>
          ))}
        </div>
      )}

      <Separator />

      {/* Content Display */}
      <div className="space-y-6">
        {renderCreationContent()}
      </div>
    </div>
  );
} 