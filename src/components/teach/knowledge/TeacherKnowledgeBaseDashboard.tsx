'use client';

import React, { useState, useEffect } from 'react';
import { Search, Plus, BookOpen, FileText, Sparkles, Upload, Building2 } from 'lucide-react';
import { useCourseCreationModal } from '@/hooks/useCourseCreationModal';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { 
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { FileListTable } from '@/components/knowledge-base/FileListTable';
import Link from 'next/link';
import LunaContextElement from '@/components/luna/LunaContextElement';

interface BaseClass {
  id: string;
  name: string;
  description: string | null;
  created_at: string;
}

interface TeacherKnowledgeBaseDashboardProps {
  userId: string;
  organisationId: string;
  baseClasses: BaseClass[];
}

interface KnowledgeStats {
  totalDocuments: number;
  pendingProcessing: number;
  recentUploads: number;
  activeClassesWithKB: number;
}

export default function TeacherKnowledgeBaseDashboard({ 
  userId, 
  organisationId, 
  baseClasses 
}: TeacherKnowledgeBaseDashboardProps) {
  const [selectedClass, setSelectedClass] = useState<string>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [stats, setStats] = useState<KnowledgeStats>({
    totalDocuments: 0,
    pendingProcessing: 0,
    recentUploads: 0,
    activeClassesWithKB: 0
  });

  const { openModal, CourseCreationModal } = useCourseCreationModal({ 
    organisationId 
  });

  // Load knowledge base statistics
  useEffect(() => {
    async function loadStats() {
      try {
        const response = await fetch(`/api/knowledge-base/stats`);
        if (response.ok) {
          const data = await response.json();
          setStats(prev => ({
            ...prev,
            ...data
          }));
        }
      } catch (error) {
        console.error('Failed to load knowledge base stats:', error);
      }
    }

    loadStats();
  }, []);

  const StatCard = ({ title, value, description, icon: Icon, trend }: {
    title: string;
    value: number | string;
    description: string;
    icon: React.ComponentType<{ className?: string }>;
    trend?: string;
  }) => (
    <Card className="hover:shadow-md transition-shadow duration-200">
      <CardContent className="p-6">
        <div className="flex items-center justify-between">
          <div className="space-y-2">
            <p className="text-sm font-medium text-muted-foreground">{title}</p>
            <div className="flex items-baseline space-x-2">
              <p className="text-3xl font-semibold tracking-tight text-foreground">{value}</p>
              {trend && (
                <Badge variant="secondary" className="text-xs">
                  {trend}
                </Badge>
              )}
            </div>
            <p className="text-xs text-muted-foreground">{description}</p>
          </div>
          <div className="h-12 w-12 rounded-full bg-primary/10 flex items-center justify-center">
            <Icon className="h-6 w-6 text-primary" />
          </div>
        </div>
      </CardContent>
    </Card>
  );

  return (
    <LunaContextElement
      type="teacher-knowledge-dashboard"
      role="display"
      content={{
        totalDocuments: stats.totalDocuments,
        totalClasses: baseClasses.length,
        selectedFilter: selectedClass,
        searchQuery: searchQuery
      }}
      metadata={{
        userId,
        organisationId,
        baseClassIds: baseClasses.map(c => c.id)
      }}
    >
      <div className="min-h-screen bg-background">
        {/* Header */}
        <div className="bg-card border-b border-border">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="py-8">
              <div className="flex items-center justify-between">
                <div className="space-y-1">
                  <h1 className="text-2xl font-semibold tracking-tight text-foreground">
                    Knowledge Base
                  </h1>
                  <p className="text-sm text-muted-foreground">
                    Manage and organize your teaching resources across all courses
                  </p>
                </div>
                <div className="flex items-center space-x-3">
                  <Button variant="outline" onClick={openModal}>
                    <Sparkles className="h-4 w-4 mr-2" />
                    Create Course
                  </Button>
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button>
                        <Plus className="h-4 w-4 mr-2" />
                        Add Content
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end" className="w-56">
                      <DropdownMenuItem asChild>
                        <Link href="/knowledge-base">
                          <Upload className="h-4 w-4 mr-2" />
                          Upload Documents
                        </Link>
                      </DropdownMenuItem>
                      <DropdownMenuSeparator />
                      <DropdownMenuItem asChild>
                        <Link href="/teach/base-classes">
                          <BookOpen className="h-4 w-4 mr-2" />
                          Create New Course
                        </Link>
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                </div>
              </div>
            </div>
          </div>
        </div>

        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
          {/* Stats Grid */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
            <StatCard
              title="Total Documents"
              value={stats.totalDocuments}
              description="Across all your courses"
              icon={FileText}
              trend={stats.recentUploads > 0 ? `+${stats.recentUploads} recent` : undefined}
            />
            <StatCard
              title="Active Courses"
              value={baseClasses.length}
              description="With knowledge bases"
              icon={BookOpen}
            />
            <StatCard
              title="Processing"
              value={stats.pendingProcessing}
              description="Documents being processed"
              icon={Upload}
            />
            <StatCard
              title="KB Courses"
              value={stats.activeClassesWithKB}
              description="Courses with documents"
              icon={Building2}
            />
          </div>

          {/* Documents Section */}
          <div className="space-y-6">
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-medium text-foreground">All Documents</h2>
              <div className="flex items-center space-x-3">
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input
                    placeholder="Search documents..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="pl-9 w-64"
                  />
                </div>
                <Select value={selectedClass} onValueChange={setSelectedClass}>
                  <SelectTrigger className="w-64">
                    <SelectValue placeholder="Filter by course" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Courses</SelectItem>
                    {baseClasses.map((cls) => (
                      <SelectItem key={cls.id} value={cls.id}>
                        {cls.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            <Card>
              <CardContent className="p-0">
                <FileListTable 
                  organisationId={organisationId}
                  baseClassId={selectedClass === 'all' ? undefined : selectedClass}
                  userOnly={true}
                />
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
      
      <CourseCreationModal />
    </LunaContextElement>
  );
} 