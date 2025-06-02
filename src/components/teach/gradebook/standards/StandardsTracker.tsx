'use client';

import React, { useState } from 'react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Progress } from '@/components/ui/progress';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { 
  Target, 
  TrendingUp, 
  Users, 
  BookOpen, 
  CheckCircle, 
  AlertCircle,
  Search,
  Filter,
  BarChart3,
  Calendar,
  Eye,
  Star
} from 'lucide-react';
import { cn } from '@/lib/utils';

interface Standard {
  id: string;
  code: string;
  title: string;
  description: string;
  category: string;
  grade_level: string;
  mastery_levels: {
    below: number;
    approaching: number;
    proficient: number;
    advanced: number;
  };
  total_students: number;
  assignments_count: number;
  last_assessed: string;
}

interface StandardsTrackerProps {
  classInstance: {
    id: string;
    name: string;
    base_class_id: string;
    enrollment_code: string;
    settings?: any;
  };
  data: {
    students: any[];
    assignments: any[];
    grades: Record<string, any>;
    standards: any[];
    settings: any;
  };
  isLoading: boolean;
}

export function StandardsTracker({
  classInstance,
  data,
  isLoading
}: StandardsTrackerProps) {
  const [activeTab, setActiveTab] = useState('overview');
  const [searchTerm, setSearchTerm] = useState('');
  const [filterCategory, setFilterCategory] = useState('all');

  // Mock standards data
  const mockStandards: Standard[] = [
    {
      id: '1',
      code: 'MATH.8.A.1',
      title: 'Linear Equations',
      description: 'Understand and solve linear equations with one variable',
      category: 'Algebra',
      grade_level: '8',
      mastery_levels: {
        below: 2,
        approaching: 8,
        proficient: 15,
        advanced: 5
      },
      total_students: 30,
      assignments_count: 4,
      last_assessed: '2024-02-10T14:30:00Z'
    },
    {
      id: '2',
      code: 'MATH.8.G.2',
      title: 'Congruent Triangles',
      description: 'Understand congruence and similarity using physical models, transparencies, or geometry software',
      category: 'Geometry',
      grade_level: '8',
      mastery_levels: {
        below: 5,
        approaching: 10,
        proficient: 12,
        advanced: 3
      },
      total_students: 30,
      assignments_count: 2,
      last_assessed: '2024-02-08T11:15:00Z'
    },
    {
      id: '3',
      code: 'MATH.8.SP.1',
      title: 'Data Analysis',
      description: 'Construct and interpret scatter plots for bivariate measurement data',
      category: 'Statistics',
      grade_level: '8',
      mastery_levels: {
        below: 1,
        approaching: 4,
        proficient: 18,
        advanced: 7
      },
      total_students: 30,
      assignments_count: 3,
      last_assessed: '2024-02-12T09:45:00Z'
    }
  ];

  const categories = ['all', ...Array.from(new Set(mockStandards.map(s => s.category)))];

  const filteredStandards = mockStandards.filter(standard => {
    if (searchTerm && !standard.code.toLowerCase().includes(searchTerm.toLowerCase()) && 
        !standard.title.toLowerCase().includes(searchTerm.toLowerCase())) {
      return false;
    }
    if (filterCategory !== 'all' && standard.category !== filterCategory) {
      return false;
    }
    return true;
  });

  const getMasteryColor = (level: string) => {
    switch (level) {
      case 'advanced': return 'bg-success';
      case 'proficient': return 'bg-info';
      case 'approaching': return 'bg-warning';
      case 'below': return 'bg-destructive';
      default: return 'bg-muted';
    }
  };

  const getMasteryBadge = (level: string, count: number) => {
    const variants = {
      advanced: 'bg-success/10 text-success border-success/20',
      proficient: 'bg-info/10 text-info border-info/20',
      approaching: 'bg-warning/10 text-warning border-warning/20',
      below: 'bg-destructive/10 text-destructive border-destructive/20'
    };

    return (
      <Badge variant="outline" className={cn('text-xs font-medium', variants[level as keyof typeof variants])}>
        {count} {level.charAt(0).toUpperCase() + level.slice(1)}
      </Badge>
    );
  };

  const calculateProficiencyRate = (standard: Standard) => {
    const proficientAndAdvanced = standard.mastery_levels.proficient + standard.mastery_levels.advanced;
    return Math.round((proficientAndAdvanced / standard.total_students) * 100);
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric'
    });
  };

  const StatCard = ({ icon: Icon, title, value, subtitle, color = 'primary' }: any) => (
    <Card className="p-6 bg-surface/50 border-divider hover:shadow-lg transition-airy">
      <div className="flex items-center justify-between">
        <div>
          <p className="text-caption text-muted-foreground font-medium">{title}</p>
          <p className="text-h2 font-bold text-foreground mt-1">{value}</p>
          {subtitle && <p className="text-xs text-muted-foreground mt-1">{subtitle}</p>}
        </div>
        <div className={cn(
          "p-3 rounded-xl transition-airy",
          color === 'primary' && "bg-primary/10",
          color === 'success' && "bg-success/10",
          color === 'info' && "bg-info/10",
          color === 'warning' && "bg-warning/10"
        )}>
          <Icon className={cn(
            "w-6 h-6",
            color === 'primary' && "text-primary",
            color === 'success' && "text-success",
            color === 'info' && "text-info",
            color === 'warning' && "text-warning"
          )} />
        </div>
      </div>
    </Card>
  );

  const renderOverview = () => (
    <div className="space-y-8">
      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
        <StatCard
          icon={Target}
          title="Total Standards"
          value={mockStandards.length}
          color="primary"
        />
        <StatCard
          icon={TrendingUp}
          title="Avg Proficiency"
          value="72%"
          subtitle="Proficient + Advanced"
          color="success"
        />
        <StatCard
          icon={Users}
          title="Students Tracked"
          value={30}
          color="info"
        />
        <StatCard
          icon={BookOpen}
          title="Assessments"
          value={9}
          color="warning"
        />
      </div>

      {/* Filters */}
      <Card className="p-6 bg-surface/50 border-divider">
        <div className="flex flex-col sm:flex-row gap-4 justify-between items-start sm:items-center">
          <div className="flex gap-4 flex-1">
            <div className="relative flex-1 max-w-sm">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground w-4 h-4" />
              <Input
                placeholder="Search standards..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-10 border-divider focus:border-primary/50"
              />
            </div>
            <Select value={filterCategory} onValueChange={setFilterCategory}>
              <SelectTrigger className="w-48 border-divider">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {categories.map(category => (
                  <SelectItem key={category} value={category}>
                    {category === 'all' ? 'All Categories' : category}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>
      </Card>

      {/* Standards List */}
      <div className="space-y-6">
        {filteredStandards.map((standard) => (
          <Card key={standard.id} className="p-8 bg-surface/50 border-divider hover:shadow-lg transition-airy">
            <div className="flex items-start justify-between mb-6">
              <div className="flex-1">
                <div className="flex items-center gap-3 mb-3">
                  <h3 className="text-body font-bold text-foreground">{standard.code}</h3>
                  <Badge variant="outline" className="border-primary/20 text-primary bg-primary/10">
                    {standard.category}
                  </Badge>
                  <Badge variant="outline" className="border-info/20 text-info bg-info/10">
                    Grade {standard.grade_level}
                  </Badge>
                </div>
                <h4 className="text-h3 font-semibold text-foreground mb-2">{standard.title}</h4>
                <p className="text-caption text-muted-foreground mb-4 max-w-2xl">{standard.description}</p>
              </div>
              <div className="text-right">
                <div className="text-h1 font-bold text-primary">
                  {calculateProficiencyRate(standard)}%
                </div>
                <div className="text-caption text-muted-foreground font-medium">Proficient+</div>
              </div>
            </div>

            <div className="space-y-6">
              {/* Mastery Distribution */}
              <div>
                <div className="flex justify-between items-center mb-4">
                  <span className="text-body font-semibold text-foreground">Mastery Distribution</span>
                  <span className="text-caption text-muted-foreground">{standard.total_students} students</span>
                </div>
                <div className="flex h-4 rounded-full overflow-hidden bg-muted/30">
                  <div 
                    className="bg-destructive transition-all duration-300"
                    style={{ width: `${(standard.mastery_levels.below / standard.total_students) * 100}%` }}
                  />
                  <div 
                    className="bg-warning transition-all duration-300"
                    style={{ width: `${(standard.mastery_levels.approaching / standard.total_students) * 100}%` }}
                  />
                  <div 
                    className="bg-info transition-all duration-300"
                    style={{ width: `${(standard.mastery_levels.proficient / standard.total_students) * 100}%` }}
                  />
                  <div 
                    className="bg-success transition-all duration-300"
                    style={{ width: `${(standard.mastery_levels.advanced / standard.total_students) * 100}%` }}
                  />
                </div>
              </div>

              {/* Mastery Badges */}
              <div className="flex flex-wrap gap-3">
                {getMasteryBadge('below', standard.mastery_levels.below)}
                {getMasteryBadge('approaching', standard.mastery_levels.approaching)}
                {getMasteryBadge('proficient', standard.mastery_levels.proficient)}
                {getMasteryBadge('advanced', standard.mastery_levels.advanced)}
              </div>

              {/* Footer Info */}
              <div className="flex justify-between items-center pt-4 border-t border-divider">
                <div className="flex items-center gap-6">
                  <div className="flex items-center gap-2">
                    <BookOpen className="w-4 h-4 text-muted-foreground" />
                    <span className="text-caption text-muted-foreground">{standard.assignments_count} assignments</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <Calendar className="w-4 h-4 text-muted-foreground" />
                    <span className="text-caption text-muted-foreground">Last assessed {formatDate(standard.last_assessed)}</span>
                  </div>
                </div>
                <Button 
                  variant="outline" 
                  size="sm"
                  className="hover:bg-surface/80 border-divider transition-airy"
                >
                  <Eye className="w-4 h-4 mr-2" />
                  View Details
                </Button>
              </div>
            </div>
          </Card>
        ))}
      </div>
    </div>
  );

  const renderAlignment = () => (
    <div className="space-y-8">
      <Card className="p-12 bg-surface/50 border-divider text-center">
        <div className="max-w-md mx-auto space-y-6">
          <div className="p-4 bg-primary/10 rounded-full w-fit mx-auto">
            <BarChart3 className="w-12 h-12 text-primary" />
          </div>
          <div>
            <h3 className="text-h2 font-semibold text-foreground mb-3">Standards Alignment</h3>
            <p className="text-body text-muted-foreground mb-6">
              View how assignments and lessons align with learning standards
            </p>
          </div>
          <Badge variant="outline" className="bg-accent/10 text-accent border-accent/20">
            Coming Soon
          </Badge>
        </div>
      </Card>
    </div>
  );

  const renderReports = () => (
    <div className="space-y-8">
      <Card className="p-12 bg-surface/50 border-divider text-center">
        <div className="max-w-md mx-auto space-y-6">
          <div className="p-4 bg-success/10 rounded-full w-fit mx-auto">
            <Target className="w-12 h-12 text-success" />
          </div>
          <div>
            <h3 className="text-h2 font-semibold text-foreground mb-3">Standards Reports</h3>
            <p className="text-body text-muted-foreground mb-6">
              Generate comprehensive reports on standards mastery and progress
            </p>
          </div>
          <Badge variant="outline" className="bg-accent/10 text-accent border-accent/20">
            Coming Soon
          </Badge>
        </div>
      </Card>
    </div>
  );

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-full min-h-[400px]">
        <div className="text-center space-y-4">
          <Target className="w-16 h-16 text-muted-foreground mx-auto animate-pulse" />
          <div>
            <h3 className="text-h3 font-medium text-foreground">Loading Standards</h3>
            <p className="text-caption text-muted-foreground mt-1">Analyzing student mastery data...</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full bg-background">
      {/* Header */}
      <div className="p-8 border-b border-divider bg-surface/30">
        <div>
          <h2 className="text-h1 font-bold text-foreground">Standards Tracker</h2>
          <p className="text-body text-muted-foreground mt-2">
            Monitor student mastery of learning standards
          </p>
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 p-8">
        <Tabs value={activeTab} onValueChange={setActiveTab} className="h-full">
          <div className="flex items-center gap-1 p-1 bg-background rounded-lg border border-divider w-fit mb-8">
            {[
              { id: 'overview', label: 'Overview', icon: Target },
              { id: 'alignment', label: 'Alignment', icon: BarChart3 },
              { id: 'reports', label: 'Reports', icon: Star }
            ].map((tab) => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={cn(
                  "flex items-center gap-2 px-4 py-2 rounded-md text-caption font-medium transition-airy",
                  activeTab === tab.id 
                    ? "bg-primary text-primary-foreground shadow-sm" 
                    : "text-muted-foreground hover:text-foreground hover:bg-surface/50"
                )}
              >
                <tab.icon className="w-4 h-4" />
                {tab.label}
              </button>
            ))}
          </div>
          
          <TabsContent value="overview" className="flex-1 mt-0">
            {renderOverview()}
          </TabsContent>
          
          <TabsContent value="alignment" className="flex-1 mt-0">
            {renderAlignment()}
          </TabsContent>
          
          <TabsContent value="reports" className="flex-1 mt-0">
            {renderReports()}
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
} 