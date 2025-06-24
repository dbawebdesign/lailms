'use client';

import React, { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Textarea } from '@/components/ui/textarea';
import { Input } from '@/components/ui/input';
import { Copy, Download, Check, MessageCircle } from 'lucide-react';
import { useUIContext } from '@/context/UIContext';

interface RubricDisplayProps {
  content: string;
  metadata?: {
    subject?: string;
    gradeLevel?: string;
    assessmentType?: string;
    generatedAt?: string;
    wordCount?: number;
    estimatedTime?: string;
    difficulty?: string;
  };
  onCopy: (text: string, itemId: string) => void;
  copiedItems: Set<string>;
  onRefineWithLuna?: (currentRubric: ParsedRubric) => void;
}

interface RubricLevel {
  level: string;
  points: number;
  description: string;
}

interface RubricCriterion {
  name: string;
  levels: RubricLevel[];
}

interface ParsedRubric {
  title: string;
  criteria: RubricCriterion[];
  totalPoints: number;
  subject?: string;
  gradeLevel?: string;
}

export function RubricDisplay({ content, metadata, onCopy, copiedItems, onRefineWithLuna }: RubricDisplayProps) {
  const [editingCell, setEditingCell] = useState<string | null>(null);
  const [editedRubric, setEditedRubric] = useState<ParsedRubric | null>(null);
  const [editingTitle, setEditingTitle] = useState(false);
  
  // Safely access UIContext for panel control
  let setPanelVisible: ((visible: boolean) => void) | undefined;
  
  try {
    const { setPanelVisible: setPanelVisibleFn } = useUIContext();
    setPanelVisible = setPanelVisibleFn;
  } catch (error) {
    console.warn('UIContext not available - Luna integration disabled');
  }

  // Enhanced parsing logic with multiple strategies
  const parseRubricContent = (content: string): ParsedRubric => {
    console.log('Parsing rubric content:', content.substring(0, 200) + '...');
    
    const lines = content.split('\n').map(line => line.trim()).filter(line => line);
    const criteria: RubricCriterion[] = [];
    let title = 'Assessment Rubric';
    let subject = '';
    let gradeLevel = '';
    
    // Extract title (first line with "Rubric" or first **bold** line)
    const titleLine = lines.find(line => 
      line.toLowerCase().includes('rubric') || 
      (line.startsWith('**') && line.endsWith('**'))
    );
    if (titleLine) {
      title = titleLine.replace(/\*\*/g, '').trim();
    }
    
    // Extract subject and grade level
    const subjectMatch = content.match(/subject:\s*([^\n*]+)/i);
    if (subjectMatch) subject = subjectMatch[1].trim();
    
    const gradeMatch = content.match(/grade[^:]*:\s*([^\n*]+)/i);
    if (gradeMatch) gradeLevel = gradeMatch[1].trim();
    
    console.log('Extracted metadata:', { title, subject, gradeLevel });
    
    // Process each line to find criteria
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      
      // Skip metadata lines
      if (line.toLowerCase().includes('grade') || 
          line.toLowerCase().includes('subject') ||
          line.toLowerCase().includes('total points') ||
          line.toLowerCase().includes('performance levels') ||
          line.toLowerCase().includes('scoring guide') ||
          line.startsWith('---') ||
          line.startsWith('###') ||
          line.startsWith('*Grade') ||
          line.startsWith('*Subject')) {
        continue;
      }
      
      // Check if this line contains both criteria name and pipe-separated levels
      if (line.includes('|')) {
        // Look for criteria header at the beginning of the line
        const criteriaMatch = line.match(/^(\d+\.?\s*|\*\*\d+\.?\s*)(.*?)(\|.*)/);
        if (criteriaMatch) {
          const criteriaName = criteriaMatch[2].replace(/\*\*/g, '').trim();
          const levelsLine = criteriaMatch[3]; // Everything after the criteria name
          
          console.log('Found criteria with levels on same line:', criteriaName);
          console.log('Levels line:', levelsLine);
          
          const levels = parsePerformanceLevelsFromPipeLine(levelsLine);
          if (levels.length > 0) {
            criteria.push({
              name: criteriaName,
              levels: levels
            });
            console.log(`Added criteria: ${criteriaName} with ${levels.length} levels`);
          }
        }
      }
      
      // Also check for traditional format where criteria header is separate
      const criteriaMatch = line.match(/^(\d+\.?\s*|\*\*\d+\.?\s*)(.*?)(\*\*)?$/);
      if (criteriaMatch && !line.includes('|')) {
        const criteriaName = criteriaMatch[2].replace(/\*\*/g, '').trim();
        console.log('Found criteria header:', criteriaName);
        
        // Look for the next line with pipe-separated levels
        let levelsLine = '';
        for (let j = i + 1; j < lines.length; j++) {
          const nextLine = lines[j];
          if (nextLine.includes('|')) {
            levelsLine = nextLine;
            console.log('Found levels line:', levelsLine);
            break;
          }
          // Stop if we hit another criteria header
          if (nextLine.match(/^(\d+\.?\s*|\*\*\d+\.?\s*)/)) {
            break;
          }
        }
        
        if (levelsLine) {
          const levels = parsePerformanceLevelsFromPipeLine(levelsLine);
          if (levels.length > 0) {
            criteria.push({
              name: criteriaName,
              levels: levels
            });
            console.log(`Added criteria: ${criteriaName} with ${levels.length} levels`);
          }
        }
      }
    }
    
    // Calculate total points based on actual levels
    const totalPoints = criteria.length > 0 ? 
      Math.max(...criteria[0].levels.map(l => l.points)) * criteria.length : 
      0;
    
    console.log('Final parsed rubric:', { title, subject, gradeLevel, criteriaCount: criteria.length, totalPoints });
    
    return {
      title,
      subject,
      gradeLevel,
      criteria,
      totalPoints
    };
  };

  // Parse performance levels from pipe-separated line
  const parsePerformanceLevelsFromPipeLine = (line: string): RubricLevel[] => {
    console.log('Parsing pipe line:', line);
    
    const levels: RubricLevel[] = [];
    // Remove leading pipe if present and split on remaining pipes
    const cleanLine = line.startsWith('|') ? line.substring(1) : line;
    const parts = cleanLine.split('|').map(part => part.trim()).filter(part => part);
    
    console.log('Pipe parts:', parts);
    
    // Each part is a complete description, not grouped by 3
    // The format is: Description1 | Description2 | Description3 | Description4
    // We need to assign points in descending order (4, 3, 2, 1)
    const levelNames = ['Exemplary', 'Proficient', 'Developing', 'Beginning'];
    
    parts.forEach((description, index) => {
      const points = parts.length - index; // Highest points for first description
      const levelName = levelNames[index] || `Level ${points}`;
      
      levels.push({
        level: levelName,
        points: points,
        description: description
      });
      
      console.log(`Parsed level: ${levelName} (${points}pts) - ${description.substring(0, 50)}...`);
    });
    
    console.log('Final parsed levels:', levels);
    return levels;
  };

  // Extract levels from description text (fallback method)
  const extractLevelsFromDescription = (description: string): RubricLevel[] => {
    console.log('Extracting levels from description:', description);
    
    const levels: RubricLevel[] = [];
    
    // Try to find numbered or named levels
    const levelPatterns = [
      /(\w+)\s*\((\d+)\s*pts?\):\s*([^.]+)/gi,
      /(\w+)\s*-\s*(\d+)\s*points?:\s*([^.]+)/gi,
      /(\d+)\.\s*(\w+):\s*([^.]+)/gi
    ];
    
    for (const pattern of levelPatterns) {
      const matches = Array.from(description.matchAll(pattern));
      for (const match of matches) {
        const levelName = match[1] || match[2];
        const points = parseInt(match[2] || match[1]) || levels.length + 1;
        const desc = match[3] || match[2];
        
        levels.push({
          level: levelName,
          points: points,
          description: desc.trim()
        });
      }
      
      if (levels.length > 0) break;
    }
    
    return levels.sort((a, b) => b.points - a.points);
  };

  const [rubricData, setRubricData] = useState<ParsedRubric>(() => parseRubricContent(content));

  // Initialize edited rubric state
  React.useEffect(() => {
    if (!editedRubric) {
      setEditedRubric(rubricData);
    }
  }, [rubricData, editedRubric]);

  const handleCellEdit = (criterionIndex: number, levelIndex: number, field: 'description' | 'level' | 'points', value: string) => {
    if (!editedRubric) return;
    
    const newRubric = { ...editedRubric };
    const criterion = { ...newRubric.criteria[criterionIndex] };
    const level = { ...criterion.levels[levelIndex] };
    
    if (field === 'points') {
      level.points = parseInt(value) || 1;
    } else {
      level[field] = value;
    }
    
    criterion.levels[levelIndex] = level;
    newRubric.criteria[criterionIndex] = criterion;
    
    setEditedRubric(newRubric);
  };

  const handleCriterionNameEdit = (criterionIndex: number, value: string) => {
    if (!editedRubric) return;
    
    const newRubric = { ...editedRubric };
    newRubric.criteria[criterionIndex] = {
      ...newRubric.criteria[criterionIndex],
      name: value
    };
    
    setEditedRubric(newRubric);
  };

  const openLunaChat = () => {
    setPanelVisible?.(true);
  };

  const downloadPDF = async () => {
    try {
      const jsPDF = (await import('jspdf')).default;
      const autoTable = (await import('jspdf-autotable')).default;
      
      const doc = new jsPDF({
        orientation: 'landscape',
        unit: 'mm',
        format: 'a4'
      });

      const currentRubric = editedRubric || rubricData;
      const primaryColor: [number, number, number] = [59, 130, 246];
      const secondaryColor: [number, number, number] = [248, 250, 252];
      const textColor: [number, number, number] = [31, 41, 55];

      // Header
      doc.setFontSize(20);
      doc.setTextColor(textColor[0], textColor[1], textColor[2]);
      doc.text(currentRubric.title, 15, 20);

      // Subtitle info
      doc.setFontSize(12);
      doc.text(`Subject: ${currentRubric.subject || 'N/A'} | Grade: ${currentRubric.gradeLevel || 'N/A'}`, 15, 30);
      doc.text(`Total Points: ${currentRubric.totalPoints} | Generated: ${new Date().toLocaleDateString()}`, 15, 37);

      // Create table
      const tableColumns = ['Criteria', ...currentRubric.criteria[0]?.levels.map(level => `${level.level} (${level.points}pts)`) || []];
      const tableRows = currentRubric.criteria.map(criterion => [
        criterion.name,
        ...criterion.levels.map(level => level.description)
      ]);

      autoTable(doc, {
        head: [tableColumns],
        body: tableRows,
        startY: 55,
        theme: 'grid',
        headStyles: {
          fillColor: primaryColor,
          textColor: [255, 255, 255],
          fontSize: 10,
          fontStyle: 'bold',
          halign: 'center',
          valign: 'middle'
        },
        bodyStyles: {
          fontSize: 9,
          cellPadding: 3,
          valign: 'top'
        },
        columnStyles: {
          0: { fontStyle: 'bold', fillColor: secondaryColor, cellWidth: 35, halign: 'center' }
        },
        alternateRowStyles: {
          fillColor: [252, 252, 252]
        },
        margin: { left: 15, right: 15 }
      });

      doc.setFontSize(8);
      doc.setTextColor(128, 128, 128);
      doc.text('Generated by Learnology AI', 15, 200);

      const fileName = `${currentRubric.title.replace(/\s+/g, '_').toLowerCase()}.pdf`;
      doc.save(fileName);

    } catch (error) {
      console.error('Error generating PDF:', error);
    }
  };

  const currentRubric = editedRubric || rubricData;

  return (
    <div className="space-y-6">
      {/* Rubric Header */}
      <div className="text-center space-y-2">
        <h2 className="text-2xl font-bold text-foreground">
          {editingTitle ? (
            <Input
              value={currentRubric.title}
              onChange={(e) => {
                const newRubric = { ...currentRubric, title: e.target.value };
                setEditedRubric(newRubric);
              }}
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
              {currentRubric.title}
            </span>
          )}
        </h2>
        <div className="flex items-center justify-center gap-4 text-sm text-muted-foreground">
          <Badge variant="outline">{currentRubric.subject || metadata?.subject || 'Subject'}</Badge>
          <Badge variant="outline">Grade {currentRubric.gradeLevel || metadata?.gradeLevel || 'N/A'}</Badge>
          <Badge variant="secondary">Total: {currentRubric.totalPoints} pts</Badge>
        </div>
      </div>

      {/* Action Buttons */}
      <div className="flex items-center justify-center gap-2">
        <Button
          variant="outline"
          size="sm"
          onClick={() => onCopy(JSON.stringify(currentRubric, null, 2), 'rubric-content')}
          className="flex items-center gap-1"
        >
          {copiedItems.has('rubric-content') ? (
            <Check className="w-3 h-3" />
          ) : (
            <Copy className="w-3 h-3" />
          )}
          Copy
        </Button>
        <Button
          variant="outline"
          size="sm"
          onClick={() => onRefineWithLuna?.(currentRubric)}
          className="flex items-center gap-1"
        >
          <MessageCircle className="w-3 h-3" />
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

      {/* Editable Rubric Grid */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center justify-between">
            <span>Assessment Rubric</span>
            <div className="text-xs text-muted-foreground">
              Click any cell to edit
            </div>
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <table className="w-full border-collapse border border-gray-300 dark:border-gray-600">
              <thead>
                <tr className="bg-gray-50 dark:bg-gray-800">
                  <th className="border border-gray-300 dark:border-gray-600 px-4 py-3 text-left font-semibold text-gray-900 dark:text-gray-100 w-1/4">
                    Criteria
                  </th>
                  {/* Dynamically render performance level headers */}
                  {currentRubric.criteria.length > 0 && currentRubric.criteria[0].levels.map((level, index) => (
                    <th key={index} className="border border-gray-300 dark:border-gray-600 px-4 py-3 text-center font-semibold text-gray-900 dark:text-gray-100">
                      <div className="flex flex-col items-center">
                        <span className="text-sm">{level.level}</span>
                        <span className="text-xs text-blue-600 dark:text-blue-400 font-medium">
                          {level.points} pt{level.points !== 1 ? 's' : ''}
                        </span>
                      </div>
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {currentRubric.criteria.map((criterion, criterionIndex) => (
                  <tr key={criterionIndex} className="hover:bg-gray-50 dark:hover:bg-gray-800/50">
                    <td className="border border-gray-300 dark:border-gray-600 px-4 py-3 font-medium text-gray-900 dark:text-gray-100 bg-gray-25 dark:bg-gray-900/50">
                      {editingCell === `criterion-${criterionIndex}` ? (
                        <Input
                          value={criterion.name}
                          onChange={(e) => handleCriterionNameEdit(criterionIndex, e.target.value)}
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
                          className="cursor-pointer hover:bg-gray-100 dark:hover:bg-gray-800/50 p-1 rounded"
                          onClick={() => setEditingCell(`criterion-${criterionIndex}`)}
                        >
                          {criterion.name}
                        </div>
                      )}
                    </td>
                    {/* Dynamically render performance level descriptions */}
                    {criterion.levels.map((level, levelIndex) => (
                      <td key={levelIndex} className="border border-gray-300 dark:border-gray-600 px-4 py-3 text-sm text-gray-700 dark:text-gray-300">
                        {editingCell === `cell-${criterionIndex}-${levelIndex}` ? (
                          <Textarea
                            value={level.description}
                            onChange={(e) => handleCellEdit(criterionIndex, levelIndex, 'description', e.target.value)}
                            className="text-xs min-h-[60px] resize-none"
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
                            className="cursor-pointer hover:bg-gray-100 dark:hover:bg-gray-800/50 p-1 rounded min-h-[40px] flex items-center"
                            onClick={() => setEditingCell(`cell-${criterionIndex}-${levelIndex}`)}
                          >
                            {level.description}
                          </div>
                        )}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>

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
                  {JSON.stringify(currentRubric, null, 2)}
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