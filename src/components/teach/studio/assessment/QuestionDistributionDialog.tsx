'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Slider } from '@/components/ui/slider';
import { Textarea } from '@/components/ui/textarea';
import { 
  Brain, 
  Target, 
  BookOpen, 
  HelpCircle,
  CheckSquare,
  FileText,
  PenTool,
  ArrowRightLeft,
  Shuffle,
  Type,
  Wand2,
  Info,
  Sparkles,
  Clock,
  Settings2
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
    color: 'bg-blue-50 text-blue-700 border-blue-200 hover:bg-blue-100',
    description: 'A/B/C/D format',
    timeEstimate: 2,
    difficulty: 'medium'
  },
  { 
    id: 'true_false', 
    label: 'True/False', 
    icon: Target, 
    color: 'bg-emerald-50 text-emerald-700 border-emerald-200 hover:bg-emerald-100',
    description: 'Binary choice',
    timeEstimate: 1,
    difficulty: 'easy'
  },
  { 
    id: 'short_answer', 
    label: 'Short Answer', 
    icon: Type, 
    color: 'bg-purple-50 text-purple-700 border-purple-200 hover:bg-purple-100',
    description: '1-3 sentences',
    timeEstimate: 5,
    difficulty: 'medium'
  },
  { 
    id: 'essay', 
    label: 'Essay', 
    icon: PenTool, 
    color: 'bg-orange-50 text-orange-700 border-orange-200 hover:bg-orange-100',
    description: 'Extended response',
    timeEstimate: 15,
    difficulty: 'hard'
  },
  { 
    id: 'fill_in_blank', 
    label: 'Fill in Blank', 
    icon: FileText, 
    color: 'bg-pink-50 text-pink-700 border-pink-200 hover:bg-pink-100',
    description: 'Complete missing words',
    timeEstimate: 2,
    difficulty: 'easy'
  },
  { 
    id: 'matching', 
    label: 'Matching', 
    icon: ArrowRightLeft, 
    color: 'bg-teal-50 text-teal-700 border-teal-200 hover:bg-teal-100',
    description: 'Connect related items',
    timeEstimate: 3,
    difficulty: 'medium'
  }
];

const presetConfigurations = {
  balanced: {
    name: 'Balanced Assessment',
    description: 'Equal distribution across question types and difficulties',
    icon: Target,
    typeWeights: { multiple_choice: 0.4, short_answer: 0.3, true_false: 0.2, essay: 0.1 },
    difficultyWeights: { easy: 0.3, medium: 0.5, hard: 0.2 },
  },
  quick_check: {
    name: 'Quick Knowledge Check',
    description: 'Fast assessment focusing on recall and understanding',
    icon: Clock,
    typeWeights: { multiple_choice: 0.5, true_false: 0.3, fill_in_blank: 0.2 },
    difficultyWeights: { easy: 0.5, medium: 0.4, hard: 0.1 },
  },
  comprehensive: {
    name: 'Comprehensive Exam',
    description: 'Thorough assessment with higher-order thinking',
    icon: Brain,
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
  const [selectedPreset, setSelectedPreset] = useState<string | null>('balanced');
  const [customTypeDistribution, setCustomTypeDistribution] = useState<{ [key: string]: number }>({
    multiple_choice: 8,
    short_answer: 6,
    true_false: 4,
    essay: 2
  });
  const [estimatedTime, setEstimatedTime] = useState(0);
  const [showAdvanced, setShowAdvanced] = useState(false);

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

  // Initialize with balanced preset
  const handlePresetSelect = useCallback((presetKey: string) => {
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
  }, [config.totalQuestions]);

  // Initialize with balanced preset
  useEffect(() => {
    if (selectedPreset === 'balanced' && Object.keys(customTypeDistribution).length === 0) {
      handlePresetSelect('balanced');
    }
  }, [selectedPreset, customTypeDistribution, handlePresetSelect]);

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

  const totalQuestions = getTotalFromDistribution(customTypeDistribution);

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-5xl max-h-[90vh] flex flex-col">
        {/* Header */}
        <DialogHeader className="pb-6 border-b flex-shrink-0">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-gradient-to-br from-purple-500 to-blue-600 rounded-lg">
              <Sparkles className="w-5 h-5 text-white" />
            </div>
            <div>
              <DialogTitle className="text-xl font-semibold">Generate Questions from Course Content</DialogTitle>
              {baseClassInfo && (
                <div className="flex items-center gap-4 mt-2 text-sm text-muted-foreground">
                  <span className="flex items-center gap-1.5">
                    <BookOpen className="w-4 h-4" />
                    {baseClassInfo.name}
                  </span>
                  <span>{baseClassInfo.totalLessons} lessons</span>
                  <span>{baseClassInfo.totalSections} sections</span>
                </div>
              )}
            </div>
          </div>
        </DialogHeader>

        {/* Content */}
        <div className="flex-1 overflow-y-auto space-y-6 py-4 pr-4 min-h-0">
          {/* Quick Settings */}
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label className="text-sm font-medium">Total Questions</Label>
              <Input
                type="number"
                min="1"
                max="100"
                value={config.totalQuestions}
                onChange={(e) => {
                  const newTotal = parseInt(e.target.value) || 20;
                  setConfig(prev => ({ ...prev, totalQuestions: newTotal }));
                  // Recalculate distribution if preset is selected
                  if (selectedPreset) {
                    handlePresetSelect(selectedPreset);
                  }
                }}
                className="h-10"
              />
            </div>
            <div className="space-y-2">
              <Label className="text-sm font-medium">Overall Difficulty</Label>
              <Select value={config.difficulty} onValueChange={(value: 'easy' | 'medium' | 'hard') => 
                setConfig(prev => ({ ...prev, difficulty: value }))
              }>
                <SelectTrigger className="h-10">
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

          {/* Preset Configurations */}
          <div className="space-y-3">
            <Label className="text-sm font-medium">Preset Configurations</Label>
            <div className="grid grid-cols-3 gap-3">
              {Object.entries(presetConfigurations).map(([key, preset]) => {
                const Icon = preset.icon;
                return (
                  <Card 
                    key={key}
                    className={cn(
                      "cursor-pointer transition-all duration-200 hover:shadow-md border-2",
                      selectedPreset === key 
                        ? "border-primary bg-primary/5 shadow-sm" 
                        : "border-border hover:border-primary/50"
                    )}
                    onClick={() => handlePresetSelect(key)}
                  >
                    <CardContent className="p-4 text-center">
                      <Icon className={cn(
                        "w-6 h-6 mx-auto mb-2",
                        selectedPreset === key ? "text-primary" : "text-muted-foreground"
                      )} />
                      <div className="font-medium text-sm mb-1">{preset.name}</div>
                      <div className="text-xs text-muted-foreground leading-tight">{preset.description}</div>
                    </CardContent>
                  </Card>
                );
              })}
            </div>
          </div>

          {/* Question Type Distribution */}
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <Label className="text-sm font-medium">Question Distribution</Label>
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <span>Total: {totalQuestions}</span>
                {totalQuestions !== config.totalQuestions && (
                  <Badge variant="outline" className="text-xs text-amber-600 border-amber-200">
                    Adjust to {config.totalQuestions}
                  </Badge>
                )}
              </div>
            </div>
            
            <div className="space-y-3">
              {questionTypes.map(type => {
                const count = customTypeDistribution[type.id] || 0;
                const Icon = type.icon;
                
                return (
                  <div key={type.id} className="flex items-center gap-4 p-3 rounded-lg border bg-card/50">
                    <div className="flex items-center gap-3 min-w-[140px]">
                      <Badge className={cn("border", type.color)} variant="secondary">
                        <Icon className="w-3 h-3 mr-1.5" />
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
                    <div className="flex items-center gap-2 min-w-[60px]">
                      <Input
                        type="number"
                        min="0"
                        max={config.totalQuestions}
                        value={count}
                        onChange={(e) => handleTypeDistributionChange(type.id, parseInt(e.target.value) || 0)}
                        className="w-14 h-8 text-center text-sm"
                      />
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          

          {/* Advanced Options */}
          <div className="space-y-3">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setShowAdvanced(!showAdvanced)}
              className="flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground"
            >
              <Settings2 className="w-4 h-4" />
              Advanced Options
              <span className="text-xs">({showAdvanced ? 'Hide' : 'Show'})</span>
            </Button>
            
            {showAdvanced && (
              <div className="space-y-4 p-4 rounded-lg border bg-muted/30">
                <div className="space-y-2">
                  <Label className="text-sm font-medium">Learning Objectives</Label>
                  <Textarea
                    placeholder="Enter specific learning objectives to focus on (one per line)..."
                    value={config.learningObjectives.join('\n')}
                    onChange={(e) => setConfig(prev => ({
                      ...prev,
                      learningObjectives: e.target.value.split('\n').filter(obj => obj.trim())
                    }))}
                    className="min-h-[80px] text-sm"
                  />
                </div>

                <div className="space-y-2">
                  <Label className="text-sm font-medium">Focus Areas</Label>
                  <Textarea
                    placeholder="Enter specific topics or areas to emphasize (one per line)..."
                    value={config.focusAreas.join('\n')}
                    onChange={(e) => setConfig(prev => ({
                      ...prev,
                      focusAreas: e.target.value.split('\n').filter(area => area.trim())
                    }))}
                    className="min-h-[80px] text-sm"
                  />
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Footer */}
        <DialogFooter className="pt-6 border-t flex-shrink-0">
          <div className="flex items-center justify-between w-full">
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <Info className="w-4 h-4" />
              <span>Questions will be generated from all course content</span>
            </div>
            <div className="flex gap-3">
              <Button variant="outline" onClick={onClose} disabled={isLoading}>
                Cancel
              </Button>
              <Button 
                onClick={handleGenerate} 
                disabled={isLoading || totalQuestions === 0}
                className="bg-gradient-to-r from-purple-600 to-blue-600 hover:from-purple-700 hover:to-blue-700 min-w-[140px]"
              >
                {isLoading ? (
                  <>
                    <div className="w-4 h-4 animate-spin rounded-full border-2 border-white border-t-transparent mr-2" />
                    Generating...
                  </>
                ) : (
                  <>
                    <Wand2 className="w-4 h-4 mr-2" />
                    Generate {totalQuestions} Questions
                  </>
                )}
              </Button>
            </div>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}; 