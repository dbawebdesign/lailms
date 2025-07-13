'use client';

import React, { useState, useEffect } from 'react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Switch } from '@/components/ui/switch';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Separator } from '@/components/ui/separator';
import { 
  Settings, 
  Save, 
  RotateCcw, 
  Eye, 
  EyeOff, 
  Calculator, 
  Users, 
  Clock,
  Shield,
  Download,
  Upload,
  Bell,
  Mail,
  AlertTriangle
} from 'lucide-react';
import { cn } from '@/lib/utils';

interface GradeScale {
  letter: string;
  min_percentage: number;
  max_percentage: number;
  points: number;
}

interface GradebookSettingsProps {
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
  onDataChange: (data: any) => void;
  onUpdateSettings?: (settings: any) => Promise<void>;
  isLoading: boolean;
}

export function GradebookSettings({
  classInstance,
  data,
  onDataChange,
  onUpdateSettings,
  isLoading
}: GradebookSettingsProps) {
  const [activeTab, setActiveTab] = useState('general');
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false);

  // Default grade scale
  const [gradeScale, setGradeScale] = useState<GradeScale[]>([
    { letter: 'A+', min_percentage: 97, max_percentage: 100, points: 4.0 },
    { letter: 'A', min_percentage: 93, max_percentage: 96, points: 4.0 },
    { letter: 'A-', min_percentage: 90, max_percentage: 92, points: 3.7 },
    { letter: 'B+', min_percentage: 87, max_percentage: 89, points: 3.3 },
    { letter: 'B', min_percentage: 83, max_percentage: 86, points: 3.0 },
    { letter: 'B-', min_percentage: 80, max_percentage: 82, points: 2.7 },
    { letter: 'C+', min_percentage: 77, max_percentage: 79, points: 2.3 },
    { letter: 'C', min_percentage: 73, max_percentage: 76, points: 2.0 },
    { letter: 'C-', min_percentage: 70, max_percentage: 72, points: 1.7 },
    { letter: 'D+', min_percentage: 67, max_percentage: 69, points: 1.3 },
    { letter: 'D', min_percentage: 65, max_percentage: 66, points: 1.0 },
    { letter: 'F', min_percentage: 0, max_percentage: 64, points: 0.0 }
  ]);

  // Default settings fallback
  const defaultSettings = {
    // General Settings
    gradingPeriod: 'semester',
    calculateFinalGrade: true,
    showStudentRanking: false,
    allowStudentViewGrades: true,
    showParentAccess: true,
    
    // Calculation Settings
    weightingScheme: 'category',
    dropLowestScores: false,
    dropLowestCount: 1,
    extraCreditHandling: 'additive',
    lateWorkPenalty: 10,
    missingAssignmentScore: 0,
    
    // Display Settings
    gradeDisplayFormat: 'percentage',
    showPointsEarned: true,
    showAssignmentAverages: true,
    colorCodeGrades: true,
    highlightMissingWork: true,
    
    // Standards Settings
    enableStandardsGrading: true,
    standardsMasteryScale: 4,
    showStandardsInGradebook: true,
    requireStandardsAlignment: false,
    
    // Communication Settings
    emailGradeUpdates: false,
    weeklyProgressReports: false,
    parentNotifications: true,
    lowGradeAlerts: true,
    lowGradeThreshold: 70,
    
    // Privacy Settings
    anonymousMode: false,
    hideGradeHistory: false,
    requirePasswordForChanges: true,
    auditTrail: true
  };

  // Initialize settings from live data or defaults
  const [settings, setSettings] = useState({
    ...defaultSettings,
    ...(data.settings || {})
  });

  // Update settings when data changes
  useEffect(() => {
    setSettings({
      ...defaultSettings,
      ...(data.settings || {})
    });
  }, [data.settings]);

  const handleSettingChange = (key: string, value: any) => {
    setSettings((prev: any) => ({ ...prev, [key]: value }));
    setHasUnsavedChanges(true);
  };

  const handleGradeScaleChange = (index: number, field: string, value: number | string) => {
    const newScale = [...gradeScale];
    newScale[index] = { ...newScale[index], [field]: value };
    setGradeScale(newScale);
    setHasUnsavedChanges(true);
  };

  const handleSaveSettings = async () => {
    try {
      // Use the updateSettings function from the useGradebook hook
      const settingsToSave = {
        ...settings,
        gradeScale: gradeScale
      };
      
      // Call the updateSettings function if available
      if (onUpdateSettings) {
        await onUpdateSettings(settingsToSave);
      } else {
        // Fallback to onDataChange if onUpdateSettings is not available
        await onDataChange(settingsToSave);
      }
      
      console.log('Settings saved successfully:', settingsToSave);
      setHasUnsavedChanges(false);
    } catch (error) {
      console.error('Failed to save settings:', error);
      alert('Failed to save settings. Please try again.');
    }
  };

  const handleResetToDefaults = () => {
    // Reset to default settings
    setHasUnsavedChanges(true);
  };

  const SettingCard = ({ title, description, children }: any) => (
    <Card className="p-6 bg-surface/50 border-divider">
      <div className="space-y-4">
        <div>
          <h3 className="text-h3 font-semibold text-foreground">{title}</h3>
          {description && <p className="text-caption text-muted-foreground mt-1">{description}</p>}
        </div>
        {children}
      </div>
    </Card>
  );

  const SettingRow = ({ label, description, children, badge }: any) => (
    <div className="flex items-center justify-between py-3">
      <div className="flex-1">
        <div className="flex items-center gap-2">
          <Label className="text-body font-medium text-foreground">{label}</Label>
          {badge && badge}
        </div>
        {description && <p className="text-caption text-muted-foreground mt-1">{description}</p>}
      </div>
      <div>{children}</div>
    </div>
  );

  const renderGeneralSettings = () => (
    <div className="space-y-8">
      <SettingCard 
        title="Basic Configuration" 
        description="Core settings for your gradebook setup"
      >
        <div className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="space-y-2">
              <Label className="text-body font-medium text-foreground">Grading Period</Label>
              <Select 
                value={settings.gradingPeriod} 
                onValueChange={(value) => handleSettingChange('gradingPeriod', value)}
              >
                <SelectTrigger className="border-divider">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="quarter">Quarter</SelectItem>
                  <SelectItem value="semester">Semester</SelectItem>
                  <SelectItem value="trimester">Trimester</SelectItem>
                  <SelectItem value="year">Full Year</SelectItem>
                </SelectContent>
              </Select>
            </div>
            
            <div className="space-y-2">
              <Label className="text-body font-medium text-foreground">Grade Display Format</Label>
              <Select 
                value={settings.gradeDisplayFormat} 
                onValueChange={(value) => handleSettingChange('gradeDisplayFormat', value)}
              >
                <SelectTrigger className="border-divider">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="percentage">Percentage (85%)</SelectItem>
                  <SelectItem value="letter">Letter Grade (B+)</SelectItem>
                  <SelectItem value="points">Points (4.0 Scale)</SelectItem>
                  <SelectItem value="both">Percentage + Letter</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          <Separator className="bg-divider" />

          <div className="space-y-4">
            <SettingRow
              label="Calculate Final Grade"
              description="Automatically calculate and display final grades"
            >
              <Switch
                checked={settings.calculateFinalGrade}
                onCheckedChange={(checked) => handleSettingChange('calculateFinalGrade', checked)}
              />
            </SettingRow>

            <SettingRow
              label="Show Student Ranking"
              description="Display class ranking for students"
            >
              <Switch
                checked={settings.showStudentRanking}
                onCheckedChange={(checked) => handleSettingChange('showStudentRanking', checked)}
              />
            </SettingRow>

            <SettingRow
              label="Allow Student View Grades"
              description="Students can view their own grades online"
            >
              <Switch
                checked={settings.allowStudentViewGrades}
                onCheckedChange={(checked) => handleSettingChange('allowStudentViewGrades', checked)}
              />
            </SettingRow>

            <SettingRow
              label="Parent Access"
              description="Enable parent/guardian access to student grades"
              badge={
                <Badge className="bg-info/10 text-info border-info/20">
                  Recommended
                </Badge>
              }
            >
              <Switch
                checked={settings.showParentAccess}
                onCheckedChange={(checked) => handleSettingChange('showParentAccess', checked)}
              />
            </SettingRow>
          </div>
        </div>
      </SettingCard>

      <SettingCard 
        title="Display Preferences" 
        description="Customize how grades are displayed in the gradebook"
      >
        <div className="space-y-4">
          <SettingRow
            label="Show Points Earned"
            description="Display points earned alongside percentages"
          >
            <Switch
              checked={settings.showPointsEarned}
              onCheckedChange={(checked) => handleSettingChange('showPointsEarned', checked)}
            />
          </SettingRow>

          <SettingRow
            label="Show Assignment Averages"
            description="Display class averages for each assignment"
          >
            <Switch
              checked={settings.showAssignmentAverages}
              onCheckedChange={(checked) => handleSettingChange('showAssignmentAverages', checked)}
            />
          </SettingRow>

          <SettingRow
            label="Color Code Grades"
            description="Use colors to highlight grade ranges"
          >
            <Switch
              checked={settings.colorCodeGrades}
              onCheckedChange={(checked) => handleSettingChange('colorCodeGrades', checked)}
            />
          </SettingRow>

          <SettingRow
            label="Highlight Missing Work"
            description="Visually emphasize missing assignments"
            badge={
              <Badge className="bg-warning/10 text-warning border-warning/20">
                Important
              </Badge>
            }
          >
            <Switch
              checked={settings.highlightMissingWork}
              onCheckedChange={(checked) => handleSettingChange('highlightMissingWork', checked)}
            />
          </SettingRow>
        </div>
      </SettingCard>
    </div>
  );

  const renderCalculationSettings = () => (
    <div className="space-y-8">
      <SettingCard 
        title="Grade Calculation Methods" 
        description="Configure how final grades are calculated"
      >
        <div className="space-y-6">
          <div className="space-y-2">
            <Label className="text-body font-medium text-foreground">Weighting Scheme</Label>
            <Select 
              value={settings.weightingScheme} 
              onValueChange={(value) => handleSettingChange('weightingScheme', value)}
            >
              <SelectTrigger className="border-divider">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="equal">Equal Weight</SelectItem>
                <SelectItem value="category">Category Weight</SelectItem>
                <SelectItem value="custom">Custom Weight</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <Separator className="bg-divider" />

          <div className="space-y-4">
            <SettingRow
              label="Drop Lowest Scores"
              description="Automatically drop the lowest assignment scores"
            >
              <Switch
                checked={settings.dropLowestScores}
                onCheckedChange={(checked) => handleSettingChange('dropLowestScores', checked)}
              />
            </SettingRow>

            {settings.dropLowestScores && (
              <div className="ml-6 space-y-2">
                <Label className="text-body font-medium text-foreground">Number to Drop</Label>
                <Input
                  type="number"
                  min="1"
                  max="5"
                  value={settings.dropLowestCount}
                  onChange={(e) => handleSettingChange('dropLowestCount', parseInt(e.target.value))}
                  className="w-32 border-divider focus:border-primary/50"
                />
              </div>
            )}
          </div>
        </div>
      </SettingCard>

      <SettingCard 
        title="Special Cases" 
        description="Handle late work, missing assignments, and extra credit"
      >
        <div className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="space-y-2">
              <Label className="text-body font-medium text-foreground">Late Work Penalty (%)</Label>
              <Input
                type="number"
                min="0"
                max="100"
                value={settings.lateWorkPenalty}
                onChange={(e) => handleSettingChange('lateWorkPenalty', parseInt(e.target.value))}
                className="border-divider focus:border-primary/50"
              />
            </div>

            <div className="space-y-2">
              <Label className="text-body font-medium text-foreground">Missing Assignment Score</Label>
              <Input
                type="number"
                min="0"
                max="100"
                value={settings.missingAssignmentScore}
                onChange={(e) => handleSettingChange('missingAssignmentScore', parseInt(e.target.value))}
                className="border-divider focus:border-primary/50"
              />
            </div>
          </div>

          <div className="space-y-2">
            <Label className="text-body font-medium text-foreground">Extra Credit Handling</Label>
            <Select 
              value={settings.extraCreditHandling} 
              onValueChange={(value) => handleSettingChange('extraCreditHandling', value)}
            >
              <SelectTrigger className="border-divider">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="additive">Add to Total Points</SelectItem>
                <SelectItem value="replacement">Replace Lowest Score</SelectItem>
                <SelectItem value="bonus">Bonus Percentage</SelectItem>
                <SelectItem value="none">No Extra Credit</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>
      </SettingCard>
    </div>
  );

  const renderGradeScale = () => (
    <div className="space-y-8">
      <SettingCard 
        title="Grade Scale Configuration" 
        description="Define letter grade ranges and GPA values"
      >
        <div className="space-y-6">
          <div className="flex justify-between items-center">
            <div className="flex gap-3">
              <Button variant="outline" size="sm" className="border-divider hover:bg-surface/80">
                <Upload className="w-4 h-4 mr-2" />
                Import Scale
              </Button>
              <Button variant="outline" size="sm" className="border-divider hover:bg-surface/80">
                <Download className="w-4 h-4 mr-2" />
                Export Scale
              </Button>
            </div>
            <Button variant="outline" size="sm" className="border-divider hover:bg-surface/80">
              <RotateCcw className="w-4 h-4 mr-2" />
              Reset to Standard
            </Button>
          </div>
          
          <div className="space-y-3">
            <div className="grid grid-cols-4 gap-4 p-3 bg-muted/30 rounded-lg">
              <div className="text-caption font-semibold text-muted-foreground">Letter Grade</div>
              <div className="text-caption font-semibold text-muted-foreground">Min %</div>
              <div className="text-caption font-semibold text-muted-foreground">Max %</div>
              <div className="text-caption font-semibold text-muted-foreground">GPA Points</div>
            </div>
            
            {gradeScale.map((grade, index) => (
              <div key={index} className="grid grid-cols-4 gap-4 p-2 hover:bg-surface/50 rounded-lg transition-airy">
                <Input
                  value={grade.letter}
                  onChange={(e) => handleGradeScaleChange(index, 'letter', e.target.value)}
                  className="text-center font-medium border-divider focus:border-primary/50"
                />
                <Input
                  type="number"
                  min="0"
                  max="100"
                  value={grade.min_percentage}
                  onChange={(e) => handleGradeScaleChange(index, 'min_percentage', parseInt(e.target.value))}
                  className="border-divider focus:border-primary/50"
                />
                <Input
                  type="number"
                  min="0"
                  max="100"
                  value={grade.max_percentage}
                  onChange={(e) => handleGradeScaleChange(index, 'max_percentage', parseInt(e.target.value))}
                  className="border-divider focus:border-primary/50"
                />
                <Input
                  type="number"
                  step="0.1"
                  min="0"
                  max="4"
                  value={grade.points}
                  onChange={(e) => handleGradeScaleChange(index, 'points', parseFloat(e.target.value))}
                  className="border-divider focus:border-primary/50"
                />
              </div>
            ))}
          </div>
          
          <div className="flex justify-between">
            <Button variant="outline" size="sm" className="border-divider hover:bg-surface/80">
              Add Grade Level
            </Button>
          </div>
        </div>
      </SettingCard>
    </div>
  );

  const renderNotificationSettings = () => (
    <div className="space-y-8">
      <SettingCard 
        title="Communication & Alerts" 
        description="Configure notifications and automatic reports"
      >
        <div className="space-y-4">
          <SettingRow
            label="Email Grade Updates"
            description="Send email when grades are posted"
          >
            <Switch
              checked={settings.emailGradeUpdates}
              onCheckedChange={(checked) => handleSettingChange('emailGradeUpdates', checked)}
            />
          </SettingRow>

          <SettingRow
            label="Weekly Progress Reports"
            description="Automatic weekly summary emails"
          >
            <Switch
              checked={settings.weeklyProgressReports}
              onCheckedChange={(checked) => handleSettingChange('weeklyProgressReports', checked)}
            />
          </SettingRow>

          <SettingRow
            label="Parent Notifications"
            description="Send notifications to parents/guardians"
            badge={
              <Badge className="bg-info/10 text-info border-info/20">
                Recommended
              </Badge>
            }
          >
            <Switch
              checked={settings.parentNotifications}
              onCheckedChange={(checked) => handleSettingChange('parentNotifications', checked)}
            />
          </SettingRow>

          <Separator className="bg-divider" />

          <SettingRow
            label="Low Grade Alerts"
            description="Alert when student grade falls below threshold"
            badge={
              <Badge className="bg-warning/10 text-warning border-warning/20">
                <AlertTriangle className="w-3 h-3 mr-1" />
                Important
              </Badge>
            }
          >
            <Switch
              checked={settings.lowGradeAlerts}
              onCheckedChange={(checked) => handleSettingChange('lowGradeAlerts', checked)}
            />
          </SettingRow>

          {settings.lowGradeAlerts && (
            <div className="ml-6 space-y-2">
              <Label className="text-body font-medium text-foreground">Low Grade Threshold (%)</Label>
              <Input
                type="number"
                min="0"
                max="100"
                value={settings.lowGradeThreshold}
                onChange={(e) => handleSettingChange('lowGradeThreshold', parseInt(e.target.value))}
                className="w-32 border-divider focus:border-primary/50"
              />
            </div>
          )}
        </div>
      </SettingCard>
    </div>
  );

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-full min-h-[400px]">
        <div className="text-center space-y-4">
          <Settings className="w-16 h-16 text-muted-foreground mx-auto animate-pulse" />
          <div>
            <h3 className="text-h3 font-medium text-foreground">Loading Settings</h3>
            <p className="text-caption text-muted-foreground mt-1">Preparing configuration options...</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full bg-background">
      {/* Header */}
      <div className="p-8 border-b border-divider bg-surface/30">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-h1 font-bold text-foreground">Gradebook Settings</h2>
            <p className="text-body text-muted-foreground mt-2">
              Configure grading policies and display preferences
            </p>
          </div>
          
          <div className="flex items-center gap-3">
            {hasUnsavedChanges && (
              <Badge className="bg-warning/10 text-warning border-warning/20">
                <Clock className="w-3 h-3 mr-1" />
                Unsaved changes
              </Badge>
            )}
            <Button 
              variant="outline" 
              onClick={handleResetToDefaults}
              className="border-divider hover:bg-surface/80"
            >
              <RotateCcw className="w-4 h-4 mr-2" />
              Reset
            </Button>
            <Button 
              onClick={handleSaveSettings}
              className="bg-brand-gradient hover:opacity-90 transition-airy shadow-md hover:shadow-lg"
            >
              <Save className="w-4 h-4 mr-2" />
              Save Settings
            </Button>
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 p-8">
        <Tabs value={activeTab} onValueChange={setActiveTab} className="h-full">
          <div className="flex items-center gap-1 p-1 bg-background rounded-lg border border-divider w-fit mb-8">
            {[
              { id: 'general', label: 'General', icon: Settings },
              { id: 'calculation', label: 'Calculation', icon: Calculator },
              { id: 'scale', label: 'Grade Scale', icon: Eye },
              { id: 'notifications', label: 'Notifications', icon: Bell }
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
          
          <TabsContent value="general" className="flex-1 mt-0">
            {renderGeneralSettings()}
          </TabsContent>
          
          <TabsContent value="calculation" className="flex-1 mt-0">
            {renderCalculationSettings()}
          </TabsContent>
          
          <TabsContent value="scale" className="flex-1 mt-0">
            {renderGradeScale()}
          </TabsContent>
          
          <TabsContent value="notifications" className="flex-1 mt-0">
            {renderNotificationSettings()}
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
} 