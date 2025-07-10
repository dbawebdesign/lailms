'use client';

import { useState, useEffect } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { 
  Search, 
  Filter, 
  Heart, 
  Download, 
  Trash2, 
  Copy, 
  Edit,
  Eye,
  Grid,
  List,
  SortAsc,
  SortDesc,
  Calendar,
  Tag,
  BookOpen,
  Star
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { 
  TeacherToolCreation, 
  ToolLibraryFilters, 
  ToolLibrarySort, 
  ToolLibraryView 
} from '@/types/teachingTools';
import { teacherToolLibraryService } from '@/lib/services/teacherToolLibrary';
import { teachingTools } from '@/config/teachingTools';

interface TeacherToolLibraryProps {
  initialToolId?: string;
}

export function TeacherToolLibrary({ initialToolId }: TeacherToolLibraryProps) {
  const router = useRouter();
  const searchParams = useSearchParams();
  
  const [library, setLibrary] = useState<ToolLibraryView>({
    creations: [],
    totalCount: 0,
    hasMore: false,
    filters: {},
    sort: { field: 'created_at', direction: 'desc' }
  });
  
  const [loading, setLoading] = useState(true);
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid');
  const [selectedTool, setSelectedTool] = useState<string>(initialToolId || 'all');
  const [searchQuery, setSearchQuery] = useState('');
  const [showFilters, setShowFilters] = useState(false);
  
  const [filters, setFilters] = useState<ToolLibraryFilters>({
    toolId: initialToolId
  });
  
  const [sort, setSort] = useState<ToolLibrarySort>({
    field: 'created_at',
    direction: 'desc'
  });

  // Load library data
  const loadLibrary = async (page: number = 1) => {
    try {
      setLoading(true);
      const data = await teacherToolLibraryService.getLibrary(filters, sort, page, 20);
      setLibrary(data);
    } catch (error) {
      console.error('Failed to load library:', error);
    } finally {
      setLoading(false);
    }
  };

  // Initialize from URL params
  useEffect(() => {
    const urlFilters = teacherToolLibraryService.buildFiltersFromUrl(searchParams);
    setFilters(urlFilters);
    setSelectedTool(urlFilters.toolId || 'all');
    setSearchQuery(urlFilters.search || '');
  }, [searchParams]);

  // Load data when filters change
  useEffect(() => {
    loadLibrary();
  }, [filters, sort]);

  // Update URL when filters change
  const updateUrl = (newFilters: ToolLibraryFilters, newSort: ToolLibrarySort) => {
    const params = teacherToolLibraryService.buildUrlFromFilters(newFilters, newSort);
    router.push(`/teach/tools/library?${params}`);
  };

  // Filter handlers
  const handleToolChange = (toolId: string) => {
    const newFilters = { ...filters, toolId: toolId === 'all' ? undefined : toolId };
    setFilters(newFilters);
    setSelectedTool(toolId);
    updateUrl(newFilters, sort);
  };

  const handleSearchChange = (search: string) => {
    const newFilters = { ...filters, search: search || undefined };
    setFilters(newFilters);
    setSearchQuery(search);
    updateUrl(newFilters, sort);
  };

  const handleSortChange = (field: string, direction: 'asc' | 'desc') => {
    const newSort = { field: field as any, direction };
    setSort(newSort);
    updateUrl(filters, newSort);
  };

  // Action handlers
  const handleToggleFavorite = async (id: string, isFavorite: boolean) => {
    try {
      await teacherToolLibraryService.toggleFavorite(id, !isFavorite);
      loadLibrary();
    } catch (error) {
      console.error('Failed to toggle favorite:', error);
    }
  };

  const handleDuplicate = async (id: string) => {
    try {
      await teacherToolLibraryService.duplicateCreation(id);
      loadLibrary();
    } catch (error) {
      console.error('Failed to duplicate creation:', error);
    }
  };

  const handleDelete = async (id: string) => {
    if (confirm('Are you sure you want to delete this creation?')) {
      try {
        await teacherToolLibraryService.deleteCreation(id);
        loadLibrary();
      } catch (error) {
        console.error('Failed to delete creation:', error);
      }
    }
  };

  const handleView = (creation: TeacherToolCreation) => {
    // Take user to the specialized viewer for this creation
    router.push(`/teach/tools/library/${creation.id}`);
  };

  const getToolIcon = (toolId: string) => {
    const tool = teachingTools.find(t => t.id === toolId);
    return tool?.icon || 'FileText';
  };

  const getToolName = (toolId: string) => {
    const tool = teachingTools.find(t => t.id === toolId);
    return tool?.name || toolId;
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric'
    });
  };

  const renderCreationCard = (creation: TeacherToolCreation) => (
    <Card key={creation.id} className="group hover:shadow-lg transition-shadow">
      <CardHeader className="pb-3">
        <div className="flex items-start justify-between">
          <div className="flex items-center space-x-2">
            <div className="p-2 bg-blue-100 dark:bg-blue-900 rounded-lg">
              <BookOpen className="h-4 w-4 text-blue-600 dark:text-blue-400" />
            </div>
            <div>
              <CardTitle className="text-sm font-medium line-clamp-1">
                {creation.title}
              </CardTitle>
              <p className="text-xs text-muted-foreground">
                {getToolName(creation.tool_id)}
              </p>
            </div>
          </div>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => handleToggleFavorite(creation.id, creation.is_favorite)}
            className="opacity-0 group-hover:opacity-100 transition-opacity"
          >
            <Heart 
              className={`h-4 w-4 ${creation.is_favorite ? 'fill-red-500 text-red-500' : 'text-gray-400'}`} 
            />
          </Button>
        </div>
      </CardHeader>
      
      <CardContent className="pt-0">
        {creation.description && (
          <p className="text-sm text-muted-foreground mb-3 line-clamp-2">
            {creation.description}
          </p>
        )}
        
        <div className="flex flex-wrap gap-1 mb-3">
          {creation.metadata.gradeLevel && (
            <Badge variant="secondary" className="text-xs">
              Grade {creation.metadata.gradeLevel}
            </Badge>
          )}
          {creation.metadata.subject && (
            <Badge variant="outline" className="text-xs">
              {creation.metadata.subject}
            </Badge>
          )}
          {creation.tags.slice(0, 2).map(tag => (
            <Badge key={tag} variant="outline" className="text-xs">
              {tag}
            </Badge>
          ))}
          {creation.tags.length > 2 && (
            <Badge variant="outline" className="text-xs">
              +{creation.tags.length - 2}
            </Badge>
          )}
        </div>
        
        <div className="flex items-center justify-between text-xs text-muted-foreground mb-3">
          <span className="flex items-center space-x-1">
            <Calendar className="h-3 w-3" />
            <span>{formatDate(creation.created_at)}</span>
          </span>
          {creation.is_favorite && (
            <Star className="h-3 w-3 fill-yellow-400 text-yellow-400" />
          )}
        </div>
        
        <div className="flex space-x-1">
          <Button
            variant="outline"
            size="sm"
            onClick={() => handleView(creation)}
            className="flex-1"
          >
            <Eye className="h-3 w-3 mr-1" />
            View
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={() => handleDuplicate(creation.id)}
          >
            <Copy className="h-3 w-3" />
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={() => handleDelete(creation.id)}
            className="text-red-600 hover:text-red-700"
          >
            <Trash2 className="h-3 w-3" />
          </Button>
        </div>
      </CardContent>
    </Card>
  );

  const renderCreationList = (creation: TeacherToolCreation) => (
    <Card key={creation.id} className="mb-3">
      <CardContent className="p-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-4 flex-1">
            <div className="p-2 bg-blue-100 dark:bg-blue-900 rounded-lg">
              <BookOpen className="h-4 w-4 text-blue-600 dark:text-blue-400" />
            </div>
            
            <div className="flex-1 min-w-0">
              <div className="flex items-center space-x-2">
                <h3 className="font-medium truncate">{creation.title}</h3>
                {creation.is_favorite && (
                  <Heart className="h-4 w-4 fill-red-500 text-red-500" />
                )}
              </div>
              <p className="text-sm text-muted-foreground">
                {getToolName(creation.tool_id)} • {formatDate(creation.created_at)}
              </p>
              {creation.description && (
                <p className="text-sm text-muted-foreground mt-1 line-clamp-1">
                  {creation.description}
                </p>
              )}
            </div>
            
            <div className="flex flex-wrap gap-1">
              {creation.metadata.gradeLevel && (
                <Badge variant="secondary" className="text-xs">
                  Grade {creation.metadata.gradeLevel}
                </Badge>
              )}
              {creation.metadata.subject && (
                <Badge variant="outline" className="text-xs">
                  {creation.metadata.subject}
                </Badge>
              )}
            </div>
          </div>
          
          <div className="flex space-x-1 ml-4">
            <Button variant="outline" size="sm" onClick={() => handleView(creation)}>
              <Eye className="h-3 w-3" />
            </Button>
            <Button variant="outline" size="sm" onClick={() => handleDuplicate(creation.id)}>
              <Copy className="h-3 w-3" />
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => handleDelete(creation.id)}
              className="text-red-600 hover:text-red-700"
            >
              <Trash2 className="h-3 w-3" />
            </Button>
          </div>
        </div>
      </CardContent>
    </Card>
  );

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">My Teaching Library</h1>
          <p className="text-muted-foreground">
            Manage and organize your created teaching materials
          </p>
        </div>
        
        <div className="flex items-center space-x-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => setViewMode(viewMode === 'grid' ? 'list' : 'grid')}
          >
            {viewMode === 'grid' ? <List className="h-4 w-4" /> : <Grid className="h-4 w-4" />}
          </Button>
          
          <Button
            variant="outline"
            size="sm"
            onClick={() => setShowFilters(!showFilters)}
          >
            <Filter className="h-4 w-4 mr-1" />
            Filters
          </Button>
        </div>
      </div>

      {/* Filters */}
      <div className="flex flex-col sm:flex-row gap-4">
        <div className="flex-1">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search your creations..."
              value={searchQuery}
              onChange={(e) => handleSearchChange(e.target.value)}
              className="pl-10"
            />
          </div>
        </div>
        
        <Select value={selectedTool} onValueChange={handleToolChange}>
          <SelectTrigger className="w-full sm:w-48">
            <SelectValue placeholder="All Tools" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Tools</SelectItem>
            {teachingTools.map(tool => (
              <SelectItem key={tool.id} value={tool.id}>
                {tool.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        
        <Select 
          value={`${sort.field}-${sort.direction}`} 
          onValueChange={(value) => {
            const [field, direction] = value.split('-');
            handleSortChange(field, direction as 'asc' | 'desc');
          }}
        >
          <SelectTrigger className="w-full sm:w-48">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="created_at-desc">Newest First</SelectItem>
            <SelectItem value="created_at-asc">Oldest First</SelectItem>
            <SelectItem value="title-asc">Title A-Z</SelectItem>
            <SelectItem value="title-desc">Title Z-A</SelectItem>
            <SelectItem value="updated_at-desc">Recently Updated</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center space-x-2">
              <BookOpen className="h-4 w-4 text-blue-600" />
              <div>
                <p className="text-sm font-medium">Total Creations</p>
                <p className="text-2xl font-bold">{library.totalCount}</p>
              </div>
            </div>
          </CardContent>
        </Card>
        
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center space-x-2">
              <Heart className="h-4 w-4 text-red-600" />
              <div>
                <p className="text-sm font-medium">Favorites</p>
                <p className="text-2xl font-bold">
                  {library.creations.filter(c => c.is_favorite).length}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
        
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center space-x-2">
              <Calendar className="h-4 w-4 text-green-600" />
              <div>
                <p className="text-sm font-medium">This Month</p>
                <p className="text-2xl font-bold">
                  {library.creations.filter(c => {
                    const created = new Date(c.created_at);
                    const now = new Date();
                    return created.getMonth() === now.getMonth() && 
                           created.getFullYear() === now.getFullYear();
                  }).length}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
        
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center space-x-2">
              <Tag className="h-4 w-4 text-purple-600" />
              <div>
                <p className="text-sm font-medium">Tools Used</p>
                <p className="text-2xl font-bold">
                  {new Set(library.creations.map(c => c.tool_id)).size}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Content */}
      {loading ? (
        <div className="flex items-center justify-center py-12">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
        </div>
      ) : library.creations.length === 0 ? (
        <Card>
          <CardContent className="p-12 text-center">
            <BookOpen className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
            <h3 className="text-lg font-medium mb-2">No creations found</h3>
            <p className="text-muted-foreground mb-4">
              {filters.search || filters.toolId ? 
                'Try adjusting your search or filters.' : 
                'Start creating teaching materials to build your library.'}
            </p>
            <Button onClick={() => router.push('/teach/tools')}>
              Explore Teaching Tools
            </Button>
          </CardContent>
        </Card>
      ) : (
        <div className={
          viewMode === 'grid' 
            ? 'grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4'
            : 'space-y-3'
        }>
          {library.creations.map(creation => 
            viewMode === 'grid' ? renderCreationCard(creation) : renderCreationList(creation)
          )}
        </div>
      )}
      
      {/* Load More */}
      {library.hasMore && (
        <div className="text-center">
          <Button 
            variant="outline" 
            onClick={() => loadLibrary(Math.floor(library.creations.length / 20) + 1)}
            disabled={loading}
          >
            Load More
          </Button>
        </div>
      )}
    </div>
  );
} 