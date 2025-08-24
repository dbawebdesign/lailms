'use client';

import React, { useState, useMemo } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { ScrollArea } from '@/components/ui/scroll-area';
import { 
  Copy, 
  Check, 
  Download, 
  Edit3, 
  MessageSquare, 
  Clock,
  Users,
  Target,
  Package,
  Settings,
  PlayCircle,
  CheckCircle,
  Lightbulb,
  Plus,
  BookOpen,
  AlertTriangle
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { useUIContext } from '@/context/UIContext';

interface ActivitiesDisplayProps {
  content: string;
  metadata?: {
    subject?: string;
    gradeLevel?: string;
    topic?: string;
    activityType?: string;
    duration?: string;
    groupSize?: string;
    wordCount?: number;
    estimatedTime?: string;
    difficulty?: string;
  };
  onCopy: (text: string, itemId: string) => void;
  copiedItems: Set<string>;
  onRefineWithLuna?: (currentActivity: any) => void;
}

interface ParsedActivity {
  title: string;
  subject?: string;
  gradeLevel?: string;
  duration?: string;
  groupSize?: string;
  learningObjectives: string[];
  materials: string[];
  setupInstructions: string[];
  activityInstructions: ActivityStep[];
  assessmentStrategies: string[];
  differentiationOptions: {
    advanced?: string;
    struggling?: string;
    ell?: string;
  };
  extensionActivities: string[];
  teacherNotes: string[];
}

interface ActivityStep {
  phase: string;
  time: string;
  description: string;
}

export function ActivitiesDisplay({ content, metadata, onCopy, copiedItems, onRefineWithLuna }: ActivitiesDisplayProps) {
  
  const [editedActivity, setEditedActivity] = useState<ParsedActivity | null>(null);
  const [editingTitle, setEditingTitle] = useState(false);
  const [editingCell, setEditingCell] = useState<string | null>(null);
  
  // Safely access UIContext for panel control
  const { setPanelVisible } = useUIContext();

  // Enhanced parsing logic for activity content
  const parseActivityContent = (content: string): ParsedActivity => {
    
    const lines = content.split('\n').map(line => line.trim()).filter(line => line);
    let title = 'Educational Activity';
    let subject = '';
    let gradeLevel = '';
    let duration = '';
    let groupSize = '';
    const learningObjectives: string[] = [];
    const materials: string[] = [];
    const setupInstructions: string[] = [];
    const activityInstructions: ActivityStep[] = [];
    const assessmentStrategies: string[] = [];
    const differentiationOptions: { advanced?: string; struggling?: string; ell?: string } = {};
    const extensionActivities: string[] = [];
    const teacherNotes: string[] = [];
    
    let currentSection = '';
    
    // Check if this is structured activity content or other format
    const hasStructuredSections = content.includes('**Learning Objectives:**') || 
                                   content.includes('**Materials Needed:**') ||
                                   content.includes('**Activity Instructions:**');
    
    if (!hasStructuredSections) {
      // Handle non-structured content (like worksheets, simple activities, etc.)
      // Extract title from first bold line or first meaningful line
      const titleMatch = content.match(/\*\*([^*]+)\*\*/);
      if (titleMatch) {
        title = titleMatch[1].trim();
      } else {
        // Look for title in first few lines
        const firstLines = lines.slice(0, 3);
        for (const line of firstLines) {
          if (line.length > 5 && !line.includes(':') && !line.startsWith('-') && !line.startsWith('•')) {
            title = line.replace(/\*\*/g, '').trim();
            break;
          }
        }
      }
      
      // For non-structured content, create a single activity instruction with the full content
      activityInstructions.push({
        phase: 'Activity Content',
        time: '',
        description: content.replace(/\*\*/g, '').trim()
      });
      
      // Add some basic objectives and notes for non-structured content
      learningObjectives.push('Follow the provided activity instructions');
      learningObjectives.push('Complete the activity as described');
      
      materials.push('Printed activity sheet');
      materials.push('Writing materials (pen/pencil)');
      
      teacherNotes.push('This content was provided in a non-structured format');
      teacherNotes.push('Review and adapt as needed for your classroom');
      
      return {
        title,
        subject,
        gradeLevel,
        duration,
        groupSize,
        learningObjectives,
        materials,
        setupInstructions,
        activityInstructions,
        assessmentStrategies,
        differentiationOptions,
        extensionActivities,
        teacherNotes
      };
    }
    
    // Process structured content (original logic)
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      
      // Extract title (first line with activity name or first **bold** line)
      if (i === 0 || (line.startsWith('**') && line.endsWith('**') && !line.includes(':'))) {
        title = line.replace(/\*\*/g, '').trim();
        continue;
      }
      
      // Extract metadata from subject line
      if (line.includes('Subject:') && line.includes('Grade Level:')) {
        const subjectMatch = line.match(/Subject:\s*([^|]+)/);
        const gradeMatch = line.match(/Grade Level:\s*([^|]+)/);
        const durationMatch = line.match(/Duration:\s*([^|]+)/);
        const groupMatch = line.match(/Group Size:\s*([^|]+)/);
        
        if (subjectMatch) subject = subjectMatch[1].trim();
        if (gradeMatch) gradeLevel = gradeMatch[1].trim();
        if (durationMatch) duration = durationMatch[1].trim();
        if (groupMatch) groupSize = groupMatch[1].trim();
        continue;
      }
      
      // Identify sections
      if (line.startsWith('**') && line.endsWith('**')) {
        const sectionTitle = line.replace(/\*\*/g, '').toLowerCase();
        if (sectionTitle.includes('learning objectives')) {
          currentSection = 'objectives';
        } else if (sectionTitle.includes('materials needed')) {
          currentSection = 'materials';
        } else if (sectionTitle.includes('setup instructions')) {
          currentSection = 'setup';
        } else if (sectionTitle.includes('activity instructions')) {
          currentSection = 'instructions';
        } else if (sectionTitle.includes('assessment strategies')) {
          currentSection = 'assessment';
        } else if (sectionTitle.includes('differentiation options')) {
          currentSection = 'differentiation';
        } else if (sectionTitle.includes('extension activities')) {
          currentSection = 'extensions';
        } else if (sectionTitle.includes('teacher notes')) {
          currentSection = 'notes';
        }
        continue;
      }
      
      // Process content based on current section
      switch (currentSection) {
        case 'objectives':
          if (line.startsWith('•') || line.startsWith('-')) {
            learningObjectives.push(line.replace(/^[•-]\s*/, ''));
          }
          break;
          
        case 'materials':
          if (line.startsWith('•') || line.startsWith('-')) {
            materials.push(line.replace(/^[•-]\s*/, ''));
          }
          break;
          
        case 'setup':
          if (line.startsWith('•') || line.startsWith('-')) {
            setupInstructions.push(line.replace(/^[•-]\s*/, ''));
          }
          break;
          
        case 'instructions':
          // Parse numbered activity steps with timing
          const stepMatch = line.match(/^(\d+)\.\s*\*\*([^*]+)\*\*\s*(?:\(([^)]+)\))?\s*:?\s*(.*)$/);
          if (stepMatch) {
            const newStep = {
              phase: stepMatch[2].trim(),
              time: stepMatch[3] ? stepMatch[3].trim() : '',
              description: stepMatch[4] ? stepMatch[4].trim() : ''
            };
            activityInstructions.push(newStep);
          } else if (line.match(/^\d+\./)) {
            // Fallback for simpler numbered steps
            const simpleMatch = line.match(/^\d+\.\s*(.+)/);
            if (simpleMatch) {
              activityInstructions.push({
                phase: `Step ${activityInstructions.length + 1}`,
                time: '',
                description: simpleMatch[1].trim()
              });
            }
          } else if (activityInstructions.length > 0 && (line.trim().startsWith('a.') || line.trim().startsWith('b.') || line.trim().startsWith('c.') || line.trim().startsWith('d.') || line.trim().match(/^\s+/))) {
            // This is continuation content for the current step
            const currentStep = activityInstructions[activityInstructions.length - 1];
            if (currentStep.description) {
              currentStep.description += '\n' + line.trim();
            } else {
              currentStep.description = line.trim();
            }
          }
          break;
          
        case 'assessment':
          if (line.startsWith('•') || line.startsWith('-')) {
            assessmentStrategies.push(line.replace(/^[•-]\s*/, ''));
          }
          break;
          
        case 'differentiation':
          if (line.includes('Advanced Learners')) {
            differentiationOptions.advanced = line.replace(/.*Advanced Learners.*?:\s*/, '');
          } else if (line.includes('Struggling Learners')) {
            differentiationOptions.struggling = line.replace(/.*Struggling Learners.*?:\s*/, '');
          } else if (line.includes('English Language Learners')) {
            differentiationOptions.ell = line.replace(/.*English Language Learners.*?:\s*/, '');
          }
          break;
          
        case 'extensions':
          if (line.startsWith('•') || line.startsWith('-')) {
            extensionActivities.push(line.replace(/^[•-]\s*/, ''));
          }
          break;
          
        case 'notes':
          if (line.startsWith('•') || line.startsWith('-')) {
            teacherNotes.push(line.replace(/^[•-]\s*/, ''));
          }
          break;
      }
    }
    
    return {
      title,
      subject,
      gradeLevel,
      duration,
      groupSize,
      learningObjectives,
      materials,
      setupInstructions,
      activityInstructions,
      assessmentStrategies,
      differentiationOptions,
      extensionActivities,
      teacherNotes
    };
  };

  const activityData = useMemo(() => parseActivityContent(content), [content]);

  const openLunaChat = () => {
    setPanelVisible?.(true);
  };

  const handleCellEdit = (section: string, index: number, value: string) => {
    if (!editedActivity) {
      setEditedActivity({ ...activityData });
    }
    
    const newActivity = editedActivity || { ...activityData };
    
    switch (section) {
      case 'objectives':
        newActivity.learningObjectives[index] = value;
        break;
      case 'materials':
        newActivity.materials[index] = value;
        break;
      case 'setup':
        newActivity.setupInstructions[index] = value;
        break;
      case 'instructions':
        newActivity.activityInstructions[index].description = value;
        break;
      case 'assessment':
        newActivity.assessmentStrategies[index] = value;
        break;
      case 'extensions':
        newActivity.extensionActivities[index] = value;
        break;
      case 'notes':
        newActivity.teacherNotes[index] = value;
        break;
    }
    
    setEditedActivity(newActivity);
  };

  const handleTitleEdit = (value: string) => {
    if (!editedActivity) {
      setEditedActivity({ ...activityData });
    }
    
    const newActivity = editedActivity || { ...activityData };
    newActivity.title = value;
    setEditedActivity(newActivity);
  };

  const downloadPDF = async () => {
    try {
      const jsPDF = (await import('jspdf')).default;
      
      const doc = new jsPDF({
        orientation: 'portrait',
        unit: 'mm',
        format: 'a4'
      });

      const currentActivity = editedActivity || activityData;
      const primaryColor: [number, number, number] = [59, 130, 246];
      const secondaryColor: [number, number, number] = [248, 250, 252];
      const textColor: [number, number, number] = [31, 41, 55];
      const accentColor: [number, number, number] = [16, 185, 129];

      const pageWidth = doc.internal.pageSize.getWidth();
      const pageHeight = doc.internal.pageSize.getHeight();
      const margin = 15;
      const contentWidth = pageWidth - (margin * 2);
      let yPosition = 25;

      // Helper function to check if we need a new page
      const checkNewPage = (requiredSpace: number) => {
        if (yPosition + requiredSpace > pageHeight - 20) {
          doc.addPage();
          yPosition = 25;
        }
      };

      // Header with title
      doc.setFillColor(primaryColor[0], primaryColor[1], primaryColor[2]);
      doc.rect(0, 0, pageWidth, 35, 'F');
      
      doc.setTextColor(255, 255, 255);
      doc.setFontSize(18);
      doc.setFont('helvetica', 'bold');
      doc.text(currentActivity.title, margin, 20);

      // Metadata bar
      doc.setFontSize(10);
      doc.setFont('helvetica', 'normal');
      const metadataText = [
        currentActivity.subject && `Subject: ${currentActivity.subject}`,
        currentActivity.gradeLevel && `Grade: ${currentActivity.gradeLevel}`,
        currentActivity.duration && `Duration: ${currentActivity.duration}`,
        currentActivity.groupSize && `Group Size: ${currentActivity.groupSize}`
      ].filter(Boolean).join(' | ');
      
      doc.text(metadataText, margin, 30);
      yPosition = 45;

      // Learning Objectives
      if (currentActivity.learningObjectives.length > 0) {
        checkNewPage(30);
        doc.setTextColor(textColor[0], textColor[1], textColor[2]);
        doc.setFontSize(14);
        doc.setFont('helvetica', 'bold');
        doc.text('Learning Objectives', margin, yPosition);
        yPosition += 8;

        doc.setFontSize(10);
        doc.setFont('helvetica', 'normal');
        currentActivity.learningObjectives.forEach(objective => {
          checkNewPage(8);
          const wrappedText = doc.splitTextToSize(`• ${objective}`, contentWidth - 10);
          doc.text(wrappedText, margin + 5, yPosition);
          yPosition += wrappedText.length * 5;
        });
        yPosition += 5;
      }

      // Materials Needed
      if (currentActivity.materials.length > 0) {
        checkNewPage(30);
        doc.setFontSize(14);
        doc.setFont('helvetica', 'bold');
        doc.text('Materials Needed', margin, yPosition);
        yPosition += 8;

        doc.setFontSize(10);
        doc.setFont('helvetica', 'normal');
        currentActivity.materials.forEach(material => {
          checkNewPage(8);
          const wrappedText = doc.splitTextToSize(`• ${material}`, contentWidth - 10);
          doc.text(wrappedText, margin + 5, yPosition);
          yPosition += wrappedText.length * 5;
        });
        yPosition += 5;
      }

      // Setup Instructions
      if (currentActivity.setupInstructions.length > 0) {
        checkNewPage(30);
        doc.setFontSize(14);
        doc.setFont('helvetica', 'bold');
        doc.text('Setup Instructions', margin, yPosition);
        yPosition += 8;

        doc.setFontSize(10);
        doc.setFont('helvetica', 'normal');
        currentActivity.setupInstructions.forEach(instruction => {
          checkNewPage(8);
          const wrappedText = doc.splitTextToSize(`• ${instruction}`, contentWidth - 10);
          doc.text(wrappedText, margin + 5, yPosition);
          yPosition += wrappedText.length * 5;
        });
        yPosition += 5;
      }

      // Activity Instructions
      if (currentActivity.activityInstructions.length > 0) {
        checkNewPage(30);
        doc.setFontSize(14);
        doc.setFont('helvetica', 'bold');
        doc.text('Activity Instructions', margin, yPosition);
        yPosition += 8;

        currentActivity.activityInstructions.forEach((step, index) => {
          checkNewPage(15);
          
          // Step header
          doc.setFontSize(11);
          doc.setFont('helvetica', 'bold');
          const stepHeader = `${index + 1}. ${step.phase}${step.time ? ` (${step.time})` : ''}`;
          doc.text(stepHeader, margin, yPosition);
          yPosition += 6;

          // Step description
          doc.setFontSize(10);
          doc.setFont('helvetica', 'normal');
          const wrappedDescription = doc.splitTextToSize(step.description, contentWidth - 10);
          doc.text(wrappedDescription, margin + 5, yPosition);
          yPosition += wrappedDescription.length * 5 + 3;
        });
        yPosition += 5;
      }

      // Assessment Strategies
      if (currentActivity.assessmentStrategies.length > 0) {
        checkNewPage(30);
        doc.setFontSize(14);
        doc.setFont('helvetica', 'bold');
        doc.text('Assessment Strategies', margin, yPosition);
        yPosition += 8;

        doc.setFontSize(10);
        doc.setFont('helvetica', 'normal');
        currentActivity.assessmentStrategies.forEach(strategy => {
          checkNewPage(8);
          const wrappedText = doc.splitTextToSize(`• ${strategy}`, contentWidth - 10);
          doc.text(wrappedText, margin + 5, yPosition);
          yPosition += wrappedText.length * 5;
        });
        yPosition += 5;
      }

      // Differentiation Options
      const diffOptions = currentActivity.differentiationOptions;
      if (diffOptions.advanced || diffOptions.struggling || diffOptions.ell) {
        checkNewPage(40);
        doc.setFontSize(14);
        doc.setFont('helvetica', 'bold');
        doc.text('Differentiation Options', margin, yPosition);
        yPosition += 8;

        doc.setFontSize(10);
        if (diffOptions.advanced) {
          doc.setFont('helvetica', 'bold');
          doc.text('For Advanced Learners:', margin + 5, yPosition);
          yPosition += 5;
          doc.setFont('helvetica', 'normal');
          const wrappedText = doc.splitTextToSize(diffOptions.advanced, contentWidth - 15);
          doc.text(wrappedText, margin + 10, yPosition);
          yPosition += wrappedText.length * 5 + 3;
        }

        if (diffOptions.struggling) {
          checkNewPage(15);
          doc.setFont('helvetica', 'bold');
          doc.text('For Struggling Learners:', margin + 5, yPosition);
          yPosition += 5;
          doc.setFont('helvetica', 'normal');
          const wrappedText = doc.splitTextToSize(diffOptions.struggling, contentWidth - 15);
          doc.text(wrappedText, margin + 10, yPosition);
          yPosition += wrappedText.length * 5 + 3;
        }

        if (diffOptions.ell) {
          checkNewPage(15);
          doc.setFont('helvetica', 'bold');
          doc.text('For English Language Learners:', margin + 5, yPosition);
          yPosition += 5;
          doc.setFont('helvetica', 'normal');
          const wrappedText = doc.splitTextToSize(diffOptions.ell, contentWidth - 15);
          doc.text(wrappedText, margin + 10, yPosition);
          yPosition += wrappedText.length * 5 + 3;
        }
        yPosition += 5;
      }

      // Extension Activities
      if (currentActivity.extensionActivities.length > 0) {
        checkNewPage(30);
        doc.setFontSize(14);
        doc.setFont('helvetica', 'bold');
        doc.text('Extension Activities', margin, yPosition);
        yPosition += 8;

        doc.setFontSize(10);
        doc.setFont('helvetica', 'normal');
        currentActivity.extensionActivities.forEach(extension => {
          checkNewPage(8);
          const wrappedText = doc.splitTextToSize(`• ${extension}`, contentWidth - 10);
          doc.text(wrappedText, margin + 5, yPosition);
          yPosition += wrappedText.length * 5;
        });
        yPosition += 5;
      }

      // Teacher Notes
      if (currentActivity.teacherNotes.length > 0) {
        checkNewPage(30);
        doc.setFontSize(14);
        doc.setFont('helvetica', 'bold');
        doc.text('Teacher Notes', margin, yPosition);
        yPosition += 8;

        doc.setFontSize(10);
        doc.setFont('helvetica', 'normal');
        currentActivity.teacherNotes.forEach(note => {
          checkNewPage(8);
          const wrappedText = doc.splitTextToSize(`• ${note}`, contentWidth - 10);
          doc.text(wrappedText, margin + 5, yPosition);
          yPosition += wrappedText.length * 5;
        });
      }

      // Footer on all pages
      const totalPages = doc.getNumberOfPages();
      for (let i = 1; i <= totalPages; i++) {
        doc.setPage(i);
        doc.setFontSize(8);
        doc.setTextColor(128, 128, 128);
        doc.text(`Page ${i} of ${totalPages}`, pageWidth - 30, pageHeight - 10);
        doc.text(`Generated on ${new Date().toLocaleDateString()}`, margin, pageHeight - 10);
      }

      // Save the PDF
      doc.save(`${currentActivity.title.toLowerCase().replace(/\s+/g, '-')}-activity.pdf`);
      
    } catch (error) {
      console.error('Error generating PDF:', error);
    }
  };

  const handleRefineWithLuna = () => {
    if (onRefineWithLuna) {
      onRefineWithLuna(editedActivity || activityData);
    }
  };

  const currentActivity = editedActivity || activityData;

  return (
    <div className="space-y-6">
      {/* Activity Header */}
      <div className="text-center space-y-2">
        <h2 className="text-2xl font-bold text-foreground">
          {editingTitle ? (
            <Input
              value={currentActivity.title}
              onChange={(e) => handleTitleEdit(e.target.value)}
              onBlur={() => setEditingTitle(false)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' || e.key === 'Escape') {
                  setEditingTitle(false);
                }
              }}
              autoFocus
              className="text-2xl font-bold text-center"
            />
          ) : (
            <span 
              className="cursor-pointer hover:bg-muted/50 px-2 py-1 rounded"
              onClick={() => setEditingTitle(true)}
            >
              {currentActivity.title}
            </span>
          )}
        </h2>
        <div className="flex items-center justify-center gap-4 text-sm text-muted-foreground">
          <Badge variant="outline">{currentActivity.subject || metadata?.subject || 'Subject'}</Badge>
          <Badge variant="outline">Grade {currentActivity.gradeLevel || metadata?.gradeLevel || 'N/A'}</Badge>
          <Badge variant="outline">{currentActivity.duration || 'Duration'}</Badge>
          <Badge variant="secondary">{currentActivity.groupSize || 'Group Size'}</Badge>
        </div>
      </div>

      {/* Action Buttons */}
      <div className="flex items-center justify-center gap-2">
        <Button
          variant="outline"
          size="sm"
          onClick={() => onCopy(JSON.stringify(currentActivity, null, 2), 'activity-content')}
          className="flex items-center gap-1"
        >
          {copiedItems.has('activity-content') ? (
            <Check className="w-3 h-3" />
          ) : (
            <Copy className="w-3 h-3" />
          )}
          Copy
        </Button>
        <Button
          variant="outline"
          size="sm"
          onClick={() => onRefineWithLuna?.(currentActivity)}
          className="flex items-center gap-1"
        >
          <MessageSquare className="w-3 h-3" />
          Refine with Luna
        </Button>
        <Button
          variant="default"
          size="sm"
          onClick={downloadPDF}
          className="flex items-center gap-1"
        >
          <Download className="w-3 h-3" />
          Download PDF
        </Button>
      </div>

      {/* Structured Activity Content */}
      <div className="space-y-6">
        
        {/* Learning Objectives Section */}
        {currentActivity.learningObjectives.length > 0 && (
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center justify-between">
                <span className="flex items-center gap-2">
                  <Target className="w-5 h-5 text-blue-500" />
                  Learning Objectives
                </span>
                <div className="text-xs text-muted-foreground">
                  Click any item to edit
                </div>
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-2">
                {currentActivity.learningObjectives.map((objective, index) => (
                  <div key={index} className="flex items-start gap-2 p-2 rounded hover:bg-muted/50">
                    <div className="w-1.5 h-1.5 rounded-full bg-blue-500 mt-2 flex-shrink-0" />
                    {editingCell === `objective-${index}` ? (
                      <Textarea
                        value={objective}
                        onChange={(e) => handleCellEdit('objectives', index, e.target.value)}
                        className="text-sm min-h-[60px] resize-none"
                        onBlur={() => setEditingCell(null)}
                        onKeyDown={(e) => {
                          if (e.key === 'Escape') {
                            setEditingCell(null);
                          }
                        }}
                        autoFocus
                      />
                    ) : (
                      <div 
                        className="cursor-pointer hover:bg-gray-100 dark:hover:bg-gray-800/50 p-1 rounded flex-1 text-sm"
                        onClick={() => setEditingCell(`objective-${index}`)}
                      >
                        {objective}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        )}

        {/* Materials Needed Section */}
        {currentActivity.materials.length > 0 && (
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center justify-between">
                <span className="flex items-center gap-2">
                  <Package className="w-5 h-5 text-green-500" />
                  Materials Needed
                </span>
                <div className="text-xs text-muted-foreground">
                  Click any item to edit
                </div>
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-2">
                {currentActivity.materials.map((material, index) => (
                  <div key={index} className="flex items-start gap-2 p-2 rounded hover:bg-muted/50">
                    <div className="w-1.5 h-1.5 rounded-full bg-green-500 mt-2 flex-shrink-0" />
                    {editingCell === `material-${index}` ? (
                      <Input
                        value={material}
                        onChange={(e) => handleCellEdit('materials', index, e.target.value)}
                        className="text-sm"
                        onBlur={() => setEditingCell(null)}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter' || e.key === 'Escape') {
                            setEditingCell(null);
                          }
                        }}
                        autoFocus
                      />
                    ) : (
                      <div 
                        className="cursor-pointer hover:bg-gray-100 dark:hover:bg-gray-800/50 p-1 rounded flex-1 text-sm"
                        onClick={() => setEditingCell(`material-${index}`)}
                      >
                        {material}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        )}

        {/* Setup Instructions Section */}
        {currentActivity.setupInstructions.length > 0 && (
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center justify-between">
                <span className="flex items-center gap-2">
                  <Settings className="w-5 h-5 text-purple-500" />
                  Setup Instructions
                </span>
                <div className="text-xs text-muted-foreground">
                  Click any item to edit
                </div>
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-2">
                {currentActivity.setupInstructions.map((instruction, index) => (
                  <div key={index} className="flex items-start gap-2 p-2 rounded hover:bg-muted/50">
                    <div className="w-1.5 h-1.5 rounded-full bg-purple-500 mt-2 flex-shrink-0" />
                    {editingCell === `setup-${index}` ? (
                      <Textarea
                        value={instruction}
                        onChange={(e) => handleCellEdit('setup', index, e.target.value)}
                        className="text-sm min-h-[60px] resize-none"
                        onBlur={() => setEditingCell(null)}
                        onKeyDown={(e) => {
                          if (e.key === 'Escape') {
                            setEditingCell(null);
                          }
                        }}
                        autoFocus
                      />
                    ) : (
                      <div 
                        className="cursor-pointer hover:bg-gray-100 dark:hover:bg-gray-800/50 p-1 rounded flex-1 text-sm"
                        onClick={() => setEditingCell(`setup-${index}`)}
                      >
                        {instruction}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        )}

        {/* Activity Instructions Section */}
        {currentActivity.activityInstructions.length > 0 && (
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center justify-between">
                <span className="flex items-center gap-2">
                  <PlayCircle className="w-5 h-5 text-blue-500" />
                  Activity Instructions
                </span>
                <div className="text-xs text-muted-foreground">
                  Click any description to edit
                </div>
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {currentActivity.activityInstructions.map((step, index) => (
                  <div key={index} className="border-l-4 border-blue-200 pl-4 p-2 rounded hover:bg-muted/50">
                    <div className="flex items-center gap-2 mb-2">
                      <Badge variant="outline" className="text-xs">
                        Step {index + 1}
                      </Badge>
                      <h4 className="font-semibold text-sm">{step.phase}</h4>
                      {step.time && (
                        <Badge variant="secondary" className="text-xs flex items-center gap-1">
                          <Clock className="w-3 h-3" />
                          {step.time}
                        </Badge>
                      )}
                    </div>
                    {editingCell === `instruction-${index}` ? (
                      <Textarea
                        value={step.description}
                        onChange={(e) => handleCellEdit('instructions', index, e.target.value)}
                        className="text-sm min-h-[80px] resize-none"
                        onBlur={() => setEditingCell(null)}
                        onKeyDown={(e) => {
                          if (e.key === 'Escape') {
                            setEditingCell(null);
                          }
                        }}
                        autoFocus
                      />
                    ) : (
                      <div 
                        className="cursor-pointer hover:bg-gray-100 dark:hover:bg-gray-800/50 p-2 rounded text-sm text-muted-foreground leading-relaxed"
                        onClick={() => setEditingCell(`instruction-${index}`)}
                      >
                        {step.description}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        )}

        {/* Assessment Strategies Section */}
        {currentActivity.assessmentStrategies.length > 0 && (
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center justify-between">
                <span className="flex items-center gap-2">
                  <CheckCircle className="w-5 h-5 text-orange-500" />
                  Assessment Strategies
                </span>
                <div className="text-xs text-muted-foreground">
                  Click any item to edit
                </div>
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-2">
                {currentActivity.assessmentStrategies.map((strategy, index) => (
                  <div key={index} className="flex items-start gap-2 p-2 rounded hover:bg-muted/50">
                    <div className="w-1.5 h-1.5 rounded-full bg-orange-500 mt-2 flex-shrink-0" />
                    {editingCell === `assessment-${index}` ? (
                      <Textarea
                        value={strategy}
                        onChange={(e) => handleCellEdit('assessment', index, e.target.value)}
                        className="text-sm min-h-[60px] resize-none"
                        onBlur={() => setEditingCell(null)}
                        onKeyDown={(e) => {
                          if (e.key === 'Escape') {
                            setEditingCell(null);
                          }
                        }}
                        autoFocus
                      />
                    ) : (
                      <div 
                        className="cursor-pointer hover:bg-gray-100 dark:hover:bg-gray-800/50 p-1 rounded flex-1 text-sm"
                        onClick={() => setEditingCell(`assessment-${index}`)}
                      >
                        {strategy}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        )}

        {/* Differentiation Options */}
        {(currentActivity.differentiationOptions.advanced || 
          currentActivity.differentiationOptions.struggling || 
          currentActivity.differentiationOptions.ell) && (
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Users className="w-5 h-5 text-indigo-500" />
                Differentiation Options
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {currentActivity.differentiationOptions.advanced && (
                  <div>
                    <h4 className="font-semibold text-sm text-green-600 mb-2">
                      For Advanced Learners
                    </h4>
                    <p className="text-sm text-muted-foreground">
                      {currentActivity.differentiationOptions.advanced}
                    </p>
                  </div>
                )}
                
                {currentActivity.differentiationOptions.struggling && (
                  <div>
                    <h4 className="font-semibold text-sm text-orange-600 mb-2">
                      For Struggling Learners
                    </h4>
                    <p className="text-sm text-muted-foreground">
                      {currentActivity.differentiationOptions.struggling}
                    </p>
                  </div>
                )}
                
                {currentActivity.differentiationOptions.ell && (
                  <div>
                    <h4 className="font-semibold text-sm text-blue-600 mb-2">
                      For English Language Learners
                    </h4>
                    <p className="text-sm text-muted-foreground">
                      {currentActivity.differentiationOptions.ell}
                    </p>
                  </div>
                )}
              </div>
            </CardContent>
          </Card>
        )}

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Extension Activities Section */}
          {currentActivity.extensionActivities.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center justify-between">
                  <span className="flex items-center gap-2">
                    <Plus className="w-5 h-5 text-teal-500" />
                    Extension Activities
                  </span>
                  <div className="text-xs text-muted-foreground">
                    Click to edit
                  </div>
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-2">
                  {currentActivity.extensionActivities.map((extension, index) => (
                    <div key={index} className="flex items-start gap-2 p-2 rounded hover:bg-muted/50">
                      <div className="w-1.5 h-1.5 rounded-full bg-teal-500 mt-2 flex-shrink-0" />
                      {editingCell === `extension-${index}` ? (
                        <Textarea
                          value={extension}
                          onChange={(e) => handleCellEdit('extensions', index, e.target.value)}
                          className="text-sm min-h-[60px] resize-none"
                          onBlur={() => setEditingCell(null)}
                          onKeyDown={(e) => {
                            if (e.key === 'Escape') {
                              setEditingCell(null);
                            }
                          }}
                          autoFocus
                        />
                      ) : (
                        <div 
                          className="cursor-pointer hover:bg-gray-100 dark:hover:bg-gray-800/50 p-1 rounded flex-1 text-sm"
                          onClick={() => setEditingCell(`extension-${index}`)}
                        >
                          {extension}
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}

          {/* Teacher Notes Section */}
          {currentActivity.teacherNotes.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center justify-between">
                  <span className="flex items-center gap-2">
                    <Lightbulb className="w-5 h-5 text-yellow-500" />
                    Teacher Notes
                  </span>
                  <div className="text-xs text-muted-foreground">
                    Click to edit
                  </div>
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-2">
                  {currentActivity.teacherNotes.map((note, index) => (
                    <div key={index} className="flex items-start gap-2 p-2 rounded hover:bg-muted/50">
                      <AlertTriangle className="w-4 h-4 text-yellow-500 mt-0.5 flex-shrink-0" />
                      {editingCell === `note-${index}` ? (
                        <Textarea
                          value={note}
                          onChange={(e) => handleCellEdit('notes', index, e.target.value)}
                          className="text-sm min-h-[60px] resize-none"
                          onBlur={() => setEditingCell(null)}
                          onKeyDown={(e) => {
                            if (e.key === 'Escape') {
                              setEditingCell(null);
                            }
                          }}
                          autoFocus
                        />
                      ) : (
                        <div 
                          className="cursor-pointer hover:bg-gray-100 dark:hover:bg-gray-800/50 p-1 rounded flex-1 text-sm"
                          onClick={() => setEditingCell(`note-${index}`)}
                        >
                          {note}
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}
        </div>
      </div>

      {/* Debug Information */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Debug Information</CardTitle>
        </CardHeader>
        <CardContent>
          <details className="space-y-2">
            <summary className="cursor-pointer text-sm text-muted-foreground hover:text-foreground">
              View parsing details and raw content
            </summary>
            <div className="mt-2 space-y-4">
              <div>
                <h4 className="font-medium mb-2">Parsed Structure:</h4>
                <pre className="text-xs bg-muted p-3 rounded overflow-x-auto">
                  {JSON.stringify(currentActivity, null, 2)}
                </pre>
              </div>
              <div>
                <h4 className="font-medium mb-2">Raw AI Content:</h4>
                <pre className="text-xs bg-muted p-3 rounded overflow-x-auto whitespace-pre-wrap">
                  {content}
                </pre>
              </div>
            </div>
          </details>
        </CardContent>
      </Card>
    </div>
  );
}
