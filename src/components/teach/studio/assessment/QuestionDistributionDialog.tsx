'use client';

import React, { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Slider } from '@/components/ui/slider';
import { Textarea } from '@/components/ui/textarea';
import { Separator } from '@/components/ui/separator';
import { 
  Settings, 
  Brain, 
  Target, 
  TrendingUp, 
  BookOpen, 
  HelpCircle,
  CheckSquare,
  FileText,
  PenTool,
  ArrowRightLeft,
  Shuffle,
  Type,
  RotateCcw,
  Wand2,
  Info
} from 'lucide-react';
import { cn } from '@/lib/utils';

// Types
interface QuestionDistribution {
  typeDistribution: { [key: string]: number };
  difficultyDistribution: { [key: string]: number };
  bloomTaxonomyDistribution: { [key: string]: number };
  focusAreaDistribution?: { [key: string]: number };
}

interface QuestionDistributionConfig {
  totalQuestions: number;
  questionTypes: string[];
  difficulty: 'easy' | 'medium' | 'hard';
  bloomTaxonomy: string;
  learningObjectives: string[];
  focusAreas: string[];
  questionDistribution?: QuestionDistribution;
}

interface QuestionDistributionDialogProps {
  isOpen: boolean;
  onClose: () => void;
  onGenerate: (config: QuestionDistributionConfig) => void;
  baseClassInfo?: {
    name: string;
    totalLessons: number;
    totalSections: number;
  };
  isLoading?: boolean;
}

// Constants
const questionTypes = [
  { 
    id: 'multiple_choice', 
    label: 'Multiple Choice', 
    icon: CheckSquare, 
    color: 'bg-blue-100 text-blue-700 border-blue-200',
    description: 'Traditional A/B/C/D questions',
    timeEstimate: 2,
    difficulty: 'medium'
  },
  { 
    id: 'true_false', 
    label: 'True/False', 
    icon: Target, 
    color: 'bg-green-100 text-green-700 border-green-200',
    description: 'Binary choice questions',
    timeEstimate: 1,
    difficulty: 'easy'
  },
  { 
    id: 'short_answer', 
    label: 'Short Answer', 
    icon: Type, 
    color: 'bg-purple-100 text-purple-700 border-purple-200',
    description: '1-3 sentence responses',
    timeEstimate: 5,
    difficulty: 'medium'
  },
  { 
    id: 'essay', 
    label: 'Essay', 
    icon: PenTool, 
    color: 'bg-orange-100 text-orange-700 border-orange-200',
    description: 'Extended written responses',
    timeEstimate: 15,
    difficulty: 'hard'
  },
  { 
    id: 'fill_in_blank', 
    label: 'Fill in Blank', 
    icon: FileText, 
    color: 'bg-pink-100 text-pink-700 border-pink-200',
    description: 'Complete the missing words',
    timeEstimate: 2,
    difficulty: 'easy'
  },
  { 
    id: 'matching', 
    label: 'Matching', 
    icon: ArrowRightLeft, 
    color: 'bg-teal-100 text-teal-700 border-teal-200',
    description: 'Connect related items',
    timeEstimate: 3,
    difficulty: 'medium'
  },
  { 
    id: 'sequence', 
    label: 'Sequence', 
    icon: Shuffle, 
    color: 'bg-indigo-100 text-indigo-700 border-indigo-200',
    description: 'Order items correctly',
    timeEstimate: 3,
    difficulty: 'medium'
  }
];

const presetConfigurations = {
  balanced: {
    name: 'Balanced Assessment',
    description: 'Equal distribution across question types and difficulties',
    typeWeights: { multiple_choice: 0.4, short_answer: 0.3, true_false: 0.2, essay: 0.1 },
    difficultyWeights: { easy: 0.3, medium: 0.5, hard: 0.2 },
  },
  quick_check: {
    name: 'Quick Knowledge Check',
    description: 'Fast assessment focusing on recall and understanding',
    typeWeights: { multiple_choice: 0.5, true_false: 0.3, fill_in_blank: 0.2 },
    difficultyWeights: { easy: 0.5, medium: 0.4, hard: 0.1 },
  },
  comprehensive: {
    name: 'Comprehensive Exam',
    description: 'Thorough assessment with higher-order thinking',
    typeWeights: { multiple_choice: 0.3, short_answer: 0.3, essay: 0.25, matching: 0.15 },
    difficultyWeights: { easy: 0.2, medium: 0.4, hard: 0.4 },
  }
};

export const QuestionDistributionDialog: React.FC<QuestionDistributionDialogProps> = ({
  isOpen,
  onClose,
  onGenerate,
  baseClassInfo,
  isLoading = false
}) => {
  const [config, setConfig] = useState<QuestionDistributionConfig>({
    totalQuestions: 20,
    questionTypes: ['multiple_choice', 'short_answer'],
    difficulty: 'medium',
    bloomTaxonomy: 'understand',
    learningObjectives: [],
    focusAreas: []
  });
  const [activeTab, setActiveTab] = useState<'basic' | 'distribution' | 'advanced'>('basic');
  const [selectedPreset, setSelectedPreset] = useState<string | null>(null);
  const [customTypeDistribution, setCustomTypeDistribution] = useState<{ [key: string]: number }>({});
  const [estimatedTime, setEstimatedTime] = useState(0);

  // Calculate estimated time when configuration changes
  useEffect(() => {
    const typeDistribution = config.questionDistribution?.typeDistribution || customTypeDistribution;
    let totalTime = 0;
    
    Object.entries(typeDistribution).forEach(([type, count]) => {
      const typeInfo = questionTypes.find(qt => qt.id === type);
      if (typeInfo) {
        totalTime += typeInfo.timeEstimate * count;
      }
    });
    
    setEstimatedTime(totalTime);
  }, [config, customTypeDistribution]);

  const handlePresetSelect = (presetKey: string) => {
    const preset = presetConfigurations[presetKey as keyof typeof presetConfigurations];
    if (!preset) return;

    setSelectedPreset(presetKey);
    
    // Calculate distributions based on preset weights
    const typeDistribution: { [key: string]: number } = {};
    const difficultyDistribution: { [key: string]: number } = {};

    // Apply type weights
    Object.entries(preset.typeWeights).forEach(([type, weight]) => {
      typeDistribution[type] = Math.round(config.totalQuestions * weight);
    });

    // Apply difficulty weights
    Object.entries(preset.difficultyWeights).forEach(([difficulty, weight]) => {
      difficultyDistribution[difficulty] = Math.round(config.totalQuestions * weight);
    });

    setCustomTypeDistribution(typeDistribution);

    setConfig(prev => ({
      ...prev,
      questionTypes: Object.keys(typeDistribution).filter(type => typeDistribution[type] > 0),
      questionDistribution: {
        typeDistribution,
        difficultyDistribution,
        bloomTaxonomyDistribution: {}
      }
    }));
  };

  const handleTypeDistributionChange = (type: string, count: number) => {
    const newDistribution = { ...customTypeDistribution, [type]: count };
    
    // Remove types with 0 count
    if (count === 0) {
      delete newDistribution[type];
    }
    
    setCustomTypeDistribution(newDistribution);
    setSelectedPreset(null); // Clear preset selection when manually adjusting
    
    setConfig(prev => ({
      ...prev,
      questionTypes: Object.keys(newDistribution).filter(t => newDistribution[t] > 0),
      questionDistribution: {
        ...prev.questionDistribution,
        typeDistribution: newDistribution,
        difficultyDistribution: {},
        bloomTaxonomyDistribution: {}
      }
    }));
  };

  const handleGenerate = () => {
    onGenerate(config);
  };

  const getTotalFromDistribution = (distribution: { [key: string]: number }) => {
    return Object.values(distribution).reduce((sum, count) => sum + count, 0);
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Wand2 className="w-5 h-5" />
            Generate Questions from Course Content
          </DialogTitle>
          {baseClassInfo && (
            <div className="text-sm text-muted-foreground mt-2">
              <div className="flex items-center gap-4">
                <span className="flex items-center gap-1">
                  <BookOpen className="w-4 h-4" />
                  {baseClassInfo.name}
                </span>
                <span>{baseClassInfo.totalLessons} lessons</span>
                <span>{baseClassInfo.totalSections} content sections</span>
              </div>
            </div>
          )}
        </DialogHeader>

        <Tabs value={activeTab} onValueChange={(value) => setActiveTab(value as typeof activeTab)} className="w-full">
          <TabsList className="grid w-full grid-cols-3">
            <TabsTrigger value="basic">Basic Settings</TabsTrigger>
            <TabsTrigger value="distribution">Question Distribution</TabsTrigger>
            <TabsTrigger value="advanced">Advanced Options</TabsTrigger>
          </TabsList>

          <TabsContent value="basic" className="space-y-6">
            <div className="grid grid-cols-2 gap-6">
              <div className="space-y-4">
                <div>
                  <Label htmlFor="totalQuestions">Total Questions</Label>
                  <Input
                    id="totalQuestions"
                    type="number"
                    min="1"
                    max="100"
                    value={config.totalQuestions}
                    onChange={(e) => setConfig(prev => ({ ...prev, totalQuestions: parseInt(e.target.value) || 20 }))}
                    className="mt-1"
                  />
                </div>

                <div>
                  <Label>Overall Difficulty</Label>
                  <Select value={config.difficulty} onValueChange={(value: 'easy' | 'medium' | 'hard') => 
                    setConfig(prev => ({ ...prev, difficulty: value }))
                  }>
                    <SelectTrigger className="mt-1">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="easy">Easy</SelectItem>
                      <SelectItem value="medium">Medium</SelectItem>
                      <SelectItem value="hard">Hard</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div className="space-y-4">
                <div>
                  <Label>Preset Configurations</Label>
                  <div className="mt-2 space-y-2">
                    {Object.entries(presetConfigurations).map(([key, preset]) => (
                      <Card 
                        key={key}
                        className={cn(
                          "cursor-pointer transition-colors hover:bg-accent",
                          selectedPreset === key && "ring-2 ring-primary"
                        )}
                        onClick={() => handlePresetSelect(key)}
                      >
                        <CardContent className="p-3">
                          <div className="flex items-center justify-between">
                            <div>
                              <div className="font-medium">{preset.name}</div>
                              <div className="text-sm text-muted-foreground">{preset.description}</div>
                            </div>
                            {selectedPreset === key && (
                              <Badge variant="default">Selected</Badge>
                            )}
                          </div>
                        </CardContent>
                      </Card>
                    ))}
                  </div>
                </div>

                {estimatedTime > 0 && (
                  <Card>
                    <CardContent className="p-3">
                      <div className="flex items-center gap-2 text-sm">
                        <HelpCircle className="w-4 h-4" />
                        <span>Estimated completion time: <strong>{estimatedTime} minutes</strong></span>
                      </div>
                    </CardContent>
                  </Card>
                )}
              </div>
            </div>
          </TabsContent>

          <TabsContent value="distribution" className="space-y-6">
            <div className="space-y-6">
              <div>
                <Label className="text-base font-medium">Question Type Distribution</Label>
                <div className="mt-3 space-y-3">
                  {questionTypes.map(type => {
                    const count = customTypeDistribution[type.id] || 0;
                    const Icon = type.icon;
                    
                    return (
                      <div key={type.id} className="flex items-center gap-4">
                        <div className="flex items-center gap-2 min-w-[160px]">
                          <Badge className={type.color} variant="secondary">
                            <Icon className="w-3 h-3 mr-1" />
                            {type.label}
                          </Badge>
                        </div>
                        <div className="flex-1">
                          <Slider
                            value={[count]}
                            onValueChange={([value]) => handleTypeDistributionChange(type.id, value)}
                            max={config.totalQuestions}
                            step={1}
                            className="w-full"
                          />
                        </div>
                        <div className="min-w-[80px] flex items-center gap-2">
                          <Input
                            type="number"
                            min="0"
                            max={config.totalQuestions}
                            value={count}
                            onChange={(e) => handleTypeDistributionChange(type.id, parseInt(e.target.value) || 0)}
                            className="w-16 h-8 text-center"
                          />
                          <span className="text-sm text-muted-foreground">
                            {count > 0 ? `(${Math.round((count / config.totalQuestions) * 100)}%)` : ''}
                          </span>
                        </div>
                      </div>
                    );
                  })}
                </div>
                <div className="mt-2 text-sm text-muted-foreground">
                  Total: {getTotalFromDistribution(customTypeDistribution)} / {config.totalQuestions}
                  {getTotalFromDistribution(customTypeDistribution) !== config.totalQuestions && (
                    <span className="text-amber-600 ml-2">⚠️ Totals don't match</span>
                  )}
                </div>
              </div>
            </div>
          </TabsContent>

          <TabsContent value="advanced" className="space-y-6">
            <div className="space-y-4">
              <div>
                <Label htmlFor="learningObjectives">Learning Objectives (one per line)</Label>
                <Textarea
                  id="learningObjectives"
                  placeholder="Enter specific learning objectives to focus on..."
                  value={config.learningObjectives.join('\n')}
                  onChange={(e) => setConfig(prev => ({
                    ...prev,
                    learningObjectives: e.target.value.split('\n').filter(obj => obj.trim())
                  }))}
                  className="mt-1 min-h-[100px]"
                />
              </div>

              <div>
                <Label htmlFor="focusAreas">Focus Areas (one per line)</Label>
                <Textarea
                  id="focusAreas"
                  placeholder="Enter specific topics or areas to emphasize..."
                  value={config.focusAreas.join('\n')}
                  onChange={(e) => setConfig(prev => ({
                    ...prev,
                    focusAreas: e.target.value.split('\n').filter(area => area.trim())
                  }))}
                  className="mt-1 min-h-[100px]"
                />
              </div>
            </div>
          </TabsContent>
        </Tabs>

        <DialogFooter className="flex items-center justify-between">
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <Info className="w-4 h-4" />
            Questions will be generated from all course content
          </div>
          <div className="flex gap-2">
            <Button variant="outline" onClick={onClose} disabled={isLoading}>
              Cancel
            </Button>
            <Button 
              onClick={handleGenerate} 
              disabled={isLoading || config.totalQuestions === 0}
              className="flex items-center gap-2"
            >
              {isLoading ? (
                <>
                  <div className="w-4 h-4 animate-spin rounded-full border-2 border-primary border-t-transparent" />
                  Generating...
                </>
              ) : (
                <>
                  <Wand2 className="w-4 h-4" />
                  Generate {config.totalQuestions} Questions
                </>
              )}
            </Button>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}; 