'use client';

import { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { createClient } from '@/lib/supabase/client';
import { 
  Target, 
  Plus, 
  Search, 
  Eye, 
  Edit, 
  Trash2, 
  Calendar,
  Lightbulb,
  RefreshCw,
  Download,
  Share
} from 'lucide-react';
import { cn } from '@/lib/utils';

interface MindMap {
  id: string;
  title: string;
  description: string;
  node_count: number;
  created_at: string;
  updated_at: string;
}

interface MindMapViewerProps {
  studySpaceId: string;
  baseClassId?: string;
}

export function MindMapViewer({ studySpaceId, baseClassId }: MindMapViewerProps) {
  const [mindMaps, setMindMaps] = useState<MindMap[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false);
  const [newMindMap, setNewMindMap] = useState({
    title: '',
    description: '',
    topic: ''
  });

  const supabase = createClient();

  useEffect(() => {
    fetchMindMaps();
  }, [studySpaceId]);

  const fetchMindMaps = async () => {
    try {
      setLoading(true);
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      // For now, we'll simulate mind map data
      // TODO: Replace with actual database query once mind_maps table is ready
      const mockMindMaps: MindMap[] = [
        {
          id: '1',
          title: 'Course Overview',
          description: 'High-level overview of all course concepts and their relationships',
          node_count: 12,
          created_at: new Date(Date.now() - 172800000).toISOString(), // 2 days ago
          updated_at: new Date(Date.now() - 172800000).toISOString(),
        }
      ];

      // Simulate loading delay
      await new Promise(resolve => setTimeout(resolve, 500));
      setMindMaps(mockMindMaps);
    } catch (error) {
      console.error('Error fetching mind maps:', error);
    } finally {
      setLoading(false);
    }
  };

  const generateMindMap = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      // TODO: Replace with actual AI mind map generation
      const newMindMapData: MindMap = {
        id: Date.now().toString(),
        title: newMindMap.title || 'Generated Mind Map',
        description: newMindMap.description || `Mind map for topic: ${newMindMap.topic}`,
        node_count: Math.floor(Math.random() * 20) + 5,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      };

      setMindMaps(prev => [newMindMapData, ...prev]);
      setNewMindMap({ title: '', description: '', topic: '' });
      setIsCreateDialogOpen(false);
    } catch (error) {
      console.error('Error generating mind map:', error);
    }
  };

  const deleteMindMap = async (mindMapId: string) => {
    try {
      // TODO: Replace with actual database delete
      setMindMaps(prev => prev.filter(map => map.id !== mindMapId));
    } catch (error) {
      console.error('Error deleting mind map:', error);
    }
  };

  const filteredMindMaps = mindMaps.filter(map =>
    map.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
    map.description.toLowerCase().includes(searchTerm.toLowerCase())
  );

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <RefreshCw className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-semibold">Mind Maps</h3>
        <Dialog open={isCreateDialogOpen} onOpenChange={setIsCreateDialogOpen}>
          <DialogTrigger asChild>
            <Button>
              <Lightbulb className="h-4 w-4 mr-2" />
              Generate Mind Map
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-2xl">
            <DialogHeader>
              <DialogTitle>Generate Mind Map</DialogTitle>
              <DialogDescription>
                Create a visual concept map from your course content
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4">
              <div>
                <Input
                  placeholder="Mind map title..."
                  value={newMindMap.title}
                  onChange={(e) => setNewMindMap(prev => ({ ...prev, title: e.target.value }))}
                />
              </div>
              <div>
                <Input
                  placeholder="Topic or concept to map..."
                  value={newMindMap.topic}
                  onChange={(e) => setNewMindMap(prev => ({ ...prev, topic: e.target.value }))}
                />
              </div>
              <div>
                <Textarea
                  placeholder="Additional description or context..."
                  value={newMindMap.description}
                  onChange={(e) => setNewMindMap(prev => ({ ...prev, description: e.target.value }))}
                  rows={4}
                />
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setIsCreateDialogOpen(false)}>
                Cancel
              </Button>
              <Button onClick={generateMindMap}>
                Generate Mind Map
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>

      {/* Search */}
      <div className="relative">
        <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground h-4 w-4" />
        <Input
          placeholder="Search mind maps..."
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          className="pl-10"
        />
      </div>

      {/* Mind Maps List */}
      {filteredMindMaps.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-12">
            <Target className="h-12 w-12 text-muted-foreground mb-4" />
            <h3 className="text-lg font-semibold mb-2">
              {searchTerm ? 'No mind maps found' : 'No mind maps yet'}
            </h3>
            <p className="text-muted-foreground text-center mb-4">
              {searchTerm 
                ? 'Try adjusting your search terms'
                : 'Generate visual concept maps from your course content'
              }
            </p>
            {!searchTerm && (
              <Button onClick={() => setIsCreateDialogOpen(true)}>
                <Lightbulb className="h-4 w-4 mr-2" />
                Generate First Mind Map
              </Button>
            )}
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4 md:grid-cols-2">
          {filteredMindMaps.map((mindMap) => (
            <Card key={mindMap.id} className="hover:shadow-md transition-shadow">
              <CardHeader className="pb-3">
                <div className="flex items-start justify-between">
                  <div className="flex-1 min-w-0">
                    <CardTitle className="text-base truncate">{mindMap.title}</CardTitle>
                    <CardDescription className="flex items-center space-x-4 text-sm">
                      <div className="flex items-center space-x-1">
                        <Calendar className="h-3 w-3" />
                        <span>{new Date(mindMap.created_at).toLocaleDateString()}</span>
                      </div>
                      <div className="flex items-center space-x-1">
                        <Target className="h-3 w-3" />
                        <span>{mindMap.node_count} nodes</span>
                      </div>
                    </CardDescription>
                  </div>
                  <div className="flex items-center space-x-2">
                    <Button variant="ghost" size="sm">
                      <Eye className="h-4 w-4" />
                    </Button>
                    <Button variant="ghost" size="sm">
                      <Download className="h-4 w-4" />
                    </Button>
                    <Button 
                      variant="ghost" 
                      size="sm" 
                      onClick={() => deleteMindMap(mindMap.id)}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                <p className="text-sm text-muted-foreground line-clamp-2 mb-3">
                  {mindMap.description}
                </p>
                <div className="flex items-center justify-between">
                  <Badge variant="secondary" className="text-xs">
                    Visual Map
                  </Badge>
                  <div className="flex space-x-2">
                    <Button variant="outline" size="sm">
                      <Eye className="h-3 w-3 mr-1" />
                      View
                    </Button>
                    <Button variant="outline" size="sm">
                      <Share className="h-3 w-3 mr-1" />
                      Share
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
} 