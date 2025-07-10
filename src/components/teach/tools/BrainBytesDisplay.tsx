'use client';

import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Copy, Edit3, Check, RefreshCw, Brain } from 'lucide-react';

interface BrainByte {
  id: number;
  title: string;
  content: string;
  category: string;
}

interface ParsedBrainBytes {
  title: string;
  description: string;
  bytes: BrainByte[];
}

interface BrainBytesDisplayProps {
  content: string;
  metadata?: any;
  onCopy: (text: string, itemId: string) => void;
  copiedItems: Set<string>;
  onRefineWithLuna?: (currentBrainBytes: ParsedBrainBytes) => void;
}

export function BrainBytesDisplay({ content, metadata, onCopy, copiedItems, onRefineWithLuna }: BrainBytesDisplayProps) {
  const [editingCell, setEditingCell] = useState<string | null>(null);
  const [editedBrainBytes, setEditedBrainBytes] = useState<ParsedBrainBytes | null>(null);
  const [editingTitle, setEditingTitle] = useState(false);

  const parseBrainBytesContent = (content: string): ParsedBrainBytes => {
    const lines = content.split('\n');
    const bytes: BrainByte[] = [];
    let currentByte: Partial<BrainByte> | null = null;
    let byteCounter = 0;

    for (const line of lines) {
      const trimmedLine = line.trim();
      
      if (trimmedLine.match(/^(##|\*|\d+\.)\s+(.+)/)) {
        if (currentByte && currentByte.title && currentByte.content) {
          bytes.push({
            id: byteCounter + 1,
            title: currentByte.title,
            content: currentByte.content,
            category: 'fact'
          });
          byteCounter++;
        }
        
        const title = trimmedLine.replace(/^(##|\*|\d+\.)\s+/, '');
        currentByte = { title, content: '', category: 'fact' };
      } else if (trimmedLine && currentByte) {
        if (currentByte.content) {
          currentByte.content += ' ' + trimmedLine;
        } else {
          currentByte.content = trimmedLine;
        }
      }
    }
    
    if (currentByte && currentByte.title && currentByte.content) {
      bytes.push({
        id: byteCounter + 1,
        title: currentByte.title,
        content: currentByte.content,
        category: 'fact'
      });
    }

    return {
      title: 'Brain Bytes',
      description: 'Bite-sized learning facts',
      bytes
    };
  };

  const currentBrainBytes = editedBrainBytes || parseBrainBytesContent(content);

  const handleByteEdit = (byteId: number, field: 'title' | 'content', value: string) => {
    const newBrainBytes = { ...currentBrainBytes };
    const byte = newBrainBytes.bytes.find(b => b.id === byteId);
    if (byte) {
      byte[field] = value;
      setEditedBrainBytes(newBrainBytes);
    }
  };

  const copyBrainBytesText = () => {
    let text = `# ${currentBrainBytes.title}\n\n${currentBrainBytes.description}\n\n`;
    currentBrainBytes.bytes.forEach((byte, index) => {
      text += `## ${index + 1}. ${byte.title}\n\n${byte.content}\n\n`;
    });
    onCopy(text, 'brainbytes-full');
  };

  return (
    <div className="space-y-6">
      <div className="border rounded-lg p-6 bg-gradient-to-r from-indigo-50 to-cyan-50 dark:from-indigo-950/20 dark:to-cyan-950/20">
        <div className="flex items-start justify-between mb-4">
          <div className="flex-1">
            <h2 className="text-2xl font-bold text-foreground mb-2 flex items-center gap-2">
              <Brain className="w-6 h-6 text-indigo-600" />
              {editingTitle ? (
                <Input
                  value={currentBrainBytes.title}
                  onChange={(e) => {
                    const newBrainBytes = { ...currentBrainBytes, title: e.target.value };
                    setEditedBrainBytes(newBrainBytes);
                  }}
                  onBlur={() => setEditingTitle(false)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' || e.key === 'Escape') {
                      setEditingTitle(false);
                    }
                  }}
                  autoFocus
                />
              ) : (
                <span 
                  onClick={() => setEditingTitle(true)}
                  className="cursor-pointer hover:bg-background/50 rounded px-2 py-1 transition-colors"
                >
                  {currentBrainBytes.title}
                </span>
              )}
            </h2>
            <p className="text-muted-foreground">{currentBrainBytes.description}</p>
          </div>
          
          <div className="flex gap-2 ml-4">
            <Button variant="outline" size="sm" onClick={copyBrainBytesText} className="gap-2">
              <Copy className="w-4 h-4" />
              {copiedItems.has('brainbytes-full') ? 'Copied!' : 'Copy'}
            </Button>
            {onRefineWithLuna && (
              <Button variant="outline" size="sm" onClick={() => onRefineWithLuna(currentBrainBytes)} className="gap-2">
                <RefreshCw className="w-4 h-4" />
                Refine with Luna
              </Button>
            )}
          </div>
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        {currentBrainBytes.bytes.map((byte) => (
          <Card key={byte.id} className="hover:shadow-md transition-shadow group">
            <CardHeader className="pb-3">
              <CardTitle className="text-lg">
                {editingCell === `byte-${byte.id}-title` ? (
                  <div className="flex items-center gap-2">
                    <Input
                      value={byte.title}
                      onChange={(e) => handleByteEdit(byte.id, 'title', e.target.value)}
                      className="flex-1"
                      autoFocus
                    />
                    <Button size="sm" variant="ghost" onClick={() => setEditingCell(null)}>
                      <Check className="w-4 h-4" />
                    </Button>
                  </div>
                ) : (
                  <div className="flex items-center gap-2">
                    <span 
                      className="flex-1 cursor-pointer hover:bg-background/50 rounded p-1 transition-colors"
                      onClick={() => setEditingCell(`byte-${byte.id}-title`)}
                    >
                      {byte.title}
                    </span>
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => setEditingCell(`byte-${byte.id}-title`)}
                      className="opacity-0 group-hover:opacity-100 transition-opacity"
                    >
                      <Edit3 className="w-4 h-4" />
                    </Button>
                  </div>
                )}
              </CardTitle>
            </CardHeader>
            
            <CardContent>
              {editingCell === `byte-${byte.id}-content` ? (
                <div className="flex items-start gap-2">
                  <Textarea
                    value={byte.content}
                    onChange={(e) => handleByteEdit(byte.id, 'content', e.target.value)}
                    className="flex-1 min-h-[80px]"
                    autoFocus
                  />
                  <Button size="sm" variant="ghost" onClick={() => setEditingCell(null)}>
                    <Check className="w-4 h-4" />
                  </Button>
                </div>
              ) : (
                <div className="flex items-start gap-2">
                  <p 
                    className="flex-1 text-sm leading-relaxed cursor-pointer hover:bg-background/50 rounded p-2 transition-colors border"
                    onClick={() => setEditingCell(`byte-${byte.id}-content`)}
                  >
                    {byte.content}
                  </p>
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() => setEditingCell(`byte-${byte.id}-content`)}
                    className="opacity-0 group-hover:opacity-100 transition-opacity"
                  >
                    <Edit3 className="w-4 h-4" />
                  </Button>
                </div>
              )}
            </CardContent>
          </Card>
        ))}
      </div>

      <details className="border rounded-lg">
        <summary className="p-4 cursor-pointer hover:bg-muted/50 transition-colors font-medium">
          View Raw AI Content
        </summary>
        <div className="p-4 border-t bg-muted/20">
          <pre className="whitespace-pre-wrap text-sm text-muted-foreground font-mono">
            {content}
          </pre>
        </div>
      </details>
    </div>
  );
}