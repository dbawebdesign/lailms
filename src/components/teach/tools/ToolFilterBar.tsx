'use client';

import React from 'react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { ToolCategory } from '@/types/teachingTools';
import { Search, Filter, X } from 'lucide-react';

interface ToolFilterBarProps {
  searchQuery: string;
  onSearchChange: (query: string) => void;
  selectedCategory: ToolCategory | 'all';
  onCategoryChange: (category: ToolCategory | 'all') => void;
}

const categories: Array<{ value: ToolCategory | 'all'; label: string; color: string }> = [
  { value: 'all', label: 'All Tools', color: 'bg-slate-100 text-slate-800 dark:bg-slate-800 dark:text-slate-300' },
  { value: 'assessment', label: 'Assessment', color: 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-300' },
  { value: 'planning', label: 'Planning', color: 'bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-300' },
  { value: 'content-creation', label: 'Content Creation', color: 'bg-emerald-100 text-emerald-800 dark:bg-emerald-900 dark:text-emerald-300' },
  { value: 'communication', label: 'Communication', color: 'bg-orange-100 text-orange-800 dark:bg-orange-900 dark:text-orange-300' },
  { value: 'differentiation', label: 'Differentiation', color: 'bg-pink-100 text-pink-800 dark:bg-pink-900 dark:text-pink-300' },
  { value: 'visual-aids', label: 'Visual Aids', color: 'bg-indigo-100 text-indigo-800 dark:bg-indigo-900 dark:text-indigo-300' },
];

export function ToolFilterBar({
  searchQuery,
  onSearchChange,
  selectedCategory,
  onCategoryChange,
}: ToolFilterBarProps) {
  const handleClearSearch = () => {
    onSearchChange('');
  };

  const handleClearFilters = () => {
    onSearchChange('');
    onCategoryChange('all');
  };

  const hasActiveFilters = searchQuery || selectedCategory !== 'all';

  return (
    <div className="space-y-4">
      {/* Search Bar */}
      <div className="relative">
        <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-slate-400 w-4 h-4" />
        <Input
          type="text"
          placeholder="Search tools by name, description, or keywords..."
          value={searchQuery}
          onChange={(e) => onSearchChange(e.target.value)}
          className="pl-10 pr-10 h-11 text-base"
        />
        {searchQuery && (
          <Button
            variant="ghost"
            size="sm"
            onClick={handleClearSearch}
            className="absolute right-2 top-1/2 transform -translate-y-1/2 h-7 w-7 p-0 hover:bg-slate-100 dark:hover:bg-slate-800"
          >
            <X className="w-4 h-4" />
          </Button>
        )}
      </div>

      {/* Category Filters */}
      <div className="flex flex-col sm:flex-row gap-4 items-start sm:items-center justify-between">
        <div className="flex items-center gap-2 flex-wrap">
          <Filter className="w-4 h-4 text-slate-500 flex-shrink-0" />
          <span className="text-sm font-medium text-slate-600 dark:text-slate-400 whitespace-nowrap">
            Filter by category:
          </span>
          <div className="flex flex-wrap gap-2">
            {categories.map((category) => (
              <Badge
                key={category.value}
                variant={selectedCategory === category.value ? "default" : "secondary"}
                className={`cursor-pointer hover:opacity-80 transition-opacity ${
                  selectedCategory === category.value 
                    ? 'bg-primary text-primary-foreground' 
                    : category.color
                }`}
                onClick={() => onCategoryChange(category.value)}
              >
                {category.label}
              </Badge>
            ))}
          </div>
        </div>

        {/* Clear Filters */}
        {hasActiveFilters && (
          <Button
            variant="outline"
            size="sm"
            onClick={handleClearFilters}
            className="flex-shrink-0"
          >
            <X className="w-4 h-4 mr-1" />
            Clear Filters
          </Button>
        )}
      </div>

      {/* Active Filters Summary */}
      {hasActiveFilters && (
        <div className="flex items-center gap-2 text-sm text-slate-600 dark:text-slate-400">
          <span>Active filters:</span>
          {searchQuery && (
            <Badge variant="outline" className="text-xs">
              Search: &quot;{searchQuery}&quot;
            </Badge>
          )}
          {selectedCategory !== 'all' && (
            <Badge variant="outline" className="text-xs">
              Category: {categories.find(c => c.value === selectedCategory)?.label}
            </Badge>
          )}
        </div>
      )}
    </div>
  );
} 