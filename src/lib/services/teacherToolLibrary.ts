import { 
  TeacherToolCreation, 
  TeacherToolCreationInput, 
  ToolLibraryFilters, 
  ToolLibrarySort, 
  ToolLibraryView 
} from '@/types/teachingTools';

export class TeacherToolLibraryService {
  private baseUrl = '/api/teacher-tools/library';

  async getLibrary(
    filters: ToolLibraryFilters = {},
    sort: ToolLibrarySort = { field: 'created_at', direction: 'desc' },
    page: number = 1,
    limit: number = 20
  ): Promise<ToolLibraryView> {
    const params = new URLSearchParams();
    
    if (filters.toolId) params.append('toolId', filters.toolId);
    if (filters.search) params.append('search', filters.search);
    if (filters.tags?.length) params.append('tags', filters.tags.join(','));
    if (filters.gradeLevel) params.append('gradeLevel', filters.gradeLevel);
    if (filters.subject) params.append('subject', filters.subject);
    if (filters.favorites) params.append('favorites', 'true');
    if (filters.dateRange?.start) params.append('dateStart', filters.dateRange.start);
    if (filters.dateRange?.end) params.append('dateEnd', filters.dateRange.end);
    
    params.append('sortField', sort.field);
    params.append('sortDirection', sort.direction);
    params.append('page', page.toString());
    params.append('limit', limit.toString());

    const response = await fetch(`${this.baseUrl}?${params.toString()}`);
    
    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error || 'Failed to fetch library');
    }

    return response.json();
  }

  async getCreation(id: string): Promise<TeacherToolCreation> {
    const response = await fetch(`${this.baseUrl}/${id}`);
    
    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error || 'Failed to fetch creation');
    }

    const data = await response.json();
    return data.creation;
  }

  async saveCreation(creation: TeacherToolCreationInput): Promise<TeacherToolCreation> {
    const response = await fetch(this.baseUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(creation),
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error || 'Failed to save creation');
    }

    const data = await response.json();
    return data.creation;
  }

  async updateCreation(id: string, updates: Partial<TeacherToolCreationInput>): Promise<TeacherToolCreation> {
    const response = await fetch(`${this.baseUrl}/${id}`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(updates),
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error || 'Failed to update creation');
    }

    const data = await response.json();
    return data.creation;
  }

  async deleteCreation(id: string): Promise<void> {
    const response = await fetch(`${this.baseUrl}/${id}`, {
      method: 'DELETE',
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error || 'Failed to delete creation');
    }
  }

  async toggleFavorite(id: string, isFavorite: boolean): Promise<TeacherToolCreation> {
    const response = await fetch(`${this.baseUrl}/${id}`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ is_favorite: isFavorite }),
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error || 'Failed to update favorite status');
    }

    const data = await response.json();
    return data.creation;
  }

  async duplicateCreation(id: string, newTitle?: string): Promise<TeacherToolCreation> {
    const original = await this.getCreation(id);
    
    const duplicate: TeacherToolCreationInput = {
      tool_id: original.tool_id,
      tool_name: original.tool_name,
      title: newTitle || `${original.title} (Copy)`,
      description: original.description,
      content: original.content,
      metadata: original.metadata,
      tags: original.tags
    };

    return this.saveCreation(duplicate);
  }

  // Utility methods for filtering and searching
  async getToolStats(toolId?: string): Promise<{
    totalCreations: number;
    recentCreations: number;
    favoriteCreations: number;
    mostUsedGrades: string[];
    mostUsedSubjects: string[];
  }> {
    const filters: ToolLibraryFilters = toolId ? { toolId } : {};
    
    // Get all creations for stats
    const allCreations = await this.getLibrary(filters, { field: 'created_at', direction: 'desc' }, 1, 1000);
    
    const now = new Date();
    const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
    
    const recentCreations = allCreations.creations.filter(
      creation => new Date(creation.created_at) > thirtyDaysAgo
    ).length;
    
    const favoriteCreations = allCreations.creations.filter(
      creation => creation.is_favorite
    ).length;

    // Count grade levels and subjects
    const gradeCounts: Record<string, number> = {};
    const subjectCounts: Record<string, number> = {};

    allCreations.creations.forEach(creation => {
      const grade = creation.metadata.gradeLevel;
      const subject = creation.metadata.subject;
      
      if (grade) {
        gradeCounts[grade] = (gradeCounts[grade] || 0) + 1;
      }
      if (subject) {
        subjectCounts[subject] = (subjectCounts[subject] || 0) + 1;
      }
    });

    const mostUsedGrades = Object.entries(gradeCounts)
      .sort(([,a], [,b]) => b - a)
      .slice(0, 5)
      .map(([grade]) => grade);

    const mostUsedSubjects = Object.entries(subjectCounts)
      .sort(([,a], [,b]) => b - a)
      .slice(0, 5)
      .map(([subject]) => subject);

    return {
      totalCreations: allCreations.totalCount,
      recentCreations,
      favoriteCreations,
      mostUsedGrades,
      mostUsedSubjects
    };
  }

  async exportCreation(id: string, format: 'json' | 'pdf' | 'docx' = 'json'): Promise<Blob> {
    const creation = await this.getCreation(id);
    
    if (format === 'json') {
      const jsonData = JSON.stringify(creation, null, 2);
      return new Blob([jsonData], { type: 'application/json' });
    }
    
    // For PDF/DOCX export, you would integrate with a document generation service
    // This is a placeholder implementation
    throw new Error(`Export format ${format} not yet implemented`);
  }

  // Search and filter helpers
  buildFiltersFromUrl(searchParams: URLSearchParams): ToolLibraryFilters {
    return {
      toolId: searchParams.get('toolId') || undefined,
      search: searchParams.get('search') || undefined,
      tags: searchParams.get('tags')?.split(',').filter(Boolean) || undefined,
      gradeLevel: searchParams.get('gradeLevel') || undefined,
      subject: searchParams.get('subject') || undefined,
      favorites: searchParams.get('favorites') === 'true' || undefined,
      dateRange: searchParams.get('dateStart') && searchParams.get('dateEnd') ? {
        start: searchParams.get('dateStart')!,
        end: searchParams.get('dateEnd')!
      } : undefined
    };
  }

  buildUrlFromFilters(filters: ToolLibraryFilters, sort: ToolLibrarySort): string {
    const params = new URLSearchParams();
    
    if (filters.toolId) params.append('toolId', filters.toolId);
    if (filters.search) params.append('search', filters.search);
    if (filters.tags?.length) params.append('tags', filters.tags.join(','));
    if (filters.gradeLevel) params.append('gradeLevel', filters.gradeLevel);
    if (filters.subject) params.append('subject', filters.subject);
    if (filters.favorites) params.append('favorites', 'true');
    if (filters.dateRange?.start) params.append('dateStart', filters.dateRange.start);
    if (filters.dateRange?.end) params.append('dateEnd', filters.dateRange.end);
    
    params.append('sortField', sort.field);
    params.append('sortDirection', sort.direction);

    return params.toString();
  }
}

// Export singleton instance
export const teacherToolLibraryService = new TeacherToolLibraryService(); 