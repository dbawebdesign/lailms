'use client';

import React, { useState, useMemo } from 'react';
import { ToolCard } from './ToolCard';
import { ToolFilterBar } from './ToolFilterBar';
import { teachingTools } from '@/config/teachingTools';
import { TeachingTool, ToolCategory } from '@/types/teachingTools';

export function ToolLibrary() {
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<ToolCategory | 'all'>('all');
  const [selectedTool, setSelectedTool] = useState<TeachingTool | null>(null);

  // Filter tools based on search query and category
  const filteredTools = useMemo(() => {
    let filtered = teachingTools;

    // Filter by search query
    if (searchQuery) {
      filtered = filtered.filter((tool: TeachingTool) =>
        tool.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        tool.description.toLowerCase().includes(searchQuery.toLowerCase()) ||
        tool.keywords?.some((keyword: string) => 
          keyword.toLowerCase().includes(searchQuery.toLowerCase())
        )
      );
    }

    // Filter by category
    if (selectedCategory !== 'all') {
      filtered = filtered.filter((tool: TeachingTool) => tool.category === selectedCategory);
    }

    return filtered;
  }, [searchQuery, selectedCategory]);

  const handleToolSelect = (tool: TeachingTool) => {
    setSelectedTool(tool);
    // In a full implementation, this would open the tool's workflow sidebar
    console.log('Selected tool:', tool);
  };

  return (
    <div className="space-y-6 md:space-y-8">
      {/* Filter and Search Bar */}
      <ToolFilterBar
        searchQuery={searchQuery}
        onSearchChange={setSearchQuery}
        selectedCategory={selectedCategory}
        onCategoryChange={setSelectedCategory}
      />

      {/* Tools Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6 md:gap-8">
        {filteredTools.map((tool: TeachingTool) => (
          <ToolCard
            key={tool.id}
            tool={tool}
            onSelect={handleToolSelect}
          />
        ))}
      </div>

      {/* No Results Message */}
      {filteredTools.length === 0 && (
        <div className="text-center py-12 md:py-16">
          <div className="mx-auto w-24 h-24 md:w-32 md:h-32 bg-surface rounded-full flex items-center justify-center mb-6 shadow-sm">
            <span className="text-4xl md:text-5xl text-text-secondary opacity-75">📭</span>
          </div>
          <h3 className="text-xl md:text-2xl font-semibold text-text-primary mb-3">
            No Tools Found
          </h3>
          <p className="text-text-secondary max-w-md mx-auto text-base">
            Try adjusting your search or filter criteria, or explore all available tools.
          </p>
        </div>
      )}

      {/* Tool Count */}
      {filteredTools.length > 0 && (
         <div className="text-sm text-text-secondary text-center pt-4">
          Showing {filteredTools.length} of {teachingTools.length} tools
        </div>
      )}
    </div>
  );
} 