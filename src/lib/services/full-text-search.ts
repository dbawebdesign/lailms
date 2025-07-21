import { createClient } from '@supabase/supabase-js';
import { Database } from 'packages/types/db';

export interface SearchResult {
  id: string;
  title: string;
  description: string | null;
  content_type: string;
  source_table: string;
  source_id: string;
  path_id: string | null;
  lesson_id: string | null;
  search_rank: number;
  headline: string;
  created_at: string;
}

export interface SearchSuggestion {
  suggestion: string;
  content_count: number;
}

export interface SearchOptions {
  content_types?: string[];
  limit?: number;
  offset?: number;
  min_rank?: number;
}

export interface SearchFilters {
  content_types?: string[];
  difficulty_levels?: string[];
  tags?: string[];
  learning_objectives?: string[];
  estimated_time_min?: number;
  estimated_time_max?: number;
  date_from?: string;
  date_to?: string;
}

export class FullTextSearchService {
  private supabase: ReturnType<typeof createClient<Database>>;

  constructor(supabase: ReturnType<typeof createClient<Database>>) {
    this.supabase = supabase;
  }

  /**
   * Perform full-text search on study content
   */
  async searchContent(
    baseClassId: string,
    query: string,
    options: SearchOptions = {}
  ): Promise<{ results: SearchResult[]; total: number }> {
    const {
      content_types = null,
      limit = 20,
      offset = 0,
      min_rank = 0.1
    } = options;

    try {
      // Use the database function for full-text search
      const { data, error } = await this.supabase
        .rpc('search_study_content' as any, {
          p_base_class_id: baseClassId,
          p_search_query: query,
          p_content_types: content_types,
          p_limit: limit,
          p_offset: offset
        });

      if (error) {
        console.error('Full-text search error:', error);
        throw new Error(`Search failed: ${error.message}`);
      }

      // Filter by minimum rank if specified
      const filteredResults = ((data as any) || []).filter(
        (result: any) => result.search_rank >= min_rank
      );

      return {
        results: filteredResults.map((row: any) => ({
          id: row.id,
          title: row.title,
          description: row.description,
          content_type: row.content_type,
          source_table: row.source_table,
          source_id: row.source_id,
          path_id: row.path_id,
          lesson_id: row.lesson_id,
          search_rank: row.search_rank,
          headline: row.headline,
          created_at: row.created_at
        })),
        total: filteredResults.length
      };
    } catch (error) {
      console.error('Search content error:', error);
      throw error;
    }
  }

  /**
   * Get search suggestions based on partial query
   */
  async getSearchSuggestions(
    baseClassId: string,
    partialQuery: string,
    limit: number = 10
  ): Promise<SearchSuggestion[]> {
    try {
      const { data, error } = await this.supabase
        .rpc('get_search_suggestions' as any, {
          p_base_class_id: baseClassId,
          p_partial_query: partialQuery.toLowerCase(),
          p_limit: limit
        });

      if (error) {
        console.error('Search suggestions error:', error);
        throw new Error(`Suggestions failed: ${error.message}`);
      }

      return ((data as any) || []).map((row: any) => ({
        suggestion: row.suggestion,
        content_count: row.content_count
      }));
    } catch (error) {
      console.error('Get search suggestions error:', error);
      throw error;
    }
  }

  /**
   * Simple filtered search without complex advanced features
   */
  async filteredSearch(
    baseClassId: string,
    query: string,
    filters: SearchFilters = {},
    options: SearchOptions = {}
  ): Promise<{ results: SearchResult[]; total: number }> {
    const {
      content_types,
      difficulty_levels,
      tags,
      estimated_time_min,
      estimated_time_max,
      date_from,
      date_to
    } = filters;

    const { limit = 20, offset = 0 } = options;

    try {
      let queryBuilder = this.supabase
        .from('study_content_index')
        .select(`
          id,
          title,
          description,
          content_type,
          source_table,
          source_id,
          path_id,
          lesson_id,
          created_at,
          difficulty_level,
          estimated_time,
          tags
        `)
        .eq('base_class_id', baseClassId);

      // Apply filters
      if (content_types?.length) {
        queryBuilder = queryBuilder.in('content_type', content_types);
      }

      if (difficulty_levels?.length) {
        queryBuilder = queryBuilder.in('difficulty_level', difficulty_levels);
      }

      if (estimated_time_min !== undefined) {
        queryBuilder = queryBuilder.gte('estimated_time', estimated_time_min);
      }

      if (estimated_time_max !== undefined) {
        queryBuilder = queryBuilder.lte('estimated_time', estimated_time_max);
      }

      if (date_from) {
        queryBuilder = queryBuilder.gte('created_at', date_from);
      }

      if (date_to) {
        queryBuilder = queryBuilder.lte('created_at', date_to);
      }

      if (tags?.length) {
        queryBuilder = queryBuilder.overlaps('tags', tags);
      }

      const { data, error } = await queryBuilder
        .range(offset, offset + limit - 1)
        .order('created_at', { ascending: false });

      if (error) {
        console.error('Filtered search error:', error);
        throw new Error(`Filtered search failed: ${error.message}`);
      }

      // If query is provided, get search rankings
      let results: SearchResult[] = [];
      if (query.trim()) {
        // Get search results first
        const searchResults = await this.searchContent(baseClassId, query, { limit: 100 });
        const searchIds = new Set(searchResults.results.map(r => r.id));
        
        // Filter data to only include search results
        const filteredData = (data || []).filter((item: any) => searchIds.has(item.id));
        
        // Map with search ranking
        const rankMap = new Map(
          searchResults.results.map(r => [r.id, { rank: r.search_rank, headline: r.headline }])
        );

        results = filteredData.map((item: any) => {
          const rankInfo = rankMap.get(item.id);
          return {
            id: item.id,
            title: item.title,
            description: item.description,
            content_type: item.content_type,
            source_table: item.source_table,
            source_id: item.source_id,
            path_id: item.path_id,
            lesson_id: item.lesson_id,
            search_rank: rankInfo?.rank || 0,
            headline: rankInfo?.headline || item.description || item.title,
            created_at: item.created_at
          };
        }).sort((a, b) => b.search_rank - a.search_rank);
      } else {
        results = (data || []).map((item: any) => ({
          id: item.id,
          title: item.title,
          description: item.description,
          content_type: item.content_type,
          source_table: item.source_table,
          source_id: item.source_id,
          path_id: item.path_id,
          lesson_id: item.lesson_id,
          search_rank: 1.0,
          headline: item.description || item.title,
          created_at: item.created_at
        }));
      }

      return {
        results,
        total: results.length
      };
    } catch (error) {
      console.error('Filtered search error:', error);
      throw error;
    }
  }

  /**
   * Get popular search terms for a base class
   */
  async getPopularSearchTerms(
    baseClassId: string,
    limit: number = 20
  ): Promise<{ term: string; frequency: number }[]> {
    try {
      const { data, error } = await this.supabase
        .from('study_content_index')
        .select('search_keywords')
        .eq('base_class_id', baseClassId);

      if (error) {
        throw new Error(`Failed to get popular terms: ${error.message}`);
      }

      // Count keyword frequency
      const termCounts = new Map<string, number>();
      
      (data || []).forEach((row: any) => {
        const keywords = row.search_keywords || [];
        keywords.forEach((keyword: string) => {
          const current = termCounts.get(keyword) || 0;
          termCounts.set(keyword, current + 1);
        });
      });

      // Sort by frequency and return top terms
      return Array.from(termCounts.entries())
        .sort((a, b) => b[1] - a[1])
        .slice(0, limit)
        .map(([term, frequency]) => ({ term, frequency }));
    } catch (error) {
      console.error('Get popular search terms error:', error);
      throw error;
    }
  }

  /**
   * Get content statistics for a base class
   */
  async getContentStatistics(baseClassId: string): Promise<{
    total_content: number;
    by_type: Record<string, number>;
    by_difficulty: Record<string, number>;
    avg_estimated_time: number;
    total_tags: number;
  }> {
    try {
      const { data, error } = await this.supabase
        .from('study_content_index')
        .select(`
          content_type,
          difficulty_level,
          estimated_time,
          tags
        `)
        .eq('base_class_id', baseClassId);

      if (error) {
        throw new Error(`Failed to get content statistics: ${error.message}`);
      }

      const stats = {
        total_content: data?.length || 0,
        by_type: {} as Record<string, number>,
        by_difficulty: {} as Record<string, number>,
        avg_estimated_time: 0,
        total_tags: 0
      };

      if (data?.length) {
        // Count by content type
        data.forEach((item: any) => {
          const type = item.content_type || 'unknown';
          stats.by_type[type] = (stats.by_type[type] || 0) + 1;
        });

        // Count by difficulty
        data.forEach((item: any) => {
          const difficulty = item.difficulty_level || 'unknown';
          stats.by_difficulty[difficulty] = (stats.by_difficulty[difficulty] || 0) + 1;
        });

        // Calculate average estimated time
        const timesWithValues = data
          .filter((item: any) => item.estimated_time && item.estimated_time > 0)
          .map((item: any) => item.estimated_time);
        
        if (timesWithValues.length > 0) {
          stats.avg_estimated_time = Math.round(
            timesWithValues.reduce((sum, time) => sum + time, 0) / timesWithValues.length
          );
        }

        // Count unique tags
        const allTags = new Set<string>();
        data.forEach((item: any) => {
          (item.tags || []).forEach((tag: string) => allTags.add(tag));
        });
        stats.total_tags = allTags.size;
      }

      return stats;
    } catch (error) {
      console.error('Get content statistics error:', error);
      throw error;
    }
  }
} 